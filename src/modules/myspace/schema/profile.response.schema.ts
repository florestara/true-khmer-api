import { z } from "zod";

const visibilitySchema = z.enum(["public", "members", "private"]);

export const profileResponseSchema = z
  .object({
    ok: z.literal(true),
    profile: z.object({
      user: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        displayName: z.string().nullable(),
        email: z.string(),
        gender: z.enum(["male", "female", "other"]),
        dateOfBirth: z.string().nullable(),
        occupation: z.string().nullable(),
        phoneNumber: z.string().nullable(),
        telegramUsername: z.string().nullable(),
      }),
      profile: z.object({
        avatarKey: z.string().nullable(),
        avatarUrl: z.string().nullable(),
        bio: z.string().nullable(),
        country: z
          .object({
            id: z.string(),
            name: z.string(),
            iso2: z.string().nullable(),
          })
          .nullable(),
        city: z
          .object({
            id: z.string(),
            name: z.string(),
          })
          .nullable(),
        visibility: z.object({
          profile: visibilitySchema,
          contact: visibilitySchema,
          socialLinks: visibilitySchema,
          contributions: visibilitySchema,
        }),
      }),
      skills: z.array(z.object({ id: z.string(), name: z.string() })),
      socialLinks: z.object({
        website: z.string().nullable(),
        linkedin: z.string().nullable(),
        twitter: z.string().nullable(),
        facebook: z.string().nullable(),
      }),
      progress: z.object({
        totalPoints: z.number(),
        rank: z.number().nullable(),
        tier: z
          .object({
            id: z.string(),
            slug: z.string(),
            name: z.string(),
            rankOrder: z.number(),
            minPoints: z.number(),
          })
          .nullable(),
      }),
    }),
  })
  .openapi("ProfileResponse");

export const updateProfileResponseSchema = profileResponseSchema.openapi(
  "UpdateProfileResponse",
);

export const profileErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
    issues: z.array(z.string()).optional(),
  })
  .openapi("ProfileErrorResponse");
