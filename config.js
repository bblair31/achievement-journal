/**
 * Configuration for achievement journal collection
 * Customize these settings based on your needs
 */

export default {
  // GitHub Configuration
  github: {
    // Username to collect commits for
    username: process.env.GITHUB_USERNAME || 'bblair31',

    // Specific repos to track (leave empty array to track all accessible repos)
    // Example: ['owner/repo1', 'owner/repo2']
    repos: [],

    // Only include repos from these organizations (leave empty for all)
    // Example: ['my-company', 'my-other-org']
    orgs: ['WorkUp-Health'],

    // Include private repositories
    includePrivate: true,

    // Include organizations (will fetch all repos from orgs you're a member of)
    includeOrgs: true,
  },

  // ClickUp Configuration
  clickup: {
    // Specific workspace IDs to track (leave empty to track all)
    // You can find these in ClickUp URLs
    workspaces: [],

    // Specific list IDs to track (leave empty to track all)
    lists: [],

    // Include subtasks
    includeSubtasks: true,

    // Task statuses to include (leave empty for all)
    // Example: ['complete', 'closed']
    statuses: [],
  },

  // Notion Configuration
  notion: {
    // Specific page IDs to track (leave empty to search all accessible pages)
    // You can find page IDs in the URL: notion.so/Page-Title-<PAGE_ID>
    pages: [],

    // Specific database IDs to track (leave empty to search all)
    databases: [],

    // Include pages you've edited but didn't create
    includeEdited: true,
  },

  // Output Configuration
  output: {
    // Directory to save output files
    directory: './output',

    // Filename pattern (will append timestamp)
    filePattern: 'achievements',

    // Include links back to original items
    includeLinks: true,
  },

  // Date Range Configuration (overridden by CLI arguments)
  dateRange: {
    // Default period if not specified: 'week', 'month', 'quarter', 'year'
    defaultPeriod: 'month',
  },
};
