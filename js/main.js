// Main entry point for the Sorry! game
import { initializeBoardPaths } from "./board.js";
import { initDrawing, drawGame } from "./drawing.js";
import { gameState, initializeGameState, resetTurnState } from "./gameState.js";
import { initializeDeck } from "./cards.js";
import { initUI, updateUI, determineActionsForCard } from "./ui.js";
import { debugSafetyEntries, diagnoseSafetyZones } from "./moves.js";
import { listScenarios, loadScenarioState } from "./scenarioManager.js";
import { aiTakeTurn } from "./ai.js"; // Import AI logic
import { connect, joinRoom, createRoom, disconnect } from "./network.js"; // Import network module
import { PLAYERS } from "./constants.js"; // Import PLAYERS constant

// --- Module-Level Variables for DOM Elements ---
// Setup Screen Elements
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

// Game Display Elements
let canvas;
let ctx;
let currentPlayerNameEl;
let currentPlayerColorEl;
let cardDrawnEl;
let messageAreaEl;
let winMessageEl;
let drawCardButton;
let resetButton;
let connectionStatusEl;
let playerListContainerEl;
let playerListEl;
let skipTurnButton; // Added

// Scenario Panel Elements (moved from ui.js)
let toggleScenarioPanelButton;
let scenarioContent;
let scenarioPlayerSelect;
let scenarioButtons = [];

// Game mode state
let currentMode = "local"; // 'local' or 'online'
let intentToJoin = false; // Track if the user wants to join vs create after connecting

// Initialize the game based on setup configuration
export function initializeGame(playerTypes = { 1: "ai", 2: "ai", 3: "ai" }) {
  // Default to AI for others for local game
  console.log("Initializing local game with player types:", playerTypes);
  currentMode = "local";

  // Ensure canvas context is available
  if (!canvas || !ctx) {
    console.error("Canvas or context not initialized!");
    return;
  }

  // Initialize drawing module
  initDrawing(ctx);

  // Initialize the board paths
  initializeBoardPaths();

  // Initialize game state with selected player types
  initializeGameState(playerTypes);

  // Initialize the deck
  initializeDeck();

  // Debug safety zone entries and movements
  // debugSafetyEntries(); // Keep commented or remove if not needed at startup
  // diagnoseSafetyZones(); // Keep commented or remove if not needed at startup

  // Initialize UI - Pass ALL required element references
  initUI({
    canvas: canvas, // Use module-level variable
    currentPlayerNameEl: currentPlayerNameEl,
    currentPlayerColorEl: currentPlayerColorEl,
    cardDrawnEl: cardDrawnEl,
    messageAreaEl: messageAreaEl,
    winMessageEl: winMessageEl,
    drawCardButton: drawCardButton, // Use module-level variable
    resetButton: resetButton, // Use module-level variable
    connectionStatusEl: connectionStatusEl,
    playerListContainerEl: playerListContainerEl,
    playerListEl: playerListEl,
    skipTurnButton: skipTurnButton, // Pass skip turn button
    // Pass Scenario Panel Elements
    toggleScenarioPanelButton: toggleScenarioPanelButton,
    scenarioContent: scenarioContent,
    scenarioPlayerSelect: scenarioPlayerSelect,
    scenarioButtons: scenarioButtons,
  });

  // Remove old listeners if any (important for reset)
  window.removeEventListener("resetGame", handleResetGame);
  window.removeEventListener("nextTurn", handleNextTurn);
  window.removeEventListener("networkStatus", handleNetworkStatus);
  window.removeEventListener("loadScenarioRequest", handleScenarioLoad); // Use correct handler name

  // Set up event listeners for game events
  window.addEventListener("resetGame", handleResetGame);
  window.addEventListener("nextTurn", handleNextTurn);
  window.addEventListener("networkStatus", handleNetworkStatus);
  window.addEventListener("loadScenarioRequest", handleScenarioLoad); // Use correct handler name

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
  } else if (status === "error") {
    onlineStatusMessage.textContent = `Connection Error: ${message}`;
    onlineStatusMessage.style.color = "red";
    joinRoomButton.disabled = false;
    createRoomButton.disabled = false;
  }

  // Update the connection status display in the sidebar
  if (connectionStatusEl) {
    // Use module-level variable
    connectionStatusEl.textContent = `Status: ${status}`; // Simple status update
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
  // const resetButton = document.getElementById("resetButton"); // REMOVED: Use module-level variable
  if (resetButton) resetButton.classList.add("hidden");
  // Reset mode to local default
  const localRadio = gameModeRadios.find((radio) => radio.value === "local");
  if (localRadio) localRadio.checked = true;
  // document.querySelector( // REMOVED: More robust way above
  //   'input[name="gameMode"][value="local"]'
  // ).checked = true;
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
    // const drawButton = document.getElementById("drawCardButton"); // REMOVED: Use module-level variable
    if (drawCardButton) drawCardButton.disabled = true;
    // const canvasEl = document.getElementById("sorryCanvas"); // REMOVED: Use module-level variable
    if (canvas) canvas.classList.remove("clickable"); // Use canvas, not canvasEl

    // Call the AI logic after a delay
    setTimeout(() => aiTakeTurn(gameState.currentPlayerIndex), 500); // Short delay before AI "thinks"
  } else if (currentPlayer) {
    console.log(
      `Human Player ${gameState.currentPlayerIndex} (${currentPlayer.details.name}) turn starting.`
    );
    // Ensure button is enabled for human player's turn (updateUI should handle this, but explicit is safer)
    // const drawButton = document.getElementById("drawCardButton"); // REMOVED: Use module-level variable
    // Ensure it's not disabled due to game over or existing card (should be null now)
    if (drawCardButton)
      drawCardButton.disabled =
        gameState.gameOver || gameState.currentCard !== null;
  }
}

