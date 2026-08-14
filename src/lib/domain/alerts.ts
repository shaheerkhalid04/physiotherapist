import { prisma } from "@/lib/db";
import {
  evaluateRules,
  type MeasurementSnapshot,
  type RuleContext,
  type SessionSnapshot,
  type SymptomSnapshot,
} from "@/lib/clinical/rules";
import { activePhase, postOpDay } from "@/lib/domain/prescription";

/**
 * Loads a patient's recent history, runs the pure rules engine over it, and persists any
 * new alerts.
 *
 * All the judgement lives in rules.ts. This file only assembles the context and writes the
 * result, which keeps the safety logic testable without a database.
 */

const LOOKBACK_DAYS = 30;

export async function evaluatePatient(patientId: string): Promise<number> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      operation: true,
      protocols: {
        where: { active: true },
        include: { phases: { include: { exercises: true }, orderBy: { order: "asc" } } },
      },
      symptomLogs: { where: { recordedAt: { gte: since } }, orderBy: { recordedAt: "desc" } },
      measurements: { where: { recordedAt: { gte: since } }, orderBy: { recordedAt: "desc" } },
      sessions: { where: { scheduledFor: { gte: since } }, orderBy: { scheduledFor: "desc" } },
    },
  });

  if (!patient?.operation) return 0;

  const thresholdRows = await prisma.alertThreshold.findMany({
    where: { departmentId: patient.departmentId },
  });

  const thresholds = Object.fromEntries(
    thresholdRows.map((row) => [
      row.ruleKey,
      {
        params: (row.params ?? {}) as Record<string, number>,
        approved: row.approvedById !== null,
      },
    ]),
  );

  const now = new Date();
  const protocol = patient.protocols[0] ?? null;
  const phase = activePhase(protocol, now);

  // A phase is protective while the orthosis instruction says the repair is being protected.
  // Derived here rather than stored, so editing a phase cannot leave a stale flag behind.
  const protective = Boolean(
    phase?.orthosisSchedule &&
      /continuous|at all times|every night|worn continuously/i.test(phase.orthosisSchedule),
  );

  const ctx: RuleContext = {
    patientId,
    now,
    postOpDay: postOpDay(patient.operation.dateOfSurgery, now),
    phase: phase
      ? { name: phase.name, order: phase.order, protective, activeFrom: phase.activeFrom }
      : null,
    symptoms: patient.symptomLogs.map(toSymptom),
    measurements: patient.measurements.map(toMeasurement),
    sessions: patient.sessions.map(toSession),
    thresholds,
  };

  const hits = evaluateRules(ctx);
  let created = 0;

  for (const hit of hits) {
    const existing = await prisma.alert.findUnique({ where: { dedupeKey: hit.dedupeKey } });
    if (existing) continue;

    await prisma.alert.create({
      data: {
        patientId,
        ruleKey: hit.ruleKey,
        severity: hit.severity,
        dedupeKey: hit.dedupeKey,
        context: { ...hit.context, thresholdUnapproved: hit.thresholdUnapproved },
        patientNotified: hit.patientMessageKey !== null,
      },
    });
    created += 1;
  }

  return created;
}

function toSymptom(row: {
  recordedAt: Date;
  postOpDay: number;
  painAtRest: number;
  painOnMovement: number;
  swelling: number;
  stiffness: number;
  fever: boolean;
  spreadingRedness: boolean;
  discharge: boolean;
  numbness: boolean;
  colourChange: boolean;
  coldIntolerance: boolean;
  temperatureChange: boolean;
  patientConcern: boolean;
}): SymptomSnapshot {
  return { ...row };
}

function toMeasurement(row: {
  instrumentKey: string;
  recordedAt: Date;
  postOpDay: number;
  value: number | null;
  method: "SELF" | "CLINIC";
  derived: unknown;
}): MeasurementSnapshot {
  const derived = (row.derived ?? {}) as { tpm?: number | null };
  return {
    instrumentKey: row.instrumentKey,
    recordedAt: row.recordedAt,
    postOpDay: row.postOpDay,
    value: row.value,
    method: row.method,
    passiveValue: derived.tpm ?? null,
  };
}

function toSession(row: {
  scheduledFor: Date;
  status: "PENDING" | "COMPLETE" | "PARTIAL" | "MISSED";
  orthosis: "WORN_AS_INSTRUCTED" | "WORN_PARTIALLY" | "NOT_WORN" | "NOT_APPLICABLE";
}): SessionSnapshot {
  return { ...row };
}
