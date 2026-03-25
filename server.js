const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
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
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

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

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      SECRET,
      { expiresIn: "1h" },
    );
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
      `SELECT t.id, t.board_id, t.title, t.column_id, t.priority, t.deadline, t.created_at, t.updated_at
       FROM tasks t
       JOIN boards b ON t.board_id = b.id
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE b.user_id = $1 OR bm.user_id = $1
       ORDER BY t.created_at ASC`,
      [req.user.id],
    );

    res.json({ success: true, tasks: result.rows });
  } catch (err) {
    console.error("GET /tasks error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

async function checkBoardAccess(boardId, userId) {
  const check = await pool.query(
    `SELECT id FROM boards WHERE id = $1 AND user_id = $2
     UNION
     SELECT board_id FROM board_members WHERE board_id = $1 AND user_id = $2`,
    [boardId, userId],
  );
  return check.rows.length > 0;
}

async function handleCreateTask(req, res) {
  const { id, title, board_id, column_id, priority, deadline } = req.body;
  if (!title || !board_id)
    return res
      .status(400)
      .json({ success: false, message: "title and board_id are required" });

  const hasAccess = await checkBoardAccess(board_id, req.user.id);
  if (!hasAccess)
    return res
      .status(403)
      .json({ success: false, message: "Unauthorized board" });

  const result = await pool.query(
    `INSERT INTO tasks (id, board_id, title, column_id, priority, deadline)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       column_id = EXCLUDED.column_id,
       priority = EXCLUDED.priority,
       deadline = EXCLUDED.deadline,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
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

  const taskRes = await pool.query("SELECT board_id FROM tasks WHERE id = $1", [
    id,
  ]);
  if (taskRes.rows.length === 0)
    return res.status(404).json({ success: false, message: "Task not found" });

  const hasAccess = await checkBoardAccess(
    taskRes.rows[0].board_id,
    req.user.id,
  );
  if (!hasAccess)
    return res.status(403).json({ success: false, message: "Unauthorized" });

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

  const taskRes = await pool.query("SELECT board_id FROM tasks WHERE id = $1", [
    id,
  ]);
  if (taskRes.rows.length === 0)
    return res.status(404).json({ success: false, message: "Task not found" });

  const hasAccess = await checkBoardAccess(
    taskRes.rows[0].board_id,
    req.user.id,
  );
  if (!hasAccess)
    return res.status(403).json({ success: false, message: "Unauthorized" });

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

app.get("/boards", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.* FROM boards b
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE b.user_id = $1 OR bm.user_id = $1`,
      [req.user.id],
    );
    res.json({ success: true, boards: result.rows });
  } catch (err) {
    console.error("GET /boards error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/boards", authMiddleware, async (req, res) => {
  const { id, name } = req.body;
  if (!id || !name)
    return res
      .status(400)
      .json({ success: false, message: "id and name are required" });

  try {
    await pool.query(
      "INSERT INTO boards (id, name, user_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP",
      [id, name, req.user.id],
    );
    res.json({ success: true, message: "Board saved" });
  } catch (err) {
    console.error("POST /boards error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/boards/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM boards WHERE id = $1 AND user_id = $2",
      [id, req.user.id],
    );
    if (result.rowCount === 0)
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized or not found" });

    if (io) {
      io.to(id).emit("boardDeleted", { boardId: id });
    }

    res.json({ success: true, message: "Board deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.use("/tasks", tasksRouter);

app.get("/users", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, first_name, last_name FROM users",
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/boards/:boardId/members", authMiddleware, async (req, res) => {
  try {
    const { boardId } = req.params;
    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, false as is_owner
       FROM users u
       JOIN board_members bm ON u.id = bm.user_id
       WHERE bm.board_id = $1
       UNION
       SELECT u.id, u.email, u.first_name, u.last_name, true as is_owner
       FROM users u
       JOIN boards b ON u.id = b.user_id
       WHERE b.id = $1`,
      [boardId],
    );
    res.json({ success: true, members: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/boards/:boardId/members", authMiddleware, async (req, res) => {
  const { email } = req.body;
  const { boardId } = req.params;
  try {
    const user = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (user.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const newUserId = user.rows[0].id;
    const authorRes = await pool.query(
      "SELECT user_id FROM boards WHERE id = $1",
      [boardId],
    );
    if (authorRes.rows.length > 0 && authorRes.rows[0].user_id === newUserId) {
      return res
        .status(400)
        .json({ success: false, message: "Author cannot be added as member" });
    }

    const hasAccess = await checkBoardAccess(boardId, req.user.id);
    if (!hasAccess)
      return res.status(403).json({ success: false, message: "Unauthorized" });

    await pool.query(
      "INSERT INTO board_members (board_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [boardId, newUserId],
    );

    if (io) {
      io.to(`user:${newUserId}`).emit("boardInvited", { boardId });
    }

    res.json({ success: true, message: "Member added" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/dashboard", authMiddleware, (req, res) => {
  res.json({ message: "Welcome to dashboard", user: req.user });
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error"));
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return next(new Error("Authentication error"));
    socket.user = decoded;
    next();
  });
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.user.id}`);

  socket.on("joinBoard", async (boardId) => {
    const hasAccess = await checkBoardAccess(boardId, socket.user.id);
    if (hasAccess) {
      socket.join(boardId);
    }
  });

  const forwardEvent = (eventName) => {
    socket.on(eventName, (data) => {
      socket.to(data.boardId).emit(eventName, {
        ...data,
        sender: `${socket.user.firstName} ${socket.user.lastName}`,
      });
    });
  };

  ["taskCreated", "taskUpdated", "taskDeleted"].forEach(forwardEvent);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
