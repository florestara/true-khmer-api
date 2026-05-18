import { z } from "zod";
import { UUID_RE } from "../../../lib/constant";

const DEFAULT_MANAGE_POSTINGS_PAGE_SIZE = 6;
const MAX_MANAGE_POSTINGS_PAGE_SIZE = 50;

export const managePostingTypeSchema = z
  .enum(["all", "volunteer", "projects"])
  .openapi("ManagePostingType");

export const managePostingSourceParamSchema = z
  .enum(["volunteer", "projects"])
  .openapi("ManagePostingSourceParam");

export const managePostingFilterSchema = z
  .enum(["all", "active", "draft", "closed", "completed", "filled"])
  .openapi("ManagePostingFilter");

export const getManagePostingsQuerySchema = z
  .object({
    type: managePostingTypeSchema.default("all"),
    filter: managePostingFilterSchema.default("all"),
    page: z.coerce
      .number()
      .int()
      .min(1, "page must be >= 1")
      .default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1, "limit must be between 1 and 50")
      .max(MAX_MANAGE_POSTINGS_PAGE_SIZE, "limit must be between 1 and 50")
      .default(DEFAULT_MANAGE_POSTINGS_PAGE_SIZE),
    search: z
      .string()
      .trim()
      .max(300, "search must be <= 300 characters")
      .optional(),
  })
  .openapi("GetManagePostingsQuery");

export const managePostingApplicantRangeSchema = z
  .enum(["today", "this_week", "all_time"])
  .openapi("ManagePostingApplicantRange");

export const getManagePostingDetailParamSchema = z
  .object({
    sourceType: managePostingSourceParamSchema,
    postingId: z
      .string()
      .trim()
      .regex(UUID_RE, "postingId must be a valid UUID"),
  })
  .openapi("GetManagePostingDetailParam");

export const getManagePostingApplicationParamSchema = z
  .object({
    sourceType: managePostingSourceParamSchema,
    postingId: z
      .string()
      .trim()
      .regex(UUID_RE, "postingId must be a valid UUID"),
    applicationId: z
      .string()
      .trim()
      .regex(UUID_RE, "applicationId must be a valid UUID"),
  })
  .openapi("GetManagePostingApplicationParam");

export const managePostingStatusActionSchema = z
  .enum(["under_review", "approve", "decline"])
  .openapi("ManagePostingStatusAction");

export const changeManagePostingApplicationStatusParamSchema =
  getManagePostingApplicationParamSchema
    .extend({
      statusAction: managePostingStatusActionSchema,
    })
    .openapi("ChangeManagePostingApplicationStatusParam");

export const getManagePostingDetailQuerySchema = z
  .object({
    range: managePostingApplicantRangeSchema.default("all_time"),
    search: z
      .string()
      .trim()
      .max(300, "search must be <= 300 characters")
      .optional(),
    page: z.coerce.number().int().min(1, "page must be >= 1").default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1, "limit must be between 1 and 50")
      .max(50, "limit must be between 1 and 50")
      .default(10),
  })
  .openapi("GetManagePostingDetailQuery");

export const managePostingStatusSchema = z
  .enum(["ACTIVE", "DRAFT", "CLOSED", "COMPLETED"])
  .openapi("ManagePostingStatus");

export const managePostingApplicantStatusSchema = z
  .enum([
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "DECLINED",
    "CONFIRMED",
    "COMPLETED",
    "WITHDRAWN",
  ])
  .openapi("ManagePostingApplicantStatus");

export const managePostingItemSchema = z
  .object({
    id: z.string(),
    sourceType: z.enum(["VOLUNTEER", "PROJECT"]),
    title: z.string(),
    description: z.string().nullable(),
    imageKey: z.string().nullable(),
    status: managePostingStatusSchema,
    filled: z.boolean(),
    applicantCount: z.number().int().nonnegative(),
    capacity: z.number().int().nonnegative(),
    views: z.number().int().nonnegative(),
    deadline: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi("ManagePostingItem");

export const managePostingsPaginationSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  })
  .openapi("ManagePostingsPagination");

