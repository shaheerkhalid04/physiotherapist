/**
 * The rule that decides what a patient is allowed to see.
 *
 * Kept as a pure function, separate from any query, so it can be tested exhaustively. The
 * data layer calls it and the server action calls it again before writing. Two enforcement
 * points for one rule is deliberate: a query change must not be able to quietly widen what
 * a patient is shown.
 */

export interface PhaseLike {
  id: string;
  order: number;
  name: string;
  weekStart: number;
  weekEnd: number;
  activeFrom: Date | null;
  activeTo: Date | null;
  permittedMovements: string[];
  forbiddenMovements: string[];
  orthosis: string | null;
  orthosisSchedule: string | null;
  progressionCriteria: string;
  redFlags: string[];
  exercises: ExerciseLike[];
}

export interface ExerciseLike {
  id: string;
  order: number;
  name: string;
  instruction: string;
  sets: number;
  reps: number;
  holdSeconds: number;
  frequencyPerDay: number;
  mediaKey: string | null;
}

export interface ProtocolLike {
  id: string;
  active: boolean;
  phases: PhaseLike[];
}

/**
 * The single active phase, or null.
 *
 * A phase is active when a clinician-approved transition has set activeFrom and nothing has
 * closed it. Week numbers are documentation, not a trigger: elapsed time never activates a
 * phase, only an approved PhaseTransition does.
 */
export function activePhase(protocol: ProtocolLike | null, now: Date): PhaseLike | null {
  if (!protocol?.active) return null;

  const open = protocol.phases.filter(
    (phase) =>
      phase.activeFrom !== null &&
      phase.activeFrom <= now &&
      (phase.activeTo === null || phase.activeTo > now),
  );

  if (open.length === 0) return null;

  // If more than one is somehow open, the most advanced wins and the caller should alert.
  return open.sort((a, b) => b.order - a.order)[0];
}

/** Exercises a patient may be shown right now. Empty when no phase is active. */
export function permittedExercises(protocol: ProtocolLike | null, now: Date): ExerciseLike[] {
  const phase = activePhase(protocol, now);
  if (!phase) return [];
  return [...phase.exercises].sort((a, b) => a.order - b.order);
}

/** Guard used by every write path that records work against an exercise. */
export function isExercisePermitted(
  protocol: ProtocolLike | null,
  exerciseId: string,
  now: Date,
): boolean {
  return permittedExercises(protocol, now).some((exercise) => exercise.id === exerciseId);
}

/**
 * Whether the current phase's progression criteria window has been reached.
 *
 * This reports eligibility only. Nothing in this file advances a phase, and nothing may:
 * a phase changes only through a PhaseTransition row carrying an approving clinician.
 */
export function progressionEligible(
  protocol: ProtocolLike | null,
  now: Date,
  dateOfSurgery: Date,
): { eligible: boolean; phase: PhaseLike | null; postOpWeek: number } {
  const phase = activePhase(protocol, now);
  const postOpWeek = Math.floor((now.getTime() - dateOfSurgery.getTime()) / (7 * 86_400_000));

  if (!phase) return { eligible: false, phase: null, postOpWeek };

  return { eligible: postOpWeek >= phase.weekEnd, phase, postOpWeek };
}

/** Post-operative day, counting the day of surgery as day 0. */
export function postOpDay(dateOfSurgery: Date, on: Date): number {
  const surgery = Date.UTC(
    dateOfSurgery.getUTCFullYear(),
    dateOfSurgery.getUTCMonth(),
    dateOfSurgery.getUTCDate(),
  );
  const target = Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate());
  return Math.round((target - surgery) / 86_400_000);
}
