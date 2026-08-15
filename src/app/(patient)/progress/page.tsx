import { requirePatient } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { translate, type Locale } from "@/i18n/messages";

/**
 * The patient's own view of their progress.
 *
 * Encouraging, and factual. It shows what they recorded and nothing inferred: no predicted
 * recovery, no comparison against other patients, no interpretation of a downward trend.
 * Anything that reads as clinical judgement has to come from their clinician.
 */
export default async function ProgressPage() {
  const session = await requirePatient();
  const patientId = session.user.patientId!;

  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: patientId },
    include: {
      measurements: {
        where: { instrumentKey: "finger-rom" },
        orderBy: { recordedAt: "asc" },
      },
      sessions: { orderBy: { scheduledFor: "desc" }, take: 30 },
    },
  });

  const locale = patient.language.toLowerCase() as Locale;

  const values = patient.measurements
    .map((m) => m.value)
    .filter((value): value is number => value !== null);

  const first = values[0] ?? null;
  const latest = values.at(-1) ?? null;
  const best = values.length > 0 ? Math.max(...values) : null;

  let streak = 0;
  for (const session of patient.sessions) {
    if (session.status === "COMPLETE" || session.status === "PARTIAL") streak += 1;
    else break;
  }

  const maxValue = best ?? 1;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{translate(locale, "progress.title")}</h1>

      {streak > 0 ? (
        <p className="rounded-card border border-ontrack bg-ontrack-quiet p-4 text-lg font-medium">
          {translate(locale, "progress.streak", { count: streak })}
        </p>
      ) : null}

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">{translate(locale, "progress.movement")}</h2>

        {values.length === 0 ? (
          <p className="mt-2 text-base text-ink-muted">
            {locale === "ur" ? "ابھی کوئی پیمائش نہیں۔" : "No measurements recorded yet."}
          </p>
        ) : (
          <>
            <div className="mt-4 flex h-40 items-end gap-1" role="img" aria-label={
              locale === "ur"
                ? `پہلی پیمائش ${first} درجے، تازہ ترین ${latest} درجے`
                : `First measurement ${first} degrees, most recent ${latest} degrees`
            }>
              {patient.measurements.slice(-20).map((measurement) => (
                <div
                  key={measurement.id}
                  className="flex-1 rounded-t bg-accent"
                  style={{
                    height: `${Math.max(4, ((measurement.value ?? 0) / maxValue) * 100)}%`,
                  }}
                />
              ))}
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-sm text-ink-muted">
                  {locale === "ur" ? "پہلی" : "First"}
                </dt>
                <dd className="text-xl font-semibold tabular-nums">{Math.round(first ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">
                  {locale === "ur" ? "تازہ ترین" : "Latest"}
                </dt>
                <dd className="text-xl font-semibold tabular-nums">{Math.round(latest ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">
                  {locale === "ur" ? "بہترین" : "Best"}
                </dt>
                <dd className="text-xl font-semibold tabular-nums">{Math.round(best ?? 0)}</dd>
              </div>
            </dl>
          </>
        )}
      </section>
    </div>
  );
}
