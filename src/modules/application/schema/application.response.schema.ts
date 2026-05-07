import { z } from "zod";

const presignedUploadHeadersSchema = z.object({
  "Content-Length": z.string(),
  "Content-Type": z.string(),
});

export const volunteerOperationErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("VolunteerApplicationOperationErrorResponse");

export const volunteerValidationErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
    issues: z.array(
      z.object({
        path: z.string(),
        message: z.string(),
      }),
    ),
  })
  .openapi("VolunteerApplicationValidationErrorResponse");

const volunteerApplicationRoleResponseSchema = z
  .object({
    id: z.string(),
    title: z.string(),
  })
  .openapi("VolunteerApplicationRoleResponse");

const volunteerOpportunityReferenceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi("VolunteerApplicationOpportunityReference");

const volunteerApplicationOpportunitySchema = z
  .object({
    id: z.string(),
    title: z.string(),
    coverImageKey: z.string(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED", "CLOSED"]),
    category: volunteerOpportunityReferenceSchema,
    location: volunteerOpportunityReferenceSchema,
  })
  .openapi("VolunteerApplicationOpportunity");

export const presignVolunteerApplicationDocumentUploadResultSchema = z
  .object({
    uploadUrl: z.string(),
    method: z.literal("PUT"),
    requiredHeaders: presignedUploadHeadersSchema,
    supportingDocumentKey: z.string(),
    expiresInSeconds: z.number(),
  })
  .openapi("PresignVolunteerApplicationDocumentUploadResult");

export const presignVolunteerApplicationDocumentUploadResponseSchema = z
  .object({
    ok: z.literal(true),
    uploads: z.array(presignVolunteerApplicationDocumentUploadResultSchema),
  })
  .openapi("PresignVolunteerApplicationDocumentUploadResponse");

export const volunteerApplicationResponseSchema = z
  .object({
    id: z.string(),
    opportunity: volunteerApplicationOpportunitySchema,
    role: volunteerApplicationRoleResponseSchema,
    availability: z.string(),
    relevantExperience: z.string(),
    supportingDocumentKeys: z.array(z.string()),
    status: z.enum(["SUBMITTED", "APPROVAL", "ACCEPTED", "REJECTED", "WITHDRAWN"]),
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

export const getVolunteerApplicationsResponseSchema = z
  .object({
    ok: z.literal(true),
    applications: z.array(volunteerApplicationResponseSchema),
  })
  .openapi("GetVolunteerApplicationsResponse");
