import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { requireStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/domain/audit";

/**
 * Enrolment.
 *
 * Only templates a clinician has signed off appear in the protocol list. The database would
 * refuse an unreviewed one anyway, but offering it and then failing would be a poor way to
 * teach the rule.
 */

const enrolSchema = z.object({
  mrn: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  age: z.coerce.number().int().min(0).max(120),
  sex: z.enum(["MALE", "FEMALE", "OTHER"]),
  phone: z.string().min(6).max(20),
  operatedSide: z.enum(["LEFT", "RIGHT", "BILATERAL"]),
  dominance: z.enum(["LEFT", "RIGHT", "AMBIDEXTROUS"]),
  language: z.enum(["EN", "UR"]),
  procedure: z.string().min(1).max(300),
  dateOfSurgery: z.string().min(8),
  tendonZone: z.string().max(40).optional(),
  fixation: z.string().max(200).optional(),
  precautions: z.string().max(2000).optional(),
  templateId: z.string().uuid().optional(),
});

export default async function EnrolPage() {
  const session = await requireStaff();
  const departmentId = session.user.departmentId;

  const templates = await prisma.protocolTemplate.findMany({
    where: { departmentId, reviewedById: { not: null } },
    orderBy: { name: "asc" },
  });

  async function enrol(formData: FormData) {
    "use server";
    const staff = await auth();
    if (!staff?.user || staff.user.role === "PATIENT") throw new Error("Not authorised");

    const parsed = enrolSchema.parse(Object.fromEntries(formData));

    const patient = await prisma.patient.create({
      data: {
        departmentId: staff.user.departmentId,
        mrn: parsed.mrn,
        enrolledById: staff.user.id,
        name: parsed.name,
        age: parsed.age,
        sex: parsed.sex,
        phone: parsed.phone,
        operatedSide: parsed.operatedSide,
        dominance: parsed.dominance,
        language: parsed.language,
        operation: {
          create: {
            procedure: parsed.procedure,
            dateOfSurgery: new Date(parsed.dateOfSurgery),
            structures: { zone: parsed.tendonZone ?? null },
            fixation: parsed.fixation ?? null,
            precautions: parsed.precautions ?? null,
            operatingSurgeon: staff.user.name ?? "Unknown",
          },
        },
      },
    });

    await writeAudit({
      actorId: staff.user.id,
      actorRole: staff.user.role,
      action: "PATIENT_ENROLLED",
      entity: "Patient",
      entityId: patient.id,
      after: { mrn: parsed.mrn },
    });

    if (parsed.templateId) {
      const template = await prisma.protocolTemplate.findUniqueOrThrow({
        where: { id: parsed.templateId },
        include: { phases: { include: { exercises: true }, orderBy: { order: "asc" } } },
      });

      if (!template.reviewedById) {
        throw new Error("That template has not been signed off and cannot be assigned");
      }

      await prisma.patientProtocol.create({
        data: {
          patientId: patient.id,
          sourceTemplateId: template.id,
          sourceTemplateVersion: template.version,
          sourceTemplateReviewedById: template.reviewedById,
          assignedById: staff.user.id,
          phases: {
            create: template.phases.map((phase) => ({
              order: phase.order,
              name: phase.name,
              weekStart: phase.weekStart,
              weekEnd: phase.weekEnd,
              goals: phase.goals,
              permittedMovements: phase.permittedMovements,
              forbiddenMovements: phase.forbiddenMovements,
              orthosis: phase.orthosis,
              orthosisSchedule: phase.orthosisSchedule,
              progressionCriteria: phase.progressionCriteria,
              redFlags: phase.redFlags,
              exercises: {
                create: phase.exercises.map((exercise) => ({
                  order: exercise.order,
                  name: exercise.name,
                  instruction: exercise.instruction,
                  sets: exercise.sets,
                  reps: exercise.reps,
                  holdSeconds: exercise.holdSeconds,
                  frequencyPerDay: exercise.frequencyPerDay,
                  mediaKey: exercise.mediaKey,
                })),
              },
            })),
          },
        },
      });
    }

    redirect(`/patients/${patient.id}`);
  }

  const field = (label: string, name: string, type = "text", required = true) => (
    <label className="flex flex-col gap-1">
      <span className="text-sm">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="rounded-control border border-border-strong bg-surface px-3 py-2 text-sm"
      />
    </label>
  );

  const select = (label: string, name: string, options: string[]) => (
    <label className="flex flex-col gap-1">
      <span className="text-sm">{label}</span>
      <select
        name={name}
        className="rounded-control border border-border-strong bg-surface px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form action={enrol} className="flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Enrol a patient</h1>
      </header>

      <fieldset className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-medium">Patient</legend>
        {field("Hospital MRN", "mrn")}
        {field("Name", "name")}
        {field("Age", "age", "number")}
        {select("Sex", "sex", ["MALE", "FEMALE", "OTHER"])}
        {field("Phone", "phone", "tel")}
        {select("Operated side", "operatedSide", ["RIGHT", "LEFT", "BILATERAL"])}
        {select("Dominance", "dominance", ["RIGHT", "LEFT", "AMBIDEXTROUS"])}
        {select("Language", "language", ["UR", "EN"])}
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-medium">Operation</legend>
        {field("Procedure", "procedure")}
        {field("Date of surgery", "dateOfSurgery", "date")}
        {field("Tendon zone, nerve, bone or joint", "tendonZone", "text", false)}
        {field("Fixation", "fixation", "text", false)}
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-sm">Surgeon-specific precautions</span>
          <textarea
            name="precautions"
            rows={3}
            className="rounded-control border border-border-strong bg-surface px-3 py-2 text-sm"
          />
        </label>
      </fieldset>

      <fieldset className="rounded-card border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-medium">Protocol</legend>
        {templates.length === 0 ? (
          <p className="text-sm text-review">
            No protocol templates have been signed off yet, so none can be assigned. Sign one off
            in the protocol library first.
          </p>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-sm">Signed-off template</span>
            <select
              name="templateId"
              className="rounded-control border border-border-strong bg-surface px-3 py-2 text-sm"
            >
              <option value="">Assign later</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="mt-2 text-xs text-ink-faint">
          Assignment copies the template. Editing the library afterwards will not change this
          patient&apos;s prescription. The first phase still needs activating on the patient page.
        </p>
      </fieldset>

      <button
        type="submit"
        className="w-fit rounded-control bg-accent px-5 py-2.5 text-sm font-medium text-white"
      >
        Enrol patient
      </button>
    </form>
  );
}
