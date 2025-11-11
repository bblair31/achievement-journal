/**
 * Notion Collector
 * Fetches pages and database entries created or edited by the user
 */

import { Client } from '@notionhq/client';

export class NotionCollector {
  constructor(token, config) {
    this.notion = new Client({ auth: token });
    this.config = config;
  }

  /**
   * Search for pages modified in the date range
   */
  async searchPages(startDate, endDate) {
    const pages = [];
    let hasMore = true;
    let startCursor = undefined;

    try {
      while (hasMore) {
        const response = await this.notion.search({
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

        // Filter pages by date range
        for (const page of response.results) {
          const lastEditedTime = new Date(page.last_edited_time);
          const createdTime = new Date(page.created_time);

          // Check if page was edited or created in date range
          const wasEdited = lastEditedTime >= startDate && lastEditedTime <= endDate;
          const wasCreated = createdTime >= startDate && createdTime <= endDate;

          if (wasCreated || (this.config.includeEdited && wasEdited)) {
            pages.push(page);
          }

          // Stop if we've gone past our date range
          if (lastEditedTime < startDate) {
            hasMore = false;
            break;
          }
        }

        hasMore = hasMore && response.has_more;
        startCursor = response.next_cursor;
      }
    } catch (error) {
      console.error('Failed to search Notion pages:', error.message);
    }

    return pages;
  }

  /**
   * Get page title from properties
   */
  getPageTitle(page) {
    // Try to get title from different property types
    if (page.properties) {
      for (const [key, value] of Object.entries(page.properties)) {
        if (value.type === 'title' && value.title.length > 0) {
          return value.title.map(t => t.plain_text).join('');
        }
      }
    }

    // Fallback to page object title
    if (page.title && page.title.length > 0) {
      return page.title.map(t => t.plain_text).join('');
    }

    // For pages in databases without explicit title
    return 'Untitled';
  }

  /**
   * Format page data
   */
  async formatPage(page) {
    const title = this.getPageTitle(page);
    const createdTime = new Date(page.created_time);
    const lastEditedTime = new Date(page.last_edited_time);

    // Get page URL
    const url = page.url;

    // Determine if this is in a database
    const isInDatabase = page.parent?.type === 'database_id';
    let databaseName = null;

    if (isInDatabase) {
      try {
        const database = await this.notion.databases.retrieve({
          database_id: page.parent.database_id,
        });
        databaseName = database.title.map(t => t.plain_text).join('') || 'Unnamed Database';
      } catch (error) {
        // Database might not be accessible
        databaseName = 'Database';
      }
    }

    return {
      id: page.id,
      title,
      url,
      created_time: createdTime.toISOString(),
      last_edited_time: lastEditedTime.toISOString(),
      database: databaseName,
      type: page.object,
    };
  }

  /**
   * Collect all Notion pages for the date range
   */
  async collect(startDate, endDate) {
    console.log('📝 Collecting Notion pages...');

    try {
      // If specific pages configured, fetch those
      if (this.config.pages.length > 0) {
        const pages = [];
        for (const pageId of this.config.pages) {
          try {
            const page = await this.notion.pages.retrieve({ page_id: pageId });
            const lastEditedTime = new Date(page.last_edited_time);
            if (lastEditedTime >= startDate && lastEditedTime <= endDate) {
              pages.push(page);
            }
          } catch (error) {
            console.error(`Failed to fetch page ${pageId}:`, error.message);
          }
        }
        const formatted = await Promise.all(pages.map(p => this.formatPage(p)));
        console.log(`   ✓ ${formatted.length} pages found`);
        return { pages: formatted };
      }

      // If specific databases configured, query those
      if (this.config.databases.length > 0) {
        const pages = [];
        for (const databaseId of this.config.databases) {
          try {
            let hasMore = true;
            let startCursor = undefined;

            while (hasMore) {
              const response = await this.notion.databases.query({
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
        }
        const formatted = await Promise.all(pages.map(p => this.formatPage(p)));
        console.log(`   ✓ ${formatted.length} pages found`);
        return { pages: formatted };
      }

      // Otherwise, search all accessible pages
      const pages = await this.searchPages(startDate, endDate);
      const formatted = await Promise.all(pages.map(p => this.formatPage(p)));

      console.log(`   ✓ ${formatted.length} pages found`);

      return { pages: formatted };
    } catch (error) {
      console.error('Failed to collect Notion data:', error.message);
      return { pages: [] };
    }
  }
}
