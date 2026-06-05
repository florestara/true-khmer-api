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
const LAUNCHPAD_LISTING_FILTERS = [
  "recentlyAdded",
  "startingSoon",
  "mostSpotsAvailable",
] as const;

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
    materialDocumentName: z
      .array(
        z
          .string()
          .trim()
          .min(1, "materialDocumentName is required")
          .max(255, "materialDocumentName must be <= 255 characters"),
      )
      .min(1, "At least one materialDocumentName is required")
      .max(5, "materialDocumentName can have at most 5 documents"),
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
  .superRefine((data, ctx) => {
    if (data.materialDocumentKey.length !== data.materialDocumentName.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "materialDocumentKey and materialDocumentName must have the same number of entries",
        path: ["materialDocumentName"],
      });
    }
  })
  .openapi("CreateLaunchpadRequest");

const updateLaunchpadRoleSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "role.id must be a valid UUID")
      .optional(),
    name: z
      .string()
      .trim()
      .min(1, "role name is required")
      .max(100, "role name must be <= 100 characters"),
    description: z
      .string()
      .nullish()
      .transform((value) => normalizeOptionalText(value)),
    capacity: z
      .number()
      .int("capacity must be an integer")
      .positive("capacity must be positive")
      .max(1000, "capacity must be <= 1000")
      .default(1),
  })
  .openapi("UpdateLaunchpadRoleRequest");

export const updateLaunchpadRequestSchema = z
  .object({
    name: z
      .string()
      .transform((value) => normalizeText(value))
      .pipe(
        z
          .string()
          .min(1, "name must be 1..120 characters")
          .max(120, "name must be 1..120 characters"),
      )
      .optional(),
    description: z
      .string()
      .nullish()
      .transform((value) => normalizeOptionalText(value))
      .optional(),
    categoryId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "categoryId must be a valid UUID")
      .optional(),
    cityId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "cityId must be a valid UUID")
      .optional(),
    deadline: z
      .string()
      .datetime("deadline must be a valid ISO datetime")
      .refine(
        (value) => Date.parse(value) > Date.now(),
        "deadline must be in the future",
      )
      .optional(),
    logoKey: z
      .string()
      .trim()
      .min(1, "logoKey is required")
      .max(255, "logoKey must be <= 255 characters")
      .optional(),
    coverKey: z
      .string()
      .trim()
      .min(1, "coverKey is required")
      .max(255, "coverKey must be <= 255 characters")
      .optional(),
    role: z
      .array(updateLaunchpadRoleSchema)
      .min(1, "At least one role is required")
      .optional(),
    materialDocumentKey: z
      .array(
        z
          .string()
          .trim()
          .min(1, "materialDocumentKey is required")
          .max(255, "materialDocumentKey must be <= 255 characters"),
      )
      .min(1, "At least one materialDocumentKey is required")
      .max(5, "materialDocumentKey can have at most 5 documents")
      .optional(),
    materialDocumentName: z
      .array(
        z
          .string()
          .trim()
          .min(1, "materialDocumentName is required")
          .max(255, "materialDocumentName must be <= 255 characters"),
      )
      .min(1, "At least one materialDocumentName is required")
      .max(5, "materialDocumentName can have at most 5 documents")
      .optional(),
    phoneNumber: z
      .string()
      .transform((value) => normalizeText(value))
      .refine(
        (value) => /^(?=.*\d)[0-9+()\-.\s]{7,20}$/.test(value),
        "phoneNumber must be 7..20 characters, contain at least one digit, and use only digits, spaces, or + ( ) - .",
      )
      .optional(),
    email: z
      .string()
      .trim()
      .email("email must be a valid email address")
      .max(255, "email must be <= 255 characters")
      .optional(),
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
      )
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one launchpad field is required",
      });
    }

    if (
      (data.materialDocumentKey === undefined) !==
      (data.materialDocumentName === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "materialDocumentKey and materialDocumentName must be updated together",
        path: ["materialDocumentName"],
      });
    }

    if (
      data.materialDocumentKey &&
      data.materialDocumentName &&
      data.materialDocumentKey.length !== data.materialDocumentName.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "materialDocumentKey and materialDocumentName must have the same number of entries",
        path: ["materialDocumentName"],
      });
    }

    if (data.role) {
      const seenRoleIds = new Set<string>();
      data.role.forEach((role, index) => {
        if (!role.id) {
          return;
        }

        if (seenRoleIds.has(role.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["role", index, "id"],
            message: "role.id must not contain duplicates",
          });
          return;
        }

        seenRoleIds.add(role.id);
      });
    }
  })
  .openapi("UpdateLaunchpadRequest");

export const getLaunchpadQuerySchema = z.object({
  launchpadId: z
    .string()
    .trim()
    .regex(FORUM_UUID_RE, "launchpadId is required and must be a valid UUID"),
});

const launchpadSortBySchema = z.enum(["newest", "oldest"]).openapi({
  description: "Launchpad ordering. Allowed values: newest, oldest.",
  example: "newest",
});
const launchpadListingFilterSchema = z
  .enum(LAUNCHPAD_LISTING_FILTERS)
  .default("recentlyAdded")
  .openapi({
    description:
      "Launchpad listing filter. startingSoon means deadline is within the next 3 days.",
    example: "recentlyAdded",
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
    filter: z.enum(LAUNCHPAD_LISTING_FILTERS).default("recentlyAdded"),
    availableSpots: z.number().int().optional(),
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
  const normalizedTimestamp = normalizeLaunchpadCursorTimestamp(
    cursor.createdAt,
  );
  if (!normalizedTimestamp) {
    throw new Error(
      "Cannot encode launchpad page cursor with invalid createdAt",
    );
  }

  return Buffer.from(
    JSON.stringify({
      sortBy: cursor.sortBy,
      filter: cursor.filter,
      createdAt: normalizedTimestamp,
      id: cursor.id,
      ...(cursor.availableSpots !== undefined
        ? { availableSpots: cursor.availableSpots }
        : {}),
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
    filter: launchpadListingFilterSchema,
    cursor: z.string().optional().openapi({
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
    cityId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "cityId must be a valid UUID")
      .optional()
      .openapi({
        description: "Filter launchpads by city ID",
      }),
    search: z
      .string()
      .trim()
      .min(1, "search must be at least 1 character")
      .max(120, "search must be at most 120 characters")
      .optional()
      .openapi({
        description: "Search launchpads by name (case-insensitive)",
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

    if (decodedCursor && decodedCursor.filter !== value.filter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor filter does not match filter",
        path: ["cursor"],
      });
    }
  })
  .transform((value) => ({
    limit: value.limit,
    sortBy: value.sortBy,
    filter: value.filter,
    cursor: value.cursor
      ? (decodeLaunchpadPageCursor(value.cursor) as LaunchpadPageCursor)
      : undefined,
    categoryId: value.categoryId,
    cityId: value.cityId,
    search: value.search,
  }))
  .openapi("GetLaunchpadQueryList");

export type GetLaunchpadQueryInput = z.infer<typeof getLaunchpadQuerySchema>;

export type GetLaunchpadQueryListInput = z.infer<
  typeof getLaunchpadQueryListSchema
>;

export type CreateLaunchpadRequestInput = z.infer<
  typeof createLaunchpadRequestSchema
>;

export type UpdateLaunchpadRequestInput = z.infer<
  typeof updateLaunchpadRequestSchema
>;

export type PresignLaunchpadImageUploadPayload = z.infer<
  typeof presignLaunchpadImageUploadSchema
>;

export type PresignLaunchpadDocumentUploadPayload = z.infer<
  typeof presignLaunchpadDocumentUploadSchema
>;
