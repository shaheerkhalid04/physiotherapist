import { describe, expect, it } from "vitest";
import {
  evaluateRules,
  type MeasurementSnapshot,
  type RuleContext,
  type SessionSnapshot,
  type SymptomSnapshot,
} from "@/lib/clinical/rules";

const NOW = new Date("2026-03-01T09:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const symptom = (over: Partial<SymptomSnapshot> = {}): SymptomSnapshot => ({
  recordedAt: NOW,
  postOpDay: 20,
  painAtRest: 1,
  painOnMovement: 2,
  swelling: 0,
  stiffness: 0,
  fever: false,
  spreadingRedness: false,
  discharge: false,
  numbness: false,
  colourChange: false,
  coldIntolerance: false,
  temperatureChange: false,
  patientConcern: false,
  ...over,
});

const rom = (over: Partial<MeasurementSnapshot> = {}): MeasurementSnapshot => ({
  instrumentKey: "finger-rom",
  recordedAt: NOW,
  postOpDay: 20,
  value: 200,
  method: "SELF",
  passiveValue: null,
  ...over,
});

const session = (over: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  scheduledFor: NOW,
  status: "COMPLETE",
  orthosis: "WORN_AS_INSTRUCTED",
  ...over,
});

const ctx = (over: Partial<RuleContext> = {}): RuleContext => ({
  patientId: "p1",
  now: NOW,
  postOpDay: 20,
  phase: { name: "Protective", order: 1, protective: true, activeFrom: daysAgo(20) },
  symptoms: [],
  measurements: [],
  sessions: [],
  thresholds: {},
  ...over,
});

const approved = (ruleKey: string, params: Record<string, number> = {}) => ({
  [ruleKey]: { params, approved: true },
});

describe("urgent rules are never silenced by an unapproved threshold", () => {
  it("raises suspected tendon rupture with no threshold configuration present at all", () => {
    const hits = evaluateRules(
      ctx({
        measurements: [
          rom({ recordedAt: daysAgo(7), value: 220 }),
          rom({ recordedAt: NOW, value: 140, passiveValue: 230, method: "CLINIC" }),
        ],
      }),
    );

    const hit = hits.find((h) => h.ruleKey === "suspected-tendon-rupture");
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("URGENT");
    expect(hit?.thresholdUnapproved).toBe(true);
    expect(hit?.context.lostDegrees).toBe(80);
  });

  it("does not raise rupture when passive motion fell with active motion", () => {
    const hits = evaluateRules(
      ctx({
        measurements: [
          rom({ recordedAt: daysAgo(7), value: 220 }),
          rom({ recordedAt: NOW, value: 140, passiveValue: 145 }),
        ],
      }),
    );
    expect(hits.find((h) => h.ruleKey === "suspected-tendon-rupture")).toBeUndefined();
  });

  it("raises infection on discharge regardless of post-operative day", () => {
    const hits = evaluateRules(ctx({ postOpDay: 2, symptoms: [symptom({ discharge: true })] }));
    expect(hits.find((h) => h.ruleKey === "infection")?.severity).toBe("URGENT");
  });

  it("raises infection on pain rising after day 5 but not before it", () => {
    const rising = [
      symptom({ recordedAt: NOW, painOnMovement: 7 }),
      symptom({ recordedAt: daysAgo(2), painOnMovement: 3 }),
    ];

    expect(
      evaluateRules(ctx({ postOpDay: 12, symptoms: rising })).find(
        (h) => h.ruleKey === "infection",
      ),
    ).toBeDefined();

    expect(
      evaluateRules(ctx({ postOpDay: 3, symptoms: rising })).find((h) => h.ruleKey === "infection"),
    ).toBeUndefined();
  });

  it("raises neurovascular compromise on new numbness", () => {
    const hits = evaluateRules(ctx({ symptoms: [symptom({ numbness: true })] }));
    expect(hits.find((h) => h.ruleKey === "neurovascular-compromise")?.severity).toBe("URGENT");
  });

  it("escalates a patient-raised concern without interpreting it", () => {
    const hits = evaluateRules(ctx({ symptoms: [symptom({ patientConcern: true })] }));
    const hit = hits.find((h) => h.ruleKey === "patient-raised-concern");
    expect(hit?.severity).toBe("URGENT");
    expect(hit?.patientMessageKey).toBe("urgent.weHaveYourMessage");
  });
});

