// Scenario Manager for Sorry! Game Testing
import { gameState, BOARD_PATH, SAFETY_ZONES } from "./gameState.js";
import { PLAYERS, PLAYER_START_INFO } from "./constants.js";
import { drawGame } from "./drawing.js";
import { updateUI } from "./ui.js";

// Collection of predefined scenarios
const SCENARIOS = {
  // Scenario 1: Test pawn collision at safety entry
  safetyEntryCollision: {
    description: "Two pawns of the same color at safety entry point",
    setupState: (playerIndex = 2) => {
      // Yellow by default
      // Set current player
      gameState.currentPlayerIndex = playerIndex;
      gameState.message = `Scenario: ${SCENARIOS.safetyEntryCollision.description}`;

      // Clear default pawn positions set by initializeGame
      clearAllPawnPositions();

      // Place one pawn at the safety entry position
      const entryIndex = PLAYER_START_INFO[playerIndex].safetyEntryIndex;
      const player = gameState.players[playerIndex];

      // First pawn at the entry point
      player.pawns[0].positionType = "entry";
      player.pawns[0].positionIndex = entryIndex;

      // Second pawn one position before
      player.pawns[1].positionType = "board";
      player.pawns[1].positionIndex =
        (entryIndex - 1 + BOARD_PATH.length) % BOARD_PATH.length;

      // Force specific card
      gameState.currentCard = "1";

      console.log(
        `Scenario State Applied: ${SCENARIOS.safetyEntryCollision.description}`
      );
      console.log(
        `Player ${playerIndex} (${PLAYERS[playerIndex].name}) with two pawns near safety entry at ${entryIndex}`
      );
    },
  },

  // Scenario 2: Test safety zone movement and occupation checks
  safetyZoneOccupation: {
    description: "Test safety zone occupation validation",
    setupState: (playerIndex = 0) => {
      // Red by default
      // Set current player
      gameState.currentPlayerIndex = playerIndex;
      gameState.message = `Scenario: ${SCENARIOS.safetyZoneOccupation.description}`;

      // Clear default pawn positions set by initializeGame
      clearAllPawnPositions();

      // Place pawns in the safety zone at different positions
      const player = gameState.players[playerIndex];

      // First pawn at safety position 0
      player.pawns[0].positionType = "safe";
      player.pawns[0].positionIndex = 0;

      // Second pawn at safety position 2
      player.pawns[1].positionType = "safe";
      player.pawns[1].positionIndex = 2;

      // Third pawn at board position one step before safety entry
      const entryIndex = PLAYER_START_INFO[playerIndex].safetyEntryIndex;
      player.pawns[2].positionType = "board";
      player.pawns[2].positionIndex =
        (entryIndex - 1 + BOARD_PATH.length) % BOARD_PATH.length;

      // Force specific card
      gameState.currentCard = "2";

      console.log(
        `Scenario State Applied: ${SCENARIOS.safetyZoneOccupation.description}`
      );
      console.log(
        `Player ${playerIndex} (${PLAYERS[playerIndex].name}) with pawns in safety zone`
      );
    },
  },

  // Scenario 3: Test slides and bumping
  slideAndBump: {
    description: "Test slide mechanics and bumping",
    setupState: (playerIndex = 0) => {
      // Red by default
      // Set current player
      gameState.currentPlayerIndex = playerIndex;
      gameState.message = `Scenario: ${SCENARIOS.slideAndBump.description}`;

      // Clear default pawn positions set by initializeGame
      clearAllPawnPositions();

      // Place pawn at the position before a slide
      const slidePosition = 7; // Near red's first slide
      const player = gameState.players[playerIndex];

      // Place the current player's pawn before the slide
      player.pawns[0].positionType = "board";
      player.pawns[0].positionIndex = slidePosition;

      // Place opponent pawns on the slide path
      // Find opponent pawns (not from the current player)
      let opponentIndex = (playerIndex + 1) % 4;
      let opponent = gameState.players[opponentIndex];

      // Opponent pawn in the middle of the slide path
      opponent.pawns[0].positionType = "board";
      opponent.pawns[0].positionIndex = slidePosition + 2;

      // Opponent pawn at the end of the slide
      opponent = gameState.players[(playerIndex + 2) % 4];
      opponent.pawns[0].positionType = "board";
      opponent.pawns[0].positionIndex = slidePosition + 5;

      // Force specific card
      gameState.currentCard = "1";

      console.log(
        `Scenario State Applied: ${SCENARIOS.slideAndBump.description}`
      );
      console.log(
        `Player ${playerIndex} (${PLAYERS[playerIndex].name}) before slide at position ${slidePosition}`
      );
    },
  },

  // Scenario 4: Test card 7 splitting
  splitCard7: {
    description: "Test card 7 splitting mechanics",
    setupState: (playerIndex = 0) => {
      // Red by default
      // Set current player
      gameState.currentPlayerIndex = playerIndex;
      gameState.message = `Scenario: ${SCENARIOS.splitCard7.description}`;

      // Clear default pawn positions set by initializeGame
      clearAllPawnPositions();

      const player = gameState.players[playerIndex];

      // Place two pawns on the board at different positions
      player.pawns[0].positionType = "board";
      player.pawns[0].positionIndex = 10;

      player.pawns[1].positionType = "board";
      player.pawns[1].positionIndex = 20;

      // Force card 7
      gameState.currentCard = "7";

      console.log(
        `Scenario State Applied: ${SCENARIOS.splitCard7.description}`
      );
      console.log(
        `Player ${playerIndex} (${PLAYERS[playerIndex].name}) with two pawns at positions 10 and 20`
      );
    },
  },

  // Scenario 5: Custom scenario (fully customizable)
  custom: {
    description: "Custom scenario - fully configurable",
    setupState: (config) => {
      if (!config) {
        console.error("Custom scenario requires a configuration object");
        return;
      }

      // Clear default pawn positions set by initializeGame
      clearAllPawnPositions();

      // Set current player if specified
      if (config.currentPlayer !== undefined) {
        gameState.currentPlayerIndex = config.currentPlayer;
      }

      // Set custom message
      gameState.message = config.message || "Custom scenario";

      // Set pawn positions if provided
      if (config.pawns && Array.isArray(config.pawns)) {
        config.pawns.forEach((pawnSetup) => {
          if (
            pawnSetup.playerIndex >= 0 &&
            pawnSetup.playerIndex < 4 &&
            pawnSetup.pawnId >= 0 &&
            pawnSetup.pawnId < 4
          ) {
            const pawn =
              gameState.players[pawnSetup.playerIndex].pawns[pawnSetup.pawnId];
            pawn.positionType = pawnSetup.positionType || "start";
            pawn.positionIndex =
              pawnSetup.positionIndex !== undefined
                ? pawnSetup.positionIndex
                : -1;
          }
        });
      }

      // Set current card if specified
      if (config.card) {
        gameState.currentCard = config.card;
      }

      console.log("Custom Scenario State Applied");
    },
  },
};

