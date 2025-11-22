# Enhancement Plan: Achievement Journal → Interview Story Generator

> **Status**: Draft for consideration. Not committed to build.

## Overview

**Goal**: Transform achievement-journal from a data collector into an interview prep tool that generates searchable STAR stories from your work history.

**Core Addition**: Claude API analyzes your GitHub/ClickUp/Notion data and generates interview-ready stories you can query before interviews.

---

## Constraints

Based on requirements:

| Constraint | Value | Implication |
|------------|-------|-------------|
| Cost tolerance | Very limited | Use Haiku, aggressive filtering, batching |
| Story freshness | New achievements only | Never regenerate, cache everything |
| Manual curation | Likely to edit | Haiku quality acceptable, protect edits |
| Repo scope | All repos | Need efficient filtering to reduce noise |

---

## Cost-Optimized Approach

### The Problem

"All repos" + "limited cost tolerance" creates tension. Hundreds of commits, but most aren't story-worthy. Paying Claude to analyze every commit is wasteful.

### Solution: Two-Pass Filtering

**Pass 1: Local Filtering (Free)**
- Filter out trivial commits: "fix typo", "update deps", "merge branch"
- Group related commits (same PR, same day, similar messages)
- Identify candidates by signals: PR merged, issue closed, keywords ("optimize", "implement", "fix critical")

**Pass 2: AI Scoring (Cheap - Haiku)**
- Send candidate groups to Haiku in batches
- Score 1-10 for story potential
- Only proceed with score ≥ 7

**Pass 3: Story Generation (Haiku)**
- Generate STAR stories for high-scoring achievements only
- Use Haiku (not Sonnet) since you'll edit anyway
- Batch 3-5 achievements per call

### Cost Estimate

Assuming per month:
- 100 commits across all repos
- 30 pass local filtering → 30 candidates
- 10 score ≥ 7 → 10 stories generated

**Haiku costs** (~$0.25/1M input, $1.25/1M output):
- Scoring batch: ~$0.01
- Story generation: ~$0.05
- **Total: ~$0.06/month**

Even at 10x volume, under $1/month.

---

## Phase 1: Data Foundation

**Purpose**: Persistent, searchable storage for achievements and generated stories

### Components

#### 1.1 SQLite Database Schema

```sql
-- Raw data from collectors
CREATE TABLE achievements (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,           -- 'github', 'clickup', 'notion'
    source_id TEXT NOT NULL,        -- Original ID from source
    type TEXT NOT NULL,             -- 'commit', 'pr', 'issue', 'task', 'page'
    title TEXT NOT NULL,
    description TEXT,
    url TEXT,
    created_at DATETIME NOT NULL,
    metadata JSON,                  -- Source-specific data
    technologies TEXT,              -- JSON array of detected techs
    UNIQUE(source, source_id)
);

-- Generated STAR narratives
CREATE TABLE stories (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    situation TEXT NOT NULL,
    task TEXT NOT NULL,
    action TEXT NOT NULL,
    result TEXT NOT NULL,
    talking_points TEXT,            -- JSON array
    tags TEXT,                      -- JSON array
    quality_score INTEGER,
    generated_text TEXT,            -- Original from Claude
    edited_text TEXT,               -- User refinements
    is_edited BOOLEAN DEFAULT FALSE,
    last_used DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Link stories to source achievements
CREATE TABLE story_achievements (
    story_id INTEGER REFERENCES stories(id),
    achievement_id INTEGER REFERENCES achievements(id),
    PRIMARY KEY (story_id, achievement_id)
);

-- Full-text search
CREATE VIRTUAL TABLE stories_fts USING fts5(
    title, situation, task, action, result, talking_points, tags
);
```

#### 1.2 Collector Migration

