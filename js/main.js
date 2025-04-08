// Main entry point for the Sorry! game
import { initializeBoardPaths } from "./board.js";
import { initDrawing, drawGame } from "./drawing.js";
import { gameState, initializeGameState } from "./gameState.js";
import { initializeDeck } from "./cards.js";
import { initUI, updateUI, determineActionsForCard } from "./ui.js";
import { debugSafetyEntries, diagnoseSafetyZones } from "./moves.js";
import { listScenarios, loadScenarioState } from "./scenarioManager.js";
import { aiTakeTurn } from "./ai.js"; // Import AI logic
import { connect, joinRoom, createRoom, disconnect } from "./network.js"; // Import network module

// DOM Elements for setup
let gameSetupScreen;
let gameLayout;
let startGameButton;
let playerTypeSelectors = {};
let gameModeRadios = [];
let localPlayerSetup;
let onlineGameSetup;
let playerNameInput;
let roomCodeInput;
let joinRoomButton;
let createRoomButton;
let onlineStatusMessage;

// DOM Elements for game display
let connectionStatus;
let playerListContainer;
let playerList;

// Game mode state
let currentMode = "local"; // 'local' or 'online'
let intentToJoin = false; // Track if the user wants to join vs create after connecting

// Initialize the game based on setup configuration
export function initializeGame(playerTypes = { 1: "ai", 2: "ai", 3: "ai" }) {
  // Default to AI for others for local game
  console.log("Initializing local game with player types:", playerTypes);
  currentMode = "local";

  // Get canvas and context
  const canvas = document.getElementById("sorryCanvas");
  if (!canvas) {
    console.error("Canvas element not found!");
    return;
  }
  const ctx = canvas.getContext("2d");

  // Initialize drawing module
  initDrawing(ctx);

  // Initialize the board paths
  initializeBoardPaths();

  // Initialize game state with selected player types
  initializeGameState(playerTypes);

  // Initialize the deck
  initializeDeck();

  // Debug safety zone entries and movements
  debugSafetyEntries();
  diagnoseSafetyZones();

  // Initialize UI (ensure connectionStatus etc. are passed if needed)
  initUI({
    canvas: canvas,
    currentPlayerNameEl: document.getElementById("currentPlayerName"),
    currentPlayerColorEl: document.getElementById("currentPlayerColor"),
    cardDrawnEl: document.getElementById("cardDrawn"),
    messageAreaEl: document.getElementById("messageArea"),
    winMessageEl: document.getElementById("winMessage"),
    drawCardButton: document.getElementById("drawCardButton"),
    resetButton: document.getElementById("resetButton"),
    // Pass online mode elements
    connectionStatusEl: connectionStatus,
    playerListContainerEl: playerListContainer,
    playerListEl: playerList,
  });

  // Remove old listeners if any (important for reset)
  window.removeEventListener("resetGame", handleResetGame);
  window.removeEventListener("nextTurn", handleNextTurn);
  window.removeEventListener("networkStatus", handleNetworkStatus); // Remove previous network listener

  // Set up event listeners for game events
  window.addEventListener("resetGame", handleResetGame);
  window.addEventListener("nextTurn", handleNextTurn);
  window.addEventListener("networkStatus", handleNetworkStatus); // Add network listener

  // Initial UI update and draw
  updateUI(currentMode);
  drawGame();

  console.log("Local Game Initialized");
  // Hide setup, show game
  if (gameSetupScreen) gameSetupScreen.classList.add("hidden");
  if (gameLayout) gameLayout.classList.remove("hidden");

  // If first player is AI in local mode, start their turn
  checkAndTriggerAI();
}

