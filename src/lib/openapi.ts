/**
 * OpenAPI 3.1 description of the application's HTTP surface.
 *
 * Written by hand rather than generated, because the interesting part of this API is not its
 * shapes but its rules: which roles may call what, why the sync endpoint is idempotent, and
 * why the prescription endpoint can only ever return an approved active phase. A generator
 * would produce the shapes and lose all of that.
 */

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Glide API",
    version: "1.0.0",
    description:
      "Endpoints backing the patient and clinician surfaces. Every clinical write is append-only and audit logged. Nothing in this API can create or alter a prescription: a prescription reaches a patient only by a clinician copying a signed-off template, and a phase advances only through a clinician-approved transition.",
  },
  servers: [
    { url: "/", description: "Same origin" },
  ],
  tags: [
    { name: "Patient", description: "Called by the patient device. Requires a PATIENT session." },
    { name: "Clinician", description: "Requires a SURGEON, THERAPIST or ADMIN session." },
    { name: "Auth", description: "Auth.js handlers." },
  ],
  paths: {
    "/api/prescription": {
      get: {
        tags: ["Patient"],
        summary: "The patient's current prescription",
        description:
          "Returns only the exercises of the currently active, clinician-approved phase. Cached on the device for offline use, so what this endpoint refuses to return is what the device can never show. Never cached by HTTP: the device copy carries its own timestamp and an age bound.",
        responses: {
          "200": {
            description: "The active prescription",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CachedPrescription" },
              },
            },
          },
          "401": { description: "Not a patient session" },
          "404": { description: "Patient not found" },
        },
      },
    },
    "/api/sync": {
      post: {
        tags: ["Patient"],
        summary: "Drain the offline queue",
        description:
          "Applies a batch of records recorded on the device. Idempotent: every record carries a device-generated clientUuid with a unique constraint server-side, so a replayed batch is reported as duplicates rather than inserted twice. One malformed record does not fail the batch, because a patient offline for a week must not lose six good days to one bad row. Exercise logs are re-checked against the active phase here, on the write path, not only in the query that produced the screen.",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/SyncBatch" } },
          },
        },
        responses: {
          "200": {
            description: "Per-record outcome",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/SyncOutcome" } },
            },
          },
          "400": { description: "Malformed batch" },
          "401": { description: "Not a patient session" },
        },
      },
    },
    "/api/assistant": {
      post: {
        tags: ["Clinician"],
        summary: "Chat with the data assistant about a patient",
        description:
          "Clinician only, multi-turn, streamed as plain text. The model receives a factual digest assembled server-side: measurements, adherence and open alerts. It is never shown the protocol, patient free text or identifying details beyond the MRN, so it cannot recommend an exercise or a phase change.\n\nThe transcript is supplied by the client and is therefore untrusted. The system prompt is assembled server-side on every request and cannot be replaced; any message claiming a role other than user or assistant is discarded, content is trimmed and length-bounded, and the transcript is capped to the most recent turns.\n\nOutput is labelled machine-written wherever it is displayed, is never stored as a clinical record, and every call is audit logged before the stream is consumed so an abandoned conversation still leaves a record.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["patientId", "messages"],
                properties: {
                  patientId: { type: "string", format: "uuid" },
                  messages: {
                    type: "array",
                    maxItems: 60,
                    description:
                      "Conversation so far. Only user and assistant roles survive sanitisation.",
                    items: {
                      type: "object",
                      properties: {
                        role: { type: "string", enum: ["user", "assistant"] },
                        content: { type: "string", maxLength: 2000 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Streamed reply as plain text. The model name is in x-assistant-model.",
            content: { "text/plain": { schema: { type: "string" } } },
          },
          "400": { description: "No usable message to answer" },
          "401": { description: "Not a staff session" },
          "503": { description: "Assistant not configured or unavailable" },
        },
      },
    },
    "/api/export/{kind}": {
      get: {
        tags: ["Clinician"],
        summary: "Export a progress report, clinic letter or audit workbook",
        description:
          "Every export is audit logged, because an export is the moment patient data leaves the system. Exports label self-measured values distinctly from clinic-measured ones.",
        parameters: [
          {
            name: "kind",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["pdf", "docx", "xlsx"] },
          },
          {
            name: "patientId",
            in: "query",
            required: false,
            description: "Required for pdf and docx. Ignored for xlsx, which covers the department.",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Binary document" },
          "400": { description: "Unknown kind, or patientId missing" },
          "401": { description: "Not a staff session" },
        },
      },
    },
    "/api/auth/{nextauth}": {
      get: {
        tags: ["Auth"],
        summary: "Auth.js handler",
        parameters: [
          { name: "nextauth", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Handled by Auth.js" } },
      },
    },
  },
  components: {
    schemas: {
      CachedPrescription: {
        type: "object",
        properties: {
          patientId: { type: "string", format: "uuid" },
          fetchedAt: {
            type: "integer",
            description: "Epoch ms at which the server confirmed this. Drives the offline age bound.",
          },
          postOpDay: { type: "integer" },
          operatedSide: { type: "string", enum: ["LEFT", "RIGHT", "BILATERAL"] },
          phase: {
            type: ["object", "null"],
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              orthosisSchedule: { type: ["string", "null"] },
            },
          },
          exercises: { type: "array", items: { $ref: "#/components/schemas/Exercise" } },
          urgentAlert: { type: "boolean" },
        },
      },
      Exercise: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          order: { type: "integer" },
          name: { type: "string" },
          instruction: { type: "string" },
          sets: { type: "integer" },
          reps: { type: "integer" },
          holdSeconds: { type: "integer" },
          frequencyPerDay: { type: "integer" },
        },
      },
      SyncBatch: {
        type: "object",
        required: ["batchUuid", "deviceTime", "records"],
        properties: {
          batchUuid: { type: "string", format: "uuid" },
          deviceTime: { type: "string", format: "date-time" },
          records: {
            type: "array",
            minItems: 1,
            maxItems: 500,
            items: {
              type: "object",
              required: ["kind", "clientUuid"],
              properties: {
                kind: {
                  type: "string",
                  enum: ["session", "exerciseLog", "symptomLog", "measurement", "promResponse"],
                },
                clientUuid: {
                  type: "string",
                  format: "uuid",
                  description: "Device generated. The unique constraint on this is what makes replay safe.",
                },
              },
            },
          },
        },
      },
      SyncOutcome: {
        type: "object",
        properties: {
          batchUuid: { type: "string", format: "uuid" },
          accepted: { type: "integer" },
          duplicates: { type: "integer" },
          rejected: { type: "integer" },
          errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                clientUuid: { type: "string" },
                reason: { type: "string" },
              },
            },
          },
          settled: {
            type: "array",
            items: { type: "string" },
            description: "clientUuids the device may delete: accepted plus duplicates.",
          },
        },
      },
    },
  },
} as const;
