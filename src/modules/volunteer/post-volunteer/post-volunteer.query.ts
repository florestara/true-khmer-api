import { eq, sql } from "drizzle-orm";
import { db } from "../../../db/index";
import { volunteerCategory } from "../../../db/schema";
import {
  VOLUNTEER_ADVISORY_LOCK_NAMESPACE,
  VOLUNTEER_CATEGORY_DISPLAY_ORDER_LOCK_KEY,
} from "../lib/constants";
import type { CreateVolunteerCategoryInput } from "./post-volunteer.schema";

type VolunteerCategoryRow = typeof volunteerCategory.$inferSelect;
type VolunteerCategoryInsert = typeof volunteerCategory.$inferInsert;

export async function getVolunteerCategories(): Promise<VolunteerCategoryRow[]> {
  return db
    .select()
    .from(volunteerCategory)
    .where(eq(volunteerCategory.status, "ACTIVE"))
    .orderBy(volunteerCategory.displayOrder, volunteerCategory.name);
}

export async function createVolunteerCategory(
  data: CreateVolunteerCategoryInput,
): Promise<VolunteerCategoryRow> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${VOLUNTEER_ADVISORY_LOCK_NAMESPACE}, ${VOLUNTEER_CATEGORY_DISPLAY_ORDER_LOCK_KEY})`,
    );

    const [orderRow] = await tx
      .select({
        maxDisplayOrder: sql`coalesce(max(${volunteerCategory.displayOrder}), -1)`,
      })
      .from(volunteerCategory);

    const rawMaxDisplayOrder = orderRow?.maxDisplayOrder;
    const maxDisplayOrderNumber =
      typeof rawMaxDisplayOrder === "number"
        ? rawMaxDisplayOrder
        : Number(rawMaxDisplayOrder ?? -1);

    if (!Number.isFinite(maxDisplayOrderNumber)) {
      throw new Error("Invalid display order value returned from database");
    }

    const insertData: VolunteerCategoryInsert = {
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      iconKey: data.iconKey ?? null,
      displayOrder: maxDisplayOrderNumber + 1,
      status: "ACTIVE",
      createdBy: data.createdBy,
    };

    const [newCategory] = await tx
      .insert(volunteerCategory)
      .values(insertData)
      .returning();

    return newCategory;
  });
}
