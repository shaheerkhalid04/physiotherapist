import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requireStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/domain/audit";
import { activePhase, postOpDay, progressionEligible } from "@/lib/domain/prescription";
import { PainChart, RomChart } from "@/components/clinic/TimelineCharts";

/**
 * Patient timeline.
 *
 * The phase progression control is the only place a phase can move, it always writes a
 * PhaseTransition carrying the approving clinician, and it is never automatic.
 */
export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();

  const patient = await prisma.patient.findFirst({
    where: { id, departmentId: session.user.departmentId },
    include: {
      operation: true,
      protocols: {
        where: { active: true },
        include: { phases: { include: { exercises: true }, orderBy: { order: "asc" } } },
      },
      measurements: { orderBy: { recordedAt: "asc" } },
      symptomLogs: { orderBy: { recordedAt: "asc" } },
      sessions: { orderBy: { scheduledFor: "desc" }, take: 28 },
      alerts: { where: { status: "OPEN" }, orderBy: { raisedAt: "desc" } },
    },
  });

  if (!patient) notFound();

  const now = new Date();
  const protocol = patient.protocols[0] ?? null;
  const phase = activePhase(protocol, now);
  const eligibility = patient.operation
    ? progressionEligible(protocol, now, patient.operation.dateOfSurgery)
    : { eligible: false, phase: null, postOpWeek: 0 };

  const nextPhase = protocol?.phases.find((p) => phase && p.order === phase.order + 1) ?? null;

  const rom = patient.measurements
    .filter((m) => m.instrumentKey === "finger-rom" && m.value !== null)
    .map((m) => ({
      postOpDay: m.postOpDay,
      self: m.method === "SELF" ? m.value : null,
      clinic: m.method === "CLINIC" ? m.value : null,
    }));

  const pain = patient.symptomLogs.map((log) => ({
    postOpDay: log.postOpDay,
    rest: log.painAtRest,
    movement: log.painOnMovement,
  }));

  async function approveProgression(formData: FormData) {
    "use server";
    const staff = await auth();
    if (!staff?.user || !["SURGEON", "THERAPIST"].includes(staff.user.role)) {
      throw new Error("Only a surgeon or therapist may change a phase");
    }

    const toPhaseId = String(formData.get("toPhaseId"));
    const fromPhaseId = String(formData.get("fromPhaseId") || "") || null;
    const denied = formData.get("decision") === "deny";

    await prisma.phaseTransition.create({
      data: {
        protocolId: String(formData.get("protocolId")),
        fromPhaseId,
        toPhaseId,
        approvedById: staff.user.id,
        denied,
        reason: String(formData.get("reason") || "") || null,
      },
    });

    if (!denied) {
      if (fromPhaseId) {
        await prisma.patientPhase.update({
          where: { id: fromPhaseId },
          data: { activeTo: new Date() },
        });
      }
      await prisma.patientPhase.update({
        where: { id: toPhaseId },
        data: { activeFrom: new Date() },
      });
    }

    await writeAudit({
      actorId: staff.user.id,
      actorRole: staff.user.role,
      action: denied ? "PHASE_PROGRESSION_DENIED" : "PHASE_PROGRESSION_APPROVED",
      entity: "PatientPhase",
      entityId: toPhaseId,
      after: { fromPhaseId, toPhaseId },
    });

    revalidatePath(`/patients/${id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">{patient.name}</h1>
        <p className="text-sm text-ink-muted">
          {patient.mrn} · {patient.operation?.procedure ?? "Operation not recorded"} ·{" "}
          {patient.operation
            ? `day ${postOpDay(patient.operation.dateOfSurgery, now)}`
            : "no surgery date"}
        </p>
      </header>

      {patient.alerts.length > 0 ? (
        <section className="rounded-card border-2 border-urgent bg-urgent-quiet p-4">
          <h2 className="font-semibold">Open alerts</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {patient.alerts.map((alert) => (
              <li key={alert.id}>
                <strong>{alert.severity}</strong> · {alert.ruleKey.replace(/-/g, " ")} ·{" "}
                {alert.raisedAt.toISOString().slice(0, 10)}
                {(alert.context as { thresholdUnapproved?: boolean })?.thresholdUnapproved ? (
                  <span className="ms-2 text-review">threshold not signed off</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="font-semibold">Range of motion</h2>
        <p className="mb-2 text-sm text-ink-muted">
          Self-measured and clinic-measured points are shown separately and are not equivalent
          evidence.
        </p>
        {rom.length > 0 ? <RomChart data={rom} /> : <p className="text-sm">No measurements yet.</p>}
      </section>

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="font-semibold">Pain</h2>
        {pain.length > 0 ? <PainChart data={pain} /> : <p className="text-sm">No symptom logs yet.</p>}
      </section>

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="font-semibold">Phase</h2>
        {phase ? (
          <>
            <p className="mt-1 text-sm">
              {phase.name}, weeks {phase.weekStart} to {phase.weekEnd}. Patient is in week{" "}
              {eligibility.postOpWeek}.
            </p>
            <p className="mt-2 text-sm text-ink-muted">{phase.progressionCriteria}</p>

            {nextPhase ? (
              <form action={approveProgression} className="mt-4 flex flex-col gap-3">
                <input type="hidden" name="protocolId" value={protocol!.id} />
                <input type="hidden" name="fromPhaseId" value={phase.id} />
                <input type="hidden" name="toPhaseId" value={nextPhase.id} />
                <p className="text-sm">
                  {eligibility.eligible
                    ? `Eligible for ${nextPhase.name}. The app does not advance phases; this needs your decision.`
                    : `Not yet at the week range for ${nextPhase.name}. You may still advance if clinically appropriate.`}
                </p>
                <input
                  name="reason"
                  placeholder="Reason (optional)"
                  className="rounded-control border border-border-strong px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    name="decision"
                    value="approve"
                    className="rounded-control bg-accent px-4 py-2 text-sm font-medium text-white"
                  >
                    Approve progression to {nextPhase.name}
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="deny"
                    className="rounded-control border border-border-strong px-4 py-2 text-sm"
                  >
                    Record a decision not to progress
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">This is the final phase.</p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm">
            No phase is active. The patient sees no exercises until a clinician activates one.
          </p>
        )}
      </section>

      {/*
        Plain anchors on purpose. These are file downloads from route handlers, not page
        navigations, and routing them through next/link would have the client router try to
        render a binary response.
      */}
      {/* eslint-disable @next/next/no-html-link-for-pages */}
      <section className="flex flex-wrap gap-3">
        <a
          href={`/api/export/pdf?patientId=${patient.id}`}
          className="rounded-control border border-border-strong px-4 py-2 text-sm"
        >
          Progress report (PDF)
        </a>
        <a
          href={`/api/export/docx?patientId=${patient.id}`}
          className="rounded-control border border-border-strong px-4 py-2 text-sm"
        >
          Clinic letter (DOCX)
        </a>
        <a
          href="/api/export/xlsx"
          className="rounded-control border border-border-strong px-4 py-2 text-sm"
        >
          Departmental audit (XLSX)
        </a>
      </section>
    </div>
  );
}
