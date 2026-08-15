import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Session } from "next-auth";

/**
 * Session guards for page components.
 *
 * A layout redirect is not enough on its own. Next renders layouts and pages in parallel, so
 * a page that asserts `session!.user` throws before the layout's redirect takes effect. The
 * visitor still ends up at the login screen, which is why the behaviour looked correct, but
 * the server logs an unhandled error on every unauthenticated request and the page is one
 * refactor away from leaking a stack trace instead of redirecting.
 *
 * These helpers redirect rather than assert, so the page and the layout agree.
 */

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireStaff(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role === "PATIENT") redirect("/today");
  return session;
}

export async function requirePatient(): Promise<Session & { user: { patientId: string } }> {
  const session = await requireSession();
  if (session.user.role !== "PATIENT") redirect("/worklist");
  if (!session.user.patientId) redirect("/login");
  return session as Session & { user: { patientId: string } };
}
