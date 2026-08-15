import { describe, expect, it } from "vitest";
import {
  cachedExercisesToShow,
  offlineVerdict,
  projectedPostOpDay,
  DEFAULT_MAX_OFFLINE_AGE_DAYS,
  type CachedPrescription,
} from "@/lib/offline/prescription";

const NOW = new Date("2026-03-15T09:00:00Z");
const daysAgo = (n: number) => NOW.getTime() - n * 86_400_000;

const cache = (fetchedAt: number, exerciseCount = 2): CachedPrescription => ({
  patientId: "p1",
  fetchedAt,
  postOpDay: 21,
  operatedSide: "RIGHT",
  phase: { id: "ph1", name: "Protected early active motion", orthosisSchedule: "Worn at all times" },
  exercises: Array.from({ length: exerciseCount }, (_, index) => ({
    id: `e${index}`,
    order: index,
    name: `Exercise ${index}`,
    instruction: "",
    sets: 1,
    reps: 10,
    holdSeconds: 3,
    frequencyPerDay: 4,
  })),
  urgentAlert: false,
});

describe("a cached prescription may be shown, but not forever", () => {
  it("treats a copy fetched today as fresh", () => {
    expect(offlineVerdict(cache(daysAgo(0)), NOW).state).toBe("FRESH");
  });

  it("treats a copy from three days ago as usable but stale", () => {
    const verdict = offlineVerdict(cache(daysAgo(3)), NOW);
    expect(verdict.state).toBe("STALE_USABLE");
    expect(verdict.ageDays).toBeCloseTo(3, 1);
  });

  it("still shows exercises at exactly the age bound", () => {
    const verdict = offlineVerdict(cache(daysAgo(DEFAULT_MAX_OFFLINE_AGE_DAYS)), NOW);
    expect(verdict.state).toBe("STALE_USABLE");
    expect(cachedExercisesToShow(cache(daysAgo(DEFAULT_MAX_OFFLINE_AGE_DAYS)), verdict)).toHaveLength(2);
  });

  it("withholds exercises one day past the bound", () => {
    const stale = cache(daysAgo(DEFAULT_MAX_OFFLINE_AGE_DAYS + 1));
    const verdict = offlineVerdict(stale, NOW);
    expect(verdict.state).toBe("TOO_OLD");
    expect(cachedExercisesToShow(stale, verdict)).toEqual([]);
  });

  it("withholds exercises when there is no cached copy at all", () => {
    const verdict = offlineVerdict(null, NOW);
    expect(verdict.state).toBe("NONE");
    expect(cachedExercisesToShow(null, verdict)).toEqual([]);
  });

  it("refuses a copy stamped in the future rather than trusting a broken device clock", () => {
    // A phone whose clock is wrong cannot be used to evaluate an age bound, so the safe
    // reading is that the copy is unusable, not that it is brand new.
    const verdict = offlineVerdict(cache(daysAgo(-5)), NOW);
    expect(verdict.state).toBe("TOO_OLD");
    expect(cachedExercisesToShow(cache(daysAgo(-5)), verdict)).toEqual([]);
  });

  it("honours a departmental bound tighter than the default", () => {
    expect(offlineVerdict(cache(daysAgo(3)), NOW, 2).state).toBe("TOO_OLD");
  });

  it("returns exercises in prescribed order", () => {
    const unordered = cache(daysAgo(1));
    unordered.exercises = [...unordered.exercises].reverse();
    const shown = cachedExercisesToShow(unordered, offlineVerdict(unordered, NOW));
    expect(shown.map((exercise) => exercise.order)).toEqual([0, 1]);
  });
});

describe("post-operative day advances while the device is offline", () => {
  it("keeps the fetched day when the copy is from today", () => {
    expect(projectedPostOpDay(cache(daysAgo(0)), NOW)).toBe(21);
  });

  it("adds the days elapsed since the copy was fetched", () => {
    // Filing day 21 four days later would index the record under the wrong day, and every
    // rule and chart is keyed by it.
    expect(projectedPostOpDay(cache(daysAgo(4)), NOW)).toBe(25);
  });

  it("never runs the day backwards on a device whose clock has slipped", () => {
    expect(projectedPostOpDay(cache(daysAgo(-3)), NOW)).toBe(21);
  });
});
