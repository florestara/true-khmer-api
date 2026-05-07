import { z } from "zod";
import { VOLUNTEER_UUID_RE } from "../../volunteer/lib/constants";

const VOLUNTEER_APPLICATION_DOCUMENT_CONTENT_TYPE = "application/pdf";
const MIN_VOLUNTEER_APPLICATION_DOCUMENT_COUNT = 1;
const MAX_VOLUNTEER_APPLICATION_DOCUMENT_COUNT = 3;

export const VOLUNTEER_APPLICATION_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export const presignVolunteerApplicationDocumentUploadSchema = z
  .object({
    opportunityId: z
      .string()
      .trim()
      .regex(VOLUNTEER_UUID_RE, "opportunityId must be a valid UUID"),
    files: z
      .array(
        z.object({
          contentType: z
            .string()
            .trim()
            .toLowerCase()
            .refine(
              (value) => value === VOLUNTEER_APPLICATION_DOCUMENT_CONTENT_TYPE,
              "Supporting document must be a PDF",
            ),
          fileSize: z
            .number()
            .int("fileSize must be an integer")
            .positive("fileSize must be positive")
            .max(
              VOLUNTEER_APPLICATION_DOCUMENT_MAX_BYTES,
              `fileSize must be <= ${VOLUNTEER_APPLICATION_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB`,
            ),
        }),
      )
      .min(
        MIN_VOLUNTEER_APPLICATION_DOCUMENT_COUNT,
        `files must contain at least ${MIN_VOLUNTEER_APPLICATION_DOCUMENT_COUNT} files`,
      )
      .max(
        MAX_VOLUNTEER_APPLICATION_DOCUMENT_COUNT,
        `files must contain at most ${MAX_VOLUNTEER_APPLICATION_DOCUMENT_COUNT} files`,
      ),
  })
  .openapi("PresignVolunteerApplicationDocumentUploadRequest");

export const createVolunteerApplicationSchema = z
  .object({
    roleId: z.string().uuid("roleId must be a valid UUID"),
    availability: z
      .string()
      .transform((value) => normalizeText(value))
      .pipe(
        z
          .string()
          .min(1, "availability is required and must be 1..500 characters")
          .max(500, "availability is required and must be 1..500 characters"),
      ),
    relevantExperience: z
      .string()
      .transform((value) => normalizeText(value))
      .pipe(
        z
          .string()
          .min(
            1,
            "relevantExperience is required and must be 1..5000 characters",
          )
          .max(
            5000,
            "relevantExperience is required and must be 1..5000 characters",
          ),
      ),
    supportingDocumentKeys: z
      .array(
        z
          .string()
          .trim()
          .min(1, "supportingDocumentKeys[] is required")
          .max(600, "supportingDocumentKeys[] must be <= 600 characters"),
      )
      .min(
        MIN_VOLUNTEER_APPLICATION_DOCUMENT_COUNT,
        `supportingDocumentKeys must contain at least ${MIN_VOLUNTEER_APPLICATION_DOCUMENT_COUNT} files`,
      )
      .max(
        MAX_VOLUNTEER_APPLICATION_DOCUMENT_COUNT,
        `supportingDocumentKeys must contain at most ${MAX_VOLUNTEER_APPLICATION_DOCUMENT_COUNT} files`,
      )
      .superRefine((value, ctx) => {
        const seen = new Set<string>();
        value.forEach((item, index) => {
          if (seen.has(item)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index],
              message: "supportingDocumentKeys[] must not contain duplicates",
            });
            return;
          }

          seen.add(item);
        });
      }),
  })
  .openapi("CreateVolunteerApplicationRequest");

export type PresignVolunteerApplicationDocumentUploadPayload = z.infer<
  typeof presignVolunteerApplicationDocumentUploadSchema
>;

export type CreateVolunteerApplicationBodyInput = z.infer<
  typeof createVolunteerApplicationSchema
>;
