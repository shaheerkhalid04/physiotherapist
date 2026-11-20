"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/ai/assistant";

/**
 * Clinician-facing chat over a patient's monitoring data.
 *
 * The label above the transcript is not dismissible, for the same reason the patient
 * disclaimer is not: a clinician reading this must never be in any doubt about whether a
 * human wrote it.
 *
 * The transcript is component state and is never persisted. It is not a clinical record and
 * storing it would make it look like one.
 */

const SUGGESTIONS = [
  "Summarise this patient's progress",
  "How has adherence been over the last two weeks?",
  "Is the range of motion trend improving or flat?",
  "What open alerts are there and when were they raised?",
];

/** `model` comes from the server, so the label names the model that really answers. */
export function AssistantChat({ patientId, model }: { patientId: string; model: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, streaming]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || streaming) return;

    const history: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(history);
    setInput("");
    setError(null);
    setStreaming(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId, messages: history }),
      });

      if (!response.ok || !response.body) {
        const detail = await response.json().catch(() => null);
        setError(detail?.error ?? "The assistant could not be reached.");
        setStreaming(false);
        return;
      }

      // Append an empty assistant turn, then fill it as chunks arrive.
      setMessages((current) => [...current, { role: "assistant", content: "" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((current) => {
          const next = [...current];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { role: "assistant", content: last.content + chunk };
          }
          return next;
        });
      }
    } catch {
      setError("The assistant could not be reached.");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4" data-testid="assistant">
      <h2 className="font-semibold">Data assistant</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Answers questions about this patient&apos;s logged measurements, adherence and alerts. It
        is not shown the protocol, so it cannot comment on exercises or suggest a phase change.
      </p>

      <p className="mt-3 flex items-center gap-2 rounded-control bg-surface-sunken px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 fill-current">
          <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 12H9v-2h2zm0-3H9V6h2z" />
        </svg>
        Machine-written, not a clinical opinion. Model {model}.
      </p>

      {messages.length > 0 ? (
        <ol
          className="mt-4 flex flex-col gap-3"
          aria-live="polite"
          aria-busy={streaming}
          data-testid="assistant-transcript"
        >
          {messages.map((message, index) => (
            <li
              key={index}
              data-role={message.role}
              className={
                message.role === "user"
                  ? "ms-auto max-w-[85%] rounded-card bg-accent-quiet px-3 py-2 text-sm"
                  : "max-w-[95%] rounded-card border-s-4 border-border-strong bg-surface-sunken px-3 py-2 text-sm"
              }
            >
              {message.content}
              {streaming && index === messages.length - 1 && message.role === "assistant" ? (
                <span className="ms-1 inline-block animate-pulse">▍</span>
              ) : null}
            </li>
          ))}
          <div ref={endRef} />
        </ol>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void send(suggestion)}
              className="rounded-control border border-border-strong px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-3 rounded-control bg-review-quiet p-3 text-sm">
          {error}
        </p>
      ) : null}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <label className="flex-1">
          <span className="sr-only">Ask about this patient&apos;s data</span>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about this patient's data"
            disabled={streaming}
            data-testid="assistant-input"
            className="w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm disabled:opacity-60"
          />
        </label>
        <button
          type="submit"
          disabled={streaming || input.trim().length === 0}
          data-testid="assistant-send"
          className="rounded-control bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {streaming ? "Thinking" : "Ask"}
        </button>
      </form>
    </section>
  );
}
