import { z } from "zod";

const myApplicationReferenceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi("MyApplicationReference");

const myApplicationOpportunitySchema = z
  .object({
    id: z.string(),
    title: z.string(),
  })
  .openapi("MyApplicationOpportunity");

export const myApplicationStatusGroupSchema = z
  .enum([
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "DECLINED",
    "CONFIRMED",
    "COMPLETED",
    "WITHDRAWN",
  ])
  .openapi("MyApplicationStatusGroup");

export const getMyApplicationsQuerySchema = z
  .object({
    type: z.enum(["all", "volunteer", "projects"]).default("all"),
  })
  .openapi("GetMyApplicationsQuery");

export const myApplicationSourceParamSchema = z
  .enum(["volunteer", "projects"])
  .openapi("MyApplicationSourceParam");

export const myApplicationStatusActionSchema = z
  .enum(["confirm", "decline", "withdraw"])
  .openapi("MyApplicationStatusAction");

export const changeMyApplicationStatusParamSchema = z
  .object({
    sourceType: myApplicationSourceParamSchema,
    applicationId: z.string().uuid(),
    statusAction: myApplicationStatusActionSchema,
  })
  .openapi("ChangeMyApplicationStatusParam");

export const myApplicationItemSchema = z
  .object({
    id: z.string(),
    sourceType: z.enum(["VOLUNTEER", "PROJECT"]),
    title: z.string(),
    imageKey: z.string().nullable(),
    appliedAt: z.string(),
    deadline: z.string().nullable(),
    status: myApplicationStatusGroupSchema,
    opportunity: myApplicationOpportunitySchema.nullable(),
    category: myApplicationReferenceSchema.nullable(),
    location: myApplicationReferenceSchema.nullable(),
  })
  .openapi("MyApplicationItem");

export const myApplicationsSummarySchema = z
  .object({
    SUBMITTED: z.number().int().nonnegative(),
    UNDER_REVIEW: z.number().int().nonnegative(),
    APPROVED: z.number().int().nonnegative(),
    DECLINED: z.number().int().nonnegative(),
    CONFIRMED: z.number().int().nonnegative(),
    COMPLETED: z.number().int().nonnegative(),
    WITHDRAWN: z.number().int().nonnegative(),
  })
  .openapi("MyApplicationsSummary");

export const myApplicationsResponseSchema = z
  .object({
    ok: z.literal(true),
    applications: z.array(myApplicationItemSchema).nullable(),
    summary: myApplicationsSummarySchema,
  })
  .openapi("MyApplicationsResponse");

export const myApplicationStatusActionResponseSchema = z
  .object({
    ok: z.literal(true),
    application: myApplicationItemSchema,
  })
  .openapi("MyApplicationStatusActionResponse");

export const myApplicationsErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("MyApplicationsErrorResponse");

export type GetMyApplicationsQuery = z.infer<
  typeof getMyApplicationsQuerySchema
>;
export type ChangeMyApplicationStatusParam = z.infer<
  typeof changeMyApplicationStatusParamSchema
>;
