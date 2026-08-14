import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { PROTOCOL_TEMPLATES } from "./seed-data/protocols";
import { DEFAULT_THRESHOLDS } from "../src/lib/clinical/rules";

/**
 * Seeds a development department, its staff, the draft protocol library and the unapproved
 * alert thresholds.
 *
 * Everything clinical is seeded in its unapproved state, because that is the state the
 * application is designed to start in. The one exception is documented below.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log("Seeding department and staff");

  const department = await prisma.department.create({
    data: {
      name: "Hand and Upper Limb Surgery",
      hospital: "Example Teaching Hospital",
      contactPhone: "+92-000-0000000",
      travelNote:
        "Come to the Hand Clinic on the first floor of the outpatient block. Outside clinic hours, report to the Accident and Emergency department and say you have had recent hand surgery.",
      timezone: "Asia/Karachi",
    },
  });

  const passwordHash = await bcrypt.hash("development-only", 10);

  const surgeon = await prisma.user.create({
    data: {
      departmentId: department.id,
      role: "SURGEON",
      name: "Demo Surgeon",
      phone: "+920000000001",
      email: "surgeon@example.test",
      passwordHash,
    },
  });

  const therapist = await prisma.user.create({
    data: {
      departmentId: department.id,
      role: "THERAPIST",
      name: "Demo Hand Therapist",
      phone: "+920000000002",
      email: "therapist@example.test",
      passwordHash,
    },
  });

  await prisma.user.create({
    data: {
      departmentId: department.id,
      role: "ADMIN",
      name: "Demo Administrator",
      phone: "+920000000003",
      email: "admin@example.test",
      passwordHash,
    },
  });

  console.log(`Seeding ${PROTOCOL_TEMPLATES.length} draft protocol templates`);

  const createdTemplates = [];
  for (const template of PROTOCOL_TEMPLATES) {
    const created = await prisma.protocolTemplate.create({
      data: {
        departmentId: department.id,
        key: template.key,
        name: template.name,
        indication: template.indication,
        source: template.source,
        version: 1,
        // Drafts. reviewedById stays null, which is what blocks assignment.
        status: "DRAFT",
        reviewedById: null,
        reviewedAt: null,
        phases: {
          create: template.phases.map((phase, index) => ({
            order: index,
            name: phase.name,
            weekStart: phase.weekStart,
            weekEnd: phase.weekEnd,
            goals: phase.goals,
            permittedMovements: phase.permittedMovements,
            forbiddenMovements: phase.forbiddenMovements,
            orthosis: phase.orthosis,
            orthosisSchedule: phase.orthosisSchedule,
            progressionCriteria: phase.progressionCriteria,
            redFlags: phase.redFlags,
            exercises: {
              create: phase.exercises.map((exercise, exerciseIndex) => ({
                order: exerciseIndex,
                name: exercise.name,
                instruction: exercise.instruction,
                sets: exercise.sets,
                reps: exercise.reps,
                holdSeconds: exercise.holdSeconds,
                frequencyPerDay: exercise.frequencyPerDay,
              })),
            },
          })),
        },
      },
    });
    createdTemplates.push(created);
  }

  console.log("Seeding alert thresholds, all unapproved");

  for (const threshold of DEFAULT_THRESHOLDS) {
    await prisma.alertThreshold.create({
      data: {
        departmentId: department.id,
        ruleKey: threshold.ruleKey,
        protocolKey: null,
        params: threshold.params,
        rationale: threshold.rationale,
        approvedById: null,
        approvedAt: null,
      },
    });
  }

  if (process.env.SEED_DEMO_PATIENT === "false") {
    console.log("Skipping demo patient");
    await summary();
    return;
  }

  /**
   * Demo patient.
   *
   * To assign a protocol the seed has to sign a template off first, because the database
   * will reject an assignment whose sourceTemplateReviewedById is null. The seed performs
   * that sign-off explicitly, as the demo surgeon, and writes the audit row the application
   * would write. It does not bypass the constraint, it satisfies it.
   *
   * Set SEED_DEMO_PATIENT=false to seed a department with no signed-off templates at all.
   */
  console.log("Signing off one template as the demo surgeon, and enrolling a demo patient");

  const target = createdTemplates.find((t) => t.key === "zone-ii-flexor-early-active");
  if (!target) throw new Error("Expected the Zone II early active template to exist");

  const signedOff = await prisma.protocolTemplate.update({
    where: { id: target.id },
    data: { status: "APPROVED", reviewedById: surgeon.id, reviewedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: surgeon.id,
      actorRole: "SURGEON",
      action: "TEMPLATE_SIGNED_OFF",
      entity: "ProtocolTemplate",
      entityId: signedOff.id,
      before: { reviewedById: null, status: "DRAFT" },
      after: { reviewedById: surgeon.id, status: "APPROVED" },
    },
  });

  const patientUser = await prisma.user.create({
    data: {
      departmentId: department.id,
      role: "PATIENT",
      name: "Demo Patient",
      phone: "+920000000010",
      language: "UR",
      pinHash: await bcrypt.hash("0000", 10),
    },
  });

  const dateOfSurgery = new Date();
  dateOfSurgery.setDate(dateOfSurgery.getDate() - 21);

  const patient = await prisma.patient.create({
    data: {
      departmentId: department.id,
      mrn: "MRN-000001",
      userId: patientUser.id,
      enrolledById: therapist.id,
      name: "Demo Patient",
      age: 34,
      sex: "MALE",
      phone: "+920000000010",
      operatedSide: "RIGHT",
      dominance: "RIGHT",
      language: "UR",
      operation: {
        create: {
          procedure: "Zone II flexor tendon repair, index finger",
          dateOfSurgery,
          structures: {
            tendons: ["FDP index", "FDS index"],
            zone: "II",
            nerve: null,
            bone: null,
            joint: null,
          },
          fixation: null,
          precautions: "No resisted gripping until reviewed by the operating surgeon.",
          operatingSurgeon: surgeon.name,
        },
      },
    },
  });

  const templateWithPhases = await prisma.protocolTemplate.findUniqueOrThrow({
    where: { id: signedOff.id },
    include: { phases: { include: { exercises: true }, orderBy: { order: "asc" } } },
  });

  // A deep copy, not a reference. Editing the template later must not change this patient.
  const assigned = await prisma.patientProtocol.create({
    data: {
      patientId: patient.id,
      sourceTemplateId: templateWithPhases.id,
      sourceTemplateVersion: templateWithPhases.version,
      sourceTemplateReviewedById: templateWithPhases.reviewedById!,
      assignedById: surgeon.id,
      phases: {
        create: templateWithPhases.phases.map((phase) => ({
          order: phase.order,
          name: phase.name,
          weekStart: phase.weekStart,
          weekEnd: phase.weekEnd,
          goals: phase.goals,
          permittedMovements: phase.permittedMovements,
          forbiddenMovements: phase.forbiddenMovements,
          orthosis: phase.orthosis,
          orthosisSchedule: phase.orthosisSchedule,
          progressionCriteria: phase.progressionCriteria,
          redFlags: phase.redFlags,
          exercises: {
            create: phase.exercises.map((exercise) => ({
              order: exercise.order,
              name: exercise.name,
              instruction: exercise.instruction,
              sets: exercise.sets,
              reps: exercise.reps,
              holdSeconds: exercise.holdSeconds,
              frequencyPerDay: exercise.frequencyPerDay,
            })),
          },
        })),
      },
    },
    include: { phases: { orderBy: { order: "asc" } } },
  });

  // Even the first phase is activated by an explicit, clinician-approved transition.
  const firstPhase = assigned.phases[0];
  await prisma.phaseTransition.create({
    data: {
      protocolId: assigned.id,
      fromPhaseId: null,
      toPhaseId: firstPhase.id,
      approvedById: surgeon.id,
      reason: "Initial phase activated at assignment",
    },
  });
  await prisma.patientPhase.update({
    where: { id: firstPhase.id },
    data: { activeFrom: new Date() },
  });

  // A fortnight of session history so the worklist and charts have something to show.
  for (let day = 14; day >= 1; day--) {
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() - day);
    const postOpDay = 21 - day;
    const missed = day % 5 === 0;

    await prisma.session.create({
      data: {
        clientUuid: randomUUID(),
        patientId: patient.id,
        scheduledFor,
        postOpDay,
        status: missed ? "MISSED" : "COMPLETE",
        completedAt: missed ? null : scheduledFor,
        orthosis: missed ? "NOT_WORN" : "WORN_AS_INSTRUCTED",
        syncedAt: scheduledFor,
      },
    });

    if (missed) continue;

    const tam = 150 + (14 - day) * 4;
    await prisma.measurement.create({
      data: {
        clientUuid: randomUUID(),
        patientId: patient.id,
        instrumentKey: "finger-rom",
        instrumentVersion: 1,
        payload: {
          digit: "INDEX",
          active: {
            mcp: { flexion: 80, extension: 0 },
            pip: { flexion: Math.round(tam / 3), extension: -10 },
            dip: { flexion: Math.round(tam / 4), extension: -5 },
          },
        },
        value: tam,
        derived: { tam, tpm: null },
        recordedAt: scheduledFor,
        postOpDay,
        enteredById: patientUser.id,
        enteredByRole: "PATIENT",
        method: "SELF",
        side: "RIGHT",
        warnings: [],
        syncedAt: scheduledFor,
      },
    });

    await prisma.symptomLog.create({
      data: {
        clientUuid: randomUUID(),
        patientId: patient.id,
        recordedAt: scheduledFor,
        postOpDay,
        painAtRest: Math.max(0, 4 - Math.floor((14 - day) / 4)),
        painOnMovement: Math.max(1, 6 - Math.floor((14 - day) / 3)),
        swelling: day > 7 ? 1 : 0,
        stiffness: 1,
        syncedAt: scheduledFor,
      },
    });
  }

  await summary();
}

async function summary() {
  const [templates, approved, thresholds, approvedThresholds, patients] = await Promise.all([
    prisma.protocolTemplate.count(),
    prisma.protocolTemplate.count({ where: { reviewedById: { not: null } } }),
    prisma.alertThreshold.count(),
    prisma.alertThreshold.count({ where: { approvedById: { not: null } } }),
    prisma.patient.count(),
  ]);

  console.log("");
  console.log("Seed complete");
  console.log(`  protocol templates       ${templates} (${approved} signed off)`);
  console.log(`  alert thresholds         ${thresholds} (${approvedThresholds} approved)`);
  console.log(`  patients                 ${patients}`);
  console.log("");
  console.log("Every template is a draft requiring departmental review before clinical use.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
