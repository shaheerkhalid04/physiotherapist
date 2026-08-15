# PROGRESS

Running log of what is built, what is pending, and what is blocked.

## Status

| Step | Description | State |
|---|---|---|
| 1 | `PLAN.md`, `PROGRESS.md`, scaffold, git init | Done |
| 2 | Prisma schema, migration, 15 seeded protocol templates | Done, applied and seeded |
| 3 | Auth, roles, measurement module with unit tests | Done |
| 4 | Clinician side | Done |
| 5 | Patient side, offline sync, PWA | Done, with the offline gap below |
| 6 | Alert rules engine, notifications | Rules done, notification delivery not wired |
| 7 | Exports: PDF, DOCX, XLSX | Done, files verified |
| 8 | Urdu localisation, accessibility, Playwright | Done, 9 pass and 1 known gap |
| 9 | `README.md` and governance note | Done |

## Verified

Against a live Postgres, a production build and a real browser.

- `npm run test`: 57 unit tests pass
- `npx tsc --noEmit`: clean
- `npx eslint .`: clean
- `npm run build`: succeeds, 12 routes
- `npm run db:migrate`: 24 tables created
- `npm run db:seed`: 15 templates (1 signed off), 8 thresholds (0 approved), 1 patient
- `npx tsx scripts/verify.ts`: 8 checks pass, including that the database physically refuses
  an unreviewed template, that a real plateau stays inert until its threshold is approved and
  fires once it is, that all three exports produce files, and that a replayed clientUuid is
  rejected with P2002
- `npm run test:e2e`: 9 pass, 1 known gap below

## Known gap: the offline week does not work across app restarts

The headline acceptance criterion is not met, and the failing test is marked `fixme` rather
than weakened, so it stays visible.

What does work, and is proven: writes made with no connection queue in IndexedDB and drain
correctly on reconnect, and a replayed batch is counted as duplicates rather than inserted
twice.

What does not work: reopening the app with no connection. `/today` is server rendered on
demand, so a reload offline cannot produce the exercise list. A patient who closes the app
mid-week and reopens it offline sees the offline fallback, not their exercises.

Closing this needs a departmental decision, not just code. The only way to show a
prescription offline is to serve a cached copy, and a cached copy can be stale. If a
clinician changes the phase while a patient is offline for a week, a cached screen shows
exercises from a superseded phase, which is exactly what hard safety constraint 1 exists to
prevent. Options, in rough order of increasing safety:

1. Cache the last rendered `/today` and accept staleness.
2. Cache the prescription in IndexedDB, render the screen client side, and refuse to show
   anything older than a departmentally agreed window.
3. Leave it as is, and tell patients the app needs a connection to open.

This is question 14 for the department.

## Log

### Steps 2 to 9

- Prisma schema, 24 tables. Clinical rows append-only, no cascade deletes on clinical data.
  `PatientProtocol.sourceTemplateReviewedById` is NOT NULL, which is the structural reason an
  unreviewed template cannot be assigned to a patient.
- Prisma 7 moved the connection URL out of the schema, so it lives in `prisma.config.ts` and
  reaches the client through the `@prisma/adapter-pg` driver adapter in `src/lib/db.ts`.
- Measurement instruments are pure and versioned: finger ROM with TAM and TPM, Strickland in
  both published band sets, Buck-Gramcko-Lister, wrist, elbow and shoulder arcs, Kapandji,
  grip and pinch, Semmes-Weinstein, two-point discrimination, Vancouver scar in both
  versions, QuickDASH, PRWHE.
- Rules engine in one declarative file. Review and outreach rules stay inert until a
  clinician approves their thresholds. Urgent rules always run and mark the alert when the
  threshold was unapproved.
- Offline outbox in IndexedDB, draining to `/api/sync`. Idempotency is a unique constraint on
  a device-generated uuid per table, so a replayed batch is counted as duplicates rather than
  inserted twice. The service worker deliberately does not background-replay writes.
- Patient surface: today's session with hold timer and audible cue, goniometer entry with
  non-blocking plausibility warnings, symptom logging, the "Something is wrong" control, and
  a progress view that shows recorded data with no inference.
- Clinician surface: risk-sorted worklist, patient timeline with self-measured and
  clinic-measured points as separate series, phase progression that only ever writes a
  `PhaseTransition` carrying the approving clinician, enrolment, and the protocol library
  with sign-off.
- Exports: PDF progress report, editable DOCX clinic letter, XLSX audit workbook with a notes
  sheet explaining provenance. Every export is audit logged.

## Decisions

| Decision | Rationale |
|---|---|
| Vercel plus managed Postgres | Chosen by the project owner. Data residency consequence recorded in `PLAN.md` section 3 and in the README governance note. |
| Passive ROM is clinician-entered only | A patient with one operated limb cannot reliably move it passively and read a goniometer simultaneously. |
| Alert thresholds seeded as unapproved defaults | The brief forbids guessing clinical parameters. |
| Urgent rules ignore approval state | A missing signature must never silence a suspected rupture. This is a deliberate exception to the rule above. |
| Buck-Gramcko-Lister ships with no default bands | The formula is not in doubt, the point bands are. It records the measurement and returns a null grade until the department configures and approves bands. |
| Both Strickland and both Vancouver variants ship | The two published band sets disagree on the same measurement. The department nominates its default. |
| Serwist over `next-pwa` | `next-pwa` is unmaintained against the App Router. |
| Build pinned to webpack | Next 16 defaults to Turbopack and `@serwist/next` is a webpack plugin. Pinning is preferable to shipping without a service worker. |
| Patient protocol is a deep copy | Editing a template must not retroactively change an in-treatment prescription. |

## Blocked and outstanding

- Twelve open clinical questions in `PLAN.md` section 11, plus a thirteenth: the
  Buck-Gramcko-Lister point bands.
- Notification delivery is not implemented. Alerts are raised and surface on the worklist,
  but nothing sends an SMS or a push. `src/lib/auth/otp.ts` has the single SMS seam and
  throws until a gateway is configured.
- `/api/cron/reminders` is referenced in the README and the schema has a `ReminderJob` queue,
  but the route handler is not written.
- Media upload is modelled and audited but there is no upload UI and no storage adapter
  implementation yet.
- PROM scheduling at baseline, 6 weeks, 3, 6 and 12 months is scored and stored but nothing
  creates the scheduled rows.
- Admin user management and the audit log viewer are not built.