export const managePostingsResponseSchema = z
  .object({
    ok: z.literal(true),
    postings: z.array(managePostingItemSchema),
    pagination: managePostingsPaginationSchema,
  })
  .openapi("ManagePostingsResponse");

export const managePostingApplicantSchema = z
  .object({
    id: z.string(),
    candidate: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      phoneNumber: z.string().nullable(),
      telegramUsername: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      avatarKey: z.string().nullable(),
    }),
    role: z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().nullable(),
    }),
    roles: z.array(
      z.object({
        applicationId: z.string(),
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        status: managePostingApplicantStatusSchema,
        appliedAt: z.string(),
        updatedAt: z.string(),
      }),
    ),
    topPick: z.string().nullable(),
    status: managePostingApplicantStatusSchema,
    appliedAt: z.string(),
    updatedAt: z.string(),
    contact: z.object({
      email: z.string(),
      phoneNumber: z.string().nullable(),
      telegramUsername: z.string().nullable(),
    }),
    volunteer: z
      .object({
        availability: z.string(),
        relevantExperience: z.string(),
        supportingDocuments: z.array(
          z.object({
            name: z.string(),
            key: z.string(),
          }),
        ),
      })
      .nullable(),
    project: z
      .object({
        motivation: z.string(),
        portfolio: z.string(),
        documentKeys: z.array(z.string()),
        documentNames: z.array(z.string()),
      })
      .nullable(),
  })
  .openapi("ManagePostingApplicant");

export const managePostingDetailSchema = z
  .object({
    posting: managePostingItemSchema,
    stats: z.object({
      pending: z.number().int().nonnegative(),
      totalApplicants: z.number().int().nonnegative(),
      recruited: z.number().int().nonnegative(),
      capacity: z.number().int().nonnegative(),
      statuses: z.object({
        SUBMITTED: z.number().int().nonnegative(),
        UNDER_REVIEW: z.number().int().nonnegative(),
        APPROVED: z.number().int().nonnegative(),
        DECLINED: z.number().int().nonnegative(),
        CONFIRMED: z.number().int().nonnegative(),
        COMPLETED: z.number().int().nonnegative(),
        WITHDRAWN: z.number().int().nonnegative(),
      }),
    }),
    applicants: z.array(managePostingApplicantSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
      hasNextPage: z.boolean(),
      hasPreviousPage: z.boolean(),
    }),
  })
  .openapi("ManagePostingDetail");

export const managePostingDetailResponseSchema = z
  .object({
    ok: z.literal(true),
    detail: managePostingDetailSchema,
  })
  .openapi("ManagePostingDetailResponse");

export const managePostingApplicationDetailResponseSchema = z
  .object({
    ok: z.literal(true),
    applicant: managePostingApplicantSchema,
  })
  .openapi("ManagePostingApplicationDetailResponse");

export const managePostingApplicationActionResponseSchema = z
  .object({
    ok: z.literal(true),
    applicant: managePostingApplicantSchema,
  })
  .openapi("ManagePostingApplicationActionResponse");

export const managePostingsErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("ManagePostingsErrorResponse");

export type GetManagePostingsQuery = z.infer<
  typeof getManagePostingsQuerySchema
>;
export type GetManagePostingDetailParam = z.infer<
  typeof getManagePostingDetailParamSchema
>;
export type GetManagePostingApplicationParam = z.infer<
  typeof getManagePostingApplicationParamSchema
>;
export type ChangeManagePostingApplicationStatusParam = z.infer<
  typeof changeManagePostingApplicationStatusParamSchema
>;
export type GetManagePostingDetailQuery = z.infer<
  typeof getManagePostingDetailQuerySchema
>;
export type ManagePostingFilter = z.infer<typeof managePostingFilterSchema>;
export type ManagePostingStatus = z.infer<typeof managePostingStatusSchema>;
export type ManagePostingStatusAction = z.infer<
  typeof managePostingStatusActionSchema
>;
