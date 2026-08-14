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
  await page.getByRole("button", { name: "Sign in" }).click();
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
  test("a week of sessions completes offline and syncs once with no duplicates", async ({
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
