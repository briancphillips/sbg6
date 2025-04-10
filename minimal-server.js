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

// Create a helper function to ensure a proper game state structure
function createInitialGameState(roomId, creatorName) {
  // Create properly structured players array with correct pawns
  const initialPlayers = Array(4)
    .fill()
    .map((_, playerIndex) => {
      const isCreator = playerIndex === 0;
      return {
        type: isCreator ? "human" : "empty",
        details: {
          name: isCreator ? creatorName : "Waiting...",
        },
        pawns: Array(4)
          .fill()
          .map((_, pawnIndex) => ({
            id: pawnIndex,
            playerIndex: playerIndex,
            positionType: "start",
            positionIndex: -1,
          })),
      };
    });

  return {
    roomId: roomId,
    gameStarted: false,
    currentPlayerIndex: 0,
    currentCard: null,
    players: initialPlayers,
    selectablePawns: [],
    validMoves: [],
    targetableOpponents: [],
    message: `${creatorName}'s room. Waiting for players...`,
    discardPile: [],
    gameOver: false,
  };
}

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

    // Create room with properly structured game state using helper function
    rooms[roomId] = {
      gameState: createInitialGameState(roomId, playerName),
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
      players: [
        {
          name: playerName,
          playerIndex: 0,
          pawns: Array(4)
            .fill()
            .map((_, pawnIndex) => ({
              id: pawnIndex,
              playerIndex: 0,
              positionType: "start",
              positionIndex: -1,
            })),
        },
      ],
    });

    // Log the state that's being sent
    console.log(
      "Room created with initial game state:",
      JSON.stringify(rooms[roomId].gameState)
    );
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

      // Verify each player in the game state has a properly formed pawns array
      for (let i = 0; i < rooms[roomCode].gameState.players.length; i++) {
        const player = rooms[roomCode].gameState.players[i];
        if (!player) {
          console.error(`Player at index ${i} is not defined in game state!`);
          continue;
        }

        // Make sure pawns array exists and is valid
        if (!Array.isArray(player.pawns)) {
          console.log(`Creating pawns array for player ${i}`);
          player.pawns = Array(4)
            .fill()
            .map((_, pawnIndex) => ({
              id: pawnIndex,
              playerIndex: i,
              positionType: "start",
              positionIndex: -1,
            }));
        }
      }
    }

    // Log what's being sent
    console.log(
      `Sending game state to player ${socket.id}:`,
      JSON.stringify(rooms[roomCode].gameState)
    );

    // Emit join success
    socket.emit("room_joined", {
      roomId: roomCode,
      yourPlayerIndex: playerIndex,
      initialGameState: rooms[roomCode].gameState,
      players: Object.values(rooms[roomCode].players).map((p) => ({
        name: p.name,
        playerIndex: p.playerIndex,
        pawns: Array(4)
          .fill()
          .map((_, pawnIndex) => ({
            id: pawnIndex,
            playerIndex: p.playerIndex,
            positionType: "start",
            positionIndex: -1,
          })),
      })),
    });

    // Update all clients in room
    io.to(roomCode).emit("roomInfoUpdate", {
      roomId: roomCode,
      players: Object.values(rooms[roomCode].players).map((p) => ({
        type: "human",
        details: { name: p.name },
        playerIndex: p.playerIndex,
        pawns: Array(4)
          .fill()
          .map((_, pawnIndex) => ({
            id: pawnIndex,
            playerIndex: p.playerIndex,
            positionType: "start",
            positionIndex: -1,
          })),
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
              type: "human",
              details: { name: p.name },
              playerIndex: p.playerIndex,
              pawns: Array(4)
                .fill()
                .map((_, pawnIndex) => ({
                  id: pawnIndex,
                  playerIndex: p.playerIndex,
                  positionType: "start",
                  positionIndex: -1,
                })),
            })),
          });

          // Send updated game state to all clients
          if (rooms[roomId]) {
            sendGameStateUpdate(roomId);
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
    sendGameStateUpdate(roomId);
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

    // Send updated game state immediately
    sendGameStateUpdate(roomId);

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
      sendGameStateUpdate(roomId);

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
  });

  // Handle all game state updates - ensure complete structure before sending
  function sendGameStateUpdate(roomId) {
    if (!rooms[roomId] || !rooms[roomId].gameState) return;

    // Verify the game state has all required properties
    const gameState = rooms[roomId].gameState;

    // Ensure players array exists and has 4 entries
    if (!Array.isArray(gameState.players) || gameState.players.length !== 4) {
      console.error(
        `Invalid players array in room ${roomId}:`,
        gameState.players
      );
      gameState.players = createInitialGameState(roomId, "Player").players;
    }

    // Verify each player has a pawns array
    for (let i = 0; i < gameState.players.length; i++) {
      const player = gameState.players[i];
      if (!player) {
        console.error(`Player at index ${i} is not defined!`);
        gameState.players[i] = {
          type: "empty",
          details: { name: "Empty" },
          pawns: [],
        };
      }

      // Ensure pawns array exists
      if (!Array.isArray(player.pawns)) {
        console.log(`Fixing missing pawns array for player ${i}`);
        player.pawns = Array(4)
          .fill()
          .map((_, pawnIndex) => ({
            id: pawnIndex,
            playerIndex: i,
            positionType: "start",
            positionIndex: -1,
          }));
      }
    }

    // Now send the verified game state
    io.to(roomId).emit("gameStateUpdate", gameState);
  }
});

// Start server
const PORT = process.env.PORT || 8083;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Minimal server running on http://0.0.0.0:${PORT}`);
});
