import { z } from "zod";
import type { Instrument, ScoreResult } from "../types";

/**
 * Patient Rated Wrist and Hand Evaluation.
 *
 * Fifteen items, each 0 to 10, in two subscales:
 *
 *   Pain      5 items, summed directly                  0 to 50
 *   Function  10 items, summed then halved              0 to 50
 *               (6 specific activities + 4 usual activities)
 *
 *   Total = pain + (function sum / 2)                   0 to 100
 *
 * The halving of the function subscale is the step most often got wrong. A total of 100 is
 * the worst possible result, not the best.
 */

export const PRWHE_PAIN_ITEMS = [
  "painAtRest",
  "painRepeatedMovement",
  "painLiftingHeavyObject",
  "painAtWorst",
  "painFrequency",
] as const;

export const PRWHE_SPECIFIC_ACTIVITY_ITEMS = [
  "turnDoorKnob",
  "cutMeatWithKnife",
  "fastenButtons",
  "pushUpFromChair",
  "carryTenPounds",
  "useBathroomTissue",
] as const;

export const PRWHE_USUAL_ACTIVITY_ITEMS = [
  "personalCare",
  "householdWork",
  "work",
  "recreation",
] as const;

export const PRWHE_FUNCTION_ITEMS = [
  ...PRWHE_SPECIFIC_ACTIVITY_ITEMS,
  ...PRWHE_USUAL_ACTIVITY_ITEMS,
] as const;

export const PRWHE_ITEMS = [...PRWHE_PAIN_ITEMS, ...PRWHE_FUNCTION_ITEMS] as const;

export type PrwheItem = (typeof PRWHE_ITEMS)[number];

const responseSchema = z.number().int().min(0).max(10).nullable();

export const prwheInputSchema = z.object(
  Object.fromEntries(PRWHE_ITEMS.map((item) => [item, responseSchema])) as Record<
    PrwheItem,
    typeof responseSchema
  >,
);

export type PrwheInput = z.infer<typeof prwheInputSchema>;

export interface PrwheDerived {
  pain: number | null;
  function: number | null;
  total: number | null;
  scorable: boolean;
  missing: string[];
}

export const prwheInstrument: Instrument<PrwheInput, PrwheDerived> = {
  key: "prwhe",
  version: 1,
  label: "Patient Rated Wrist and Hand Evaluation",
  clinicianOnly: false,
  requiresSignOff: false,
  schema: prwheInputSchema,

  score(input): ScoreResult<PrwheDerived> {
    const missing = PRWHE_ITEMS.filter(
      (item) => input[item] === null || input[item] === undefined,
    );

    if (missing.length > 0) {
      return {
        value: null,
        derived: { pain: null, function: null, total: null, scorable: false, missing },
        warnings: [
          {
            field: "items",
            message: `${missing.length} of ${PRWHE_ITEMS.length} items are unanswered. PRWHE requires every item.`,
          },
        ],
      };
    }

    const pain = PRWHE_PAIN_ITEMS.reduce((sum, item) => sum + (input[item] as number), 0);
    const functionSum = PRWHE_FUNCTION_ITEMS.reduce(
      (sum, item) => sum + (input[item] as number),
      0,
    );
    const functionScore = functionSum / 2;
    const total = Number((pain + functionScore).toFixed(1));

    return {
      value: total,
      derived: {
        pain,
        function: Number(functionScore.toFixed(1)),
        total,
        scorable: true,
        missing: [],
      },
      warnings: [],
    };
  },
};