// Function to initiate the online game connection process
function startOnlineGame(join = false) {
  console.log("Attempting to start Online Game connection...");
  currentMode = "online";
  intentToJoin = join; // Remember if user wants to join or create
  const playerName = playerNameInput.value.trim();
  const roomCode = roomCodeInput.value.trim();

  if (!playerName) {
    onlineStatusMessage.textContent = "Please enter your name.";
    onlineStatusMessage.style.color = "red";
    return;
  }

  if (join && !roomCode) {
    onlineStatusMessage.textContent = "Please enter a room code to join.";
    onlineStatusMessage.style.color = "red";
    return;
  }

  onlineStatusMessage.textContent = "Connecting to server...";
  onlineStatusMessage.style.color = "black";
  joinRoomButton.disabled = true;
  createRoomButton.disabled = true;

  // Initiate connection - actual room join/create happens in handleNetworkStatus
  connect(playerName);
}

// Handle network status updates from network.js
function handleNetworkStatus(event) {
  const { status, playerId, message, reason } = event.detail;
  console.log("handleNetworkStatus:", status, event.detail);

  if (status === "connected") {
    onlineStatusMessage.textContent = `Connected as ${playerNameInput.value.trim()} (ID: ${playerId}).`;
    onlineStatusMessage.style.color = "green";
    if (intentToJoin) {
      const roomCode = roomCodeInput.value.trim();
      onlineStatusMessage.textContent += ` Joining room ${roomCode}...`;
      joinRoom(roomCode); // Now try to join the room
    } else {
      onlineStatusMessage.textContent += " Creating room...";
      createRoom(); // Now try to create a room
    }
    // TODO: Need feedback from joinRoom/createRoom success/failure
    // For now, assume success and proceed (will need server events)
    setTimeout(() => {
      if (gameSetupScreen) gameSetupScreen.classList.add("hidden");
      if (gameLayout) gameLayout.classList.remove("hidden");
      updateUI(currentMode); // Update UI for online mode
      // Don't draw board until game state received from server
      console.log("Waiting for game state from server...");
    }, 500); // Small delay to show status message
  } else if (status === "disconnected") {
    onlineStatusMessage.textContent = `Disconnected: ${
      reason || "Connection closed"
    }`;
    onlineStatusMessage.style.color = "red";
    // Make setup buttons available again
    joinRoomButton.disabled = false;
    createRoomButton.disabled = false;
    // Potentially show setup screen again?
    // if (gameLayout) gameLayout.classList.add("hidden");
    // if (gameSetupScreen) gameSetupScreen.classList.remove("hidden");
  } else if (status === "error") {
    onlineStatusMessage.textContent = `Connection Error: ${message}`;
    onlineStatusMessage.style.color = "red";
    joinRoomButton.disabled = false;
    createRoomButton.disabled = false;
  }

  // Update the connection status display in the sidebar
  if (connectionStatus) {
    connectionStatus.textContent = `Status: ${status}`; // Simple status update
  }
}

// Handle game reset event
function handleResetGame() {
  // Disconnect if in online mode
  if (currentMode === "online") {
    disconnect();
  }

  // Show setup screen, hide game layout
  if (gameSetupScreen) gameSetupScreen.classList.remove("hidden");
  if (gameLayout) gameLayout.classList.add("hidden");
  // Reset button visibility is handled in updateUI, but let's hide it explicitly
  const resetButton = document.getElementById("resetButton");
  if (resetButton) resetButton.classList.add("hidden");
  // Reset mode to local default
  document.querySelector(
    'input[name="gameMode"][value="local"]'
  ).checked = true;
  handleModeChange(); // Update UI based on mode selection
  // Ensure online buttons are re-enabled after reset
  if (joinRoomButton) joinRoomButton.disabled = false;
  if (createRoomButton) createRoomButton.disabled = false;
}

