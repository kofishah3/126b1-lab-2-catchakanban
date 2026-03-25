const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

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

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
