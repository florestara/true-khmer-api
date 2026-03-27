import { z } from "zod";

export const categoryResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    displayOrder: z.number(),
    status: z.string(),
  })
  .openapi("CategoryResponse");

export const getCategoriesResponseSchema = z
  .object({
    ok: z.boolean(),
    categories: z.array(categoryResponseSchema),
  })
  .openapi("GetCategoriesResponse");

export const createCategoryResponseSchema = z
  .object({
    ok: z.boolean(),
    category: categoryResponseSchema,
  })
  .openapi("CreateCategoryResponse");
