import type { ZodType } from "zod";

/**
 * Shared contract for every measurement instrument.
 *
 * Instruments are pure: no database, no React, no clock. That is what makes them testable
 * against published worked examples, which is the only way to have any confidence that a
 * score shown to a surgeon is the score the literature defines.
 *
 * Every instrument is versioned. A scoring correction ships as a new version rather than an
 * edit, so historical rows keep the meaning they had when they were recorded.
 */

export interface PlausibilityWarning {
  field: string;
  message: string;
}

export interface ScoreResult<TDerived = Record<string, unknown>> {
  /** Primary scalar used for charting and rule evaluation. Null when not computable. */
  value: number | null;
  derived: TDerived;
  /**
   * Warnings never block a save. A patient measuring their own hand with a paper
   * goniometer will produce odd numbers, and refusing the entry loses the data point
   * along with the signal that something is wrong.
   */
  warnings: PlausibilityWarning[];
}

export interface Instrument<TInput, TDerived = Record<string, unknown>> {
  key: string;
  version: number;
  label: string;
  /** Instruments a patient may never enter themselves. */
  clinicianOnly: boolean;
  /** True when the department must sign off configuration before results are trusted. */
  requiresSignOff: boolean;
  schema: ZodType<TInput>;
  score(input: TInput): ScoreResult<TDerived>;
}

/** Records a warning when a value falls outside anatomically plausible bounds. */
export function rangeWarning(
  field: string,
  value: number | null | undefined,
  min: number,
  max: number,
): PlausibilityWarning[] {
  if (value === null || value === undefined) return [];
  if (value < min || value > max) {
    return [
      {
        field,
        message: `${value} degrees is outside the plausible range ${min} to ${max}. Recorded as entered, please confirm.`,
      },
    ];
  }
  return [];
}

/**
 * Extension deficit convention.
 *
 * A joint short of neutral has a positive deficit. A joint that hyperextends is recorded as
 * zero deficit rather than a negative number, because crediting hyperextension would
 * inflate total active motion and make a stiff hand look better than it is.
 *
 * Open question 3 in PLAN.md asks the department to confirm this convention.
 */
export function extensionDeficit(extension: number): number {
  return extension > 0 ? 0 : Math.abs(extension);
}
