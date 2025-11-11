/**
 * ClickUp Collector
 * Fetches tasks and subtasks assigned to the user in a given date range
 */

export class ClickUpCollector {
  constructor(token, config) {
    this.token = token;
    this.config = config;
    this.baseUrl = 'https://api.clickup.com/api/v2';
  }

  /**
   * Make authenticated request to ClickUp API
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
        'Authorization': this.token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get the authenticated user
   */
  async getUser() {
    const result = await this.request('/user');
    return result.user;
  }

  /**
   * Get all teams (workspaces) for the user
   */
  async getTeams() {
    const result = await this.request('/team');
    return result.teams;
  }

  /**
   * Get all spaces for a team
   */
  async getSpaces(teamId) {
    try {
      const result = await this.request(`/team/${teamId}/space`, { archived: false });
      return result.spaces;
    } catch (error) {
      console.error(`Failed to fetch spaces for team ${teamId}:`, error.message);
      return [];
    }
  }

  /**
   * Get all folders for a space
   */
  async getFolders(spaceId) {
    try {
      const result = await this.request(`/space/${spaceId}/folder`, { archived: false });
      return result.folders;
    } catch (error) {
      console.error(`Failed to fetch folders for space ${spaceId}:`, error.message);
      return [];
    }
  }

  /**
   * Get all lists for a folder
   */
  async getLists(folderId) {
    try {
      const result = await this.request(`/folder/${folderId}/list`, { archived: false });
      return result.lists;
    } catch (error) {
      console.error(`Failed to fetch lists for folder ${folderId}:`, error.message);
      return [];
    }
  }

  /**
   * Get folderless lists for a space
   */
  async getFolderlessLists(spaceId) {
    try {
      const result = await this.request(`/space/${spaceId}/list`, { archived: false });
      return result.lists;
    } catch (error) {
      console.error(`Failed to fetch folderless lists for space ${spaceId}:`, error.message);
      return [];
    }
  }

  /**
   * Get tasks for a list
   */
  async getTasksForList(listId, userId, startDate, endDate) {
    try {
      const result = await this.request(`/list/${listId}/task`, {
        archived: false,
        include_closed: true,
        subtasks: this.config.includeSubtasks,
        date_updated_gt: startDate.getTime(),
        date_updated_lt: endDate.getTime(),
      });

      // Filter for tasks assigned to the user
      return result.tasks.filter(task =>
        task.assignees && task.assignees.some(assignee => assignee.id === userId)
      );
    } catch (error) {
      console.error(`Failed to fetch tasks for list ${listId}:`, error.message);
      return [];
    }
  }

  /**
   * Format task data
   */
  formatTask(task) {
    return {
      id: task.id,
      name: task.name,
      status: task.status.status,
      priority: task.priority?.priority || 'none',
      due_date: task.due_date,
      date_created: task.date_created,
      date_updated: task.date_updated,
      date_closed: task.date_closed,
      description: task.description || '',
      url: task.url,
      list: task.list?.name || '',
      folder: task.folder?.name || '',
      space: task.space?.name || '',
      tags: task.tags?.map(tag => tag.name) || [],
      time_estimate: task.time_estimate,
      time_spent: task.time_spent,
    };
  }

  /**
   * Collect all ClickUp tasks for the date range
   */
  async collect(startDate, endDate) {
    console.log('📋 Collecting ClickUp tasks...');

    try {
      // Get the authenticated user
      const user = await this.getUser();
      console.log(`   Collecting tasks for user: ${user.username}`);

      // Get all teams
      const teams = await this.getTeams();
      console.log(`   Found ${teams.length} team(s)`);

      const allTasks = [];

      // For each team, traverse the hierarchy: team -> spaces -> folders -> lists -> tasks
      for (const team of teams) {
        // Skip if specific workspaces configured and this isn't one
        if (this.config.workspaces.length > 0 && !this.config.workspaces.includes(team.id)) {
          continue;
        }

        const spaces = await this.getSpaces(team.id);

        for (const space of spaces) {
          // Get folderless lists
          const folderlessLists = await this.getFolderlessLists(space.id);

          // Get folders and their lists
          const folders = await this.getFolders(space.id);
          const folderLists = await Promise.all(
            folders.map(folder => this.getLists(folder.id))
          );

          const allLists = [...folderlessLists, ...folderLists.flat()];

          // Get tasks from all lists
          for (const list of allLists) {
            // Skip if specific lists configured and this isn't one
            if (this.config.lists.length > 0 && !this.config.lists.includes(list.id)) {
              continue;
            }

            const tasks = await this.getTasksForList(list.id, user.id, startDate, endDate);

            // Filter by status if configured
            const filteredTasks = this.config.statuses.length > 0
              ? tasks.filter(task => this.config.statuses.includes(task.status.status.toLowerCase()))
              : tasks;

            allTasks.push(...filteredTasks.map(task => this.formatTask(task)));
          }
        }
      }

      console.log(`   ✓ ${allTasks.length} tasks found`);

      return { tasks: allTasks };
    } catch (error) {
      console.error('Failed to collect ClickUp data:', error.message);
      return { tasks: [] };
    }
  }
}
