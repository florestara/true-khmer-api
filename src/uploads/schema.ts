import { z } from "zod";

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_SIZE_MB = MAX_AVATAR_SIZE_BYTES / (1024 * 1024);
const ALLOWED_AVATAR_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const SAFE_FILE_NAME = /^[A-Za-z0-9._-]+$/;

export const presignAvatarUploadSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, "fileName is required")
    .max(120, "fileName must be <= 120 characters")
    .regex(SAFE_FILE_NAME, "fileName contains invalid characters"),
  contentType: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (value) =>
        (ALLOWED_AVATAR_CONTENT_TYPES as readonly string[]).includes(value),
      "Unsupported image contentType",
    ),
  fileSize: z
    .number()
    .int("fileSize must be an integer")
    .positive("fileSize must be positive")
    .max(MAX_AVATAR_SIZE_BYTES, `fileSize must be <= ${MAX_AVATAR_SIZE_MB} MB`),
});

export type PresignAvatarUploadPayload = z.infer<typeof presignAvatarUploadSchema>;
export { ALLOWED_AVATAR_CONTENT_TYPES, MAX_AVATAR_SIZE_BYTES };
