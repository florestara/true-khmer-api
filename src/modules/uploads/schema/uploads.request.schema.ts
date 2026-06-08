import { z } from "zod";

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_SIZE_MB = MAX_AVATAR_SIZE_BYTES / (1024 * 1024);
const ALLOWED_AVATAR_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const presignAvatarUploadSchema = z
  .object({
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
      .max(
        MAX_AVATAR_SIZE_BYTES,
        `fileSize must be <= ${MAX_AVATAR_SIZE_MB} MB`,
      ),
  })
  .openapi("PresignAvatarUploadRequest");

export type PresignAvatarUploadPayload = z.infer<
  typeof presignAvatarUploadSchema
>;

export { ALLOWED_AVATAR_CONTENT_TYPES, MAX_AVATAR_SIZE_BYTES };
