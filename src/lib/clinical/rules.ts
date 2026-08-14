/**
 * Escalation rules engine.
 *
 * Every rule is a pure predicate over a plain context object. No database, no clock, no
 * network. That is what makes the whole safety surface of this application testable.
 *
 * Two policies are worth stating before the rules themselves, because they are easy to get
 * backwards:
 *
 *   1. Thresholds are configuration, not constants, and they are inert until a named
 *      clinician approves them. This applies to the REVIEW and OUTREACH rules.
 *
 *   2. It does NOT apply to URGENT rules. A missing signature must never silence a
 *      suspected tendon rupture or a suspected infection. Urgent rules always evaluate,
 *      falling back to conservative defaults, and the resulting alert records that it fired
 *      on an unapproved threshold so the clinician can see it.
 */

export type AlertSeverity = "URGENT" | "REVIEW" | "OUTREACH";

export interface SymptomSnapshot {
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
}

export interface MeasurementSnapshot {
  instrumentKey: string;
  recordedAt: Date;
  postOpDay: number;
  value: number | null;
  method: "SELF" | "CLINIC";
  /** Present for finger ROM: total passive motion, when a clinician recorded it. */
  passiveValue?: number | null;
}

export interface SessionSnapshot {
  scheduledFor: Date;
  status: "PENDING" | "COMPLETE" | "PARTIAL" | "MISSED";
  orthosis: "WORN_AS_INSTRUCTED" | "WORN_PARTIALLY" | "NOT_WORN" | "NOT_APPLICABLE";
}

export interface PhaseSnapshot {
  name: string;
  order: number;
  /** True while the repair is protected and non-compliance carries rupture risk. */
  protective: boolean;
  activeFrom: Date | null;
}

export interface ThresholdConfig {
  params: Record<string, number>;
  approved: boolean;
}

export interface RuleContext {
  patientId: string;
  now: Date;
  postOpDay: number;
  phase: PhaseSnapshot | null;
  /** Newest first. */
  symptoms: SymptomSnapshot[];
  measurements: MeasurementSnapshot[];
  sessions: SessionSnapshot[];
  thresholds: Record<string, ThresholdConfig>;
}

export interface RuleHit {
  ruleKey: string;
  severity: AlertSeverity;
  /** One open alert per rule per patient per window. */
  dedupeKey: string;
  /** The evidence the rule fired on, stored so a clinician can see why. */
  context: Record<string, unknown>;
  /** Key into the patient-facing message catalogue. Never free text from a model. */
  patientMessageKey: string | null;
  thresholdUnapproved: boolean;
}

