import { getDb } from "./database.js";

const MIGRATION_FLAG = "indexeddb-migration-complete";
const BOARDS_KEY = "kanban-boards";

/**
 * One-time migration from localStorage to IndexedDB.
 * Transfers all boards and their tasks, then removes localStorage keys.
 */
export async function migrateFromLocalStorage() {
  if (localStorage.getItem(MIGRATION_FLAG)) {
    return;
  }

  const boardsRaw = localStorage.getItem(BOARDS_KEY);
  if (!boardsRaw) {
    localStorage.setItem(MIGRATION_FLAG, "true");
    return;
  }

  let boards;
  try {
    boards = JSON.parse(boardsRaw);
  } catch (e) {
    throw new Error("Migration failed: corrupted boards data in localStorage");
  }

  if (!Array.isArray(boards) || boards.length === 0) {
    localStorage.setItem(MIGRATION_FLAG, "true");
    return;
  }

  const db = await getDb();
  const tx = db.transaction(["boards", "tasks", "manifest"], "readwrite");
  const now = new Date().toISOString();

  for (const board of boards) {
    tx.objectStore("boards").put({
      ...board,
      createdAt: board.createdAt || now,
      updatedAt: board.updatedAt || now,
    });

    tx.objectStore("manifest").put({
      key: `board:${board.id}`,
      entityType: "board",
      entityId: board.id,
      changeType: "created",
      updatedAt: now,
    });

    const tasksRaw = localStorage.getItem(`tasks-${board.id}`);
    if (tasksRaw) {
      let tasks;
      try {
        tasks = JSON.parse(tasksRaw);
      } catch (e) {
        throw new Error(`Migration failed: corrupted task data for board ${board.id}`);
      }
      if (Array.isArray(tasks)) {
        for (const task of tasks) {
          tx.objectStore("tasks").put({
            ...task,
            boardId: board.id,
            updatedAt: task.updatedAt || now,
          });

          tx.objectStore("manifest").put({
            key: `task:${task.id}`,
            entityType: "task",
            entityId: task.id,
            changeType: "created",
            updatedAt: now,
          });
        }
      }
    }
  }

  await tx.done;

  for (const board of boards) {
    localStorage.removeItem(`tasks-${board.id}`);
  }
  localStorage.removeItem(BOARDS_KEY);
  localStorage.setItem(MIGRATION_FLAG, "true");
}
