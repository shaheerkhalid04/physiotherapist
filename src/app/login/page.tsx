import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { issueOtp } from "@/lib/auth/otp";

/**
 * One page, two ways in.
 *
 * Patients lead, because there are far more of them than there are staff and they are the
 * ones logging in on a borrowed handset in poor light.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; sent?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { phone, sent, error } = await searchParams;

  async function requestCode(formData: FormData) {
    "use server";
    const value = String(formData.get("phone") ?? "").trim();
    if (!value) redirect("/login?error=phone");
    await issueOtp(value);
    redirect(`/login?phone=${encodeURIComponent(value)}&sent=1`);
  }

  async function patientSignIn(formData: FormData) {
    "use server";
    try {
      await signIn("patient", {
        phone: String(formData.get("phone") ?? ""),
        code: String(formData.get("code") ?? "") || undefined,
        pin: String(formData.get("pin") ?? "") || undefined,
        redirectTo: "/today",
      });
    } catch (cause) {
      if (cause instanceof Error && cause.message === "NEXT_REDIRECT") throw cause;
      redirect("/login?error=credentials");
    }
  }

  async function staffSignIn(formData: FormData) {
    "use server";
    try {
      await signIn("staff", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirectTo: "/worklist",
      });
    } catch (cause) {
      if (cause instanceof Error && cause.message === "NEXT_REDIRECT") throw cause;
      redirect("/login?error=credentials");
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <h1 className="text-2xl font-semibold">Hand Rehabilitation</h1>

      {error ? (
        <p role="alert" className="rounded-[--radius-control] bg-[--color-urgent-quiet] p-3 text-base">
          {error === "phone" ? "Please enter your phone number." : "Those details did not match."}
        </p>
      ) : null}

      <section className="rounded-[--radius-card] border border-[--color-border] bg-[--color-surface] p-5">
        <h2 className="text-lg font-semibold">Patients</h2>

        <form action={requestCode} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span>Phone number</span>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={phone ?? ""}
              required
              className="rounded-[--radius-control] border border-[--color-border-strong] bg-[--color-surface] px-3 py-3 text-lg"
            />
          </label>
          <button
            type="submit"
            className="rounded-[--radius-control] border border-[--color-border-strong] px-4 py-3 text-base font-medium"
          >
            Send me a code
          </button>
        </form>

        <form action={patientSignIn} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="phone" value={phone ?? ""} />
          {sent ? (
            <p role="status" className="text-base text-[--color-ink-muted]">
              We sent a code to {phone}.
            </p>
          ) : null}
          <label className="flex flex-col gap-1">
            <span>Code</span>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="rounded-[--radius-control] border border-[--color-border-strong] bg-[--color-surface] px-3 py-3 text-lg tracking-widest"
            />
          </label>
          <details>
            <summary className="cursor-pointer py-2 text-base">I cannot receive a code</summary>
            <label className="mt-2 flex flex-col gap-1">
              <span>PIN</span>
              <input
                name="pin"
                inputMode="numeric"
                className="rounded-[--radius-control] border border-[--color-border-strong] bg-[--color-surface] px-3 py-3 text-lg tracking-widest"
              />
            </label>
          </details>
          <button
            type="submit"
            className="rounded-[--radius-control] bg-[--color-accent] px-4 py-4 text-lg font-semibold text-white"
          >
            Sign in
          </button>
        </form>
      </section>

      <section className="rounded-[--radius-card] border border-[--color-border] bg-[--color-surface] p-5">
        <h2 className="text-lg font-semibold">Staff</h2>
        <form action={staffSignIn} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span>Email</span>
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              className="rounded-[--radius-control] border border-[--color-border-strong] bg-[--color-surface] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="rounded-[--radius-control] border border-[--color-border-strong] bg-[--color-surface] px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-[--radius-control] border border-[--color-border-strong] px-4 py-3 font-medium"
          >
            Sign in
          </button>
        </form>
      </section>
    </div>
  );
}
