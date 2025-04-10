// Combined server for static files and Socket.IO
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

// Import the original server.js Socket.IO logic
const socketLogic = require("./js/server/server.js");

// Create Express app
const app = express();
const server = http.createServer(app);

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve static files from the current directory
app.use(
  express.static(".", {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store");
    },
  })
);

// Serve Socket.IO client files
app.use(
  "/socket.io",
  express.static(path.join(__dirname, "node_modules/socket.io/client-dist"))
);

// Handle SPA routing - all non-asset paths go to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Extract player name from query
  const playerName = socket.handshake.query.playerName || "Anonymous";
  console.log(`Player connected: ${socket.id} with name: ${playerName}`);

  // *** Copy Socket.IO logic from server.js here ***
  // We'll add the core logic below

  // Players and rooms tracking
  let players = {};
  let rooms = {};

  players[socket.id] = { name: playerName, currentRoomId: null };

  // Handle room creation
  socket.on("createRoom", () => {
    console.log(`${socket.id} is creating a room...`);
    // Generate a 5-character room code
    const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();

    // Initialize room data
    rooms[roomId] = {
      gameState: {
        // Initialize game state here
        roomId: roomId,
        gameStarted: false,
        currentPlayerIndex: 0,
        currentCard: null,
        players: [],
      },
      players: {},
      playerOrder: [],
    };

    // Join the room
    socket.join(roomId);
    players[socket.id].currentRoomId = roomId;

    // Add player to room
    rooms[roomId].players[socket.id] = {
      name: playerName,
      playerIndex: 0,
      pawns: [], // Will be initialized when game starts
    };
    rooms[roomId].playerOrder.push(socket.id);

    // Send room info back to client
    socket.emit("roomCreated", {
      roomId: roomId,
      gameState: rooms[roomId].gameState,
      players: Object.values(rooms[roomId].players).map((p) => ({
        name: p.name,
        playerIndex: p.playerIndex,
      })),
    });
  });

  // Handle joining room
  socket.on("joinRoom", (roomCode) => {
    console.log(`${socket.id} is joining room ${roomCode}...`);

    if (!rooms[roomCode]) {
      socket.emit("joinFailed", "Room does not exist");
      return;
    }

    // Check if room is full (4 players max)
    if (Object.keys(rooms[roomCode].players).length >= 4) {
      socket.emit("joinFailed", "Room is full");
      return;
    }

    // Join the room
    socket.join(roomCode);
    players[socket.id].currentRoomId = roomCode;

    // Assign next available player index
    const playerIndex = rooms[roomCode].playerOrder.length;

    // Add player to room
    rooms[roomCode].players[socket.id] = {
      name: playerName,
      playerIndex: playerIndex,
      pawns: [], // Will be initialized when game starts
    };
    rooms[roomCode].playerOrder.push(socket.id);

    // Send room info to client
    socket.emit("room_joined", {
      roomId: roomCode,
      yourPlayerIndex: playerIndex,
      initialGameState: rooms[roomCode].gameState,
      players: Object.values(rooms[roomCode].players).map((p) => ({
        name: p.name,
        playerIndex: p.playerIndex,
      })),
    });

    // Broadcast updated player list to all clients in room
    io.to(roomCode).emit("roomInfoUpdate", {
      roomId: roomCode,
      players: Object.values(rooms[roomCode].players).map((p) => ({
        name: p.name,
        playerIndex: p.playerIndex,
      })),
    });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);

    const player = players[socket.id];
    if (player && player.currentRoomId) {
      const roomId = player.currentRoomId;

      // Remove player from room
      if (rooms[roomId]) {
        delete rooms[roomId].players[socket.id];

        // Remove from player order
        const index = rooms[roomId].playerOrder.indexOf(socket.id);
        if (index !== -1) {
          rooms[roomId].playerOrder.splice(index, 1);
        }

        // Broadcast updated player list
        io.to(roomId).emit("roomInfoUpdate", {
          roomId: roomId,
          players: Object.values(rooms[roomId].players).map((p) => ({
            name: p.name,
            playerIndex: p.playerIndex,
          })),
        });

        // Delete room if empty
        if (Object.keys(rooms[roomId].players).length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted - no players left`);
        }
      }
    }

    // Remove player
    delete players[socket.id];
  });

  // Game action handlers would go here
  // socket.on("drawCard", ...)
  // socket.on("movePawn", ...)
  // etc.
});

// Start the server
const PORT = process.env.PORT || 8083;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Combined server running on http://0.0.0.0:${PORT}`);
});