// Checks if the current player is an AI and triggers its turn
function checkAndTriggerAI() {
  if (currentMode === "online" || gameState.gameOver) return;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (currentPlayer && currentPlayer.type === "ai") {
    console.log(
      `AI Player ${gameState.currentPlayerIndex} (${currentPlayer.details.name}) turn starting.`
    );
    // Disable input for human players during AI turn
    const drawButton = document.getElementById("drawCardButton");
    if (drawButton) drawButton.disabled = true;
    const canvasEl = document.getElementById("sorryCanvas");
    if (canvasEl) canvasEl.classList.remove("clickable");

    // Call the AI logic after a delay
    setTimeout(() => aiTakeTurn(gameState.currentPlayerIndex), 500); // Short delay before AI "thinks"
  } else if (currentPlayer) {
    console.log(
      `Human Player ${gameState.currentPlayerIndex} (${currentPlayer.details.name}) turn starting.`
    );
    // Ensure button is enabled for human player's turn (updateUI should handle this, but explicit is safer)
    const drawButton = document.getElementById("drawCardButton");
    // Ensure it's not disabled due to game over or existing card (should be null now)
    if (drawButton)
      drawButton.disabled =
        gameState.gameOver || gameState.currentCard !== null;
  }
}

// Handle next turn
function handleNextTurn() {
  if (currentMode === "online") {
    console.log("Next turn logic handled by server in online mode.");
    // In online mode, the server dictates turn changes.
    // Client might receive an update that triggers UI changes.
    return;
  }

  console.log(
    "handleNextTurn triggered (Local). Current card:",
    gameState.currentCard,
    "Player:",
    gameState.currentPlayerIndex
  );

  // --- Discard the previous player's card ---
  if (gameState.currentCard) {
    console.log(`Discarding card: ${gameState.currentCard}`);
    gameState.discardPile.push(gameState.currentCard);
    gameState.currentCard = null;
  } else {
    console.log("No current card to discard.");
  }
  // ------------------------------------------

  // Reset action states from previous turn (safer here than in execute functions)
  gameState.selectedPawn = null;
  gameState.validMoves = [];
  gameState.selectablePawns = [];
  gameState.targetableOpponents = [];
  gameState.currentAction = null;
  gameState.splitData = {
    firstPawn: null,
    firstMoveValue: 0,
    secondPawn: null,
  };

  // Move to next player
  gameState.currentPlayerIndex =
    (gameState.currentPlayerIndex + 1) % gameState.players.length;

  // Get current player details
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  gameState.message = `${currentPlayer.details.name}'s turn. Draw a card.`;
  console.log(
    `Next player is ${gameState.currentPlayerIndex} (${currentPlayer.details.name}), Type: ${currentPlayer.type}`
  );

  // Update UI immediately to show the correct player and clear previous highlights
  updateUI(currentMode);
  drawGame();

  // --- AI CONTROL HOOK ---
  checkAndTriggerAI();
  // -------------------------------------
}

// Handle changes in Game Mode selection
function handleModeChange() {
  const selectedMode = document.querySelector(
    'input[name="gameMode"]:checked'
  ).value;
  currentMode = selectedMode; // Update global state if needed elsewhere

  if (selectedMode === "local") {
    localPlayerSetup.classList.remove("hidden");
    onlineGameSetup.classList.add("hidden");
    startGameButton.textContent = "Start Local Game";
    startGameButton.style.display = ""; // Show start button
    // Hide online specific buttons if they were shown
    joinRoomButton.style.display = "none";
    createRoomButton.style.display = "none";
  } else {
    // online mode
    localPlayerSetup.classList.add("hidden");
    onlineGameSetup.classList.remove("hidden");
    startGameButton.style.display = "none"; // Hide generic start button
    // Show online specific buttons
    joinRoomButton.style.display = "";
    createRoomButton.style.display = "";
    // Clear any previous online status message
    onlineStatusMessage.textContent = "";
  }
}

