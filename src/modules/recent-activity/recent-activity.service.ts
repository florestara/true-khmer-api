import type { Context } from "hono";
import { db } from "../../db";
import { getAuthUserId } from "../auth/utils/get-auth";
import {
  deleteRecentActivitiesByReference,
  findRecentActivitiesByUserId,
  insertRecentActivity,
  type RecentActivityInsert,
} from "./recent-activity.query";

export type RecentActivityType =
  | "forum_question_posted"
  | "forum_question_deleted"
  | "forum_question_upvoted"
  | "forum_question_downvoted"
  | "forum_question_saved"
  | "forum_answer_posted"
  | "forum_answer_deleted"
  | "forum_answer_upvoted"
  | "forum_answer_downvoted"
  | "forum_best_answer_marked"
  | "volunteer_opportunity_posted"
  | "volunteer_opportunity_saved"
  | "volunteer_application_submitted"
  | "launchpad_created";

export type RecentActivityTargetType =
  | "forum_question"
  | "volunteer_opportunity"
  | "launchpad";

export type RecentActivityReferenceType =
  | "forum_question"
  | "forum_answer"
  | "volunteer_opportunity"
  | "volunteer_application"
  | "launchpad";

export type RecordRecentActivityInput = {
  userId: string;
  type: RecentActivityType;
  title: string;
  description?: string | null;
  targetType: RecentActivityTargetType;
  targetId: string;
  referenceType: RecentActivityReferenceType;
  referenceId: string;
  data?: Record<string, unknown>;
};

const DEFAULT_RECENT_ACTIVITY_LIMIT = 10;
const MAX_RECENT_ACTIVITY_LIMIT = 50;

export function recordRecentActivity(input: RecordRecentActivityInput) {
  return insertRecentActivity(buildRecentActivityInsert(input));
}

function buildRecentActivityInsert(input: RecordRecentActivityInput) {
  return {
    userId: input.userId,
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    targetType: input.targetType,
    targetId: input.targetId,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    data: input.data ?? {},
  } satisfies RecentActivityInsert;
}

export function recordRecentActivityQuietly(input: RecordRecentActivityInput) {
  recordRecentActivity(input).catch((err) => {
    console.error("Failed to record recent activity", {
      err,
      type: input.type,
      userId: input.userId,
      targetType: input.targetType,
      targetId: input.targetId,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    });
  });
}

export async function replaceRecentActivitiesByReference(params: {
  userId: string;
  referenceType: RecentActivityReferenceType;
  referenceId: string;
  types: RecentActivityType[];
  activity?: RecordRecentActivityInput | null;
}) {
  await db.transaction(async (tx) => {
    await deleteRecentActivitiesByReference(params, tx);
    if (params.activity) {
      await insertRecentActivity(buildRecentActivityInsert(params.activity), tx);
    }
  });
}

export async function handleGetRecentActivities(c: Context) {
  const authResult = getAuthUserId(c);
  if (!authResult.ok) {
    return authResult.response;
  }

  const rawLimit = Number(c.req.query("limit"));
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_RECENT_ACTIVITY_LIMIT)
    : DEFAULT_RECENT_ACTIVITY_LIMIT;

  try {
    const activities = await findRecentActivitiesByUserId(
      authResult.userId,
      limit,
    );
    return c.json({ ok: true, activities }, 200);
  } catch (err) {
    console.error("Failed to get recent activities", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
}
