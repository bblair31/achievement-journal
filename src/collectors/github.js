/**
 * GitHub Collector
 * Fetches commits, PRs, and issues for a given user and date range
 */

export class GitHubCollector {
  constructor(token, username, config) {
    this.token = token;
    this.username = username;
    this.config = config;
    this.baseUrl = 'https://api.github.com';
  }

  /**
   * Make authenticated request to GitHub API
   */
  async request(endpoint, params = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        url.searchParams.append(key, params[key]);
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'achievement-journal',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all repositories for the user
   */
  async getRepositories() {
    const repos = [];
    let page = 1;
    const perPage = 100;

    // If specific repos are configured, just return those
    if (this.config.repos && this.config.repos.length > 0) {
      for (const repoFullName of this.config.repos) {
        try {
          const repo = await this.request(`/repos/${repoFullName}`);
          repos.push(repo);
        } catch (error) {
          console.error(`Failed to fetch repo ${repoFullName}:`, error.message);
        }
      }
      return repos;
    }

    // Otherwise, fetch all accessible repos
    while (true) {
      const batch = await this.request('/user/repos', {
        per_page: perPage,
        page: page,
        affiliation: 'owner,collaborator,organization_member',
        sort: 'updated',
      });

      if (batch.length === 0) break;
      repos.push(...batch);
      if (batch.length < perPage) break;
      page++;
    }

    return repos;
  }

  /**
   * Get commits for a repository in the date range
   */
  async getCommitsForRepo(repo, startDate, endDate) {
    try {
      const commits = await this.request(`/repos/${repo.full_name}/commits`, {
        author: this.username,
        since: startDate.toISOString(),
        until: endDate.toISOString(),
        per_page: 100,
      });

      return commits.map(commit => ({
        repo: repo.full_name,
        sha: commit.sha.substring(0, 7),
        message: commit.commit.message.split('\n')[0], // First line only
        date: commit.commit.author.date,
        url: commit.html_url,
      }));
    } catch (error) {
      console.error(`Failed to fetch commits for ${repo.full_name}:`, error.message);
      return [];
    }
  }

  /**
   * Get pull requests created by user in date range
   */
  async getPullRequests(startDate, endDate) {
    const prs = [];

    try {
      // Search for PRs created by the user
      const query = `author:${this.username} type:pr created:${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`;
      const result = await this.request('/search/issues', { q: query, per_page: 100 });

      for (const pr of result.items) {
        prs.push({
          repo: pr.repository_url.split('/').slice(-2).join('/'),
          number: pr.number,
          title: pr.title,
          state: pr.state,
          created_at: pr.created_at,
          closed_at: pr.closed_at,
          merged_at: pr.pull_request?.merged_at,
          url: pr.html_url,
        });
      }
    } catch (error) {
      console.error('Failed to fetch pull requests:', error.message);
    }

    return prs;
  }

  /**
   * Get issues created by user in date range
   */
  async getIssues(startDate, endDate) {
    const issues = [];

    try {
      // Search for issues created by the user
      const query = `author:${this.username} type:issue created:${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`;
      const result = await this.request('/search/issues', { q: query, per_page: 100 });

      for (const issue of result.items) {
        issues.push({
          repo: issue.repository_url.split('/').slice(-2).join('/'),
          number: issue.number,
          title: issue.title,
          state: issue.state,
          created_at: issue.created_at,
          closed_at: issue.closed_at,
          url: issue.html_url,
        });
      }
    } catch (error) {
      console.error('Failed to fetch issues:', error.message);
    }

    return issues;
  }

  /**
   * Collect all GitHub activity for the date range
   */
  async collect(startDate, endDate) {
    console.log(`📦 Collecting GitHub activity for ${this.username}...`);

    const repos = await this.getRepositories();
    console.log(`   Found ${repos.length} repositories`);

    // Collect commits from all repos
    const commitPromises = repos.map(repo => this.getCommitsForRepo(repo, startDate, endDate));
    const commitsArrays = await Promise.all(commitPromises);
    const commits = commitsArrays.flat();

    // Collect PRs and issues
    const [pullRequests, issues] = await Promise.all([
      this.getPullRequests(startDate, endDate),
      this.getIssues(startDate, endDate),
    ]);

    console.log(`   ✓ ${commits.length} commits`);
    console.log(`   ✓ ${pullRequests.length} pull requests`);
    console.log(`   ✓ ${issues.length} issues`);

    return {
      commits,
      pullRequests,
      issues,
    };
  }
}
