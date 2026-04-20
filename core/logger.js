import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, "../logs");

if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

function getLogFilePath() {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOGS_DIR, `${date}.log`);
}

function writeToFile(level, message) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.padEnd(7)}] ${message}\n`;
  fs.appendFileSync(getLogFilePath(), line);
}

function log(level, consoleMethod, prefix, message) {
  consoleMethod(`${prefix} ${message}`);
  writeToFile(level, message);
}

export const logger = {
  info: (msg) => log("INFO", console.log, "ℹ️ ", msg),
  success: (msg) => log("INFO", console.log, "✅", msg),
  warn: (msg) => log("WARN", console.warn, "⚠️ ", msg),
  error: (msg) => log("ERROR", console.error, "❌", msg),
  debug: (msg) => {
    if (process.env.DEBUG === "true") console.log(`🔍 ${msg}`);
    writeToFile("DEBUG", msg);
  },
  section: (msg) => {
    const line = "═".repeat(60);
    const formatted = `\n${line}\n  ${msg}\n${line}`;
    console.log(formatted);
    writeToFile("INFO", `${line} ${msg} ${line}`);
  },
};
