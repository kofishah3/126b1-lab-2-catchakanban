/**
 * Task Card Schema:
 * {
 *   id: string,
 *   boardId: string,
 *   title: string,
 *   createdAt: date,
 *   updatedAt: date,
 *   deadline: date,
 *   priority: string,      // ("Low", "Medium", "High"),
 *   columnId: string,      // ("todo", "doing", "done")
 * }
 */

import { getDb } from "./database.js";

/**
 * @returns {string}
 */
export function generateTaskId() {
  if (crypto.randomUUID) {
    return `task-${crypto.randomUUID()}`;
  }
  return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * @param {string} boardId
 * @returns {Promise<Array>}
 */
export async function loadTasks(boardId) {
  const db = await getDb();
  return db.getAllFromIndex("tasks", "by-board", boardId);
}

/**
 * @param {Object} task
 * @param {IDBTransaction} [tx]
 */
export async function putTask(task, tx) {
  if (tx) {
    tx.objectStore("tasks").put(task);
  } else {
    const db = await getDb();
    await db.put("tasks", task);
  }
}

/**
 * @param {string} taskId
 * @param {IDBTransaction} [tx]
 */
export async function removeTask(taskId, tx) {
  if (tx) {
    tx.objectStore("tasks").delete(taskId);
  } else {
    const db = await getDb();
    await db.delete("tasks", taskId);
  }
}

/**
 * @param {string} taskId
 * @returns {Promise<Object|undefined>}
 */
export async function getTask(taskId) {
  const db = await getDb();
  return db.get("tasks", taskId);
}

/**
 * @param {string} boardId
 */
export async function clearBoardTasks(boardId) {
  const db = await getDb();
  const tx = db.transaction("tasks", "readwrite");
  const index = tx.store.index("by-board");
  let cursor = await index.openCursor(boardId);

  while (cursor) {
    cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}

/**
 * @returns {Promise<Array>}
 */
export async function getBoards() {
  const db = await getDb();
  return db.getAll("boards");
}

/**
 * @param {Object} board
 * @param {IDBTransaction} [tx]
 */
export async function putBoard(board, tx) {
  if (tx) {
    tx.objectStore("boards").put(board);
  } else {
    const db = await getDb();
    await db.put("boards", board);
  }
}

/**
 * @param {string} boardId
 * @param {IDBTransaction} [tx]
 */
export async function removeBoard(boardId, tx) {
  if (tx) {
    tx.objectStore("boards").delete(boardId);
  } else {
    const db = await getDb();
    await db.delete("boards", boardId);
  }
}
