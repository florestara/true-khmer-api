import { z } from "zod";

export const managePostingStatusSchema = z
  .enum(["DRAFT", "LIVE", "IN_PROGRESS", "COMPLETED", "CANCELED", "DELETED"])
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
    isEditable: z.boolean(),
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

export const managePostingApplicationRoleSchema = z
  .object({
    applicationId: z.string(),
    roleId: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: managePostingApplicantStatusSchema,
    appliedAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("ManagePostingApplicationRole");

export const managePostingSubmissionSchema = z
  .object({
    submissionKey: z.string(),
    roles: z.array(managePostingApplicationRoleSchema),
    topPick: z.string().nullable(),
    appliedAt: z.string(),
    updatedAt: z.string(),
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
  .openapi("ManagePostingSubmission");

export const managePostingApplicantPrivateNoteSchema = z
  .object({
    id: z.string(),
    note: z.string(),
    createdBy: z.string(),
    updatedBy: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("ManagePostingApplicantPrivateNote");

export const managePostingApplicantSchema = z
  .object({
    candidate: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      phoneNumber: z.string().nullable(),
      telegramUsername: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      avatarKey: z.string().nullable(),
    }),
    submissions: z.array(managePostingSubmissionSchema),
    submissionCount: z.number().int().nonnegative(),
    totalRoleApplied: z.number().int().nonnegative(),
    overallStatus: managePostingApplicantStatusSchema,
    lastAppliedAt: z.string(),
    updatedAt: z.string(),
    contact: z.object({
      email: z.string(),
      phoneNumber: z.string().nullable(),
      telegramUsername: z.string().nullable(),
    }),
    privateNote: managePostingApplicantPrivateNoteSchema.nullable(),
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
      filterCounts: z.object({
        all: z.number().int().nonnegative(),
        new: z.number().int().nonnegative(),
        in_review: z.number().int().nonnegative(),
        approved: z.number().int().nonnegative(),
        confirmed: z.number().int().nonnegative(),
        declined: z.number().int().nonnegative(),
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

export const managePostingCandidateDetailResponseSchema = z
  .object({
    ok: z.literal(true),
    applicant: managePostingApplicantSchema,
  })
  .openapi("ManagePostingCandidateDetailResponse");

export const managePostingApplicationActionResponseSchema = z
  .object({
    ok: z.literal(true),
    applicant: managePostingApplicantSchema,
  })
  .openapi("ManagePostingApplicationActionResponse");

export const upsertManagePostingCandidateNoteResponseSchema = z
  .object({
    ok: z.literal(true),
    applicant: managePostingApplicantSchema,
  })
  .openapi("UpsertManagePostingCandidateNoteResponse");

export const updateManagePostingActionResponseSchema = z
  .object({
    ok: z.literal(true),
    posting: managePostingItemSchema,
  })
  .openapi("UpdateManagePostingActionResponse");

export const extendManagePostingDeadlineResponseSchema = z
  .object({
    ok: z.literal(true),
    posting: managePostingItemSchema,
  })
  .openapi("ExtendManagePostingDeadlineResponse");

export const managePostingsErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("ManagePostingsErrorResponse");

export type ManagePostingStatus = z.infer<typeof managePostingStatusSchema>;
