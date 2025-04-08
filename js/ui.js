// UI module for the Sorry! game
import {
  gameState,
  getOpponentPawnsOnBoard,
  getPlayerPawnsInStart,
} from "./gameState.js";
import { PLAYERS } from "./constants.js";
import { drawGame, isClickOnPawn, isClickOnSquare } from "./drawing.js";
import {
  getPossibleMovesForPawn,
  executeMove,
  executeSorry,
  executeSwap,
  checkForAnyValidAction,
} from "./moves.js";
import { drawCard, initializeDeck } from "./cards.js";
import { loadScenario, listScenarios } from "./scenarioManager.js";

// Element references
let canvas;
let currentPlayerNameEl;
let currentPlayerColorEl;
let cardDrawnEl;
let messageAreaEl;
let winMessageEl;
let drawCardButton;
let resetButton;

// Initialize UI elements
export function initUI(elements) {
  canvas = elements.canvas;
  currentPlayerNameEl = elements.currentPlayerNameEl;
  currentPlayerColorEl = elements.currentPlayerColorEl;
  cardDrawnEl = elements.cardDrawnEl;
  messageAreaEl = elements.messageAreaEl;
  winMessageEl = elements.winMessageEl;
  drawCardButton = elements.drawCardButton;
  resetButton = elements.resetButton;

  // Add event listeners
  drawCardButton.addEventListener("click", handleDrawCardButtonClick);
  resetButton.addEventListener("click", resetGame);
  canvas.addEventListener("click", handleCanvasClick);

  // Add Skip Turn button functionality (for debugging)
  const skipTurnButton = document.getElementById("skipTurnButton");
  if (skipTurnButton) {
    skipTurnButton.addEventListener("click", skipTurnAction);
  }

  // Initialize scenario manager UI
  initScenarioManagerUI();

  // Initial UI update
  updateUI();
}

// Initialize the scenario manager UI components
function initScenarioManagerUI() {
  // Get elements
  const toggleButton = document.getElementById("toggleScenarioPanel");
  const scenarioContent = document.getElementById("scenarioContent");
  const scenarioButtons = document.querySelectorAll(".scenario-btn");
  const playerSelect = document.getElementById("scenarioPlayer");

  if (!toggleButton || !scenarioContent) return;

  // Toggle scenario panel visibility
  toggleButton.addEventListener("click", () => {
    const isHidden = scenarioContent.classList.contains("hidden");

    if (isHidden) {
      scenarioContent.classList.remove("hidden");
      toggleButton.textContent = "Hide Test Scenarios";
    } else {
      scenarioContent.classList.add("hidden");
      toggleButton.textContent = "Show Test Scenarios";
    }
  });

  // Add click handlers for scenario buttons
  scenarioButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const scenarioName = button.getAttribute("data-scenario");
      const playerIndex = parseInt(playerSelect.value);

      if (scenarioName) {
        console.log(
          `Loading scenario: ${scenarioName} for player ${playerIndex}`
        );
        loadScenario(scenarioName, playerIndex);
      }
    });
  });

  // Log available scenarios to console for reference
  console.log("Scenario Manager initialized.");
  listScenarios();
}

// Update UI elements based on game state
export function updateUI() {
  // Update player indicator
  currentPlayerNameEl.textContent = PLAYERS[gameState.currentPlayerIndex].name;
  currentPlayerColorEl.style.backgroundColor =
    PLAYERS[gameState.currentPlayerIndex].color;

  // Update card display
  cardDrawnEl.textContent = gameState.currentCard
    ? gameState.currentCard.toString()
    : "-";

  // Update message
  messageAreaEl.textContent = gameState.message;

  // Update buttons
  const isHumanTurn =
    gameState.players[gameState.currentPlayerIndex]?.type === "human";
  drawCardButton.disabled =
    gameState.currentCard !== null || gameState.gameOver || !isHumanTurn;
  resetButton.classList.toggle("hidden", !gameState.gameOver);

  // Update canvas cursor
  if (
    gameState.currentCard &&
    !gameState.gameOver &&
    (gameState.selectablePawns.length > 0 ||
      gameState.validMoves.length > 0 ||
      gameState.targetableOpponents.length > 0)
  ) {
    canvas.classList.add("clickable");
  } else {
    canvas.classList.remove("clickable");
  }
}

