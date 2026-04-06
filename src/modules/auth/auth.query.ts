import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { user, userProfile, verification } from "../../db/schema/index";

export async function findUserRoleById(userId: string) {
  const [foundUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return foundUser ?? null;
}

export async function findUserOnboardingStatusById(userId: string) {
  const [foundUser] = await db
    .select({
      onboardingStep: user.onboardingStep,
      onboardingCompletedAt: user.onboardingCompletedAt,
    })
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

  return foundUser?.firstName?.trim() || null;
}

export async function revokeEmailVerificationOtp(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const identifier = `email-verification-otp-${normalizedEmail}`;
  await db.delete(verification).where(eq(verification.identifier, identifier));
}

export async function findUserProfileByUserId(userId: string) {
  const [profile] = await db
    .select({
      id: userProfile.id,
      displayName: userProfile.displayName,
      avatarKey: userProfile.avatarKey,
      avatarUrl: userProfile.avatarUrl,
    })
    .from(userProfile)
    .where(eq(userProfile.userId, userId))
    .limit(1);

  return profile ?? null;
}
