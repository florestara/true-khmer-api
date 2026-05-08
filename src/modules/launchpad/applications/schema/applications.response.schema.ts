import { z } from "@hono/zod-openapi";

const presignedUploadHeadersSchema = z.object({
  "Content-Length": z.string(),
  "Content-Type": z.string(),
});

export const presignLaunchpadApplicationDocumentUploadResultSchema = z
  .object({
    uploadUrl: z.string(),
    method: z.literal("PUT"),
    requiredHeaders: presignedUploadHeadersSchema,
    documentKey: z.string(),
    expiresInSeconds: z.number(),
  })
  .openapi("PresignLaunchpadApplicationDocumentUploadResult");

export const presignLaunchpadApplicationDocumentUploadResponseSchema = z
  .object({
    ok: z.literal(true),
    upload: presignLaunchpadApplicationDocumentUploadResultSchema,
  })
  .openapi("PresignLaunchpadApplicationDocumentUploadResponse");

const launchpadApplicationStatusSchema = z.enum([
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "DECLINED",
  "CONFIRMED",
  "COMPLETED",
  "WITHDRAWN",
]);

export const launchpadApplicationLogSchema = z
  .object({
    id: z.string(),
    status: launchpadApplicationStatusSchema,
    createdAt: z.string(),
  })
  .openapi("LaunchpadApplicationLog");

export const launchpadApplicationSchema = z
  .object({
    id: z.string(),
    launchpadId: z.string(),
    launchpadRoleId: z.string(),
    motivation: z.string(),
    portfolio: z.string(),
    status: launchpadApplicationStatusSchema,
    documentKeys: z.array(z.string()),
    documentNames: z.array(z.string()),
    createdAt: z.string(),
    updatedAt: z.string(),
    logs: z.array(launchpadApplicationLogSchema),
  })
  .openapi("LaunchpadApplication");

export const createLaunchpadApplicationResponseSchema = z
  .object({
    ok: z.literal(true),
    application: launchpadApplicationSchema,
  })
  .openapi("CreateLaunchpadApplicationResponse");

export const getLaunchpadApplicationResponseSchema = z
  .object({
    ok: z.literal(true),
    application: launchpadApplicationSchema,
  })
  .openapi("GetLaunchpadApplicationResponse");

export const launchpadApplicationValidationErrorResponseSchema = z
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
  .openapi("LaunchpadApplicationValidationErrorResponse");

export const launchpadApplicationOperationErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("LaunchpadApplicationOperationErrorResponse");
