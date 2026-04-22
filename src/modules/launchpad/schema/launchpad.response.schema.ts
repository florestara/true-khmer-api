import { z } from "zod";

const presignedUploadHeadersSchema = z.object({
  "Content-Length": z.string(),
  "Content-Type": z.string(),
});

export const presignLaunchpadLogoUploadResultSchema = z
  .object({
    uploadUrl: z.string(),
    method: z.literal("PUT"),
    requiredHeaders: presignedUploadHeadersSchema,
    logoImageKey: z.string(),
    publicUrl: z.string().nullable(),
    expiresInSeconds: z.number(),
  })
  .openapi("PresignLaunchpadLogoUploadResult");

export const presignLaunchpadLogoUploadResponseSchema = z
  .object({
    ok: z.literal(true),
    uploads: z.array(presignLaunchpadLogoUploadResultSchema),
  })
  .openapi("PresignLaunchpadLogoUploadResponse");

export const presignLaunchpadCoverUploadResultSchema = z
  .object({
    uploadUrl: z.string(),
    method: z.literal("PUT"),
    requiredHeaders: presignedUploadHeadersSchema,
    coverImageKey: z.string(),
    publicUrl: z.string().nullable(),
    expiresInSeconds: z.number(),
  })
  .openapi("PresignLaunchpadCoverUploadResult");

export const presignLaunchpadCoverUploadResponseSchema = z
  .object({
    ok: z.literal(true),
    uploads: z.array(presignLaunchpadCoverUploadResultSchema),
  })
  .openapi("PresignLaunchpadCoverUploadResponse");

export const presignLaunchpadDocumentUploadResultSchema = z
  .object({
    uploadUrl: z.string(),
    method: z.literal("PUT"),
    requiredHeaders: presignedUploadHeadersSchema,
    documentKey: z.string(),
    publicUrl: z.string().nullable(),
    expiresInSeconds: z.number(),
  })
  .openapi("PresignLaunchpadDocumentUploadResult");

export const presignLaunchpadDocumentUploadResponseSchema = z
  .object({
    ok: z.literal(true),
    uploads: z.array(presignLaunchpadDocumentUploadResultSchema),
  })
  .openapi("PresignLaunchpadDocumentUploadResponse");

export const launchpadLogoValidationErrorResponseSchema = z
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
  .openapi("LaunchpadLogoValidationErrorResponse");

export const launchpadValidationErrorResponseSchema =
  launchpadLogoValidationErrorResponseSchema;

export const launchpadOperationErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("LaunchpadOperationErrorResponse");
