const jwt = require("jsonwebtoken");
const { SECRET } = require("../config");
const { checkBoardAccess } = require("../utils/access");

/**
 * Initializes socket.io functionality.
 * @param {import('socket.io').Server} io
 */
function initSocket(io) {
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
}

module.exports = { initSocket };
