import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  badge,
  forumAnswer,
  forumQuestion,
  launchpad,
  launchpadApplication,
  userBadge,
  userProfile,
  userSkill,
  volunteerApplication,
} from "../../db/schema";
import { notifyMyspaceAchievement } from "../notifications/notifications.service";
import type { BadgeSlug } from "./badges.constants";

function toInteger(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

async function awardBadge(userId: string, slug: BadgeSlug) {
  const [definition] = await db
    .select({
      id: badge.id,
      name: badge.name,
      description: badge.description,
    })
    .from(badge)
    .where(eq(badge.slug, slug))
    .limit(1);

  if (!definition) {
    console.warn(`Badge definition not found for slug: ${slug}`);
    return null;
  }

  const [awarded] = await db
    .insert(userBadge)
    .values({
      userId,
      badgeId: definition.id,
    })
    .onConflictDoNothing({
      target: [userBadge.userId, userBadge.badgeId],
    })
    .returning({ id: userBadge.id });

  if (!awarded) {
    return null;
  }

  notifyMyspaceAchievement({
    recipientUserId: userId,
    title: "Badge earned",
    body: `You earned the ${definition.name} badge`,
    eventType: "badge_earned",
    data: {
      badgeSlug: slug,
      badgeName: definition.name,
    },
  }).catch((error) => console.error("Failed to notify badge earned", error));

  return awarded;
}

async function awardQualifiedThresholdBadges(
  userId: string,
  count: number,
  thresholds: ReadonlyArray<{ slug: BadgeSlug; minimum: number }>,
) {
  await Promise.all(
    thresholds
      .filter((threshold) => count >= threshold.minimum)
      .map((threshold) => awardBadge(userId, threshold.slug)),
  );
}

export async function awardFirstContributionBadge(userId: string) {
  return awardBadge(userId, "first-contribution");
}

export async function evaluateProfileCompleteBadge(userId: string) {
  const [profile] = await db
    .select({ id: userProfile.id })
    .from(userProfile)
    .where(
      and(
        eq(userProfile.userId, userId),
        isNotNull(userProfile.avatarKey),
        sql`length(trim(coalesce(${userProfile.bio}, ''))) > 0`,
        isNotNull(userProfile.cityId),
        sql`exists (
          select 1
          from ${userSkill}
          where ${userSkill.userId} = ${userId}
        )`,
      ),
    )
    .limit(1);

  return profile ? awardBadge(userId, "profile-complete") : null;
}

export async function evaluateBestAnswerBadge(userId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(forumQuestion)
    .innerJoin(forumAnswer, eq(forumAnswer.id, forumQuestion.bestAnswerId))
    .where(eq(forumAnswer.authorId, userId));

  if (toInteger(result?.count) < 20) {
    return null;
  }

  return awardBadge(userId, "best-answer");
}

export async function evaluateVolunteerCompletionBadges(userId: string) {
  const [result] = await db
    .select({
      count: sql<number>`count(distinct ${volunteerApplication.opportunityId})::int`,
    })
    .from(volunteerApplication)
    .where(
      and(
        eq(volunteerApplication.applicantId, userId),
        eq(volunteerApplication.status, "COMPLETED"),
      ),
    );

  await awardQualifiedThresholdBadges(userId, toInteger(result?.count), [
    { slug: "new-volunteer", minimum: 10 },
    { slug: "dedicated-volunteer", minimum: 50 },
    { slug: "master-volunteer", minimum: 100 },
  ]);
}

export async function evaluateLaunchpadParticipantCompletionBadges(
  userId: string,
) {
  const [result] = await db
    .select({
      count: sql<number>`count(distinct ${launchpadApplication.launchpadId})::int`,
    })
    .from(launchpadApplication)
    .where(
      and(
        eq(launchpadApplication.createdBy, userId),
        eq(launchpadApplication.status, "COMPLETED"),
      ),
    );

  await awardQualifiedThresholdBadges(userId, toInteger(result?.count), [
    { slug: "team-player", minimum: 3 },
    { slug: "project-champion", minimum: 10 },
  ]);
}

export async function evaluateLaunchpadBuilderBadge(userId: string) {
  const [completedProject] = await db
    .select({ id: launchpad.id })
    .from(launchpad)
    .where(
      and(eq(launchpad.createdBy, userId), eq(launchpad.status, "COMPLETED")),
    )
    .limit(1);

  return completedProject ? awardBadge(userId, "builder") : null;
}
