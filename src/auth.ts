import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { consumeOtp } from "@/lib/auth/otp";

/**
 * Two credential providers, because staff and patients authenticate differently.
 *
 *   staff    email and password, for surgeons, therapists and administrators
 *   patient  phone number and a one time code, with a PIN fallback for shared or
 *            low-literacy contexts
 *
 * The PIN is deliberately a fallback and not a primary factor. It exists because a patient
 * on a borrowed handset may not receive an SMS, not because it is good security.
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "PATIENT" | "THERAPIST" | "SURGEON" | "ADMIN";
      departmentId: string;
      patientId: string | null;
      language: "EN" | "UR";
    } & DefaultSession["user"];
  }
}

const staffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const patientSchema = z.object({
  phone: z.string().min(6),
  code: z.string().min(4).max(8).optional(),
  pin: z.string().min(4).max(8).optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },

  providers: [
    Credentials({
      id: "staff",
      name: "Staff",
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = staffSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          include: { patient: { select: { id: true } } },
        });

        if (!user?.passwordHash || !user.active) return null;
        if (user.role === "PATIENT") return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
          patientId: null,
          language: user.language,
        };
      },
    }),

    Credentials({
      id: "patient",
      name: "Patient",
      credentials: { phone: {}, code: {}, pin: {} },
      async authorize(raw) {
        const parsed = patientSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { phone, code, pin } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { phone },
          include: { patient: { select: { id: true } } },
        });

        if (!user || !user.active || user.role !== "PATIENT") return null;

        if (code) {
          const valid = await consumeOtp(phone, code);
          if (!valid) return null;
        } else if (pin) {
          if (!user.pinHash) return null;
          const ok = await bcrypt.compare(pin, user.pinHash);
          if (!ok) return null;
        } else {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
          patientId: user.patient?.id ?? null,
          language: user.language,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.departmentId = user.departmentId;
        token.patientId = user.patientId;
        token.language = user.language;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as typeof session.user.role;
      session.user.departmentId = token.departmentId as string;
      session.user.patientId = (token.patientId as string | null) ?? null;
      session.user.language = token.language as "EN" | "UR";
      return session;
    },
  },
});
