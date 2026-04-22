import { eq, getTableColumns, and } from "drizzle-orm";
import { db } from "../../../db/index";
import { launchpadCategory } from "../../../db/schema/launchpad/categories/categories";

type LaunchpadCategoryRow = typeof launchpadCategory.$inferSelect;

export async function getLaunchpadCategories(): Promise<
  LaunchpadCategoryRow[]
> {
  return db
    .select({ ...getTableColumns(launchpadCategory) })
    .from(launchpadCategory)
    .where(eq(launchpadCategory.status, "ACTIVE"))
    .orderBy(launchpadCategory.displayOrder);
}

export async function findLaunchpadCategoryById({
  id,
}: {
  id: string;
}): Promise<LaunchpadCategoryRow | null> {
  const result = await db
    .select({ ...getTableColumns(launchpadCategory) })
    .from(launchpadCategory)
    .where(
      and(eq(launchpadCategory.status, "ACTIVE"), eq(launchpadCategory.id, id)),
    )
    .orderBy(launchpadCategory.displayOrder);

  if (result.length === 0) {
    return null;
  }

  return result[0];
}
