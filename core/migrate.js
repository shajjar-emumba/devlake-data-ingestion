import fs from "fs";
import path from "path";
import { logger } from "./logger.js";

export async function runMigration(pool, sqlFilePath) {
  const sql = fs.readFileSync(sqlFilePath, "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await pool.execute(statement);
  }
  logger.success(`Migration applied: ${path.basename(sqlFilePath)}`);
}
