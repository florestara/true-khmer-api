import { z } from "zod";
import { FORUM_UUID_RE } from "../../../forum/lib/constants";

const LAUNCHPAD_APPLICATION_DOCUMENT_ALLOWED_CONTENT_TYPE = "application/pdf";
const LAUNCHPAD_APPLICATION_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const presignLaunchpadApplicationDocumentUploadSchema = z
  .object({
    contentType: z
      .string()
      .trim()
      .toLowerCase()
      .refine(
        (value) =>
          value === LAUNCHPAD_APPLICATION_DOCUMENT_ALLOWED_CONTENT_TYPE,
        "document must be a PDF",
      ),
    fileSize: z
      .number()
      .int("fileSize must be an integer")
      .positive("fileSize must be positive")
      .max(
        LAUNCHPAD_APPLICATION_DOCUMENT_MAX_BYTES,
        `fileSize must be <= ${LAUNCHPAD_APPLICATION_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB`,
      ),
  })
  .openapi("PresignLaunchpadApplicationDocumentUploadRequest");

export const launchpadApplicationParamSchema = z.object({
  launchpadId: z
    .string()
    .trim()
    .regex(FORUM_UUID_RE, "launchpadId must be a valid UUID"),
});

export const launchpadApplicationByIdParamSchema = z.object({
  launchpadId: z
    .string()
    .trim()
    .regex(FORUM_UUID_RE, "launchpadId must be a valid UUID"),
  applicationId: z
    .string()
    .trim()
    .regex(FORUM_UUID_RE, "applicationId must be a valid UUID"),
});

export const createLaunchpadApplicationSchema = z
  .object({
    launchpadRoleId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "launchpadRoleId must be a valid UUID"),
    motivation: z
      .string()
      .trim()
      .min(10, "motivation must be at least 10 characters")
      .max(2000, "motivation must be at most 2000 characters"),
    portfolio: z
      .string()
      .trim()
      .url("portfolio must be a valid URL")
      .max(255, "portfolio must be <= 255 characters"),
    documentKeys: z
      .array(z.string().trim().min(1).max(500))
      .max(5, "documentKeys can have at most 5 entries")
      .default([]),
    documentNames: z
      .array(z.string().trim().min(1).max(255))
      .max(5, "documentNames can have at most 5 entries")
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (data.documentKeys.length !== data.documentNames.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "documentKeys and documentNames must have the same number of entries",
        path: ["documentNames"],
      });
    }
  })
  .openapi("CreateLaunchpadApplicationRequest");

export type PresignLaunchpadApplicationDocumentUploadPayload = z.infer<
  typeof presignLaunchpadApplicationDocumentUploadSchema
>;
export type CreateLaunchpadApplicationInput = z.infer<
  typeof createLaunchpadApplicationSchema
>;
export type LaunchpadApplicationParamInput = z.infer<
  typeof launchpadApplicationParamSchema
>;
export type LaunchpadApplicationByIdParamInput = z.infer<
  typeof launchpadApplicationByIdParamSchema
>;
