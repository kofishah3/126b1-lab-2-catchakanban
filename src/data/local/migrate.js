import { getDb } from "./database.js";

const MIGRATIONS = [
  {
    id: "001-localStorage-to-indexeddb",
    run: migrateLocalStorageToIndexedDB,
  },
  {
    id: "002-hydrate-user-ids",
    run: hydrateUserIds,
    runOnce: false,
  },
];

function migrationKey(id) {
  return `migration:${id}`;
}

function getCurrentUserId() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1])).id;
  } catch {
    return null;
  }
}

export async function runMigrations() {
  for (const migration of MIGRATIONS) {
    const once = migration.runOnce !== false;

    if (
      migration.id === "001-localStorage-to-indexeddb" &&
      localStorage.getItem("indexeddb-migration-complete")
    ) {
      localStorage.setItem(migrationKey(migration.id), "true");
    }

    if (once && localStorage.getItem(migrationKey(migration.id))) continue;

    try {
      await migration.run();
      if (once) {
        localStorage.setItem(migrationKey(migration.id), "true");
      }
    } catch (err) {
      throw new Error(`Migration "${migration.id}" failed: ${err.message}`);
    }
  }
}

async function migrateLocalStorageToIndexedDB() {
  const BOARDS_KEY = "kanban-boards";
  const boardsRaw = localStorage.getItem(BOARDS_KEY);

  if (!boardsRaw) return;

  let boards;
  try {
    boards = JSON.parse(boardsRaw);
  } catch {
    throw new Error("corrupted boards data in localStorage");
  }

  if (!Array.isArray(boards) || boards.length === 0) return;

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
      } catch {
        throw new Error(`corrupted task data for board ${board.id}`);
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
}

async function hydrateUserIds() {
  const userId = getCurrentUserId();
  if (!userId) return;

  const db = await getDb();

  const boards = await db.getAll("boards");
  const orphanBoards = boards.filter((b) => !b.userId);
  if (orphanBoards.length > 0) {
    const tx = db.transaction("boards", "readwrite");
    for (const board of orphanBoards) {
      tx.store.put({ ...board, userId });
    }
    await tx.done;
  }

  const tasks = await db.getAll("tasks");
  const orphanTasks = tasks.filter((t) => !t.userId);
  if (orphanTasks.length > 0) {
    const tx = db.transaction("tasks", "readwrite");
    for (const task of orphanTasks) {
      tx.store.put({ ...task, userId });
    }
    await tx.done;
  }
}
