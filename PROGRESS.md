# PROGRESS

Running log of what is built, what is pending, and what is blocked. Newest entry at the top
of each section.

## Status

| Step | Description | State |
|---|---|---|
| 1 | `PLAN.md`, `PROGRESS.md`, scaffold, git init | Done, awaiting review |
| 2 | Prisma schema, migrations, 15 seeded protocol templates | Not started |
| 3 | Auth, roles, measurement module with unit tests | Not started |
| 4 | Clinician side | Not started |
| 5 | Patient side, offline sync, PWA | Not started |
| 6 | Alert rules engine, notifications | Not started |
| 7 | Exports: PDF, DOCX, XLSX | Not started |
| 8 | Urdu localisation, accessibility, Playwright | Not started |
| 9 | `README.md` and governance note | Not started |

Review pauses fall after steps 1, 3 and 5.

## Log

### Step 1, complete

- Scaffolded Next.js 16.3.1 App Router with TypeScript strict, Tailwind v4, ESLint, `src/`
  directory and the `@/*` import alias. React 19.2.8.
- The scaffold was generated in a temporary subdirectory and moved up, because npm rejects a
  package name derived from a directory containing a space.
- Initialised a git repository inside the project folder. The parent directory
  `C:\Users\kills` is itself a git repository, so without this the project would have been
  tracked by the home repository.
- Wrote `PLAN.md` covering architecture, the reasoning for Next.js over an SPA, the data
  model, the route map, the measurement module, the alert rules engine, hard safety
  constraints, build order, acceptance criteria and open clinical questions.

## Decisions

| Decision | Rationale |
|---|---|
| Vercel plus managed Postgres | Chosen by the project owner. Carries a data residency consequence for patient data and wound images, recorded in `PLAN.md` section 3 and to be repeated in the README governance note. |
| Passive ROM is clinician-entered only | A patient with one operated limb cannot reliably move it passively and read a goniometer simultaneously. |
| Alert thresholds seeded as unapproved defaults | The brief forbids guessing clinical parameters. Defaults are literature-referenced starting values, editable per protocol, inactive until a clinician signs them off. |
| Serwist over `next-pwa` | `next-pwa` is unmaintained against the App Router. |
| Patient protocol is a deep copy of its template | Editing a template must not retroactively change an in-treatment patient's prescription. |

## Blocked

Nothing is blocked. Twelve open clinical questions are listed in `PLAN.md` section 11. None
of them block steps 1 or 2.

