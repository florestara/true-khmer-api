import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { user, verification } from "../db/schema/index";

export async function findUserRoleById(userId: string) {
  const [foundUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return foundUser ?? null;
}

export async function findUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const [foundUser] = await db
    .select({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1);

  return foundUser ?? null;
}

export async function findUserFirstNameByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const [foundUser] = await db
    .select({ firstName: user.firstName })
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1);

  const firstName = foundUser?.firstName?.trim();
  return firstName || null;
}

export async function revokeEmailVerificationOtp(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const identifier = `email-verification-otp-${normalizedEmail}`;
  await db.delete(verification).where(eq(verification.identifier, identifier));
}
