/**
 * Markdown Formatter
 * Formats collected data into a structured markdown file with LLM prompt
 */

export class MarkdownFormatter {
  constructor(config) {
    this.config = config;
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Generate the LLM prompt section
   */
  generatePromptSection(startDate, endDate) {
    return `# Achievement Collection Report

**Collection Period:** ${this.formatDate(startDate)} to ${this.formatDate(endDate)}
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
  }

  /**
   * Format GitHub section
   */
  formatGitHub(data) {
    if (!data || (data.commits.length === 0 && data.pullRequests.length === 0 && data.issues.length === 0)) {
      return '';
    }

    let output = '## 💻 GitHub Activity\n\n';

    // Commits section
    if (data.commits.length > 0) {
      output += `### Commits (${data.commits.length} total)\n\n`;

      // Group commits by repo
      const commitsByRepo = {};
      data.commits.forEach(commit => {
        if (!commitsByRepo[commit.repo]) {
          commitsByRepo[commit.repo] = [];
        }
        commitsByRepo[commit.repo].push(commit);
      });

      // Output by repo
      for (const [repo, commits] of Object.entries(commitsByRepo)) {
        output += `#### ${repo}\n\n`;
        commits.forEach(commit => {
          const link = this.config.includeLinks ? ` ([link](${commit.url}))` : '';
          output += `- \`${commit.sha}\` ${commit.message}${link} - ${this.formatDate(commit.date)}\n`;
        });
        output += '\n';
      }
    }

    // Pull Requests section
    if (data.pullRequests.length > 0) {
      output += `### Pull Requests (${data.pullRequests.length} total)\n\n`;

      // Group by repo
      const prsByRepo = {};
      data.pullRequests.forEach(pr => {
        if (!prsByRepo[pr.repo]) {
          prsByRepo[pr.repo] = [];
        }
        prsByRepo[pr.repo].push(pr);
      });

      for (const [repo, prs] of Object.entries(prsByRepo)) {
        output += `#### ${repo}\n\n`;
        prs.forEach(pr => {
          const link = this.config.includeLinks ? ` ([link](${pr.url}))` : '';
          const status = pr.merged_at ? '✅ merged' : pr.state === 'closed' ? '❌ closed' : '🔄 open';
          output += `- #${pr.number}: ${pr.title} - ${status}${link}\n`;
          output += `  - Created: ${this.formatDate(pr.created_at)}\n`;
          if (pr.merged_at) {
            output += `  - Merged: ${this.formatDate(pr.merged_at)}\n`;
          } else if (pr.closed_at) {
            output += `  - Closed: ${this.formatDate(pr.closed_at)}\n`;
          }
        });
        output += '\n';
      }
    }

    // Issues section
    if (data.issues.length > 0) {
      output += `### Issues Created (${data.issues.length} total)\n\n`;

      // Group by repo
      const issuesByRepo = {};
      data.issues.forEach(issue => {
        if (!issuesByRepo[issue.repo]) {
          issuesByRepo[issue.repo] = [];
        }
        issuesByRepo[issue.repo].push(issue);
      });

      for (const [repo, issues] of Object.entries(issuesByRepo)) {
        output += `#### ${repo}\n\n`;
        issues.forEach(issue => {
          const link = this.config.includeLinks ? ` ([link](${issue.url}))` : '';
          const status = issue.state === 'closed' ? '✅ closed' : '🔄 open';
          output += `- #${issue.number}: ${issue.title} - ${status}${link}\n`;
          output += `  - Created: ${this.formatDate(issue.created_at)}\n`;
          if (issue.closed_at) {
            output += `  - Closed: ${this.formatDate(issue.closed_at)}\n`;
          }
        });
        output += '\n';
      }
    }

    return output;
  }

