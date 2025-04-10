// Network module for handling WebSocket communication via Socket.IO
import { gameState, resetTurnState } from "./gameState.js";
import { updateUI } from "./ui.js";

let socket = null;
let isConnected = false;
let localPlayerName = "";
let localPlayerId = null;
let localPlayerIndex = -1;
let assignedPlayerIndex = null;

/**
 * Connects to the Socket.IO server.
 * @param {string} playerName - The name chosen by the player.
 */
export function connect(playerName) {
  if (isConnected || socket) {
    console.warn("Already connected or connecting.");
    return;
  }

  localPlayerName = playerName;
  console.log(`Attempting to connect as ${playerName}...`);

  // Log important connection information
  console.log(`Socket.IO connecting from: ${window.location.href}`);
  console.log(
    `Socket.IO default URL: ${window.location.protocol}//${window.location.host}`
  );

  // Multi-strategy connection approach
  // Get the base URL (domain and port) without path
  const baseUrl = window.location.origin;
  console.log(`Base URL: ${baseUrl}`);

  // Determine if we're running on localhost or not
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.includes("192.168.");

  console.log(`Is localhost: ${isLocalhost}`);

  // Try to connect to Socket.IO server using path option for Docker compatibility
  // This approach works with both scenarios:
  // 1. Direct connection to port 3000
  // 2. Connection through the static server with path forwarding
  console.log("Using path-based connection method");
  socket = io(baseUrl, {
    query: { playerName },
    reconnectionAttempts: 3,
    path: "/socket.io/", // Standard Socket.IO path
    transports: ["polling", "websocket"], // Try polling first (more reliable through proxies)
  });

  // Add debug logging for Socket.IO client errors
  socket.on("connect_error", (err) => {
    console.error(`Socket.IO Connect Error: ${err.message}`);
    if (err.description) console.error(`Description: ${err.description}`);
    console.error(`Error Data:`, err);
  });

  setupListeners();
}

/**
 * Disconnects from the Socket.IO server.
 */
export function disconnect() {
  // Clear relevant game state on disconnect
  gameState.roomId = null;
  gameState.gameStarted = false;
  if (socket) {
    console.log("Disconnecting socket...");
    socket.disconnect();
    socket = null;
  }
  isConnected = false;
  localPlayerId = null;
  localPlayerIndex = -1;
  localPlayerName = "";
  console.log("Disconnected.");
  document.dispatchEvent(
    new CustomEvent("networkStatus", { detail: { status: "disconnected" } })
  );
}

/**
 * Sets up listeners for Socket.IO events from the server.
 */
