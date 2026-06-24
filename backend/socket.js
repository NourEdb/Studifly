const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');

let io;

function init(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  // Authenticate every incoming socket using the JWT stored by the client
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Missing token'));
    try {
      const payload  = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId   = payload.id;
      socket.username = payload.username;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    // Each user lives in their own room so we can target them by userId
    socket.join(`user:${socket.userId}`);
    console.log(`[socket] user ${socket.userId} (${socket.username}) connected — ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[socket] user ${socket.userId} disconnected — ${socket.id}`);
    });
  });

  console.log('[socket] Socket.io initialized');
  return io;
}

function getIO() {
  return io;
}

module.exports = { init, getIO };
