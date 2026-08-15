import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { activePhase, postOpDay } from "@/lib/domain/prescription";
import { writeAudit } from "@/lib/domain/audit";
import {
  ASSISTANT_MODEL,
  AssistantUnavailable,
  chatStream,
  sanitiseHistory,
  type PatientDigest,
} from "@/lib/ai/assistant";

/**
 * Clinician-only summarisation endpoint.
 *
 * Patients are rejected here before anything else happens. The digest is assembled from our
 * own tables, so the model never sees free text a patient typed and never sees the protocol,
 * which is what stops it from being able to suggest an exercise.
 *
 * Every call is audit logged. A machine-written summary shown to a clinician is not a
 * clinical record, but the fact that one was generated for a named patient is.
 */

const STAFF = new Set(["THERAPIST", "SURGEON", "ADMIN"]);

const bodySchema = z.object({
  patientId: z.string().uuid(),
  // Deliberately loose. sanitiseHistory is the gate, not this schema, because a transcript
  // arriving from a client is untrusted input regardless of whether it parses.
  messages: z.array(z.unknown()).max(60),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || !STAFF.has(session.user.role)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "patientId and messages are required" }, { status: 400 });
  }

  const history = sanitiseHistory(parsed.data.messages);
  if (history.length === 0) {
    return NextResponse.json({ error: "No usable message to answer" }, { status: 400 });
  }

  const patient = await prisma.patient.findFirst({
    where: { id: parsed.data.patientId, departmentId: session.user.departmentId },
    include: {
      operation: true,
      protocols: {
        where: { active: true },
        include: { phases: { include: { exercises: true }, orderBy: { order: "asc" } } },
      },
      measurements: {
        where: { instrumentKey: "finger-rom" },
        orderBy: { recordedAt: "desc" },
        take: 15,
      },
      symptomLogs: { orderBy: { recordedAt: "desc" }, take: 15 },
      sessions: true,
      alerts: { where: { status: "OPEN" }, orderBy: { raisedAt: "desc" } },
    },
  });

  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const now = new Date();
  const due = patient.sessions.filter((s) => s.scheduledFor <= now);
  const phase = activePhase(patient.protocols[0] ?? null, now);

  // Only these fields reach the model. No names, no phone numbers, no free text, and
  // crucially no exercises.
  const digest: PatientDigest = {
    mrn: patient.mrn,
    postOpDay: patient.operation ? postOpDay(patient.operation.dateOfSurgery, now) : 0,
    procedure: patient.operation?.procedure ?? "not recorded",
    phase: phase?.name ?? null,
    adherence: {
      due: due.length,
      completed: due.filter((s) => s.status === "COMPLETE" || s.status === "PARTIAL").length,
    },
    romTrend: patient.measurements
      .filter((m) => m.value !== null)
      .map((m) => ({ postOpDay: m.postOpDay, value: m.value as number, method: m.method }))
      .reverse(),
    painTrend: patient.symptomLogs
      .map((s) => ({ postOpDay: s.postOpDay, rest: s.painAtRest, movement: s.painOnMovement }))
      .reverse(),
    openAlerts: patient.alerts.map((a) => ({
      ruleKey: a.ruleKey,
      severity: a.severity,
      raisedAt: a.raisedAt.toISOString().slice(0, 10),
    })),
  };

  try {
    const stream = await chatStream(digest, history);

    // Logged before the stream is consumed, so a conversation that is abandoned halfway
    // still leaves a record that it happened.
    await writeAudit({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "ASSISTANT_CHAT",
      entity: "Patient",
      entityId: patient.id,
      after: { model: ASSISTANT_MODEL, turns: history.length },
      request,
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-assistant-model": ASSISTANT_MODEL,
      },
    });
  } catch (error) {
    if (error instanceof AssistantUnavailable) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
