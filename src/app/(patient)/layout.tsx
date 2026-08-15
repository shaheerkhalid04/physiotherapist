import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { SafetyFooter } from "@/components/SafetyFooter";
import { OfflineBanner } from "@/components/OfflineBanner";
import { isRtl, translate, type Locale } from "@/i18n/messages";

/**
 * Every patient route passes through here, which is where the locale, the direction and the
 * non-dismissible safety footer are applied. A new patient screen cannot forget them.
 */
export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (session.user.role !== "PATIENT") redirect("/worklist");
  if (!session.user.patientId) redirect("/login");

  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: session.user.patientId },
    select: { language: true, department: { select: { contactPhone: true } } },
  });

  const locale = patient.language.toLowerCase() as Locale;
  const rtl = isRtl(locale);

  return (
    <div
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className="patient-scope flex min-h-dvh flex-col bg-canvas"
    >
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <span className="text-lg font-semibold">{translate(locale, "app.name")}</span>
        <a
          href={`tel:${patient.department.contactPhone}`}
          className="rounded-control px-3 py-2 text-base font-medium text-accent underline"
        >
          {patient.department.contactPhone}
        </a>
      </header>

      <OfflineBanner locale={locale} />

      <main className="flex-1 px-4 py-5">{children}</main>

      <SafetyFooter locale={locale} />
    </div>
  );
}
