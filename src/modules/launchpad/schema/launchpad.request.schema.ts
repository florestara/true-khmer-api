import { z } from "zod";
import { FORUM_UUID_RE } from "../../forum/lib/constants";

const LAUNCHPAD_LOGO_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const LAUNCHPAD_DOCUMENT_ALLOWED_CONTENT_TYPE = "application/pdf";
export const LAUNCHPAD_LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const LAUNCHPAD_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

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

export const presignLaunchpadImageUploadSchema = z
  .object({
    contentType: z
      .string()
      .trim()
      .toLowerCase()
      .refine(
        (value) =>
          (LAUNCHPAD_LOGO_ALLOWED_CONTENT_TYPES as readonly string[]).includes(
            value,
          ),
        "Unsupported image contentType",
      ),
    fileSize: z
      .number()
      .int("fileSize must be an integer")
      .positive("fileSize must be positive")
      .max(
        LAUNCHPAD_LOGO_MAX_BYTES,
        `fileSize must be <= ${LAUNCHPAD_LOGO_MAX_BYTES / (1024 * 1024)} MB`,
      ),
  })
  .openapi("PresignLaunchpadImageUploadRequest");

export const presignLaunchpadDocumentUploadSchema = z
  .object({
    contentType: z
      .string()
      .trim()
      .toLowerCase()
      .refine(
        (value) => value === LAUNCHPAD_DOCUMENT_ALLOWED_CONTENT_TYPE,
        "document must be a PDF",
      ),
    fileSize: z
      .number()
      .int("fileSize must be an integer")
      .positive("fileSize must be positive")
      .max(
        LAUNCHPAD_DOCUMENT_MAX_BYTES,
        `fileSize must be <= ${LAUNCHPAD_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB`,
      ),
  })
  .openapi("PresignLaunchpadDocumentUploadRequest");

export const createLaunchpadRequestSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "name is required")
      .max(120, "name must be at most 120 characters"),
    description: z.string().trim().nullable(),
    categoryId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "categoryId is required and must be a valid UUID"),
    cityId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "cityId is required and must be a valid UUID"),
    deadline: z
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
    logoKey: z
      .string()
      .trim()
      .min(1, "logoKey is required")
      .max(600, "logoKey must be <= 600 characters"),
    coverKey: z
      .string()
      .trim()
      .min(1, "coverKey is required")
      .max(600, "coverKey must be <= 600 characters"),
    role: z.array(
      z.object({
        name: z
          .string()
          .trim()
          .min(1, "role name is required")
          .max(100, "role name must be <= 100 characters"),
        description: z.string().trim().nullable(),
        capacity: z
          .number()
          .int("capacity must be an integer")
          .positive("capacity must be positive")
          .max(1000, "capacity must be <= 1000")
          .default(1),
      }),
    ),
    materialDocumentKey: z
      .array(
        z
          .string()
          .trim()
          .min(1, "materialDocumentKey is required")
          .max(600, "materialDocumentKey must be <= 600 characters"),
      )
      .min(1, "At least one materialDocumentKey is required")
      .max(5, "materialDocumentKey can have at most 5 documents"),
    phoneNumber: z
      .string()
      .transform((value) => normalizeText(value))
      .refine(
        (value) =>
          value === null || /^(?=.*\d)[0-9+()\-.\s]{7,40}$/.test(value),
        "contact.phone must be 7..40 characters, contain at least one number, and use only spaces or +()-.",
      ),
    email: z
      .string()
      .trim()
      .email("email must be a valid email address")
      .max(320, "email must be <= 320 characters"),
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
        (value) => value === null || /^[A-Za-z0-9_]{5,32}$/.test(value),
        "telegramUsername must be 5..32 characters and contain only letters, numbers, or underscores",
      ),
  })
  .openapi("CreateLaunchpadRequest");

export type CreateLaunchpadRequestInput = z.infer<
  typeof createLaunchpadRequestSchema
>;

export type PresignLaunchpadImageUploadPayload = z.infer<
  typeof presignLaunchpadImageUploadSchema
>;

export type PresignLaunchpadDocumentUploadPayload = z.infer<
  typeof presignLaunchpadDocumentUploadSchema
>;
