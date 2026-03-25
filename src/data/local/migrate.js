import { getDb } from "./database.js";

// ---------------------------------------------------------------------------
// Migration runner
//
// Each entry in MIGRATIONS is either:
//   - runOnce: true  (default) — runs once, then permanently flagged in
//                                localStorage so it never runs again.
//   - runOnce: false           — runs every startup. Must be idempotent.
//                                Useful for data patches that depend on
//                                runtime state (e.g. logged-in userId).
//
// To fix any future schema drift, just append a new object to the array.
// ---------------------------------------------------------------------------

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

/**
 * Runs all pending migrations in order. Safe to call on every startup.
 * - runOnce migrations (default) are skipped after their first successful run.
 * - Recurring migrations (runOnce: false) execute every startup.
 */
export async function runMigrations() {
  for (const migration of MIGRATIONS) {
    const once = migration.runOnce !== false;

    // Backward-compat: treat the old one-off flag as migration 001 being done.
    if (
      migration.id === "001-localStorage-to-indexeddb" &&
      localStorage.getItem("indexeddb-migration-complete")
    ) {
      localStorage.setItem(migrationKey(migration.id), "true");
    }

    if (once && localStorage.getItem(migrationKey(migration.id))) {
      console.log(`[migrate] Skipping "${migration.id}" (already done)`);
      continue;
    }

    try {
      console.log(`[migrate] Running "${migration.id}"...`);
      await migration.run();
      if (once) {
        localStorage.setItem(migrationKey(migration.id), "true");
      }
      console.log(`[migrate] Finished "${migration.id}"`);
    } catch (err) {
      throw new Error(`Migration "${migration.id}" failed: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Migration implementations
// ---------------------------------------------------------------------------

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

/**
 * Stamps any board or task in IndexedDB that is missing a userId
 * with the currently logged-in user's id. Runs every startup (runOnce: false)
 * because it depends on the user being logged in, which isn't guaranteed.
 * Idempotent — skips records that already have userId.
 */
async function hydrateUserIds() {
  const userId = getCurrentUserId();
  console.log("[migrate:002] userId from token:", userId);
  if (!userId) {
    console.warn("[migrate:002] No userId — skipping hydration (not logged in?)");
    return;
  }

  const db = await getDb();

  const boards = await db.getAll("boards");
  console.log(`[migrate:002] Found ${boards.length} board(s) in IndexedDB`);
  const orphanBoards = boards.filter(b => !b.userId);
  console.log(`[migrate:002] ${orphanBoards.length} board(s) missing userId`);
  if (orphanBoards.length > 0) {
    const tx = db.transaction("boards", "readwrite");
    for (const board of orphanBoards) {
      tx.store.put({ ...board, userId });
    }
    await tx.done;
    console.log(`[migrate:002] Stamped userId on ${orphanBoards.length} board(s).`);
  }

  const tasks = await db.getAll("tasks");
  console.log(`[migrate:002] Found ${tasks.length} task(s) in IndexedDB`);
  const orphanTasks = tasks.filter(t => !t.userId);
  console.log(`[migrate:002] ${orphanTasks.length} task(s) missing userId`);
  if (orphanTasks.length > 0) {
    const tx = db.transaction("tasks", "readwrite");
    for (const task of orphanTasks) {
      tx.store.put({ ...task, userId });
    }
    await tx.done;
    console.log(`[migrate:002] Stamped userId on ${orphanTasks.length} task(s).`);
  }
}
