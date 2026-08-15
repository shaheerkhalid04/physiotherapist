import Groq from "groq-sdk";

/**
 * Clinician-facing summarisation assistant.
 *
 * The brief permits exactly three uses of a language model in this application: translating
 * clinician-written messages, rephrasing clinician-written text into plain language, and
 * summarising logged data for a clinician. This file implements the third.
 *
 * The constraints are structural, not just prompt instructions:
 *
 *   1. It is only reachable from staff routes. A patient session cannot call it.
 *   2. It receives a compact factual digest assembled by our own code, never raw free text
 *      from a patient and never the protocol prescription. It cannot recommend an exercise
 *      because it is never shown the exercise library.
 *   3. Its output is labelled as a machine-written summary wherever it is displayed, and it
 *      is never stored as a clinical record.
 *
 * A summariser that cannot see the prescription cannot alter the prescription.
 */

const MODEL = "llama-3.3-70b-versatile";

export interface PatientDigest {
  mrn: string;
  postOpDay: number;
  procedure: string;
  phase: string | null;
  adherence: { due: number; completed: number };
  romTrend: { postOpDay: number; value: number; method: "SELF" | "CLINIC" }[];
  painTrend: { postOpDay: number; rest: number; movement: number }[];
  openAlerts: { ruleKey: string; severity: string; raisedAt: string }[];
}

const SYSTEM_PROMPT = `You summarise post-operative hand therapy monitoring data for a surgeon or hand therapist.

Rules you must follow exactly:
- Summarise only what is in the data given to you. Never infer a diagnosis.
- Never recommend, suggest, modify or name an exercise, a dosage or a phase change. You are not shown the prescription and you must not speculate about it.
- Never address the patient. You are writing for a clinician.
- Distinguish self-measured values from clinic-measured values whenever you mention range of motion. They are not equivalent evidence.
- If the data is too sparse to say anything useful, say so plainly rather than filling the gap.
- Be brief. Four sentences at most. No headings, no bullet points, no preamble.`;

export interface AssistantResult {
  summary: string;
  model: string;
  generatedAt: string;
}

export class AssistantUnavailable extends Error {}

export async function summarisePatient(digest: PatientDigest): Promise<AssistantResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new AssistantUnavailable("GROQ_API_KEY is not configured");
  }

  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: 300,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(digest) },
    ],
  });

  const summary = completion.choices[0]?.message?.content?.trim();
  if (!summary) throw new AssistantUnavailable("The model returned an empty response");

  return { summary, model: MODEL, generatedAt: new Date().toISOString() };
}
