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

const myApplicationRoleSchema = z
  .object({
    applicationId: z.string(),
    roleId: z.string(),
    title: z.string(),
    status: myApplicationStatusGroupSchema,
    appliedAt: z.string(),
  })
  .openapi("MyApplicationRole");

export const myApplicationItemSchema = z
  .object({
    opportunityId: z.string(),
    opportunityTitle: z.string(),
    sourceType: z.enum(["VOLUNTEER", "PROJECT"]),
    imageKey: z.string().nullable(),
    appliedAt: z.string(),
    deadline: z.string().nullable(),
    status: myApplicationStatusGroupSchema,
    needAttention: z.boolean(),
    totalRoleApplied: z.number().int().nonnegative(),
    filled: z.boolean(),
    category: myApplicationReferenceSchema.nullable(),
    location: myApplicationReferenceSchema.nullable(),
    roles: z.array(myApplicationRoleSchema),
    approvedRole: myApplicationRoleSchema.nullable(),
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
    underReview: z.string().nullable(),
    approved: z.string().nullable(),
    declined: z.object({
      at: z.string().nullable(),
      by: z.enum(["POSTER", "APPLICANT", "SYSTEM"]).nullable(),
    }),
    confirmed: z.string().nullable(),
    completed: z.string().nullable(),
  })
  .openapi("MyApplicationTimeline");

const myApplicationRoleDetailSchema = z
  .object({
    applicationId: z.string(),
    roleId: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    responsibilities: z.array(z.string()),
    requirements: z.array(z.string()),
    status: myApplicationStatusGroupSchema,
    appliedAt: z.string(),
    archived: z.boolean(),
    actions: z.object({
      canConfirm: z.boolean(),
      canDecline: z.boolean(),
      canWithdraw: z.boolean(),
    }),
    timeline: myApplicationTimelineSchema,
  })
  .openapi("MyApplicationRoleDetail");

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
    needAttention: z.boolean(),
    totalRoleApplied: z.number().int().nonnegative(),
    canArchive: z.boolean(),
    opportunity: z.object({
      id: z.string(),
      title: z.string(),
      overview: z.string().nullable(),
      category: myApplicationReferenceSchema.nullable(),
      location: myApplicationReferenceSchema.nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      commitmentLabel: z.string().nullable(),
      commitmentDescription: z.string().nullable(),
      filled: z.boolean(),
      impactRewardPoints: z.number().int().nonnegative().nullable(),
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
    roles: z.array(myApplicationRoleDetailSchema),
    approvedRole: myApplicationRoleSchema.nullable(),
  })
  .openapi("MyApplicationDetail");

export const myApplicationDetailResponseSchema = z
  .object({
    ok: z.literal(true),
    application: myApplicationDetailSchema,
  })
  .openapi("MyApplicationDetailResponse");

export const myApplicationStatusActionResponseSchema = z
  .object({
    ok: z.literal(true),
    application: myApplicationItemSchema,
  })
  .openapi("MyApplicationStatusActionResponse");

export const myApplicationArchiveActionResponseSchema = z
  .object({
    ok: z.literal(true),
    application: myApplicationItemSchema.extend({
      archived: z.boolean(),
    }),
  })
  .openapi("MyApplicationArchiveActionResponse");

export const myApplicationsErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("MyApplicationsErrorResponse");
