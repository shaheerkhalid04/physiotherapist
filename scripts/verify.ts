import "dotenv/config";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { renderProgressReport } from "../src/lib/export/progressReport";
import { renderClinicLetter } from "../src/lib/export/clinicLetter";
import { renderAuditWorkbook } from "../src/lib/export/auditWorkbook";
import { evaluateRules, type RuleContext } from "../src/lib/clinical/rules";

/**
 * Verifies against the live database the things unit tests cannot: that the schema itself
 * refuses an unreviewed protocol, and that the export builders produce real files.
 *
 *   npx tsx scripts/verify.ts
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let failures = 0;

function check(name: string, passed: boolean, detail = "") {
  console.log(`${passed ? "  pass" : "  FAIL"}  ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!passed) failures += 1;
}

async function main() {
  const patient = await prisma.patient.findFirstOrThrow({ include: { department: true } });
  const surgeon = await prisma.user.findFirstOrThrow({ where: { role: "SURGEON" } });

  console.log("\nDatabase level safety constraint");

  const draft = await prisma.protocolTemplate.findFirstOrThrow({
    where: { reviewedById: null },
    include: { phases: true },
  });

  try {
    await prisma.patientProtocol.create({
      data: {
        patientId: patient.id,
        sourceTemplateId: draft.id,
        sourceTemplateVersion: draft.version,
        // This is the whole point: there is no reviewer to copy, so the column cannot be
        // satisfied and the database rejects the write.
        sourceTemplateReviewedById: draft.reviewedById as unknown as string,
        assignedById: surgeon.id,
      },
    });
    check("unreviewed template cannot be assigned", false, "the write succeeded");
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    check("unreviewed template cannot be assigned", true, message.slice(0, 80));
  }

  console.log("\nRules engine against seeded data");

  const symptoms = await prisma.symptomLog.findMany({
    where: { patientId: patient.id },
    orderBy: { recordedAt: "desc" },
  });
  const measurements = await prisma.measurement.findMany({
    where: { patientId: patient.id },
    orderBy: { recordedAt: "desc" },
  });
  const sessions = await prisma.session.findMany({ where: { patientId: patient.id } });
  const thresholdRows = await prisma.alertThreshold.findMany({
    where: { departmentId: patient.departmentId },
  });

  const ctx: RuleContext = {
    patientId: patient.id,
    now: new Date(),
    postOpDay: 21,
    phase: { name: "Protective", order: 0, protective: true, activeFrom: new Date() },
    symptoms: symptoms.map((s) => ({ ...s })),
    measurements: measurements.map((m) => ({
      instrumentKey: m.instrumentKey,
      recordedAt: m.recordedAt,
      postOpDay: m.postOpDay,
      value: m.value,
      method: m.method,
      passiveValue: null,
    })),
    sessions: sessions.map((s) => ({
      scheduledFor: s.scheduledFor,
      status: s.status,
      orthosis: s.orthosis,
    })),
    thresholds: Object.fromEntries(
      thresholdRows.map((row) => [
        row.ruleKey,
        { params: row.params as Record<string, number>, approved: row.approvedById !== null },
      ]),
    ),
  };

  const withUnapproved = evaluateRules(ctx);
  check(
    "seeded patient raises no non-urgent alerts",
    withUnapproved.every((hit) => hit.severity === "URGENT"),
    `${withUnapproved.length} hits, severities ${[...new Set(withUnapproved.map((h) => h.severity))].join(",") || "none"}`,
  );

  // The seeded patient is deliberately doing well, so comparing hit counts on that data
  // proves nothing. Overlay a genuine plateau, then check that approval is what flips the
  // rule on. Without this the assertion below is 0 >= 0.
  const plateauMeasurements = [
    { ...ctx.measurements[0], recordedAt: new Date(Date.now() - 14 * 86_400_000), value: 180 },
    { ...ctx.measurements[0], recordedAt: new Date(), value: 183 },
  ];

  const plateauUnapproved = evaluateRules({ ...ctx, measurements: plateauMeasurements });
  const plateauApproved = evaluateRules({
    ...ctx,
    measurements: plateauMeasurements,
    thresholds: Object.fromEntries(
      thresholdRows.map((row) => [
        row.ruleKey,
        { params: row.params as Record<string, number>, approved: true },
      ]),
    ),
  });

  const inert = plateauUnapproved.find((hit) => hit.ruleKey === "rom-plateau");
  const active = plateauApproved.find((hit) => hit.ruleKey === "rom-plateau");

  check(
    "a real plateau stays inert while its threshold is unapproved",
    inert === undefined,
    inert ? "it fired anyway" : "no hit, as intended",
  );
  check(
    "the same plateau fires once a clinician approves the threshold",
    active !== undefined && active.severity === "REVIEW",
    active ? `gain ${String(active.context.gain)} degrees over 14 days` : "did not fire",
  );

  console.log("\nExports");

  await mkdir("tmp-exports", { recursive: true });

  const reportInput = {
    department: {
      name: patient.department.name,
      hospital: patient.department.hospital,
      contactPhone: patient.department.contactPhone,
    },
    patient: {
      name: patient.name,
      mrn: patient.mrn,
      age: patient.age,
      operatedSide: patient.operatedSide,
    },
    operation: {
      procedure: "Zone II flexor tendon repair, index finger",
      dateOfSurgery: new Date(),
      operatingSurgeon: surgeon.name,
    },
    phase: { name: "Protected early active motion", weekStart: 0, weekEnd: 4 },
    measurements: measurements.map((m) => ({
      recordedAt: m.recordedAt,
      postOpDay: m.postOpDay,
      instrumentKey: m.instrumentKey,
      value: m.value,
      method: m.method,
    })),
    adherence: {
      due: sessions.length,
      completed: sessions.filter((s) => s.status === "COMPLETE").length,
    },
    alerts: [],
    generatedBy: surgeon.name,
    generatedAt: new Date(),
  };

  const pdf = await renderProgressReport(reportInput);
  await writeFile("tmp-exports/progress.pdf", pdf);
  check("PDF progress report", pdf.length > 1000, `${pdf.length} bytes`);

  const docx = await renderClinicLetter(reportInput);
  await writeFile("tmp-exports/clinic-letter.docx", docx);
  check("DOCX clinic letter", docx.length > 1000, `${docx.length} bytes`);

  const xlsx = await renderAuditWorkbook(
    [
      {
        mrn: patient.mrn,
        ageAtSurgery: patient.age,
        sex: patient.sex,
        operatedSide: patient.operatedSide,
        dominance: patient.dominance,
        procedure: "Zone II flexor tendon repair",
        dateOfSurgery: new Date(),
        operatingSurgeon: surgeon.name,
        protocol: "Zone II flexor tendon repair, early active motion",
        currentPhase: "Protected early active motion",
        postOpDay: 21,
        latestTam: measurements[0]?.value ?? null,
        latestTamMethod: "Patient self-measured",
        latestTamDay: measurements[0]?.postOpDay ?? null,
        baselineQuickDash: null,
        latestQuickDash: null,
        baselinePrwhe: null,
        latestPrwhe: null,
        sessionsDue: sessions.length,
        sessionsCompleted: sessions.filter((s) => s.status === "COMPLETE").length,
        urgentAlerts: 0,
        reviewAlerts: 0,
        outreachAlerts: 0,
      },
    ],
    {
      department: patient.department.name,
      hospital: patient.department.hospital,
      generatedBy: surgeon.name,
      generatedAt: new Date(),
    },
  );
  await writeFile("tmp-exports/audit.xlsx", xlsx);
  check("XLSX audit workbook", xlsx.length > 1000, `${xlsx.length} bytes`);

  console.log("\nSync idempotency at the database level");

  const clientUuid = randomUUID();
  const row = {
    clientUuid,
    patientId: patient.id,
    scheduledFor: new Date(),
    postOpDay: 21,
    status: "COMPLETE" as const,
    orthosis: "WORN_AS_INSTRUCTED" as const,
  };

  await prisma.session.create({ data: row });
  try {
    await prisma.session.create({ data: row });
    check("replaying the same clientUuid is rejected", false, "second insert succeeded");
  } catch (error) {
    const code = (error as { code?: string }).code;
    check("replaying the same clientUuid is rejected", code === "P2002", `code ${code}`);
  }
  await prisma.session.delete({ where: { clientUuid } });

  console.log(`\n${failures === 0 ? "All checks passed" : `${failures} checks FAILED`}\n`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