function setupListeners() {
  if (!socket) return;

  socket.on("connect", () => {
    isConnected = true;
    localPlayerId = socket.id;
    console.log(`Connected to server with ID: ${localPlayerId}`);
    document.dispatchEvent(
      new CustomEvent("networkStatus", {
        detail: { status: "connected", playerId: localPlayerId },
      })
    );
    // Now ready to join/create room
  });

  socket.on("disconnect", (reason) => {
    const wasConnected = isConnected;
    isConnected = false;
    localPlayerId = null;
    localPlayerIndex = -1;
    console.log(`Disconnected from server: ${reason}`);
    // Only dispatch event if we were previously connected to avoid duplicate messages on failed initial connect
    if (wasConnected) {
      document.dispatchEvent(
        new CustomEvent("networkStatus", {
          detail: { status: "disconnected", reason: reason },
        })
      );
    }
  });

  socket.on("connect_error", (error) => {
    console.error(`Connection Error: ${error.message}`);
    socket = null;
    isConnected = false;
    document.dispatchEvent(
      new CustomEvent("networkStatus", {
        detail: { status: "error", message: error.message },
      })
    );
  });

  // --- Lobby/Room Listeners ---
  socket.on("assignPlayerData", (data) => {
    console.log("Received player assignment:", data);
    localPlayerId = data.playerId;
    localPlayerIndex = data.playerIndex;
    document.dispatchEvent(
      new CustomEvent("assignPlayer", {
        detail: { id: localPlayerId, index: localPlayerIndex },
      })
    );
  });

  socket.on("room_joined", (data) => {
    console.log("Room joined/created:", data);
    // data should include { roomId, players, initialGameState, yourPlayerIndex }
    if (data.error) {
      console.error("Room join/create error:", data.error);
      // TODO: Display error to user on the setup screen
      return;
    }

    // Initial game state update from server
    if (data.initialGameState) {
      Object.assign(gameState, data.initialGameState);
      console.log("Local gameState updated from server.");
      document.dispatchEvent(
        new CustomEvent("gameStateUpdate", {
          detail: { state: data.initialGameState },
        })
      );
    }
    assignedPlayerIndex = data.yourPlayerIndex;
    gameState.roomId = data.roomId; // Set Room ID
    // Explicitly set players array after Object.assign
    if (data.players) {
      gameState.players = data.players;
    }
    console.log(
      `Assigned player index: ${data.yourPlayerIndex}, Room ID: ${data.roomId}`
    );
    // Dispatch event for UI to potentially update player list, etc.
    document.dispatchEvent(
      new CustomEvent("roomUpdate", {
        detail: { roomId: data.roomId, players: data.players },
      })
    );
  });

  socket.on("joinFailed", (message) => {
    console.error("Failed to join room:", message);
    document.dispatchEvent(
      new CustomEvent("serverError", { detail: `Join Failed: ${message}` })
    );
    // Maybe disconnect or allow user to try again?
    disconnect();
  });

  socket.on("roomCreated", (roomData) => {
    console.log("Successfully created and joined room:", roomData);
    // Initialize or update game state based on server data
    Object.assign(gameState, roomData.gameState);
    gameState.roomId = roomData.roomId;
    // Explicitly set players array after Object.assign
    if (roomData.players) {
      gameState.players = roomData.players;
    }
    console.log("Local gameState updated from server.");
    document.dispatchEvent(
      new CustomEvent("gameStateUpdate", {
        detail: { state: roomData.gameState },
      })
    );
    document.dispatchEvent(new CustomEvent("roomUpdate", { detail: roomData }));
  });

  socket.on("roomCreationFailed", (message) => {
    console.error("Failed to create room:", message);
    document.dispatchEvent(
      new CustomEvent("serverError", { detail: `Create Failed: ${message}` })
    );
    disconnect();
  });

  // Example: Update player list in a room when someone joins/leaves
  socket.on("roomInfoUpdate", (roomData) => {
    console.log("Received roomInfoUpdate:", roomData);
    // --- Update local gameState.players ---
    if (roomData && roomData.players) {
      // Assuming roomData.players is an array of player objects
      // Make sure the structure matches what the client expects
      gameState.players = roomData.players;
      console.log("Updated local gameState.players:", gameState.players);
    } else {
      console.warn("roomInfoUpdate received without players data?");
    }
    // -------------------------------------

    // Dispatch event for UI to update (e.g., player list display)
    document.dispatchEvent(new CustomEvent("roomUpdate", { detail: roomData }));
  });

  // --- Game Specific Listeners ---

  // Server sends the complete state periodically or after major events
  socket.on("gameStateUpdate", (serverGameState) => {
    // Ensure room ID is preserved if server state doesn't include it
    const currentRoomId = gameState.roomId;
    // console.log("Received gameStateUpdate:", serverGameState);
    // Directly update the entire local game state
    // Be careful: This assumes the server sends the complete, correct state
    Object.assign(gameState, serverGameState);
    // Restore room ID if it was overwritten by server state
    if (!gameState.roomId && currentRoomId) {
      gameState.roomId = currentRoomId;
    }
    // Dispatch an event for UI/other modules to react
    document.dispatchEvent(
      new CustomEvent("gameStateUpdate", { detail: { state: gameState } })
    );
  });

  // Listen for the game starting (triggered by host)
  socket.on("game_started", (initialGameState) => {
    console.log("Received game_started event", initialGameState);
    gameState.gameStarted = true;
    // Update state if provided (might be the same as initial join state)
    if (initialGameState) {
      const currentRoomId = gameState.roomId;
      Object.assign(gameState, initialGameState);
      if (!gameState.roomId && currentRoomId) {
        gameState.roomId = currentRoomId;
      }
      gameState.gameStarted = true;
    }
    // Dispatch update to hide 'Start Game' button, etc.
    document.dispatchEvent(
      new CustomEvent("gameStateUpdate", { detail: { state: gameState } })
    );
    // Potentially trigger first turn or wait for server 'turn' event
  });

  // Notification that it's your turn
  socket.on("yourTurn", (turnData) => {
    // turnData might include { currentPlayerIndex: X, currentCard: Y } or just signal start
    console.log(`It's your turn! Data:`, turnData);
    // Update local state based on turnData if necessary
    // gameState.currentPlayerIndex = turnData.currentPlayerIndex;
    // gameState.currentCard = turnData.currentCard;
    // For now, assume gameStateUpdate handles state, just signal turn start
    document.dispatchEvent(
      new CustomEvent("turnStart", {
        detail: { localPlayerIndex: localPlayerIndex },
      })
    );
  });

  // General message from server (info, opponent actions, etc.)
  socket.on("message", (message) => {
    console.log("Server message:", message);
    document.dispatchEvent(
      new CustomEvent("serverMessage", { detail: message })
    );
  });

  // Error from server related to game logic (e.g., invalid move)
  socket.on("gameError", (errorMessage) => {
    console.error("Server Game Error:", errorMessage);
    document.dispatchEvent(
      new CustomEvent("serverError", { detail: errorMessage })
    );
  });

  // Game Over message
  socket.on("gameOver", (winData) => {
    // winData might include { winnerIndex: X, winnerName: '... '}
    console.log("Received gameOver from server:", winData);
    gameState.gameOver = true;
    // Optionally update winner info in gameState if needed
    document.dispatchEvent(
      new CustomEvent("gameOverUpdate", { detail: winData })
    );
  });
}

