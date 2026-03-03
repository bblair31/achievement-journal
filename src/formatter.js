/**
 * Markdown Formatter
 * Formats collected data into a structured markdown file with LLM prompt
 * Functional implementation
 */

/**
 * Format date for display
 * Handles ISO strings, Unix timestamps (ms), and null/undefined
 */
const formatDate = (dateValue) => {
  if (!dateValue) return null;

  // Handle Unix timestamps in milliseconds (ClickUp returns these as strings)
  const timestamp = typeof dateValue === 'string' && /^\d+$/.test(dateValue)
    ? parseInt(dateValue, 10)
    : dateValue;

  const date = new Date(timestamp);

  if (isNaN(date.getTime())) return null;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Generate the LLM prompt section
 */
const generatePromptSection = (startDate, endDate) => `# Achievement Collection Report

**Collection Period:** ${formatDate(startDate)} to ${formatDate(endDate)}
**Generated:** ${new Date().toLocaleString('en-US')}

---

## 🤖 Instructions for LLM Processing

**Paste this document into Claude.ai (recommended) along with your existing achievement journal. Optionally attach your resume/CV for additional context about your role and how to frame achievements.**

### Suggested Prompt:

\`\`\`
You are a professional writer helping me maintain my career achievement journal.
Your goal is to synthesize raw activity data into polished, results-oriented
journal entries that match the voice and style of my existing journal.

I'm providing the following documents:

<documents>
  <document index="1">
    <source>resume (optional — for role context)</source>
    <document_content>
      [Paste your resume/CV here, or remove this section]
    </document_content>
  </document>
  <document index="2">
    <source>existing achievement journal</source>
    <document_content>
      [Paste your current journal here]
    </document_content>
  </document>
  <document index="3">
    <source>raw activity data (this report)</source>
    <document_content>
      [Already pasted above, or paste the report contents here]
    </document_content>
  </document>
</documents>

Step 1 — Identify key achievements:
First, review the raw activity data and list the 5-10 most significant
accomplishments in <key_achievements> tags. Group related activities together
(e.g., multiple commits on the same feature = one achievement). Prioritize
work that demonstrates impact, technical depth, or leadership.

Step 2 — Merge into my journal:
Using the key achievements you identified, merge them into my existing journal.
For each entry:
- Write in first person, past tense
- Lead with the result or impact, not the task
- Include relevant technical details and metrics where available
- Match the tone and formatting of my existing journal entries
- Note the date or time period

Step 3 — Verify:
Before finishing, confirm that:
- No significant accomplishments from the raw data were overlooked
- Entries are in chronological order
- The voice is consistent with my existing journal
- Achievements are framed for performance reviews and career growth

Step 4 — Surface metrics and impact (interactive):
After presenting the merged journal, review each entry and identify where
quantifiable impact would strengthen it. Then ask me targeted questions to
help surface those numbers. For each entry that could benefit:
- Suggest the specific type of metric that would make it stronger
  (e.g., users affected, time saved, performance improvement, revenue impact,
  error reduction, team size, adoption rate)
- Ask where I might find the data (monitoring dashboards, PR descriptions,
  analytics tools, stakeholder conversations, release notes)
- If I don't have exact numbers, help me estimate reasonable ranges or
  reframe the impact qualitatively (e.g., "reduced from minutes to seconds"
  or "adopted by the entire engineering team")

This is a conversation — keep asking follow-up questions until we've
strengthened the entries that matter most. Not every entry needs a metric,
so focus on the achievements with the highest career impact.
\`\`\`

---

`;

/**
 * Group items by a key
 */
const groupBy = (key) => (items) =>
  items.reduce((groups, item) => {
    const groupKey = item[key];
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {});

/**
 * Format commit entry
 */
const formatCommitEntry = (includeLinks) => (commit) => {
  const link = includeLinks ? ` ([link](${commit.url}))` : '';
  const lines = [`- \`${commit.sha}\` ${commit.title}${link} - ${formatDate(commit.date)}`];

  if (commit.body) {
    // Indent the body and add it
    const indentedBody = commit.body.split('\n').map(line => `  ${line}`).join('\n');
    lines.push(indentedBody);
  }

  return lines.join('\n');
};

/**
 * Format commits section
 */
const formatCommits = (commits, includeLinks) => {
  if (commits.length === 0) return '';

  const commitsByRepo = groupBy('repo')(commits);
  const lines = [`### Commits (${commits.length} total)\n`];

  Object.entries(commitsByRepo).forEach(([repo, repoCommits]) => {
    lines.push(`#### ${repo}\n`);
    lines.push(...repoCommits.map(formatCommitEntry(includeLinks)));
    lines.push('');
  });

  return lines.join('\n');
};

/**
 * Format pull request entry with full details
 */
const formatPullRequestEntry = (includeLinks) => (pr) => {
  const link = includeLinks ? ` ([link](${pr.url}))` : '';
  const status = pr.merged_at ? '✅ merged' : pr.state === 'closed' ? '❌ closed' : '🔄 open';
  const lines = [
    `#### #${pr.number}: ${pr.title} - ${status}${link}\n`,
  ];

  // Add stats if available
  if (pr.changed_files !== undefined) {
    lines.push(`- **Changes:** ${pr.changed_files} files (+${pr.additions} / -${pr.deletions})`);
  }

  lines.push(`- **Created:** ${formatDate(pr.created_at)}`);

  if (pr.merged_at) {
    lines.push(`- **Merged:** ${formatDate(pr.merged_at)}`);
  } else if (pr.closed_at) {
    lines.push(`- **Closed:** ${formatDate(pr.closed_at)}`);
  }

  // Add description if present
  if (pr.body && pr.body.trim()) {
    lines.push(`\n**Description:**\n${pr.body}`);
  }

  return lines.join('\n') + '\n';
};

/**
 * Format pull requests section
 */
const formatPullRequests = (pullRequests, includeLinks) => {
  if (pullRequests.length === 0) return '';

  const prsByRepo = groupBy('repo')(pullRequests);
  const lines = [`### Pull Requests (${pullRequests.length} total)\n`];

  Object.entries(prsByRepo).forEach(([repo, repoPRs]) => {
    lines.push(`### ${repo}\n`);
    lines.push(...repoPRs.map(formatPullRequestEntry(includeLinks)));
  });

  return lines.join('\n');
};

/**
 * Format issue line
 */
const formatIssueLine = (includeLinks) => (issue) => {
  const link = includeLinks ? ` ([link](${issue.url}))` : '';
  const status = issue.state === 'closed' ? '✅ closed' : '🔄 open';
  const lines = [
    `- #${issue.number}: ${issue.title} - ${status}${link}`,
    `  - Created: ${formatDate(issue.created_at)}`,
  ];

  if (issue.closed_at) {
    lines.push(`  - Closed: ${formatDate(issue.closed_at)}`);
  }

  return lines.join('\n');
};

/**
 * Format issues section
 */
const formatIssues = (issues, includeLinks) => {
  if (issues.length === 0) return '';

  const issuesByRepo = groupBy('repo')(issues);
  const lines = [`### Issues Created (${issues.length} total)\n`];

  Object.entries(issuesByRepo).forEach(([repo, repoIssues]) => {
    lines.push(`#### ${repo}\n`);
    lines.push(...repoIssues.map(formatIssueLine(includeLinks)));
    lines.push('');
  });

  return lines.join('\n');
};

/**
 * Format GitHub section
 */
const formatGitHub = (config) => (data) => {
  if (!data || (data.commits.length === 0 && data.pullRequests.length === 0 && data.issues.length === 0)) {
    return '';
  }

  const sections = [
    '## 💻 GitHub Activity\n',
    formatCommits(data.commits, config.includeLinks),
    formatPullRequests(data.pullRequests, config.includeLinks),
    formatIssues(data.issues, config.includeLinks),
  ];

  return sections.filter(Boolean).join('\n');
};

/**
 * Format task details
 */
const formatTaskDetails = (task) => {
  const details = [];

  if (task.folder) details.push(`- **Folder:** ${task.folder}`);
  if (task.list) details.push(`- **List:** ${task.list}`);
  if (task.priority && task.priority !== 'none') details.push(`- **Priority:** ${task.priority}`);
  if (task.tags?.length > 0) details.push(`- **Tags:** ${task.tags.join(', ')}`);

  const createdDate = formatDate(task.date_created);
  const updatedDate = formatDate(task.date_updated);
  const closedDate = formatDate(task.date_closed);
  const dueDate = formatDate(task.due_date);

  if (createdDate) details.push(`- **Created:** ${createdDate}`);
  if (updatedDate) details.push(`- **Updated:** ${updatedDate}`);
  if (closedDate) details.push(`- **Closed:** ${closedDate}`);
  if (dueDate) details.push(`- **Due:** ${dueDate}`);

  if (task.time_estimate || task.time_spent) {
    const estimate = task.time_estimate ? `${Math.round(task.time_estimate / 3600000)}h` : 'none';
    const spent = task.time_spent ? `${Math.round(task.time_spent / 3600000)}h` : '0h';
    details.push(`- **Time:** ${spent} spent / ${estimate} estimated`);
  }

  return details.join('\n');
};

/**
 * Format single task
 */
const formatTask = (includeLinks) => (task) => {
  const link = includeLinks ? ` ([link](${task.url}))` : '';
  const lines = [
    `#### ${task.name}${link}\n`,
    formatTaskDetails(task),
  ];

  if (task.description) {
    lines.push(`\n${task.description}`);
  }

  return lines.join('\n') + '\n';
};

/**
 * Format ClickUp section
 */
const formatClickUp = (config) => (data) => {
  if (!data || data.tasks.length === 0) {
    return '';
  }

  const tasksByStatus = groupBy('status')(data.tasks);
  const lines = [`## ✅ ClickUp Tasks (${data.tasks.length} total)\n`];

  Object.entries(tasksByStatus).forEach(([status, statusTasks]) => {
    lines.push(`### ${status} (${statusTasks.length})\n`);
    lines.push(...statusTasks.map(formatTask(config.includeLinks)));
  });

  return lines.join('\n');
};

/**
 * Format single Notion page
 */
const formatNotionPage = (includeLinks) => (page) => {
  const link = includeLinks ? ` ([link](${page.url}))` : '';
  return [
    `#### ${page.title}${link}\n`,
    `- **Created:** ${formatDate(page.created_time)}`,
    `- **Last Edited:** ${formatDate(page.last_edited_time)}\n`,
  ].join('\n');
};

/**
 * Format Notion section
 */
const formatNotion = (config) => (data) => {
  if (!data || data.pages.length === 0) {
    return '';
  }

  // Group by database or standalone
  const pagesByDatabase = data.pages.reduce((groups, page) => {
    const db = page.database || 'Standalone Pages';
    if (!groups[db]) {
      groups[db] = [];
    }
    groups[db].push(page);
    return groups;
  }, {});

  const lines = [`## 📝 Notion Pages (${data.pages.length} total)\n`];

  Object.entries(pagesByDatabase).forEach(([dbName, dbPages]) => {
    if (dbPages.length === 0) return;
    lines.push(`### ${dbName} (${dbPages.length})\n`);
    lines.push(...dbPages.map(formatNotionPage(config.includeLinks)));
  });

  return lines.join('\n');
};

/**
 * Generate summary statistics
 */
const generateSummary = (github, clickup, notion) => {
  const lines = ['## 📊 Summary Statistics\n'];

  if (github) {
    lines.push(`- **GitHub Commits:** ${github.commits.length}`);
    lines.push(`- **Pull Requests:** ${github.pullRequests.length}`);
    lines.push(`- **Issues Created:** ${github.issues.length}`);
  }

  if (clickup) {
    lines.push(`- **ClickUp Tasks:** ${clickup.tasks.length}`);
  }

  if (notion) {
    lines.push(`- **Notion Pages:** ${notion.pages.length}`);
  }

  lines.push('\n---\n');

  return lines.join('\n');
};

/**
 * Generate footer
 */
const generateFooter = () => `---

*End of Achievement Collection Report*

**Next Steps:**
1. Open Claude.ai (recommended)
2. Paste this document into the conversation
3. Attach or paste your existing achievement journal
4. Optionally attach your resume/CV for role context
5. Use the suggested prompt above to merge and summarize
6. Review the output and save your updated journal
`;

/**
 * Generate complete markdown document
 */
export const generateMarkdown = (config, data, startDate, endDate) => {
  const sections = [
    generatePromptSection(startDate, endDate),
    generateSummary(data.github, data.clickup, data.notion),
    formatGitHub(config)(data.github),
    formatClickUp(config)(data.clickup),
    formatNotion(config)(data.notion),
    generateFooter(),
  ];

  return sections.filter(Boolean).join('\n');
};
