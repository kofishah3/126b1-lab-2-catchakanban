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

export async function getTasks(boardId) {
  return await loadTasks(boardId);
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
  await pullBoardsFromServer();
  await pushLocalBoardsToServer();

  const userId = getUserId();
  const allBoards = await getAllBoards();

  return allBoards.filter(
    (b) => b.userId === userId || (b.members && b.members.includes(userId)),
  );
}

async function pullBoardsFromServer() {
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    const res = await fetch("http://localhost:3000/boards", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) await saveServerBoardsLocally(data.boards);
  } catch (err) {
    console.error("Failed to pull boards", err);
  }
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
  if (!token) return;

  const localBoards = await getAllBoards();
  for (const b of localBoards) {
    if (b.userId === userId) {
      fetch("http://localhost:3000/boards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: b.id, name: b.name }),
      }).catch(() => {});
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

  const token = localStorage.getItem("token");
  if (token) {
    try {
      await fetch("http://localhost:3000/boards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: newBoard.id, name: newBoard.name }),
      });
    } catch (err) {
      console.error("Failed to sync board creation", err);
    }
  }

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
  deleteBoardFromServer(boardId);
}

function deleteBoardFromServer(boardId) {
  const token = localStorage.getItem("token");
  if (token) {
    fetch(`http://localhost:3000/boards/${boardId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch((err) => console.error(err));
  }
}
