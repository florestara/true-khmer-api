import { z } from "zod";

export const presignAvatarUploadResultSchema = z
  .object({
    uploadUrl: z.string(),
    method: z.literal("PUT"),
    requiredHeaders: z.object({
      "Content-Length": z.string(),
      "Content-Type": z.string(),
    }),
    avatarKey: z.string(),
    publicUrl: z.string().nullable(),
    expiresInSeconds: z.number(),
  })
  .openapi("PresignAvatarUploadResult");

export const presignAvatarUploadResponseSchema = z
  .object({
    ok: z.boolean(),
    upload: presignAvatarUploadResultSchema,
  })
  .openapi("PresignAvatarUploadResponse");
