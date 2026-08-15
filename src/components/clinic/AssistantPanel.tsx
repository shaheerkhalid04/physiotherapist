"use client";

import { useState } from "react";

/**
 * The clinician-facing summariser.
 *
 * Every rendering of the output is labelled as machine-written and carries the model name.
 * A clinician reading a summary must never be in doubt about whether a human wrote it, and
 * the label is not dismissible for the same reason the patient disclaimer is not.
 */
export function AssistantPanel({ patientId }: { patientId: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "The assistant could not be reached.");
        return;
      }

      setSummary(data.summary);
      setModel(data.model);
    } catch {
      setError("The assistant could not be reached.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Data summary</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Summarises this patient&apos;s logged measurements, adherence and alerts. It is not
            shown the protocol, so it cannot comment on exercises or suggest a phase change.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          data-testid="assistant-generate"
          className="rounded-control bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Summarising" : "Summarise"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-control bg-review-quiet p-3 text-sm">
          {error}
        </p>
      ) : null}

      {summary ? (
        <figure className="mt-3" data-testid="assistant-summary">
          <figcaption className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-current">
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 12H9v-2h2zm0-3H9V6h2z" />
            </svg>
            Machine-written summary, not a clinical opinion. Model {model}.
          </figcaption>
          <blockquote className="rounded-control border-s-4 border-border-strong bg-surface-sunken p-3 text-sm">
            {summary}
          </blockquote>
        </figure>
      ) : null}
    </section>
  );
}
