const express = require("express");
const pool = require("../../db");
const authMiddleware = require("../../middleware/authMiddleware");
const { checkBoardAccess } = require("../utils/access");

const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
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

router.post("/", async (req, res) => {
  const { action = "create" } = req.body;

  try {
    if (action === "create" || action === "update") {
      const { id, name } = req.body;
      if (!id || !name)
        return res
          .status(400)
          .json({ success: false, message: "id and name are required" });

      await pool.query(
        "INSERT INTO boards (id, name, user_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP",
        [id, name, req.user.id],
      );
      return res.json({ success: true, message: "Board saved" });
    }

    if (action === "delete") {
      const { id } = req.body;
      if (!id)
        return res
          .status(400)
          .json({ success: false, message: "id is required" });

      const result = await pool.query(
        "DELETE FROM boards WHERE id = $1 AND user_id = $2",
        [id, req.user.id],
      );
      if (result.rowCount === 0)
        return res
          .status(403)
          .json({ success: false, message: "Unauthorized or not found" });

      const io = req.app.get("io");
      if (io) {
        io.to(id).emit("boardDeleted", { boardId: id });
      }

      return res.json({ success: true, message: "Board deleted" });
    }

    return res.status(400).json({ success: false, message: "invalid action" });
  } catch (err) {
    console.error("POST /boards error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/:id", async (req, res) => {
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

    const io = req.app.get("io");
    if (io) {
      io.to(id).emit("boardDeleted", { boardId: id });
    }

    res.json({ success: true, message: "Board deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/:boardId/members", async (req, res) => {
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

router.post("/:boardId/members", async (req, res) => {
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

    const io = req.app.get("io");
    if (io) {
      io.to(`user:${newUserId}`).emit("boardInvited", { boardId });
    }

    res.json({ success: true, message: "Member added" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
