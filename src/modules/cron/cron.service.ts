import { db } from "../../db/index";
import {
  launchpad,
  launchpadActionLog,
  launchpadApplication,
  volunteerApplication,
  volunteerOpportunity,
  volunteerOpportunityActionLog,
} from "../../db/schema";
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { notifyApplicantPostingStatusChanged } from "../notifications/notifications.service";

type PostingInProgressNotificationTarget = {
  recipientUserId: string;
  postingId: string;
  postingTitle: string;
  sourceType: "volunteer" | "projects";
};

async function findPostingInProgressNotificationTargets(
  volunteerPostingIds: string[],
  launchpadPostingIds: string[],
): Promise<PostingInProgressNotificationTarget[]> {
  const [volunteerTargets, launchpadTargets] = await Promise.all([
    volunteerPostingIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            recipientUserId: volunteerApplication.applicantId,
            postingId: volunteerOpportunity.id,
            postingTitle: volunteerOpportunity.title,
          })
          .from(volunteerApplication)
          .innerJoin(
            volunteerOpportunity,
            eq(volunteerOpportunity.id, volunteerApplication.opportunityId),
          )
          .where(
            inArray(volunteerApplication.opportunityId, volunteerPostingIds),
          ),
    launchpadPostingIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            recipientUserId: launchpadApplication.createdBy,
            postingId: launchpad.id,
            postingTitle: launchpad.name,
          })
          .from(launchpadApplication)
          .innerJoin(
            launchpad,
            eq(launchpad.id, launchpadApplication.launchpadId),
          )
          .where(inArray(launchpadApplication.launchpadId, launchpadPostingIds)),
  ]);

  const uniqueTargets = new Map<string, PostingInProgressNotificationTarget>();

  for (const target of volunteerTargets) {
    const notificationTarget = {
      ...target,
      sourceType: "volunteer" as const,
    };
    uniqueTargets.set(
      `${notificationTarget.sourceType}:${notificationTarget.postingId}:${notificationTarget.recipientUserId}`,
      notificationTarget,
    );
  }

  for (const target of launchpadTargets) {
    const notificationTarget = {
      ...target,
      sourceType: "projects" as const,
    };
    uniqueTargets.set(
      `${notificationTarget.sourceType}:${notificationTarget.postingId}:${notificationTarget.recipientUserId}`,
      notificationTarget,
    );
  }

  return [...uniqueTargets.values()];
}

async function notifyPostingApplicantsInProgress(
  volunteerPostingIds: string[],
  launchpadPostingIds: string[],
) {
  const targets = await findPostingInProgressNotificationTargets(
    volunteerPostingIds,
    launchpadPostingIds,
  );
  const results = await Promise.allSettled(
    targets.map((target) =>
      notifyApplicantPostingStatusChanged({
        ...target,
        status: "in_progress",
      }),
    ),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        "Failed to notify applicant that posting is in progress",
        result.reason,
      );
    }
  }
}

export async function runStatusUpdateCron() {
  let updatedVolunteerOpportunities = 0;
  let updatedLaunchpadPosts = 0;
  let updatedVolunteerOpportunityIds: string[] = [];
  let updatedLaunchpadPostIds: string[] = [];
  let lockAcquired = false;

  try {
    await db.transaction(async (tx) => {
      // Try to acquire an advisory lock (key 12345) to prevent concurrent execution across instances
      const lockResult = await tx.execute(
        sql`SELECT pg_try_advisory_xact_lock(12345) AS locked`,
      );
      if (!lockResult[0].locked) {
        // Lock not acquired, skip execution
        return;
      }
      lockAcquired = true;

      const now = new Date();
      const nowIso = now.toISOString();

      const volunteerResult = await tx
        .update(volunteerOpportunity)
        .set({
          status: "IN_PROGRESS",
          updatedAt: nowIso,
        })
        .where(
          and(
            eq(volunteerOpportunity.status, "LIVE"),
            lte(volunteerOpportunity.applicationDeadline, nowIso),
            isNull(volunteerOpportunity.deletedAt),
          ),
        )
        .returning({
          id: volunteerOpportunity.id,
          createdBy: volunteerOpportunity.createdBy,
        });

      if (volunteerResult.length > 0) {
        await tx.insert(volunteerOpportunityActionLog).values(
          volunteerResult.map(({ id, createdBy }) => ({
            opportunityId: id,
            name: "Posting in progress",
            description:
              "Automatically moved to in progress after application deadline",
            fromData: { status: "LIVE" },
            toData: { status: "IN_PROGRESS" },
            status: "IN_PROGRESS" as const,
            createdBy,
          })),
        );
      }

      updatedVolunteerOpportunities = volunteerResult.length;
      updatedVolunteerOpportunityIds = volunteerResult.map(({ id }) => id);

      const launchpadResult = await tx
        .update(launchpad)
        .set({
          status: "IN_PROGRESS",
          updatedAt: nowIso,
        })
        .where(
          and(
            eq(launchpad.status, "LIVE"),
            lte(launchpad.deadline, nowIso),
            isNull(launchpad.deletedAt),
          ),
        )
        .returning({
          id: launchpad.id,
          createdBy: launchpad.createdBy,
        });

      if (launchpadResult.length > 0) {
        await tx.insert(launchpadActionLog).values(
          launchpadResult.map(({ id, createdBy }) => ({
            launchpadId: id,
            name: "Posting in progress",
            description:
              "Automatically moved to in progress after application deadline",
            fromData: { status: "LIVE" },
            toData: { status: "IN_PROGRESS" },
            status: "IN_PROGRESS" as const,
            createdBy,
          })),
        );
      }

      updatedLaunchpadPosts = launchpadResult.length;
      updatedLaunchpadPostIds = launchpadResult.map(({ id }) => id);
    });
  } catch (error) {
    console.error("❌ Error in cron job:", error);
    throw error;
  }

  if (!lockAcquired) {
    console.log("⏳ Cron job lock not acquired, skipping this tick.");
    return {
      updatedVolunteerOpportunities: 0,
      updatedLaunchpadPosts: 0,
      totalUpdates: 0,
    };
  }

  try {
    await notifyPostingApplicantsInProgress(
      updatedVolunteerOpportunityIds,
      updatedLaunchpadPostIds,
    );
  } catch (error) {
    console.error(
      "Failed to notify applicants that postings are in progress",
      error,
    );
  }

  console.log(
    `✅ Cron job completed: ${updatedVolunteerOpportunities} volunteer opportunities and ${updatedLaunchpadPosts} launchpad posts updated to IN_PROGRESS.`,
  );

  return {
    updatedVolunteerOpportunities,
    updatedLaunchpadPosts,
    totalUpdates: updatedVolunteerOpportunities + updatedLaunchpadPosts,
  };
}
