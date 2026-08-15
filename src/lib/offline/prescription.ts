/**
 * Offline prescription caching, and the rule that decides whether a cached copy may still
 * be shown.
 *
 * The problem this solves and the risk it carries are the same thing. A patient offline for
 * a week cannot fetch their exercises, so they must come from the device. But a clinician
 * may have changed the phase in the meantime, and showing exercises from a superseded phase
 * is precisely what hard safety constraint 1 exists to prevent.
 *
 * The compromise, which the department must sign off:
 *
 *   1. A cached prescription is usable for a bounded number of days, not indefinitely.
 *   2. Whenever it is served from cache, the patient is told the date it was last confirmed
 *      with the hospital.
 *   3. Past the bound, exercises are withheld entirely and the patient is told to contact
 *      the department. Withholding is the safe failure, showing stale exercises is not.
 *
 * The bound is deliberately conservative and lives here as a single constant so it is easy
 * to find and change once the department decides.
 */

export const DEFAULT_MAX_OFFLINE_AGE_DAYS = 7;

export interface CachedExercise {
  id: string;
  order: number;
  name: string;
  instruction: string;
  sets: number;
  reps: number;
  holdSeconds: number;
  frequencyPerDay: number;
}

export interface CachedPrescription {
  patientId: string;
  /** Epoch milliseconds at which the server last confirmed this prescription. */
  fetchedAt: number;
  postOpDay: number;
  operatedSide: "LEFT" | "RIGHT" | "BILATERAL";
  phase: {
    id: string;
    name: string;
    orthosisSchedule: string | null;
  } | null;
  exercises: CachedExercise[];
  urgentAlert: boolean;
}

export type OfflineVerdict =
  | { state: "FRESH"; ageDays: number }
  | { state: "STALE_USABLE"; ageDays: number }
  | { state: "TOO_OLD"; ageDays: number }
  | { state: "NONE"; ageDays: null };

/**
 * Whether a cached prescription may still be shown.
 *
 * FRESH is a copy confirmed today. STALE_USABLE is within the bound and must be rendered
 * with the confirmation date visible. TOO_OLD and NONE both mean no exercises are shown.
 */
export function offlineVerdict(
  cache: CachedPrescription | null,
  now: Date,
  maxAgeDays: number = DEFAULT_MAX_OFFLINE_AGE_DAYS,
): OfflineVerdict {
  if (!cache) return { state: "NONE", ageDays: null };

  const ageDays = (now.getTime() - cache.fetchedAt) / 86_400_000;

  // A cache stamped in the future means a device clock problem. Treat it as unusable rather
  // than trusting it, because the age bound cannot be evaluated against a clock that lies.
  if (ageDays < -1) return { state: "TOO_OLD", ageDays };

  if (ageDays < 1) return { state: "FRESH", ageDays: Math.max(0, ageDays) };
  if (ageDays <= maxAgeDays) return { state: "STALE_USABLE", ageDays };

  return { state: "TOO_OLD", ageDays };
}

/** Exercises a cached prescription is permitted to show, given the verdict. */
export function cachedExercisesToShow(
  cache: CachedPrescription | null,
  verdict: OfflineVerdict,
): CachedExercise[] {
  if (!cache) return [];
  if (verdict.state === "TOO_OLD" || verdict.state === "NONE") return [];
  return [...cache.exercises].sort((a, b) => a.order - b.order);
}

/**
 * Post-operative day advanced by however long the device has been offline.
 *
 * The cached day was correct when it was fetched. Logging four days later against the old
 * number would file the record under the wrong post-operative day, which matters because
 * every rule and every chart is indexed by it.
 */
export function projectedPostOpDay(cache: CachedPrescription, now: Date): number {
  const elapsedDays = Math.floor((now.getTime() - cache.fetchedAt) / 86_400_000);
  return cache.postOpDay + Math.max(0, elapsedDays);
}
