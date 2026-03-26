const express = require("express");
const pool = require("../../db");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, first_name, last_name FROM users",
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
