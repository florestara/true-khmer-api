import { z } from "zod";
import { createCleanNameSchema } from "../../../utils/validation/name";
import { UUID_RE } from "../../../lib/constant";

const uuidSchema = z.string().trim().regex(UUID_RE, "must be a valid UUID");
const visibilitySchema = z.enum(["public", "members", "private"]);
const genderSchema = z.enum(["male", "female", "other"]);

function isValidDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD")
  .refine(isValidDateOnly, {
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
  .union([
    z.string().trim().url().max(500),
    z.string().trim().length(0),
    z.null(),
  ])
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
  .transform((skills) => {
    const uniqueSkills = new Map<string, string>();

    for (const skill of skills) {
      const normalized = skill.toLowerCase();
      if (!uniqueSkills.has(normalized)) {
        uniqueSkills.set(normalized, skill);
      }
    }

    return Array.from(uniqueSkills.values());
  });

export const updateProfileSchema = z
  .object({
    firstName: createCleanNameSchema({
      label: "firstName",
      maxLength: 100,
    }).optional(),
    lastName: createCleanNameSchema({
      label: "lastName",
      maxLength: 100,
    }).optional(),
    gender: genderSchema.optional(),
    dateOfBirth: z.union([dateOnlySchema, z.null()]).optional(),
    occupation: nullableTrimmedText(120, "occupation").optional(),
    phoneNumber: phoneNumberSchema.optional(),
    telegramUsername: telegramUsernameSchema.optional(),
    bio: nullableTrimmedText(1000, "bio").optional(),
    countryId: uuidSchema.optional(),
    cityId: uuidSchema.optional(),
    avatarKey: z
      .union([z.string().trim().min(1).max(600), z.null()])
      .optional(),
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