- Update GitHub/ClickUp/Notion collectors to write to SQLite
- Add deduplication (don't re-insert same commit)
- Preserve raw metadata for later analysis
- Track last fetch timestamp per source for incremental updates

#### 1.3 GitHub Caching

- Cache API responses locally
- Incremental fetches (only new data since last run)
- Store in `~/.achievement-journal/cache/`

---

## Phase 2: Story Intelligence

**Purpose**: Use Claude to transform raw achievements into interview stories

### Components

#### 2.1 Claude API Integration

```javascript
// src/ai/client.js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// Rate limiting: max 10 requests/minute, configurable
// Retry with exponential backoff on rate limit errors
```

#### 2.2 Achievement Filtering (Local - Free)

**Trivial commit patterns to exclude:**
```javascript
const TRIVIAL_PATTERNS = [
  /^merge\s/i,
  /^bump\s/i,
  /^update\s(deps|dependencies|packages)/i,
  /^fix\s(typo|lint|format)/i,
  /^wip$/i,
  /^initial commit$/i
];
```

**Story-worthy signals:**
- PR merged with >100 lines changed
- Issue closed with "bug" or "feature" label
- Commit message contains: "optimize", "implement", "fix critical", "reduce", "improve"
- Multiple related commits (indicates significant work)

**Commit clustering:**
- Group by PR (all commits in same PR = one achievement)
- Group by issue (commits referencing same issue)
- Group by time + similarity (same day, similar messages)

#### 2.3 Candidate Scoring (Haiku - Batched)

```javascript
// Batch 10-20 candidates per call
const scoringPrompt = `
Score these achievements 1-10 for interview story potential.
Consider: technical complexity, impact, problem-solving, leadership.

Achievements:
${candidates.map((c, i) => `${i+1}. ${c.title}\n   ${c.description}`).join('\n\n')}

Return JSON: [{"index": 1, "score": 8, "rationale": "..."}]
`;
```

#### 2.4 Story Generation (Haiku - Batched)

```javascript
// Batch 3-5 high-scoring achievements per call
const storyPrompt = `
Generate STAR interview stories for these achievements.
Include specific technical details and quantified results where possible.

${achievements.map(a => formatAchievement(a)).join('\n---\n')}

For each, return:
- title: Concise story title
- situation: Context and problem (2-3 sentences)
- task: What needed to be done (1-2 sentences)
- action: Specific technical actions taken (3-5 sentences)
- result: Impact with metrics if possible (1-2 sentences)
- talking_points: Key points to emphasize (array of 3-5 strings)
- tags: {technologies: [], problem_types: [], outcomes: []}
`;
```

#### 2.5 Auto-Tagging Taxonomy

**Technologies**: Extracted from code, commit messages, PR descriptions
```
React, Node.js, TypeScript, PostgreSQL, Redis, GCP, AWS, Docker, Kubernetes, GraphQL, REST, etc.
```

**Problem types**:
```
performance, debugging, architecture, scaling, security, reliability,
testing, refactoring, integration, migration, automation
```

**Outcomes**:
```
shipped, optimized, cost-reduction, improved-reliability,
faster-delivery, better-dx, resolved-incident
```

---

## Phase 3: Interview Interface

**Purpose**: Query your stories before interviews

### Components

#### 3.1 CLI Query Command

```bash
# Search by interview question
node src/cli.js query "time you optimized performance"

# Search by technology
node src/cli.js query --tech "postgres,redis"

# Search by problem type
node src/cli.js query --type "debugging"

# List best stories
node src/cli.js stories --top 10

# List stories by recency
node src/cli.js stories --recent

# Show full story
node src/cli.js story <id>

# Mark story as used (for interview loop tracking)
node src/cli.js story <id> --mark-used

# Edit story
node src/cli.js story <id> --edit
```

#### 3.2 Query Output Format

```
$ node src/cli.js query "improved system performance"

Found 3 stories:

1. Redis Caching for User Sessions [ID: 12] (Score: 92)
   Tech: Node.js, Redis, PostgreSQL
   Type: performance, architecture
   Result: Reduced API latency by 40%, saved $2k/month in DB costs
   Last used: Never

2. Database Query Optimization [ID: 8] (Score: 87)
   Tech: PostgreSQL, Node.js
   Type: performance, debugging
   Result: Reduced page load from 3s to 400ms
   Last used: 2024-01-15

3. React Bundle Optimization [ID: 15] (Score: 78)
   Tech: React, Webpack
   Type: performance
   Result: Reduced initial bundle size by 60%
   Last used: Never

View full story? [1/2/3/q]:
```

#### 3.3 Story Management

```javascript
// Protect edited stories from regeneration
function shouldRegenerate(story) {
  return !story.is_edited;
}

// Display logic
function getDisplayText(story) {
  return story.edited_text || story.generated_text;
}
```

#### 3.4 Export

```bash
# Export to markdown
node src/cli.js export --format md --output stories.md

# Export to PDF (via markdown + pandoc)
node src/cli.js export --format pdf --output stories.pdf

# Export specific stories
node src/cli.js export --ids 1,2,3 --format md

# Export by tag
node src/cli.js export --tech react --format md
```

**Markdown format:**
```markdown
# Interview Stories

## Redis Caching for User Sessions

**Technologies:** Node.js, Redis, PostgreSQL
**Tags:** performance, architecture, cost-reduction

### Situation
[Generated/edited situation text]

### Task
[Generated/edited task text]

### Action
[Generated/edited action text]

### Result
[Generated/edited result text]

### Talking Points
- Point 1
- Point 2
- Point 3

---
```

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | SQLite | Zero setup, portable, sufficient for personal use |
| Storage location | `~/.achievement-journal/` | Persistent across project updates |
| Story model | Haiku | User will edit; 10-20x cheaper than Sonnet |
| Scoring model | Haiku | Simple classification task |
| Processing | Filtered candidates only | Most commits aren't story-worthy |
| Regeneration | Never for edited | Respect user refinements |
| Config | Extend existing `config.js` | Familiar pattern |
| CLI framework | Commander.js | Standard, lightweight |

---

## File Structure

```
achievement-journal/
├── src/
│   ├── index.js                 # Existing: data collection
│   ├── cli.js                   # New: query interface
│   ├── formatter.js             # Existing: markdown output
│   ├── collectors/
│   │   ├── github.js            # Update: write to SQLite
│   │   ├── clickup.js           # Update: write to SQLite
│   │   └── notion.js            # Update: write to SQLite
│   ├── db/
│   │   ├── schema.sql           # New: database schema
│   │   ├── client.js            # New: SQLite client
│   │   └── migrations/          # New: schema migrations
│   ├── ai/
│   │   ├── client.js            # New: Anthropic client
│   │   ├── scoring.js           # New: candidate scoring
│   │   └── stories.js           # New: story generation
│   ├── analysis/
│   │   ├── filter.js            # New: local filtering
│   │   ├── cluster.js           # New: commit clustering
│   │   └── signals.js           # New: story-worthy detection
│   └── export/
│       ├── markdown.js          # New: MD export
│       └── pdf.js               # New: PDF export
├── config.js                    # Update: add AI config
└── package.json                 # Update: add dependencies
```

---

## New Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "better-sqlite3": "^9.0.0",
    "commander": "^11.0.0"
  }
}
```

---

## Configuration Additions

```javascript
// config.js additions
module.exports = {
  // ... existing config ...

  ai: {
    enabled: true,
    model: 'claude-3-haiku-20240307',
    maxRequestsPerMinute: 10,
    scoringThreshold: 7,
    batchSize: {
      scoring: 15,
      generation: 4
    }
  },

  storage: {
    dbPath: '~/.achievement-journal/data.db',
    cachePath: '~/.achievement-journal/cache'
  },

  filtering: {
    minLinesChanged: 20,
    excludePatterns: [
      /^merge\s/i,
      /^bump\s/i,
      // ...
    ],
    storySignals: [
      'optimize', 'implement', 'fix critical', 'reduce', 'improve'
    ]
  }
};
```

---

## Success Criteria

**Working system where:**

1. Run weekly collection that costs < $0.10/month
2. Query "Tell me about a time you optimized performance" and get relevant stories
3. Each story has STAR format with technical depth
4. Stories are searchable by tech stack, problem type, outcome
5. Edited stories are preserved across regeneration
6. Can export to markdown/PDF before interviews

---

## What This Doesn't Include

Explicitly out of scope (from Project #6 - Job Hunter):

- Job board scraping
- Company funding tracking
- LinkedIn network analysis
- Opportunity scoring
- Job alerts/notifications
- Market trend analysis

This plan focuses solely on turning your work history into interview stories.

---

## Next Steps (If Proceeding)

1. Validate SQLite schema with sample data
2. Prototype local filtering logic
3. Test Haiku story generation quality
4. Build CLI query interface
5. Iterate on prompts for better stories

---

*Last updated: 2024*
