"use client";

import { useState } from "react";
import { drain, enqueue } from "@/lib/offline/queue";
import { translate, type Locale } from "@/i18n/messages";

/**
 * The "Something is wrong" control.
 *
 * It queues offline like everything else, so a patient with no signal still gets a record
 * written that reaches the team the moment there is a connection. It gives no reassurance
 * and no interpretation, because neither would be coming from a clinician.
 */
export function ConcernButton({ locale, postOpDay }: { locale: Locale; postOpDay: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  async function send() {
    await enqueue({
      kind: "symptomLog",
      clientUuid: crypto.randomUUID(),
      sessionClientUuid: null,
      recordedAt: new Date().toISOString(),
      postOpDay,
      painAtRest: 0,
      painOnMovement: 0,
      swelling: 0,
      stiffness: 0,
      fever: false,
      spreadingRedness: false,
      discharge: false,
      numbness: false,
      colourChange: false,
      coldIntolerance: false,
      temperatureChange: false,
      patientConcern: true,
      concernText: text.slice(0, 2000) || null,
    });

    setSent(true);
    void drain();
  }

  if (sent) {
    return (
      <p
        role="status"
        data-testid="concern-sent"
        className="rounded-[--radius-card] border-2 border-[--color-urgent] bg-[--color-urgent-quiet] p-4 text-base font-medium"
      >
        {translate(locale, "concern.sent")}
      </p>
    );
  }

  return (
    <section>
      {open ? (
        <div className="flex flex-col gap-3 rounded-[--radius-card] border-2 border-[--color-urgent] bg-[--color-urgent-quiet] p-4">
          <label className="flex flex-col gap-2">
            <span className="text-base font-medium">{translate(locale, "concern.title")}</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={4}
              className="rounded-[--radius-control] border border-[--color-border-strong] bg-[--color-surface] p-3 text-base"
            />
          </label>
          <button
            type="button"
            onClick={send}
            data-testid="concern-send"
            className="rounded-[--radius-control] bg-[--color-urgent] px-4 py-3 text-lg font-semibold text-white"
          >
            {locale === "ur" ? "بھیجیں" : "Send"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="concern-button"
          className="flex w-full items-center justify-center gap-2 rounded-[--radius-card] border-2 border-[--color-urgent] bg-[--color-surface] px-4 py-4 text-lg font-semibold text-[--color-urgent]"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-6 w-6 fill-current">
            <path d="M10 1.5l8.5 15h-17l8.5-15zm0 5a1 1 0 00-1 1v4a1 1 0 002 0v-4a1 1 0 00-1-1zm0 9.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
          </svg>
          {translate(locale, "concern.button")}
        </button>
      )}
    </section>
  );
}
