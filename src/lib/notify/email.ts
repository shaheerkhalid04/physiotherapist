import { Resend } from "resend";
import { prisma } from "@/lib/db";

/**
 * Alert notification delivery.
 *
 * An alert that only exists on a dashboard nobody is looking at is not an escalation. This
 * closes that gap for urgent alerts by emailing the department.
 *
 * Two deliberate limits:
 *
 *   1. The email contains the MRN, the rule and the severity. It never contains a patient
 *      name, phone number or free text, because email is not a secure channel and a
 *      notification only needs to say "look at this patient now".
 *   2. Delivery is recorded on the alert. A notification that silently failed to send is
 *      worse than none, because the department would believe it had been told.
 */

export interface UrgentAlertNotification {
  alertId: string;
  mrn: string;
  ruleKey: string;
  severity: string;
  postOpDay: number;
  thresholdUnapproved: boolean;
}

export class EmailUnavailable extends Error {}

export async function notifyUrgentAlert(
  notification: UrgentAlertNotification,
  to: string[],
): Promise<{ sent: boolean; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    // Not configured. Log loudly rather than pretending the department was told.
    console.warn(
      `[notify] RESEND_API_KEY or RESEND_FROM not set, urgent alert ${notification.alertId} was not emailed`,
    );
    return { sent: false };
  }

  if (to.length === 0) {
    console.warn(`[notify] no recipients for urgent alert ${notification.alertId}`);
    return { sent: false };
  }

  const resend = new Resend(apiKey);
  const rule = notification.ruleKey.replace(/-/g, " ");

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: `Urgent: ${rule}, MRN ${notification.mrn}`,
    text: [
      `An urgent alert has been raised for MRN ${notification.mrn}.`,
      "",
      `Rule: ${rule}`,
      `Severity: ${notification.severity}`,
      `Post-operative day: ${notification.postOpDay}`,
      notification.thresholdUnapproved
        ? "Note: this rule fired on a threshold that has not been signed off by a clinician."
        : "",
      "",
      "Open the worklist to review. This message deliberately contains no patient identifying detail beyond the MRN.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (error) {
    console.error(`[notify] failed to send urgent alert ${notification.alertId}`, error);
    return { sent: false };
  }

  await prisma.alert.update({
    where: { id: notification.alertId },
    data: { patientNotified: true },
  });

  return { sent: true, id: data?.id };
}

/**
 * Clinicians in a department who should receive urgent notifications.
 *
 * ALERT_EMAIL_OVERRIDE redirects every notification to a single address. It exists because
 * the seeded demo staff use the reserved example.test domain, which by definition cannot
 * receive mail, so on a demo deployment the notification path would look broken when it was
 * in fact working correctly and being refused by the mail provider.
 *
 * It is a demo affordance and must be unset in a real deployment, where sending every
 * patient's urgent alerts to one inbox would be both wrong and a disclosure risk. The
 * override is logged on every send so it cannot be in force unnoticed.
 */
export async function urgentRecipients(departmentId: string): Promise<string[]> {
  const override = process.env.ALERT_EMAIL_OVERRIDE?.trim();
  if (override) {
    console.warn(
      `[notify] ALERT_EMAIL_OVERRIDE is set, routing all urgent alerts to ${override} instead of the department`,
    );
    return [override];
  }

  const staff = await prisma.user.findMany({
    where: {
      departmentId,
      active: true,
      role: { in: ["SURGEON", "THERAPIST"] },
      email: { not: null },
    },
    select: { email: true },
  });

  return staff.map((member) => member.email as string);
}
