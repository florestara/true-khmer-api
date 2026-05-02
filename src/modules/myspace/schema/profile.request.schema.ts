import { z } from "zod";
import { createCleanNameSchema } from "../../../utils/validation/name";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuidSchema = z.string().trim().regex(UUID_RE, "must be a valid UUID");
const visibilitySchema = z.enum(["public", "members", "private"]);
const genderSchema = z.enum(["male", "female", "other"]);
const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "dateOfBirth must be a valid date",
  });

const nullableTrimmedText = (maxLength: number, label: string) =>
  z
    .union([z.string().trim().max(maxLength, `${label} is too long`), z.null()])
    .transform((value) => {
      if (value === null) return null;
      const normalized = value.replace(/\s+/g, " ").trim();
      return normalized.length > 0 ? normalized : null;
    });

const phoneNumberSchema = z
  .union([z.string().trim(), z.null()])
  .refine(
    (value) =>
      value === null ||
      value.length === 0 ||
      /^(?=.*\d)[0-9+()\-. ]{7,20}$/.test(value),
    "phoneNumber must be 7..20 characters, contain at least one digit, and use only digits, spaces, or + ( ) - .",
  )
  .transform((value) => {
    if (value === null) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  });

const telegramUsernameSchema = z
  .union([z.string().trim(), z.null()])
  .refine(
    (value) =>
      value === null ||
      value.length === 0 ||
      /^[A-Za-z0-9_]{5,32}$/.test(value.replace(/^@/, "")),
    "telegramUsername must be 5..32 characters and contain only letters, numbers, or underscores",
  )
  .transform((value) => {
    if (value === null) return null;
    const normalized = value.trim().replace(/^@/, "");
    return normalized.length > 0 ? normalized : null;
  });

const urlFieldSchema = z
  .union([z.string().trim().url().max(500), z.string().trim().length(0), z.null()])
  .transform((value) => {
    if (value === null || value.length === 0) return null;
    return value;
  });

const skillsSchema = z
  .array(
    z
      .string()
      .trim()
      .transform((value) => value.replace(/\s+/g, " "))
      .pipe(z.string().min(1, "skill cannot be empty").max(80)),
  )
  .max(20, "skills must contain at most 20 items")
  .transform((skills) =>
    Array.from(new Map(skills.map((skill) => [skill.toLowerCase(), skill])).values()),
  );

export const updateProfileSchema = z
  .object({
    firstName: createCleanNameSchema({ label: "firstName", maxLength: 100 }).optional(),
    lastName: createCleanNameSchema({ label: "lastName", maxLength: 100 }).optional(),
    gender: genderSchema.optional(),
    dateOfBirth: z.union([dateOnlySchema, z.null()]).optional(),
    occupation: nullableTrimmedText(120, "occupation").optional(),
    phoneNumber: phoneNumberSchema.optional(),
    telegramUsername: telegramUsernameSchema.optional(),
    bio: nullableTrimmedText(1000, "bio").optional(),
    countryId: uuidSchema.optional(),
    cityId: uuidSchema.optional(),
    avatarKey: z.union([z.string().trim().min(1).max(600), z.null()]).optional(),
    skills: skillsSchema.optional(),
    socialLinks: z
      .object({
        website: urlFieldSchema.optional(),
        linkedin: urlFieldSchema.optional(),
        twitter: urlFieldSchema.optional(),
        facebook: urlFieldSchema.optional(),
      })
      .strict()
      .optional(),
    visibility: z
      .object({
        profile: visibilitySchema.optional(),
        contact: visibilitySchema.optional(),
        socialLinks: visibilitySchema.optional(),
        contributions: visibilitySchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (Object.keys(payload).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one profile field is required",
      });
    }

    const hasCountry = payload.countryId !== undefined;
    const hasCity = payload.cityId !== undefined;
    if (hasCountry !== hasCity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "countryId and cityId must be updated together",
      });
    }
  })
  .openapi("UpdateProfileRequest");

export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>;
