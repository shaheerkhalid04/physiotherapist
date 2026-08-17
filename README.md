# Glide

A web application that lets post-operative hand and upper limb patients carry out
surgeon-prescribed rehabilitation at home, log range of motion and pain, and be monitored
remotely, so they travel to hospital only when clinically necessary.

## Clinical governance, read this first

**This software has not been reviewed, validated or approved for clinical use.**

1. **The protocol library is a set of drafts.** All fifteen templates seed with
   `reviewedBy: null` and status `DRAFT`. They are structured drafts of commonly described
   regimes, written so the department has something concrete to correct. Every phase
   boundary, dosage and precaution in them is a question, not an answer. A named surgeon or
   hand therapist must review and sign off each template in the application before it can
   reach a patient. The database enforces this: `PatientProtocol.sourceTemplateReviewedById`
   is `NOT NULL`, so an unreviewed template cannot be assigned.

2. **Alert thresholds are unapproved defaults.** Plateau, non-adherence, splint compliance
   and CRPS screening thresholds seed unapproved and those rules do not run until a
   clinician approves them. Urgent rules, meaning suspected tendon rupture, infection,
   neurovascular compromise and a patient-raised concern, always run: a missing signature
   must never silence them. When an urgent alert fires on an unapproved threshold it is
   labelled as such on the worklist.

3. **Self-measured data is not clinic data.** Every measurement records whether the patient
   measured it at home with a paper goniometer or a therapist measured it in clinic. Charts,
   the PDF report and the audit spreadsheet all carry that distinction. Do not pool the two.

4. **Nothing patient-facing is machine-generated clinical advice.** Patient copy comes from
   a fixed human-written catalogue in `src/i18n/messages.ts` or from the clinician's own
   prescription text. Any future LLM use is limited to translating clinician-written
   messages, rephrasing clinician-written text, and summarising logged data for clinicians.

5. **Data residency.** This deploys to Vercel with managed Postgres, which means
   identifiable patient data and wound photographs sit with third-party cloud providers,
   likely outside the country of care. That needs departmental and legal sign-off before
   any real patient use. `src/lib/storage/` is an adapter seam so an on-premises deployment
   does not require changes to feature code.

6. **Twelve clinical questions are open.** They are listed in [PLAN.md](PLAN.md) section 11
   and include which Strickland band set the department uses, which Vancouver Scar Scale
   version, and the numeric plateau and non-adherence thresholds. They change scoring and
   safety behaviour and have not been guessed at.

7. **The Urdu translation needs a native speaker's review.** It is a working draft.

8. **The offline age bound is not a clinician's number.** The app works with no connection by
   caching the prescription on the device. A cached copy can be stale: if a clinician changes
   the phase while a patient is offline, the device holds exercises from a superseded phase.
   The mitigation is that a cached copy is usable for a bounded time, currently 7 days, after
   which no exercises are shown at all and the patient is told to contact the department.
   That 7 is a placeholder and is question 14. See `src/lib/offline/prescription.ts` and
   PROGRESS.md.

## Integrations

| Concern | Service | Where |
|---|---|---|
| Clinician chat assistant | Groq, `llama-3.3-70b-versatile` | `src/lib/ai/assistant.ts`, `POST /api/assistant` |
| API documentation | OpenAPI 3.1 with Swagger UI | `/api-docs`, spec at `/api/openapi` |
| Error monitoring | Sentry | `sentry.*.config.ts`, `instrumentation*.ts` |
| Alert notification | Resend | `src/lib/notify/email.ts` |

### The AI assistant, and what it is not allowed to be

The brief permits exactly three uses of a language model here: translating clinician-written
messages, rephrasing clinician-written text, and summarising logged data for a clinician.
The assistant implements the third and only the third, as a streamed conversation so a
clinician can ask follow-up questions about what they are looking at.

Four structural limits, not just prompt instructions:

1. **Clinician only.** A patient session is rejected at the route before anything else runs.
2. **It never sees the prescription.** The digest sent to the model contains measurements,
   adherence and open alerts. It contains no exercises, no protocol, no patient free text and
   no identifying detail beyond the MRN. An assistant that cannot see the prescription
   cannot alter it, and cannot recommend an exercise it has never been shown.
3. **The client cannot forge the conversation.** Multi-turn means the transcript arrives from
   the browser on every request, so it is untrusted input. `sanitiseHistory` discards any
   message claiming a role other than user or assistant, so a client cannot inject a system
   message; content is trimmed and length-bounded and the transcript is capped to the most
   recent turns. The real system prompt is assembled server-side every time and cannot be
   replaced. This is covered by unit tests.
4. **Its output is labelled and never stored as a clinical record.** The transcript is
   component state, never persisted, and carries a non-dismissible label with the model name
   reading "machine-written, not a clinical opinion". Every call is audit logged before the
   stream is consumed, so a conversation abandoned halfway still leaves a record.

Nothing generated by a model ever reaches a patient. That is hard safety constraint 2 and it
survives this feature intact.

### What happens when a service is not configured

Each integration degrades to a stated failure rather than a silent one. Without
`GROQ_API_KEY` the assistant returns 503 and the rest of the app is unaffected. Without
`RESEND_API_KEY` urgent alerts still reach the worklist and a warning is logged, so the
department is never falsely recorded as having been emailed. Without a Sentry DSN, reporting
is simply off.

