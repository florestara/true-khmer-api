import { and, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "../../db/index";
import {
  pointSystems,
  pointTransactions,
} from "../../db/schema/point_system/point-systems";
import type { pointTransactionsActionType } from "../../db/schema/point_system/point-systems";
import {
  userProgress,
  tier,
  forumQuestion,
  forumAnswer,
} from "../../db/schema";
import { tierHistory } from "../../db/schema/point_system/point-systems";

export type ActionType =
  (typeof pointTransactionsActionType.enumValues)[number];

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
  txOrDb: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db = db,
) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [result] = await txOrDb
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
  maxPerDay?: number;
}) {
  return await db.transaction(async (tx) => {
    // Enforce daily cap inside the transaction to prevent races
    if (data.maxPerDay && data.maxPerDay > 0) {
      const todayCount = await countUserTransactionsToday(
        data.userId,
        data.actionType,
        tx,
      );
      if (todayCount >= data.maxPerDay) {
        return null;
      }
    }

    const [row] = await tx
      .insert(pointTransactions)
      .values({
        userId: data.userId,
        actionType: data.actionType,
        points: data.points,
        referenceType: data.referenceType ?? null,
        referenceId: data.referenceId ?? null,
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

    // Lock the row to prevent concurrent tier transitions for the same user
    const [progress] = await tx
      .select({
        totalPoints: userProgress.totalPoints,
        currentTierId: userProgress.currentTierId,
      })
      .from(userProgress)
      .where(eq(userProgress.userId, data.userId))
      .for("update");

    if (!progress) {
      throw new Error(`User progress not found for userId: ${data.userId}`);
    }

    const [qualifiedTier] = await tx
      .select({ id: tier.id, rankOrder: tier.rankOrder })
      .from(tier)
      .where(lte(tier.minPoints, progress.totalPoints))
      .orderBy(desc(tier.minPoints))
      .limit(1);

    if (qualifiedTier && qualifiedTier.id !== progress.currentTierId) {
      // Only record tier history for upgrades, not downgrades
      const isUpgrade = progress.currentTierId
        ? await (async () => {
            const [currentTier] = await tx
              .select({ rankOrder: tier.rankOrder })
              .from(tier)
              .where(eq(tier.id, progress.currentTierId!))
              .limit(1);
            return (
              !currentTier || qualifiedTier.rankOrder > currentTier.rankOrder
            );
          })()
        : true;

      await tx
        .update(userProgress)
        .set({
          currentTierId: qualifiedTier.id,
          updatedAt: new Date(),
        })
        .where(eq(userProgress.userId, data.userId));

      if (isUpgrade) {
        await tx
          .insert(tierHistory)
          .values({
            userId: data.userId,
            tierId: qualifiedTier.id,
            pointsAtTime: progress.totalPoints,
          })
          .onConflictDoNothing({
            target: [tierHistory.userId, tierHistory.tierId],
          });
      }
    }

    return row;
  });
}

export async function getForumQuestionById(questionId: string) {
  const [row] = await db
    .select()
    .from(forumQuestion)
    .where(eq(forumQuestion.id, questionId))
    .limit(1);
  return row ?? null;
}

export async function countUserAnswersInThread(
  userId: string,
  questionId: string,
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(forumAnswer)
    .where(
      and(
        eq(forumAnswer.authorId, userId),
        eq(forumAnswer.questionId, questionId),
        ne(forumAnswer.status, "DELETED"),
      ),
    );
  return result?.count ?? 0;
}

export async function getHighestAwardedMilestone(
  userId: string,
  actionType: ActionType,
  referenceType: string,
  referenceId: string,
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pointTransactions)
    .where(
      and(
        eq(pointTransactions.userId, userId),
        eq(pointTransactions.actionType, actionType),
        eq(pointTransactions.referenceType, referenceType),
        eq(pointTransactions.referenceId, referenceId),
      ),
    );
  // Each row represents one milestone (10, 20, 30, ...), so count * 10 = highest milestone
  return (result?.count ?? 0) * 10;
}

export async function isUsersFirstQuestion(
  userId: string,
  questionId: string,
): Promise<boolean> {
  const [earliest] = await db
    .select({ id: forumQuestion.id })
    .from(forumQuestion)
    .where(
      and(
        eq(forumQuestion.authorId, userId),
        ne(forumQuestion.status, "DELETED"),
      ),
    )
    .orderBy(forumQuestion.createdAt)
    .limit(1);
  return earliest?.id === questionId;
}
