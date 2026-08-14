import { z } from "zod";
import {
  extensionDeficit,
  rangeWarning,
  type Instrument,
  type PlausibilityWarning,
  type ScoreResult,
} from "../types";

/**
 * Finger range of motion, per digit, with Total Active Motion and Total Passive Motion.
 *
 * TAM as defined by the American Society for Surgery of the Hand:
 *
 *   TAM = (MCP flexion + PIP flexion + DIP flexion)
 *         - (MCP extension deficit + PIP extension deficit + DIP extension deficit)
 *
 * TPM is the same arithmetic over passive values. Passive motion is clinician-entered
 * only: a patient with one operated limb cannot passively move that limb and read a
 * goniometer at the same time.
 */

export const DIGITS = ["THUMB", "INDEX", "MIDDLE", "RING", "LITTLE"] as const;
export type Digit = (typeof DIGITS)[number];

const jointSchema = z.object({
  /** Degrees of active flexion reached. */
  flexion: z.number().min(-30).max(160),
  /**
   * Degrees at maximum extension. Zero is neutral, a negative value is a lag, a positive
   * value is hyperextension.
   */
  extension: z.number().min(-90).max(45),
});

export const fingerRomInputSchema = z.object({
  digit: z.enum(DIGITS),
  active: z.object({
    mcp: jointSchema,
    pip: jointSchema,
    dip: jointSchema,
  }),
  passive: z
    .object({
      mcp: jointSchema,
      pip: jointSchema,
      dip: jointSchema,
    })
    .optional(),
});

export type FingerRomInput = z.infer<typeof fingerRomInputSchema>;

export interface FingerRomDerived {
  tam: number;
  tpm: number | null;
  extensionLag: { mcp: number; pip: number; dip: number; total: number };
  flexionTotal: number;
  /** TAM as a percentage of the 260 degree normal reference for a finger. */
  percentOfNormal: number;
}

/** Normal composite TAM for a finger, used only as a reference denominator. */
export const NORMAL_FINGER_TAM = 260;

const PLAUSIBLE: Record<"mcp" | "pip" | "dip", { flexion: [number, number] }> = {
  mcp: { flexion: [0, 100] },
  pip: { flexion: [0, 120] },
  dip: { flexion: [0, 90] },
};

function totalActiveMotion(joints: {
  mcp: { flexion: number; extension: number };
  pip: { flexion: number; extension: number };
  dip: { flexion: number; extension: number };
}) {
  const flexionTotal = joints.mcp.flexion + joints.pip.flexion + joints.dip.flexion;
  const lag = {
    mcp: extensionDeficit(joints.mcp.extension),
    pip: extensionDeficit(joints.pip.extension),
    dip: extensionDeficit(joints.dip.extension),
  };
  const total = lag.mcp + lag.pip + lag.dip;
  return { motion: flexionTotal - total, flexionTotal, lag: { ...lag, total } };
}

export const fingerRomInstrument: Instrument<FingerRomInput, FingerRomDerived> = {
  key: "finger-rom",
  version: 1,
  label: "Finger range of motion",
  clinicianOnly: false,
  requiresSignOff: false,
  schema: fingerRomInputSchema,

  score(input): ScoreResult<FingerRomDerived> {
    const warnings: PlausibilityWarning[] = [];

    for (const joint of ["mcp", "pip", "dip"] as const) {
      const [min, max] = PLAUSIBLE[joint].flexion;
      warnings.push(
        ...rangeWarning(`active.${joint}.flexion`, input.active[joint].flexion, min, max),
      );
    }

    const active = totalActiveMotion(input.active);
    const passive = input.passive ? totalActiveMotion(input.passive) : null;

    if (passive && passive.motion < active.motion) {
      warnings.push({
        field: "passive",
        message:
          "Passive motion is less than active motion, which is not anatomically possible. Please re-measure.",
      });
    }

    return {
      value: active.motion,
      derived: {
        tam: active.motion,
        tpm: passive ? passive.motion : null,
        extensionLag: active.lag,
        flexionTotal: active.flexionTotal,
        percentOfNormal: Number(((active.motion / NORMAL_FINGER_TAM) * 100).toFixed(1)),
      },
      warnings,
    };
  },
};

/**
 * Active flexion lost at a joint that previously had it, with passive motion preserved.
 * This is the arithmetic behind the suspected tendon rupture rule; it lives here rather
 * than in the rules file so it is covered by the instrument tests.
 */
export function activeLossWithPreservedPassive(
  previous: FingerRomInput,
  current: FingerRomInput,
  thresholdDegrees: number,
): boolean {
  const prev = totalActiveMotion(previous.active).motion;
  const now = totalActiveMotion(current.active).motion;
  const lostActive = prev - now >= thresholdDegrees;

  if (!lostActive) return false;
  if (!current.passive) return false;

  const passiveNow = totalActiveMotion(current.passive).motion;
  return passiveNow - now >= thresholdDegrees;
}
