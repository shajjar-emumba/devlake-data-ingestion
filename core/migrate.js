import fs from "fs";
import path from "path";
import { logger } from "./logger.js";

export async function runMigration(pool, sqlFilePath) {
  const sql = fs.readFileSync(sqlFilePath, "utf8");
  await pool.execute(sql);
  logger.success(`Migration applied: ${path.basename(sqlFilePath)}`);
}
