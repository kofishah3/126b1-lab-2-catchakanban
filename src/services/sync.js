import { API_BASE } from "../config.js";
import { getDb } from "../data/local/database.js";
import {
  generateTaskId,
  loadTasks,
  putTask,
  removeTask,
  getTask,
  clearBoardTasks,
  getBoards as getAllBoards,
  putBoard,
  removeBoard,
} from "../data/local/storage.js";
import { recordChange, clearManifestEntry } from "../data/local/manifest.js";
import {
  pushTask,
  pushBoard,
  isServerReachable,
  markServerReachable,
} from "../data/remote/api.js";
import { showToast } from "../components/toast/toast.js";

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

let socket;

export function connectSocket(boardId) {
  const token = localStorage.getItem("token");
  if (!token || !window.io || !isServerReachable()) return;

  if (!socket) {
    socket = window.io(API_BASE, {
      auth: { token },
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
    });
    setupSocketListeners();
  }
  if (boardId) {
    socket.emit("joinBoard", boardId);
  }
}

async function setupSocketListeners() {
  socket.on("boardInvited", async () => {
    showToast("You were invited to a new board!", "info");
    await getBoards();
    document.dispatchEvent(new CustomEvent("refresh-boards-nav"));
  });

  socket.on("boardDeleted", async (data) => {
    const db = await getDb();
    const tx = db.transaction(["boards"], "readwrite");
    await removeBoard(data.boardId, tx);
    await tx.done;

    showToast("The owner deleted this board", "error");
    document.dispatchEvent(new CustomEvent("refresh-boards-nav"));
  });

  socket.on("taskCreated", async (data) => {
    await putTask(data.task);
    document.dispatchEvent(new CustomEvent("refresh-board"));
    showToast(`${data.sender} added a task: ${data.task.title}`, "info");
  });

  socket.on("taskUpdated", async (data) => {
    await putTask(data.task);
    document.dispatchEvent(new CustomEvent("refresh-board"));
    showToast(`${data.sender} updated task: ${data.task.title}`, "info");
  });

  socket.on("taskDeleted", async (data) => {
    await removeTask(data.taskId);
    document.dispatchEvent(new CustomEvent("refresh-board"));
    showToast(`${data.sender} deleted a task`, "info");
  });
}

export async function getTasks(boardId) {
  return await loadTasks(boardId);
}

