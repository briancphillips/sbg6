// Main entry point for the Sorry! game
import { initializeBoardPaths } from "./board.js";
import { initDrawing, drawGame } from "./drawing.js";
import { gameState, initializeGameState } from "./gameState.js";
import { initializeDeck } from "./cards.js";
import { initUI, updateUI } from "./ui.js";
import { debugSafetyEntries, diagnoseSafetyZones } from "./moves.js";
import { listScenarios } from "./scenarioManager.js";
import { aiTakeTurn } from "./ai.js"; // Import AI logic

// DOM Elements for setup
let gameSetupScreen;
let gameLayout;
let startGameButton;
let playerTypeSelectors = {};

// Initialize the game based on setup configuration
export function initializeGame(playerTypes = { 1: "ai", 2: "ai", 3: "ai" }) {
  // Default to AI for others
  console.log("Initializing game with player types:", playerTypes);

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

  // Initialize UI
  initUI({
    canvas: canvas,
    currentPlayerNameEl: document.getElementById("currentPlayerName"),
    currentPlayerColorEl: document.getElementById("currentPlayerColor"),
    cardDrawnEl: document.getElementById("cardDrawn"),
    messageAreaEl: document.getElementById("messageArea"),
    winMessageEl: document.getElementById("winMessage"),
    drawCardButton: document.getElementById("drawCardButton"),
    resetButton: document.getElementById("resetButton"),
  });

  // Remove old listeners if any (important for reset)
  window.removeEventListener("resetGame", handleResetGame);
  window.removeEventListener("nextTurn", handleNextTurn);

  // Set up event listeners for game events
  window.addEventListener("resetGame", handleResetGame);
  window.addEventListener("nextTurn", handleNextTurn);

  // Initial UI update and draw
  updateUI();
  drawGame();

  console.log("Game Initialized");
}

// Handle game reset event
function handleResetGame() {
  // Show setup screen, hide game layout
  if (gameSetupScreen) gameSetupScreen.classList.remove("hidden");
  if (gameLayout) gameLayout.classList.add("hidden");
  // Reset button visibility is handled in updateUI, but let's hide it explicitly
  const resetButton = document.getElementById("resetButton");
  if (resetButton) resetButton.classList.add("hidden");
  // At this point, the user needs to click "Start Game" again
  // No need to call initializeGame here directly
}

// Handle next turn
function handleNextTurn() {
  console.log(
    "handleNextTurn triggered. Current card:",
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
  updateUI();
  drawGame();

  // --- AI CONTROL HOOK ---
  if (currentPlayer.type === "ai") {
    console.log(
      `AI Player ${gameState.currentPlayerIndex} (${currentPlayer.details.name}) turn starting.`
    );
    // Disable input for human players during AI turn
    const drawButton = document.getElementById("drawCardButton");
    if (drawButton) drawButton.disabled = true;
    document.getElementById("sorryCanvas").classList.remove("clickable");

    // Call the AI logic after a delay
    setTimeout(() => aiTakeTurn(gameState.currentPlayerIndex), 500); // Short delay before AI "thinks"
  } else {
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
  // -------------------------------------
}

// Setup event listeners when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  gameSetupScreen = document.getElementById("gameSetupScreen");
  gameLayout = document.querySelector(".game-layout");
  startGameButton = document.getElementById("startGameButton");
  playerTypeSelectors = {
    1: document.querySelector('select[name="playerType2"]'), // Corresponds to player index 1 (Blue)
    2: document.querySelector('select[name="playerType3"]'), // Corresponds to player index 2 (Yellow)
    3: document.querySelector('select[name="playerType4"]'), // Corresponds to player index 3 (Green)
  };

  if (!gameSetupScreen || !gameLayout || !startGameButton) {
    console.error("Setup screen elements not found!");
    return;
  }

  // Show setup screen initially, hide game layout
  gameSetupScreen.classList.remove("hidden");
  gameLayout.classList.add("hidden");

  // Start Game button listener
  startGameButton.addEventListener("click", () => {
    // TODO: Add logic to read game mode (local/online)
    // For now, assume local

    const selectedPlayerTypes = {};
    for (const index in playerTypeSelectors) {
      if (playerTypeSelectors[index]) {
        selectedPlayerTypes[index] = playerTypeSelectors[index].value; // 'human' or 'ai'
      }
    }

    // Hide setup, show game
    gameSetupScreen.classList.add("hidden");
    gameLayout.classList.remove("hidden");

    // Initialize the game with selected types
    initializeGame(selectedPlayerTypes);
  });
});
