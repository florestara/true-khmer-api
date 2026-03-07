import { z } from "zod";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuidSchema = z.string().trim().regex(UUID_RE, "must be a valid UUID");

export const onboardingProfileStepSchema = z
  .object({
    bio: z.string().trim().max(1000).optional(),
    countryId: uuidSchema,
    cityId: uuidSchema,
    avatarKey: z.string().trim().min(1).max(600).optional(),
  });

export const onboardingInterestsStepSchema = z.object({
  interestIds: z.array(uuidSchema).min(2, "interestIds must contain at least 2 items").max(20),
});

export const onboardingContributionsStepSchema = z.object({
  contributionIds: z.array(uuidSchema).max(20).default([]),
});

export type OnboardingProfileStepPayload = z.infer<typeof onboardingProfileStepSchema>;
export type OnboardingInterestsStepPayload = z.infer<typeof onboardingInterestsStepSchema>;
export type OnboardingContributionsStepPayload = z.infer<typeof onboardingContributionsStepSchema>;
