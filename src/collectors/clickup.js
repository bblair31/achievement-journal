/**
 * ClickUp Collector
 * Fetches tasks and subtasks assigned to the user in a given date range
 * Functional implementation
 */

const CLICKUP_BASE_URL = 'https://api.clickup.com/api/v2';

/**
 * Create ClickUp API request function with auth
 */
const createRequest = (token) => async (endpoint, params = {}) => {
  const url = new URL(`${CLICKUP_BASE_URL}${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

/**
 * Get the authenticated user
 */
const getUser = async (request) => {
  const result = await request('/user');
  return result.user;
};

/**
 * Get all teams (workspaces)
 */
const getTeams = async (request) => {
  const result = await request('/team');
  return result.teams;
};

/**
 * Get all spaces for a team
 */
const getSpaces = async (request, teamId) => {
  try {
    const result = await request(`/team/${teamId}/space`, { archived: false });
    return result.spaces;
  } catch (error) {
    console.error(`Failed to fetch spaces for team ${teamId}:`, error.message);
    return [];
  }
};

/**
 * Get all folders for a space
 */
const getFolders = async (request, spaceId) => {
  try {
    const result = await request(`/space/${spaceId}/folder`, { archived: false });
    return result.folders;
  } catch (error) {
    console.error(`Failed to fetch folders for space ${spaceId}:`, error.message);
    return [];
  }
};

/**
 * Get all lists for a folder
 */
const getLists = async (request, folderId) => {
  try {
    const result = await request(`/folder/${folderId}/list`, { archived: false });
    return result.lists;
  } catch (error) {
    console.error(`Failed to fetch lists for folder ${folderId}:`, error.message);
    return [];
  }
};

/**
 * Get folderless lists for a space
 */
const getFolderlessLists = async (request, spaceId) => {
  try {
    const result = await request(`/space/${spaceId}/list`, { archived: false });
    return result.lists;
  } catch (error) {
    console.error(`Failed to fetch folderless lists for space ${spaceId}:`, error.message);
    return [];
  }
};

/**
 * Filter tasks assigned to user
 */
const filterUserTasks = (userId) => (tasks) =>
  tasks.filter(
    (task) => task.assignees && task.assignees.some((assignee) => assignee.id === userId)
  );

/**
 * Format task data
 */
const formatTask = (task) => ({
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
  tags: task.tags?.map((tag) => tag.name) || [],
  time_estimate: task.time_estimate,
  time_spent: task.time_spent,
});

/**
 * Get tasks for a list
 */
const getTasksForList = async (request, listId, userId, startDate, endDate, config) => {
  try {
    const result = await request(`/list/${listId}/task`, {
      archived: false,
      include_closed: true,
      subtasks: config.includeSubtasks,
      date_updated_gt: startDate.getTime(),
      date_updated_lt: endDate.getTime(),
    });

    const userTasks = filterUserTasks(userId)(result.tasks);
    return userTasks.map(formatTask);
  } catch (error) {
    console.error(`Failed to fetch tasks for list ${listId}:`, error.message);
    return [];
  }
};

/**
 * Get all lists for a space (including foldered and folderless)
 */
const getAllListsForSpace = async (request, space) => {
  const [folderlessLists, folders] = await Promise.all([
    getFolderlessLists(request, space.id),
    getFolders(request, space.id),
  ]);

  const folderListsArrays = await Promise.all(
    folders.map((folder) => getLists(request, folder.id))
  );

  return [...folderlessLists, ...folderListsArrays.flat()];
};

/**
 * Filter lists by config
 */
const filterListsByConfig = (config) => (lists) => {
  if (config.lists.length === 0) return lists;
  return lists.filter((list) => config.lists.includes(list.id));
};

/**
 * Filter tasks by status config
 */
const filterTasksByStatus = (config) => (tasks) => {
  if (config.statuses.length === 0) return tasks;
  return tasks.filter((task) =>
    config.statuses.includes(task.status.toLowerCase())
  );
};

/**
 * Get tasks for a single team
 */
const getTasksForTeam = async (request, team, userId, startDate, endDate, config) => {
  const spaces = await getSpaces(request, team.id);

  const spaceTasksArrays = await Promise.all(
    spaces.map(async (space) => {
      const lists = await getAllListsForSpace(request, space);
      const filteredLists = filterListsByConfig(config)(lists);

      const listTasksArrays = await Promise.all(
        filteredLists.map((list) =>
          getTasksForList(request, list.id, userId, startDate, endDate, config)
        )
      );

      return listTasksArrays.flat();
    })
  );

  return spaceTasksArrays.flat();
};

/**
 * Filter teams by config
 */
const filterTeamsByConfig = (config) => (teams) => {
  if (config.workspaces.length === 0) return teams;
  return teams.filter((team) => config.workspaces.includes(team.id));
};

/**
 * Collect all ClickUp tasks for the date range
 */
export const collectClickUpActivity = async (token, config, startDate, endDate) => {
  console.log('📋 Collecting ClickUp tasks...');

  try {
    const request = createRequest(token);
    const user = await getUser(request);
    console.log(`   Collecting tasks for user: ${user.username}`);

    const teams = await getTeams(request);
    console.log(`   Found ${teams.length} team(s)`);

    const filteredTeams = filterTeamsByConfig(config)(teams);

    const teamTasksArrays = await Promise.all(
      filteredTeams.map((team) =>
        getTasksForTeam(request, team, user.id, startDate, endDate, config)
      )
    );

    const allTasks = teamTasksArrays.flat();
    const filteredTasks = filterTasksByStatus(config)(allTasks);

    console.log(`   ✓ ${filteredTasks.length} tasks found`);

    return { tasks: filteredTasks };
  } catch (error) {
    console.error('Failed to collect ClickUp data:', error.message);
    return { tasks: [] };
  }
};