// Handles the physical click of the Draw Card button by a human player
function handleDrawCardButtonClick() {
  if (gameState.currentCard !== null || gameState.gameOver) return;
  console.log("Draw Card button clicked by human.");
  performDrawCard(gameState.currentPlayerIndex);
}

// Performs the action of drawing a card and determining next steps
// Can be called by human UI or AI
export function performDrawCard(playerIndex) {
  if (gameState.currentCard !== null || gameState.gameOver) {
    console.log("Attempted to draw card when not allowed.");
    return false; // Indicate drawing was not performed
  }

  const cardDrawnSuccessfully = drawCard(); // drawCard now returns true/false

  if (cardDrawnSuccessfully) {
    console.log(
      `Player ${playerIndex} successfully drew: ${gameState.currentCard}`
    );
    determineActionsForCard(playerIndex, gameState.currentCard);
    updateUI(); // Update UI immediately after card draw
    drawGame();
    return true; // Indicate drawing was performed
  } else {
    console.log(`Player ${playerIndex} failed to draw a card (deck empty?).`);
    updateUI(); // Update message if deck was empty
    return false; // Indicate drawing was not performed
  }
}

// Determines the possible actions (selectable pawns, moves, etc.) based on the drawn card
function determineActionsForCard(playerIndex, card) {
  // Reset selection state
  gameState.selectedPawn = null;
  gameState.selectablePawns = [];
  gameState.targetableOpponents = [];
  gameState.validMoves = [];
  gameState.currentAction = null; // Reset current action
  gameState.splitData = {
    firstPawn: null,
    firstMoveValue: 0,
    secondPawn: null,
  }; // Reset split data

  const player = gameState.players[playerIndex];

  // Check card types and determine available actions
  if (card === "Sorry!") {
    const pawnsInStart = getPlayerPawnsInStart(playerIndex);
    const opponentsOnBoard = getOpponentPawnsOnBoard(playerIndex);

    if (pawnsInStart.length > 0 && opponentsOnBoard.length > 0) {
      gameState.selectablePawns = pawnsInStart;
      gameState.targetableOpponents = opponentsOnBoard;
      gameState.currentAction = "select-sorry-pawn";
      gameState.message = "Sorry! Select your pawn from Start.";
    } else {
      gameState.message = "Sorry! No valid targets."; // Set message if Sorry! has no effect
    }
  } else if (card === "11") {
    const pawnsOnBoardOrSafe = player.pawns.filter(
      (p) => p.positionType === "board" || p.positionType === "safe"
    );
    const opponentsOnBoard = getOpponentPawnsOnBoard(playerIndex);
    const canSwap =
      pawnsOnBoardOrSafe.some((p) => p.positionType === "board") &&
      opponentsOnBoard.length > 0;

    // Check pawns that can move 11 steps OR can participate in a swap
    player.pawns.forEach((pawn) => {
      const canMove11 = getPossibleMovesForPawn(pawn, "11").length > 0;
      const isSwappable = pawn.positionType === "board" && canSwap;
      if (canMove11 || isSwappable) {
        gameState.selectablePawns.push(pawn);
      }
    });

    if (gameState.selectablePawns.length > 0) {
      gameState.currentAction = "select-11-pawn";
      gameState.message = "Draw 11: Select pawn to move 11 or swap.";
      if (canSwap) gameState.targetableOpponents = opponentsOnBoard;
    } else {
      gameState.message = "Draw 11: No possible moves or swaps.";
    }
  } else if (card === "7") {
    // Allow selection of pawns on board or safe zone for splitting or moving
    player.pawns.forEach((pawn) => {
      if (
        (pawn.positionType === "board" || pawn.positionType === "safe") &&
        getPossibleMovesForPawn(pawn, "1").length > 0
      ) {
        // Check if pawn can move at all
        gameState.selectablePawns.push(pawn);
      }
    });

    if (gameState.selectablePawns.length > 0) {
      gameState.currentAction = "select-7-pawn1";
      gameState.message = "Draw 7: Select first pawn to move or split.";
    } else {
      gameState.message = "Draw 7: No pawns available to move.";
    }
  } else {
    // Handle standard numbered cards (1, 2, 3, 5, 8, 10, 12) and backward 4
    player.pawns.forEach((pawn) => {
      if (getPossibleMovesForPawn(pawn, card).length > 0) {
        gameState.selectablePawns.push(pawn);
      }
    });

    if (gameState.selectablePawns.length > 0) {
      gameState.currentAction = "select-pawn";
      gameState.message = `Draw ${card}: Select pawn to move.`;
    } else {
      gameState.message = `Draw ${card}: No possible moves.`; // Set specific message
    }
  }

  // Centralized check for turn skip: If after evaluating the card, no action is possible
  if (
    !gameState.currentAction &&
    gameState.selectablePawns.length === 0 &&
    gameState.targetableOpponents.length === 0
  ) {
    // Use the already set message (e.g., "Sorry! No valid targets.", "Draw 5: No possible moves.")
    console.log(
      `Player ${playerIndex} has no valid actions for card ${card}. Turn will be skipped.`
    );

    // Discard card and schedule next turn
    gameState.discardPile.push(gameState.currentCard);
    gameState.currentCard = null;

    // Use setTimeout to give player a chance to see the message
    setTimeout(() => {
      window.dispatchEvent(new Event("nextTurn"));
    }, 1500);
  } else {
    console.log(
      `Player ${playerIndex} has actions for card ${card}. Action: ${gameState.currentAction}, Selectable: ${gameState.selectablePawns.length}`
    );
    // If actions are available, UI update will enable interaction
  }

  // No return value needed, function modifies gameState directly
}

