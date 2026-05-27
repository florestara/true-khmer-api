import { CronJob } from "cron";
import { runStatusUpdateCron } from "./cron.service";

export const startCronScheduler = () =>
  new CronJob(
    "0 0 * * *", // cronTime
    async function () {
      try {
        const result = await runStatusUpdateCron();
        // Note: The cron service now handles distributed locking and logs appropriately
        console.log(
          `✅ Cron job completed: ${result.updatedVolunteerOpportunities} volunteer opportunities and ${result.updatedLaunchpadPosts} launchpad posts updated to IN_PROGRESS.`,
        );
      } catch (error) {
        console.error("❌ Error in cron job:", error);
      }
    }, // onTick
    null, // onComplete
    true, // start
    "Asia/Phnom_Penh", // timeZone
  );
