import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { orderRecords, syncBatch, type SyncOutcome, type SyncRecord } from "@/lib/sync/contract";
import { scoreMeasurement } from "@/lib/clinical/instruments";
import { activePhase, isExercisePermitted } from "@/lib/domain/prescription";
import { evaluatePatient } from "@/lib/domain/alerts";
import { writeAudit } from "@/lib/domain/audit";

/**
 * Drain endpoint for the device queue.
 *
 * Every record is applied in its own try block. One bad record does not fail the batch,
 * because a patient who has been offline for a week must not lose six good days of data to
 * one malformed row. Rejected records are reported back with a reason so the device can
 * stop retrying them.
 *
 * A unique violation on clientUuid is a duplicate, not an error. It means the batch was
 * already applied and the acknowledgement never reached the device.
 */

const UNIQUE_VIOLATION = "P2002";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.patientId) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const patientId = session.user.patientId;
  const parsed = syncBatch.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Malformed batch", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const batch = parsed.data;

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      operation: true,
      protocols: {
        where: { active: true },
        include: { phases: { include: { exercises: true }, orderBy: { order: "asc" } } },
      },
    },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const protocol = patient.protocols[0] ?? null;
  const now = new Date();
  const phase = activePhase(protocol, now);

  const outcome: SyncOutcome = {
    batchUuid: batch.batchUuid,
    accepted: 0,
    duplicates: 0,
    rejected: 0,
    errors: [],
    settled: [],
  };

  // Client uuid of a session already seen in this batch or already stored.
  const sessionIdByClientUuid = new Map<string, string>();

  for (const record of orderRecords(batch.records)) {
    try {
      await applyRecord(record, {
        patientId,
        userId: session.user.id,
        phaseExerciseIds: new Set(phase?.exercises.map((e) => e.id) ?? []),
        protocol,
        now,
        sessionIdByClientUuid,
      });
      outcome.accepted += 1;
      outcome.settled.push(record.clientUuid);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
        outcome.duplicates += 1;
        outcome.settled.push(record.clientUuid);
        continue;
      }
      outcome.rejected += 1;
      outcome.errors.push({
        clientUuid: record.clientUuid,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  await prisma.syncReceipt.create({
    data: {
      batchUuid: batch.batchUuid,
      patientId,
      recordCount: batch.records.length,
      accepted: outcome.accepted,
      duplicates: outcome.duplicates,
      rejected: outcome.rejected,
      detail: outcome.errors.length > 0 ? { errors: outcome.errors } : undefined,
    },
  }).catch(() => {
    // A duplicate receipt means the whole batch was replayed. The per record handling above
    // has already classified everything correctly, so this is not an error.
  });

  await writeAudit({
    actorId: session.user.id,
    actorRole: "PATIENT",
    action: "SYNC_BATCH",
    entity: "SyncReceipt",
    entityId: batch.batchUuid,
    after: {
      accepted: outcome.accepted,
      duplicates: outcome.duplicates,
      rejected: outcome.rejected,
    },
    request,
  });

  // Alerts are recomputed after a drain, not during it, so a batch cannot raise the same
  // alert once per record.
  if (outcome.accepted > 0) {
    await evaluatePatient(patientId);
  }

  return NextResponse.json(outcome);
}

interface ApplyContext {
  patientId: string;
  userId: string;
  phaseExerciseIds: Set<string>;
  protocol: Parameters<typeof isExercisePermitted>[0];
  now: Date;
  sessionIdByClientUuid: Map<string, string>;
}

async function applyRecord(record: SyncRecord, ctx: ApplyContext): Promise<void> {
  switch (record.kind) {
    case "session": {
      const created = await prisma.session.create({
        data: {
          clientUuid: record.clientUuid,
          patientId: ctx.patientId,
          scheduledFor: new Date(record.scheduledFor),
          postOpDay: record.postOpDay,
          status: record.status,
          startedAt: record.startedAt ? new Date(record.startedAt) : null,
          completedAt: record.completedAt ? new Date(record.completedAt) : null,
          orthosis: record.orthosis,
          syncedAt: ctx.now,
        },
      });
      ctx.sessionIdByClientUuid.set(record.clientUuid, created.id);
      return;
    }

    case "exerciseLog": {
      // The safety rule is re-checked here, on the write path, not only in the query that
      // produced the screen.
      if (!ctx.phaseExerciseIds.has(record.exerciseId)) {
        throw new Error(
          "Exercise is not part of the currently active, clinician-approved phase and was not recorded.",
        );
      }

      const sessionId = await resolveSessionId(record.sessionClientUuid, ctx);

      await prisma.exerciseLog.create({
        data: {
          clientUuid: record.clientUuid,
          sessionId,
          exerciseId: record.exerciseId,
          status: record.status,
          reason: record.reason,
          reasonText: record.reasonText,
          setsDone: record.setsDone,
          repsDone: record.repsDone,
          recordedAt: new Date(record.recordedAt),
          syncedAt: ctx.now,
        },
      });
      return;
    }

    case "symptomLog": {
      const sessionId = record.sessionClientUuid
        ? await resolveSessionId(record.sessionClientUuid, ctx)
        : null;

      await prisma.symptomLog.create({
        data: {
          clientUuid: record.clientUuid,
          patientId: ctx.patientId,
          sessionId,
          recordedAt: new Date(record.recordedAt),
          postOpDay: record.postOpDay,
          painAtRest: record.painAtRest,
          painOnMovement: record.painOnMovement,
          swelling: record.swelling,
          stiffness: record.stiffness,
          fever: record.fever,
          spreadingRedness: record.spreadingRedness,
          discharge: record.discharge,
          numbness: record.numbness,
          colourChange: record.colourChange,
          coldIntolerance: record.coldIntolerance,
          temperatureChange: record.temperatureChange,
          patientConcern: record.patientConcern,
          concernText: record.concernText,
          syncedAt: ctx.now,
        },
      });
      return;
    }

    case "measurement": {
      const scored = scoreMeasurement(record.instrumentKey, record.payload);
      const instrument = scored.instrumentKey;

      const sessionId = record.sessionClientUuid
        ? await resolveSessionId(record.sessionClientUuid, ctx)
        : null;

      await prisma.measurement.create({
        data: {
          clientUuid: record.clientUuid,
          patientId: ctx.patientId,
          sessionId,
          instrumentKey: instrument,
          instrumentVersion: scored.instrumentVersion,
          payload: scored.payload as object,
          value: scored.value,
          derived: scored.derived as object,
          recordedAt: new Date(record.recordedAt),
          postOpDay: record.postOpDay,
          enteredById: ctx.userId,
          enteredByRole: "PATIENT",
          // A patient measuring at home is self-measured by definition. The device cannot
          // claim otherwise.
          method: "SELF",
          side: record.side,
          warnings: scored.warnings,
          syncedAt: ctx.now,
        },
      });
      return;
    }

    case "promResponse": {
      const scored = scoreMeasurement(
        record.instrument === "QUICKDASH" ? "quickdash" : "prwhe",
        record.itemResponses,
      );

      await prisma.promResponse.create({
        data: {
          clientUuid: record.clientUuid,
          patientId: ctx.patientId,
          instrument: record.instrument,
          itemResponses: record.itemResponses,
          score: scored.value,
          subscores: scored.derived as object,
          scheduledFor: new Date(record.scheduledFor),
          completedAt: new Date(record.completedAt),
          postOpDay: record.postOpDay,
          syncedAt: ctx.now,
        },
      });
      return;
    }
  }
}

async function resolveSessionId(clientUuid: string, ctx: ApplyContext): Promise<string> {
  const cached = ctx.sessionIdByClientUuid.get(clientUuid);
  if (cached) return cached;

  const found = await prisma.session.findUnique({
    where: { clientUuid },
    select: { id: true, patientId: true },
  });

  if (!found) {
    throw new Error("Parent session has not been synced yet.");
  }
  if (found.patientId !== ctx.patientId) {
    throw new Error("Session belongs to a different patient.");
  }

  ctx.sessionIdByClientUuid.set(clientUuid, found.id);
  return found.id;
}
