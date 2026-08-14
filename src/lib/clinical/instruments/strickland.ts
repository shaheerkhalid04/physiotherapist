import { z } from "zod";
import { extensionDeficit, type Instrument, type ScoreResult } from "../types";

/**
 * Strickland grading of flexor tendon repair outcome.
 *
 * The formula is not in dispute. It considers the two joints the flexor tendons act on
 * directly, ignoring the MCP:
 *
 *   percent = ((PIP flexion + DIP flexion) - (PIP deficit + DIP deficit)) / 175 * 100
 *
 * The grade boundaries are in dispute, because two classifications are both in circulation
 * under the name "Strickland". Rather than pick one and hide the choice, both ship as
 * separately versioned instruments and the department nominates its default.
 *
 * Open question 1 in PLAN.md.
 */

/** Normal combined PIP plus DIP active flexion, the denominator in both variants. */
export const STRICKLAND_DENOMINATOR = 175;

export const stricklandInputSchema = z.object({
  pip: z.object({
    flexion: z.number().min(-30).max(140),
    extension: z.number().min(-90).max(45),
  }),
  dip: z.object({
    flexion: z.number().min(-30).max(110),
    extension: z.number().min(-90).max(45),
  }),
});

export type StricklandInput = z.infer<typeof stricklandInputSchema>;

export type StricklandGrade = "EXCELLENT" | "GOOD" | "FAIR" | "POOR";

export interface StricklandDerived {
  percent: number;
  grade: StricklandGrade;
  variant: string;
  activeMotion: number;
}

export interface GradeBand {
  grade: StricklandGrade;
  min: number;
}

/**
 * Original Strickland and Glogovac classification, 1980.
 * Excellent 75 to 100, good 50 to 74, fair 25 to 49, poor below 25.
 */
export const STRICKLAND_ORIGINAL_BANDS: GradeBand[] = [
  { grade: "EXCELLENT", min: 75 },
  { grade: "GOOD", min: 50 },
  { grade: "FAIR", min: 25 },
  { grade: "POOR", min: Number.NEGATIVE_INFINITY },
];

/**
 * Modified Strickland classification, the stricter set in common current use.
 * Excellent 85 to 100, good 70 to 84, fair 50 to 69, poor below 50.
 */
export const STRICKLAND_MODIFIED_BANDS: GradeBand[] = [
  { grade: "EXCELLENT", min: 85 },
  { grade: "GOOD", min: 70 },
  { grade: "FAIR", min: 50 },
  { grade: "POOR", min: Number.NEGATIVE_INFINITY },
];

export function stricklandPercent(input: StricklandInput): number {
  const flexion = input.pip.flexion + input.dip.flexion;
  const deficit = extensionDeficit(input.pip.extension) + extensionDeficit(input.dip.extension);
  return ((flexion - deficit) / STRICKLAND_DENOMINATOR) * 100;
}

export function gradeFor(percent: number, bands: GradeBand[]): StricklandGrade {
  for (const band of bands) {
    if (percent >= band.min) return band.grade;
  }
  return "POOR";
}

function build(
  key: string,
  label: string,
  variant: string,
  bands: GradeBand[],
): Instrument<StricklandInput, StricklandDerived> {
  return {
    key,
    version: 1,
    label,
    clinicianOnly: false,
    requiresSignOff: true,
    schema: stricklandInputSchema,
    score(input): ScoreResult<StricklandDerived> {
      const raw = stricklandPercent(input);
      const percent = Number(raw.toFixed(1));
      const activeMotion =
        input.pip.flexion +
        input.dip.flexion -
        extensionDeficit(input.pip.extension) -
        extensionDeficit(input.dip.extension);

      return {
        value: percent,
        derived: { percent, grade: gradeFor(percent, bands), variant, activeMotion },
        warnings:
          percent > 100
            ? [
                {
                  field: "percent",
                  message:
                    "Result exceeds 100 percent of the reference arc. Check the flexion values.",
                },
              ]
            : [],
      };
    },
  };
}

export const stricklandOriginalInstrument = build(
  "strickland-original",
  "Strickland grade (original 1980 bands)",
  "ORIGINAL_1980",
  STRICKLAND_ORIGINAL_BANDS,
);

export const stricklandModifiedInstrument = build(
  "strickland-modified",
  "Strickland grade (modified bands)",
  "MODIFIED",
  STRICKLAND_MODIFIED_BANDS,
);
