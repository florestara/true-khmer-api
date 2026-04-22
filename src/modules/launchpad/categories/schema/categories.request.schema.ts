import { z } from "zod";
import { FORUM_UUID_RE } from "../../../forum/lib/constants";

export const getLaunchpadCategoriesParamsSchema = z
  .object({
    categoryId: z
      .string()
      .trim()
      .regex(FORUM_UUID_RE, "category ID must be a valid UUID"),
  })
  .openapi("GetLaunchpadCategoriesParams");

export type LaunchpadCategoriesParams = z.infer<
  typeof getLaunchpadCategoriesParamsSchema
>;
