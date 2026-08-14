import { describe, expect, it } from "vitest";
import {
  activePhase,
  isExercisePermitted,
  permittedExercises,
  postOpDay,
  progressionEligible,
  type ProtocolLike,
} from "@/lib/domain/prescription";

const NOW = new Date("2026-03-01T09:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const exercise = (id: string, order: number) => ({
  id,
  order,
  name: `Exercise ${id}`,
  instruction: "",
  sets: 1,
  reps: 10,
  holdSeconds: 3,
  frequencyPerDay: 4,
  mediaKey: null,
});

const phase = (
  id: string,
  order: number,
  activeFrom: Date | null,
  activeTo: Date | null,
  exerciseIds: string[],
) => ({
  id,
  order,
  name: `Phase ${order}`,
  weekStart: order * 4,
  weekEnd: order * 4 + 4,
  activeFrom,
  activeTo,
  permittedMovements: [],
  forbiddenMovements: [],
  orthosis: null,
  orthosisSchedule: null,
  progressionCriteria: "Clinician review",
  redFlags: [],
  exercises: exerciseIds.map((id, index) => exercise(id, index)),
});

const protocol = (phases: ReturnType<typeof phase>[], active = true): ProtocolLike => ({
  id: "protocol-1",
  active,
  phases,
});

describe("no exercise reaches a patient outside an approved active phase", () => {
  it("shows nothing when no phase has been activated by a clinician", () => {
    const p = protocol([phase("ph1", 0, null, null, ["e1", "e2"])]);
    expect(activePhase(p, NOW)).toBeNull();
    expect(permittedExercises(p, NOW)).toEqual([]);
  });

  it("shows nothing when the patient has no protocol at all", () => {
    expect(permittedExercises(null, NOW)).toEqual([]);
  });

  it("shows nothing when the protocol has been deactivated", () => {
    const p = protocol([phase("ph1", 0, daysAgo(10), null, ["e1"])], false);
    expect(permittedExercises(p, NOW)).toEqual([]);
  });

  it("shows only the exercises of the phase a clinician activated", () => {
    const p = protocol([
      phase("ph1", 0, daysAgo(30), daysAgo(10), ["old1", "old2"]),
      phase("ph2", 1, daysAgo(10), null, ["current1", "current2"]),
      phase("ph3", 2, null, null, ["future1"]),
    ]);

    expect(permittedExercises(p, NOW).map((e) => e.id)).toEqual(["current1", "current2"]);
  });

  it("does not activate a phase merely because its week range has arrived", () => {
    // The phase covers weeks 0 to 4 and the patient is five weeks post-operative, but no
    // clinician has approved a transition, so nothing is shown.
    const p = protocol([phase("ph1", 0, null, null, ["e1"])]);
    expect(permittedExercises(p, NOW)).toEqual([]);
  });

  it("stops showing a phase once it has been closed", () => {
    const p = protocol([phase("ph1", 0, daysAgo(30), daysAgo(1), ["e1"])]);
    expect(permittedExercises(p, NOW)).toEqual([]);
  });

  it("rejects a write against an exercise from a previous phase", () => {
    const p = protocol([
      phase("ph1", 0, daysAgo(30), daysAgo(10), ["old1"]),
      phase("ph2", 1, daysAgo(10), null, ["current1"]),
    ]);

    expect(isExercisePermitted(p, "current1", NOW)).toBe(true);
    expect(isExercisePermitted(p, "old1", NOW)).toBe(false);
    expect(isExercisePermitted(p, "does-not-exist", NOW)).toBe(false);
  });

  it("prefers the most advanced phase if two are somehow open at once", () => {
    const p = protocol([
      phase("ph1", 0, daysAgo(30), null, ["old1"]),
      phase("ph2", 1, daysAgo(10), null, ["current1"]),
    ]);
    expect(activePhase(p, NOW)?.id).toBe("ph2");
  });
});

describe("progression eligibility flags but never advances", () => {
  it("reports eligibility once the phase week range has elapsed", () => {
    const p = protocol([phase("ph1", 0, daysAgo(40), null, ["e1"])]);
    const result = progressionEligible(p, NOW, daysAgo(40));
    expect(result.postOpWeek).toBe(5);
    expect(result.eligible).toBe(true);
  });

  it("reports not eligible before the week range has elapsed", () => {
    const p = protocol([phase("ph1", 0, daysAgo(7), null, ["e1"])]);
    expect(progressionEligible(p, NOW, daysAgo(7)).eligible).toBe(false);
  });

  it("leaves the active phase unchanged when eligible, so nothing auto advances", () => {
    const p = protocol([
      phase("ph1", 0, daysAgo(40), null, ["e1"]),
      phase("ph2", 1, null, null, ["e2"]),
    ]);
    progressionEligible(p, NOW, daysAgo(40));
    expect(activePhase(p, NOW)?.id).toBe("ph1");
    expect(permittedExercises(p, NOW).map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("post-operative day counts the day of surgery as day zero", () => {
  it("returns 0 on the day of surgery", () => {
    expect(postOpDay(new Date("2026-03-01T23:00:00Z"), new Date("2026-03-01T01:00:00Z"))).toBe(0);
  });

  it("returns 21 three weeks later", () => {
    expect(postOpDay(new Date("2026-03-01T10:00:00Z"), new Date("2026-03-22T04:00:00Z"))).toBe(21);
  });
});
