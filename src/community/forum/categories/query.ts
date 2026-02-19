import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../../db/index";
import { forumCategory } from "../../../db/schema";
import type { CreateCategoryInput } from "./schema";

type ForumCategoryRow = typeof forumCategory.$inferSelect;
type ForumCategoryInsert = typeof forumCategory.$inferInsert;

export async function findCategoryById(id: string): Promise<ForumCategoryRow | null> {
  const rows = await db.select().from(forumCategory).where(eq(forumCategory.id, id));
  return rows[0] ?? null;
}

export async function findCategoryByParentAndName(
  parentId: string | null,
  name: string
): Promise<ForumCategoryRow | null> {
  const condition = parentId
    ? and(eq(forumCategory.parentId, parentId), eq(forumCategory.name, name))
    : and(isNull(forumCategory.parentId), eq(forumCategory.name, name));

  const rows = await db.select().from(forumCategory).where(condition);
  return rows[0] ?? null;
}

export async function createCategory(
  data: CreateCategoryInput
): Promise<ForumCategoryRow> {
  const insertData: ForumCategoryInsert = {
    parentId: data.parentId ?? null,
    name: data.name,
    slug: data.slug,
    description: data.description ?? null,
    icon: data.icon ?? null,
    color: data.color ?? null,
    displayOrder: data.displayOrder ?? 0,
    status: data.status ?? "ACTIVE",
    createdBy: data.createdBy,
    type: data.type ?? "CATEGORY",
  };

  const [newCategory] = await db.insert(forumCategory).values(insertData).returning();
  return newCategory;
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
