import { z } from "zod";

const LAUNCHPAD_LOGO_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const LAUNCHPAD_DOCUMENT_ALLOWED_CONTENT_TYPE = "application/pdf";
const SAFE_UPLOAD_FILE_NAME = /^[A-Za-z0-9._-]+$/;
export const LAUNCHPAD_LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const LAUNCHPAD_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const presignLaunchpadLogoUploadSchema = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1, "fileName is required")
      .max(120, "fileName must be <= 120 characters")
      .regex(SAFE_UPLOAD_FILE_NAME, "fileName contains invalid characters"),
    contentType: z
      .string()
      .trim()
      .toLowerCase()
      .refine(
        (value) =>
          (LAUNCHPAD_LOGO_ALLOWED_CONTENT_TYPES as readonly string[]).includes(
            value,
          ),
        "Unsupported image contentType",
      ),
    fileSize: z
      .number()
      .int("fileSize must be an integer")
      .positive("fileSize must be positive")
      .max(
        LAUNCHPAD_LOGO_MAX_BYTES,
        `fileSize must be <= ${LAUNCHPAD_LOGO_MAX_BYTES / (1024 * 1024)} MB`,
      ),
  })
  .openapi("PresignLaunchpadLogoUploadRequest");

export const presignLaunchpadDocumentUploadSchema = z
  .object({
    contentType: z
      .string()
      .trim()
      .toLowerCase()
      .refine(
        (value) => value === LAUNCHPAD_DOCUMENT_ALLOWED_CONTENT_TYPE,
        "document must be a PDF",
      ),
    fileSize: z
      .number()
      .int("fileSize must be an integer")
      .positive("fileSize must be positive")
      .max(
        LAUNCHPAD_DOCUMENT_MAX_BYTES,
        `fileSize must be <= ${LAUNCHPAD_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB`,
      ),
  })
  .openapi("PresignLaunchpadDocumentUploadRequest");

export type PresignLaunchpadLogoUploadPayload = z.infer<
  typeof presignLaunchpadLogoUploadSchema
>;

export type PresignLaunchpadDocumentUploadPayload = z.infer<
  typeof presignLaunchpadDocumentUploadSchema
>;
