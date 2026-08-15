import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Reconciles the demo account credentials with the deployment environment.
 *
 * A public demo must not run on the credentials printed in a public README, and the seed
 * only sets a password the first time it runs. This closes the gap for a database that was
 * seeded before those variables existed.
 *
 * Scope is deliberately narrow. It only ever touches accounts the seed created, identified
 * by the reserved example.test domain and the reserved demo phone number. It cannot reset a
 * real clinician's password, because a real clinician does not have an example.test address.
 * If either variable is unset it does nothing at all.
 */

const DEMO_STAFF_EMAILS = [
  "surgeon@example.test",
  "therapist@example.test",
  "admin@example.test",
];
const DEMO_PATIENT_PHONE = "+920000000010";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const password = process.env.SEED_STAFF_PASSWORD;
  const pin = process.env.SEED_PATIENT_PIN;

  if (!password && !pin) {
    console.log("No demo credential overrides set, leaving accounts untouched.");
    return;
  }

  if (password) {
    const result = await prisma.user.updateMany({
      where: { email: { in: DEMO_STAFF_EMAILS } },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Demo staff credentials reconciled for ${result.count} account(s).`);
  }

  if (pin) {
    const result = await prisma.user.updateMany({
      where: { phone: DEMO_PATIENT_PHONE, role: "PATIENT" },
      data: { pinHash: await bcrypt.hash(pin, 10) },
    });
    console.log(`Demo patient PIN reconciled for ${result.count} account(s).`);
  }
}

main()
  .catch((error) => {
    // Never fail a deployment over demo credentials. The application is unaffected.
    console.error("Demo credential reconciliation failed, continuing.", error);
  })
  .finally(() => prisma.$disconnect());
