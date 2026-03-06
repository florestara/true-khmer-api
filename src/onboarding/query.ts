import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index";
import { normalizeLocationName } from "./utils";
import {
  city,
  contribution,
  country,
  interest,
  tier,
  user,
  userContribution,
  userInterest,
  userPointLedger,
  userProfile,
  userProgress,
} from "../db/schema";
import type {
  OnboardingContributionsStepPayload,
  OnboardingInterestsStepPayload,
  OnboardingProfileStepPayload,
} from "./schema";
import {
  ONBOARDING_COMPLETE_STEP,
  ONBOARDING_CONTRIBUTIONS_STEP,
  ONBOARDING_INTERESTS_STEP,
  ONBOARDING_MIN_STEP,
  ONBOARDING_PROFILE_STEP,
} from "./constants";
import type {
  CityListItemDto,
  ContributionOptionDto,
  CountryListItemDto,
  InterestOptionDto,
  OnboardingOptionsDto,
  OnboardingStateDto,
} from "./types";

export async function listCountriesFromDb(): Promise<CountryListItemDto[]> {
  return db
    .select({
      id: country.id,
      name: country.name,
      iso2: country.iso2,
    })
    .from(country)
    .where(eq(country.isActive, true))
    .orderBy(asc(country.name));
}

type ListCitiesInput = {
  countryId?: string;
  countryName?: string;
};

export async function listCitiesByCountryFromDb({
  countryId,
  countryName,
}: ListCitiesInput): Promise<CityListItemDto[]> {
  let resolvedCountryId = countryId?.trim();

  if (!resolvedCountryId && countryName?.trim()) {
    const normalizedCountry = normalizeLocationName(countryName);
    const [resolvedCountry] = await db
      .select({ id: country.id })
      .from(country)
      .where(
        and(
          eq(country.isActive, true),
          eq(country.normalizedName, normalizedCountry),
        ),
      )
      .limit(1);
    resolvedCountryId = resolvedCountry?.id;
  }

  if (!resolvedCountryId) {
    return [];
  }

  return db
    .select({
      id: city.id,
      countryId: city.countryId,
      name: city.name,
    })
    .from(city)
    .where(and(eq(city.countryId, resolvedCountryId), eq(city.isActive, true)))
    .orderBy(asc(city.name));
}

export async function validateCountryCityIds(
  countryId: string,
  cityId: string,
) {
  const normalizedCountryId = countryId.trim();
  const normalizedCityId = cityId.trim();

  if (!normalizedCountryId || !normalizedCityId) {
    return { ok: false as const, error: "countryId and cityId are required" };
  }

  const [existingCountry] = await db
    .select({ id: country.id })
    .from(country)
    .where(and(eq(country.id, normalizedCountryId), eq(country.isActive, true)))
    .limit(1);

  if (!existingCountry) {
    return {
      ok: false as const,
      error: "Invalid country",
    };
  }

  const [existingCity] = await db
    .select({ id: city.id })
    .from(city)
    .where(
      and(
        eq(city.countryId, existingCountry.id),
        eq(city.id, normalizedCityId),
        eq(city.isActive, true),
      ),
    )
    .limit(1);

  if (!existingCity) {
    return {
      ok: false as const,
      error: "Invalid city for selected country",
    };
  }

  return {
    ok: true as const,
    countryId: existingCountry.id,
    cityId: existingCity.id,
  };
}

