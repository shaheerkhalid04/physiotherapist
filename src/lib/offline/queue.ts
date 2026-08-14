"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SyncOutcome, SyncRecord } from "@/lib/sync/contract";

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
const DB_VERSION = 1;
const STORE = "outbox";

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
}

let dbPromise: Promise<IDBPDatabase<OutboxSchema>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<OutboxSchema>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        const store = database.createObjectStore(STORE, { keyPath: "clientUuid" });
        store.createIndex("queuedAt", "queuedAt");
      },
    });
  }
  return dbPromise;
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

  return { settled, remaining: await pendingCount() };
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