// --- Action Execution Functions (Refactored) ---

/**
 * Handles the selection of a pawn by a player (human or AI).
 * @param {number} playerIndex - Index of the player selecting.
 * @param {object} pawn - The pawn object being selected.
 * @returns {boolean} - True if selection was successful, false otherwise.
 */
export function performPawnSelection(playerIndex, pawn) {
  if (playerIndex !== gameState.currentPlayerIndex) {
    console.warn("Attempted pawn selection by non-current player.");
    return false;
  }
  if (!pawn || !gameState.selectablePawns.includes(pawn)) {
    console.log("Invalid pawn selection attempt.");
    gameState.message = "Please select one of the highlighted pawns.";
    updateUI();
    drawGame();
    return false;
  }

  console.log(`Player ${playerIndex} selected Pawn ${pawn.id}`);
  gameState.selectedPawn = pawn;
  gameState.selectablePawns = []; // Clear selectable pawns once one is chosen

  // Determine next state based on the original action that led here
  switch (gameState.currentAction) {
    case "select-pawn":
      gameState.validMoves = getPossibleMovesForPawn(
        pawn,
        gameState.currentCard
      );
      gameState.currentAction = "select-move";
      gameState.message = `Pawn ${pawn.id} selected. Click destination.`;
      break;
    case "select-sorry-pawn":
      // Targetable opponents should already be set
      gameState.currentAction = "select-sorry-target";
      gameState.message = "Select an opponent's pawn to bump.";
      break;
    case "select-11-pawn":
      gameState.validMoves = getPossibleMovesForPawn(pawn, "11");
      // Targetable opponents (for swap) should already be set
      gameState.currentAction = "select-11-action";
      gameState.message =
        "Move 11 (click green square) or Swap (click opponent)?";
      break;
    case "select-7-pawn1":
      gameState.validMoves = getPossibleMovesForPawn(pawn, "7"); // Get all potential moves for 7
      gameState.splitData.firstPawn = pawn;
      gameState.splitData.firstMoveValue = 0;
      gameState.splitData.secondPawn = null;
      gameState.currentAction = "select-7-move1";
      gameState.message = "Select destination for 7 spaces, or split (1-6).";
      break;
    case "select-7-pawn2":
      gameState.splitData.secondPawn = pawn;
      const remainingSteps = 7 - gameState.splitData.firstMoveValue;
      gameState.validMoves = getPossibleMovesForPawn(
        pawn,
        remainingSteps.toString()
      );
      gameState.currentAction = "select-7-move2";
      gameState.message = `Select destination for the remaining ${remainingSteps} steps.`;
      break;
    default:
      console.error(
        "performPawnSelection called from unexpected state:",
        gameState.currentAction
      );
      return false;
  }

  updateUI();
  drawGame();
  return true;
}

/**
 * Handles the selection of a move destination by a player (human or AI).
 * @param {number} playerIndex - Index of the player selecting.
 * @param {object} move - The move object being selected.
 * @returns {boolean} - True if move execution was initiated, false otherwise.
 */
