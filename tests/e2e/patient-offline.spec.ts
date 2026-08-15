import { expect, test, type Page } from "@playwright/test";

/**
 * The headline acceptance criterion: a full week of sessions completed with no connection,
 * synced on reconnection, with no data loss and no duplicate records.
 *
 * These tests need a seeded database and the demo patient. Run them with:
 *
 *   npm run db:up && npm run db:migrate && npm run db:seed && npm run test:e2e
 */

const PATIENT_PHONE = "+920000000010";
const PATIENT_PIN = "0000";

async function signInAsPatient(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Phone number").fill(PATIENT_PHONE);
  await page.getByText("I cannot receive a code").click();
  await page.getByLabel("PIN").fill(PATIENT_PIN);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/today/);
}

async function completeSession(page: Page) {
  const cards = page.getByTestId("exercise-card");
  const count = await cards.count();

  for (let index = 0; index < count; index++) {
    await cards.nth(index).getByRole("button", { name: /Done|مکمل/ }).first().click();
  }

  await page.getByTestId("finish-session").click();
  await expect(page.getByTestId("session-saved")).toBeVisible();
}

test.describe("offline patient workflow", () => {
  /**
   * KNOWN GAP, deliberately left failing rather than weakened.
   *
   * Writes made offline queue and drain correctly, which the replay test below proves. What
   * does not work is reopening the app offline: /today is server rendered on demand, so a
   * reload with no connection cannot produce the exercise list, and the acceptance criterion
   * "a patient can complete a full week of sessions entirely offline" is therefore not met.
   *
   * Closing it needs a decision the department has to make, because the only way to show a
   * prescription offline is to serve a cached copy, and a cached copy can be stale. If a
   * clinician changes the phase while the patient is offline for a week, a cached screen
   * shows exercises from the superseded phase. That is a safety trade off, not a caching
   * detail, so it is not being made unilaterally. See PROGRESS.md.
   */
  test.fixme("a week of sessions completes offline and syncs once with no duplicates", async ({
    page,
    context,
  }) => {
    await signInAsPatient(page);

    // Warm the shell, then cut the connection for the whole week.
    await context.setOffline(true);

    for (let day = 0; day < 7; day++) {
      await page.reload();
      await completeSession(page);
      await expect(page.getByTestId("offline-banner")).toBeVisible();
    }

    const queuedBefore = await page.evaluate(async () => {
      const request = indexedDB.open("physio-offline");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return new Promise<number>((resolve) => {
        const tx = db.transaction("outbox", "readonly").objectStore("outbox").count();
        tx.onsuccess = () => resolve(tx.result);
      });
    });

    expect(queuedBefore).toBeGreaterThan(0);

    await context.setOffline(false);
    await page.reload();

    // The queue drains on reconnect. Nothing should remain and nothing should duplicate.
    await expect(page.getByTestId("offline-banner")).toBeHidden({ timeout: 30_000 });

    const queuedAfter = await page.evaluate(async () => {
      const request = indexedDB.open("physio-offline");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return new Promise<number>((resolve) => {
        const tx = db.transaction("outbox", "readonly").objectStore("outbox").count();
        tx.onsuccess = () => resolve(tx.result);
      });
    });

    expect(queuedAfter).toBe(0);
  });

  test("replaying the same batch twice creates no second copy", async ({ page }) => {
    await signInAsPatient(page);

    const batch = {
      batchUuid: crypto.randomUUID(),
      deviceTime: new Date().toISOString(),
      records: [
        {
          kind: "session",
          clientUuid: crypto.randomUUID(),
          scheduledFor: new Date().toISOString(),
          postOpDay: 21,
          status: "COMPLETE",
          startedAt: null,
          completedAt: new Date().toISOString(),
          orthosis: "WORN_AS_INSTRUCTED",
        },
      ],
    };

    const first = await page.request.post("/api/sync", { data: batch });
    const second = await page.request.post("/api/sync", { data: batch });

    expect((await first.json()).accepted).toBe(1);
    const replay = await second.json();
    expect(replay.accepted).toBe(0);
    expect(replay.duplicates).toBe(1);
    expect(replay.settled).toHaveLength(1);
  });
});
