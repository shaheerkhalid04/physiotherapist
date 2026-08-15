import { requirePatient } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { activePhase, permittedExercises, postOpDay } from "@/lib/domain/prescription";
import { translate, type Locale } from "@/i18n/messages";
import { SessionRunner } from "@/components/patient/SessionRunner";
import { ConcernButton } from "@/components/patient/ConcernButton";

/**
 * Today's session.
 *
 * The exercise list comes from permittedExercises, which returns nothing at all unless a
 * clinician has activated a phase. There is no fallback list and no default: an empty
 * prescription renders an explanation, not exercises.
 */
export default async function TodayPage() {
  const session = await requirePatient();
  const patientId = session.user.patientId!;

  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: patientId },
    include: {
      operation: true,
      protocols: {
        where: { active: true },
        include: { phases: { include: { exercises: true }, orderBy: { order: "asc" } } },
      },
    },
  });

  const locale = patient.language.toLowerCase() as Locale;
  const now = new Date();
  const protocol = patient.protocols[0] ?? null;
  const phase = activePhase(protocol, now);
  const exercises = permittedExercises(protocol, now);
  const day = patient.operation ? postOpDay(patient.operation.dateOfSurgery, now) : 0;

  const openUrgentAlert = await prisma.alert.findFirst({
    where: { patientId, status: "OPEN", severity: "URGENT", patientNotified: true },
    orderBy: { raisedAt: "desc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      {openUrgentAlert ? (
        <div
          role="alert"
          data-testid="urgent-patient-notice"
          className="flex gap-3 rounded-card border-2 border-urgent bg-urgent-quiet p-4"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-6 w-6 shrink-0 fill-urgent">
            <path d="M10 1.5l8.5 15h-17l8.5-15zm0 5a1 1 0 00-1 1v4a1 1 0 002 0v-4a1 1 0 00-1-1zm0 9.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
          </svg>
          <p className="text-base font-medium">{translate(locale, "urgent.contactDepartment")}</p>
        </div>
      ) : null}

      <header>
        <h1 className="text-2xl font-semibold">{translate(locale, "today.title")}</h1>
        <p className="mt-1 text-ink-muted">
          {translate(locale, "today.postOpDay", { day })}
        </p>
      </header>

      {phase ? (
        <section className="rounded-card border border-border bg-surface p-4">
          <h2 className="font-semibold">{phase.name}</h2>
          {phase.orthosisSchedule ? (
            <p className="mt-2 text-base text-ink-muted">{phase.orthosisSchedule}</p>
          ) : null}
        </section>
      ) : null}

      {exercises.length === 0 ? (
        <p
          data-testid="no-prescription"
          className="rounded-card border border-border bg-surface p-4 text-base"
        >
          {translate(locale, "today.noPhase")}
        </p>
      ) : (
        <SessionRunner
          locale={locale}
          postOpDay={day}
          side={patient.operatedSide}
          exercises={exercises.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            instruction: exercise.instruction,
            sets: exercise.sets,
            reps: exercise.reps,
            holdSeconds: exercise.holdSeconds,
            frequencyPerDay: exercise.frequencyPerDay,
          }))}
        />
      )}

      <ConcernButton locale={locale} postOpDay={day} />
    </div>
  );
}
