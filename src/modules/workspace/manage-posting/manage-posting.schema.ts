import { z } from "zod";

const DEFAULT_MANAGE_POSTINGS_PAGE_SIZE = 6;
const MAX_MANAGE_POSTINGS_PAGE_SIZE = 50;

export const managePostingTypeSchema = z
  .enum(["all", "volunteer", "projects"])
  .openapi("ManagePostingType");

export const managePostingFilterSchema = z
  .enum(["all", "active", "draft", "filled", "ended"])
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
  })
  .openapi("GetManagePostingsQuery");

export const managePostingStatusSchema = z
  .enum(["ACTIVE", "DRAFT", "FILLED", "ENDED"])
  .openapi("ManagePostingStatus");

export const managePostingItemSchema = z
  .object({
    id: z.string(),
    sourceType: z.enum(["VOLUNTEER", "PROJECT"]),
    title: z.string(),
    description: z.string().nullable(),
    imageKey: z.string().nullable(),
    status: managePostingStatusSchema,
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

export const managePostingsErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("ManagePostingsErrorResponse");

export type GetManagePostingsQuery = z.infer<
  typeof getManagePostingsQuerySchema
>;
export type ManagePostingFilter = z.infer<typeof managePostingFilterSchema>;
export type ManagePostingStatus = z.infer<typeof managePostingStatusSchema>;
