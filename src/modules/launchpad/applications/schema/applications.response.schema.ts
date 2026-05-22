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
    declinedBy: z.enum(["POSTER", "APPLICANT"]).nullable(),
    createdBy: z.string(),
    createdAt: z.string(),
  })
  .openapi("LaunchpadApplicationLog");

export const launchpadApplicationSchema = z
  .object({
    id: z.string(),
    launchpadId: z.string(),
    launchpadRoleId: z.string(),
    motivation: z.string(),
    relevantExperience: z.string(),
    portfolio: z.string().nullable(),
    topPick: z.boolean(),
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

export const createLaunchpadApplicationBatchResponseSchema = z
  .object({
    ok: z.literal(true),
    applications: z.array(launchpadApplicationSchema),
  })
  .openapi("CreateLaunchpadApplicationBatchResponse");

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

export const launchpadApplicationBatchErrorResponseSchema = z
  .union([
    launchpadApplicationValidationErrorResponseSchema,
    launchpadApplicationOperationErrorResponseSchema,
  ])
  .openapi("LaunchpadApplicationBatchErrorResponse");
