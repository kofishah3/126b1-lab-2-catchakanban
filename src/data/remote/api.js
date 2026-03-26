const API_BASE = "http://localhost:3000";

let serverReachable = true;

export function isServerReachable() {
  return serverReachable;
}

export function markServerReachable() {
  serverReachable = true;
}

const FIELD_MAP = {
  boardId: "board_id",
  columnId: "column_id",
  userId: "user_id",
  createdAt: "created_at",
  updatedAt: "updated_at",
  firstName: "first_name",
  lastName: "last_name",
};

const REVERSE_MAP = Object.fromEntries(
  Object.entries(FIELD_MAP).map(([k, v]) => [v, k]),
);

function toSnakeCase(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    out[FIELD_MAP[key] || key] = value;
  }
  return out;
}

function toCamelCase(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    out[REVERSE_MAP[key] || key] = value;
  }
  return out;
}

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}) {
  if (!serverReachable) {
    throw new TypeError("Server unreachable");
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: getAuthHeaders(),
    });
  } catch (err) {
    if (err instanceof TypeError) {
      serverReachable = false;
    }
    throw err;
  }

  serverReachable = true;

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem("token");
    window.location.href = "/login.html";
    throw new Error("Authentication expired");
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || `Request failed: ${res.status}`);
  }

  return data;
}

export async function fetchBoards() {
  const data = await request("/boards");
  return data.boards.map(toCamelCase);
}

export async function pushBoard(board, action) {
  const body = { action, ...toSnakeCase(board) };
  return request("/boards", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchTasks() {
  const data = await request("/tasks");
  return data.tasks.map(toCamelCase);
}

export async function pushTask(task, action) {
  const body = { action, ...toSnakeCase(task) };
  return request("/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
