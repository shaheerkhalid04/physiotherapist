import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { activePhase, postOpDay } from "@/lib/domain/prescription";
import { writeAudit } from "@/lib/domain/audit";
import { renderProgressReport, type ReportInput } from "@/lib/export/progressReport";
import { renderClinicLetter } from "@/lib/export/clinicLetter";
import { renderAuditWorkbook, type AuditRow } from "@/lib/export/auditWorkbook";

/**
 * Exports.
 *
 *   /api/export/pdf?patientId=   clinician progress report
 *   /api/export/docx?patientId=  editable clinic letter
 *   /api/export/xlsx             departmental audit workbook
 *
 * Every export is audit logged, because an export is the moment patient data leaves the
 * system and the department needs to be able to say who took what and when.
 */

const STAFF = new Set(["THERAPIST", "SURGEON", "ADMIN"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const session = await auth();
  if (!session?.user || !STAFF.has(session.user.role)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { kind } = await params;
  const patientId = new URL(request.url).searchParams.get("patientId");

  if (kind === "xlsx") {
    const buffer = await buildAuditWorkbook(session.user.departmentId, session.user.name ?? "Unknown");
    await writeAudit({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "EXPORT_AUDIT_XLSX",
      entity: "Department",
      entityId: session.user.departmentId,
      request,
    });
    return file(buffer, "departmental-audit.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  if (!patientId) {
    return NextResponse.json({ error: "patientId is required" }, { status: 400 });
  }

  const data = await buildReportInput(patientId, session.user.departmentId, session.user.name ?? "Unknown");
  if (!data) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  if (kind === "pdf") {
    const buffer = await renderProgressReport(data);
    await writeAudit({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "EXPORT_PROGRESS_PDF",
      entity: "Patient",
      entityId: patientId,
      request,
    });
    return file(buffer, `progress-${data.patient.mrn}.pdf`, "application/pdf");
  }

  if (kind === "docx") {
    const buffer = await renderClinicLetter(data);
    await writeAudit({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "EXPORT_CLINIC_LETTER_DOCX",
      entity: "Patient",
      entityId: patientId,
      request,
    });
    return file(
      buffer,
      `clinic-letter-${data.patient.mrn}.docx`,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  }

  return NextResponse.json({ error: `Unknown export kind: ${kind}` }, { status: 400 });
}

function file(buffer: Buffer, filename: string, contentType: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

async function buildReportInput(
  patientId: string,
  departmentId: string,
  generatedBy: string,
): Promise<ReportInput | null> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, departmentId },
    include: {
      department: true,
      operation: true,
      protocols: {
        where: { active: true },
        include: { phases: { include: { exercises: true }, orderBy: { order: "asc" } } },
      },
      measurements: { orderBy: { recordedAt: "desc" }, take: 60 },
      sessions: true,
      alerts: { orderBy: { raisedAt: "desc" }, take: 25 },
    },
  });

  if (!patient) return null;

  const now = new Date();
  const phase = activePhase(patient.protocols[0] ?? null, now);
  const due = patient.sessions.filter((s) => s.scheduledFor <= now);

  return {
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
    operation: patient.operation
      ? {
          procedure: patient.operation.procedure,
          dateOfSurgery: patient.operation.dateOfSurgery,
          operatingSurgeon: patient.operation.operatingSurgeon,
        }
      : null,
    phase: phase ? { name: phase.name, weekStart: phase.weekStart, weekEnd: phase.weekEnd } : null,
    measurements: patient.measurements.map((m) => ({
      recordedAt: m.recordedAt,
      postOpDay: m.postOpDay,
      instrumentKey: m.instrumentKey,
      value: m.value,
      method: m.method,
    })),
    adherence: {
      due: due.length,
      completed: due.filter((s) => s.status === "COMPLETE" || s.status === "PARTIAL").length,
    },
    alerts: patient.alerts.map((a) => ({
      ruleKey: a.ruleKey,
      severity: a.severity,
      raisedAt: a.raisedAt,
      status: a.status,
    })),
    generatedBy,
    generatedAt: now,
  };
}

async function buildAuditWorkbook(departmentId: string, generatedBy: string): Promise<Buffer> {
  const department = await prisma.department.findUniqueOrThrow({ where: { id: departmentId } });

  const patients = await prisma.patient.findMany({
    where: { departmentId },
    include: {
      operation: true,
      protocols: {
        where: { active: true },
        include: {
          sourceTemplate: true,
          phases: { include: { exercises: true }, orderBy: { order: "asc" } },
        },
      },
      measurements: { orderBy: { recordedAt: "desc" } },
      promResponses: { orderBy: { scheduledFor: "asc" } },
      sessions: true,
      alerts: true,
    },
  });

  const now = new Date();

  const rows: AuditRow[] = patients.map((patient) => {
    const protocol = patient.protocols[0] ?? null;
    const phase = activePhase(protocol, now);
    const tam = patient.measurements.find((m) => m.instrumentKey === "finger-rom");
    const due = patient.sessions.filter((s) => s.scheduledFor <= now);

    const quickDash = patient.promResponses.filter((p) => p.instrument === "QUICKDASH");
    const prwhe = patient.promResponses.filter((p) => p.instrument === "PRWHE");

    return {
      mrn: patient.mrn,
      ageAtSurgery: patient.age,
      sex: patient.sex,
      operatedSide: patient.operatedSide,
      dominance: patient.dominance,
      procedure: patient.operation?.procedure ?? "Not recorded",
      dateOfSurgery: patient.operation?.dateOfSurgery ?? null,
      operatingSurgeon: patient.operation?.operatingSurgeon ?? "Not recorded",
      protocol: protocol?.sourceTemplate.name ?? null,
      currentPhase: phase?.name ?? null,
      postOpDay: patient.operation ? postOpDay(patient.operation.dateOfSurgery, now) : null,
      latestTam: tam?.value ?? null,
      latestTamMethod: tam ? (tam.method === "SELF" ? "Patient self-measured" : "Clinic") : null,
      latestTamDay: tam?.postOpDay ?? null,
      baselineQuickDash: quickDash[0]?.score ?? null,
      latestQuickDash: quickDash.at(-1)?.score ?? null,
      baselinePrwhe: prwhe[0]?.score ?? null,
      latestPrwhe: prwhe.at(-1)?.score ?? null,
      sessionsDue: due.length,
      sessionsCompleted: due.filter((s) => s.status === "COMPLETE" || s.status === "PARTIAL").length,
      urgentAlerts: patient.alerts.filter((a) => a.severity === "URGENT").length,
      reviewAlerts: patient.alerts.filter((a) => a.severity === "REVIEW").length,
      outreachAlerts: patient.alerts.filter((a) => a.severity === "OUTREACH").length,
    };
  });

  return renderAuditWorkbook(rows, {
    department: department.name,
    hospital: department.hospital,
    generatedBy,
    generatedAt: now,
  });
}