// Handle next turn
function handleNextTurn() {
  if (currentMode === "online") {
    // console.log("Next turn logic handled by server in online mode.");
    // In online mode, the server dictates turn changes.
    // Client might receive an update that triggers UI changes.
    return;
  }

  // console.log(
  //   "handleNextTurn triggered (Local). Current card:",
  //   gameState.currentCard,
  //   "Player:",
  //   gameState.currentPlayerIndex
  // );

  // --- Discard the previous player's card ---
  if (gameState.currentCard) {
    // console.log(`Discarding card: ${gameState.currentCard}`);
    // Add card to discard pile before clearing
    gameState.discardPile.push(gameState.currentCard);
    // TODO: Add card to discard pile logic if implemented
    gameState.currentCard = null;
  } else {
    // console.log("No current card to discard.");
  }

  // --- Advance to the next player ---
  gameState.currentPlayerIndex =
    (gameState.currentPlayerIndex + 1) % gameState.players.length;
  gameState.message = `${
    PLAYERS[gameState.currentPlayerIndex].name
  }'s turn. Draw a card.`;

  // Reset action state for the new turn using the dedicated function
  resetTurnState();
  // gameState.selectedPawn = null;
  // gameState.selectablePawns = [];
  // gameState.validMoves = [];
  // gameState.targetableOpponents = [];
  // gameState.currentAction = null;
  // gameState.splitData = {
  //   firstPawn: null,
  //   firstMoveValue: 0,
  //   secondPawn: null,
  // };

  // console.log(
  //   `Advanced to player ${gameState.currentPlayerIndex} (${
  //     PLAYERS[gameState.currentPlayerIndex].name
  //   })`
  // );

  // Update UI for the new player's turn
  updateUI(currentMode); // Update buttons, player indicator, etc.
  drawGame(); // Redraw might be needed if state changed significantly

  // Check if the new player is an AI and trigger its turn
  checkAndTriggerAI();
}

// Handle game mode change (Local vs Online)
function handleModeChange() {
  const selectedModeInput = gameModeRadios.find((radio) => radio.checked);
  const selectedMode = selectedModeInput ? selectedModeInput.value : "local";
  // const selectedMode = document.querySelector( // REMOVED: Use stored radios
  //   'input[name="gameMode"]:checked'
  // )?.value;

  if (selectedMode === "local") {
    localPlayerSetup.classList.remove("hidden");
    onlineGameSetup.classList.add("hidden");
    startGameButton.classList.remove("hidden"); // Show Start Local Game button
    startGameButton.textContent = "Start Local Game"; // Ensure correct text
    // Disable online buttons if they exist
    if (joinRoomButton) joinRoomButton.classList.add("hidden");
    if (createRoomButton) createRoomButton.classList.add("hidden");
  } else {
    // Online mode selected
    localPlayerSetup.classList.add("hidden");
    onlineGameSetup.classList.remove("hidden");
    startGameButton.classList.add("hidden"); // Hide Start Local Game button
    // Ensure online buttons are visible
    if (joinRoomButton) joinRoomButton.classList.remove("hidden");
    if (createRoomButton) createRoomButton.classList.remove("hidden");
  }
}

