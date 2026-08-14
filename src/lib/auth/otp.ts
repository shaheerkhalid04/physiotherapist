import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * One time codes for patient login.
 *
 * Codes are hashed at rest, expire, and are single use. Attempts are counted so a code
 * cannot be brute forced within its window.
 */

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

export function generateCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

export async function issueOtp(phone: string): Promise<{ sent: boolean; devCode?: string }> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await prisma.otpCode.create({
    data: { phone, codeHash: await bcrypt.hash(code, 10), expiresAt },
  });

  if (!process.env.SMS_PROVIDER) {
    // Development: the gateway is not configured, so the code goes to the server log only.
    // It is never returned to the browser in production.
    console.log(`[otp] ${phone} -> ${code}`);
    return { sent: false, devCode: process.env.NODE_ENV === "production" ? undefined : code };
  }

  await sendSms(phone, `Your verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`);
  return { sent: true };
}

export async function consumeOtp(phone: string, code: string): Promise<boolean> {
  const candidate = await prisma.otpCode.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!candidate) return false;

  if (candidate.attempts >= OTP_MAX_ATTEMPTS) return false;

  const ok = await bcrypt.compare(code, candidate.codeHash);

  await prisma.otpCode.update({
    where: { id: candidate.id },
    data: ok ? { consumedAt: new Date() } : { attempts: { increment: 1 } },
  });

  return ok;
}

async function sendSms(to: string, body: string): Promise<void> {
  // The gateway is an open question in PLAN.md. This is the single place to wire it in.
  throw new Error(`SMS provider ${process.env.SMS_PROVIDER} is not implemented yet (to=${to}, len=${body.length})`);
}
