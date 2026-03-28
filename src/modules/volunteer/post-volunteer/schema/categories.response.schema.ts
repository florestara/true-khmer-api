import { z } from "zod";

export const volunteerCategoryResponseSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    iconKey: z.string().nullable(),
    displayOrder: z.number(),
    status: z.enum(["ACTIVE", "ARCHIVED", "HIDDEN"]),
    createdBy: z.string(),
    updatedBy: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    archivedAt: z.string().nullable(),
  })
  .openapi("VolunteerCategoryResponse");

export const volunteerCategoryOperationErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("VolunteerCategoryOperationErrorResponse");

export const volunteerCategoryValidationErrorResponseSchema = z
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
  .openapi("VolunteerCategoryValidationErrorResponse");

export const volunteerCategoryAuthErrorResponseSchema = z
  .object({
    error: z.string(),
    code: z.string().optional(),
  })
  .openapi("VolunteerCategoryAuthErrorResponse");

export const getVolunteerCategoriesResponseSchema = z
  .object({
    ok: z.literal(true),
    categories: z.array(volunteerCategoryResponseSchema),
  })
  .openapi("GetVolunteerCategoriesResponse");

export const createVolunteerCategoryResponseSchema = z
  .object({
    ok: z.literal(true),
    category: volunteerCategoryResponseSchema,
  })
  .openapi("CreateVolunteerCategoryResponse");
