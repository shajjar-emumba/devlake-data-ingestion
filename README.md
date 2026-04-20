# Devlake-data-ingestion

A lightweight, extensible pipeline that fills the gaps in Apache DevLake by syncing additional GitHub API data directly into the DevLake MySQL database.

## Why This Exists

Apache DevLake provides solid GitHub data extraction but doesn't cover every metric. This tool uses the same GitHub App credentials to call GitHub API endpoints that DevLake doesn't cover, and stores the results in the same `lake` database alongside DevLake's tables.

## Current Collectors

| Collector  | GitHub Endpoint                              | Table Populated      |
| ---------- | -------------------------------------------- | -------------------- |
| `pr-files` | `GET /repos/{owner}/{repo}/pulls/{pr}/files` | `pull_request_files` |

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd github-data-sync
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env` with:

- GitHub App credentials (`APP_ID`, `INSTALLATION_ID`, `PRIVATE_KEY_PATH`)
- MySQL credentials pointing to your DevLake database

### 3. Add your private key

Copy your GitHub App `.pem` file into this directory and set `PRIVATE_KEY_PATH=./your-key.pem` in `.env`.

### 4. Run

```bash
# Incremental sync (only new data)
npm run sync

# Full re-sync (re-fetch everything)
npm run sync:full

# Run a specific collector only
npm run sync:pr-files
npm run sync:pr-files:full
```

## How It Works

- **Incremental by default** — each run only processes PRs not already in the target table
- **Safe to re-run** — idempotent, will skip already-synced data
- **Rate-limit aware** — auto backs off when GitHub API rate limit is hit
- **Retry on failure** — failed items are retried once after the main loop
- **Daily log files** — written to `logs/YYYY-MM-DD.log`

## Adding a New Collector

1. Create `collectors/<name>/` folder
2. Add `migration.sql` — your table schema
3. Add `index.js` exporting these 6 functions:

```js
export const name = "your-collector-name";
export const description = "What this collects";
export async function migrate(pool) {} // run migration.sql
export async function getItems(pool, isFullSync) {} // what to fetch
export async function fetchFromGitHub(octokit, item) {} // API call → { data, error }
export async function upsert(pool, item, data, isFullSync) {} // write to DB
export function formatLog(item, data, index, total) {} // log line
export async function dbSummary(pool) {} // post-sync stats
```

4. Register it in `index.js`:

```js
import * as myCollector from "./collectors/<name>/index.js";
const ALL_COLLECTORS = [prFiles, myCollector];
```

The `core/runner.js` handles batching, concurrency, rate limiting, retry, and logging automatically.

## Project Structure

```
github-data-sync/
├── index.js                  ← Orchestrator
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── core/
│   ├── github.js             ← Shared Octokit auth
│   ├── db.js                 ← Shared MySQL pool
│   ├── migrate.js            ← Runs .sql migration files
│   ├── runner.js             ← Generic sync engine (batching, retry, rate limit)
│   └── logger.js             ← Console + file logging
├── collectors/
│   └── pr-files/
│       ├── index.js          ← fetch + upsert logic
│       └── migration.sql     ← table schema
└── logs/                     ← auto-created, gitignored
```
