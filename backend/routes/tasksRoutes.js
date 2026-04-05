const express = require("express");
const pool = require("../../db");
const authMiddleware = require("../../middleware/authMiddleware");
const { taskLimiter } = require("../../middleware/rateLimiter");
const { checkBoardAccess } = require("../utils/access");

const router = express.Router();
router.use(authMiddleware);
router.use(taskLimiter);

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.board_id, t.title, t.column_id, t.priority, t.deadline, t.created_at, t.updated_at
       FROM tasks t
       JOIN boards b ON t.board_id = b.id
       LEFT JOIN board_members bm ON b.id = bm.board_id
       WHERE (b.user_id = $1 OR bm.user_id = $1)
       AND t.is_deleted = FALSE
       AND t.column_id != 'archived'
       ORDER BY t.created_at ASC`,
      [req.user.id],
    );

    res.json({ success: true, tasks: result.rows });
  } catch (err) {
    console.error("GET /tasks error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/", async (req, res) => {
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
       is_deleted = FALSE,
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

  const taskRes = await pool.query(
    "SELECT board_id FROM tasks WHERE id = $1 AND is_deleted = FALSE",
    [id],
  );
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

  const taskRes = await pool.query(
    "SELECT board_id FROM tasks WHERE id = $1 AND is_deleted = FALSE",
    [id],
  );
  if (taskRes.rows.length === 0)
    return res.status(404).json({ success: false, message: "Task not found" });

  const hasAccess = await checkBoardAccess(
    taskRes.rows[0].board_id,
    req.user.id,
  );
  if (!hasAccess)
    return res.status(403).json({ success: false, message: "Unauthorized" });

  await pool.query("UPDATE tasks SET is_deleted = TRUE WHERE id = $1", [id]);
  return res.json({ success: true, message: "Task deleted" });
}

module.exports = router;
