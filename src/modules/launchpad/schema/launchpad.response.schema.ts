import { z } from "zod";
import { LaunchpadRole, LaunchpadListItem } from "../launchpad.query";

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
    upload: presignLaunchpadLogoUploadResultSchema,
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
    upload: presignLaunchpadCoverUploadResultSchema,
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
    upload: presignLaunchpadDocumentUploadResultSchema,
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

export const createLaunchpadRoleSchema: z.ZodType<LaunchpadRole> = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  capacity: z.number(),
});

export const createLaunchpadResponseSchema = z
  .object({
    ok: z.literal(true),
    launchpad: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      deadline: z.date().nullable(),
      logoKey: z.string().nullable(),
      coverKey: z.string().nullable(),
      documentKeys: z.array(z.string()),
      phoneNumber: z.string().nullable(),
      email: z.string().nullable(),
      telegramUsername: z.string().nullable(),
      totalView: z.number(),
      createdBy: z.object({
        id: z.string(),
        name: z.string(),
        avatarKey: z.string().nullable(),
        launchpadCount: z.number(),
      }),
      createdAt: z.date(),
      category: z
        .object({
          id: z.string(),
          name: z.string(),
        })
        .optional(),
      city: z
        .object({
          id: z.string(),
          name: z.string(),
        })
        .optional(),
      roles: z.array(createLaunchpadRoleSchema),
    }),
  })
  .openapi("CreateLaunchpadResponse");

export const getLaunchpadByIdResponseSchema = z
  .object({
    ok: z.literal(true),
    launchpad: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      deadline: z.date().nullable(),
      logoKey: z.string().nullable(),
      coverKey: z.string().nullable(),
      documentKeys: z.array(z.string()),
      phoneNumber: z.string().nullable(),
      email: z.string().nullable(),
      telegramUsername: z.string().nullable(),
      createdBy: z.object({
        id: z.string(),
        name: z.string(),
        avatarKey: z.string().nullable(),
        launchpadCount: z.number(),
      }),
      createdAt: z.date(),
      category: z
        .object({
          id: z.string(),
          name: z.string(),
        })
        .optional(),
      city: z
        .object({
          id: z.string(),
          name: z.string(),
        })
        .optional(),
      roles: z.array(createLaunchpadRoleSchema),
      totalView: z.number(),
    }),
  })
  .openapi("GetLaunchpadByIdResponse");

export const launchpadListItemSchema: z.ZodType<LaunchpadListItem> = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  deadline: z.date().nullable(),
  logoKey: z.string().nullable(),
  coverKey: z.string().nullable(),
  documentKeys: z.array(z.string()),
  phoneNumber: z.string().nullable(),
  email: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  createdBy: z.object({
    id: z.string(),
    name: z.string(),
    avatarKey: z.string().nullable(),
    launchpadCount: z.number(),
  }),
  createdAt: z.date(),
  category: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  city: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  totalRoles: z.number(),
  totalView: z.number(),
});

export const getLaunchpadsResponseSchema = z
  .object({
    ok: z.literal(true),
    launchpads: z.array(launchpadListItemSchema),
    nextCursor: z.string().nullable(),
  })
  .openapi("GetLaunchpadsResponse");
