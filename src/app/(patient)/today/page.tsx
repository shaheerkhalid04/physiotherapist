import { requirePatient } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { TodayClient } from "@/components/patient/TodayClient";
import type { Locale } from "@/i18n/messages";

/**
 * Today's session.
 *
 * This page deliberately renders no clinical data on the server. The exercise list arrives
 * from /api/prescription and is cached on the device, which is what lets the screen work
 * with no connection. The page itself is a shell carrying only the locale and the patient
 * id, so the service worker can cache the markup without caching anybody's prescription.
 *
 * The rule that only a clinician-approved active phase reaches a patient did not move when
 * the render did: the API route calls the same permittedExercises this page used to call,
 * so nothing outside the active phase can be sent, and therefore nothing outside it can be
 * cached.
 */
export default async function TodayPage() {
  const session = await requirePatient();

  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: session.user.patientId },
    select: { language: true },
  });

  return (
    <TodayClient
      locale={patient.language.toLowerCase() as Locale}
      patientId={session.user.patientId}
    />
  );
}
