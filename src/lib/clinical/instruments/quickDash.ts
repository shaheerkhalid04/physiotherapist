import { z } from "zod";
import type { Instrument, ScoreResult } from "../types";

/**
 * QuickDASH, the 11 item short form of the Disabilities of the Arm, Shoulder and Hand
 * questionnaire.
 *
 * Scoring, per the DASH outcome measure user manual:
 *
 *   score = ((sum of completed responses / number completed) - 1) * 25
 *
 * A score cannot be calculated if more than one of the eleven items is missing. That rule
 * is enforced here rather than quietly producing a number from partial data.
 *
 * Item responses are stored alongside the total in PromResponse. A total on its own cannot
 * be re-scored or audited later.
 */

export const QUICKDASH_ITEM_COUNT = 11;
export const QUICKDASH_MAX_MISSING = 1;

export const QUICKDASH_ITEMS = [
  "openTightJar",
  "heavyHouseholdChores",
  "carryShoppingBag",
  "washYourBack",
  "useKnife",
  "recreationalActivitiesForce",
  "socialActivitiesInterference",
  "workLimitation",
  "armShoulderHandPain",
  "tinglingPinsNeedles",
  "sleepingDifficulty",
] as const;

export type QuickDashItem = (typeof QUICKDASH_ITEMS)[number];

/** Each item is answered 1 (no difficulty) to 5 (unable). Null means not answered. */
const responseSchema = z.number().int().min(1).max(5).nullable();

export const quickDashInputSchema = z.object(
  Object.fromEntries(QUICKDASH_ITEMS.map((item) => [item, responseSchema])) as Record<
    QuickDashItem,
    typeof responseSchema
  >,
);

export type QuickDashInput = z.infer<typeof quickDashInputSchema>;

export interface QuickDashDerived {
  score: number | null;
  answered: number;
  missing: number;
  scorable: boolean;
}

export const quickDashInstrument: Instrument<QuickDashInput, QuickDashDerived> = {
  key: "quickdash",
  version: 1,
  label: "QuickDASH",
  clinicianOnly: false,
  requiresSignOff: false,
  schema: quickDashInputSchema,

  score(input): ScoreResult<QuickDashDerived> {
    const responses = QUICKDASH_ITEMS.map((item) => input[item]).filter(
      (value): value is number => value !== null && value !== undefined,
    );

    const answered = responses.length;
    const missing = QUICKDASH_ITEM_COUNT - answered;
    const scorable = missing <= QUICKDASH_MAX_MISSING;

    if (!scorable) {
      return {
        value: null,
        derived: { score: null, answered, missing, scorable: false },
        warnings: [
          {
            field: "items",
            message: `${missing} items are unanswered. QuickDASH cannot be scored with more than ${QUICKDASH_MAX_MISSING} missing.`,
          },
        ],
      };
    }

    const mean = responses.reduce((sum, value) => sum + value, 0) / answered;
    const score = Number((((mean - 1) * 25)).toFixed(2));

    return {
      value: score,
      derived: { score, answered, missing, scorable: true },
      warnings: [],
    };
  },
};
