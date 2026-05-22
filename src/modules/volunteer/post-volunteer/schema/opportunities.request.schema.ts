import { z } from "zod";
import { VOLUNTEER_UUID_RE } from "../../lib/constants";

const VOLUNTEER_COVER_IMAGE_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const VOLUNTEER_APPLICATION_DOCUMENT_CONTENT_TYPE = "application/pdf";
const MIN_VOLUNTEER_APPLICATION_DOCUMENT_COUNT = 1;
const MAX_VOLUNTEER_APPLICATION_DOCUMENT_COUNT = 3;
const DEFAULT_VOLUNTEER_OPPORTUNITIES_PAGE_SIZE = 10;
const VOLUNTEER_COMMITMENT_LABELS = ["Light", "Regular", "Intensive"] as const;

export const VOLUNTEER_COVER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VOLUNTEER_APPLICATION_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

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

function isVolunteerCommitmentLabel(
  value: string,
): value is (typeof VOLUNTEER_COMMITMENT_LABELS)[number] {
  return VOLUNTEER_COMMITMENT_LABELS.includes(
    value as (typeof VOLUNTEER_COMMITMENT_LABELS)[number],
  );
}

function optionalDateTimeSchema(fieldName: string) {
  return z.string().nullish().transform((value, ctx) => {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (!z.iso.datetime().safeParse(trimmed).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldName} must be a valid ISO datetime`,
      });
      return z.NEVER;
    }

    return trimmed;
  });
}

function normalizeStringList(values: string[] | null | undefined) {
  if (!values) {
    return [];
  }

  return values
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0);
}

function normalizeVolunteerOpportunitiesCursorTimestamp(
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T")
    .replace(/\.(\d{3})\d+(?=[+-Z])/, ".$1")
    .replace(/([+-]\d{2})$/, "$1:00");
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return trimmed;
}

const cursorTimestampSchema = z.string().trim().transform((value, ctx) => {
  const normalized = normalizeVolunteerOpportunitiesCursorTimestamp(value);
  if (!normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "cursor timestamp must be a valid ISO datetime",
    });
    return z.NEVER;
  }

  return normalized;
});

const volunteerOpportunitiesPageCursorSchema = z.object({
  publishedAt: cursorTimestampSchema,
  createdAt: cursorTimestampSchema,
  id: z.string().trim().regex(VOLUNTEER_UUID_RE, "cursor.id must be a valid UUID"),
});

const savedVolunteerOpportunitiesPageCursorSchema = z.object({
  savedAt: cursorTimestampSchema,
  opportunityId: z
    .string()
    .trim()
    .regex(VOLUNTEER_UUID_RE, "cursor.opportunityId must be a valid UUID"),
});

export type VolunteerOpportunitiesPageCursor = z.infer<
  typeof volunteerOpportunitiesPageCursorSchema
>;

export type SavedVolunteerOpportunitiesPageCursor = z.infer<
  typeof savedVolunteerOpportunitiesPageCursorSchema
>;

export function encodeVolunteerOpportunitiesPageCursor(
  cursor: VolunteerOpportunitiesPageCursor,
): string {
  const publishedAt = normalizeVolunteerOpportunitiesCursorTimestamp(
    cursor.publishedAt,
  );
  const createdAt = normalizeVolunteerOpportunitiesCursorTimestamp(
    cursor.createdAt,
  );

  if (!publishedAt || !createdAt) {
    throw new Error(
      "Cannot encode volunteer opportunities page cursor with invalid timestamp",
    );
  }

  return Buffer.from(
    JSON.stringify({
      publishedAt,
      createdAt,
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeVolunteerOpportunitiesPageCursor(
  raw: string,
): VolunteerOpportunitiesPageCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const cursor = volunteerOpportunitiesPageCursorSchema.safeParse(parsed);
    return cursor.success ? cursor.data : null;
  } catch {
    return null;
  }
}

export function encodeSavedVolunteerOpportunitiesPageCursor(
  cursor: SavedVolunteerOpportunitiesPageCursor,
): string {
  const savedAt = normalizeVolunteerOpportunitiesCursorTimestamp(cursor.savedAt);

  if (!savedAt) {
    throw new Error(
      "Cannot encode saved volunteer opportunities page cursor with invalid savedAt",
    );
  }

  return Buffer.from(
    JSON.stringify({
      savedAt,
      opportunityId: cursor.opportunityId,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeSavedVolunteerOpportunitiesPageCursor(
  raw: string,
): SavedVolunteerOpportunitiesPageCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const cursor = savedVolunteerOpportunitiesPageCursorSchema.safeParse(parsed);
    return cursor.success ? cursor.data : null;
  } catch {
    return null;
  }
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

const updateVolunteerOpportunityRoleSchema = volunteerOpportunityRoleSchema
  .extend({
    id: z.string().uuid("roles[].id must be a valid UUID").optional(),
  })
  .openapi("UpdateVolunteerOpportunityRoleRequest");

export const presignVolunteerOpportunityCoverUploadSchema = z
  .object({
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

export const presignVolunteerApplicationDocumentUploadSchema = z
  .object({
    opportunityId: z
      .string()
      .trim()
      .regex(VOLUNTEER_UUID_RE, "opportunityId must be a valid UUID"),
    files: z
      .array(
        z.object({
          fileName: z
            .string()
            .trim()
            .min(1, "fileName is required")
            .max(255, "fileName must be <= 255 characters"),
          contentType: z
            .string()
            .trim()
            .toLowerCase()
            .refine(
              (value) => value === VOLUNTEER_APPLICATION_DOCUMENT_CONTENT_TYPE,
              "Supporting document must be a PDF",
            ),
          fileSize: z
            .number()
            .int("fileSize must be an integer")
            .positive("fileSize must be positive")
            .max(
              VOLUNTEER_APPLICATION_DOCUMENT_MAX_BYTES,
              `fileSize must be <= ${VOLUNTEER_APPLICATION_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB`,
            ),
        }),
      )
      .min(
        MIN_VOLUNTEER_APPLICATION_DOCUMENT_COUNT,
        `files must contain at least ${MIN_VOLUNTEER_APPLICATION_DOCUMENT_COUNT} files`,
      )
      .max(
        MAX_VOLUNTEER_APPLICATION_DOCUMENT_COUNT,
        `files must contain at most ${MAX_VOLUNTEER_APPLICATION_DOCUMENT_COUNT} files`,
      ),
  })
  .openapi("PresignVolunteerApplicationDocumentUploadRequest");

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
    startDate: optionalDateTimeSchema("startDate"),
    endDate: optionalDateTimeSchema("endDate"),
    commitmentLabel: z
      .string()
      .nullish()
      .transform((value) => normalizeOptionalText(value))
      .refine(
        (value) => value === null || isVolunteerCommitmentLabel(value),
        `commitmentLabel must be one of: ${VOLUNTEER_COMMITMENT_LABELS.join(", ")}`,
      ),
    commitmentDescription: z
      .string()
      .nullish()
      .transform((value) => normalizeOptionalText(value))
      .refine(
        (value) => value === null || value.length <= 2000,
        "commitmentDescription must be <= 2000 characters",
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
  .superRefine((value, ctx) => {
    if (
      value.startDate &&
      value.endDate &&
      Date.parse(value.endDate) < Date.parse(value.startDate)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "endDate must be on or after startDate",
      });
    }
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

const updateVolunteerOpportunityContactSchema = volunteerOpportunityContactSchema
  .partial()
  .strict()
  .openapi("UpdateVolunteerOpportunityContactRequest");

export const updateVolunteerOpportunitySchema = z
  .object({
    categoryId: z.string().uuid("categoryId must be a valid UUID").optional(),
    locationId: z.string().uuid("locationId must be a valid UUID").optional(),
    title: z
      .string()
      .transform((value) => normalizeText(value))
      .pipe(
        z
          .string()
          .min(1, "title must be 1..255 characters")
          .max(255, "title must be 1..255 characters"),
      )
      .optional(),
    overview: z
      .string()
      .transform((value) => normalizeText(value))
      .pipe(
        z
          .string()
          .min(1, "overview must be 1..5000 characters")
          .max(5000, "overview must be 1..5000 characters"),
      )
      .optional(),
    communityImpact: z
      .string()
      .nullish()
      .transform((value) => normalizeOptionalText(value))
      .refine(
        (value) => value === null || value.length <= 5000,
        "communityImpact must be <= 5000 characters",
      )
      .optional(),
    startDate: optionalDateTimeSchema("startDate").optional(),
    endDate: optionalDateTimeSchema("endDate").optional(),
    commitmentLabel: z
      .string()
      .nullish()
      .transform((value) => normalizeOptionalText(value))
      .refine(
        (value) => value === null || isVolunteerCommitmentLabel(value),
        `commitmentLabel must be one of: ${VOLUNTEER_COMMITMENT_LABELS.join(", ")}`,
      )
      .optional(),
    commitmentDescription: z
      .string()
      .nullish()
      .transform((value) => normalizeOptionalText(value))
      .refine(
        (value) => value === null || value.length <= 2000,
        "commitmentDescription must be <= 2000 characters",
      )
      .optional(),
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
      )
      .optional(),
    coverImageKey: z
      .string()
      .trim()
      .min(1, "coverImageKey is required")
      .max(600, "coverImageKey must be <= 600 characters")
      .optional(),
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
      })
      .optional(),
    contact: updateVolunteerOpportunityContactSchema.optional(),
    roles: z
      .array(updateVolunteerOpportunityRoleSchema)
      .min(1, "roles must contain at least 1 role")
      .max(20, "roles must contain at most 20 roles")
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const contactFieldCount =
      value.contact === undefined ? 0 : Object.keys(value.contact).length;
    const hasPatchField =
      Object.keys(value).some((key) => key !== "contact") ||
      contactFieldCount > 0;

    if (!hasPatchField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one volunteer opportunity field is required",
      });
    }

    if (value.contact !== undefined && contactFieldCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contact"],
        message: "At least one contact field is required",
      });
    }

    if (
      value.startDate &&
      value.endDate &&
      Date.parse(value.endDate) < Date.parse(value.startDate)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "endDate must be on or after startDate",
      });
    }

    if (value.roles) {
      const seenRoleIds = new Set<string>();
      value.roles.forEach((role, index) => {
        if (!role.id) {
          return;
        }

        if (seenRoleIds.has(role.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["roles", index, "id"],
            message: "roles[].id must not contain duplicates",
          });
          return;
        }

        seenRoleIds.add(role.id);
      });
    }
  })
  .openapi("UpdateVolunteerOpportunityRequest");

const volunteerApplicationSupportingDocumentsSchema = z
  .array(
    z.object({
      name: z
        .string()
        .trim()
        .min(1, "supportingDocuments[].name is required")
        .max(255, "supportingDocuments[].name must be <= 255 characters"),
      key: z
        .string()
        .trim()
        .min(1, "supportingDocuments[].key is required")
        .max(600, "supportingDocuments[].key must be <= 600 characters"),
    }),
  )
  .max(
    MAX_VOLUNTEER_APPLICATION_DOCUMENT_COUNT,
    `supportingDocuments must contain at most ${MAX_VOLUNTEER_APPLICATION_DOCUMENT_COUNT} files`,
  )
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.forEach((item, index) => {
      if (seen.has(item.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: "supportingDocuments[] must not contain duplicate keys",
        });
        return;
      }

      seen.add(item.key);
    });
  })
  .default([]);

const volunteerApplicationBaseSchema = z.object({
  availability: z
    .string()
    .transform((value) => normalizeText(value))
    .pipe(
      z
        .string()
        .min(1, "availability is required and must be 1..500 characters")
        .max(500, "availability is required and must be 1..500 characters"),
    ),
  relevantExperience: z
    .string()
    .transform((value) => normalizeText(value))
    .pipe(
      z
        .string()
        .min(1, "relevantExperience is required and must be 1..5000 characters")
        .max(
          5000,
          "relevantExperience is required and must be 1..5000 characters",
        ),
    ),
  supportingDocuments: volunteerApplicationSupportingDocumentsSchema,
  topPickRoleId: z
    .string()
    .uuid("topPickRoleId must be a valid UUID")
    .nullish()
    .transform((value) => value ?? null),
});

export const createVolunteerApplicationSchema = volunteerApplicationBaseSchema
  .extend({
    roleId: z.string().uuid("roleId must be a valid UUID"),
  })
  .superRefine((value, ctx) => {
    if (value.topPickRoleId && value.topPickRoleId !== value.roleId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["topPickRoleId"],
        message: "topPickRoleId must match roleId",
      });
    }
  })
  .openapi("CreateVolunteerApplicationRequest");

export const createVolunteerApplicationBatchSchema = volunteerApplicationBaseSchema
  .extend({
    roleIds: z
      .array(z.string().uuid("roleIds[] must be a valid UUID"))
      .min(1, "roleIds must contain at least 1 role")
      .max(20, "roleIds must contain at most 20 roles")
      .superRefine((value, ctx) => {
        const seen = new Set<string>();
        value.forEach((roleId, index) => {
          if (seen.has(roleId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index],
              message: "roleIds[] must not contain duplicate roles",
            });
            return;
          }

          seen.add(roleId);
        });
      }),
  })
  .superRefine((value, ctx) => {
    if (value.topPickRoleId && !value.roleIds.includes(value.topPickRoleId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["topPickRoleId"],
        message: "topPickRoleId must be one of roleIds",
      });
    }
  })
  .openapi("CreateVolunteerApplicationBatchRequest");

export type PresignVolunteerOpportunityCoverUploadPayload = z.infer<
  typeof presignVolunteerOpportunityCoverUploadSchema
>;

export type PresignVolunteerApplicationDocumentUploadPayload = z.infer<
  typeof presignVolunteerApplicationDocumentUploadSchema
>;

export const getVolunteerOpportunitiesQuerySchema = z
  .object({
    categoryId: z
      .string()
      .trim()
      .regex(VOLUNTEER_UUID_RE, "categoryId must be a valid UUID")
      .optional(),
    locationId: z
      .string()
      .trim()
      .regex(VOLUNTEER_UUID_RE, "locationId must be a valid UUID")
      .optional(),
    search: z
      .string()
      .trim()
      .max(300, "search must be <= 300 characters")
      .optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1, "limit must be >= 1")
      .default(DEFAULT_VOLUNTEER_OPPORTUNITIES_PAGE_SIZE),
    cursor: z.string().optional().transform((value, ctx) => {
      if (value === undefined) {
        return undefined;
      }

      const cursor = decodeVolunteerOpportunitiesPageCursor(value);
      if (!cursor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "cursor must be a valid pagination cursor",
        });
        return z.NEVER;
      }

      return cursor;
    }),
  })
  .transform((value) => ({
    categoryId: value.categoryId,
    locationId: value.locationId,
    search: value.search,
    limit: value.limit,
    cursor: value.cursor,
  }))
  .openapi("GetVolunteerOpportunitiesQuery");

export const getSavedVolunteerOpportunitiesQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1, "limit must be >= 1")
      .default(DEFAULT_VOLUNTEER_OPPORTUNITIES_PAGE_SIZE),
    cursor: z.string().optional().transform((value, ctx) => {
      if (value === undefined) {
        return undefined;
      }

      const cursor = decodeSavedVolunteerOpportunitiesPageCursor(value);
      if (!cursor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "cursor must be a valid pagination cursor",
        });
        return z.NEVER;
      }

      return cursor;
    }),
  })
  .transform((value) => ({
    limit: value.limit,
    cursor: value.cursor,
  }))
  .openapi("GetSavedVolunteerOpportunitiesQuery");

export const getVolunteerOpportunityParamsSchema = z
  .object({
    opportunityId: z
      .string()
      .trim()
      .regex(VOLUNTEER_UUID_RE, "opportunityId must be a valid UUID"),
  })
  .openapi("GetVolunteerOpportunityParams");

export type GetVolunteerOpportunitiesQuery = z.infer<
  typeof getVolunteerOpportunitiesQuerySchema
>;

export type GetSavedVolunteerOpportunitiesQuery = z.infer<
  typeof getSavedVolunteerOpportunitiesQuerySchema
>;

export type GetVolunteerOpportunityParams = z.infer<
  typeof getVolunteerOpportunityParamsSchema
>;

export type CreateVolunteerOpportunityBodyInput = z.infer<
  typeof createVolunteerOpportunitySchema
>;

export type UpdateVolunteerOpportunityBodyInput = z.infer<
  typeof updateVolunteerOpportunitySchema
>;

export type CreateVolunteerApplicationBodyInput = z.infer<
  typeof createVolunteerApplicationSchema
>;

export type CreateVolunteerApplicationBatchBodyInput = z.infer<
  typeof createVolunteerApplicationBatchSchema
>;
