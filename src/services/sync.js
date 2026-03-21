import {
  generateTaskId,
  loadTasks,
  saveTasks,
  clearTasksKey,
  getBoards,
  saveBoards,
} from "../data/local/storage.js";

// ===== TASK SYNC OPERATIONS =====

/**
 * Get all tasks for a specific board
 * @param {string} boardId
 * @returns {Array}
 */
export function getTasks(boardId) {
  return loadTasks(boardId);
}

/**
 * Get tasks filtered by column for a specific board
 * @param {string} boardId
 * @param {string} columnId
 * @returns {Array}
 */
export function getTasksByColumn(boardId, columnId) {
  const tasks = loadTasks(boardId);
  return tasks.filter((task) => task.columnId === columnId);
}

/**
 * Add a new task to a board
 * @param {string} boardId
 * @param {Object} taskData
 * @returns {Object} The created task object
 */
export function addTask(boardId, taskData) {
  const tasks = loadTasks(boardId);

  const newTask = {
    id: generateTaskId(),
    title: taskData.title || "Untitled Task",
    createdAt: taskData.createdAt || new Date().toISOString(),
    deadline: taskData.deadline || null,
    priority: taskData.priority || null,
    columnId: taskData.columnId || "todo",
  };

  tasks.push(newTask);
  saveTasks(boardId, tasks);

  return newTask;
}

/**
 * Update an existing task's properties
 * @param {string} boardId
 * @param {string} taskId
 * @param {Object} updates
 * @returns {Object} The updated task object
 * @throws {Error} If task is not found in the board
 */
export function updateTask(boardId, taskId, updates) {
  const tasks = loadTasks(boardId);
  const taskIndex = tasks.findIndex((task) => task.id === taskId);

  if (taskIndex === -1) {
    throw new Error(`Task not found: ${taskId}`);
  }

  tasks[taskIndex] = {
    ...tasks[taskIndex],
    ...updates,
    id: tasks[taskIndex].id,
    createdAt: tasks[taskIndex].createdAt,
  };

  saveTasks(boardId, tasks);

  return tasks[taskIndex];
}

/**
 * Delete a task from a board
 * @param {string} boardId
 * @param {string} taskId
 * @throws {Error} If task is not found in the board
 */
export function deleteTask(boardId, taskId) {
  const tasks = loadTasks(boardId);
  const filteredTasks = tasks.filter((task) => task.id !== taskId);

  if (filteredTasks.length === tasks.length) {
    throw new Error(`Task not found: ${taskId}`);
  }

  saveTasks(boardId, filteredTasks);
}

/**
 * Move a task to a different column
 * @param {string} boardId
 * @param {string} taskId
 * @param {string} newColumnId
 * @returns {Object} The updated task object
 */
export function moveTask(boardId, taskId, newColumnId) {
  return updateTask(boardId, taskId, { columnId: newColumnId });
}

/**
 * Remove all tasks belonging to a board
 * @param {string} boardId
 */
export function clearBoardTasks(boardId) {
  clearTasksKey(boardId);
}

// ===== BOARD SYNC OPERATIONS =====

export { getBoards };

/**
 * Add a new board
 * @param {string} name
 * @returns {Object} The created board object
 */
export function addBoard(name) {
  const boards = getBoards();

  const newBoard = {
    id: `board-${Date.now()}`,
    name,
  };

  boards.push(newBoard);
  saveBoards(boards);

  return newBoard;
}

/**
 * Delete a board and all its tasks
 * @param {string} boardId
 */
export function deleteBoard(boardId) {
  clearBoardTasks(boardId);

  const boards = getBoards();
  const filtered = boards.filter((b) => b.id !== boardId);
  saveBoards(filtered);
}
