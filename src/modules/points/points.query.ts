import { and, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "../../db/index";
import {
  pointSystems,
  pointTransactions,
} from "../../db/schema/point_system/point-systems";
import type { pointTransactionsActionType } from "../../db/schema/point_system/point-systems";
import { userProgress, tier, forumQuestion } from "../../db/schema";
import { tierHistory } from "../../db/schema/point_system/point-systems";

type ActionType = (typeof pointTransactionsActionType.enumValues)[number];

export async function getPointSystemByKey(key: string) {
  const [row] = await db
    .select()
    .from(pointSystems)
    .where(eq(pointSystems.key, key))
    .limit(1);
  return row ?? null;
}

export async function countUserTransactionsToday(
  userId: string,
  actionType: ActionType,
) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pointTransactions)
    .where(
      and(
        eq(pointTransactions.userId, userId),
        eq(pointTransactions.actionType, actionType),
        gte(pointTransactions.createdAt, startOfDay),
      ),
    );
  return result?.count ?? 0;
}

export async function insertPointTransaction(data: {
  userId: string;
  actionType: ActionType;
  points: number;
  referenceType?: string;
  referenceId?: string;
  pool?: "active" | "legacy" | "tier";
  mode?: "action" | "support";
}) {
  return await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(pointTransactions)
      .values({
        userId: data.userId,
        actionType: data.actionType,
        points: data.points,
        reference_type: data.referenceType ?? null,
        reference_id: data.referenceId ?? null,
        pool: data.pool ?? "active",
        mode: data.mode ?? "action",
      })
      .returning();

    await tx
      .insert(userProgress)
      .values({
        userId: data.userId,
        totalPoints: data.points,
      })
      .onConflictDoUpdate({
        target: userProgress.userId,
        set: {
          totalPoints: sql`${userProgress.totalPoints} + ${data.points}`,
          updatedAt: new Date(),
        },
      });

    const [progress] = await tx
      .select({
        totalPoints: userProgress.totalPoints,
        currentTierId: userProgress.currentTierId,
      })
      .from(userProgress)
      .where(eq(userProgress.userId, data.userId));

    const [qualifiedTier] = await tx
      .select({ id: tier.id })
      .from(tier)
      .where(lte(tier.minPoints, progress.totalPoints))
      .orderBy(desc(tier.minPoints))
      .limit(1);

    if (qualifiedTier && qualifiedTier.id !== progress.currentTierId) {
      await tx
        .update(userProgress)
        .set({
          currentTierId: qualifiedTier.id,
          updatedAt: new Date(),
        })
        .where(eq(userProgress.userId, data.userId));

      await tx.insert(tierHistory).values({
        userId: data.userId,
        tierId: qualifiedTier.id,
        pointsAtTime: progress.totalPoints,
      });
    }

    return row;
  });
}

/**
 * Get a forum question by ID.
 */
export async function getForumQuestionById(questionId: string) {
  const [row] = await db
    .select()
    .from(forumQuestion)
    .where(eq(forumQuestion.id, questionId))
    .limit(1);
  return row ?? null;
}

/**
 * Count how many non-deleted questions a user has posted.
 */
export async function countUserForumQuestions(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(forumQuestion)
    .where(
      and(
        eq(forumQuestion.authorId, userId),
        ne(forumQuestion.status, "DELETED"),
      ),
    );
  return result?.count ?? 0;
}
