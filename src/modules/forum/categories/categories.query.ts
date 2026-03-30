import { eq, getTableColumns, sql, and, isNull } from "drizzle-orm";
import { db } from "../../../db/index";
import { forumCategory, forumQuestion } from "../../../db/schema";
import {
  FORUM_ADVISORY_LOCK_NAMESPACE,
  FORUM_CATEGORY_DISPLAY_ORDER_LOCK_KEY,
} from "../lib/constants";
import type { CreateCategoryInput } from "./categories.schema";

type ForumCategoryRow = typeof forumCategory.$inferSelect;
type ForumCategoryInsert = typeof forumCategory.$inferInsert;
type ForumCategoryWithQuestionCountRow = ForumCategoryRow & {
  questionCount: number;
};

export async function getCategories(): Promise<ForumCategoryWithQuestionCountRow[]> {
  return db
    .select({
      ...getTableColumns(forumCategory),
      questionCount: sql<number>`count(${forumQuestion.id})::int`,
    })
    .from(forumCategory)
    .leftJoin(forumQuestion, eq(forumCategory.id, forumQuestion.categoryId))
    .where(and(
      eq(forumCategory.status, "ACTIVE"),
      // Using Drizzle's built-in isNull helper is cleaner than raw SQL
      isNull(forumQuestion.deletedAt)
    ))
    .groupBy(
      forumCategory.id,
      forumCategory.name,
      forumCategory.slug,
      forumCategory.description,
      forumCategory.displayOrder,
      forumCategory.status,
      forumCategory.createdBy,
      forumCategory.updatedBy,
      forumCategory.createdAt,
      forumCategory.updatedAt,
      forumCategory.archivedAt,
    )
    .orderBy(forumCategory.displayOrder);
}

export async function findCategoryById(
  id: string,
): Promise<ForumCategoryRow | null> {
  const rows = await db
    .select()
    .from(forumCategory)
    .where(eq(forumCategory.id, id));
  return rows[0] ?? null;
}

export async function findCategoryByName(
  name: string,
): Promise<ForumCategoryRow | null> {
  const normalizedName = name.toLowerCase();
  const rows = await db
    .select()
    .from(forumCategory)
    .where(sql`lower(${forumCategory.name}) = ${normalizedName}`);
  return rows[0] ?? null;
}

export async function createCategory(
  data: CreateCategoryInput,
): Promise<ForumCategoryRow> {
  return db.transaction(async (tx) => {
    // Serialize category display-order assignment inside the forum advisory-lock namespace.
    await tx.execute(
      sql`select pg_advisory_xact_lock(${FORUM_ADVISORY_LOCK_NAMESPACE}, ${FORUM_CATEGORY_DISPLAY_ORDER_LOCK_KEY})`,
    );

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

    const [newCategory] = await tx
      .insert(forumCategory)
      .values(insertData)
      .returning();
    return newCategory;
  });
}

export async function updateCategory(
  id: string,
  data: Partial<ForumCategoryInsert>,
): Promise<ForumCategoryRow | null> {
  const [updatedCategory] = await db
    .update(forumCategory)
    .set(data)
    .where(eq(forumCategory.id, id))
    .returning();
  return updatedCategory ?? null;
}

export async function archiveCategory(
  id: string,
): Promise<ForumCategoryRow | null> {
  const [updatedCategory] = await db
    .update(forumCategory)
    .set({ status: "ARCHIVED" })
    .where(eq(forumCategory.id, id))
    .returning();
  return updatedCategory ?? null;
}
