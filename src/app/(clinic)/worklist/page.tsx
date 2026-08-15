import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { severityRank } from "@/lib/clinical/rules";
import { postOpDay } from "@/lib/domain/prescription";

/**
 * Risk-sorted worklist.
 *
 * The acceptance criterion is that a clinician gets from login to the highest-risk patient
 * in under ten seconds, so the ordering is done in the query layer and the most urgent row
 * is always first. Severity is shown with colour, an icon and a word, never colour alone.
 */

const BAND_LABEL = {
  URGENT: "Urgent",
  REVIEW: "Review",
  OUTREACH: "Outreach",
  ONTRACK: "On track",
} as const;

type Band = keyof typeof BAND_LABEL;

export default async function WorklistPage() {
  const session = await requireStaff();
  const departmentId = session.user.departmentId;

  const patients = await prisma.patient.findMany({
    where: { departmentId },
    include: {
      operation: true,
      alerts: { where: { status: "OPEN" }, orderBy: { raisedAt: "desc" } },
      measurements: {
        where: { instrumentKey: "finger-rom" },
        orderBy: { recordedAt: "desc" },
        take: 2,
      },
      sessions: { orderBy: { scheduledFor: "desc" }, take: 14 },
    },
  });

  const rows = patients
    .map((patient) => {
      const top = patient.alerts
        .slice()
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))[0];

      const band: Band = top ? (top.severity as Band) : "ONTRACK";
      const due = patient.sessions.filter((s) => s.scheduledFor <= new Date());
      const completed = due.filter((s) => s.status === "COMPLETE" || s.status === "PARTIAL").length;
      const adherence = due.length > 0 ? Math.round((completed / due.length) * 100) : null;
      const latestTam = patient.measurements[0]?.value ?? null;
      const previousTam = patient.measurements[1]?.value ?? null;

      return {
        id: patient.id,
        name: patient.name,
        mrn: patient.mrn,
        band,
        alertCount: patient.alerts.length,
        topRule: top?.ruleKey ?? null,
        thresholdUnapproved: Boolean(
          top && (top.context as { thresholdUnapproved?: boolean })?.thresholdUnapproved,
        ),
        day: patient.operation ? postOpDay(patient.operation.dateOfSurgery, new Date()) : null,
        procedure: patient.operation?.procedure ?? "Operation not recorded",
        adherence,
        latestTam,
        tamDelta: latestTam !== null && previousTam !== null ? latestTam - previousTam : null,
        selfMeasured: patient.measurements[0]?.method === "SELF",
      };
    })
    .sort((a, b) => {
      const order: Band[] = ["URGENT", "REVIEW", "OUTREACH", "ONTRACK"];
      const byBand = order.indexOf(a.band) - order.indexOf(b.band);
      return byBand !== 0 ? byBand : b.alertCount - a.alertCount;
    });

  const urgent = rows.filter((row) => row.band === "URGENT").length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Worklist</h1>
        <p className="text-sm text-ink-muted">
          {rows.length} patients, {urgent} needing urgent attention
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[52rem] text-sm">
          <caption className="sr-only">
            Patients ordered by clinical risk, most urgent first
          </caption>
          <thead className="bg-surface-sunken text-start">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-medium">State</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">Patient</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">Operation</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">Post-op day</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">TAM</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">Adherence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                data-testid="worklist-row"
                data-band={row.band}
                className="border-t border-border"
              >
                <td className="px-4 py-3">
                  <StateBadge band={row.band} rule={row.topRule} unapproved={row.thresholdUnapproved} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/patients/${row.id}`} className="font-medium underline">
                    {row.name}
                  </Link>
                  <div className="text-ink-faint">{row.mrn}</div>
                </td>
                <td className="px-4 py-3">{row.procedure}</td>
                <td className="px-4 py-3 tabular-nums">{row.day ?? "-"}</td>
                <td className="px-4 py-3 tabular-nums">
                  {row.latestTam !== null ? (
                    <span className="flex items-center gap-2">
                      {Math.round(row.latestTam)}
                      {row.tamDelta !== null ? (
                        <span className={row.tamDelta < 0 ? "text-urgent" : "text-ink-muted"}>
                          {row.tamDelta >= 0 ? "+" : ""}
                          {Math.round(row.tamDelta)}
                        </span>
                      ) : null}
                      <span
                        title={row.selfMeasured ? "Self-measured" : "Clinic measured"}
                        className="text-xs uppercase tracking-wide text-ink-faint"
                      >
                        {row.selfMeasured ? "self" : "clinic"}
                      </span>
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {row.adherence !== null ? `${row.adherence}%` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No patients enrolled yet.</p>
      ) : null}
    </div>
  );
}

function StateBadge({
  band,
  rule,
  unapproved,
}: {
  band: Band;
  rule: string | null;
  unapproved: boolean;
}) {
  const style: Record<Band, string> = {
    URGENT: "border-urgent bg-urgent-quiet text-urgent",
    REVIEW: "border-review bg-review-quiet text-review",
    OUTREACH: "border-outreach bg-outreach-quiet text-outreach",
    ONTRACK: "border-ontrack bg-ontrack-quiet text-ontrack",
  };

  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style[band]}`}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
          {band === "URGENT" ? (
            <path d="M10 1.5l8.5 15h-17l8.5-15zm0 5a1 1 0 00-1 1v4a1 1 0 002 0v-4a1 1 0 00-1-1zm0 9.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
          ) : band === "ONTRACK" ? (
            <path d="M8 14.5l-4.5-4.5 1.4-1.4L8 11.7l6.6-6.6L16 6.5z" />
          ) : (
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 12H9v-2h2zm0-3H9V6h2z" />
          )}
        </svg>
        {BAND_LABEL[band]}
      </span>
      {rule ? (
        <span className="text-xs text-ink-faint">{rule.replace(/-/g, " ")}</span>
      ) : null}
      {unapproved ? (
        <span className="text-xs text-review">threshold not signed off</span>
      ) : null}
    </div>
  );
}
