const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../../db");
const { SECRET } = require("../config");
const { authLimiter } = require("../../middleware/rateLimiter");

const router = express.Router();

router.post("/register", authLimiter, async (req, res) => {
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

router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res
      .status(400)
      .json({ success: false, message: "Email and password are required" });

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
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

module.exports = router;
