import { getDb } from "../data/local/database.js";
import {
  generateTaskId,
  loadTasks,
  putTask,
  removeTask,
  getTask,
  clearBoardTasks,
  getBoards,
  putBoard,
  removeBoard,
} from "../data/local/storage.js";
import { recordChange } from "../data/local/manifest.js";

// ===== TASK SYNC OPERATIONS =====

/**
 * Get all tasks for a specific board
 * @param {string} boardId
 * @returns {Promise<Array>}
 */
export async function getTasks(boardId) {
  return loadTasks(boardId);
}

/**
 * Get tasks filtered by column for a specific board
 * @param {string} boardId
 * @param {string} columnId
 * @returns {Promise<Array>}
 */
export async function getTasksByColumn(boardId, columnId) {
  const db = await getDb();
  return db.getAllFromIndex("tasks", "by-board-column", [boardId, columnId]);
}

/**
 * Add a new task to a board
 * @param {string} boardId
 * @param {Object} taskData
 * @returns {Promise<Object>} The created task object
 */
export async function addTask(boardId, taskData) {
  const now = new Date().toISOString();

  const newTask = {
    id: generateTaskId(),
    boardId,
    title: taskData.title || "Untitled Task",
    createdAt: taskData.createdAt || now,
    updatedAt: now,
    deadline: taskData.deadline || null,
    priority: taskData.priority || null,
    columnId: taskData.columnId || "todo",
  };

  const db = await getDb();
  const tx = db.transaction(["tasks", "manifest"], "readwrite");
  await putTask(newTask, tx);
  await recordChange("task", newTask.id, "created", tx);
  await tx.done;

  return newTask;
}

/**
 * Update an existing task's properties
 * @param {string} boardId
 * @param {string} taskId
 * @param {Object} updates
 * @returns {Promise<Object>} The updated task object
 * @throws {Error} If task is not found in the board
 */
export async function updateTask(boardId, taskId, updates) {
  const existing = await getTask(taskId);

  if (!existing || existing.boardId !== boardId) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const updatedTask = {
    ...existing,
    ...updates,
    id: existing.id,
    boardId: existing.boardId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const db = await getDb();
  const tx = db.transaction(["tasks", "manifest"], "readwrite");
  await putTask(updatedTask, tx);
  await recordChange("task", taskId, "modified", tx);
  await tx.done;

  return updatedTask;
}

/**
 * Delete a task from a board
 * @param {string} boardId
 * @param {string} taskId
 * @throws {Error} If task is not found in the board
 */
export async function deleteTask(boardId, taskId) {
  const existing = await getTask(taskId);

  if (!existing || existing.boardId !== boardId) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const db = await getDb();
  const tx = db.transaction(["tasks", "manifest"], "readwrite");
  await removeTask(taskId, tx);
  await recordChange("task", taskId, "deleted", tx);
  await tx.done;
}

/**
 * Move a task to a different column
 * @param {string} boardId
 * @param {string} taskId
 * @param {string} newColumnId
 * @returns {Promise<Object>} The updated task object
 */
export async function moveTask(boardId, taskId, newColumnId) {
  return updateTask(boardId, taskId, { columnId: newColumnId });
}

/**
 * Remove all tasks belonging to a board
 * @param {string} boardId
 */
export async function clearAllBoardTasks(boardId) {
  const tasks = await loadTasks(boardId);
  const db = await getDb();
  const tx = db.transaction(["tasks", "manifest"], "readwrite");

  for (const task of tasks) {
    tx.objectStore("tasks").delete(task.id);
    await recordChange("task", task.id, "deleted", tx);
  }

  await tx.done;
}

// ===== BOARD SYNC OPERATIONS =====

export { getBoards };

/**
 * Add a new board
 * @param {string} name
 * @returns {Promise<Object>} The created board object
 */
export async function addBoard(name) {
  const now = new Date().toISOString();

  const newBoard = {
    id: crypto.randomUUID ? `board-${crypto.randomUUID()}` : `board-${Date.now()}`,
    name,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  const tx = db.transaction(["boards", "manifest"], "readwrite");
  await putBoard(newBoard, tx);
  await recordChange("board", newBoard.id, "created", tx);
  await tx.done;

  return newBoard;
}

/**
 * Delete a board and all its tasks
 * @param {string} boardId
 */
export async function deleteBoard(boardId) {
  const tasks = await loadTasks(boardId);
  const db = await getDb();
  const tx = db.transaction(["boards", "tasks", "manifest"], "readwrite");

  for (const task of tasks) {
    tx.objectStore("tasks").delete(task.id);
    await recordChange("task", task.id, "deleted", tx);
  }

  await removeBoard(boardId, tx);
  await recordChange("board", boardId, "deleted", tx);
  await tx.done;
}
