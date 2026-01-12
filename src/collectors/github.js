/**
 * GitHub Collector
 * Fetches commits, PRs, and issues for a given user and date range
 * Functional implementation
 */

const GITHUB_BASE_URL = 'https://api.github.com';

/**
 * Create GitHub API request function with auth
 */
const createRequest = (token) => async (endpoint, params = {}) => {
  const url = new URL(`${GITHUB_BASE_URL}${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'achievement-journal',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

/**
 * Fetch paginated results from GitHub API
 */
const fetchPaginated = async (request, endpoint, params = {}, perPage = 100) => {
  const results = [];
  let page = 1;

  while (true) {
    const batch = await request(endpoint, { ...params, per_page: perPage, page });
    if (batch.length === 0) break;
    results.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }

  return results;
};

/**
 * Fetch specific repositories by name
 */
const fetchSpecificRepos = async (request, repoNames) => {
  const repos = await Promise.all(
    repoNames.map(async (repoFullName) => {
      try {
        return await request(`/repos/${repoFullName}`);
      } catch (error) {
        console.error(`Failed to fetch repo ${repoFullName}:`, error.message);
        return null;
      }
    })
  );

  return repos.filter(Boolean);
};

/**
 * Get all repositories for the user
 */
const getRepositories = async (request, config) => {
  // If specific repos are configured, fetch those
  if (config.repos?.length > 0) {
    return fetchSpecificRepos(request, config.repos);
  }

  // Otherwise, fetch all accessible repos
  return fetchPaginated(request, '/user/repos', {
    affiliation: 'owner,collaborator,organization_member',
    sort: 'updated',
  });
};

/**
 * Format a commit object
 */
const formatCommit = (repo) => (commit) => {
  const fullMessage = commit.commit.message;
  const lines = fullMessage.split('\n');
  const title = lines[0];
  // Get body (everything after first line, trimmed)
  const body = lines.slice(1).join('\n').trim();

  return {
    repo: repo.full_name,
    sha: commit.sha.substring(0, 7),
    title,
    body,
    date: commit.commit.author.date,
    url: commit.html_url,
  };
};

/**
 * Get commits for a single repository
 */
const getCommitsForRepo = async (request, username, startDate, endDate, repo) => {
  try {
    const commits = await request(`/repos/${repo.full_name}/commits`, {
      author: username,
      since: startDate.toISOString(),
      until: endDate.toISOString(),
      per_page: 100,
    });

    return commits.map(formatCommit(repo));
  } catch (error) {
    console.error(`Failed to fetch commits for ${repo.full_name}:`, error.message);
    return [];
  }
};

/**
 * Fetch full PR details including description and stats
 */
const fetchPullRequestDetails = async (request, repo, prNumber) => {
  try {
    const pr = await request(`/repos/${repo}/pulls/${prNumber}`);
    return {
      repo,
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state,
      created_at: pr.created_at,
      closed_at: pr.closed_at,
      merged_at: pr.merged_at,
      url: pr.html_url,
      additions: pr.additions,
      deletions: pr.deletions,
      changed_files: pr.changed_files,
    };
  } catch (error) {
    console.error(`Failed to fetch PR #${prNumber} from ${repo}:`, error.message);
    return null;
  }
};

/**
 * Get pull requests created by user with full details
 */
const getPullRequests = async (request, username, startDate, endDate) => {
  try {
    const dateRange = `${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`;
    const query = `author:${username} type:pr created:${dateRange}`;
    const result = await request('/search/issues', { q: query, per_page: 100 });

    console.log(`   Fetching details for ${result.items.length} PRs...`);

    // Fetch full details for each PR
    const prDetailsPromises = result.items.map((pr) => {
      const repo = pr.repository_url.split('/').slice(-2).join('/');
      return fetchPullRequestDetails(request, repo, pr.number);
    });

    const prDetails = await Promise.all(prDetailsPromises);
    return prDetails.filter(Boolean);
  } catch (error) {
    console.error('Failed to fetch pull requests:', error.message);
    return [];
  }
};

/**
 * Format an issue from search results
 */
const formatIssue = (issue) => ({
  repo: issue.repository_url.split('/').slice(-2).join('/'),
  number: issue.number,
  title: issue.title,
  state: issue.state,
  created_at: issue.created_at,
  closed_at: issue.closed_at,
  url: issue.html_url,
});

/**
 * Get issues created by user
 */
const getIssues = async (request, username, startDate, endDate) => {
  try {
    const dateRange = `${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`;
    const query = `author:${username} type:issue created:${dateRange}`;
    const result = await request('/search/issues', { q: query, per_page: 100 });

    return result.items.map(formatIssue);
  } catch (error) {
    console.error('Failed to fetch issues:', error.message);
    return [];
  }
};

/**
 * Collect all GitHub activity for the date range
 */
export const collectGitHubActivity = async (token, username, config, startDate, endDate) => {
  console.log(`📦 Collecting GitHub activity for ${username}...`);

  const request = createRequest(token);

  const repos = await getRepositories(request, config);
  console.log(`   Found ${repos.length} repositories`);

  // Collect commits from all repos
  const commitsArrays = await Promise.all(
    repos.map((repo) => getCommitsForRepo(request, username, startDate, endDate, repo))
  );
  const commits = commitsArrays.flat();

  // Collect PRs and issues in parallel
  const [pullRequests, issues] = await Promise.all([
    getPullRequests(request, username, startDate, endDate),
    getIssues(request, username, startDate, endDate),
  ]);

  console.log(`   ✓ ${commits.length} commits`);
  console.log(`   ✓ ${pullRequests.length} pull requests`);
  console.log(`   ✓ ${issues.length} issues`);

  return {
    commits,
    pullRequests,
    issues,
  };
};
