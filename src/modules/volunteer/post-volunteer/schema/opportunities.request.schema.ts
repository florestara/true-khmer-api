import { z } from "zod";

const VOLUNTEER_COVER_IMAGE_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const SAFE_UPLOAD_FILE_NAME = /^[A-Za-z0-9._-]+$/;

export const VOLUNTEER_COVER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionalText(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeStringList(values: string[] | null | undefined) {
  if (!values) {
    return [];
  }

  return values
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0);
}

const volunteerOpportunityContactSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("contact.email must be a valid email address")
      .max(320, "contact.email must be <= 320 characters"),
    telegramUsername: z
      .string()
      .nullish()
      .transform((value) => normalizeOptionalText(value))
      .transform((value) => {
        if (!value) {
          return null;
        }

        return value.startsWith("@") ? value.slice(1) : value;
      })
      .refine(
        (value) =>
          value === null || /^[A-Za-z0-9_]{5,32}$/.test(value),
        "contact.telegramUsername must be 5..32 characters and contain only letters, numbers, or underscores",
      ),
    phone: z
      .string()
      .nullish()
      .transform((value) => normalizeOptionalText(value))
      .refine(
        (value) =>
          value === null || /^(?=.*\d)[0-9+()\-.\s]{7,40}$/.test(value),
        "contact.phone must be 7..40 characters, contain at least one number, and use only spaces or +()-.",
      ),
    websiteUrl: z
      .string()
      .nullish()
      .transform((value) => normalizeOptionalText(value))
      .refine(
        (value) => {
          if (value === null) {
            return true;
          }

          try {
            const parsed = new URL(value);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
          } catch {
            return false;
          }
        },
        "contact.websiteUrl must be a valid http or https URL",
      ),
  })
  .openapi("VolunteerOpportunityContact");

const volunteerOpportunityRoleSchema = z
  .object({
    title: z
      .string()
      .transform((value) => normalizeText(value))
      .pipe(
        z
          .string()
          .min(1, "roles[].title is required and must be 1..255 characters")
          .max(255, "roles[].title is required and must be 1..255 characters"),
      ),
    commitmentLabel: z
      .string()
      .transform((value) => normalizeText(value))
      .pipe(
        z
          .string()
          .min(
            1,
            "roles[].commitmentLabel is required and must be 1..120 characters",
          )
          .max(
            120,
            "roles[].commitmentLabel is required and must be 1..120 characters",
          ),
      ),
    capacity: z
      .number()
      .int("roles[].capacity must be an integer")
      .min(1, "roles[].capacity must be at least 1")
      .max(100000, "roles[].capacity must be <= 100000"),
    responsibilities: z
      .array(z.string())
      .max(20, "roles[].responsibilities must contain at most 20 items")
      .nullish()
      .transform((value) => normalizeStringList(value))
      .superRefine((value, ctx) => {
        value.forEach((item, index) => {
          if (item.length > 240) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index],
              message:
                "roles[].responsibilities[] must be 1..240 characters",
            });
          }
        });
      }),
    requirements: z
      .array(z.string())
      .max(20, "roles[].requirements must contain at most 20 items")
      .nullish()
      .transform((value) => normalizeStringList(value))
      .superRefine((value, ctx) => {
        value.forEach((item, index) => {
          if (item.length > 240) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index],
              message: "roles[].requirements[] must be 1..240 characters",
            });
          }
        });
      }),
  })
  .openapi("VolunteerOpportunityRoleRequest");

export const presignVolunteerOpportunityCoverUploadSchema = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1, "fileName is required")
      .max(120, "fileName must be <= 120 characters")
      .regex(SAFE_UPLOAD_FILE_NAME, "fileName contains invalid characters"),
    contentType: z
      .string()
      .trim()
      .toLowerCase()
      .refine(
        (value) =>
          (
            VOLUNTEER_COVER_IMAGE_ALLOWED_CONTENT_TYPES as readonly string[]
          ).includes(value),
        "Unsupported image contentType",
      ),
    fileSize: z
      .number()
      .int("fileSize must be an integer")
      .positive("fileSize must be positive")
      .max(
        VOLUNTEER_COVER_IMAGE_MAX_BYTES,
        `fileSize must be <= ${VOLUNTEER_COVER_IMAGE_MAX_BYTES / (1024 * 1024)} MB`,
      ),
  })
  .openapi("PresignVolunteerOpportunityCoverUploadRequest");

const createVolunteerOpportunityBaseSchema = z
  .object({
    categoryId: z.string().uuid("categoryId must be a valid UUID"),
    locationId: z.string().uuid("locationId must be a valid UUID"),
    title: z
      .string()
      .transform((value) => normalizeText(value))
      .pipe(
        z
          .string()
          .min(1, "title is required and must be 1..255 characters")
          .max(255, "title is required and must be 1..255 characters"),
      ),
    overview: z
      .string()
      .transform((value) => normalizeText(value))
      .pipe(
        z
          .string()
          .min(1, "overview is required and must be 1..5000 characters")
          .max(5000, "overview is required and must be 1..5000 characters"),
      ),
    communityImpact: z
      .string()
      .nullish()
      .transform((value) => normalizeOptionalText(value))
      .refine(
        (value) => value === null || value.length <= 5000,
        "communityImpact must be <= 5000 characters",
      ),
    durationLabel: z
      .string()
      .transform((value) => normalizeText(value))
      .pipe(
        z
          .string()
          .min(1, "durationLabel is required and must be 1..120 characters")
          .max(120, "durationLabel is required and must be 1..120 characters"),
      ),
    commitmentLabel: z
      .string()
      .transform((value) => normalizeText(value))
      .pipe(
        z
          .string()
          .min(1, "commitmentLabel is required and must be 1..120 characters")
          .max(
            120,
            "commitmentLabel is required and must be 1..120 characters",
          ),
      ),
    applicationDeadline: z
      .string()
      .datetime("applicationDeadline must be a valid ISO datetime")
      .refine(
        (value) => Number.isFinite(Date.parse(value)),
        "applicationDeadline must be a valid ISO datetime",
      )
      .refine(
        (value) => Date.parse(value) > Date.now(),
        "applicationDeadline must be in the future",
      ),
    benefits: z
      .array(z.string())
      .max(12, "benefits must contain at most 12 items")
      .nullish()
      .transform((value) => normalizeStringList(value))
      .superRefine((value, ctx) => {
        value.forEach((item, index) => {
          if (item.length > 180) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index],
              message: "benefits[] must be 1..180 characters",
            });
          }
        });
      }),
    contact: volunteerOpportunityContactSchema,
    roles: z
      .array(volunteerOpportunityRoleSchema)
      .min(1, "roles must contain at least 1 role")
      .max(20, "roles must contain at most 20 roles"),
  })
  .openapi("CreateVolunteerOpportunityPayload");

export const createVolunteerOpportunitySchema =
  createVolunteerOpportunityBaseSchema
    .extend({
      coverImageKey: z
        .string()
        .trim()
        .min(1, "coverImageKey is required")
        .max(600, "coverImageKey must be <= 600 characters"),
    })
    .openapi("CreateVolunteerOpportunityRequest");

export type PresignVolunteerOpportunityCoverUploadPayload = z.infer<
  typeof presignVolunteerOpportunityCoverUploadSchema
>;

export type CreateVolunteerOpportunityBodyInput = z.infer<
  typeof createVolunteerOpportunitySchema
>;