/**
 * Attempts to join an existing game room.
 * @param {string} roomCode - The code of the room to join.
 */
export function joinRoom(roomCode) {
  if (!socket || !isConnected) {
    console.error("Cannot join room: Not connected.");
    // Dispatch an error event maybe?
    document.dispatchEvent(
      new CustomEvent("serverError", {
        detail: "Cannot join room: Not connected.",
      })
    );
    return;
  }
  console.log(`Attempting to join room: ${roomCode}`);
  socket.emit("joinRoom", roomCode);
}

/**
 * Attempts to create a new game room.
 */
export function createRoom() {
  if (!socket || !isConnected) {
    console.error("Cannot create room: Not connected.");
    document.dispatchEvent(
      new CustomEvent("serverError", {
        detail: "Cannot create room: Not connected.",
      })
    );
    return;
  }
  console.log("Requesting to create a new room...");
  socket.emit("createRoom");
}

/**
 * Emits a player action to the server.
 * @param {string} actionType - e.g., 'drawCard', 'selectPawn', 'selectMove'
 * @param {object} payload - Data associated with the action.
 */
export function emitAction(actionType, payload = {}) {
  if (!socket || !isConnected) {
    console.error(`Cannot emit action '${actionType}': Not connected.`);
    // Should we show an error to the user?
    return;
  }

  // Basic validation before sending might be useful
  if (!actionType) {
    console.error("emitAction requires an actionType.");
    return;
  }

  console.log(
    `Emitting action: ${actionType}, Player: ${localPlayerIndex}, Payload:`,
    payload
  );
  socket.emit("playerAction", {
    roomId: gameState.roomId,
    playerId: localPlayerIndex,
    actionType: actionType,
    payload: payload,
  });
}

// Function for the host to request starting the game
export function requestStartGame() {
  if (socket && socket.connected) {
    console.log(`Emitting 'start_game' for room: ${gameState.roomId}`);
    socket.emit("start_game", { roomId: gameState.roomId });
  } else {
    console.error("Cannot start game: Socket not connected.");
  }
}

// --- Example Wrappers for Specific Actions ---

export function requestDrawCard() {
  // In online mode, the client just requests to draw.
  // The server will handle deck logic and respond, possibly with 'yourTurn' or 'gameStateUpdate'
  console.log("Requesting draw card...");
  emitAction("drawCard");
}

export function requestSelectPawn(pawn) {
  if (!pawn) return;
  // Send only necessary info, not the whole object if possible
  console.log(`Requesting select pawn: ${pawn.id}`);
  emitAction("selectPawn", { pawnId: pawn.id, playerIndex: pawn.playerIndex });
}

export function requestMoveSelection(move) {
  if (!move) return;
  // Send relevant move details
  console.log("Requesting move selection:", move);
  emitAction("selectMove", { moveDetails: move });
}

export function requestSorry(targetPawn) {
  if (!targetPawn) return;
  console.log(`Requesting Sorry! on pawn: ${targetPawn.id}`);
  emitAction("executeSorry", {
    targetPawnId: targetPawn.id,
    targetPlayerIndex: targetPawn.playerIndex,
  });
}

export function requestSwap(targetPawn) {
  if (!targetPawn) return;
  console.log(`Requesting Swap with pawn: ${targetPawn.id}`);
  emitAction("executeSwap", {
    targetPawnId: targetPawn.id,
    targetPlayerIndex: targetPawn.playerIndex,
  });
}

// TODO: Add functions/listeners for chat, game settings, etc.
