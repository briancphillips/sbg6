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

    // Initialize player objects for the game state
    const initialPlayers = [
      {
        type: "human",
        details: { name: playerName },
        pawns: Array(4)
          .fill()
          .map((_, i) => ({
            id: i,
            playerIndex: 0,
            positionType: "start",
            positionIndex: -1,
          })),
      },
      {
        type: "empty",
        details: { name: "Waiting..." },
        pawns: Array(4)
          .fill()
          .map((_, i) => ({
            id: i,
            playerIndex: 1,
            positionType: "start",
            positionIndex: -1,
          })),
      },
      {
        type: "empty",
        details: { name: "Waiting..." },
        pawns: Array(4)
          .fill()
          .map((_, i) => ({
            id: i,
            playerIndex: 2,
            positionType: "start",
            positionIndex: -1,
          })),
      },
      {
        type: "empty",
        details: { name: "Waiting..." },
        pawns: Array(4)
          .fill()
          .map((_, i) => ({
            id: i,
            playerIndex: 3,
            positionType: "start",
            positionIndex: -1,
          })),
      },
    ];

    // Create room with properly structured game state
    rooms[roomId] = {
      gameState: {
        roomId: roomId,
        gameStarted: false,
        currentPlayerIndex: 0,
        currentCard: null,
        players: initialPlayers,
        selectablePawns: [],
        validMoves: [],
        targetableOpponents: [],
        message: `${playerName}'s room. Waiting for players...`,
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

    // Update game state with the new player
    if (rooms[roomCode].gameState.players[playerIndex]) {
      rooms[roomCode].gameState.players[playerIndex].type = "human";
      rooms[roomCode].gameState.players[playerIndex].details.name = playerName;
    }

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

    // Send updated game state to all clients
    io.to(roomCode).emit("gameStateUpdate", rooms[roomCode].gameState);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);

    // Clean up room if player was in one
    const player = players[socket.id];
    if (player && player.currentRoomId) {
      const roomId = player.currentRoomId;
      if (rooms[roomId]) {
        const playerIndex = rooms[roomId].players[socket.id]?.playerIndex;

        // Remove player from room's players tracking
        delete rooms[roomId].players[socket.id];

        // Update the game state to show player as disconnected
        if (
          typeof playerIndex === "number" &&
          rooms[roomId].gameState.players[playerIndex]
        ) {
          // Mark player as disconnected in game state
          rooms[roomId].gameState.players[playerIndex].type = "disconnected";
          rooms[roomId].gameState.players[playerIndex].details.name +=
            " (Disconnected)";
        }

        // Delete empty room
        if (Object.keys(rooms[roomId].players).length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted - no players left`);
        } else {
          // Update remaining players
          io.to(roomId).emit("roomInfoUpdate", {
            roomId: roomId,
            players: Object.values(rooms[roomId].players).map((p) => ({
              name: p.name,
              playerIndex: p.playerIndex,
            })),
          });

          // Send updated game state to all clients
          if (rooms[roomId]) {
            io.to(roomId).emit("gameStateUpdate", rooms[roomId].gameState);
          }
        }
      }
    }

    // Remove player
    delete players[socket.id];
  });

  // Add more event handlers for game actions

  // Start game
  socket.on("startGame", () => {
    const roomId = players[socket.id]?.currentRoomId;
    if (!roomId || !rooms[roomId]) return;

    console.log(`Starting game in room ${roomId}`);

    // Update game state
    rooms[roomId].gameState.gameStarted = true;
    rooms[roomId].gameState.message =
      "Game started! Waiting for first player to draw a card.";

    // Send updated game state to all clients
    io.to(roomId).emit("gameStateUpdate", rooms[roomId].gameState);
    io.to(roomId).emit("game_started", rooms[roomId].gameState);

    // Notify first player it's their turn
    const firstPlayerId = Object.keys(rooms[roomId].players).find(
      (id) => rooms[roomId].players[id].playerIndex === 0
    );
    if (firstPlayerId) {
      io.to(firstPlayerId).emit("yourTurn", {
        currentPlayerIndex: 0,
      });
    }
  });

  // Draw card
  socket.on("drawCard", () => {
    const roomId = players[socket.id]?.currentRoomId;
    if (!roomId || !rooms[roomId]) return;

    const playerIndex = rooms[roomId].players[socket.id]?.playerIndex;
    if (playerIndex !== rooms[roomId].gameState.currentPlayerIndex) {
      console.log(`Player ${socket.id} tried to draw a card out of turn`);
      return;
    }

    // Generate a random card (1-12, with "Sorry" card = 13)
    const cards = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, "Sorry"];
    const card = cards[Math.floor(Math.random() * cards.length)];

    console.log(`Player ${socket.id} drew card: ${card}`);

    // Update game state
    rooms[roomId].gameState.currentCard = card;
    rooms[roomId].gameState.message = `Player ${playerIndex + 1} drew ${card}`;

    // For simplicity in this minimal version, just move to the next player
    // In a real implementation, you'd handle the card actions
    setTimeout(() => {
      // Move to next player
      const nextPlayerIndex = (playerIndex + 1) % 4;
      rooms[roomId].gameState.currentPlayerIndex = nextPlayerIndex;
      rooms[roomId].gameState.currentCard = null;
      rooms[roomId].gameState.message = `Player ${
        nextPlayerIndex + 1
      }'s turn to draw`;

      // Send updated game state
      io.to(roomId).emit("gameStateUpdate", rooms[roomId].gameState);

      // Notify next player it's their turn
      const nextPlayerId = Object.keys(rooms[roomId].players).find(
        (id) => rooms[roomId].players[id].playerIndex === nextPlayerIndex
      );
      if (nextPlayerId) {
        io.to(nextPlayerId).emit("yourTurn", {
          currentPlayerIndex: nextPlayerIndex,
        });
      }
    }, 2000); // Wait 2 seconds before moving to next player

    // Send updated game state
    io.to(roomId).emit("gameStateUpdate", rooms[roomId].gameState);
  });
});

// Start server
const PORT = process.env.PORT || 8083;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Minimal server running on http://0.0.0.0:${PORT}`);
});
