"use client";

import { useCallback, useMemo, useState } from "react";
import { enqueue, drain } from "@/lib/offline/queue";
import { translate, type Locale } from "@/i18n/messages";
import { HoldTimer } from "./HoldTimer";
import { RomInput, type RomValue } from "./RomInput";
import { SymptomForm, type SymptomValue } from "./SymptomForm";

export interface RunnerExercise {
  id: string;
  name: string;
  instruction: string;
  sets: number;
  reps: number;
  holdSeconds: number;
  frequencyPerDay: number;
}

type Status = "DONE" | "PARTIAL" | "NOT_DONE";

const REASONS = [
  "PAIN",
  "SWELLING",
  "TOO_DIFFICULT",
  "FORGOT",
  "NO_TIME",
  "SPLINT_PROBLEM",
  "UNWELL",
  "OTHER",
] as const;

/**
 * Runs a single session.
 *
 * Everything is written to the device queue first. The session is usable with the radio
 * off from start to finish, which is the normal case rather than the exception.
 */
export function SessionRunner({
  locale,
  postOpDay,
  side,
  exercises,
}: {
  locale: Locale;
  postOpDay: number;
  side: "LEFT" | "RIGHT" | "BILATERAL";
  exercises: RunnerExercise[];
}) {
  const sessionUuid = useMemo(() => crypto.randomUUID(), []);
  const [logs, setLogs] = useState<Record<string, { status: Status; reason?: string }>>({});
  const [rom, setRom] = useState<RomValue | null>(null);
  const [symptoms, setSymptoms] = useState<SymptomValue | null>(null);
  const [saved, setSaved] = useState(false);

  const setStatus = useCallback((exerciseId: string, status: Status) => {
    setLogs((current) => ({ ...current, [exerciseId]: { status } }));
  }, []);

  const setReason = useCallback((exerciseId: string, reason: string) => {
    setLogs((current) => ({
      ...current,
      [exerciseId]: { status: current[exerciseId]?.status ?? "NOT_DONE", reason },
    }));
  }, []);

  const allAnswered = exercises.every((exercise) => logs[exercise.id]);

  async function finish() {
    const now = new Date().toISOString();
    const completed = exercises.filter((e) => logs[e.id]?.status === "DONE").length;

    await enqueue({
      kind: "session",
      clientUuid: sessionUuid,
      scheduledFor: now,
      postOpDay,
      status: completed === exercises.length ? "COMPLETE" : completed === 0 ? "MISSED" : "PARTIAL",
      startedAt: now,
      completedAt: now,
      orthosis: symptoms?.orthosis ?? "NOT_APPLICABLE",
    });

    for (const exercise of exercises) {
      const log = logs[exercise.id];
      if (!log) continue;

      await enqueue({
        kind: "exerciseLog",
        clientUuid: crypto.randomUUID(),
        sessionClientUuid: sessionUuid,
        exerciseId: exercise.id,
        status: log.status,
        reason: (log.reason as never) ?? null,
        reasonText: null,
        setsDone: log.status === "DONE" ? exercise.sets : null,
        repsDone: log.status === "DONE" ? exercise.reps : null,
        recordedAt: now,
      });
    }

    if (rom) {
      await enqueue({
        kind: "measurement",
        clientUuid: crypto.randomUUID(),
        sessionClientUuid: sessionUuid,
        instrumentKey: "finger-rom",
        payload: {
          digit: rom.digit,
          active: {
            mcp: { flexion: rom.mcpFlexion, extension: rom.mcpExtension },
            pip: { flexion: rom.pipFlexion, extension: rom.pipExtension },
            dip: { flexion: rom.dipFlexion, extension: rom.dipExtension },
          },
        },
        recordedAt: now,
        postOpDay,
        side,
      });
    }

    if (symptoms) {
      await enqueue({
        kind: "symptomLog",
        clientUuid: crypto.randomUUID(),
        sessionClientUuid: sessionUuid,
        recordedAt: now,
        postOpDay,
        painAtRest: symptoms.painAtRest,
        painOnMovement: symptoms.painOnMovement,
        swelling: symptoms.swelling,
        stiffness: symptoms.stiffness,
        fever: symptoms.fever,
        spreadingRedness: symptoms.spreadingRedness,
        discharge: symptoms.discharge,
        numbness: symptoms.numbness,
        colourChange: symptoms.colourChange,
        coldIntolerance: symptoms.coldIntolerance,
        temperatureChange: symptoms.temperatureChange,
        patientConcern: false,
        concernText: null,
      });
    }

    setSaved(true);
    void drain();
  }

  if (saved) {
    return (
      <p
        role="status"
        data-testid="session-saved"
        className="rounded-[--radius-card] border border-[--color-ontrack] bg-[--color-ontrack-quiet] p-4 text-base"
      >
        {translate(locale, "offline.queued")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {exercises.map((exercise) => {
          const log = logs[exercise.id];
          return (
            <li
              key={exercise.id}
              data-testid="exercise-card"
              data-exercise-id={exercise.id}
              className="rounded-[--radius-card] border border-[--color-border] bg-[--color-surface] p-4"
            >
              <h3 className="text-lg font-semibold">{exercise.name}</h3>
              <p className="mt-1 text-base text-[--color-ink-muted]">{exercise.instruction}</p>

              <p className="mt-2 text-base">
                {translate(locale, "today.sets", { sets: exercise.sets, reps: exercise.reps })}
                {exercise.holdSeconds > 0
                  ? `, ${translate(locale, "today.hold", { seconds: exercise.holdSeconds })}`
                  : ""}
              </p>

              {exercise.holdSeconds > 0 ? (
                <HoldTimer seconds={exercise.holdSeconds} locale={locale} />
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {(["DONE", "PARTIAL", "NOT_DONE"] as const).map((status) => {
                  const selected = log?.status === status;
                  const label =
                    status === "DONE"
                      ? "today.done"
                      : status === "PARTIAL"
                        ? "today.partial"
                        : "today.notDone";
                  return (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setStatus(exercise.id, status)}
                      className={`rounded-[--radius-control] border px-4 py-2 text-base font-medium ${
                        selected
                          ? "border-[--color-accent] bg-[--color-accent-quiet]"
                          : "border-[--color-border-strong] bg-[--color-surface]"
                      }`}
                    >
                      {translate(locale, label)}
                    </button>
                  );
                })}
              </div>

              {log && log.status !== "DONE" ? (
                <fieldset className="mt-3">
                  <legend className="text-base font-medium">
                    {translate(locale, "today.whyNotDone")}
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        aria-pressed={log.reason === reason}
                        onClick={() => setReason(exercise.id, reason)}
                        className={`rounded-[--radius-control] border px-3 py-2 text-base ${
                          log.reason === reason
                            ? "border-[--color-accent] bg-[--color-accent-quiet]"
                            : "border-[--color-border] bg-[--color-surface-sunken]"
                        }`}
                      >
                        {translate(locale, `reason.${reason}` as never)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </li>
          );
        })}
      </ol>

      <RomInput locale={locale} onChange={setRom} />
      <SymptomForm locale={locale} onChange={setSymptoms} />

      <div className="thumb-zone pt-3">
        <button
          type="button"
          disabled={!allAnswered}
          onClick={finish}
          data-testid="finish-session"
          className="w-full rounded-[--radius-control] bg-[--color-accent] px-4 py-4 text-lg font-semibold text-white disabled:opacity-40"
        >
          {translate(locale, "today.finish")}
        </button>
      </div>
    </div>
  );
}
