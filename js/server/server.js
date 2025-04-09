// server.js (Conceptual Example)
const { Server } = require("socket.io");

// Use port 3000 to match client's network.js SERVER_URL
const io = new Server(3000, {
  cors: {
    origin: "*", // Allow connections from any origin for simplicity (adjust for production)
  },
});

let rooms = {}; // { roomId: { gameState: {...}, players: { socketId: { name: '', playerIndex: X } }, ... } }
let players = {}; // { socketId: { name: '', currentRoomId: '...' } }

// --- Game Logic (Needs to be Ported/Imported) ---
// You would need functions equivalent to client-side:
// initializeGameStateServerVersion(), initializeDeckServer(), drawCardServer(),
// validateMoveServer(), executeMoveServer(), checkForWinServer(), etc.
// These functions would operate on the gameState stored within the 'rooms' object.
// --- End Game Logic ---

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);
  const playerName = socket.handshake.query.playerName || "Anonymous";
  players[socket.id] = { name: playerName, currentRoomId: null };
  console.log(`Player name: ${playerName}`);

  socket.on("createRoom", () => {
    // TODO: Generate unique roomId
    const roomId = `room_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`${playerName} (${socket.id}) creating room ${roomId}`);

    // TODO: Initialize server-side game state for the room
    const initialGameState = {}; // = initializeGameStateServerVersion();

    rooms[roomId] = {
      roomId: roomId,
      gameState: initialGameState,
      players: {}, // Map socket.id to player info within the room
      playerOrder: [], // Array of socket.ids in turn order
      // ... other room metadata
    };

    // Add creator as player 0
    rooms[roomId].players[socket.id] = { name: playerName, playerIndex: 0 };
    rooms[roomId].playerOrder.push(socket.id);
    players[socket.id].currentRoomId = roomId;

    socket.join(roomId);

    // Tell creator their assigned index
    socket.emit("assignPlayerData", { playerId: socket.id, playerIndex: 0 });

    // Send initial room/game state back to creator
    socket.emit("roomCreated", {
      roomId: roomId,
      gameState: rooms[roomId].gameState,
      players: Object.values(rooms[roomId].players), // Send player info list
    });
    console.log(`Room ${roomId} created. Players:`, rooms[roomId].players);
  });

  socket.on("joinRoom", (roomId) => {
    console.log(
      `${playerName} (${socket.id}) attempting to join room ${roomId}`
    );
    const room = rooms[roomId];

    if (!room) {
      console.log(`Room ${roomId} not found.`);
      socket.emit("joinFailed", "Room not found.");
      return;
    }

    const playerCount = Object.keys(room.players).length;
    if (playerCount >= 4) {
      console.log(`Room ${roomId} is full.`);
      socket.emit("joinFailed", "Room is full.");
      return;
    }

    // Assign next available player index
    const playerIndex = playerCount;
    room.players[socket.id] = { name: playerName, playerIndex: playerIndex };
    room.playerOrder.push(socket.id); // Add to turn order
    players[socket.id].currentRoomId = roomId;

    socket.join(roomId);

    console.log(
      `${playerName} (${socket.id}) joined room ${roomId} as player ${playerIndex}`
    );

    // Tell joining player their info
    socket.emit("assignPlayerData", {
      playerId: socket.id,
      playerIndex: playerIndex,
    });

    // Send current room/game state to joining player
    socket.emit("roomJoined", {
      roomId: roomId,
      gameState: room.gameState,
      players: Object.values(room.players), // Send updated player list
    });

    // Notify others in the room
    socket.to(roomId).emit("roomInfoUpdate", {
      players: Object.values(room.players), // Send updated player list to others
    });
    socket.to(roomId).emit("message", `${playerName} has joined the game!`);

    // TODO: Start game if enough players?
    if (Object.keys(room.players).length === 4) {
      // Example: start when full
      // Initialize deck, set first player, etc. on room.gameState
      // Then emit initial gameStateUpdate and yourTurn
      console.log(`Room ${roomId} is full. Starting game...`);
      io.to(roomId).emit("message", "Game starting!");
    }
  });

  socket.on("playerAction", (action) => {
    const roomId = players[socket.id]?.currentRoomId;
    if (!roomId || !rooms[roomId]) {
      console.error(`Action from ${socket.id} with no room?`, action);
      socket.emit("gameError", "You are not in a room.");
      return;
    }

    const room = rooms[roomId];
    const playerInfo = room.players[socket.id];

    if (!playerInfo) {
      console.error(`Player info not found for ${socket.id} in room ${roomId}`);
      socket.emit("gameError", "Internal server error (player not found).");
      return;
    }

    console.log(
      `Received action from ${playerName} (Player ${playerInfo.playerIndex}) in room ${roomId}:`,
      action
    );

    // Placeholder: Echo action type back as message
    io.to(roomId).emit(
      "message",
      `${playerName} performed action: ${action.type}`
    );
  });

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    const player = players[socket.id];
    if (player && player.currentRoomId) {
      const roomId = player.currentRoomId;
      const room = rooms[roomId];
      if (room) {
        console.log(`${player.name} left room ${roomId}`);
        delete room.players[socket.id];
        room.playerOrder = room.playerOrder.filter((id) => id !== socket.id);

        // TODO: Handle game state if player leaves mid-game (e.g., pause, assign AI, end game?)
        // For now, just notify others
        io.to(roomId).emit("message", `${player.name} has left the game.`);
        io.to(roomId).emit("roomInfoUpdate", {
          players: Object.values(room.players),
        });

        // TODO: Delete room if empty?
        if (Object.keys(room.players).length === 0) {
          console.log(`Room ${roomId} is empty, deleting.`);
          delete rooms[roomId];
        }
      }
    }
    delete players[socket.id];
  });
});

console.log("Socket.IO server listening on port 3000");
