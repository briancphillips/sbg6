// Import constants
import {
  BOARD_LAYOUT,
  PLAYER_START_INFO,
  SQUARE_SIZE,
  PLAYERS,
  SLIDE_INFO,
  getPlayerCoords,
  PAWNS_PER_PLAYER,
} from "./constants.js";

// Board path and safety zones
export const BOARD_PATH = Array(60)
  .fill()
  .map((_, i) => {
    return {
      pixelX: 0,
      pixelY: 0,
      boardIndex: i,
    };
  });

export const SAFETY_ZONES = [
  Array(5)
    .fill()
    .map((_, i) => ({ pixelX: 0, pixelY: 0, safeIndex: i })), // Red (safety at index 2)
  Array(5)
    .fill()
    .map((_, i) => ({ pixelX: 0, pixelY: 0, safeIndex: i })), // Blue (safety at index 17)
  Array(5)
    .fill()
    .map((_, i) => ({ pixelX: 0, pixelY: 0, safeIndex: i })), // Yellow (safety at index 32)
  Array(5)
    .fill()
    .map((_, i) => ({ pixelX: 0, pixelY: 0, safeIndex: i })), // Green (safety at index 47)
];

// Game state
export const gameState = {
  players: [],
  deck: [],
  discardPile: [],
  currentPlayerIndex: 0,
  currentCard: null,
  selectedPawn: null,
  selectablePawns: [],
  validMoves: [],
  targetableOpponents: [],
  message: "",
  gameOver: false,
  currentAction: null,
  splitData: {
    firstPawn: null,
    firstMoveValue: 0,
    secondPawn: null,
  },
  splitMandatory: false,
};

// Game state utility functions
export function getPawnAtBoardIndex(boardIndex) {
  for (const player of gameState.players) {
    for (const pawn of player.pawns) {
      // Note: Position types can be 'start', 'board', 'entry', 'safe', or 'home'
      // Where 'entry' means the pawn is at the safety zone entrance (must enter on next turn)
      if (
        (pawn.positionType === "board" || pawn.positionType === "entry") &&
        pawn.positionIndex === boardIndex
      ) {
        return pawn;
      }
    }
  }
  return null;
}

export function getOwnPawnAtSafeZoneIndex(playerIndex, safeIndex) {
  if (safeIndex < 0 || safeIndex >= SAFETY_ZONES[playerIndex].length)
    return null;

  for (const pawn of gameState.players[playerIndex].pawns) {
    if (pawn.positionType === "safe" && pawn.positionIndex === safeIndex) {
      return pawn;
    }
  }

  return null;
}

export function isOccupiedByOwnPawnSafe(playerIndex, targetSafeIndex) {
  // Add debug logging to identify why safety zone movement is failing
  console.log(
    `Checking if safety zone position ${targetSafeIndex} is occupied for player ${playerIndex}`
  );

  const result =
    getOwnPawnAtSafeZoneIndex(playerIndex, targetSafeIndex) !== null;
  console.log(`  - Result: ${result ? "Occupied" : "Not occupied"}`);

  // Add additional logging to inspect each pawn's position
  console.log(`  - DEBUG: Player ${playerIndex} pawns positions:`);
  gameState.players[playerIndex].pawns.forEach((pawn) => {
    console.log(
      `    - Pawn ${pawn.id}: ${pawn.positionType} position ${pawn.positionIndex}`
    );
  });

  return result;
}

export function isOccupiedByOpponent(targetBoardIndex, currentPlayerIndex) {
  const pawn = getPawnAtBoardIndex(targetBoardIndex);
  return pawn !== null && pawn.playerIndex !== currentPlayerIndex;
}

