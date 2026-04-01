import { z } from "zod";

export const categoryResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    displayOrder: z.number(),
    status: z.enum(["ACTIVE", "ARCHIVED", "HIDDEN"]),
    createdBy: z.string(),
    updatedBy: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    archivedAt: z.string().nullable(),
  })
  .openapi("CategoryResponse");

export const categoryWithQuestionCountResponseSchema = categoryResponseSchema
  .extend({
    questionCount: z.number(),
  })
  .openapi("CategoryWithQuestionCountResponse");

export const getCategoriesResponseSchema = z
  .object({
    ok: z.boolean(),
    categories: z.array(categoryWithQuestionCountResponseSchema),
  })
  .openapi("GetCategoriesResponse");

export const createCategoryResponseSchema = z
  .object({
    ok: z.boolean(),
    category: categoryResponseSchema,
  })
  .openapi("CreateCategoryResponse");
