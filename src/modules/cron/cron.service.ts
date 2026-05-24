import { db } from "../../db/index";
import { volunteerOpportunity, launchpad } from "../../db/schema";
import { eq, and, lt, isNull, sql } from "drizzle-orm";

export async function runStatusUpdateCron() {
  let updatedVolunteerOpportunities = 0;
  let updatedLaunchpadPosts = 0;
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
            lt(volunteerOpportunity.applicationDeadline, nowIso),
            isNull(volunteerOpportunity.deletedAt),
          ),
        )
        .returning({ id: volunteerOpportunity.id });

      updatedVolunteerOpportunities = volunteerResult.length;

      const launchpadResult = await tx
        .update(launchpad)
        .set({
          status: "IN_PROGRESS",
          updatedAt: nowIso,
        })
        .where(
          and(
            eq(launchpad.status, "LIVE"),
            lt(launchpad.deadline, nowIso),
            isNull(launchpad.deletedAt),
          ),
        )
        .returning({ id: launchpad.id });

      updatedLaunchpadPosts = launchpadResult.length;
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

  console.log(
    `✅ Cron job completed: ${updatedVolunteerOpportunities} volunteer opportunities and ${updatedLaunchpadPosts} launchpad posts updated to IN_PROGRESS.`,
  );

  return {
    updatedVolunteerOpportunities,
    updatedLaunchpadPosts,
    totalUpdates: updatedVolunteerOpportunities + updatedLaunchpadPosts,
  };
}
