import { z } from "zod";

const LAUNCHPAD_LOGO_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const LAUNCHPAD_DOCUMENT_ALLOWED_CONTENT_TYPE = "application/pdf";
export const LAUNCHPAD_LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const LAUNCHPAD_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const presignLaunchpadImageUploadSchema = z
  .object({
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
  .openapi("PresignLaunchpadImageUploadRequest");

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

export type PresignLaunchpadImageUploadPayload = z.infer<
  typeof presignLaunchpadImageUploadSchema
>;

export type PresignLaunchpadDocumentUploadPayload = z.infer<
  typeof presignLaunchpadDocumentUploadSchema
>;
