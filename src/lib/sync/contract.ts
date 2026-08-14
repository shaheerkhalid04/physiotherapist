import { z } from "zod";

/**
 * The offline drain contract, shared by the device queue and the server route.
 *
 * Idempotency is structural. Every record carries a clientUuid generated on the device, and
 * every table has a unique constraint on it. A replayed batch collides and is counted as a
 * duplicate rather than inserted twice, so a patient who spends a week offline on a bad
 * connection cannot end up with two of anything.
 */

export const syncRecordKinds = [
  "session",
  "exerciseLog",
  "symptomLog",
  "measurement",
  "promResponse",
] as const;

export type SyncRecordKind = (typeof syncRecordKinds)[number];

const isoDate = z.string().datetime({ offset: true });

export const sessionRecord = z.object({
  kind: z.literal("session"),
  clientUuid: z.string().uuid(),
  scheduledFor: isoDate,
  postOpDay: z.number().int().min(0).max(2000),
  status: z.enum(["PENDING", "COMPLETE", "PARTIAL", "MISSED"]),
  startedAt: isoDate.nullable(),
  completedAt: isoDate.nullable(),
  orthosis: z.enum(["WORN_AS_INSTRUCTED", "WORN_PARTIALLY", "NOT_WORN", "NOT_APPLICABLE"]),
});

export const exerciseLogRecord = z.object({
  kind: z.literal("exerciseLog"),
  clientUuid: z.string().uuid(),
  sessionClientUuid: z.string().uuid(),
  exerciseId: z.string().uuid(),
  status: z.enum(["DONE", "PARTIAL", "NOT_DONE"]),
  reason: z
    .enum([
      "PAIN",
      "SWELLING",
      "TOO_DIFFICULT",
      "FORGOT",
      "NO_TIME",
      "SPLINT_PROBLEM",
      "UNWELL",
      "OTHER",
    ])
    .nullable(),
  reasonText: z.string().max(500).nullable(),
  setsDone: z.number().int().min(0).max(50).nullable(),
  repsDone: z.number().int().min(0).max(500).nullable(),
  recordedAt: isoDate,
});

export const symptomLogRecord = z.object({
  kind: z.literal("symptomLog"),
  clientUuid: z.string().uuid(),
  sessionClientUuid: z.string().uuid().nullable(),
  recordedAt: isoDate,
  postOpDay: z.number().int().min(0).max(2000),
  painAtRest: z.number().int().min(0).max(10),
  painOnMovement: z.number().int().min(0).max(10),
  swelling: z.number().int().min(0).max(2),
  stiffness: z.number().int().min(0).max(2),
  fever: z.boolean(),
  spreadingRedness: z.boolean(),
  discharge: z.boolean(),
  numbness: z.boolean(),
  colourChange: z.boolean(),
  coldIntolerance: z.boolean(),
  temperatureChange: z.boolean(),
  patientConcern: z.boolean(),
  concernText: z.string().max(2000).nullable(),
});

export const measurementRecord = z.object({
  kind: z.literal("measurement"),
  clientUuid: z.string().uuid(),
  sessionClientUuid: z.string().uuid().nullable(),
  instrumentKey: z.string().min(1).max(64),
  payload: z.unknown(),
  recordedAt: isoDate,
  postOpDay: z.number().int().min(0).max(2000),
  side: z.enum(["LEFT", "RIGHT", "BILATERAL"]),
});

export const promResponseRecord = z.object({
  kind: z.literal("promResponse"),
  clientUuid: z.string().uuid(),
  instrument: z.enum(["QUICKDASH", "PRWHE"]),
  itemResponses: z.record(z.string(), z.number().nullable()),
  scheduledFor: isoDate,
  completedAt: isoDate,
  postOpDay: z.number().int().min(0).max(2000),
});

export const syncRecord = z.discriminatedUnion("kind", [
  sessionRecord,
  exerciseLogRecord,
  symptomLogRecord,
  measurementRecord,
  promResponseRecord,
]);

export type SyncRecord = z.infer<typeof syncRecord>;

export const syncBatch = z.object({
  batchUuid: z.string().uuid(),
  /** Device clock, retained so a clinician can see when the patient actually recorded. */
  deviceTime: isoDate,
  records: z.array(syncRecord).min(1).max(500),
});

export type SyncBatch = z.infer<typeof syncBatch>;

export interface SyncOutcome {
  batchUuid: string;
  accepted: number;
  duplicates: number;
  rejected: number;
  /** clientUuids the server refused, with the reason, so the device can stop retrying. */
  errors: { clientUuid: string; reason: string }[];
  /** clientUuids the device may delete from its queue: accepted plus duplicates. */
  settled: string[];
}

/**
 * Records must be applied in dependency order within a batch, because an exercise log
 * references the session it belongs to by client uuid.
 */
export function orderRecords(records: SyncRecord[]): SyncRecord[] {
  const rank: Record<SyncRecordKind, number> = {
    session: 0,
    exerciseLog: 1,
    symptomLog: 1,
    measurement: 1,
    promResponse: 2,
  };
  return [...records].sort((a, b) => rank[a.kind] - rank[b.kind]);
}
