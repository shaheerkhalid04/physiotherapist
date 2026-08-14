import { z } from "zod";
import type { Instrument, ScoreResult } from "../types";

/**
 * Vancouver Scar Scale, therapist entry only.
 *
 * Two versions are in circulation and they do not produce the same maximum. The
 * pigmentation subscale is scored 0 to 2 in the original description and 0 to 3 in the
 * widely reproduced variant, giving a total of 0 to 13 or 0 to 14 respectively.
 *
 * Both ship as separate versioned instruments. Open question 2 in PLAN.md asks which the
 * department uses. Until that is answered neither is nominated as the default.
 */

export interface VancouverBounds {
  pigmentationMax: 2 | 3;
  total: 13 | 14;
}

export const VANCOUVER_ORIGINAL: VancouverBounds = { pigmentationMax: 2, total: 13 };
export const VANCOUVER_EXTENDED: VancouverBounds = { pigmentationMax: 3, total: 14 };

function inputSchemaFor(bounds: VancouverBounds) {
  return z.object({
    /** 0 normal, 1 pink, 2 red, 3 purple. */
    vascularity: z.number().int().min(0).max(3),
    /** 0 normal, 1 hypopigmentation, 2 hyperpigmentation, and mixed in the extended form. */
    pigmentation: z.number().int().min(0).max(bounds.pigmentationMax),
    /** 0 normal through 5 contracture. */
    pliability: z.number().int().min(0).max(5),
    /** 0 flat, 1 under 2 mm, 2 two to 5 mm, 3 over 5 mm. */
    height: z.number().int().min(0).max(3),
  });
}

export type VancouverInput = z.infer<ReturnType<typeof inputSchemaFor>>;

export interface VancouverDerived {
  total: number;
  maximum: number;
  variant: string;
}

function build(key: string, label: string, variant: string, bounds: VancouverBounds) {
  const instrument: Instrument<VancouverInput, VancouverDerived> = {
    key,
    version: 1,
    label,
    clinicianOnly: true,
    requiresSignOff: true,
    schema: inputSchemaFor(bounds),
    score(input): ScoreResult<VancouverDerived> {
      const total = input.vascularity + input.pigmentation + input.pliability + input.height;
      return {
        value: total,
        derived: { total, maximum: bounds.total, variant },
        warnings: [],
      };
    },
  };
  return instrument;
}

export const vancouverOriginalInstrument = build(
  "vancouver-scar-original",
  "Vancouver Scar Scale (0 to 13)",
  "ORIGINAL_13",
  VANCOUVER_ORIGINAL,
);

export const vancouverExtendedInstrument = build(
  "vancouver-scar-extended",
  "Vancouver Scar Scale (0 to 14)",
  "EXTENDED_14",
  VANCOUVER_EXTENDED,
);
