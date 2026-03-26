const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const pool = require("./db");

const { PORT } = require("./backend/config");
const { globalLimiter } = require("./middleware/rateLimiter");

const authRoutes = require("./backend/routes/authRoutes");
const tasksRoutes = require("./backend/routes/tasksRoutes");
const boardsRoutes = require("./backend/routes/boardsRoutes");
const usersRoutes = require("./backend/routes/usersRoutes");
const miscRoutes = require("./backend/routes/miscRoutes");

const { initSocket } = require("./backend/sockets/tasksSocket");
const { initCron } = require("./backend/cron/tasksCron");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

async function runDbMigrations() {
  await pool.query(`
    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS column_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS priority VARCHAR(20),
      ADD COLUMN IF NOT EXISTS deadline TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
  `);

  await pool.query(`
    UPDATE tasks
    SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
    WHERE updated_at IS NULL;
  `);
}

app.set("io", io);

app.use(cors());
app.use(express.json());
app.use(globalLimiter);

app.get("/", (req, res) => {
  res.send("Server is running!");
});

app.use("/auth", authRoutes);
app.use("/tasks", tasksRoutes);
app.use("/boards", boardsRoutes);
app.use("/users", usersRoutes);
app.use("/", miscRoutes);

initSocket(io);
initCron();

async function startServer() {
  try {
    await runDbMigrations();
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to run DB migrations:", error);
    process.exit(1);
  }
}

startServer();