// Function to handle scenario loading requests from UI
// (Ensure this function exists and is correctly named)
function handleScenarioLoad(event) {
  const { scenarioName, playerIndexOrConfig } = event.detail;
  console.log(`Main: Handling scenario load request for ${scenarioName}`);

  // 1. Initialize a clean local game state
  // Use default player types (Player 0 Human, others AI)
  initializeGame(); // This sets mode to local, initializes state, UI, drawing

  // We might need a very small delay to ensure DOM/UI elements are ready
  // after initializeGame before applying scenario state, although often not needed.

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
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  // Select ALL DOM elements ONCE here
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
  connectionStatusEl = document.getElementById("connectionStatus");
  playerListContainerEl = document.getElementById("playerListContainer");
  playerListEl = document.getElementById("playerList");
  canvas = document.getElementById("sorryCanvas");
  currentPlayerNameEl = document.getElementById("currentPlayerName");
  currentPlayerColorEl = document.getElementById("currentPlayerColor");
  cardDrawnEl = document.getElementById("cardDrawn");
  messageAreaEl = document.getElementById("messageArea");
  winMessageEl = document.getElementById("winMessage");
  drawCardButton = document.getElementById("drawCardButton");
  resetButton = document.getElementById("resetButton");
  skipTurnButton = document.getElementById("skipTurnButton"); // Select skip button
  toggleScenarioPanelButton = document.getElementById("toggleScenarioPanel"); // Select scenario button
  scenarioContent = document.getElementById("scenarioContent"); // Select scenario content
  scenarioPlayerSelect = document.getElementById("scenarioPlayer"); // Select scenario player select
  scenarioButtons = Array.from(document.querySelectorAll(".scenario-btn")); // Select all scenario buttons

  // Get player type selectors
  playerTypeSelectors = {
    1: document.querySelector('select[name="playerType2"]'), // Corresponds to player index 1 (Blue)
    2: document.querySelector('select[name="playerType3"]'), // Corresponds to player index 2 (Yellow)
    3: document.querySelector('select[name="playerType4"]'), // Corresponds to player index 3 (Green)
  };

  // Get game mode radios
  gameModeRadios = Array.from(
    document.querySelectorAll('input[name="gameMode"]')
  );

  // Initial setup: Ensure only local setup is visible
  handleModeChange(); // Set initial visibility based on default checked radio

  // Add event listeners for setup controls
  startGameButton.addEventListener("click", () => {
    const playerTypes = {};
    for (const index in playerTypeSelectors) {
      if (playerTypeSelectors[index]) {
        playerTypes[index] = playerTypeSelectors[index].value;
      } else {
        playerTypes[index] = "ai"; // Default if selector not found (shouldn't happen)
      }
    }
    console.log("Collected player types:", playerTypes);
    initializeGame(playerTypes);
  });

  gameModeRadios.forEach((radio) => {
    radio.addEventListener("change", handleModeChange);
  });

  // Add listeners for online setup buttons
  joinRoomButton.addEventListener("click", () => {
    console.log("Join Room button clicked");
    startOnlineGame(true); // true indicates joining
  });
  createRoomButton.addEventListener("click", () => {
    console.log("Create Room button clicked");
    startOnlineGame(false); // false indicates creating
  });

  // --- Initialize Canvas Context ---
  if (canvas) {
    ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Failed to get 2D context from canvas!");
    }
  } else {
    console.error("Canvas element not found during initialization!");
  }

  // Add global listener for scenario load requests (ensure it's added only once)
  // Moved into initializeGame to ensure removal works correctly on reset

  console.log("DOM fully loaded and parsed. Initializing setup.");
});
