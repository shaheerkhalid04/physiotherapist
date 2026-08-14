import type { Instrument } from "../types";
import { fingerRomInstrument } from "./fingerRom";
import { stricklandModifiedInstrument, stricklandOriginalInstrument } from "./strickland";
import { buckGramckoInstrument } from "./buckGramckoLister";
import {
  elbowRomInstrument,
  kapandjiInstrument,
  shoulderRomInstrument,
  wristRomInstrument,
} from "./jointArcs";
import {
  monofilamentInstrument,
  strengthInstrument,
  twoPointInstrument,
} from "./sensoryAndStrength";
import { vancouverExtendedInstrument, vancouverOriginalInstrument } from "./vancouverScar";
import { quickDashInstrument } from "./quickDash";
import { prwheInstrument } from "./prwhe";

export * from "./fingerRom";
export * from "./strickland";
export * from "./buckGramckoLister";
export * from "./jointArcs";
export * from "./sensoryAndStrength";
export * from "./vancouverScar";
export * from "./quickDash";
export * from "./prwhe";

/* eslint-disable @typescript-eslint/no-explicit-any */
const ALL: Instrument<any, any>[] = [
  fingerRomInstrument,
  stricklandOriginalInstrument,
  stricklandModifiedInstrument,
  buckGramckoInstrument,
  wristRomInstrument,
  elbowRomInstrument,
  shoulderRomInstrument,
  kapandjiInstrument,
  strengthInstrument,
  monofilamentInstrument,
  twoPointInstrument,
  vancouverOriginalInstrument,
  vancouverExtendedInstrument,
  quickDashInstrument,
  prwheInstrument,
];
/* eslint-enable @typescript-eslint/no-explicit-any */

export const INSTRUMENTS = Object.freeze(
  Object.fromEntries(ALL.map((instrument) => [instrument.key, instrument])),
);

export type InstrumentKey = keyof typeof INSTRUMENTS;

export function getInstrument(key: string) {
  const instrument = INSTRUMENTS[key];
  if (!instrument) {
    throw new Error(`Unknown instrument: ${key}`);
  }
  return instrument;
}

/** Instrument keys a patient is permitted to write. Passive motion is not among them. */
export const PATIENT_ENTERABLE = ALL.filter((i) => !i.clinicianOnly).map((i) => i.key);

/**
 * Validates and scores in one step, returning the row shape the Measurement table expects.
 * Throws on schema failure, which is a programming error by the time it reaches here,
 * because every caller validates at its own boundary first.
 */
export function scoreMeasurement(key: string, rawPayload: unknown) {
  const instrument = getInstrument(key);
  const payload = instrument.schema.parse(rawPayload);
  const result = instrument.score(payload);

  return {
    instrumentKey: instrument.key,
    instrumentVersion: instrument.version,
    payload,
    value: result.value,
    derived: result.derived,
    warnings: result.warnings.map((w) => `${w.field}: ${w.message}`),
  };
}
