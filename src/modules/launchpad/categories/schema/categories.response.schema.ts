import { z } from "zod";

export const launchpadCategoryResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    iconKey: z.string(),
    displayOrder: z.number(),
    status: z.enum(["ACTIVE", "ARCHIVED", "HIDDEN"]),
    totalLaunchpad: z.number(),
    createdBy: z.string(),
    updatedBy: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("LaunchpadCategoryResponse");

export const getLaunchpadCategoriesResponseSchema = z
  .object({
    ok: z.boolean(),
    categories: z.array(launchpadCategoryResponseSchema),
  })
  .openapi("GetLaunchpadCategoriesResponse");
