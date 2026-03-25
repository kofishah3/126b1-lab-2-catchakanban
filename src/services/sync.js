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
import { recordChange } from "../data/local/manifest.js";

// ================= USER HELPER =================
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

// ===== TASK SYNC OPERATIONS =====

export async function getTasks(boardId) {
  const userId = getUserId();
  const tasks = await loadTasks(boardId);

  return tasks.filter(t => t.userId === userId);
}

export async function getTasksByColumn(boardId, columnId) {
  const userId = getUserId();
  const db = await getDb();

  const tasks = await db.getAllFromIndex("tasks", "by-board-column", [boardId, columnId]);

  return tasks.filter(t => t.userId === userId);
}

export async function addTask(boardId, taskData) {
  const userId = getUserId();
  const now = new Date().toISOString();

  const newTask = {
    id: generateTaskId(),
    boardId,
    userId, // ✅ NEW
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

export async function updateTask(boardId, taskId, updates) {
  const userId = getUserId();
  const existing = await getTask(taskId);

  if (!existing || existing.boardId !== boardId || existing.userId !== userId) {
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
  return updatedTask;
}

export async function deleteTask(boardId, taskId) {
  const userId = getUserId();
  const existing = await getTask(taskId);

  if (!existing || existing.boardId !== boardId || existing.userId !== userId) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const db = await getDb();
  const tx = db.transaction(["tasks", "manifest"], "readwrite");

  await removeTask(taskId, tx);
  await recordChange("task", taskId, "deleted", tx);

  await tx.done;
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

// ===== BOARD SYNC OPERATIONS =====

export async function getBoards() {
  const userId = getUserId();
  const boards = await getAllBoards();

  return boards.filter(b => b.userId === userId);
}

export async function addBoard(name) {
  const userId = getUserId();
  const now = new Date().toISOString();

  const newBoard = {
    id: crypto.randomUUID ? `board-${crypto.randomUUID()}` : `board-${Date.now()}`,
    name,
    userId, // ✅ NEW
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

export async function deleteBoard(boardId) {
  const userId = getUserId();
  const tasks = await loadTasks(boardId);

  const db = await getDb();
  const tx = db.transaction(["boards", "tasks", "manifest"], "readwrite");

  for (const task of tasks) {
    if (task.userId === userId) {
      tx.objectStore("tasks").delete(task.id);
      await recordChange("task", task.id, "deleted", tx);
    }
  }

  const board = (await getAllBoards()).find(b => b.id === boardId);
  if (!board || board.userId !== userId) {
    throw new Error("Unauthorized board deletion");
  }

  await removeBoard(boardId, tx);
  await recordChange("board", boardId, "deleted", tx);

  await tx.done;
}