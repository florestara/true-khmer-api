import { eq, sql } from "drizzle-orm";
import { db } from "../../db/index";
import { user, userProfile, verification } from "../../db/schema/index";
import type { AuthCompleteSignUpPayload } from "./auth.schema";
import { ONBOARDING_PROFILE_STEP } from "../onboarding/constants";

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
      signupCompletedAt: user.signupCompletedAt,
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
      signupCompletedAt: user.signupCompletedAt,
    })
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1);

  return foundUser ?? null;
}

export async function completeUserSignUp(
  userId: string,
  payload: AuthCompleteSignUpPayload,
) {
  const fullName = `${payload.firstName} ${payload.lastName}`.trim();
  const [updatedUser] = await db.transaction(async (tx) => {
    const updatedRows = await tx
      .update(user)
      .set({
        name: fullName,
        firstName: payload.firstName,
        lastName: payload.lastName,
        gender: payload.gender,
        occupation: payload.occupation,
        phoneNumber: payload.phoneNumber,
        signupCompletedAt: sql`COALESCE(${user.signupCompletedAt}, NOW())`,
        onboardingStep: sql`GREATEST(${user.onboardingStep}, ${ONBOARDING_PROFILE_STEP})`,
      })
      .where(eq(user.id, userId))
      .returning({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
        occupation: user.occupation,
        phoneNumber: user.phoneNumber,
        image: user.image,
        signupCompletedAt: user.signupCompletedAt,
        onboardingStep: user.onboardingStep,
        onboardingCompletedAt: user.onboardingCompletedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });

    const [updatedUser] = updatedRows;
    if (updatedUser?.image) {
      await tx
        .insert(userProfile)
        .values({
          userId: updatedUser.id,
          displayName: fullName || null,
          avatarKey: updatedUser.image,
          avatarUrl: updatedUser.image,
        })
        .onConflictDoUpdate({
          target: userProfile.userId,
          set: {
            displayName: fullName || null,
            avatarKey: sql`COALESCE(${userProfile.avatarKey}, ${updatedUser.image})`,
            avatarUrl: sql`COALESCE(${userProfile.avatarUrl}, ${updatedUser.image})`,
            updatedAt: new Date(),
          },
        });
    }

    return updatedRows;
  });

  return updatedUser ?? null;
}

export async function markUserSignUpCompleted(userId: string) {
  const [updatedUser] = await db
    .update(user)
    .set({
      signupCompletedAt: sql`COALESCE(${user.signupCompletedAt}, NOW())`,
    })
    .where(eq(user.id, userId))
    .returning({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      occupation: user.occupation,
      phoneNumber: user.phoneNumber,
      image: user.image,
      signupCompletedAt: user.signupCompletedAt,
      onboardingStep: user.onboardingStep,
      onboardingCompletedAt: user.onboardingCompletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });

  return updatedUser ?? null;
}

export async function findAuthFlowUserById(userId: string) {
  const [foundUser] = await db
    .select({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      occupation: user.occupation,
      phoneNumber: user.phoneNumber,
      image: user.image,
      signupCompletedAt: user.signupCompletedAt,
      onboardingStep: user.onboardingStep,
      onboardingCompletedAt: user.onboardingCompletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
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
