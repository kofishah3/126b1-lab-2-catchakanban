const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cron = require("node-cron");
const pool = require("./db");
const authMiddleware = require("./middleware/authMiddleware");
const {
  globalLimiter,
  authLimiter,
  taskLimiter,
} = require("./middleware/rateLimiter");

const app = express();
const PORT = 3000;
const SECRET = "SECRET_KEY";

app.use(cors());
app.use(express.json());
app.use(globalLimiter);

app.get("/", (req, res) => {
  res.send("Server is running!");
});

const authRouter = express.Router();

authRouter.post("/register", authLimiter, async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  if (!email || !password)
    return res
      .status(400)
      .json({ success: false, message: "Email and Password are required" });

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rows.length > 0)
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });

    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (email, password, first_name, last_name) VALUES ($1, $2, $3, $4)`,
      [email, hashed, firstName, lastName],
    );
    res.json({ success: true, message: "Account created successfully" });
  } catch (err) {
    console.error("Register error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error. Please try again" });
  }
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res
      .status(400)
      .json({ success: false, message: "Email and password are required" });

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1",
      [email],
    );
    const user = result.rows[0];
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });

    const token = jwt.sign({ id: user.id, email: user.email }, SECRET, {
      expiresIn: "1h",
    });
    res.json({ success: true, token });
  } catch (err) {
    console.error("Login error", err);
    res
      .status(500)
      .json({ success: false, message: "Server error. Please try again" });
  }
});

app.use("/auth", authRouter);

const tasksRouter = express.Router();
tasksRouter.use(authMiddleware);
tasksRouter.use(taskLimiter);

tasksRouter.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.title, t.column_id, t.priority, t.deadline, t.created_at
       FROM tasks t
       JOIN boards b ON t.board_id = b.id
       WHERE b.user_id = $1
       ORDER BY t.created_at ASC`,
      [req.user.id],
    );

    res.json({ success: true, tasks: result.rows });
  } catch (err) {
    console.error("GET /tasks error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

async function handleCreateTask(req, res) {
  const { id, title, board_id, column_id, priority, deadline } = req.body;
  if (!title || !board_id)
    return res
      .status(400)
      .json({ success: false, message: "title and board_id are required" });

  const boardCheck = await pool.query(
    "SELECT id FROM boards WHERE id = $1 AND user_id = $2",
    [board_id, req.user.id],
  );
  if (boardCheck.rows.length === 0)
    return res
      .status(403)
      .json({ success: false, message: "Unauthorized board" });

  const result = await pool.query(
    `INSERT INTO tasks (id, board_id, title, column_id, priority, deadline) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      id,
      board_id,
      title,
      column_id || "todo",
      priority || null,
      deadline || null,
    ],
  );
  return res.status(201).json({ success: true, task: result.rows[0] });
}

async function handleUpdateTask(req, res) {
  const { id, title, column_id, priority, deadline } = req.body;
  if (!id)
    return res.status(400).json({ success: false, message: "id is required" });

  const check = await pool.query(
    `SELECT t.id FROM tasks t JOIN boards b ON t.board_id = b.id WHERE t.id = $1 AND b.user_id = $2`,
    [id, req.user.id],
  );
  if (check.rows.length === 0)
    return res.status(404).json({ success: false, message: "Task not found" });

  const result = await pool.query(
    `UPDATE tasks SET title = COALESCE($1, title), column_id = COALESCE($2, column_id), priority = COALESCE($3, priority), deadline = COALESCE($4, deadline), updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *`,
    [title, column_id, priority, deadline, id],
  );
  return res.json({ success: true, task: result.rows[0] });
}

async function handleDeleteTask(req, res) {
  const { id } = req.body;
  if (!id)
    return res.status(400).json({ success: false, message: "id is required" });

  const check = await pool.query(
    `SELECT t.id FROM tasks t JOIN boards b ON t.board_id = b.id WHERE t.id = $1 AND b.user_id = $2`,
    [id, req.user.id],
  );
  if (check.rows.length === 0)
    return res.status(404).json({ success: false, message: "Task not found" });

  await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
  return res.json({ success: true, message: "Task deleted" });
}

tasksRouter.post("/", async (req, res) => {
  const { action } = req.body;
  if (!action)
    return res
      .status(400)
      .json({ success: false, message: "action is required" });

  try {
    if (action === "create") return await handleCreateTask(req, res);
    if (action === "update") return await handleUpdateTask(req, res);
    if (action === "delete") return await handleDeleteTask(req, res);
    return res.status(400).json({ success: false, message: "invalid action" });
  } catch (err) {
    console.error("POST /tasks error:", err);
    res.status(500).json({ success: false, message: "server error" });
  }
});

app.use("/tasks", tasksRouter);

const boardsRouter = express.Router();
boardsRouter.use(authMiddleware);
boardsRouter.use(taskLimiter);

boardsRouter.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, user_id, created_at, updated_at
       FROM boards
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [req.user.id],
    );
    res.json({ success: true, boards: result.rows });
  } catch (err) {
    console.error("GET /boards error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

async function handleCreateBoard(req, res) {
  const { id, name } = req.body;
  if (!id || !name)
    return res
      .status(400)
      .json({ success: false, message: "id and name are required" });

  const result = await pool.query(
    `INSERT INTO boards (id, name, user_id) VALUES ($1, $2, $3) RETURNING *`,
    [id, name, req.user.id],
  );
  return res.status(201).json({ success: true, board: result.rows[0] });
}

async function handleUpdateBoard(req, res) {
  const { id, name } = req.body;
  if (!id)
    return res.status(400).json({ success: false, message: "id is required" });

  const check = await pool.query(
    "SELECT id FROM boards WHERE id = $1 AND user_id = $2",
    [id, req.user.id],
  );
  if (check.rows.length === 0)
    return res.status(404).json({ success: false, message: "Board not found" });

  const result = await pool.query(
    `UPDATE boards SET name = COALESCE($1, name), updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *`,
    [name, id, req.user.id],
  );
  return res.json({ success: true, board: result.rows[0] });
}

async function handleDeleteBoard(req, res) {
  const { id } = req.body;
  if (!id)
    return res.status(400).json({ success: false, message: "id is required" });

  const check = await pool.query(
    "SELECT id FROM boards WHERE id = $1 AND user_id = $2",
    [id, req.user.id],
  );
  if (check.rows.length === 0)
    return res.status(404).json({ success: false, message: "Board not found" });

  await pool.query("DELETE FROM boards WHERE id = $1", [id]);
  return res.json({ success: true, message: "Board deleted" });
}

boardsRouter.post("/", async (req, res) => {
  const { action } = req.body;
  if (!action)
    return res
      .status(400)
      .json({ success: false, message: "action is required" });

  try {
    if (action === "create") return await handleCreateBoard(req, res);
    if (action === "update") return await handleUpdateBoard(req, res);
    if (action === "delete") return await handleDeleteBoard(req, res);
    return res.status(400).json({ success: false, message: "invalid action" });
  } catch (err) {
    console.error("POST /boards error:", err);
    res.status(500).json({ success: false, message: "server error" });
  }
});

app.use("/boards", boardsRouter);

app.get("/dashboard", authMiddleware, (req, res) => {
  res.json({ message: "Welcome to dashboard", user: req.user });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