export interface Rule {
  key: string;
  severity: AlertSeverity;
  label: string;
  /**
   * Urgent rules ignore approval state, deliberately. See the header comment.
   */
  suppressedWhenUnapproved: boolean;
  defaults: Record<string, number>;
  rationale: string;
  evaluate(ctx: RuleContext, params: Record<string, number>): RuleHit | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

function within(ctx: RuleContext, date: Date, days: number): boolean {
  return daysBetween(ctx.now, date) <= days;
}

function dayBucket(ctx: RuleContext): string {
  return ctx.now.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const suspectedTendonRupture: Rule = {
  key: "suspected-tendon-rupture",
  severity: "URGENT",
  label: "Suspected tendon rupture",
  suppressedWhenUnapproved: false,
  defaults: { lossDegrees: 20, lookbackDays: 14 },
  rationale:
    "Sudden loss of active motion at a joint that previously had it, with passive motion preserved, is the classic presentation of a ruptured repair. Conservative default of 20 degrees pending departmental confirmation.",

  evaluate(ctx, params) {
    const rom = ctx.measurements
      .filter((m) => m.instrumentKey === "finger-rom")
      .filter((m) => within(ctx, m.recordedAt, params.lookbackDays))
      .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());

    if (rom.length < 2) return null;

    const [current, ...earlier] = rom;
    if (current.value === null) return null;

    const best = earlier.reduce<number | null>(
      (max, m) => (m.value !== null && (max === null || m.value > max) ? m.value : max),
      null,
    );
    if (best === null) return null;

    const lost = best - current.value;
    if (lost < params.lossDegrees) return null;

    // Passive motion preserved is what separates a rupture from stiffness or a bad day.
    const passivePreserved =
      current.passiveValue !== null &&
      current.passiveValue !== undefined &&
      current.passiveValue - current.value >= params.lossDegrees;

    if (!passivePreserved) return null;

    return {
      ruleKey: this.key,
      severity: this.severity,
      dedupeKey: `${ctx.patientId}:${this.key}:${dayBucket(ctx)}`,
      context: {
        previousBestTam: best,
        currentTam: current.value,
        currentTpm: current.passiveValue,
        lostDegrees: lost,
        method: current.method,
      },
      patientMessageKey: "urgent.contactDepartment",
      thresholdUnapproved: false,
    };
  },
};

const infection: Rule = {
  key: "infection",
  severity: "URGENT",
  label: "Suspected infection",
  suppressedWhenUnapproved: false,
  defaults: { painIncreaseFromDay: 5, painRiseThreshold: 2, lookbackDays: 3 },
  rationale:
    "Fever, spreading redness or discharge at any point, or pain that is increasing rather than settling after the early post-operative days.",

  evaluate(ctx, params) {
    const recent = ctx.symptoms.filter((s) => within(ctx, s.recordedAt, params.lookbackDays));
    if (recent.length === 0) return null;

    const latest = recent[0];
    const cardinal = latest.fever || latest.spreadingRedness || latest.discharge;

    // Rising pain only counts after the early phase, when pain should be settling.
    let risingPain = false;
    let painDelta = 0;
    if (ctx.postOpDay > params.painIncreaseFromDay && recent.length >= 2) {
      const older = recent[recent.length - 1];
      painDelta = latest.painOnMovement - older.painOnMovement;
      risingPain = painDelta >= params.painRiseThreshold;
    }

    if (!cardinal && !risingPain) return null;

    return {
      ruleKey: this.key,
      severity: this.severity,
      dedupeKey: `${ctx.patientId}:${this.key}:${dayBucket(ctx)}`,
      context: {
        fever: latest.fever,
        spreadingRedness: latest.spreadingRedness,
        discharge: latest.discharge,
        risingPain,
        painDelta,
        postOpDay: ctx.postOpDay,
      },
      patientMessageKey: "urgent.contactDepartment",
      thresholdUnapproved: false,
    };
  },
};

const neurovascularCompromise: Rule = {
  key: "neurovascular-compromise",
  severity: "URGENT",
  label: "Neurovascular compromise",
  suppressedWhenUnapproved: false,
  defaults: { lookbackDays: 2 },
  rationale:
    "New numbness, colour change or new cold intolerance can indicate vascular or nerve compromise and is time critical.",

  evaluate(ctx, params) {
    const recent = ctx.symptoms.filter((s) => within(ctx, s.recordedAt, params.lookbackDays));
    if (recent.length === 0) return null;

    const latest = recent[0];
    if (!latest.numbness && !latest.colourChange && !latest.coldIntolerance) return null;

    return {
      ruleKey: this.key,
      severity: this.severity,
      dedupeKey: `${ctx.patientId}:${this.key}:${dayBucket(ctx)}`,
      context: {
        numbness: latest.numbness,
        colourChange: latest.colourChange,
        coldIntolerance: latest.coldIntolerance,
      },
      patientMessageKey: "urgent.contactDepartment",
      thresholdUnapproved: false,
    };
  },
};

/**
 * Budapest criteria screen for complex regional pain syndrome.
 *
 * This is a screen, not a diagnosis. The Budapest criteria require clinical signs observed
 * by a clinician in at least two categories, which a remote application cannot establish.
 * What this rule does is notice a symptom pattern persisting across consecutive logs and
 * put the patient in front of a human.
 */
const suspectedCrps: Rule = {
  key: "suspected-crps",
  severity: "REVIEW",
  label: "Suspected CRPS, for clinical review",
  suppressedWhenUnapproved: true,
  defaults: { consecutiveLogs: 3, disproportionatePain: 7, lookbackDays: 14 },
  rationale:
    "Disproportionate pain with swelling, stiffness and colour or temperature change, persisting across consecutive logs, screened against the Budapest symptom categories.",

  evaluate(ctx, params) {
    const recent = ctx.symptoms
      .filter((s) => within(ctx, s.recordedAt, params.lookbackDays))
      .slice(0, params.consecutiveLogs);

    if (recent.length < params.consecutiveLogs) return null;

    const allMatch = recent.every(
      (s) =>
        s.painAtRest >= params.disproportionatePain &&
        s.swelling >= 1 &&
        s.stiffness >= 1 &&
        (s.colourChange || s.temperatureChange),
    );

    if (!allMatch) return null;

    return {
      ruleKey: this.key,
      severity: this.severity,
      dedupeKey: `${ctx.patientId}:${this.key}:${dayBucket(ctx)}`,
      context: {
        logsConsidered: recent.length,
        categories: {
          sensory: recent.every((s) => s.painAtRest >= params.disproportionatePain),
          vasomotor: recent.every((s) => s.colourChange || s.temperatureChange),
          oedema: recent.every((s) => s.swelling >= 1),
          motor: recent.every((s) => s.stiffness >= 1),
        },
        note: "Symptom screen only. Budapest criteria require clinician-observed signs.",
      },
      patientMessageKey: null,
      thresholdUnapproved: false,
    };
  },
};

const romPlateau: Rule = {
  key: "rom-plateau",
  severity: "REVIEW",
  label: "Range of motion plateau",
  suppressedWhenUnapproved: true,
  defaults: { windowDays: 14, minimumGainDegrees: 10 },
  rationale:
    "Proposed starting values only. No meaningful total active motion gain across the window suggests the current regime is not working.",

  evaluate(ctx, params) {
    const rom = ctx.measurements
      .filter((m) => m.instrumentKey === "finger-rom" && m.value !== null)
      .filter((m) => within(ctx, m.recordedAt, params.windowDays))
      .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

    if (rom.length < 2) return null;

    const first = rom[0].value as number;
    const last = rom[rom.length - 1].value as number;
    const spanDays = daysBetween(rom[0].recordedAt, rom[rom.length - 1].recordedAt);

    if (spanDays < params.windowDays - 1) return null;
    if (last - first >= params.minimumGainDegrees) return null;

    return {
      ruleKey: this.key,
      severity: this.severity,
      dedupeKey: `${ctx.patientId}:${this.key}:${dayBucket(ctx)}`,
      context: {
        startTam: first,
        endTam: last,
        gain: Number((last - first).toFixed(1)),
        spanDays: Number(spanDays.toFixed(1)),
      },
      patientMessageKey: null,
      thresholdUnapproved: false,
    };
  },
};

const nonAdherence: Rule = {
  key: "non-adherence",
  severity: "OUTREACH",
  label: "Non-adherence to prescribed sessions",
  suppressedWhenUnapproved: true,
  defaults: { windowDays: 7, minimumCompletionRate: 0.5 },
  rationale:
    "Proposed starting values only. Completion below the rate across a rolling window triggers outreach rather than an alert to the surgeon.",

  evaluate(ctx, params) {
    const due = ctx.sessions.filter(
      (s) => s.scheduledFor <= ctx.now && within(ctx, s.scheduledFor, params.windowDays),
    );
    if (due.length === 0) return null;

    const completed = due.filter((s) => s.status === "COMPLETE" || s.status === "PARTIAL").length;
    const rate = completed / due.length;

    if (rate >= params.minimumCompletionRate) return null;

    return {
      ruleKey: this.key,
      severity: this.severity,
      dedupeKey: `${ctx.patientId}:${this.key}:${dayBucket(ctx)}`,
      context: {
        sessionsDue: due.length,
        sessionsCompleted: completed,
        completionRate: Number(rate.toFixed(2)),
        windowDays: params.windowDays,
      },
      patientMessageKey: null,
      thresholdUnapproved: false,
    };
  },
};

const splintNonCompliance: Rule = {
  key: "splint-non-compliance",
  severity: "OUTREACH",
  label: "Orthosis non-compliance in a protective phase",
  suppressedWhenUnapproved: true,
  defaults: { windowDays: 3, notWornCount: 2 },
  rationale:
    "Proposed starting values only. Removing the orthosis during a protective phase risks rupture of the repair.",

  evaluate(ctx, params) {
    if (!ctx.phase?.protective) return null;

    const recent = ctx.sessions.filter((s) => within(ctx, s.scheduledFor, params.windowDays));
    const notWorn = recent.filter((s) => s.orthosis === "NOT_WORN").length;

    if (notWorn < params.notWornCount) return null;

    return {
      ruleKey: this.key,
      severity: this.severity,
      dedupeKey: `${ctx.patientId}:${this.key}:${dayBucket(ctx)}`,
      context: { notWorn, sessionsConsidered: recent.length, phase: ctx.phase.name },
      patientMessageKey: "outreach.splintReminder",
      thresholdUnapproved: false,
    };
  },
};

/**
 * The patient-facing "Something is wrong" control. Not a clinical inference: the patient
 * said something is wrong, so a human looks.
 */
const patientRaisedConcern: Rule = {
  key: "patient-raised-concern",
  severity: "URGENT",
  label: "Patient raised a concern",
  suppressedWhenUnapproved: false,
  defaults: { lookbackDays: 2 },
  rationale: "A patient asking for help is escalated without interpretation.",

  evaluate(ctx, params) {
    const recent = ctx.symptoms.filter((s) => within(ctx, s.recordedAt, params.lookbackDays));
    const flagged = recent.find((s) => s.patientConcern);
    if (!flagged) return null;

    return {
      ruleKey: this.key,
      severity: this.severity,
      dedupeKey: `${ctx.patientId}:${this.key}:${flagged.recordedAt.toISOString()}`,
      context: { recordedAt: flagged.recordedAt.toISOString() },
      patientMessageKey: "urgent.weHaveYourMessage",
      thresholdUnapproved: false,
    };
  },
};

export const RULES: Rule[] = [
  suspectedTendonRupture,
  infection,
  neurovascularCompromise,
  patientRaisedConcern,
  suspectedCrps,
  romPlateau,
  nonAdherence,
  splintNonCompliance,
];

/** Seed payload for AlertThreshold, written unapproved. */
export const DEFAULT_THRESHOLDS = RULES.map((rule) => ({
  ruleKey: rule.key,
  params: rule.defaults,
  rationale: rule.rationale,
}));

/**
 * Evaluates every rule against a patient context.
 *
 * A REVIEW or OUTREACH rule whose thresholds are unapproved is skipped. An URGENT rule is
 * never skipped; it runs on its defaults and the hit is marked so the clinician sees the
 * threshold was not signed off.
 */
export function evaluateRules(ctx: RuleContext): RuleHit[] {
  const hits: RuleHit[] = [];

  for (const rule of RULES) {
    const config = ctx.thresholds[rule.key];
    const approved = config?.approved ?? false;

    if (!approved && rule.suppressedWhenUnapproved) continue;

    const params = { ...rule.defaults, ...(config?.params ?? {}) };
    const hit = rule.evaluate(ctx, params);

    if (hit) {
      hits.push({ ...hit, thresholdUnapproved: !approved });
    }
  }

  return hits.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

export function severityRank(severity: AlertSeverity): number {
  return severity === "URGENT" ? 0 : severity === "REVIEW" ? 1 : 2;
}
