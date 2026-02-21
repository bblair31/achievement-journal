# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run collect      # Collect achievements for the last month (default)
npm run collect:week # Collect for the last week
npm run collect:month # Collect for the last month
npm run collect -- --period quarter  # Custom period (week/month/quarter/year)
npm run collect -- --start-date 2025-01-01 --end-date 2025-01-31  # Custom date range
```

No test suite or linter is configured.

## Architecture

This is a Node.js ES module project (`"type": "module"`) that collects professional activity from three APIs, formats it as markdown, and outputs a report for LLM-assisted journal merging.

**Data flow:** CLI args → date range calculation → parallel API collection (GitHub, ClickUp, Notion) → markdown formatting → file output to `output/`.

### Key files

- `src/index.js` — CLI entrypoint. Parses args, validates env vars, orchestrates collection and output.
- `src/collectors/github.js` — Fetches commits (per-repo), PRs and issues (via search API) with full PR detail fetching. Supports org filtering.
- `src/collectors/clickup.js` — Traverses team → space → folder → list hierarchy to find tasks assigned to the authenticated user.
- `src/collectors/notion.js` — Uses `@notionhq/client` SDK. Supports searching all pages, querying specific databases, or fetching specific page IDs.
- `src/formatter.js` — Pure formatting functions. Groups items by repo/status/database and generates markdown with an LLM prompt header.
- `config.js` — User-facing configuration for filtering repos, workspaces, lists, pages. Currently filtered to `WorkUp-Health` org.

### Patterns

- **Functional style throughout** — no classes. Collectors use curried factory functions (e.g., `createRequest(token)` returns an authenticated fetch wrapper).
- **Each collector returns a consistent shape:** `{ commits, pullRequests, issues }` for GitHub, `{ tasks }` for ClickUp, `{ pages }` for Notion.
- **Environment variables** (`GITHUB_TOKEN`, `CLICKUP_TOKEN`, `NOTION_TOKEN`) are required and validated at startup. Configured via `.env` file (see `.env.example`).
- **GitHub Actions** (`.github/workflows/collect-achievements.yml`) runs monthly on the 1st, commits output, and uploads as artifact.
