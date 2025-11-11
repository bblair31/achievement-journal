/**
 * Markdown Formatter
 * Formats collected data into a structured markdown file with LLM prompt
 * Functional implementation
 */

/**
 * Format date for display
 */
const formatDate = (dateString) => {
  const date = new Date(dateString);
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

**Copy this entire document and paste it into Claude.ai or ChatGPT along with your existing achievement journal/brag document.**

### Suggested Prompt:

\`\`\`
I have two documents:
1. My existing achievement journal (paste your current journal below)
2. Raw activity data from the past period (this document)

Please help me:
- Review the raw activities and identify significant accomplishments
- Group related activities into broader achievements
- Merge these new achievements into my existing journal
- Update any ongoing projects that have made progress
- Maintain chronological order and consistent formatting
- Highlight any particularly impressive or career-significant items

For each achievement, provide:
- Clear, results-oriented description
- Context about the impact or importance
- Relevant technical details or metrics
- Date or time period

Focus on accomplishments that would be relevant for:
- Performance reviews
- Resume updates
- Job interviews
- Promotion discussions
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
 * Format commit line
 */
const formatCommitLine = (includeLinks) => (commit) => {
  const link = includeLinks ? ` ([link](${commit.url}))` : '';
  return `- \`${commit.sha}\` ${commit.message}${link} - ${formatDate(commit.date)}`;
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
    lines.push(...repoCommits.map(formatCommitLine(includeLinks)));
    lines.push('');
  });

  return lines.join('\n');
};

/**
 * Format pull request line
 */
const formatPullRequestLine = (includeLinks) => (pr) => {
  const link = includeLinks ? ` ([link](${pr.url}))` : '';
  const status = pr.merged_at ? '✅ merged' : pr.state === 'closed' ? '❌ closed' : '🔄 open';
  const lines = [
    `- #${pr.number}: ${pr.title} - ${status}${link}`,
    `  - Created: ${formatDate(pr.created_at)}`,
  ];

  if (pr.merged_at) {
    lines.push(`  - Merged: ${formatDate(pr.merged_at)}`);
  } else if (pr.closed_at) {
    lines.push(`  - Closed: ${formatDate(pr.closed_at)}`);
  }

  return lines.join('\n');
};

/**
 * Format pull requests section
 */
const formatPullRequests = (pullRequests, includeLinks) => {
  if (pullRequests.length === 0) return '';

  const prsByRepo = groupBy('repo')(pullRequests);
  const lines = [`### Pull Requests (${pullRequests.length} total)\n`];

  Object.entries(prsByRepo).forEach(([repo, repoPRs]) => {
    lines.push(`#### ${repo}\n`);
    lines.push(...repoPRs.map(formatPullRequestLine(includeLinks)));
    lines.push('');
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

  if (task.space) details.push(`- **Space:** ${task.space}`);
  if (task.folder) details.push(`- **Folder:** ${task.folder}`);
  if (task.list) details.push(`- **List:** ${task.list}`);
  if (task.priority && task.priority !== 'none') details.push(`- **Priority:** ${task.priority}`);
  if (task.tags?.length > 0) details.push(`- **Tags:** ${task.tags.join(', ')}`);

  details.push(`- **Created:** ${formatDate(task.date_created)}`);
  details.push(`- **Updated:** ${formatDate(task.date_updated)}`);

  if (task.date_closed) {
    details.push(`- **Closed:** ${formatDate(task.date_closed)}`);
  }

  if (task.due_date) {
    details.push(`- **Due:** ${formatDate(task.due_date)}`);
  }

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
1. Copy this entire document
2. Open Claude.ai or ChatGPT
3. Paste this document along with your existing journal
4. Use the suggested prompt above to merge and summarize
5. Save the updated journal
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