// Helper function to put all pawns back in start
function clearAllPawnPositions() {
  if (!gameState.players) return;
  gameState.players.forEach((player) => {
    if (player && player.pawns) {
      player.pawns.forEach((pawn) => {
        pawn.positionType = "start";
        pawn.positionIndex = -1;
      });
    }
  });
}

// Helper function to refresh the display
function refresh() {
  // Pass mode explicitly - scenarios only run locally
  updateUI("local");
  drawGame();
}

// Renamed: Sets the state for a specific scenario *after* base initialization
export function loadScenarioState(scenarioName, playerIndexOrConfig) {
  const scenario = SCENARIOS[scenarioName];
  if (!scenario || !scenario.setupState) {
    console.error(`Unknown or invalid scenario setup: ${scenarioName}`);
    return false;
  }

  try {
    scenario.setupState(playerIndexOrConfig);
    return true; // Indicate success
  } catch (e) {
    console.error(`Error setting up scenario state for ${scenarioName}:`, e);
    return false; // Indicate failure
  }
}

// Main function to load a scenario - NO LONGER USED DIRECTLY BY UI
// Kept for potential future use or direct console calls?
// Or remove if fully handled by main.js event listener
/*
export function loadScenario(scenarioName, playerIndexOrConfig) {
    // ... (previous complex logic involving initializeGame, determineActions, refresh)
    // This logic is now intended to live in the main.js event listener
}
*/

// Export function to list available scenarios
export function listScenarios() {
  console.log("Available Test Scenarios:");

  Object.entries(SCENARIOS).forEach(([name, scenario]) => {
    console.log(`- ${name}: ${scenario.description}`);
  });
}