describe("review and outreach rules stay inert until a clinician approves thresholds", () => {
  const plateauMeasurements = [
    rom({ recordedAt: daysAgo(14), value: 180 }),
    rom({ recordedAt: NOW, value: 184 }),
  ];

  it("does not raise a plateau while thresholds are unapproved", () => {
    const hits = evaluateRules(ctx({ measurements: plateauMeasurements }));
    expect(hits.find((h) => h.ruleKey === "rom-plateau")).toBeUndefined();
  });

  it("raises a plateau of 4 degrees across 14 days once thresholds are approved", () => {
    const hits = evaluateRules(
      ctx({
        measurements: plateauMeasurements,
        thresholds: approved("rom-plateau", { windowDays: 14, minimumGainDegrees: 10 }),
      }),
    );
    const hit = hits.find((h) => h.ruleKey === "rom-plateau");
    expect(hit?.severity).toBe("REVIEW");
    expect(hit?.context.gain).toBe(4);
  });

  it("does not raise a plateau when the gain clears the threshold", () => {
    const hits = evaluateRules(
      ctx({
        measurements: [
          rom({ recordedAt: daysAgo(14), value: 180 }),
          rom({ recordedAt: NOW, value: 205 }),
        ],
        thresholds: approved("rom-plateau"),
      }),
    );
    expect(hits.find((h) => h.ruleKey === "rom-plateau")).toBeUndefined();
  });

  it("raises non-adherence at two of six sessions completed in a week", () => {
    const sessions = [
      session({ scheduledFor: daysAgo(6), status: "COMPLETE" }),
      session({ scheduledFor: daysAgo(5), status: "MISSED" }),
      session({ scheduledFor: daysAgo(4), status: "MISSED" }),
      session({ scheduledFor: daysAgo(3), status: "MISSED" }),
      session({ scheduledFor: daysAgo(2), status: "PARTIAL" }),
      session({ scheduledFor: daysAgo(1), status: "MISSED" }),
    ];
    const hits = evaluateRules(ctx({ sessions, thresholds: approved("non-adherence") }));
    const hit = hits.find((h) => h.ruleKey === "non-adherence");
    expect(hit?.severity).toBe("OUTREACH");
    expect(hit?.context.completionRate).toBe(0.33);
  });

  it("raises splint non-compliance only during a protective phase", () => {
    const sessions = [
      session({ scheduledFor: daysAgo(2), orthosis: "NOT_WORN" }),
      session({ scheduledFor: daysAgo(1), orthosis: "NOT_WORN" }),
    ];

    expect(
      evaluateRules(ctx({ sessions, thresholds: approved("splint-non-compliance") })).find(
        (h) => h.ruleKey === "splint-non-compliance",
      ),
    ).toBeDefined();

    expect(
      evaluateRules(
        ctx({
          sessions,
          phase: { name: "Active", order: 3, protective: false, activeFrom: daysAgo(5) },
          thresholds: approved("splint-non-compliance"),
        }),
      ).find((h) => h.ruleKey === "splint-non-compliance"),
    ).toBeUndefined();
  });

  it("screens for CRPS across three consecutive logs and labels itself a screen, not a diagnosis", () => {
    const persistent = [0, 3, 6].map((d) =>
      symptom({
        recordedAt: daysAgo(d),
        painAtRest: 8,
        swelling: 2,
        stiffness: 2,
        colourChange: true,
      }),
    );
    const hits = evaluateRules(
      ctx({ symptoms: persistent, thresholds: approved("suspected-crps") }),
    );
    const hit = hits.find((h) => h.ruleKey === "suspected-crps");
    expect(hit?.severity).toBe("REVIEW");
    expect(hit?.patientMessageKey).toBeNull();
    expect(String(hit?.context.note)).toContain("clinician-observed signs");
  });
});

describe("ordering and deduplication", () => {
  it("sorts urgent hits ahead of review and outreach", () => {
    const hits = evaluateRules(
      ctx({
        symptoms: [symptom({ discharge: true })],
        sessions: [session({ scheduledFor: daysAgo(1), status: "MISSED" })],
        thresholds: approved("non-adherence"),
      }),
    );
    expect(hits[0].severity).toBe("URGENT");
    expect(hits.at(-1)?.severity).toBe("OUTREACH");
  });

  it("produces a stable dedupe key per rule per patient per day", () => {
    const build = () => evaluateRules(ctx({ symptoms: [symptom({ fever: true })] }))[0].dedupeKey;
    expect(build()).toBe(build());
    expect(build()).toContain("p1:infection:2026-03-01");
  });
});
