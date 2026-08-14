import { z } from "zod";
import { rangeWarning, type Instrument, type PlausibilityWarning, type ScoreResult } from "../types";

/**
 * Wrist, elbow and shoulder range of motion.
 *
 * Each instrument reports a primary arc as its scalar value, because a single number is
 * what a trend chart and a plateau rule can work with, while the individual planes are
 * kept in the derived payload.
 */

const degrees = (min: number, max: number) => z.number().min(min).max(max);

// --- Wrist ------------------------------------------------------------------

export const wristRomInputSchema = z.object({
  flexion: degrees(-30, 110),
  extension: degrees(-30, 110),
  radialDeviation: degrees(-10, 45),
  ulnarDeviation: degrees(-10, 60),
  pronation: degrees(-20, 100),
  supination: degrees(-20, 100),
});

export type WristRomInput = z.infer<typeof wristRomInputSchema>;

export interface WristRomDerived {
  flexionExtensionArc: number;
  deviationArc: number;
  forearmRotationArc: number;
}

export const wristRomInstrument: Instrument<WristRomInput, WristRomDerived> = {
  key: "wrist-rom",
  version: 1,
  label: "Wrist range of motion",
  clinicianOnly: false,
  requiresSignOff: false,
  schema: wristRomInputSchema,
  score(input): ScoreResult<WristRomDerived> {
    const warnings: PlausibilityWarning[] = [
      ...rangeWarning("flexion", input.flexion, 0, 80),
      ...rangeWarning("extension", input.extension, 0, 70),
      ...rangeWarning("radialDeviation", input.radialDeviation, 0, 20),
      ...rangeWarning("ulnarDeviation", input.ulnarDeviation, 0, 30),
      ...rangeWarning("pronation", input.pronation, 0, 80),
      ...rangeWarning("supination", input.supination, 0, 80),
    ];

    const flexionExtensionArc = input.flexion + input.extension;

    return {
      value: flexionExtensionArc,
      derived: {
        flexionExtensionArc,
        deviationArc: input.radialDeviation + input.ulnarDeviation,
        forearmRotationArc: input.pronation + input.supination,
      },
      warnings,
    };
  },
};

// --- Elbow ------------------------------------------------------------------

export const elbowRomInputSchema = z.object({
  flexion: degrees(0, 165),
  /** Zero is full extension. A positive value is a fixed flexion deformity. */
  extensionDeficit: degrees(-15, 140),
});

export type ElbowRomInput = z.infer<typeof elbowRomInputSchema>;

export interface ElbowRomDerived {
  arc: number;
  functionalArcAchieved: boolean;
}

/** The commonly cited functional elbow arc is 30 to 130 degrees. */
export const FUNCTIONAL_ELBOW_ARC = { from: 30, to: 130 };

export const elbowRomInstrument: Instrument<ElbowRomInput, ElbowRomDerived> = {
  key: "elbow-rom",
  version: 1,
  label: "Elbow range of motion",
  clinicianOnly: false,
  requiresSignOff: false,
  schema: elbowRomInputSchema,
  score(input): ScoreResult<ElbowRomDerived> {
    const arc = input.flexion - Math.max(0, input.extensionDeficit);
    return {
      value: arc,
      derived: {
        arc,
        functionalArcAchieved:
          Math.max(0, input.extensionDeficit) <= FUNCTIONAL_ELBOW_ARC.from &&
          input.flexion >= FUNCTIONAL_ELBOW_ARC.to,
      },
      warnings: [
        ...rangeWarning("flexion", input.flexion, 0, 150),
        ...rangeWarning("extensionDeficit", input.extensionDeficit, 0, 90),
      ],
    };
  },
};

// --- Shoulder ---------------------------------------------------------------

export const shoulderRomInputSchema = z.object({
  forwardFlexion: degrees(0, 190),
  abduction: degrees(0, 190),
  externalRotation: degrees(-30, 110),
  internalRotation: degrees(-30, 110),
});

export type ShoulderRomInput = z.infer<typeof shoulderRomInputSchema>;

export interface ShoulderRomDerived {
  rotationArc: number;
  elevationMean: number;
}

export const shoulderRomInstrument: Instrument<ShoulderRomInput, ShoulderRomDerived> = {
  key: "shoulder-rom",
  version: 1,
  label: "Shoulder range of motion",
  clinicianOnly: false,
  requiresSignOff: false,
  schema: shoulderRomInputSchema,
  score(input): ScoreResult<ShoulderRomDerived> {
    return {
      value: input.forwardFlexion,
      derived: {
        rotationArc: input.externalRotation + input.internalRotation,
        elevationMean: Number(((input.forwardFlexion + input.abduction) / 2).toFixed(1)),
      },
      warnings: [
        ...rangeWarning("forwardFlexion", input.forwardFlexion, 0, 180),
        ...rangeWarning("abduction", input.abduction, 0, 180),
        ...rangeWarning("externalRotation", input.externalRotation, 0, 90),
        ...rangeWarning("internalRotation", input.internalRotation, 0, 90),
      ],
    };
  },
};

// --- Kapandji ---------------------------------------------------------------

/**
 * Kapandji thumb opposition score. An ordinal landmark scale from 0 to 10, not a
 * measurement, so there is nothing to compute and nothing to average.
 */
export const kapandjiInputSchema = z.object({
  score: z.number().int().min(0).max(10),
});

export type KapandjiInput = z.infer<typeof kapandjiInputSchema>;

export const kapandjiInstrument: Instrument<KapandjiInput, { score: number }> = {
  key: "kapandji",
  version: 1,
  label: "Kapandji thumb opposition",
  clinicianOnly: false,
  requiresSignOff: false,
  schema: kapandjiInputSchema,
  score(input): ScoreResult<{ score: number }> {
    return { value: input.score, derived: { score: input.score }, warnings: [] };
  },
};
