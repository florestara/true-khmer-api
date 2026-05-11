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
    filter: z
      .enum(["all", "pending", "approved", "active", "completed", "archived"])
      .default("all"),
  })
  .openapi("GetMyApplicationsQuery");

export const getMyApplicationDetailParamSchema = z
  .object({
    sourceType: z.enum(["volunteer", "projects"]),
    applicationId: z.string().uuid(),
  })
  .openapi("GetMyApplicationDetailParam");

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
    PENDING: z.number().int().nonnegative(),
    APPROVED: z.number().int().nonnegative(),
    DECLINED: z.number().int().nonnegative(),
    ACTIVE: z.number().int().nonnegative(),
    COMPLETED: z.number().int().nonnegative(),
    WITHDRAWN: z.number().int().nonnegative(),
    ARCHIVED: z.number().int().nonnegative(),
  })
  .openapi("MyApplicationsSummary");

export const myApplicationsResponseSchema = z
  .object({
    ok: z.literal(true),
    applications: z.array(myApplicationItemSchema).nullable(),
    summary: myApplicationsSummarySchema,
  })
  .openapi("MyApplicationsResponse");

const myApplicationTimelineSchema = z
  .object({
    submitted: z.string().nullable(),
    passed: z.string().nullable(),
    confirmed: z.string().nullable(),
    completed: z.string().nullable(),
  })
  .openapi("MyApplicationTimeline");

export const myApplicationDetailSchema = z
  .object({
    id: z.string(),
    sourceType: z.enum(["VOLUNTEER", "PROJECT"]),
    title: z.string(),
    imageKey: z.string().nullable(),
    status: myApplicationStatusGroupSchema,
    appliedAt: z.string(),
    deadline: z.string().nullable(),
    archived: z.boolean(),
    opportunity: z.object({
      id: z.string(),
      title: z.string(),
      overview: z.string().nullable(),
      category: myApplicationReferenceSchema.nullable(),
      location: myApplicationReferenceSchema.nullable(),
      durationLabel: z.string().nullable(),
      commitmentLabel: z.string().nullable(),
      impactRewardPoints: z.number().int().nonnegative().nullable(),
    }),
    role: z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      responsibilities: z.array(z.string()),
      requirements: z.array(z.string()),
    }),
    owner: z.object({
      id: z.string(),
      name: z.string(),
      avatarUrl: z.string().nullable(),
      avatarKey: z.string().nullable(),
      postedCount: z.number().int().nonnegative(),
      contact: z.object({
        email: z.string(),
        phoneNumber: z.string().nullable(),
        telegramUsername: z.string().nullable(),
      }),
    }),
    timeline: myApplicationTimelineSchema,
  })
  .openapi("MyApplicationDetail");

export const myApplicationDetailResponseSchema = z
  .object({
    ok: z.literal(true),
    application: myApplicationDetailSchema,
  })
  .openapi("MyApplicationDetailResponse");

export const myApplicationsErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("MyApplicationsErrorResponse");

export type GetMyApplicationsQuery = z.infer<
  typeof getMyApplicationsQuerySchema
>;
export type GetMyApplicationDetailParam = z.infer<
  typeof getMyApplicationDetailParamSchema
>;
