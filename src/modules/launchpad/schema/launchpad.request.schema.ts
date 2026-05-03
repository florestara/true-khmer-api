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

const MAX_LAUNCHPADS_PAGE_SIZE = 50;
const DEFAULT_LAUNCHPADS_PAGE_SIZE = 20;

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
    description: z.string().trim().nullish(),
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
      .datetime("deadline must be a valid ISO datetime")
      .refine(
        (value) => Date.parse(value) > Date.now(),
        "deadline must be in the future",
      ),
    logoKey: z
      .string()
      .trim()
      .min(1, "logoKey is required")
      .max(255, "logoKey must be <= 255 characters"),
    coverKey: z
      .string()
      .trim()
      .min(1, "coverKey is required")
      .max(255, "coverKey must be <= 255 characters"),
    role: z
      .array(
        z.object({
          name: z
            .string()
            .trim()
            .min(1, "role name is required")
            .max(100, "role name must be <= 100 characters"),
          description: z.string().trim().nullish(),
          capacity: z
            .number()
            .int("capacity must be an integer")
            .positive("capacity must be positive")
            .max(1000, "capacity must be <= 1000")
            .default(1),
        }),
      )
      .min(1, "At least one role is required"),
    materialDocumentKey: z
      .array(
        z
          .string()
          .trim()
          .min(1, "materialDocumentKey is required")
          .max(255, "materialDocumentKey must be <= 255 characters"),
      )
      .min(1, "At least one materialDocumentKey is required")
      .max(5, "materialDocumentKey can have at most 5 documents"),
    phoneNumber: z
      .string()
      .transform((value) => normalizeText(value))
      .refine(
        (value) => /^(?=.*\d)[0-9+()\-.\s]{7,20}$/.test(value),
        "phoneNumber must be 7..20 characters, contain at least one digit, and use only digits, spaces, or + ( ) - .",
      ),
    email: z
      .string()
      .trim()
      .email("email must be a valid email address")
      .max(255, "email must be <= 255 characters"),
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

export const getLaunchpadQuerySchema = z.object({
  launchpadId: z
    .string()
    .trim()
    .regex(FORUM_UUID_RE, "launchpadId is required and must be a valid UUID"),
});

const launchpadSortBySchema = z
  .enum(["newest", "oldest"])
  .openapi({
    description: "Launchpad ordering. Allowed values: newest, oldest.",
    example: "newest",
  });

export type LaunchpadSortBy = z.infer<typeof launchpadSortBySchema>;

const cursorCreatedAtSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeLaunchpadCursorTimestamp(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor.createdAt must be a valid ISO datetime",
      });
      return z.NEVER;
    }
    return normalized;
  });

function buildChronologicalLaunchpadPageCursorSchema<
  TSortBy extends "newest" | "oldest",
>(sortBy: TSortBy) {
  return z.object({
    sortBy: z.literal(sortBy),
    createdAt: cursorCreatedAtSchema,
    id: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "cursor.id must be a valid UUID"),
  });
}

const newestLaunchpadPageCursorSchema =
  buildChronologicalLaunchpadPageCursorSchema("newest");
const oldestLaunchpadPageCursorSchema =
  buildChronologicalLaunchpadPageCursorSchema("oldest");

const launchpadPageCursorSchema = z.discriminatedUnion("sortBy", [
  newestLaunchpadPageCursorSchema,
  oldestLaunchpadPageCursorSchema,
]);

export type LaunchpadPageCursor = z.infer<typeof launchpadPageCursorSchema>;

export function encodeLaunchpadPageCursor(cursor: LaunchpadPageCursor): string {
  const normalizedTimestamp = normalizeLaunchpadCursorTimestamp(cursor.createdAt);
  if (!normalizedTimestamp) {
    throw new Error("Cannot encode launchpad page cursor with invalid createdAt");
  }

  return Buffer.from(
    JSON.stringify({
      sortBy: cursor.sortBy,
      createdAt: normalizedTimestamp,
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeLaunchpadPageCursor(raw: string): LaunchpadPageCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const cursor = launchpadPageCursorSchema.safeParse(parsed);
    return cursor.success ? cursor.data : null;
  } catch {
    return null;
  }
}

function normalizeLaunchpadCursorTimestamp(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(" ", "T")
    .replace(/\.(\d{3})\d+(?=[+-Z])/, ".$1")
    .replace(/([+-]\d{2})$/, "$1:00");
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export const getLaunchpadQueryListSchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1, "limit must be between 1 and 50")
      .max(MAX_LAUNCHPADS_PAGE_SIZE, "limit must be between 1 and 50")
      .default(DEFAULT_LAUNCHPADS_PAGE_SIZE),
    sortBy: launchpadSortBySchema.default("newest"),
    cursor: z
      .string()
      .optional()
      .openapi({
        description:
          "Opaque pagination cursor returned by a previous launchpads list response.",
      }),
    categoryId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "categoryId must be a valid UUID")
      .optional()
      .openapi({
        description: "Filter launchpads by category ID",
      }),
  })
  .superRefine((value, ctx) => {
    const decodedCursor = value.cursor
      ? decodeLaunchpadPageCursor(value.cursor)
      : undefined;

    if (value.cursor && !decodedCursor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor must be a valid pagination cursor",
        path: ["cursor"],
      });
      return;
    }

    if (decodedCursor && decodedCursor.sortBy !== value.sortBy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor sort does not match sortBy",
        path: ["cursor"],
      });
    }
  })
  .transform((value) => ({
    limit: value.limit,
    sortBy: value.sortBy,
    cursor: value.cursor
      ? (decodeLaunchpadPageCursor(value.cursor) as LaunchpadPageCursor)
      : undefined,
    categoryId: value.categoryId,
  }))
  .openapi("GetLaunchpadQueryList");

export type GetLaunchpadQueryInput = z.infer<typeof getLaunchpadQuerySchema>;

export type GetLaunchpadQueryListInput = z.infer<
  typeof getLaunchpadQueryListSchema
>;

export type CreateLaunchpadRequestInput = z.infer<
  typeof createLaunchpadRequestSchema
>;

export type PresignLaunchpadImageUploadPayload = z.infer<
  typeof presignLaunchpadImageUploadSchema
>;

export type PresignLaunchpadDocumentUploadPayload = z.infer<
  typeof presignLaunchpadDocumentUploadSchema
>;
