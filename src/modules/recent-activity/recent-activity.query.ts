import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { recentActivity } from "../../db/schema";

export type RecentActivityRow = typeof recentActivity.$inferSelect;
export type RecentActivityInsert = typeof recentActivity.$inferInsert;
type RecentActivityExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function insertRecentActivity(
  data: RecentActivityInsert,
  executor: RecentActivityExecutor = db,
) {
  const [row] = await executor.insert(recentActivity).values(data).returning();
  return row;
}

export async function deleteRecentActivitiesByReference(params: {
  userId: string;
  referenceType: string;
  referenceId: string;
  types: string[];
}, executor: RecentActivityExecutor = db) {
  if (params.types.length === 0) {
    return [];
  }

  return executor
    .delete(recentActivity)
    .where(
      and(
        eq(recentActivity.userId, params.userId),
        eq(recentActivity.referenceType, params.referenceType),
        eq(recentActivity.referenceId, params.referenceId),
        inArray(recentActivity.type, params.types),
      ),
    )
    .returning({ id: recentActivity.id });
}

export async function findRecentActivitiesByUserId(
  userId: string,
  limit: number,
): Promise<RecentActivityRow[]> {
  return db
    .select()
    .from(recentActivity)
    .where(eq(recentActivity.userId, userId))
    .orderBy(desc(recentActivity.createdAt), desc(recentActivity.id))
    .limit(limit);
}
