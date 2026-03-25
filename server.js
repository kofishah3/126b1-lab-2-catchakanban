/*----- COMMENTING THIS BLOCK JUST IN CASE -----
import express from "express";
import {
    getBoards, addBoard, deleteBoard,
    getTasks, addTask, updateTask, deleteTask, moveTask
} from "./src/services/sync.js";


const app = express();
app.use(express.json());
app.use(express.static("."));


app.get("/api/boards", async (req, res) => {
    res.json(await getBoards());
});

app.post("/api/boards", async (req, res) => {
    const board = await addBoard(req.body.name);
    res.status(201).json(board);
});

app.delete("/api/boards/:boardId", async (req, res) => {
    await deleteBoard(req.params.boardId);
    res.status(204).send();
});


app.get("/api.boards.:boardId/tasks", async (req, res))
*/

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cron = require("node-cron");
const pool = require("./db");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();
const PORT = 3000;
const SECRET = "SECRET_KEY";

app.use(cors());
app.use(express.json());

// AUTH ROUTER-------------
const authRouter = express.Router();

authRouter.post("/register", async (req, res) => {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password)
        return res.status(400).json({ success: false, message: "Email and Password are required"});

    try {
        const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (existing.rows.length > 0)
            return res.status(400).json({ success: false, message: "An account with this email already exists." });

        const hashed = await bcrypt.hash(password, 10);
        await pool.query(
            `INSERT INTO users (email, password, first_name, last_name) VALUES ($1, $2, $3, $4)`,
            [email, hashed, firstName, lastName]
        );
        res.json({ success: true, message: "Account created successfully" });
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ success: false, message: "Server error. Please try again" });
    }
});

authRouter.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ success: false, message: "Email and password are required"});

    try {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        const user = result.rows[0];
        if (!user)
            return res.status(401).json({ success: false, message: "Invalid email or password" });

        const match = await bcrypt.compare(password, user.password);
        if (!match)
            return res.status(401).json({ success: false, message: "Invalid email or password" });

        const token = jwt.sign({ id: user.id, email: user.email}, SECRET, { expiresIn: "1h" });
        res.json({ success: true, token });
    } catch (err) {
        console.error("Login error", err);
        res.status(500).json({ success: false, message: "Server error. Please try again"})
    }
});

app.use("/auth", authRouter);


// TASKS ROUTER------------
const tasksRouter = express.Router();
tasksRouter.use(authMiddleware);

tasksRouter.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, description, status, created_at
            FROM tasks
            WHERE user_id = $1 AND is_deleted = FALSE
            ORDER BY created_at ASC`,
            [req.user.id]
        );
        res.json({ success: true, tasks: result.rows});
    } catch (err) {
        console.error("GET /tasks error", err);
        res.status(500).json({ success: false, message: "Server error"});
    }
});

tasksRouter.post("/", async (req, res) => {
    const { action } = req.body;

    if(!action)
        return res.status(400).json({ success: false, message: "action is required (create | update | delete)" });

    try {
        if (action === "create") {
            const { title, description, status } = req.body;
            if (!title)
                return res.status(400).json({ success: false, message: "title is required" });

            const result = await pool.query(
                `INSERT INTO tasks (title, description, status, user_id)
                VALUES ($1, $2, $3, $4)
                RETURNING id, title, description, status, created_at`,
                [title, description || null, status || "To Do", req.user.id]
            );
            return res.status(201).json({ success: true, task: result.rows[0] });
        }

        if (action === "update") {
            const { id, title, description, status } = req.body;
            if (!id)
                return res.status(400).json({ success: false, message: "id is required for update"});

            const check = await pool.query(
                "SELECT id FROM tasks WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE",
                [id, req.user.id]
            );
            if (check.rows.length === 0)
                return res.status(404).json({ success: false, message: "Task not found" });

            const result = await pool.query(
                `UPDATE tasks
                SET title = COALESCE($1, title),
                    description = COALESCE($2, description),
                    status = COALESCE($3, status)
                WHERE id = $4 AND user_id = $5
                RETURNING id, title, description, status, created_at`,
                [title, description, status, id, req.user.id]
            );
            return res.json({ success: true, task: result.rows[0] });
        }

        if (action === "delete") {
            const { id } = req.body;
            if (!id)
                return res.status(400).json({ success: false, message: "id is required for delete" });

            const check = await pool.query(
                "SELECT id FROM tasks WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE",
                [id, req.user.id]
            );
            if (check.rows.length === 0)
                return res.status(404).json({ success: false, message: "Task not found" });

            await pool.query(
                "UPDATE tasks SET is_deleted = TRUE WHERE id = $1 AND user_id = $2",
                [id, req.user.id]
            );
            return res.json({ success: true, message: "Task deleted" });
        }

        return res.status(400).json({ success: false, message: "Invalid action. Use: create | update | delete" });
    
    } catch (err) {
        console.error("POST /tasks error:", err);
        res.status(500).json({ success: false, message: "Server error"});
    }
});

app.use("/tasks", tasksRouter);

app.get("/dashboard", authMiddleware, (req, res) => {
    res.json({ message: "Welcome to dashboard", user: req.user });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

cron.schedule("0 0 * * *", async () => {
    console.log("CRON JOB: Cleaning soft-deleted tasks");
    try {
        await pool.query("DELETE FROM tasks WHERE is_deleted = TRUE");
    } catch (err) {
        console.error("CRON JOB ERROR:", err);
    }
});

cron.schedule("0 0 * * *", async () => {
    console.log("CRON JOB: Archiving old tasks");
    try {
        await pool.query(
            `UPDATE tasks SET status = 'Archived'
            WHERE status = 'Done'
            AND created_at < NOW() - INTERVAL '30 days'
            AND is_deleted = FALSE`
        );
    } catch (err) {
        console.error("CRON JOB ERROR:", err);
    }
});