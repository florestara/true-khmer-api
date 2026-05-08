import { z } from "zod";

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

export const managePostingsResponseSchema = z
  .object({
    ok: z.literal(true),
    postings: z.array(managePostingItemSchema),
    total: z.number().int().nonnegative(),
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
