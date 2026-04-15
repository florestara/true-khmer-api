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
    publicUrl: z.string().nullable(),
    expiresInSeconds: z.number(),
  })
  .openapi("PresignVolunteerOpportunityCoverUploadResult");

export const presignVolunteerOpportunityCoverUploadResponseSchema = z
  .object({
    ok: z.literal(true),
    upload: presignVolunteerOpportunityCoverUploadResultSchema,
  })
  .openapi("PresignVolunteerOpportunityCoverUploadResponse");

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
  })
  .openapi("VolunteerOpportunityRoleResponse");

export const volunteerOpportunityResponseSchema = z
  .object({
    id: z.string(),
    categoryId: z.string(),
    locationId: z.string(),
    title: z.string(),
    overview: z.string(),
    communityImpact: z.string().nullable(),
    durationLabel: z.string(),
    commitmentLabel: z.string(),
    applicationDeadline: z.string(),
    coverImageKey: z.string(),
    coverImageUrl: z.string().nullable(),
    benefits: z.array(z.string()),
    contact: volunteerOpportunityContactResponseSchema,
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED", "CLOSED"]),
    publishedAt: z.string().nullable(),
    createdBy: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    roles: z.array(volunteerOpportunityRoleResponseSchema),
  })
  .openapi("VolunteerOpportunityResponse");

export const createVolunteerOpportunityResponseSchema = z
  .object({
    ok: z.literal(true),
    opportunity: volunteerOpportunityResponseSchema,
  })
  .openapi("CreateVolunteerOpportunityResponse");

export const volunteerOpportunitiesPaginationResponseSchema = z
  .object({
    limit: z.number(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  })
  .openapi("VolunteerOpportunitiesPaginationResponse");

export const getVolunteerOpportunitiesResponseSchema = z
  .object({
    ok: z.literal(true),
    opportunities: z.array(volunteerOpportunityResponseSchema),
    pagination: volunteerOpportunitiesPaginationResponseSchema,
  })
  .openapi("GetVolunteerOpportunitiesResponse");
