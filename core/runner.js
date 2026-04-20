import { octokit } from "./github.js";
import { logger } from "./logger.js";

const CONCURRENCY = 3;
const BATCH_DELAY_MS = 300;
const RETRY_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Process a single item ─────────────────────────────────────────────────────

async function processItem(collector, pool, item, index, total, isFullSync) {
  try {
    const { data, error } = await collector.fetchFromGitHub(octokit, item);

    if (error) {
      const status = error.status;

      if (status === 404) {
        logger.warn(
          `[${index}/${total}] [${collector.name}] 404 — not found or no access: ${JSON.stringify(item)}`,
        );
        return { status: "not_found" };
      }

      if (status === 422) {
        logger.warn(
          `[${index}/${total}] [${collector.name}] 422 — GitHub hard cap exceeded: ${JSON.stringify(item)}`,
        );
        return { status: "too_many" };
      }

      if (status === 403 || status === 429) {
        const retryAfter = parseInt(
          error.response?.headers?.["retry-after"] || "60",
        );
        logger.warn(
          `[${collector.name}] Rate limited. Waiting ${retryAfter}s...`,
        );
        await sleep(retryAfter * 1000);
        return { status: "rate_limited", item };
      }

      logger.error(`[${index}/${total}] [${collector.name}] ${error.message}`);
      return { status: "error", item };
    }

    await collector.upsert(pool, item, data, isFullSync);
    logger.success(collector.formatLog(item, data, index, total));
    return { status: "ok" };
  } catch (err) {
    logger.error(
      `[${index}/${total}] [${collector.name}] Unexpected: ${err.message}`,
    );
    logger.debug(err.stack);
    return { status: "error", item };
  }
}

// ─── Main runner ───────────────────────────────────────────────────────────────

export async function runCollector(collector, pool, isFullSync) {
  logger.section(`Collector: ${collector.name} — ${collector.description}`);

  // 1. Ensure table exists
  await collector.migrate(pool);

  // 2. Get items that need syncing
  const items = await collector.getItems(pool, isFullSync);
  const total = items.length;

  if (total === 0) {
    logger.info("Nothing to sync — all items are already up to date.");
    logger.info("Tip: use --full to force a complete re-sync.");
    return;
  }

  logger.info(`Items to sync: ${total}`);

  let ok = 0,
    skipped = 0,
    errors = 0;
  const failed = [];

  // 3. Process in batches
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);

    const results = await Promise.all(
      batch.map((item, j) =>
        processItem(collector, pool, item, i + j + 1, total, isFullSync),
      ),
    );

    for (const result of results) {
      if (result.status === "ok") {
        ok++;
      } else if (["skipped", "not_found", "too_many"].includes(result.status)) {
        skipped++;
      } else if (["rate_limited", "error"].includes(result.status)) {
        errors++;
        if (result.item) failed.push(result.item);
      }
    }

    if (i + CONCURRENCY < items.length) await sleep(BATCH_DELAY_MS);
  }

  // 4. Retry failed items once
  if (failed.length > 0) {
    logger.info(`Retrying ${failed.length} failed item(s)...`);
    for (let i = 0; i < failed.length; i++) {
      const result = await processItem(
        collector,
        pool,
        failed[i],
        i + 1,
        failed.length,
        isFullSync,
      );
      if (result.status === "ok") {
        ok++;
        errors--;
      }
      await sleep(RETRY_DELAY_MS);
    }
  }

  // 5. Summary
  logger.section(`Sync Complete — ${collector.name}`);
  logger.info(`  ✅ Synced   : ${ok}`);
  logger.info(`  ⚠️  Skipped  : ${skipped}`);
  logger.info(`  ❌ Errors   : ${errors}`);

  // 6. DB summary
  if (collector.dbSummary) await collector.dbSummary(pool);
}
