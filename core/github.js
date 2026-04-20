import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const privateKey = fs.readFileSync(
  path.resolve(__dirname, "..", process.env.PRIVATE_KEY_PATH),
  "utf8",
);

export const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: process.env.APP_ID,
    privateKey,
    installationId: process.env.INSTALLATION_ID,
  },
});
