import { z } from "zod";

const presignedUploadHeadersSchema = z.object({
  "Content-Length": z.string(),
  "Content-Type": z.string(),
});

export const presignVolunteerOpportunityCoverUploadResultSchema = z
  .object({
    uploadUrl: z.string(),
    method: z.literal("PUT"),
    requiredHeaders: presignedUploadHeadersSchema,
    coverImageKey: z.string(),
    expiresInSeconds: z.number(),
  })
  .openapi("PresignVolunteerOpportunityCoverUploadResult");

export const presignVolunteerOpportunityCoverUploadResponseSchema = z
  .object({
    ok: z.literal(true),
    upload: presignVolunteerOpportunityCoverUploadResultSchema,
  })
  .openapi("PresignVolunteerOpportunityCoverUploadResponse");

export const presignVolunteerApplicationDocumentUploadResultSchema = z
  .object({
    uploadUrl: z.string(),
    method: z.literal("PUT"),
    requiredHeaders: presignedUploadHeadersSchema,
    supportingDocument: z.object({
      name: z.string(),
      key: z.string(),
    }),
    expiresInSeconds: z.number(),
  })
  .openapi("PresignVolunteerApplicationDocumentUploadResult");

export const presignVolunteerApplicationDocumentUploadResponseSchema = z
  .object({
    ok: z.literal(true),
    uploads: z.array(presignVolunteerApplicationDocumentUploadResultSchema),
  })
  .openapi("PresignVolunteerApplicationDocumentUploadResponse");

const volunteerOpportunityContactResponseSchema = z
  .object({
    email: z.string(),
    telegramUsername: z.string().nullable(),
    phone: z.string().nullable(),
    websiteUrl: z.string().nullable(),
  })
  .openapi("VolunteerOpportunityContactResponse");

const volunteerOpportunityRoleResponseSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    commitmentLabel: z.string(),
    capacity: z.number(),
    responsibilities: z.array(z.string()),
    requirements: z.array(z.string()),
    displayOrder: z.number(),
    viewerApplied: z.boolean(),
  })
  .openapi("VolunteerOpportunityRoleResponse");

const volunteerOpportunityReferenceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi("VolunteerOpportunityReference");

const volunteerApplicationRoleResponseSchema = z
  .object({
    id: z.string(),
    title: z.string(),
  })
  .openapi("VolunteerApplicationRoleResponse");

const volunteerApplicationOpportunitySchema = z
  .object({
    id: z.string(),
    title: z.string(),
    coverImageKey: z.string(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED", "CLOSED"]),
    applicationDeadline: z.string(),
    category: volunteerOpportunityReferenceSchema,
    location: volunteerOpportunityReferenceSchema,
  })
  .openapi("VolunteerApplicationOpportunity");

const volunteerOpportunityOrganizerResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    opportunityCount: z.number(),
    organizerLocation: volunteerOpportunityReferenceSchema.nullable(),
    contact: volunteerOpportunityContactResponseSchema,
  })
  .openapi("VolunteerOpportunityOrganizerResponse");

export const volunteerOpportunityListItemResponseSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    overview: z.string(),
    durationLabel: z.string().nullable(),
    commitmentLabel: z.string().nullable(),
    applicationDeadline: z.string(),
    applicationCount: z.number(),
    capacity: z.number(),
    coverImageKey: z.string(),
    createdAt: z.string(),
    viewerSave: z.boolean(),
    category: volunteerOpportunityReferenceSchema,
    location: volunteerOpportunityReferenceSchema,
  })
  .openapi("VolunteerOpportunityListItemResponse");

export const volunteerOpportunityResponseSchema = z
  .object({
    id: z.string(),
    category: volunteerOpportunityReferenceSchema,
    location: volunteerOpportunityReferenceSchema,
    title: z.string(),
    overview: z.string(),
    communityImpact: z.string().nullable(),
    durationLabel: z.string().nullable(),
    commitmentLabel: z.string().nullable(),
    applicationDeadline: z.string(),
    applicationCount: z.number(),
    capacity: z.number(),
    coverImageKey: z.string(),
    benefits: z.array(z.string()),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED", "CLOSED"]),
    publishedAt: z.string().nullable(),
    organizer: volunteerOpportunityOrganizerResponseSchema,
    createdBy: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    viewerSave: z.boolean(),
    roles: z.array(volunteerOpportunityRoleResponseSchema),
  })
  .openapi("VolunteerOpportunityResponse");

export const publicVolunteerOpportunityResponseSchema =
  volunteerOpportunityResponseSchema
    .omit({
      createdBy: true,
    })
    .openapi("PublicVolunteerOpportunityResponse");

export const createVolunteerOpportunityResponseSchema = z
  .object({
    ok: z.literal(true),
    opportunity: volunteerOpportunityResponseSchema,
  })
  .openapi("CreateVolunteerOpportunityResponse");

export const volunteerApplicationResponseSchema = z
  .object({
    id: z.string(),
    opportunity: volunteerApplicationOpportunitySchema,
    role: volunteerApplicationRoleResponseSchema,
    availability: z.string(),
    relevantExperience: z.string(),
    supportingDocuments: z.array(
      z.object({
        name: z.string(),
        key: z.string(),
      }),
    ),
    status: z.enum([
      "SUBMITTED",
      "UNDER_REVIEW",
      "APPROVED",
      "DECLINED",
      "CONFIRMED",
      "COMPLETED",
      "WITHDRAWN",
    ]),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("VolunteerApplicationResponse");

export const createVolunteerApplicationResponseSchema = z
  .object({
    ok: z.literal(true),
    application: volunteerApplicationResponseSchema,
  })
  .openapi("CreateVolunteerApplicationResponse");

export const getVolunteerOpportunityResponseSchema = z
  .object({
    ok: z.literal(true),
    opportunity: volunteerOpportunityResponseSchema,
  })
  .openapi("GetVolunteerOpportunityResponse");

export const saveVolunteerOpportunityResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi("SaveVolunteerOpportunityResponse");

export const getPublicVolunteerOpportunityResponseSchema = z
  .object({
    ok: z.literal(true),
    opportunity: publicVolunteerOpportunityResponseSchema,
  })
  .openapi("GetPublicVolunteerOpportunityResponse");

export const volunteerOpportunitiesPaginationResponseSchema = z
  .object({
    limit: z.number(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
    total: z.number().int().nonnegative(),
  })
  .openapi("VolunteerOpportunitiesPaginationResponse");

export const getVolunteerOpportunitiesResponseSchema = z
  .object({
    ok: z.literal(true),
    opportunities: z.array(volunteerOpportunityListItemResponseSchema),
    pagination: volunteerOpportunitiesPaginationResponseSchema,
  })
  .openapi("GetVolunteerOpportunitiesResponse");