export function performMoveSelection(playerIndex, move) {
  if (playerIndex !== gameState.currentPlayerIndex) {
    console.warn("Attempted move selection by non-current player.");
    return false;
  }
  if (
    !move ||
    !gameState.validMoves.includes(move) ||
    !gameState.selectedPawn
  ) {
    console.log("Invalid move selection attempt.");
    gameState.message = "Please click a valid green destination square.";
    updateUI();
    drawGame();
    return false;
  }

  console.log(`Player ${playerIndex} selected move to:`, move);

  // Execute based on the action state that required move selection
  switch (gameState.currentAction) {
    case "select-move":
      executeMove(gameState.selectedPawn, move, true); // Standard move, end turn
      break;
    case "select-11-action": // Moving 11, not swapping
      executeMove(gameState.selectedPawn, move, true); // 11 move ends turn
      break;
    case "select-7-move1":
      const steps = move.steps || 7; // Get steps used (1-6 for split, 7 for full move)
      gameState.splitData.firstMoveValue = steps;

      // Execute the first part, end turn only if using full 7
      executeMove(gameState.selectedPawn, move, steps === 7);

      // --- Add state transition logic for split ---
      if (steps < 7) {
        const remainingSteps = 7 - steps;
        console.log(
          `Split 7: Part 1 used ${steps} steps. Need pawn for remaining ${remainingSteps}.`
        );

        gameState.selectablePawns = [];
        gameState.players[playerIndex].pawns.forEach((p) => {
          // Find pawns (not the one just moved) that can move remaining steps
          if (
            p !== gameState.splitData.firstPawn &&
            (p.positionType === "board" || p.positionType === "safe") && // Can only move pawns not in start/home
            getPossibleMovesForPawn(p, remainingSteps.toString()).length > 0
          ) {
            gameState.selectablePawns.push(p);
          }
        });

        if (gameState.selectablePawns.length > 0) {
          gameState.message = `Select pawn for remaining ${remainingSteps} steps.`;
          gameState.currentAction = "select-7-pawn2";
          gameState.selectedPawn = null; // Clear selected pawn for next choice
          gameState.validMoves = []; // Clear moves from first part
          updateUI(); // Update UI to reflect new state
          drawGame(); // Redraw highlights
        } else {
          // No pawn can move the remaining steps, end the turn
          gameState.message = `No valid moves for remaining ${remainingSteps} steps. Turn ended.`;
          console.log(
            "No valid moves for second part of split 7. Ending turn."
          );
          // Reset state and trigger next turn event
          gameState.currentAction = null;
          gameState.selectedPawn = null;
          gameState.validMoves = [];
          gameState.selectablePawns = [];
          gameState.splitData = {
            firstPawn: null,
            firstMoveValue: 0,
            secondPawn: null,
          };
          updateUI();
          drawGame();
          // Use timeout to allow message display before turn change
          setTimeout(() => window.dispatchEvent(new Event("nextTurn")), 1500);
        }
      } // else (steps === 7), executeMove already handled turn end
      // ---------------------------------------------
      break;
    case "select-7-move2":
      // End turn after the second part of a split 7
      executeMove(gameState.selectedPawn, move, true);
      break;
    default:
      console.error(
        "performMoveSelection called from unexpected state:",
        gameState.currentAction
      );
      return false;
  }

  // Return true assuming the action was at least initiated
  // Actual turn end is handled by executeMove or the logic above for split 7 failure
  return true;
}

// TODO: Refactor Sorry! target selection and Swap target selection into similar
// performSorryTargetSelection and performSwapTargetSelection functions.

