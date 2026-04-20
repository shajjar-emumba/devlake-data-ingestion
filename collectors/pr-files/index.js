import path from "path";
import { fileURLToPath } from "url";
import { runMigration } from "../../core/migrate.js";
import { logger } from "../../core/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const name = "pr-files";
export const description =
  "Fetches per-file additions/deletions for every PR via GitHub API";

// ─── 1. Migration ──────────────────────────────────────────────────────────────

export async function migrate(pool) {
  await runMigration(pool, path.join(__dirname, "migration.sql"));
}

// ─── 2. Get items to sync ──────────────────────────────────────────────────────

export async function getItems(pool, isFullSync) {
  if (isFullSync) logger.info("[pr-files] Full sync mode — querying all PRs.");

  const query = isFullSync
    ? `SELECT
         pr.id               AS pr_id,
         pr.pull_request_key AS pr_number,
         r.id                AS repo_id,
         r.name              AS repo_name
       FROM pull_requests pr
       JOIN repos r ON pr.base_repo_id = r.id
       WHERE pr.pull_request_key IS NOT NULL
         AND r.name IS NOT NULL
       ORDER BY pr.created_date DESC`
    : `SELECT
         pr.id               AS pr_id,
         pr.pull_request_key AS pr_number,
         r.id                AS repo_id,
         r.name              AS repo_name
       FROM pull_requests pr
       JOIN repos r ON pr.base_repo_id = r.id
       WHERE pr.pull_request_key IS NOT NULL
         AND r.name IS NOT NULL
         AND pr.id NOT IN (
           SELECT DISTINCT pull_request_id FROM pull_request_files
         )
       ORDER BY pr.created_date DESC`;

  const [rows] = await pool.execute(query);
  logger.debug(`[pr-files] ${rows.length} PR(s) need syncing.`);
  return rows;
}

// ─── 3. Fetch from GitHub API ──────────────────────────────────────────────────

export async function fetchFromGitHub(octokit, item) {
  const [owner, repo] = item.repo_name.split("/");

  if (!owner || !repo) {
    return {
      data: [],
      error: Object.assign(new Error(`Invalid repo name: ${item.repo_name}`), {
        status: 400,
      }),
    };
  }

  try {
    const files = await octokit.paginate(octokit.pulls.listFiles, {
      owner,
      repo,
      pull_number: item.pr_number,
      per_page: 100,
    });
    logger.debug(
      `[pr-files] PR #${item.pr_number} (${item.repo_name}) — ${files.length} file(s) returned from API`,
    );
    return { data: files, error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

// ─── 4. Upsert into DB ─────────────────────────────────────────────────────────

export async function upsert(pool, item, files, isFullSync) {
  const rows =
    files.length > 0
      ? files
      : [
          {
            filename: "__no_files__",
            status: "no-files",
            additions: 0,
            deletions: 0,
            changes: 0,
            previous_filename: null,
            blob_url: null,
          },
        ];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (isFullSync) {
      await conn.execute(
        "DELETE FROM pull_request_files WHERE pull_request_id = ?",
        [item.pr_id],
      );
    }

    const values = rows.map((f) => [
      item.pr_id,
      item.repo_id,
      item.repo_name,
      item.pr_number,
      f.filename,
      f.status || null,
      f.additions ?? 0,
      f.deletions ?? 0,
      f.changes ?? 0,
      f.previous_filename || null,
      f.blob_url || null,
    ]);

    const placeholders = values.map(() => "(?,?,?,?,?,?,?,?,?,?,?)").join(",");

    await conn.execute(
      `INSERT INTO pull_request_files
         (pull_request_id, repo_id, repo_name, pr_number, filename, status,
          additions, deletions, changes, previous_filename, blob_url)
       VALUES ${placeholders}`,
      values.flat(),
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── 5. Log line per item ──────────────────────────────────────────────────────

export function formatLog(item, files, index, total) {
  if (files.length === 0) {
    return `[${index}/${total}] ${item.repo_name} PR #${item.pr_number} — 0 files (sentinel row inserted)`;
  }
  const additions = files.reduce((s, f) => s + f.additions, 0);
  const deletions = files.reduce((s, f) => s + f.deletions, 0);
  return `[${index}/${total}] ${item.repo_name} PR #${item.pr_number} — ${files.length} file(s) (+${additions} / -${deletions})`;
}

// ─── 6. DB summary after sync ──────────────────────────────────────────────────

export async function dbSummary(pool) {
  const [rows] = await pool.execute(`
    SELECT
      COUNT(DISTINCT pull_request_id) AS prs_with_files,
      COUNT(*)                        AS total_file_records,
      SUM(additions)                  AS total_additions,
      SUM(deletions)                  AS total_deletions
    FROM pull_request_files
  `);
  const s = rows[0];
  logger.info("📈 Database Summary (pull_request_files):");
  logger.info(`   PRs with file data  : ${s.prs_with_files}`);
  logger.info(`   Total file records  : ${s.total_file_records}`);
  logger.info(`   Total additions     : +${s.total_additions ?? 0}`);
  logger.info(`   Total deletions     : -${s.total_deletions ?? 0}`);
}
