import { getPool, closePool } from "./core/db.js";
import { runCollector } from "./core/runner.js";
import { logger } from "./core/logger.js";

import * as prFiles from "./collectors/pr-files/index.js";

const ALL_COLLECTORS = [
  prFiles,
  // add future collectors here, e.g: prReviews, checkRuns, etc.
];

async function main() {
  const isFullSync = process.argv.includes("--full");
  const collectorArg = process.argv
    .find((a) => a.startsWith("--collector="))
    ?.split("=")[1];

  logger.section("🚀 GitHub Data Sync");
  logger.info(`Mode      : ${isFullSync ? "FULL RE-SYNC" : "Incremental"}`);
  logger.info(`Collector : ${collectorArg ?? "all"}`);
  logger.info(`Started   : ${new Date().toISOString()}`);

  const pool = await getPool();
  await pool.execute("SELECT 1");
  logger.success("Connected to MySQL");

  const collectors = collectorArg
    ? ALL_COLLECTORS.filter((c) => c.name === collectorArg)
    : ALL_COLLECTORS;

  if (collectors.length === 0) {
    logger.error(`No collector found with name: "${collectorArg}"`);
    logger.info(`Available: ${ALL_COLLECTORS.map((c) => c.name).join(", ")}`);
    process.exit(1);
  }

  // Run sequentially — all collectors share the same GitHub rate limit
  for (const collector of collectors) {
    await runCollector(collector, pool, isFullSync);
  }

  await closePool();
  logger.section(`✅ All done — ${new Date().toISOString()}`);
}

main().catch((err) => {
  logger.error(`Fatal: ${err.message}`);
  logger.debug(err.stack);
  process.exit(1);
});