// Handle canvas clicks (Updated to use refactored functions)
export function handleCanvasClick(event) {
  if (!gameState.currentCard || gameState.gameOver) return;

  // Get mouse position relative to canvas
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  console.log(`Canvas click: (${mouseX}, ${mouseY})`);

  // Find what was clicked
  let clickedPawn = null;
  let clickedMove = null;

  // Check if a pawn was clicked
  for (const player of gameState.players) {
    for (const pawn of player.pawns) {
      if (isClickOnPawn(mouseX, mouseY, pawn)) {
        clickedPawn = pawn;
        break;
      }
    }
    if (clickedPawn) break;
  }

  // Check if a valid move space was clicked
  for (const move of gameState.validMoves) {
    if (isClickOnSquare(mouseX, mouseY, move.pixelX, move.pixelY)) {
      clickedMove = move;
      break;
    }
  }

  // Log what was clicked
  console.log(
    `Click Action: ${gameState.currentAction} Clicked Pawn: ${
      clickedPawn ? clickedPawn.id : "null"
    } Clicked Move: ${clickedMove ? "yes" : "null"}`
  );

  // Add debug info for safety zone movement
  if (clickedPawn && clickedPawn.positionType === "safe") {
    console.log(
      `=== SAFETY ZONE DEBUG: Clicked on pawn ${clickedPawn.id} at safety position ${clickedPawn.positionIndex} ===`
    );
    // Display in message area for visibility
    const originalMessage = gameState.message;
    gameState.message = `🔍 DEBUG: Safety zone pawn at position ${clickedPawn.positionIndex}`;
    setTimeout(() => {
      gameState.message = originalMessage;
      updateUI();
    }, 1500);
  }

  // Handle null currentAction - restore proper state
  if (gameState.currentAction === null && gameState.currentCard) {
    // Re-initialize action state based on current card
    determineActionsForCard(
      gameState.currentPlayerIndex,
      gameState.currentCard
    );

    // Update UI and redraw
    drawGame();
    updateUI();
    return;
  }

  const playerIndex = gameState.currentPlayerIndex;

  // Handle clicks based on current action
  switch (gameState.currentAction) {
    case "select-pawn":
    case "select-sorry-pawn":
    case "select-11-pawn":
    case "select-7-pawn1":
    case "select-7-pawn2":
      if (clickedPawn) {
        performPawnSelection(playerIndex, clickedPawn);
      } else {
        gameState.message = "Please click one of your highlighted pawns.";
        updateUI(); // Update message
      }
      break;

    case "select-move":
    case "select-11-action": // This state handles both move and swap clicks
    case "select-7-move1":
    case "select-7-move2":
      if (clickedMove) {
        performMoveSelection(playerIndex, clickedMove);
      } else if (
        gameState.currentAction === "select-11-action" &&
        clickedPawn &&
        gameState.targetableOpponents.includes(clickedPawn)
      ) {
        // Special case: 11 swap target clicked
        executeSwap(gameState.selectedPawn, clickedPawn);
      } else if (
        clickedPawn === gameState.selectedPawn &&
        gameState.currentAction === "select-move"
      ) {
        // Deselect pawn only in standard move selection
        gameState.message = "Pawn deselected. Select a pawn.";
        gameState.selectedPawn = null;
        gameState.validMoves = [];
        determineActionsForCard(playerIndex, gameState.currentCard); // Reset to pawn selection state
        drawGame();
        updateUI();
      } else {
        // Provide appropriate message based on state
        if (gameState.currentAction === "select-11-action") {
          gameState.message =
            "Click a green square (move 11) or a highlighted opponent (swap).";
        } else {
          gameState.message = "Click a valid green destination square.";
        }
        updateUI(); // Update message
      }
      break;

    // --- Cases needing refactoring into perform...Selection ---
    case "select-sorry-target":
      if (clickedPawn && gameState.targetableOpponents.includes(clickedPawn)) {
        // TODO: Refactor into performSorryTargetSelection(playerIndex, clickedPawn)
        executeSorry(gameState.selectedPawn, clickedPawn);
      } else {
        gameState.message = "Select a highlighted opponent's pawn.";
        updateUI();
      }
      break;

    // Note: select-11-action handles swap target click directly above for now.
    //       Could create performSwapTargetSelection later.

    default:
      console.error(
        "Unknown action state in handleCanvasClick:",
        gameState.currentAction
      );
  }

  // No need for final drawGame/updateUI here as they are called within the perform... functions or execute... functions.
}

// Reset the game
export function resetGame() {
  // Dispatch event for main.js to handle screen switching
  window.dispatchEvent(new Event("resetGame"));
}

// Skip the current turn (for debugging)
export function skipTurnAction() {
  // Skip the current turn regardless of state
  console.log("DEBUG: Manually skipping turn");

  // Clear current card and move to next turn
  if (gameState.currentCard) {
    gameState.discardPile.push(gameState.currentCard);
  }

  // Reset game state for next turn
  gameState.currentCard = null;
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

  // Add debug message
  gameState.message = "DEBUG: Turn skipped manually";

  // Update UI
  updateUI();
  drawGame();

  // Trigger next turn
  setTimeout(() => {
    window.dispatchEvent(new Event("nextTurn"));
  }, 500);
}
