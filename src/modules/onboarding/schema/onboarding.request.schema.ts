import { z } from "zod";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuidSchema = z.string().trim().regex(UUID_RE, "must be a valid UUID");

export const onboardingProfileStepSchema = z
  .object({
    bio: z.string().trim().max(1000).optional(),
    countryId: uuidSchema,
    cityId: uuidSchema,
    avatarKey: z.string().trim().min(1).max(600).optional(),
  })
  .openapi("OnboardingProfileStepRequest");

export const onboardingInterestsStepSchema = z
  .object({
    interestIds: z
      .array(uuidSchema)
      .min(2, "interestIds must contain at least 2 items")
      .max(20)
      .refine(
        (interestIds) =>
          new Set(interestIds.map((interestId) => interestId.toLowerCase()))
            .size === interestIds.length,
        "interestIds must contain unique items",
      ),
  })
  .openapi("OnboardingInterestsStepRequest");

export const onboardingContributionsStepSchema = z
  .object({
    community_member: z.boolean().optional(),
    find_volunteers: z.boolean().optional(),
    launch_project: z.boolean().optional(),
    organize_event: z.boolean().optional(),
  })
  .strict()
  .refine(
    (payload) =>
      payload.community_member === true ||
      payload.find_volunteers === true ||
      payload.launch_project === true ||
      payload.organize_event === true,
    {
      message: "At least one contribution must be selected",
    },
  )
  .openapi("OnboardingContributionsStepRequest");

export type OnboardingProfileStepPayload = z.infer<
  typeof onboardingProfileStepSchema
>;
export type OnboardingInterestsStepPayload = z.infer<
  typeof onboardingInterestsStepSchema
>;
export type OnboardingContributionsStepPayload = z.infer<
  typeof onboardingContributionsStepSchema
>;
