/**
 * Notion Collector
 * Fetches pages and database entries created or edited by the user
 * Functional implementation
 */

import { Client } from '@notionhq/client';

/**
 * Extract page title from properties or title array
 */
const getPageTitle = (page) => {
  // Try to get title from properties
  if (page.properties) {
    for (const value of Object.values(page.properties)) {
      if (value.type === 'title' && value.title.length > 0) {
        return value.title.map((t) => t.plain_text).join('');
      }
    }
  }

  // Fallback to page object title
  if (page.title?.length > 0) {
    return page.title.map((t) => t.plain_text).join('');
  }

  return 'Untitled';
};

/**
 * Check if page is in date range
 */
const isInDateRange = (startDate, endDate, includeEdited) => (page) => {
  const lastEditedTime = new Date(page.last_edited_time);
  const createdTime = new Date(page.created_time);

  const wasEdited = lastEditedTime >= startDate && lastEditedTime <= endDate;
  const wasCreated = createdTime >= startDate && createdTime <= endDate;

  return wasCreated || (includeEdited && wasEdited);
};

/**
 * Get database name from database object
 */
const getDatabaseName = async (notion, databaseId) => {
  try {
    const database = await notion.databases.retrieve({ database_id: databaseId });
    return database.title.map((t) => t.plain_text).join('') || 'Unnamed Database';
  } catch (error) {
    return 'Database';
  }
};

/**
 * Format page data
 */
const formatPage = (notion) => async (page) => {
  const title = getPageTitle(page);
  const createdTime = new Date(page.created_time);
  const lastEditedTime = new Date(page.last_edited_time);

  const isInDatabase = page.parent?.type === 'database_id';
  const databaseName = isInDatabase
    ? await getDatabaseName(notion, page.parent.database_id)
    : null;

  return {
    id: page.id,
    title,
    url: page.url,
    created_time: createdTime.toISOString(),
    last_edited_time: lastEditedTime.toISOString(),
    database: databaseName,
    type: page.object,
  };
};

/**
 * Search for pages modified in the date range
 */
const searchPages = async (notion, startDate, endDate) => {
  const pages = [];
  let hasMore = true;
  let startCursor = undefined;

  try {
    while (hasMore) {
      const response = await notion.search({
        filter: {
          property: 'object',
          value: 'page',
        },
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time',
        },
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        const lastEditedTime = new Date(page.last_edited_time);

        // Stop if we've gone past our date range
        if (lastEditedTime < startDate) {
          hasMore = false;
          break;
        }

        pages.push(page);
      }

      hasMore = hasMore && response.has_more;
      startCursor = response.next_cursor;
    }
  } catch (error) {
    console.error('Failed to search Notion pages:', error.message);
  }

  return pages;
};

/**
 * Fetch specific pages by ID
 */
const fetchSpecificPages = async (notion, pageIds, startDate, endDate) => {
  const pages = await Promise.all(
    pageIds.map(async (pageId) => {
      try {
        const page = await notion.pages.retrieve({ page_id: pageId });
        const lastEditedTime = new Date(page.last_edited_time);

        if (lastEditedTime >= startDate && lastEditedTime <= endDate) {
          return page;
        }
        return null;
      } catch (error) {
        console.error(`Failed to fetch page ${pageId}:`, error.message);
        return null;
      }
    })
  );

  return pages.filter(Boolean);
};

/**
 * Query database with pagination
 */
const queryDatabase = async (notion, databaseId, startDate, endDate) => {
  const pages = [];
  let hasMore = true;
  let startCursor = undefined;

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: databaseId,
        start_cursor: startCursor,
        page_size: 100,
        filter: {
          and: [
            {
              timestamp: 'last_edited_time',
              last_edited_time: {
                on_or_after: startDate.toISOString(),
              },
            },
            {
              timestamp: 'last_edited_time',
              last_edited_time: {
                on_or_before: endDate.toISOString(),
              },
            },
          ],
        },
      });

      pages.push(...response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }
  } catch (error) {
    console.error(`Failed to query database ${databaseId}:`, error.message);
  }

  return pages;
};

/**
 * Fetch pages from specific databases
 */
const fetchDatabasePages = async (notion, databaseIds, startDate, endDate) => {
  const databasePagesArrays = await Promise.all(
    databaseIds.map((databaseId) => queryDatabase(notion, databaseId, startDate, endDate))
  );

  return databasePagesArrays.flat();
};

/**
 * Collect pages based on config
 */
const collectPages = async (notion, config, startDate, endDate) => {
  // If specific pages configured, fetch those
  if (config.pages.length > 0) {
    return fetchSpecificPages(notion, config.pages, startDate, endDate);
  }

  // If specific databases configured, query those
  if (config.databases.length > 0) {
    return fetchDatabasePages(notion, config.databases, startDate, endDate);
  }

  // Otherwise, search all accessible pages
  const allPages = await searchPages(notion, startDate, endDate);
  return allPages.filter(isInDateRange(startDate, endDate, config.includeEdited));
};

/**
 * Collect all Notion pages for the date range
 */
export const collectNotionActivity = async (token, config, startDate, endDate) => {
  console.log('📝 Collecting Notion pages...');

  try {
    const notion = new Client({ auth: token });

    const pages = await collectPages(notion, config, startDate, endDate);
    const formatted = await Promise.all(pages.map(formatPage(notion)));

    console.log(`   ✓ ${formatted.length} pages found`);

    return { pages: formatted };
  } catch (error) {
    console.error('Failed to collect Notion data:', error.message);
    return { pages: [] };
  }
};
