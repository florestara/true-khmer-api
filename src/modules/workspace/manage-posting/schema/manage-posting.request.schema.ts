import { z } from "zod";
import { UUID_RE } from "../../../../lib/constant";

const DEFAULT_MANAGE_POSTINGS_PAGE_SIZE = 6;

export const managePostingTypeSchema = z
  .enum(["all", "volunteer", "projects"])
  .openapi("ManagePostingType");

export const managePostingSourceParamSchema = z
  .enum(["volunteer", "projects"])
  .openapi("ManagePostingSourceParam");

export const managePostingFilterSchema = z
  .enum([
    "all",
    "live",
    "draft",
    "in_progress",
    "completed",
    "canceled",
    "filled",
  ])
  .openapi("ManagePostingFilter");

export const getManagePostingsQuerySchema = z
  .object({
    type: managePostingTypeSchema.default("all"),
    filter: managePostingFilterSchema.default("all"),
    page: z.coerce.number().int().min(1, "page must be >= 1").default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1, "limit must be >= 1")
      .default(DEFAULT_MANAGE_POSTINGS_PAGE_SIZE),
    search: z
      .string()
      .trim()
      .max(300, "search must be <= 300 characters")
      .optional(),
  })
  .openapi("GetManagePostingsQuery");

export const managePostingApplicantFilterSchema = z
  .enum(["all", "new", "in_review", "approved", "confirmed", "declined"])
  .openapi("ManagePostingApplicantFilter");

export const getManagePostingDetailParamSchema = z
  .object({
    sourceType: managePostingSourceParamSchema,
    postingId: z
      .string()
      .trim()
      .regex(UUID_RE, "postingId must be a valid UUID"),
  })
  .openapi("GetManagePostingDetailParam");

export const getManagePostingCandidateParamSchema = z
  .object({
    sourceType: managePostingSourceParamSchema,
    postingId: z
      .string()
      .trim()
      .regex(UUID_RE, "postingId must be a valid UUID"),
    candidateId: z
      .string()
      .trim()
      .regex(UUID_RE, "candidateId must be a valid UUID"),
  })
  .openapi("GetManagePostingCandidateParam");

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
  .enum(["under_review", "approve"])
  .openapi("ManagePostingStatusAction");

export const changeManagePostingApplicationStatusParamSchema =
  getManagePostingApplicationParamSchema
    .extend({
      statusAction: managePostingStatusActionSchema,
    })
    .openapi("ChangeManagePostingApplicationStatusParam");

export const upsertManagePostingCandidateNoteBodySchema = z
  .object({
    note: z
      .string()
      .trim()
      .max(5000, "note must be <= 5000 characters"),
  })
  .openapi("UpsertManagePostingCandidateNoteRequest");

export const declineManagePostingApplicationQuerySchema = z
  .object({
    declineAll: z.coerce.boolean().optional().default(false),
    blockFutureApply: z.coerce.boolean().optional().default(false),
  })
  .openapi("DeclineManagePostingApplicationQuery");

export const getManagePostingDetailQuerySchema = z
  .object({
    filter: managePostingApplicantFilterSchema.default("all"),
    search: z
      .string()
      .trim()
      .max(300, "search must be <= 300 characters")
      .optional(),
    page: z.coerce.number().int().min(1, "page must be >= 1").default(1),
    limit: z.coerce.number().int().min(1, "limit must be >= 1").default(10),
  })
  .openapi("GetManagePostingDetailQuery");

export const managePostingActionSchema = z
  .enum(["cancel", "close", "delete", "mark_complete"])
  .openapi("ManagePostingAction");

export const updateManagePostingActionParamSchema = z
  .object({
    sourceType: managePostingSourceParamSchema,
    postingId: z
      .string()
      .trim()
      .regex(UUID_RE, "postingId must be a valid UUID"),
    postingAction: managePostingActionSchema,
  })
  .openapi("UpdateManagePostingActionParam");

export const extendManagePostingDeadlineBodySchema = z
  .object({
    deadline: z
      .string()
      .datetime("deadline must be a valid ISO datetime")
      .refine(
        (value) => Number.isFinite(Date.parse(value)),
        "deadline must be a valid ISO datetime",
      )
      .refine(
        (value) => Date.parse(value) > Date.now(),
        "deadline must be in the future",
      ),
  })
  .openapi("ExtendManagePostingDeadlineRequest");

export type GetManagePostingsQuery = z.infer<
  typeof getManagePostingsQuerySchema
>;
export type GetManagePostingDetailParam = z.infer<
  typeof getManagePostingDetailParamSchema
>;
export type GetManagePostingApplicationParam = z.infer<
  typeof getManagePostingApplicationParamSchema
>;
export type GetManagePostingCandidateParam = z.infer<
  typeof getManagePostingCandidateParamSchema
>;
export type ChangeManagePostingApplicationStatusParam = z.infer<
  typeof changeManagePostingApplicationStatusParamSchema
>;
export type UpsertManagePostingCandidateNoteBody = z.infer<
  typeof upsertManagePostingCandidateNoteBodySchema
>;
export type DeclineManagePostingApplicationQuery = z.infer<
  typeof declineManagePostingApplicationQuerySchema
>;
export type UpdateManagePostingActionParam = z.infer<
  typeof updateManagePostingActionParamSchema
>;
export type ExtendManagePostingDeadlineBody = z.infer<
  typeof extendManagePostingDeadlineBodySchema
>;
export type GetManagePostingDetailQuery = z.infer<
  typeof getManagePostingDetailQuerySchema
>;
export type ManagePostingFilter = z.infer<typeof managePostingFilterSchema>;
export type ManagePostingApplicantFilter = z.infer<
  typeof managePostingApplicantFilterSchema
>;
export type ManagePostingStatusAction = z.infer<
  typeof managePostingStatusActionSchema
>;
export type ManagePostingAction = z.infer<typeof managePostingActionSchema>;