  /**
   * Format ClickUp section
   */
  formatClickUp(data) {
    if (!data || data.tasks.length === 0) {
      return '';
    }

    let output = `## ✅ ClickUp Tasks (${data.tasks.length} total)\n\n`;

    // Group by status
    const tasksByStatus = {};
    data.tasks.forEach(task => {
      const status = task.status || 'No Status';
      if (!tasksByStatus[status]) {
        tasksByStatus[status] = [];
      }
      tasksByStatus[status].push(task);
    });

    // Output by status
    for (const [status, tasks] of Object.entries(tasksByStatus)) {
      output += `### ${status} (${tasks.length})\n\n`;

      tasks.forEach(task => {
        const link = this.config.includeLinks ? ` ([link](${task.url}))` : '';
        output += `#### ${task.name}${link}\n\n`;

        if (task.space) output += `- **Space:** ${task.space}\n`;
        if (task.folder) output += `- **Folder:** ${task.folder}\n`;
        if (task.list) output += `- **List:** ${task.list}\n`;
        if (task.priority && task.priority !== 'none') output += `- **Priority:** ${task.priority}\n`;
        if (task.tags && task.tags.length > 0) output += `- **Tags:** ${task.tags.join(', ')}\n`;

        output += `- **Created:** ${this.formatDate(task.date_created)}\n`;
        output += `- **Updated:** ${this.formatDate(task.date_updated)}\n`;

        if (task.date_closed) {
          output += `- **Closed:** ${this.formatDate(task.date_closed)}\n`;
        }

        if (task.due_date) {
          output += `- **Due:** ${this.formatDate(task.due_date)}\n`;
        }

        if (task.time_estimate || task.time_spent) {
          const estimate = task.time_estimate ? `${Math.round(task.time_estimate / 3600000)}h` : 'none';
          const spent = task.time_spent ? `${Math.round(task.time_spent / 3600000)}h` : '0h';
          output += `- **Time:** ${spent} spent / ${estimate} estimated\n`;
        }

        if (task.description) {
          output += `\n${task.description}\n`;
        }

        output += '\n';
      });
    }

    return output;
  }

  /**
   * Format Notion section
   */
  formatNotion(data) {
    if (!data || data.pages.length === 0) {
      return '';
    }

    let output = `## 📝 Notion Pages (${data.pages.length} total)\n\n`;

    // Group by database (if applicable)
    const pagesByDatabase = { 'Standalone Pages': [] };
    data.pages.forEach(page => {
      const db = page.database || 'Standalone Pages';
      if (!pagesByDatabase[db]) {
        pagesByDatabase[db] = [];
      }
      pagesByDatabase[db].push(page);
    });

    // Output by database/category
    for (const [dbName, pages] of Object.entries(pagesByDatabase)) {
      if (pages.length === 0) continue;

      output += `### ${dbName} (${pages.length})\n\n`;

      pages.forEach(page => {
        const link = this.config.includeLinks ? ` ([link](${page.url}))` : '';
        output += `#### ${page.title}${link}\n\n`;
        output += `- **Created:** ${this.formatDate(page.created_time)}\n`;
        output += `- **Last Edited:** ${this.formatDate(page.last_edited_time)}\n`;
        output += '\n';
      });
    }

    return output;
  }

  /**
   * Generate summary statistics
   */
  generateSummary(github, clickup, notion) {
    let output = '## 📊 Summary Statistics\n\n';

    if (github) {
      output += `- **GitHub Commits:** ${github.commits.length}\n`;
      output += `- **Pull Requests:** ${github.pullRequests.length}\n`;
      output += `- **Issues Created:** ${github.issues.length}\n`;
    }

    if (clickup) {
      output += `- **ClickUp Tasks:** ${clickup.tasks.length}\n`;
    }

    if (notion) {
      output += `- **Notion Pages:** ${notion.pages.length}\n`;
    }

    output += '\n---\n\n';

    return output;
  }

  /**
   * Generate complete markdown document
   */
  generate(data, startDate, endDate) {
    let output = '';

    // Add prompt section
    output += this.generatePromptSection(startDate, endDate);

    // Add summary
    output += this.generateSummary(data.github, data.clickup, data.notion);

    // Add each section
    output += this.formatGitHub(data.github);
    output += this.formatClickUp(data.clickup);
    output += this.formatNotion(data.notion);

    // Add footer
    output += '---\n\n';
    output += '*End of Achievement Collection Report*\n';
    output += '\n**Next Steps:**\n';
    output += '1. Copy this entire document\n';
    output += '2. Open Claude.ai or ChatGPT\n';
    output += '3. Paste this document along with your existing journal\n';
    output += '4. Use the suggested prompt above to merge and summarize\n';
    output += '5. Save the updated journal\n';

    return output;
  }
}