async function pullTasksFromServer() {
  const token = localStorage.getItem("token");
  if (!token || !isServerReachable()) return;

  const res = await fetch(`${API_BASE}/tasks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.success) await saveServerTasksLocally(data.tasks);
}

async function saveServerTasksLocally(serverTasks) {
  const db = await getDb();
  const tx = db.transaction(["tasks"], "readwrite");
  for (const t of serverTasks) {
    tx.objectStore("tasks").put({
      id: t.id,
      boardId: t.board_id,
      userId: getUserId(),
      title: t.title,
      columnId: t.column_id,
      priority: t.priority,
      deadline: t.deadline,
      createdAt: t.created_at,
      updatedAt: t.updated_at || t.created_at,
    });
  }
  await tx.done;
}

export async function getTasksByColumn(boardId, columnId) {
  const db = await getDb();
  return await db.getAllFromIndex("tasks", "by-board-column", [
    boardId,
    columnId,
  ]);
}

export async function addTask(boardId, taskData) {
  const userId = getUserId();
  const now = new Date().toISOString();

  const newTask = {
    id: generateTaskId(),
    boardId,
    userId,
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

  if (socket) {
    socket.emit("taskCreated", { boardId, task: newTask });
  }

  syncTaskNow("create", newTask);

  showToast(`Added a task: ${newTask.title}`, "success");
  return newTask;
}

export async function updateTask(boardId, taskId, updates) {
  const existing = await getTask(taskId);

  if (!existing || existing.boardId !== boardId) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const updatedTask = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const db = await getDb();
  const tx = db.transaction(["tasks", "manifest"], "readwrite");

  await putTask(updatedTask, tx);
  await recordChange("task", taskId, "modified", tx);

  await tx.done;

  if (socket) {
    socket.emit("taskUpdated", { boardId, task: updatedTask });
  }

  syncTaskNow("update", updatedTask);

  return updatedTask;
}

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

  if (socket) {
    socket.emit("taskDeleted", { boardId, taskId });
  }

  syncTaskNow("delete", { id: taskId });

  showToast(`Deleted task`, "success");
}

async function syncTaskNow(action, task) {
  for (let i = 0; i < 3; i++) {
    markServerReachable();
    try {
      await pushTask(task, action);
      await clearManifestEntry(`task:${task.id}`);
      return;
    } catch {
      if (i < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  // All retries failed — manifest entry stays, networkSync retries next cycle
}

async function syncBoardNow(action, board) {
  for (let i = 0; i < 3; i++) {
    markServerReachable();
    try {
      await pushBoard(board, action);
      await clearManifestEntry(`board:${board.id}`);
      return;
    } catch {
      if (i < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export async function moveTask(boardId, taskId, newColumnId) {
  return updateTask(boardId, taskId, { columnId: newColumnId });
}

export async function clearAllBoardTasks(boardId) {
  const userId = getUserId();
  const tasks = await loadTasks(boardId);

  const db = await getDb();
  const tx = db.transaction(["tasks", "manifest"], "readwrite");

  for (const task of tasks) {
    if (task.userId === userId) {
      tx.objectStore("tasks").delete(task.id);
      await recordChange("task", task.id, "deleted", tx);
    }
  }

  await tx.done;
}

export async function getBoards() {
  try {
    await pullBoardsFromServer();
    await pullTasksFromServer();
    await pushLocalBoardsToServer();
  } catch {
    // Server unreachable — fall back to local data
  }

  const userId = getUserId();
  const allBoards = await getAllBoards();

  return allBoards.filter(
    (b) => b.userId === userId || (b.members && b.members.includes(userId)),
  );
}

async function pullBoardsFromServer() {
  const token = localStorage.getItem("token");
  if (!token || !isServerReachable()) return;

  const res = await fetch(`${API_BASE}/boards`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.success) await saveServerBoardsLocally(data.boards);
}

async function saveServerBoardsLocally(serverBoards) {
  const userId = getUserId();
  const db = await getDb();
  const tx = db.transaction(["boards"], "readwrite");
  for (const b of serverBoards) {
    const existing = await tx.objectStore("boards").get(b.id);
    const members = existing && existing.members ? existing.members : [];
    if (!members.includes(userId)) members.push(userId);

    tx.objectStore("boards").put({
      id: b.id,
      name: b.name,
      userId: b.user_id,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
      members: members,
    });
  }
  await tx.done;
}

async function pushLocalBoardsToServer() {
  const userId = getUserId();
  const token = localStorage.getItem("token");
  if (!token || !isServerReachable()) return;

  const localBoards = await getAllBoards();
  for (const b of localBoards) {
    if (b.userId === userId) {
      await fetch(`${API_BASE}/boards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: b.id, name: b.name }),
      });
    }
  }
}

export async function addBoard(name) {
  const userId = getUserId();
  const now = new Date().toISOString();

  const newBoard = {
    id: crypto.randomUUID
      ? `board-${crypto.randomUUID()}`
      : `board-${Date.now()}`,
    name,
    userId,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  const tx = db.transaction(["boards", "manifest"], "readwrite");

  await putBoard(newBoard, tx);
  await recordChange("board", newBoard.id, "created", tx);

  await tx.done;

  syncBoardNow("create", newBoard);

  return newBoard;
}

export async function deleteBoard(boardId) {
  const userId = getUserId();
  const board = (await getAllBoards()).find((b) => b.id === boardId);

  if (!board || board.userId !== userId) {
    throw new Error("Only the author can delete this board");
  }

  const tasks = await loadTasks(boardId);
  const db = await getDb();
  const tx = db.transaction(["boards", "tasks", "manifest"], "readwrite");

  for (const task of tasks) {
    if (task.userId === userId) {
      tx.objectStore("tasks").delete(task.id);
      await recordChange("task", task.id, "deleted", tx);
    }
  }

  await removeBoard(boardId, tx);
  await recordChange("board", boardId, "deleted", tx);

  await tx.done;

  syncBoardNow("delete", { id: boardId });
}
