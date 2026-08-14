# PROGRESS

Running log of what is built, what is pending, and what is blocked.

## Status

| Step | Description | State |
|---|---|---|
| 1 | `PLAN.md`, `PROGRESS.md`, scaffold, git init | Done |
| 2 | Prisma schema, migration, 15 seeded protocol templates | Written, migration not yet applied |
| 3 | Auth, roles, measurement module with unit tests | Done |
| 4 | Clinician side | Done |
| 5 | Patient side, offline sync, PWA | Done |
| 6 | Alert rules engine, notifications | Rules done, notification delivery not wired |
| 7 | Exports: PDF, DOCX, XLSX | Done |
| 8 | Urdu localisation, accessibility, Playwright | Written, e2e not yet run |
| 9 | `README.md` and governance note | Done |

## Verified

- `npm run test`: 57 unit tests pass
- `npx tsc --noEmit`: clean
- `npx eslint .`: clean
- `npx next build --webpack`: succeeds, 12 routes

## Not verified

These are written but have never executed against a live system, because the Docker daemon
did not start on this machine during the build session. Docker Desktop was launched and
`docker info` never returned. Nothing here is known to be broken; it is simply untested.

- The migration has not been applied to a database. `prisma/migrations/20260815000000_init`
  was generated offline with `prisma migrate diff` and creates 24 tables. It has been
  validated by Prisma but never run.
- The seed has never executed. The 15 protocol templates, the unapproved thresholds and the
  demo patient exist as code only.
- Playwright has never run. The offline week, the replay idempotency check and the axe pass
  all need a seeded database.
- The exports have never produced an actual file. The builders compile and typecheck.

To close all four out on a machine with a working Docker daemon:

```bash
npm run db:up && npm run db:migrate && npm run db:seed && npm run test:e2e
```

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

