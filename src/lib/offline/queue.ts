"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SyncOutcome, SyncRecord } from "@/lib/sync/contract";
import type { CachedPrescription } from "./prescription";

/**
 * The device queue.
 *
 * Everything the patient records is written here first and to the server second, always in
 * that order. A session logged in a village with no signal is indistinguishable, from the
 * patient's point of view, from one logged in the clinic car park.
 *
 * Records are removed from the queue only when the server has settled them, meaning it
 * either accepted them or recognised them as an already applied duplicate. Anything else
 * stays queued and is retried.
 */

const DB_NAME = "physio-offline";
const DB_VERSION = 2;
const STORE = "outbox";
const PRESCRIPTION_STORE = "prescription";

interface QueuedRecord {
  clientUuid: string;
  record: SyncRecord;
  queuedAt: number;
  attempts: number;
  lastError: string | null;
}

interface OutboxSchema extends DBSchema {
  outbox: {
    key: string;
    value: QueuedRecord;
    indexes: { queuedAt: number };
  };
  prescription: {
    key: string;
    value: CachedPrescription;
  };
}

let dbPromise: Promise<IDBPDatabase<OutboxSchema>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<OutboxSchema>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const store = database.createObjectStore(STORE, { keyPath: "clientUuid" });
          store.createIndex("queuedAt", "queuedAt");
        }
        if (oldVersion < 2) {
          database.createObjectStore(PRESCRIPTION_STORE, { keyPath: "patientId" });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * The prescription cache.
 *
 * Written on every successful fetch, read when the network is unavailable. Keyed by patient
 * so a shared handset cannot serve one patient's exercises to another.
 */
export async function savePrescription(prescription: CachedPrescription): Promise<void> {
  const database = await db();
  await database.put(PRESCRIPTION_STORE, prescription);
}

export async function loadPrescription(patientId: string): Promise<CachedPrescription | null> {
  const database = await db();
  return (await database.get(PRESCRIPTION_STORE, patientId)) ?? null;
}

export async function clearPrescriptions(): Promise<void> {
  const database = await db();
  await database.clear(PRESCRIPTION_STORE);
}

/**
 * Subscribers notified whenever the queue depth changes.
 *
 * Without this the offline indicator only refreshed on a timer, so a patient who saved a
 * session with no signal saw nothing acknowledge it for up to a minute. On a phone that has
 * just been asked to trust an app with a tendon repair, a minute of silence is the wrong
 * feedback.
 */
type QueueListener = (remaining: number) => void;
const listeners = new Set<QueueListener>();

export function onQueueChange(listener: QueueListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function notify(): Promise<void> {
  const remaining = await pendingCount();
  for (const listener of listeners) listener(remaining);
}

export async function enqueue(record: SyncRecord): Promise<void> {
  const database = await db();
  // put, not add: re-queuing the same clientUuid must overwrite rather than throw, so an
  // edit made while still offline replaces the pending write.
  await database.put(STORE, {
    clientUuid: record.clientUuid,
    record,
    queuedAt: Date.now(),
    attempts: 0,
    lastError: null,
  });
  await notify();
}

export async function pending(): Promise<QueuedRecord[]> {
  const database = await db();
  return database.getAllFromIndex(STORE, "queuedAt");
}

export async function pendingCount(): Promise<number> {
  const database = await db();
  return database.count(STORE);
}

/**
 * Drains the queue in batches. Returns the number of records still outstanding.
 *
 * Records the server explicitly rejected are dropped, because retrying a record the server
 * has already refused just burns battery on a phone that is short of both.
 */
export async function drain(batchSize = 100): Promise<{ settled: number; remaining: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { settled: 0, remaining: await pendingCount() };
  }

  const database = await db();
  const queued = await pending();
  if (queued.length === 0) return { settled: 0, remaining: 0 };

  let settled = 0;

  for (let index = 0; index < queued.length; index += batchSize) {
    const slice = queued.slice(index, index + batchSize);

    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        batchUuid: crypto.randomUUID(),
        deviceTime: new Date().toISOString(),
        records: slice.map((item) => item.record),
      }),
    });

    if (!response.ok) {
      // Leave everything queued. A 500 or a captive portal must not lose data.
      for (const item of slice) {
        await database.put(STORE, {
          ...item,
          attempts: item.attempts + 1,
          lastError: `HTTP ${response.status}`,
        });
      }
      break;
    }

    const outcome = (await response.json()) as SyncOutcome;

    for (const clientUuid of outcome.settled) {
      await database.delete(STORE, clientUuid);
      settled += 1;
    }

    for (const error of outcome.errors) {
      // Permanently refused. Keep a record of why, then stop retrying.
      console.warn(`[sync] server rejected ${error.clientUuid}: ${error.reason}`);
      await database.delete(STORE, error.clientUuid);
    }
  }

  const remaining = await pendingCount();
  await notify();
  return { settled, remaining };
}

/** Registers drain on reconnect and on tab focus. Returns a cleanup function. */
export function startAutoSync(onChange?: (remaining: number) => void): () => void {
  const run = async () => {
    try {
      const { remaining } = await drain();
      onChange?.(remaining);
    } catch (error) {
      console.warn("[sync] drain failed", error);
    }
  };

  window.addEventListener("online", run);
  window.addEventListener("focus", run);
  const timer = window.setInterval(run, 60_000);
  void run();

  return () => {
    window.removeEventListener("online", run);
    window.removeEventListener("focus", run);
    window.clearInterval(timer);
  };
}
