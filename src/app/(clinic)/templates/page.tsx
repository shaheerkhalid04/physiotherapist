import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/domain/audit";

/**
 * Protocol library and sign-off.
 *
 * Signing a template off is the act that makes it assignable. Until then the database
 * refuses the assignment, so this page is not a formality.
 */
export default async function TemplatesPage() {
  const session = await auth();

  const templates = await prisma.protocolTemplate.findMany({
    where: { departmentId: session!.user.departmentId },
    include: {
      reviewedBy: { select: { name: true } },
      phases: { include: { exercises: true }, orderBy: { order: "asc" } },
      _count: { select: { assignments: true } },
    },
    orderBy: { name: "asc" },
  });

  async function signOff(formData: FormData) {
    "use server";
    const staff = await auth();
    if (!staff?.user || staff.user.role !== "SURGEON") {
      throw new Error("Only a surgeon may sign off a protocol template");
    }

    const templateId = String(formData.get("templateId"));
    const before = await prisma.protocolTemplate.findUniqueOrThrow({ where: { id: templateId } });

    await prisma.protocolTemplate.update({
      where: { id: templateId },
      data: { status: "APPROVED", reviewedById: staff.user.id, reviewedAt: new Date() },
    });

    await writeAudit({
      actorId: staff.user.id,
      actorRole: staff.user.role,
      action: "TEMPLATE_SIGNED_OFF",
      entity: "ProtocolTemplate",
      entityId: templateId,
      before: { status: before.status, reviewedById: before.reviewedById },
      after: { status: "APPROVED", reviewedById: staff.user.id },
    });

    revalidatePath("/templates");
  }

  const unsigned = templates.filter((template) => template.reviewedById === null).length;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold">Protocol library</h1>
        <p className="mt-1 text-sm text-[--color-ink-muted]">
          {templates.length} templates, {unsigned} awaiting departmental review. An unreviewed
          template cannot be assigned to a patient.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {templates.map((template) => (
          <li
            key={template.id}
            className="rounded-[--radius-card] border border-[--color-border] bg-[--color-surface] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">{template.name}</h2>
                <p className="mt-1 text-sm text-[--color-ink-muted]">{template.indication}</p>
                <p className="mt-1 text-xs text-[--color-ink-faint]">
                  {template.phases.length} phases,{" "}
                  {template.phases.reduce((sum, phase) => sum + phase.exercises.length, 0)} exercises,
                  assigned to {template._count.assignments} patients
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                {template.reviewedById ? (
                  <span className="rounded-full border border-[--color-ontrack] bg-[--color-ontrack-quiet] px-2.5 py-1 text-xs font-semibold text-[--color-ontrack]">
                    Signed off by {template.reviewedBy?.name}
                  </span>
                ) : (
                  <span className="rounded-full border border-[--color-review] bg-[--color-review-quiet] px-2.5 py-1 text-xs font-semibold text-[--color-review]">
                    Draft, not for clinical use
                  </span>
                )}

                {!template.reviewedById && session!.user.role === "SURGEON" ? (
                  <form action={signOff}>
                    <input type="hidden" name="templateId" value={template.id} />
                    <button
                      type="submit"
                      className="rounded-[--radius-control] bg-[--color-accent] px-3 py-2 text-sm font-medium text-white"
                    >
                      Sign off
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