export async function findUserById(userId: string) {
  const [found] = await db
    .select({
      id: user.id,
      email: user.email,
      role: user.role,
      onboardingStep: user.onboardingStep,
      onboardingCompletedAt: user.onboardingCompletedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return found ?? null;
}

/**
 * Updates the user's onboarding step. The step can only go forward, never backward.
 * Clamps the value to the valid range and uses SQL GREATEST to prevent decreasing.
 */
export async function getOnboardingState(
  userId: string,
): Promise<OnboardingStateDto | null> {
  const foundUser = await findUserById(userId);
  if (!foundUser) {
    return null;
  }

  const [profileRow] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userId, userId))
    .limit(1);

  const selectedInterests = await db
    .select({ interestId: userInterest.interestId })
    .from(userInterest)
    .where(eq(userInterest.userId, userId));

  const selectedContributions = await db
    .select({ contributionId: userContribution.contributionId })
    .from(userContribution)
    .where(eq(userContribution.userId, userId));

  const [progressRow] = await db
    .select({
      totalPoints: userProgress.totalPoints,
      tierId: tier.id,
      tierSlug: tier.slug,
      tierName: tier.name,
      tierRankOrder: tier.rankOrder,
      tierMinPoints: tier.minPoints,
    })
    .from(userProgress)
    .leftJoin(tier, eq(userProgress.currentTierId, tier.id))
    .where(eq(userProgress.userId, userId))
    .limit(1);

  return {
    user: foundUser,
    profile: profileRow ?? null,
    selectedInterestIds: selectedInterests.map((item) => item.interestId),
    selectedContributionIds: selectedContributions.map(
      (item) => item.contributionId,
    ),
    progress: {
      totalPoints: progressRow?.totalPoints ?? 0,
      tier:
        progressRow?.tierId &&
        progressRow.tierSlug &&
        progressRow.tierName &&
        progressRow.tierRankOrder !== null &&
        progressRow.tierMinPoints !== null
          ? {
              id: progressRow.tierId,
              slug: progressRow.tierSlug,
              name: progressRow.tierName,
              rankOrder: progressRow.tierRankOrder,
              minPoints: progressRow.tierMinPoints,
            }
          : null,
    },
  };
}

export async function getOnboardingOptions(): Promise<OnboardingOptionsDto> {
  const [interests, contributions, tiers] = await Promise.all([
    db
      .select({ id: interest.id, slug: interest.slug, label: interest.label })
      .from(interest)
      .where(eq(interest.isActive, true))
      .orderBy(asc(interest.label)),
    db
      .select({
        id: contribution.id,
        slug: contribution.slug,
        name: contribution.name,
        description: contribution.description,
      })
      .from(contribution)
      .where(eq(contribution.isActive, true))
      .orderBy(asc(contribution.name)),
    db
      .select({
        id: tier.id,
        slug: tier.slug,
        name: tier.name,
        rankOrder: tier.rankOrder,
        minPoints: tier.minPoints,
        description: tier.description,
      })
      .from(tier)
      .orderBy(asc(tier.rankOrder)),
  ]);

  return {
    interests,
    contributions,
    tiers,
  };
}

export async function getInterestOptions(): Promise<InterestOptionDto[]> {
  return db
    .select({ id: interest.id, slug: interest.slug, label: interest.label })
    .from(interest)
    .where(eq(interest.isActive, true))
    .orderBy(asc(interest.label));
}

export async function getContributionOptions(): Promise<
  ContributionOptionDto[]
> {
  return db
    .select({
      id: contribution.id,
      slug: contribution.slug,
      name: contribution.name,
      description: contribution.description,
    })
    .from(contribution)
    .where(eq(contribution.isActive, true))
    .orderBy(asc(contribution.name));
}

