import { z } from "zod";
import { extensionDeficit, type Instrument, type ScoreResult } from "../types";

/**
 * Buck-Gramcko-Lister grading for flexor tendon repair.
 *
 * The arithmetic below (summed active flexion less summed extension deficit) is not in
 * doubt. The point bands that convert that number into a grade are, and this file
 * deliberately does not ship invented ones.
 *
 * The bands are configuration, loaded from AlertThreshold-style departmental settings and
 * inert until a named clinician signs them off. Until then the instrument returns the raw
 * measurement with a null grade, which is honest, rather than a grade derived from numbers
 * nobody approved.
 *
 * Open question 13 in PLAN.md asks the department to supply its bands.
 */

export const buckGramckoInputSchema = z.object({
  mcp: z.object({
    flexion: z.number().min(-30).max(120),
    extension: z.number().min(-90).max(45),
  }),
  pip: z.object({
    flexion: z.number().min(-30).max(140),
    extension: z.number().min(-90).max(45),
  }),
  dip: z.object({
    flexion: z.number().min(-30).max(110),
    extension: z.number().min(-90).max(45),
  }),
  /** Centimetres from fingertip to distal palmar crease on maximum active flexion. */
  fingertipToPalmCm: z.number().min(0).max(12).nullable(),
});

export type BuckGramckoInput = z.infer<typeof buckGramckoInputSchema>;

export type BuckGramckoGrade = "EXCELLENT" | "GOOD" | "FAIR" | "POOR";

export interface BuckGramckoBand {
  grade: BuckGramckoGrade;
  /** Minimum summed active motion in degrees for this grade. */
  minMotion: number;
}

export interface BuckGramckoConfig {
  bands: BuckGramckoBand[];
  approved: boolean;
}

/**
 * No default bands. An empty, unapproved configuration is the shipped state, so the
 * instrument cannot silently grade anybody until the department fills this in.
 */
export const UNCONFIGURED: BuckGramckoConfig = { bands: [], approved: false };

export interface BuckGramckoDerived {
  activeMotion: number;
  flexionTotal: number;
  extensionDeficitTotal: number;
  fingertipToPalmCm: number | null;
  grade: BuckGramckoGrade | null;
  gradingConfigured: boolean;
}

export function buildBuckGramckoInstrument(
  config: BuckGramckoConfig = UNCONFIGURED,
): Instrument<BuckGramckoInput, BuckGramckoDerived> {
  return {
    key: "buck-gramcko-lister",
    version: 1,
    label: "Buck-Gramcko-Lister grade",
    clinicianOnly: true,
    requiresSignOff: true,
    schema: buckGramckoInputSchema,

    score(input): ScoreResult<BuckGramckoDerived> {
      const flexionTotal = input.mcp.flexion + input.pip.flexion + input.dip.flexion;
      const extensionDeficitTotal =
        extensionDeficit(input.mcp.extension) +
        extensionDeficit(input.pip.extension) +
        extensionDeficit(input.dip.extension);
      const activeMotion = flexionTotal - extensionDeficitTotal;

      const usable = config.approved && config.bands.length > 0;
      let grade: BuckGramckoGrade | null = null;

      if (usable) {
        const sorted = [...config.bands].sort((a, b) => b.minMotion - a.minMotion);
        grade = sorted.find((band) => activeMotion >= band.minMotion)?.grade ?? "POOR";
      }

      return {
        value: activeMotion,
        derived: {
          activeMotion,
          flexionTotal,
          extensionDeficitTotal,
          fingertipToPalmCm: input.fingertipToPalmCm,
          grade,
          gradingConfigured: usable,
        },
        warnings: usable
          ? []
          : [
              {
                field: "grade",
                message:
                  "Buck-Gramcko-Lister grade bands have not been configured and approved for this department. The measurement is recorded, the grade is not calculated.",
              },
            ],
      };
    },
  };
}

export const buckGramckoInstrument = buildBuckGramckoInstrument();
