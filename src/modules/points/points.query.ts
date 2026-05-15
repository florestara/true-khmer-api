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
type PointPool = "active" | "legacy" | "tier";
type PointMode = "action" | "support";
const EARNING_POOLS: PointPool[] = ["active", "legacy", "tier"];

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
        eq(pointTransactions.pool, "active"),
        gte(pointTransactions.createdAt, startOfDay.toISOString()),
      ),
    );
  return result?.count ?? 0;
}

export async function hasPointTransactionForReference(
  userId: string,
  actionType: ActionType,
  referenceType: string,
  referenceId: string,
  txOrDb: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db = db,
) {
  const [row] = await txOrDb
    .select({ id: pointTransactions.id })
    .from(pointTransactions)
    .where(
      and(
        eq(pointTransactions.userId, userId),
        eq(pointTransactions.actionType, actionType),
        eq(pointTransactions.referenceType, referenceType),
        eq(pointTransactions.referenceId, referenceId),
        eq(pointTransactions.pool, "active"),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function hasPointActionForReference(
  actionType: ActionType,
  referenceType: string,
  referenceId: string,
  txOrDb: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db = db,
) {
  const [row] = await txOrDb
    .select({ id: pointTransactions.id })
    .from(pointTransactions)
    .where(
      and(
        eq(pointTransactions.actionType, actionType),
        eq(pointTransactions.referenceType, referenceType),
        eq(pointTransactions.referenceId, referenceId),
        eq(pointTransactions.pool, "active"),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function insertPointTransaction(data: {
  userId: string;
  actionType: ActionType;
  points: number;
  referenceType?: string;
  referenceId?: string;
  pool?: PointPool;
  mode?: PointMode;
  maxPerDay?: number;
  dedupeByReference?: boolean;
}) {
  return await db.transaction(async (tx) => {
    if (
      data.dedupeByReference &&
      data.referenceType &&
      data.referenceId &&
      (await hasPointTransactionForReference(
        data.userId,
        data.actionType,
        data.referenceType,
        data.referenceId,
        tx,
      ))
    ) {
      return null;
    }

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

    const pools = data.pool ? [data.pool] : EARNING_POOLS;
    const rows = await tx
      .insert(pointTransactions)
      .values(pools.map((pool) => ({
        userId: data.userId,
        actionType: data.actionType,
        points: data.points,
        referenceType: data.referenceType ?? null,
        referenceId: data.referenceId ?? null,
        pool,
        mode: data.mode ?? "action",
      })))
      .returning();

    const row =
      rows.find((transaction) => transaction.pool === "active") ?? rows[0];
    const shouldUpdateProgress =
      data.actionType !== "redemption_deduction" && pools.includes("legacy");
    if (!row || !shouldUpdateProgress) {
      return row ?? null;
    }

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
        const [insertedHistory] = await tx
          .insert(tierHistory)
          .values({
            userId: data.userId,
            tierId: qualifiedTier.id,
            pointsAtTime: progress.totalPoints,
          })
          .onConflictDoNothing({
            target: [tierHistory.userId, tierHistory.tierId],
          })
          .returning({ id: tierHistory.id });

        if (insertedHistory && progress.currentTierId) {
          const [bonusConfig] = await tx
            .select({
              value: pointSystems.value,
              mode: pointSystems.mode,
            })
            .from(pointSystems)
            .where(eq(pointSystems.key, "tier_advancement_bonus"))
            .limit(1);

          if (bonusConfig) {
            await tx.insert(pointTransactions).values(
              EARNING_POOLS.map((pool) => ({
                userId: data.userId,
                actionType: "tier_advancement_bonus" as const,
                points: bonusConfig.value,
                referenceType: "tier",
                referenceId: qualifiedTier.id,
                pool,
                mode: bonusConfig.mode,
              })),
            );

            await tx
              .update(userProgress)
              .set({
                totalPoints: sql`${userProgress.totalPoints} + ${bonusConfig.value}`,
                updatedAt: new Date(),
              })
              .where(eq(userProgress.userId, data.userId));
          }
        }
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
        eq(pointTransactions.pool, "active"),
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
