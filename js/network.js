// Network module for handling WebSocket communication via Socket.IO
import { gameState, initializeGameState } from "./gameState.js"; // May need to update local state based on server
// import { updateUI } from "./ui.js"; // UI updates should be triggered by events handled in main.js/ui.js
// import { drawGame } from "./drawing.js"; // Drawing updates should be triggered by events handled in main.js/ui.js

let socket = null;
let isConnected = false;
let localPlayerName = "";
let localPlayerId = null; // Assigned by server
let localPlayerIndex = -1; // Assigned by server upon joining room

const SERVER_URL = "http://localhost:3000"; // TODO: Make configurable

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
  console.log(`Attempting to connect to ${SERVER_URL} as ${playerName}...`);

  // Use actual Socket.IO connection
  socket = io(SERVER_URL, {
    query: { playerName }, // Send player name on connection
    reconnectionAttempts: 3,
  });

  setupListeners(); // Setup listeners after initializing socket

  // // Simulate connection for now
  // setTimeout(() => {
  //     console.log("Simulated connection successful.");
  //     isConnected = true;
  //     // Simulate receiving player ID
  //     localPlayerId = "player_" + Math.random().toString(36).substring(7);
  //     // Update UI (e.g., show connected status)
  //     document.dispatchEvent(new CustomEvent('networkStatus', { detail: { status: 'connected', playerId: localPlayerId } }));
  // }, 1000);
}

/**
 * Disconnects from the Socket.IO server.
 */
export function disconnect() {
  if (socket) {
    console.log("Disconnecting from server...");
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
    localPlayerId = socket.id; // Use socket ID as player ID
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
    socket = null; // Ensure socket is null on connection error
    isConnected = false;
    document.dispatchEvent(
      new CustomEvent("networkStatus", {
        detail: { status: "error", message: error.message },
      })
    );
  });

  // --- Lobby/Room Listeners ---
  socket.on("assignPlayerData", (data) => {
    console.log("Received player assignment:", data); // { playerId: '...', playerIndex: X }
    localPlayerId = data.playerId; // Server might re-assign ID on room join
    localPlayerIndex = data.playerIndex;
    document.dispatchEvent(
      new CustomEvent("assignPlayer", {
        detail: { id: localPlayerId, index: localPlayerIndex },
      })
    );
  });

  socket.on("roomJoined", (roomData) => {
    console.log("Successfully joined room:", roomData); // { roomId: 'abc', gameState: {...}, players: [...] }
    // Initialize or update game state based on server data
    Object.assign(gameState, roomData.gameState); // Overwrite local state
    console.log("Local gameState updated from server.");
    document.dispatchEvent(
      new CustomEvent("gameStateUpdate", {
        detail: { state: roomData.gameState },
      })
    );
    document.dispatchEvent(new CustomEvent("roomUpdate", { detail: roomData }));
  });

  socket.on("joinFailed", (message) => {
    console.error("Failed to join room:", message);
    document.dispatchEvent(
      new CustomEvent("serverError", { detail: `Join Failed: ${message}` })
    );
    // Maybe disconnect or allow user to try again?
    disconnect(); // Disconnect on failure for now
  });

  socket.on("roomCreated", (roomData) => {
    console.log("Successfully created and joined room:", roomData);
    // Initialize or update game state based on server data
    Object.assign(gameState, roomData.gameState);
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
    disconnect(); // Disconnect on failure for now
  });

  // Example: Update player list in a room when someone joins/leaves
  socket.on("roomInfoUpdate", (roomData) => {
    console.log("Received roomInfoUpdate:", roomData); // { players: [...] }
    // Update player list, maybe current player indicator if changed
    // Avoid overwriting entire gameState here, just update relevant parts if needed
    // For now, just dispatch the event for UI update
    document.dispatchEvent(new CustomEvent("roomUpdate", { detail: roomData }));
  });

  // --- Game Specific Listeners ---

  // Server sends the complete state periodically or after major events
  socket.on("gameStateUpdate", (serverGameState) => {
    console.log("Received gameStateUpdate from server");
    // Carefully merge serverGameState into local gameState
    // Overwriting might be okay if server is fully authoritative
    Object.assign(gameState, serverGameState);
    console.log("Local gameState updated from server gameStateUpdate event.");
    // Dispatch event so UI/Drawing can react
    document.dispatchEvent(
      new CustomEvent("gameStateUpdate", { detail: { state: serverGameState } })
    );
  });

  // Notification that it's your turn
  socket.on("yourTurn", (turnData) => {
    // turnData might include { currentPlayerIndex: X, currentCard: Y } or just signal start
    console.log(`It's your turn! Data:`, turnData);
    // Update local state based on turnData if necessary
    // gameState.currentPlayerIndex = turnData.currentPlayerIndex;
    // gameState.currentCard = turnData.currentCard; // Server might pre-draw
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
  socket.emit("createRoom"); // Server assigns room code
}

/**
 * Emits a player action to the server.
 * @param {string} actionType - e.g., 'drawCard', 'selectPawn', 'selectMove'
 * @param {object} payload - Data associated with the action.
 */
export function emitAction(actionType, payload) {
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

  console.log(`Emitting action: ${actionType}`, payload || "");
  socket.emit("playerAction", { type: actionType, payload: payload || {} });
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
