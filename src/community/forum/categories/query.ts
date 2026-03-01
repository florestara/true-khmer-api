import { eq, sql } from "drizzle-orm";
import { db } from "../../../db/index";
import { forumCategory } from "../../../db/schema";
import type { CreateCategoryInput } from "./schema";

type ForumCategoryRow = typeof forumCategory.$inferSelect;
type ForumCategoryInsert = typeof forumCategory.$inferInsert;

export async function findCategoryById(id: string): Promise<ForumCategoryRow | null> {
  const rows = await db.select().from(forumCategory).where(eq(forumCategory.id, id));
  return rows[0] ?? null;
}

export async function findCategoryByName(name: string): Promise<ForumCategoryRow | null> {
  const rows = await db.select().from(forumCategory).where(eq(forumCategory.name, name));
  return rows[0] ?? null;
}

export async function createCategory(
  data: CreateCategoryInput
): Promise<ForumCategoryRow> {
  return db.transaction(async (tx) => {
    // Namespaced advisory lock: (100 = forum domain, 1 = category display order sequence).
    await tx.execute(sql`select pg_advisory_xact_lock(100, 1)`);

    const [orderRow] = await tx
      .select({
        maxDisplayOrder: sql`coalesce(max(${forumCategory.displayOrder}), -1)`,
      })
      .from(forumCategory);

    const rawMaxDisplayOrder = orderRow?.maxDisplayOrder;
    const maxDisplayOrderNumber =
      typeof rawMaxDisplayOrder === "number"
        ? rawMaxDisplayOrder
        : Number(rawMaxDisplayOrder ?? -1);

    if (!Number.isFinite(maxDisplayOrderNumber)) {
      throw new Error("Invalid display order value returned from database");
    }

    const insertData: ForumCategoryInsert = {
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      displayOrder: maxDisplayOrderNumber + 1,
      status: "ACTIVE",
      createdBy: data.createdBy,
    };

    const [newCategory] = await tx.insert(forumCategory).values(insertData).returning();
    return newCategory;
  });
}

export async function updateCategory(
  id: string,
  data: Partial<ForumCategoryInsert>
): Promise<ForumCategoryRow | null> {
  const [updatedCategory] = await db
    .update(forumCategory)
    .set(data)
    .where(eq(forumCategory.id, id))
    .returning();
  return updatedCategory ?? null;
}

export async function archiveCategory(
  id: string
): Promise<ForumCategoryRow | null> {
  const [updatedCategory] = await db
    .update(forumCategory)
    .set({ status: "ARCHIVED" })
    .where(eq(forumCategory.id, id))
    .returning();
  return updatedCategory ?? null;
}
