import { getManifest, clearManifestEntry, purgeTombstones } from "../data/local/manifest.js";
import { getTask, putTask, removeTask, getBoards as getAllLocalBoards, putBoard, removeBoard } from "../data/local/storage.js";
import { fetchBoards, fetchTasks, pushBoard, pushTask } from "../data/remote/api.js";
import { state } from "../state.js";
import { getBoards } from "./sync.js";

const SYNC_INTERVAL_MS = 60000;

let syncIntervalId = null;
let isSyncing = false;

function getUserId() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.id;
  } catch {
    return null;
  }
}

/**
 * Called once before rendering. If online, pushes pending changes
 * and pulls server state into IndexedDB so initializeState() reads
 * fresh data. If offline, resolves immediately (IndexedDB as-is).
 */
export async function initialSync() {
  if (!localStorage.getItem("token")) return;
  if (!navigator.onLine) {
    console.log("[sync] Offline at startup, using local data.");
    return;
  }

  console.log("[sync] Online at startup, syncing before render...");
  isSyncing = true;
  try {
    await pushChanges();
    await pullFromServer({ skipRefresh: true });
  } catch (err) {
    console.warn("[sync] Initial sync failed, falling back to local data:", err.message);
  } finally {
    isSyncing = false;
  }
}

/**
 * Called after rendering. Registers online/offline listeners
 * and starts the periodic background sync interval.
 */
export function startSync() {
  if (!localStorage.getItem("token")) return;

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  if (navigator.onLine) {
    syncIntervalId = setInterval(sync, SYNC_INTERVAL_MS);
  }
}

function onOnline() {
  console.log("[sync] Back online, syncing...");
  sync();
  if (!syncIntervalId) {
    syncIntervalId = setInterval(sync, SYNC_INTERVAL_MS);
  }
}

function onOffline() {
  console.log("[sync] Offline, pausing sync.");
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}

async function sync() {
  if (isSyncing) return;
  if (!navigator.onLine) return;
  if (!localStorage.getItem("token")) return;

  isSyncing = true;
  try {
    await pushChanges();
    await pullFromServer();
  } catch (err) {
    console.error("[sync] Sync failed:", err.message);
  } finally {
    isSyncing = false;
  }
}

async function pushChanges() {
  const manifest = await getManifest();
  if (manifest.length === 0) return;

  console.log(`[sync] Pushing ${manifest.length} pending change(s)...`);

  for (const entry of manifest) {
    try {
      if (entry.entityType === "board") {
        await pushBoardChange(entry);
      } else if (entry.entityType === "task") {
        await pushTaskChange(entry);
      }
    } catch (err) {
      console.warn(`[sync] Failed to push ${entry.key}:`, err.message);
    }
  }
}

async function pushBoardChange(entry) {
  if (entry.changeType === "deleted") {
    await pushBoard({ id: entry.entityId }, "delete");
    await purgeTombstones([entry.key]);
  } else {
    const boards = await getAllLocalBoards();
    const board = boards.find(b => b.id === entry.entityId);
    if (!board) {
      await clearManifestEntry(entry.key);
      return;
    }
    const action = entry.changeType === "created" ? "create" : "update";
    await pushBoard(board, action);
    await clearManifestEntry(entry.key);
  }
}

async function pushTaskChange(entry) {
  if (entry.changeType === "deleted") {
    await pushTask({ id: entry.entityId }, "delete");
    await purgeTombstones([entry.key]);
  } else {
    const task = await getTask(entry.entityId);
    if (!task) {
      await clearManifestEntry(entry.key);
      return;
    }
    const action = entry.changeType === "created" ? "create" : "update";
    await pushTask(task, action);
    await clearManifestEntry(entry.key);
  }
}

async function pullFromServer({ skipRefresh = false } = {}) {
  const userId = getUserId();
  if (!userId) return;

  const [serverBoards, serverTasks] = await Promise.all([
    fetchBoards(),
    fetchTasks(),
  ]);

  const manifest = await getManifest();
  const pendingKeys = new Set(manifest.map(e => e.key));

  await mergeBoards(serverBoards, pendingKeys, userId);
  await mergeTasks(serverTasks, pendingKeys, userId);

  state.boards = await getBoards();

  if (!skipRefresh) {
    document.dispatchEvent(new CustomEvent("refresh-board"));
  }
  console.log("[sync] Pull complete.");
}

async function mergeBoards(serverBoards, pendingKeys, userId) {
  const localBoards = await getAllLocalBoards();
  const serverBoardIds = new Set(serverBoards.map(b => b.id));

  for (const serverBoard of serverBoards) {
    const key = `board:${serverBoard.id}`;
    if (pendingKeys.has(key)) continue;

    const local = localBoards.find(b => b.id === serverBoard.id);
    const serverUpdated = new Date(serverBoard.updatedAt).getTime();

    if (!local) {
      await putBoard({ ...serverBoard, userId });
    } else {
      const localUpdated = new Date(local.updatedAt).getTime();
      if (serverUpdated > localUpdated) {
        await putBoard({ ...serverBoard, userId });
      }
    }
  }

  for (const local of localBoards) {
    if (local.userId !== userId) continue;
    const key = `board:${local.id}`;
    if (!serverBoardIds.has(local.id) && !pendingKeys.has(key)) {
      await removeBoard(local.id);
    }
  }
}

async function mergeTasks(serverTasks, pendingKeys, userId) {
  const localBoards = await getAllLocalBoards();
  const localBoardIds = localBoards.filter(b => b.userId === userId).map(b => b.id);

  let localTasks = [];
  for (const boardId of localBoardIds) {
    const { loadTasks } = await import("../data/local/storage.js");
    const tasks = await loadTasks(boardId);
    localTasks = localTasks.concat(tasks.filter(t => t.userId === userId));
  }

  const serverTaskIds = new Set(serverTasks.map(t => t.id));

  for (const serverTask of serverTasks) {
    const key = `task:${serverTask.id}`;
    if (pendingKeys.has(key)) continue;

    const local = localTasks.find(t => t.id === serverTask.id);
    const serverUpdated = new Date(serverTask.updatedAt).getTime();

    if (!local) {
      await putTask({ ...serverTask, userId });
    } else {
      const localUpdated = new Date(local.updatedAt).getTime();
      if (serverUpdated > localUpdated) {
        await putTask({ ...serverTask, userId });
      }
    }
  }

  for (const local of localTasks) {
    const key = `task:${local.id}`;
    if (!serverTaskIds.has(local.id) && !pendingKeys.has(key)) {
      await removeTask(local.id);
    }
  }
}
