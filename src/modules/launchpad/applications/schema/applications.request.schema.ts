import { z } from "@hono/zod-openapi";
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

const launchpadApplicationRelevantExperienceSchema = z
  .string()
  .trim()
  .min(1, "relevantExperience is required")
  .max(5000, "relevantExperience must be at most 5000 characters");

const launchpadApplicationBaseSchema = z.object({
  motivation: z
    .string()
    .trim()
    .min(5, "motivation must be at least 5 characters")
    .max(2000, "motivation must be at most 2000 characters"),
  portfolio: z
    .string()
    .trim()
    .url("portfolio must be a valid URL")
    .refine((url) => url.startsWith("https://"), "portfolio must use HTTPS")
    .max(255, "portfolio must be <= 255 characters")
    .optional(),
  documentKeys: z
    .array(z.string().trim().min(1).max(500))
    .max(5, "documentKeys can have at most 5 entries")
    .optional(),
  documentNames: z
    .array(z.string().trim().min(1).max(255))
    .max(5, "documentNames can have at most 5 entries")
    .optional(),
  topPickRoleId: z
    .string()
    .trim()
    .regex(FORUM_UUID_RE, "topPickRoleId must be a valid UUID")
    .nullish()
    .transform((value) => value ?? null),
});

export const createLaunchpadApplicationSchema = launchpadApplicationBaseSchema
  .extend({
    launchpadRoleId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "launchpadRoleId must be a valid UUID"),
    relevantExperience: launchpadApplicationRelevantExperienceSchema
      .optional()
      .default(""),
  })
  .superRefine((value, ctx) => {
    if (value.topPickRoleId && value.topPickRoleId !== value.launchpadRoleId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["topPickRoleId"],
        message: "topPickRoleId must match launchpadRoleId",
      });
    }
  })
  .openapi("CreateLaunchpadApplicationRequest");

export const createLaunchpadApplicationBatchSchema =
  launchpadApplicationBaseSchema
    .extend({
      relevantExperience: launchpadApplicationRelevantExperienceSchema,
      launchpadRoleIds: z
        .array(
          z
            .string()
            .trim()
            .regex(FORUM_UUID_RE, "launchpadRoleIds[] must be a valid UUID"),
        )
        .min(1, "launchpadRoleIds must contain at least 1 role")
        .max(20, "launchpadRoleIds must contain at most 20 roles")
        .superRefine((value, ctx) => {
          const seen = new Set<string>();
          value.forEach((roleId, index) => {
            if (seen.has(roleId)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [index],
                message: "launchpadRoleIds[] must not contain duplicate roles",
              });
              return;
            }

            seen.add(roleId);
          });
        }),
    })
    .superRefine((value, ctx) => {
      if (
        value.topPickRoleId &&
        !value.launchpadRoleIds.includes(value.topPickRoleId)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["topPickRoleId"],
          message: "topPickRoleId must be one of launchpadRoleIds",
        });
      }
    })
    .openapi("CreateLaunchpadApplicationBatchRequest");

export type PresignLaunchpadApplicationDocumentUploadPayload = z.infer<
  typeof presignLaunchpadApplicationDocumentUploadSchema
>;
export type CreateLaunchpadApplicationInput = z.infer<
  typeof createLaunchpadApplicationSchema
>;
export type CreateLaunchpadApplicationBatchInput = z.infer<
  typeof createLaunchpadApplicationBatchSchema
>;
export type LaunchpadApplicationParamInput = z.infer<
  typeof launchpadApplicationParamSchema
>;
export type LaunchpadApplicationByIdParamInput = z.infer<
  typeof launchpadApplicationByIdParamSchema
>;
