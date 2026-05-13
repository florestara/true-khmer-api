import { Context } from "hono";
import {
  findLaunchpadCategoryById,
  getLaunchpadCategories,
} from "./categories.query";
import { launchpadCategory } from "../../../db/schema";
import { LaunchpadCategoriesParams } from "./schema/categories.request.schema";

type LaunchpadCategoryRow = typeof launchpadCategory.$inferSelect;

function formatCategory(category: LaunchpadCategoryRow) {
  return {
    id: category?.id,
    name: category?.name,
    slug: category?.slug,
    iconKey: category?.iconKey,
    displayOrder: category?.displayOrder,
    status: category?.status,
    totalLaunchpad: category?.totalLaunchpad,
    createdBy: category?.createdBy,
    updatedBy: category?.updatedBy,
    createdAt: category?.createdAt,
    updatedAt: category?.updatedAt,
  };
}

export async function handleGetLaunchpadCategories(c: Context) {
  try {
    const categories = await getLaunchpadCategories();

    return c.json(
      {
        ok: true,
        categories: categories.map(formatCategory),
      },
      200,
    );
  } catch (err) {
    console.error("Failed to get launchpad categories", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}

export async function handleGetLaunchpadCategory(
  c: Context,
  params: LaunchpadCategoriesParams,
) {
  try {
    const category = await findLaunchpadCategoryById({
      id: params.categoryId,
    });

    if (!category) {
      return c.json({ ok: false, error: "Launchpad Category not found" }, 404);
    }

    return c.json(
      {
        ok: true,
        category: formatCategory(category),
      },
      200,
    );
  } catch (err) {
    console.error("Failed to get launchpad category", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
