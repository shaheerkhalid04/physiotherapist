import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { activePhase, permittedExercises, postOpDay } from "@/lib/domain/prescription";
import type { CachedPrescription } from "@/lib/offline/prescription";

/**
 * The patient's current prescription, as data rather than rendered HTML.
 *
 * This exists so the device can hold a copy for use with no connection. It returns only
 * what permittedExercises returns, so the same rule that governs the screen governs the
 * cache: nothing outside the currently active, clinician-approved phase is ever sent, and
 * therefore nothing outside it can ever be cached.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.patientId) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const patientId = session.user.patientId;

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

  const now = new Date();
  const protocol = patient.protocols[0] ?? null;
  const phase = activePhase(protocol, now);
  const exercises = permittedExercises(protocol, now);

  const urgentAlert = await prisma.alert.findFirst({
    where: { patientId, status: "OPEN", severity: "URGENT", patientNotified: true },
    select: { id: true },
  });

  const payload: CachedPrescription = {
    patientId,
    fetchedAt: now.getTime(),
    postOpDay: patient.operation ? postOpDay(patient.operation.dateOfSurgery, now) : 0,
    operatedSide: patient.operatedSide,
    phase: phase
      ? { id: phase.id, name: phase.name, orthosisSchedule: phase.orthosisSchedule }
      : null,
    exercises: exercises.map((exercise) => ({
      id: exercise.id,
      order: exercise.order,
      name: exercise.name,
      instruction: exercise.instruction,
      sets: exercise.sets,
      reps: exercise.reps,
      holdSeconds: exercise.holdSeconds,
      frequencyPerDay: exercise.frequencyPerDay,
    })),
    urgentAlert: urgentAlert !== null,
  };

  return NextResponse.json(payload, {
    // Never cached by the browser or the service worker. The device copy is the IndexedDB
    // one, which carries a fetch timestamp and an age bound; an HTTP cache would carry
    // neither and would age invisibly.
    headers: { "cache-control": "no-store" },
  });
}
