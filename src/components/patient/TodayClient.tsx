"use client";

import { useEffect, useState } from "react";
import { loadPrescription, savePrescription } from "@/lib/offline/queue";
import {
  cachedExercisesToShow,
  offlineVerdict,
  projectedPostOpDay,
  type CachedPrescription,
  type OfflineVerdict,
} from "@/lib/offline/prescription";
import { translate, type Locale } from "@/i18n/messages";
import { SessionRunner } from "./SessionRunner";
import { ConcernButton } from "./ConcernButton";

/**
 * Today's session, driven by data rather than by server rendered markup.
 *
 * The prescription is fetched when there is a connection and cached on the device. With no
 * connection the cached copy is used, subject to the age bound in lib/offline/prescription.
 * Past that bound no exercises are shown at all, which is the safe failure: withholding
 * exercises delays a patient, showing exercises from a superseded phase can rupture a
 * repair.
 */
export function TodayClient({ locale, patientId }: { locale: Locale; patientId: string }) {
  const [cache, setCache] = useState<CachedPrescription | null>(null);
  const [verdict, setVerdict] = useState<OfflineVerdict | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let fresh: CachedPrescription | null = null;

      try {
        const response = await fetch("/api/prescription", { cache: "no-store" });
        if (response.ok) {
          fresh = (await response.json()) as CachedPrescription;
          await savePrescription(fresh);
        }
      } catch {
        // Offline, or the request failed. Fall through to the cached copy.
      }

      const resolved = fresh ?? (await loadPrescription(patientId));
      if (cancelled) return;

      setCache(resolved);
      setVerdict(offlineVerdict(resolved, new Date()));
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) {
    return (
      <p role="status" className="text-base text-ink-muted">
        {translate(locale, "offline.loading")}
      </p>
    );
  }

  const state = verdict?.state ?? "NONE";
  const exercises = cachedExercisesToShow(cache, verdict ?? { state: "NONE", ageDays: null });
  const day = cache ? projectedPostOpDay(cache, new Date()) : 0;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      {cache?.urgentAlert ? (
        <div
          role="alert"
          data-testid="urgent-patient-notice"
          className="flex gap-3 rounded-card border-2 border-urgent bg-urgent-quiet p-4"
        >
          <Warning />
          <p className="text-base font-medium">{translate(locale, "urgent.contactDepartment")}</p>
        </div>
      ) : null}

      <header>
        <h1 className="text-2xl font-semibold">{translate(locale, "today.title")}</h1>
        <p className="mt-1 text-ink-muted">{translate(locale, "today.postOpDay", { day })}</p>
      </header>

      {state === "TOO_OLD" ? (
        <div
          role="alert"
          data-testid="prescription-too-old"
          className="flex gap-3 rounded-card border-2 border-urgent bg-urgent-quiet p-4"
        >
          <Warning />
          <p className="text-base font-medium">
            {translate(locale, "offline.tooOld", {
              days: Math.floor(verdict?.ageDays ?? 0),
            })}
          </p>
        </div>
      ) : null}

      {state === "NONE" ? (
        <p
          data-testid="prescription-missing"
          className="rounded-card border border-border bg-surface p-4 text-base"
        >
          {translate(locale, "offline.noCache")}
        </p>
      ) : null}

      {state === "STALE_USABLE" ? (
        <p
          role="status"
          data-testid="prescription-stale"
          className="rounded-card border border-review bg-review-quiet p-3 text-base"
        >
          {translate(locale, "offline.lastConfirmed", {
            date: new Date(cache!.fetchedAt).toLocaleDateString(locale === "ur" ? "ur-PK" : "en-GB"),
          })}
        </p>
      ) : null}

      {cache?.phase && exercises.length > 0 ? (
        <section className="rounded-card border border-border bg-surface p-4">
          <h2 className="font-semibold">{cache.phase.name}</h2>
          {cache.phase.orthosisSchedule ? (
            <p className="mt-2 text-base text-ink-muted">{cache.phase.orthosisSchedule}</p>
          ) : null}
        </section>
      ) : null}

      {exercises.length === 0 && state !== "TOO_OLD" && state !== "NONE" ? (
        <p
          data-testid="no-prescription"
          className="rounded-card border border-border bg-surface p-4 text-base"
        >
          {translate(locale, "today.noPhase")}
        </p>
      ) : null}

      {exercises.length > 0 ? (
        <SessionRunner
          locale={locale}
          postOpDay={day}
          side={cache!.operatedSide}
          exercises={exercises}
        />
      ) : null}

      <ConcernButton locale={locale} postOpDay={day} />
    </div>
  );
}

function Warning() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-6 w-6 shrink-0 fill-urgent">
      <path d="M10 1.5l8.5 15h-17l8.5-15zm0 5a1 1 0 00-1 1v4a1 1 0 002 0v-4a1 1 0 00-1-1zm0 9.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
    </svg>
  );
}
