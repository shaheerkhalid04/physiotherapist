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

- `npm run test`: 68 unit tests pass
- `npx tsc --noEmit`: clean
- `npx eslint .`: clean
- `npm run build`: succeeds, 12 routes
- `npm run db:migrate`: 24 tables created
- `npm run db:seed`: 15 templates (1 signed off), 8 thresholds (0 approved), 1 patient
- `npx tsx scripts/verify.ts`: 8 checks pass, including that the database physically refuses
  an unreviewed template, that a real plateau stays inert until its threshold is approved and
  fires once it is, that all three exports produce files, and that a replayed clientUuid is
  rejected with P2002
- `npm run test:e2e`: 10 pass, including the full offline week

## The offline week, and the trade-off it required

The headline acceptance criterion now passes end to end: a patient completes seven sessions
with the radio off, reopening the app each time, and everything syncs on reconnection with
no data loss and no duplicates.

Getting there needed a design change, because the previous `/today` was server rendered and
a reload with no connection could not produce an exercise list. The shape now is:

- `/today` renders no clinical data on the server. It is a shell carrying the locale and the
  patient id, which is what makes the markup safe for the service worker to cache.
- The prescription is fetched from `/api/prescription` and stored in IndexedDB with the
  timestamp at which the server last confirmed it.
- The API returns only what `permittedExercises` returns, so the rule that only a
  clinician-approved active phase reaches a patient did not move when the render did.
  Nothing outside the active phase can be sent, therefore nothing outside it can be cached.

**The trade-off, which still needs departmental sign-off.** A cached prescription can be
stale. If a clinician changes the phase while a patient is offline, the device is holding
exercises from a phase that is no longer current. The mitigation is a bounded age, in
`src/lib/offline/prescription.ts`:

| Age of cached copy | Behaviour |
|---|---|
| Under 1 day | Shown normally |
| 1 day to the bound | Shown, with the date it was last confirmed displayed to the patient |
| Past the bound | No exercises shown at all, patient told to contact the department |
| Stamped in the future | Treated as unusable, because a device clock that lies cannot be used to evaluate an age bound |

`DEFAULT_MAX_OFFLINE_AGE_DAYS` is currently 7. **That number is mine, not a clinician's**,
and it is question 14 for the department. Withholding exercises is the deliberate failure
mode: delaying a patient is recoverable, showing exercises from a superseded phase can
rupture a repair.

Post-operative day is projected forward by the days elapsed since the cache was written, so
a session logged four days into an offline stretch is filed under the correct day rather
than the day the prescription was downloaded.

One residual limitation, stated in the patient-facing copy rather than hidden: the very
first visit must be online. A service worker does not control the page that installed it, so
the device is primed by the first online visit and works offline from then on.

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

## Notes

- Every UI component is hand-written on shadcn/ui primitives rather than generated. The
  design follows the direction in the brief: a restrained palette, one accent reserved for
  clinical state, alerts carrying colour and icon and text rather than colour alone, and a
  larger type scale on the patient side.
- The Urdu strings in `src/i18n/messages.ts` are a working draft and need review by a native
  speaker before clinical use.