export function isOccupiedByOwnPawnBoard(targetBoardIndex, playerIndex) {
  // Fix for incorrect parameter order - detect if first param is a number between 0-3 (player index)
  // and second param is a larger number (board index, typically 0-59)
  if (targetBoardIndex >= 0 && targetBoardIndex <= 3 && playerIndex > 3) {
    console.log(
      `WARNING: Parameters to isOccupiedByOwnPawnBoard appear to be in wrong order! Swapping.`
    );
    [targetBoardIndex, playerIndex] = [playerIndex, targetBoardIndex];
  }

  console.log(
    `OCCUPATION CHECK: Board position ${targetBoardIndex}, Player ${playerIndex}`
  );
  const pawn = getPawnAtBoardIndex(targetBoardIndex);
  console.log(
    `OCCUPATION RESULT: ${
      pawn
        ? `Found pawn belonging to player ${pawn.playerIndex}`
        : "No pawn found"
    }`
  );

  return pawn !== null && pawn.playerIndex === playerIndex;
}

export function sendPawnToStart(pawn) {
  if (!pawn) return;
  console.log(
    `Sending Player ${pawn.playerIndex} Pawn ${pawn.id} back to Start!`
  );
  pawn.positionType = "start";
  pawn.positionIndex = -1;
}

export function getOpponentPawnsOnBoard(currentPlayerIndex) {
  const opponents = [];
  gameState.players.forEach((player, index) => {
    if (index !== currentPlayerIndex) {
      player.pawns.forEach((pawn) => {
        if (pawn.positionType === "board" || pawn.positionType === "entry") {
          opponents.push(pawn);
        }
      });
    }
  });
  return opponents;
}

// Function to check if a pawn is on the main board track ('board' or 'entry')
export function isPawnOnBoard(pawn) {
  return (
    pawn && (pawn.positionType === "board" || pawn.positionType === "entry")
  );
}

// Function to check if a pawn is in its safety zone
export function isPawnInSafety(pawn) {
  return pawn && pawn.positionType === "safe";
}

// Function to check if a pawn is at Home
export function isPawnAtHome(pawn) {
  return pawn && pawn.positionType === "home";
}

// Function to check if a pawn is at Start
export function isPawnAtStart(pawn) {
  return pawn && pawn.positionType === "start";
}

// Function to check if a pawn is eligible for standard movement (on board or in safety)
export function isPawnMovable(pawn) {
  return pawn && (isPawnOnBoard(pawn) || isPawnInSafety(pawn));
}

export function getPlayerPawnsInStart(playerIndex) {
  // Now uses the helper function
  return gameState.players[playerIndex].pawns.filter(isPawnAtStart);
}

/**
 * Resets the turn-specific parts of the game state.
 * Should be called at the start of a new turn (local mode) or when receiving state from server.
 */
export function resetTurnState() {
  console.log("[StateReset] Clearing targetableOpponents in resetTurnState");
  gameState.selectedPawn = null;
  gameState.selectablePawns = [];
  gameState.validMoves = [];
  gameState.targetableOpponents = [];
  gameState.currentAction = null;
  gameState.splitData = {
    firstPawn: null,
    firstMoveValue: 0,
    secondPawn: null,
  };
  gameState.splitMandatory = false;
  // Don't reset message here, turn logic sets it.
}

export function initializeGameState(playerTypes = {}) {
  gameState.players = PLAYERS.map((playerDetails, index) => {
    const pawns = [];
    for (let i = 0; i < PAWNS_PER_PLAYER; i++) {
      pawns.push({
        id: i,
        playerIndex: index,
        positionType: "start",
        positionIndex: -1,
      });
    }
    // Player 0 (Red) is always human
    // Others use the provided type or default to 'ai' if not specified
    const type = index === 0 ? "human" : playerTypes[index] || "ai";

    return {
      index: index,
      details: playerDetails,
      pawns: pawns,
      type: type, // Use determined type
    };
  });

  gameState.currentPlayerIndex = 0;
  gameState.currentCard = null;
  gameState.selectedPawn = null;
  gameState.selectablePawns = [];
  gameState.validMoves = [];
  gameState.targetableOpponents = [];
  gameState.gameOver = false;
  gameState.currentAction = null;
  gameState.splitData = {
    firstPawn: null,
    firstMoveValue: 0,
    secondPawn: null,
  };
  gameState.splitMandatory = false;
  gameState.message = `${PLAYERS[0].name}'s turn. Draw a card.`;
}
