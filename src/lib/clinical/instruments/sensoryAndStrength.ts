import { z } from "zod";
import type { Instrument, PlausibilityWarning, ScoreResult } from "../types";

/**
 * Grip and pinch strength, Semmes-Weinstein monofilament level, and static two-point
 * discrimination.
 *
 * Strength is optional everywhere it appears. Most patients will not own a dynamometer,
 * and a required field that most people cannot fill in produces either blank records or
 * invented numbers.
 */

// --- Grip and pinch ---------------------------------------------------------

export const strengthInputSchema = z.object({
  gripKg: z.number().min(0).max(120).nullable(),
  tipPinchKg: z.number().min(0).max(40).nullable(),
  keyPinchKg: z.number().min(0).max(40).nullable(),
  tripodPinchKg: z.number().min(0).max(40).nullable(),
  /** Same measurements on the unaffected side, when available, for a percentage. */
  contralateralGripKg: z.number().min(0).max(120).nullable(),
});

export type StrengthInput = z.infer<typeof strengthInputSchema>;

export interface StrengthDerived {
  gripKg: number | null;
  percentOfContralateral: number | null;
}

export const strengthInstrument: Instrument<StrengthInput, StrengthDerived> = {
  key: "grip-pinch-strength",
  version: 1,
  label: "Grip and pinch strength",
  clinicianOnly: false,
  requiresSignOff: false,
  schema: strengthInputSchema,
  score(input): ScoreResult<StrengthDerived> {
    const percentOfContralateral =
      input.gripKg !== null && input.contralateralGripKg !== null && input.contralateralGripKg > 0
        ? Number(((input.gripKg / input.contralateralGripKg) * 100).toFixed(1))
        : null;

    return {
      value: input.gripKg,
      derived: { gripKg: input.gripKg, percentOfContralateral },
      warnings: [],
    };
  },
};

// --- Semmes-Weinstein monofilament -----------------------------------------

export const MONOFILAMENT_MARKINGS = [
  "1.65",
  "2.36",
  "2.44",
  "2.83",
  "3.22",
  "3.61",
  "3.84",
  "4.08",
  "4.17",
  "4.31",
  "4.56",
  "4.74",
  "4.93",
  "5.07",
  "5.18",
  "5.46",
  "5.88",
  "6.10",
  "6.45",
  "6.65",
  "UNTESTABLE",
] as const;

export type MonofilamentMarking = (typeof MONOFILAMENT_MARKINGS)[number];

export type SensoryCategory =
  | "NORMAL"
  | "DIMINISHED_LIGHT_TOUCH"
  | "DIMINISHED_PROTECTIVE_SENSATION"
  | "LOSS_OF_PROTECTIVE_SENSATION"
  | "DEEP_PRESSURE_ONLY"
  | "UNTESTABLE";

/**
 * Interpretation bands for the hand. These require departmental confirmation before the
 * category is shown to a clinician as anything other than the raw filament number.
 */
export function monofilamentCategory(marking: MonofilamentMarking): SensoryCategory {
  if (marking === "UNTESTABLE") return "UNTESTABLE";
  const value = Number(marking);
  if (value <= 2.83) return "NORMAL";
  if (value <= 3.61) return "DIMINISHED_LIGHT_TOUCH";
  if (value <= 4.31) return "DIMINISHED_PROTECTIVE_SENSATION";
  if (value <= 6.65) return "LOSS_OF_PROTECTIVE_SENSATION";
  return "DEEP_PRESSURE_ONLY";
}

export const monofilamentInputSchema = z.object({
  digit: z.string(),
  aspect: z.enum(["RADIAL", "ULNAR", "DORSAL", "VOLAR"]),
  marking: z.enum(MONOFILAMENT_MARKINGS),
});

export type MonofilamentInput = z.infer<typeof monofilamentInputSchema>;

export const monofilamentInstrument: Instrument<
  MonofilamentInput,
  { category: SensoryCategory; marking: string }
> = {
  key: "semmes-weinstein",
  version: 1,
  label: "Semmes-Weinstein monofilament",
  clinicianOnly: true,
  requiresSignOff: true,
  schema: monofilamentInputSchema,
  score(input) {
    const category = monofilamentCategory(input.marking);
    return {
      value: input.marking === "UNTESTABLE" ? null : Number(input.marking),
      derived: { category, marking: input.marking },
      warnings: [],
    };
  },
};

// --- Static two-point discrimination ---------------------------------------

export type TwoPointCategory = "NORMAL" | "FAIR" | "POOR" | "PROTECTIVE" | "ANAESTHETIC";

export const twoPointInputSchema = z.object({
  digit: z.string(),
  aspect: z.enum(["RADIAL", "ULNAR"]),
  /** Millimetres of separation reliably discriminated. Null means none at 15 mm. */
  millimetres: z.number().min(2).max(20).nullable(),
});

export type TwoPointInput = z.infer<typeof twoPointInputSchema>;

export function twoPointCategory(mm: number | null): TwoPointCategory {
  if (mm === null) return "ANAESTHETIC";
  if (mm < 6) return "NORMAL";
  if (mm <= 10) return "FAIR";
  if (mm <= 15) return "POOR";
  return "PROTECTIVE";
}

export const twoPointInstrument: Instrument<
  TwoPointInput,
  { category: TwoPointCategory; millimetres: number | null }
> = {
  key: "two-point-discrimination",
  version: 1,
  label: "Static two-point discrimination",
  clinicianOnly: true,
  requiresSignOff: true,
  schema: twoPointInputSchema,
  score(input) {
    const warnings: PlausibilityWarning[] = [];
    if (input.millimetres !== null && input.millimetres < 2) {
      warnings.push({
        field: "millimetres",
        message: "Values below 2 mm are below the resolution of the instrument.",
      });
    }
    return {
      value: input.millimetres,
      derived: { category: twoPointCategory(input.millimetres), millimetres: input.millimetres },
      warnings,
    };
  },
};
