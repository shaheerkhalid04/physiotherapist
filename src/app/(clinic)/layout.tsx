import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

const STAFF = new Set(["THERAPIST", "SURGEON", "ADMIN"]);

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (!STAFF.has(session.user.role)) redirect("/today");

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/worklist" className="font-semibold">
              Worklist
            </Link>
            <Link href="/enrol" className="text-ink-muted hover:text-ink">
              Enrol patient
            </Link>
            <Link href="/templates" className="text-ink-muted hover:text-ink">
              Protocols
            </Link>
          </nav>
          <span className="text-sm text-ink-muted">
            {session.user.name} ({session.user.role.toLowerCase()})
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