// Function to handle scenario loading requests from UI
function handleLoadScenarioRequest(event) {
  const { scenarioName, playerIndexOrConfig } = event.detail;
  console.log(`Main: Handling scenario load request for ${scenarioName}`);

  // 1. Initialize a clean local game state
  // Use default player types (Player 0 Human, others AI)
  initializeGame(); // This sets mode to local, initializes state, UI, drawing

  // We might need a very small delay to ensure DOM/UI elements are ready
  // after initializeGame before applying scenario state, although often not needed.
  // setTimeout(() => {
  // 2. Apply the specific scenario state modifications
  const stateLoaded = loadScenarioState(scenarioName, playerIndexOrConfig);

  if (stateLoaded) {
    // 3. Determine possible actions based on the scenario state
    if (gameState.currentCard && gameState.currentPlayerIndex !== undefined) {
      console.log("Main: Determining actions for loaded scenario...");
      determineActionsForCard(
        gameState.currentPlayerIndex,
        gameState.currentCard
      );
    } else {
      console.log(
        "Main: Scenario loaded without a current card, skipping action determination."
      );
      // Ensure action state is clear if no card
      gameState.currentAction = null;
      gameState.selectablePawns = [];
      gameState.validMoves = [];
    }

    // 4. Refresh the display with the final scenario state and actions
    console.log("Main: Refreshing display for scenario...");
    updateUI("local"); // Ensure UI knows it's local mode
    drawGame();

    // 5. If the scenario sets an AI player's turn, trigger it
    checkAndTriggerAI(); // Check if the current player in the scenario is AI
  } else {
    console.error("Main: Failed to apply scenario state.");
    // Optionally show an error to the user
  }
  // }, 10); // Small delay (e.g., 10ms) if needed
}

// Setup event listeners when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  gameSetupScreen = document.getElementById("gameSetupScreen");
  gameLayout = document.querySelector(".game-layout");
  startGameButton = document.getElementById("startGameButton");
  localPlayerSetup = document.getElementById("localPlayerSetup");
  onlineGameSetup = document.getElementById("onlineGameSetup");
  playerNameInput = document.getElementById("playerNameInput");
  roomCodeInput = document.getElementById("roomCodeInput");
  joinRoomButton = document.getElementById("joinRoomButton");
  createRoomButton = document.getElementById("createRoomButton");
  onlineStatusMessage = document.getElementById("onlineStatusMessage");
  connectionStatus = document.getElementById("connectionStatus");
  playerListContainer = document.getElementById("playerListContainer");
  playerList = document.getElementById("playerList");

  playerTypeSelectors = {
    1: document.querySelector('select[name="playerType2"]'), // Corresponds to player index 1 (Blue)
    2: document.querySelector('select[name="playerType3"]'), // Corresponds to player index 2 (Yellow)
    3: document.querySelector('select[name="playerType4"]'), // Corresponds to player index 3 (Green)
  };
  gameModeRadios = document.querySelectorAll('input[name="gameMode"]');

  if (
    !gameSetupScreen ||
    !gameLayout ||
    !startGameButton ||
    !localPlayerSetup ||
    !onlineGameSetup ||
    !joinRoomButton ||
    !createRoomButton
  ) {
    console.error("Setup screen elements not found!");
    return;
  }

  // Show setup screen initially, hide game layout
  gameSetupScreen.classList.remove("hidden");
  gameLayout.classList.add("hidden");

  // Add listeners for mode switching
  gameModeRadios.forEach((radio) =>
    radio.addEventListener("change", handleModeChange)
  );
  // Initial call to set visibility based on default checked radio
  handleModeChange();

  // Start LOCAL Game button listener
  startGameButton.addEventListener("click", () => {
    if (currentMode === "local") {
      const selectedPlayerTypes = {};
      for (const index in playerTypeSelectors) {
        if (playerTypeSelectors[index]) {
          selectedPlayerTypes[index] = playerTypeSelectors[index].value; // 'human' or 'ai'
        }
      }
      initializeGame(selectedPlayerTypes);
    } else {
      console.warn("Start game button clicked while in non-local mode?");
    }
  });

  // Add listeners for Online game buttons
  joinRoomButton.addEventListener("click", () => {
    console.log("Join Room button clicked");
    startOnlineGame(true); // Initiate connection with intent to join
  });

  createRoomButton.addEventListener("click", () => {
    console.log("Create Room button clicked");
    startOnlineGame(false); // Initiate connection with intent to create
  });

  // Add the new listener for scenario load requests
  window.addEventListener("loadScenarioRequest", handleLoadScenarioRequest);
});