export async function saveProfileStep(
  userId: string,
  payload: OnboardingProfileStepPayload,
  avatarUrl: string | null,
  countryId: string,
  cityId: string,
) {
  const [userIdentity] = await db
    .select({
      firstName: user.firstName,
      lastName: user.lastName,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const computedDisplayName =
    `${userIdentity?.firstName ?? ""} ${userIdentity?.lastName ?? ""}`.trim() ||
    null;

  const profileData = {
    userId,
    displayName: computedDisplayName,
    avatarKey: payload.avatarKey ?? null,
    avatarUrl,
    bio: payload.bio ?? null,
    countryId,
    cityId,
  };

  await db.transaction(async (tx) => {
    await tx
      .insert(userProfile)
      .values(profileData)
      .onConflictDoUpdate({
        target: userProfile.userId,
        set: {
          displayName: profileData.displayName,
          avatarKey: profileData.avatarKey,
          avatarUrl: profileData.avatarUrl,
          bio: profileData.bio,
          countryId: profileData.countryId,
          cityId: profileData.cityId,
          updatedAt: new Date(),
        },
      });

    await tx
      .update(user)
      .set({
        onboardingStep: sql`GREATEST(${user.onboardingStep}, ${ONBOARDING_PROFILE_STEP})`,
      })
      .where(eq(user.id, userId));
  });
}

export async function replaceUserInterests(
  userId: string,
  payload: OnboardingInterestsStepPayload,
) {
  const uniqueInterestIds = Array.from(new Set(payload.interestIds));

  const activeInterests = await db
    .select({ id: interest.id })
    .from(interest)
    .where(
      and(eq(interest.isActive, true), inArray(interest.id, uniqueInterestIds)),
    );

  if (activeInterests.length !== uniqueInterestIds.length) {
    return { ok: false as const, error: "One or more interests are invalid" };
  }

  await db.transaction(async (tx) => {
    await tx.delete(userInterest).where(eq(userInterest.userId, userId));

    if (uniqueInterestIds.length > 0) {
      await tx.insert(userInterest).values(
        uniqueInterestIds.map((interestId) => ({
          userId,
          interestId,
        })),
      );
    }

    await tx
      .update(user)
      .set({
        onboardingStep: sql`GREATEST(${user.onboardingStep}, ${ONBOARDING_INTERESTS_STEP})`,
      })
      .where(eq(user.id, userId));
  });
  return { ok: true as const };
}

export async function replaceUserContributions(
  userId: string,
  payload: OnboardingContributionsStepPayload,
) {
  const selectedContributionIds = Array.from(new Set(payload.contributionIds));

  if (selectedContributionIds.length > 0) {
    const activeContributions = await db
      .select({ id: contribution.id })
      .from(contribution)
      .where(
        and(
          eq(contribution.isActive, true),
          inArray(contribution.id, selectedContributionIds),
        ),
      );

    if (activeContributions.length !== selectedContributionIds.length) {
      return {
        ok: false as const,
        error: "One or more contributions are invalid",
      };
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(userContribution)
      .where(eq(userContribution.userId, userId));

    if (selectedContributionIds.length > 0) {
      await tx.insert(userContribution).values(
        selectedContributionIds.map((contributionId) => ({
          userId,
          contributionId,
        })),
      );
    }

    await tx
      .update(user)
      .set({
        onboardingStep: sql`GREATEST(${user.onboardingStep}, ${ONBOARDING_CONTRIBUTIONS_STEP})`,
      })
      .where(eq(user.id, userId));
  });
  return { ok: true as const };
}

export async function completeOnboarding(userId: string) {
  const [startingTier] = await db
    .select({ id: tier.id })
    .from(tier)
    .orderBy(asc(tier.rankOrder))
    .limit(1);

  await db.transaction(async (tx) => {
    await tx
      .insert(userProgress)
      .values({
        userId,
        totalPoints: 0,
        currentTierId: startingTier?.id ?? null,
      })
      .onConflictDoUpdate({
        target: userProgress.userId,
        set: {
          currentTierId: sql`COALESCE(${userProgress.currentTierId}, ${startingTier?.id ?? null})`,
          updatedAt: new Date(),
        },
      });

    await tx
      .insert(userPointLedger)
      .values({
        userId,
        pointsDelta: 0,
        actionType: "ONBOARDING_COMPLETED",
        eventKey: `onboarding_completed:${userId}`,
        referenceType: "onboarding",
        referenceId: "step-4",
      })
      .onConflictDoNothing({ target: userPointLedger.eventKey });

    await tx
      .update(user)
      .set({
        onboardingStep: sql`GREATEST(${user.onboardingStep}, ${ONBOARDING_COMPLETE_STEP})`,
        onboardingCompletedAt: new Date(),
      })
      .where(eq(user.id, userId));
  });
}