Sentry is configured with `sendDefaultPii: false`, cookies and request bodies stripped, user
objects reduced to an internal id, and **session replay deliberately disabled** — replaying a
patient session would ship their pain scores, wound photographs and free text to a third
party.

## Setup

Requirements: Node 20 or newer, Docker Desktop, git.

```bash
cp .env.example .env
npm install
npm run setup
```

`npm run setup` starts Postgres in Docker, applies migrations, seeds the department and the
draft protocol library, then starts the dev server on http://localhost:3000.

Seeded development accounts:

| Role | Sign in with |
|---|---|
| Surgeon | `surgeon@example.test` / `development-only` |
| Therapist | `therapist@example.test` / `development-only` |
| Administrator | `admin@example.test` / `development-only` |
| Patient | phone `+920000000010`, PIN `0000` |

Set `SEED_DEMO_PATIENT=false` to seed a department with no signed-off templates and no
patient, which is the state a real deployment starts in.

Individual commands:

```bash
npm run db:up        # start Postgres on port 5433
npm run db:migrate   # apply migrations
npm run db:seed      # seed department, staff, draft protocols, unapproved thresholds
npm run db:studio    # browse the database
npm run test         # unit tests
npm run test:e2e     # Playwright, needs a seeded database
npm run typecheck
npm run lint
```

## Architecture

Next.js 16 App Router, TypeScript strict, Tailwind v4, Prisma against PostgreSQL, Auth.js,
Zod at every input boundary, Recharts, Serwist for the service worker, Vitest and Playwright.

The reasoning for Next.js over a client-only SPA is in [PLAN.md](PLAN.md) section 2.

```
src/
  app/
    (patient)/         patient surface, larger type, one-handed layout, RTL aware
    (clinic)/          risk-sorted worklist and patient timeline
    api/sync/          offline queue drain, idempotent on client uuid
    api/export/[kind]/ pdf, docx and xlsx exports
    sw.ts              service worker
  lib/
    clinical/
      instruments/     pure, versioned scoring. No database, no React, no clock.
      rules.ts         the entire escalation surface, one declarative file
    domain/
      prescription.ts  what a patient may be shown, and when
      alerts.ts        loads context, runs rules, persists alerts
      audit.ts         every clinical write
    offline/queue.ts   IndexedDB outbox
    sync/contract.ts   shared Zod contract for the drain
    export/            report, letter and workbook builders
  i18n/messages.ts     all patient-facing copy, human written
prisma/
  schema.prisma        24 tables, clinical rows append-only
  seed-data/           the fifteen draft protocol templates
```

### Three structural decisions

**Measurements are one polymorphic, versioned table.** Each row carries `instrumentKey`,
`instrumentVersion` and a JSONB payload validated by that instrument's schema, so correcting
a scoring bug ships as a new version and never rewrites history.

**A patient protocol is a deep copy of its template.** Editing a template must not
retroactively change what a patient currently under treatment is being told to do.

**Clinical writes are append-only.** Nothing is hard-deleted. A correction is a new row
superseding an older one, and `AuditLog` records actor, action, entity, before and after
values, IP address and user agent.

### Offline

The patient surface is offline-first. Writes go to an IndexedDB outbox and drain to
`/api/sync` on reconnect, on focus, and on a timer. Every record carries a device-generated
UUID with a unique constraint server-side, so a replayed batch upserts and is reported back
as a duplicate rather than inserted twice. The service worker deliberately does not
background-replay writes: two independent replay mechanisms would be an efficient way to
create the duplicate records the acceptance criteria forbid.

## Deployment

1. Provision Postgres and set `DATABASE_URL`.
2. Set `AUTH_SECRET` (`npx auth secret`), `CRON_SECRET`, `AUTH_TRUST_HOST=true`, and
   `AUTH_URL` set to the origin the app is served from. Getting `AUTH_URL` wrong produces a
   confusing failure rather than an obvious one: the credentials are accepted and a session
   is created, then the browser is redirected to `http://localhost:3000` and the user
   concludes their password is wrong.
3. Configure the SMS gateway in `src/lib/auth/otp.ts` and set `SMS_PROVIDER`, `SMS_API_KEY`
   and `SMS_SENDER_ID`. Until then OTP codes are written to the server log and patients must
   use the PIN fallback.
4. Set `BLOB_READ_WRITE_TOKEN` for wound photograph storage.
5. `npx prisma migrate deploy` on release.
6. Add a Vercel Cron entry hitting `/api/cron/reminders` with the `CRON_SECRET` bearer
   token. Serverless functions cannot hold a scheduler, so reminders are a queue table
   drained on a schedule.

## Backup and retention

- Postgres is the system of record. Take daily automated backups with point-in-time
  recovery, and test a restore before go-live, not after.
- Nothing is hard-deleted, so backups also need a defined retention period and a documented
  destruction process. Media retention is open question 10 in [PLAN.md](PLAN.md).
- `AuditLog` grows monotonically and must be included in backups. It is the record of who
  did what to a patient's data.
- Wound photographs live in blob storage, not in Postgres. They need their own backup and
  their own retention rule.

## Testing

Unit tests cover every scoring function with worked examples named in the test, the
escalation rules, and the rule that decides what a patient may be shown.

```bash
npm run test
```

Playwright covers the offline week, batch replay idempotency, the non-dismissible
disclaimer, role separation, worklist risk ordering, and an axe pass at WCAG 2.1 AA.

```bash
npm run db:up && npm run db:migrate && npm run db:seed && npm run test:e2e
```
