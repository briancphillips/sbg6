// Minimal combined server with no imports from other files
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

// Create Express app
const app = express();
const server = http.createServer(app);

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Basic logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Serve static files
app.use(express.static("."));

// Default route - simple string pattern
app.use(function (req, res) {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Global state
const players = {}; // { socketId: { name: '', currentRoomId: '...' } }
const rooms = {}; // { roomId: { gameState: {...}, players: {...} } }

// Socket connection
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Extract player name from query
  const playerName = socket.handshake.query.playerName || "Anonymous";
  console.log(`Player connected: ${socket.id} with name: ${playerName}`);

  // Store player info
  players[socket.id] = { name: playerName, currentRoomId: null };

  // Simple room creation
  socket.on("createRoom", () => {
    console.log(`${socket.id} is creating a room...`);

    // Generate a room code
    const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();

    // Create room
    rooms[roomId] = {
      gameState: {
        roomId: roomId,
        gameStarted: false,
        currentPlayerIndex: 0,
        currentCard: null,
        players: [],
      },
      players: {},
    };

    // Add player to room
    socket.join(roomId);
    players[socket.id].currentRoomId = roomId;
    rooms[roomId].players[socket.id] = {
      name: playerName,
      playerIndex: 0,
    };

    // Emit room created event
    socket.emit("roomCreated", {
      roomId: roomId,
      gameState: rooms[roomId].gameState,
      players: [{ name: playerName, playerIndex: 0 }],
    });
  });

  // Room joining
  socket.on("joinRoom", (roomCode) => {
    console.log(`${socket.id} is joining room ${roomCode}...`);

    if (!rooms[roomCode]) {
      socket.emit("joinFailed", "Room does not exist");
      return;
    }

    // Check if room is full
    const playerCount = Object.keys(rooms[roomCode].players).length;
    if (playerCount >= 4) {
      socket.emit("joinFailed", "Room is full");
      return;
    }

    // Add player to room
    socket.join(roomCode);
    players[socket.id].currentRoomId = roomCode;

    const playerIndex = playerCount;
    rooms[roomCode].players[socket.id] = {
      name: playerName,
      playerIndex: playerIndex,
    };

    // Emit join success
    socket.emit("room_joined", {
      roomId: roomCode,
      yourPlayerIndex: playerIndex,
      initialGameState: rooms[roomCode].gameState,
      players: Object.values(rooms[roomCode].players).map((p) => ({
        name: p.name,
        playerIndex: p.playerIndex,
      })),
    });

    // Update all clients in room
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

    // Clean up room if player was in one
    const player = players[socket.id];
    if (player && player.currentRoomId) {
      const roomId = player.currentRoomId;
      if (rooms[roomId]) {
        delete rooms[roomId].players[socket.id];

        // Delete empty room
        if (Object.keys(rooms[roomId].players).length === 0) {
          delete rooms[roomId];
        } else {
          // Update remaining players
          io.to(roomId).emit("roomInfoUpdate", {
            roomId: roomId,
            players: Object.values(rooms[roomId].players).map((p) => ({
              name: p.name,
              playerIndex: p.playerIndex,
            })),
          });
        }
      }
    }

    // Remove player
    delete players[socket.id];
  });
});

// Start server
const PORT = process.env.PORT || 8083;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Minimal server running on http://0.0.0.0:${PORT}`);
});
