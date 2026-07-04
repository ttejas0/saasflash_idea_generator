import cron from "node-cron";
import { runGenerationPipeline } from "../services/generation";
import { fetchAllSources } from "../services/feeds";

/**
 * Schedules the daily generation job.
 * Runs at 6:00 AM server time every day.
 */
export function scheduleDailyGeneration() {
  cron.schedule("0 6 * * *", async () => {
    console.log("[cron] Starting daily generation job...");
    try {
      const fetchCount = await fetchAllSources();
      console.log(`[cron] Fetched ${fetchCount} new source items`);
      const result = await runGenerationPipeline({ count: 15, runType: "daily" });
      console.log(`[cron] Daily generation complete: batch=${result.batchId}, saved=${result.saved}`);
    } catch (err) {
      console.error("[cron] Daily generation failed:", (err as Error).message);
    }
  });

  console.log("[cron] Daily generation job scheduled at 6:00 AM");
}
