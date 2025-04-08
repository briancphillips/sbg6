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
import {
  requestDrawCard,
  requestSelectPawn,
  requestMoveSelection,
  requestSorry,
  requestSwap,
  emitAction,
} from "./network.js"; // Import network request functions

// Element references
let canvas;
let currentPlayerNameEl;
let currentPlayerColorEl;
let cardDrawnEl;
let messageAreaEl;
let winMessageEl;
let drawCardButton;
let resetButton;
let connectionStatusEl; // Added for online mode
let playerListContainerEl; // Added for online mode
let playerListEl; // Added for online mode

// UI State
let currentGameMode = "local"; // Track current game mode ('local' or 'online')
let localPlayerIndex = -1; // Track the index assigned to the local player in online mode

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
  // Store refs to online elements
  connectionStatusEl = elements.connectionStatusEl;
  playerListContainerEl = elements.playerListContainerEl;
  playerListEl = elements.playerListEl;

  // Add event listeners
  drawCardButton.addEventListener("click", handleDrawCardButtonClick);
  resetButton.addEventListener("click", resetGame);
  canvas.addEventListener("click", handleCanvasClick);

  // Add Skip Turn button functionality (for debugging)
  const skipTurnButton = document.getElementById("skipTurnButton");
  if (skipTurnButton) {
    skipTurnButton.addEventListener("click", skipTurnAction);
  }

  // Listen for player assignment from network module
  window.removeEventListener("assignPlayer", handleAssignPlayer);
  window.addEventListener("assignPlayer", handleAssignPlayer);
  // Listen for game state updates to redraw/update UI
  window.removeEventListener("gameStateUpdate", handleGameStateUpdate);
  window.addEventListener("gameStateUpdate", handleGameStateUpdate);
  // Listen for room updates to update player list
  window.removeEventListener("roomUpdate", handleRoomUpdate);
  window.addEventListener("roomUpdate", handleRoomUpdate);
  // Listen for turn start signals
  window.removeEventListener("turnStart", handleTurnStart);
  window.addEventListener("turnStart", handleTurnStart);
  // Listen for server messages
  window.removeEventListener("serverMessage", handleServerMessage);
  window.addEventListener("serverMessage", handleServerMessage);
  // Listen for server errors
  window.removeEventListener("serverError", handleServerError);
  window.addEventListener("serverError", handleServerError);
  // Listen for game over signals
  window.removeEventListener("gameOverUpdate", handleGameOverUpdate);
  window.addEventListener("gameOverUpdate", handleGameOverUpdate);

  // Initialize scenario manager UI
  initScenarioManagerUI();

  // Initial UI update
  updateUI(); // Initial update assumes local mode
}

// --- Event Handlers for Network Events ---
function handleAssignPlayer(event) {
  localPlayerIndex = event.detail.index;
  console.log(`UI received player index assignment: ${localPlayerIndex}`);
  updateUI(); // Update UI now that we know the player index
}

function handleGameStateUpdate(event) {
  console.log("UI received gameStateUpdate event");
  // Game state is already updated by network.js
  updateUI();
  drawGame();
}

function handleRoomUpdate(event) {
  console.log("UI received roomUpdate event");
  // Update player list based on new room data
  // Assuming roomData.players exists
  if (event.detail && event.detail.players) {
    updatePlayerList(event.detail.players);
  }
}

function handleTurnStart(event) {
  console.log("UI received turnStart event");
  // Server signals it's our turn. Game state should be up-to-date via gameStateUpdate.
  // Ensure UI reflects it's our turn to act.
  gameState.message = "Your turn! " + gameState.message; // Prepend to existing message
  updateUI(); // Update buttons/canvas based on current state
  // Play a sound?
}

function handleServerMessage(event) {
  console.log("UI received serverMessage:", event.detail);
  // Display general messages from the server
  // Avoid overwriting critical game state messages if possible
  // Maybe have a separate area for server messages?
  messageAreaEl.textContent = event.detail; // Simple overwrite for now
  // Optionally, fade out after a few seconds?
}

function handleServerError(event) {
  console.error("UI received serverError:", event.detail);
  // Display error messages prominently
  messageAreaEl.textContent = `Error: ${event.detail}`;
  messageAreaEl.style.color = "red"; // Make errors stand out
  // Consider disabling input briefly?
}

function handleGameOverUpdate(event) {
  console.log("UI received gameOverUpdate:", event.detail);
  // Game state gameOver flag is set by network.js
  // Update win message based on server data
  const { winnerName } = event.detail;
  winMessageEl.textContent = winnerName ? `${winnerName} wins!` : "Game Over!";
  updateUI(); // Ensure reset button appears etc.
}

// ---------------------------------------

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

      if (scenarioName && currentGameMode === "local") {
        // Only allow in local mode
        console.log(
          `Loading scenario: ${scenarioName} for player ${playerIndex}`
        );
        loadScenario(scenarioName, playerIndex);
      } else if (currentGameMode !== "local") {
        console.warn("Scenarios can only be loaded in Local Game mode.");
      }
    });
  });

  // Log available scenarios to console for reference
  console.log("Scenario Manager initialized.");
  listScenarios();
}

/**
 * Update UI elements based on game state, mode, and local player index.
 * @param {string} [mode=currentGameMode] - The current game mode ('local' or 'online').
 * @param {number} [localIdx=localPlayerIndex] - The index of the local player (defaults to module state).
 */
export function updateUI(mode = currentGameMode, localIdx = localPlayerIndex) {
  currentGameMode = mode; // Update internal mode tracker

  // Reset temporary error styling
  messageAreaEl.style.color = "";

  // Update player indicator
  if (
    gameState.players &&
    gameState.players.length > gameState.currentPlayerIndex &&
    gameState.currentPlayerIndex >= 0
  ) {
    const player = gameState.players[gameState.currentPlayerIndex];
    currentPlayerNameEl.textContent = player.details.name;
    currentPlayerColorEl.style.backgroundColor = player.details.color;
  } else {
    // Handle cases where players might not be initialized yet or index is invalid
    currentPlayerNameEl.textContent = "-";
    currentPlayerColorEl.style.backgroundColor = "transparent";
  }

  // Update card display
  cardDrawnEl.textContent = gameState.currentCard
    ? gameState.currentCard.toString()
    : "-";

  // Update message (unless it was just set by an error/server message)
  if (messageAreaEl.style.color !== "red") {
    // Avoid overwriting error messages immediately
    messageAreaEl.textContent = gameState.message;
  }

  // Update buttons
  let canDraw = false;
  let canInteract = false;
  const isMyTurn = gameState.currentPlayerIndex === localIdx;

  if (currentGameMode === "local") {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    canDraw =
      currentPlayer?.type === "human" &&
      gameState.currentCard === null &&
      !gameState.gameOver;
    canInteract =
      currentPlayer?.type === "human" &&
      gameState.currentCard !== null &&
      !gameState.gameOver;
  } else {
    // Online mode
    // Can only draw/interact if it's your turn
    canDraw = isMyTurn && gameState.currentCard === null && !gameState.gameOver;
    canInteract =
      isMyTurn && gameState.currentCard !== null && !gameState.gameOver;
  }

  drawCardButton.disabled = !canDraw;
  resetButton.classList.toggle("hidden", !gameState.gameOver);

  // Update canvas cursor based on interaction possibility
  if (
    canInteract &&
    (gameState.selectablePawns.length > 0 ||
      gameState.validMoves.length > 0 ||
      gameState.targetableOpponents.length > 0)
  ) {
    canvas.classList.add("clickable");
  } else {
    canvas.classList.remove("clickable");
  }

  // Update Online-specific UI elements
  if (connectionStatusEl) {
    // Status text is updated directly by main.js network handler for now
  }
  if (playerListContainerEl) {
    playerListContainerEl.classList.toggle(
      "hidden",
      currentGameMode !== "online"
    );
    if (currentGameMode === "online") {
      updatePlayerList(gameState.players); // Update based on current gameState players
    }
  }

  // Update win message
  // This is now handled by handleGameOverUpdate based on server message
  if (!gameState.gameOver) {
    winMessageEl.textContent = "";
  } else if (!winMessageEl.textContent) {
    // If game is over but message not set by network event yet, provide fallback
    const winnerIndex = gameState.players.findIndex((p) =>
      p.pawns.every((pawn) => pawn.positionType === "home")
    );
    winMessageEl.textContent =
      winnerIndex !== -1 ? `${PLAYERS[winnerIndex].name} wins!` : "Game Over!";
  }
}

// Updates the player list display for online mode
function updatePlayerList(players) {
  if (!playerListEl) return;

  playerListEl.innerHTML = ""; // Clear existing list

  if (players && players.length > 0) {
    players.forEach((player, index) => {
      const li = document.createElement("li");
      // Use player.details if available, fallback for robustness
      const color = player.details ? player.details.color : "#888";
      const name = player.details ? player.details.name : `Player ${index + 1}`;
      const type =
        player.type || (index === localPlayerIndex ? "human" : "remote"); // Infer type

      li.style.color = color;
      // Use player.name from server if provided, else fallback
      li.textContent = `${player.name || name} (${type})`;
      if (index === localPlayerIndex) {
        li.textContent += " (You)";
        li.style.fontWeight = "bold";
      }
      if (index === gameState.currentPlayerIndex) {
        li.textContent += " *"; // Indicate current turn
        li.style.fontStyle = "italic";
      }
      playerListEl.appendChild(li);
    });
  } else {
    playerListEl.innerHTML = "<li>Waiting for players...</li>";
  }
}

// Handles the physical click of the Draw Card button by a human player
function handleDrawCardButtonClick() {
  if (gameState.currentCard !== null || gameState.gameOver) return;

  if (currentGameMode === "online") {
    // Check if it's actually our turn (belt and braces)
    if (gameState.currentPlayerIndex === localPlayerIndex) {
      console.log("Requesting draw card from server...");
      requestDrawCard();
      // Disable button immediately to prevent double clicks, UI update will confirm
      drawCardButton.disabled = true;
    } else {
      console.warn("Draw card clicked, but it's not your turn!");
    }
  } else {
    // Local mode: Perform draw directly
    console.log("Draw Card button clicked by human (Local).");
    performDrawCard(gameState.currentPlayerIndex);
  }
}

// Performs the action of drawing a card and determining next steps (Local Mode)
// Can be called by human UI or AI in local mode
export function performDrawCard(playerIndex) {
  if (currentGameMode !== "local") {
    console.error("performDrawCard called in non-local mode!");
    return false;
  }
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
// This function should remain mostly the same, as it populates gameState for UI feedback
// It is called locally after drawing in local mode, or potentially by server updates in online mode?
// For now, assume it's only called locally.
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

  // Check if playerIndex is valid
  if (
    !gameState.players ||
    playerIndex < 0 ||
    playerIndex >= gameState.players.length
  ) {
    console.error(
      `Invalid playerIndex ${playerIndex} in determineActionsForCard`
    );
    return;
  }

  const player = gameState.players[playerIndex];
  if (!player) {
    console.error(`Player object not found for index ${playerIndex}`);
    return;
  }

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
      if (!checkForAnyValidAction(playerIndex, card)) {
        triggerLocalTurnSkip(playerIndex);
      }
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
      // Need to provide targets for potential swap later
      if (canSwap) gameState.targetableOpponents = opponentsOnBoard;
    } else {
      gameState.message = "Draw 11: No possible moves or swaps.";
      if (!checkForAnyValidAction(playerIndex, card)) {
        triggerLocalTurnSkip(playerIndex);
      }
    }
  } else if (card === "7") {
    // Allow selection of pawns on board or safe zone for splitting or moving
    player.pawns.forEach((pawn) => {
      // Must check if pawn can move *at all* with a value from 1 to 7
      let canMoveSevenSplit = false;
      for (let i = 1; i <= 7; i++) {
        if (getPossibleMovesForPawn(pawn, i.toString()).length > 0) {
          canMoveSevenSplit = true;
          break;
        }
      }
      if (
        (pawn.positionType === "board" || pawn.positionType === "safe") &&
        canMoveSevenSplit
      ) {
        gameState.selectablePawns.push(pawn);
      }
    });

    if (gameState.selectablePawns.length > 0) {
      gameState.currentAction = "select-7-pawn1";
      gameState.message = "Draw 7: Select first pawn to move or split.";
    } else {
      gameState.message = "Draw 7: No pawns available to move.";
      if (!checkForAnyValidAction(playerIndex, card)) {
        triggerLocalTurnSkip(playerIndex);
      }
    }
  } else {
    // Handle standard numbered cards (1, 2, 3, 4, 5, 8, 10, 12)
    player.pawns.forEach((pawn) => {
      if (getPossibleMovesForPawn(pawn, card).length > 0) {
        gameState.selectablePawns.push(pawn);
      }
    });

    if (gameState.selectablePawns.length > 0) {
      gameState.currentAction = "select-pawn";
      gameState.message = `Draw ${card}: Select a pawn to move.`;
    } else {
      gameState.message = `Draw ${card}: No possible moves.`;
      if (!checkForAnyValidAction(playerIndex, card)) {
        triggerLocalTurnSkip(playerIndex);
      }
    }
  }

  // Update UI after determining actions
  updateUI();
  drawGame();
}

// Renamed function: Helper to trigger local turn skip after delay
function triggerLocalTurnSkip(playerIndex) {
  if (gameState.currentAction === null) {
    if (currentGameMode === "local") {
      console.log(
        `Player ${playerIndex} has no valid moves after drawing. Skipping turn.`
      );
      setTimeout(() => {
        if (
          gameState.currentPlayerIndex === playerIndex &&
          !gameState.gameOver
        ) {
          window.dispatchEvent(new Event("nextTurn"));
        }
      }, 1200);
    } else if (currentGameMode === "online") {
      console.log(
        `Player ${playerIndex} has no valid moves after drawing (Online). Waiting for server.`
      );
    }
  }
}

// --- Functions for processing UI clicks on pawns/squares ---
// These functions update the local gameState to reflect selection/highlighting in local mode
// but trigger network requests instead of direct execution in online mode.

// Handles the local update of gameState after a pawn is selected (Local Mode Only)
// Exported so AI can call it directly.
export function executeLocalPawnSelection(playerIndex, pawn) {
  console.log(`Local Pawn Selection: Player ${playerIndex}, Pawn ${pawn.id}`);
  gameState.selectedPawn = pawn;
  const card = gameState.currentCard;

  // Reset moves/targets before recalculating
  gameState.validMoves = [];
  gameState.targetableOpponents = getOpponentPawnsOnBoard(playerIndex); // Needed for 11/Sorry

  // Determine next state based on the current action state
  switch (gameState.currentAction) {
    case "select-pawn": // Standard cards (1, 2, 3, 4, 5, 8, 10, 12)
      gameState.validMoves = getPossibleMovesForPawn(pawn, card);
      gameState.currentAction = "select-move";
      gameState.message = `Selected Pawn ${pawn.id}. Choose a move.`;
      break;
    case "select-sorry-pawn": // Pawn from start selected
      // Targets (opponents on board) were already determined
      gameState.currentAction = "select-sorry-target";
      gameState.message = `Selected Pawn ${pawn.id}. Choose opponent pawn to bump.`;
      break;
    case "select-11-pawn": // Pawn selected for card 11
      // Calculate specific valid moves for THIS pawn.
      gameState.validMoves = getPossibleMovesForPawn(pawn, "11");
      // Check if swap is possible *with this specific pawn* (must be on board)
      const canSwapThisPawn =
        pawn.positionType === "board" &&
        gameState.targetableOpponents.length > 0;

      if (gameState.validMoves.length > 0 && canSwapThisPawn) {
        gameState.currentAction = "select-11-action"; // Player must choose move OR swap target
        gameState.message = `Selected Pawn ${pawn.id}. Choose move or opponent to swap.`;
      } else if (gameState.validMoves.length > 0) {
        // Only move is possible
        gameState.currentAction = "select-move"; // Go directly to move selection
        gameState.message = `Selected Pawn ${pawn.id}. Choose move.`;
      } else if (canSwapThisPawn) {
        // Only swap is possible
        gameState.currentAction = "select-11-swap-target"; // Go directly to target selection
        gameState.message = `Selected Pawn ${pawn.id}. Choose opponent to swap.`;
      } else {
        // This pawn selected, but has no moves and cannot swap? Error.
        console.error("Pawn selected for card 11 has no move/swap options?");
        gameState.message = "Error: No move or swap for this pawn.";
        // Reset selection?
        gameState.selectedPawn = null;
        gameState.currentAction = "select-11-pawn"; // Go back to pawn selection
        // Recalculate selectable pawns? Might be complex.
        determineActionsForCard(playerIndex, card); // Re-run to reset state
        return; // Exit to avoid further updates
      }
      break;
    case "select-7-pawn1": // First pawn selected for card 7
      // Player selected the first pawn. Show its potential moves (up to 7).
      gameState.validMoves = getPossibleMovesForPawn(pawn, "7"); // Show all possible split moves
      gameState.currentAction = "select-7-move1"; // Expecting move selection for first pawn
      gameState.message = `Selected Pawn ${pawn.id}. Choose a move (can be split).`;
      break;
    case "select-7-pawn2": // Selecting second pawn for 7-split
      gameState.splitData.secondPawn = pawn;
      // Calculate remaining moves for the second pawn
      gameState.validMoves = getPossibleMovesForPawn(
        pawn,
        7 - gameState.splitData.firstMoveValue
      );
      if (gameState.validMoves.length > 0) {
        gameState.currentAction = "select-7-move2";
        gameState.message = `Selected second Pawn ${pawn.id}. Choose its move.`;
      } else {
        // This shouldn't happen if selection was valid, but handle it
        console.error("Error: No valid moves for second pawn in 7-split?");
        gameState.message = "Error: No moves for second pawn.";
        // Reset or skip turn? Let's reset selection
        gameState.splitData.secondPawn = null;
        gameState.currentAction = "select-7-pawn2"; // Go back to selecting 2nd pawn
        // Need to repopulate selectable pawns for second move
      }
      break;
    default:
      console.error(
        `Unexpected state in executeLocalPawnSelection: ${gameState.currentAction}`
      );
      break;
  }

  updateUI();
  drawGame(); // Redraw to highlight selected pawn and maybe moves/targets
}

// Performs the action of selecting a move/destination square
// In Online mode, if it's the local player's turn, sends request to server
// In Local mode, executes the move (or part of it for split 7)
export function performMoveSelection(playerIndex, move) {
  if (currentGameMode === "online") {
    if (playerIndex === localPlayerIndex) {
      console.log("Requesting move selection:", move);
      requestMoveSelection(move);
      // Disable interaction until server responds
      canvas.classList.remove("clickable");
      canvas.style.cursor = "wait";
      setTimeout(() => {
        canvas.style.cursor = "";
      }, 500);
    } else {
      console.warn(
        "Attempted move selection on non-local player's turn (Online)."
      );
    }
    return; // Stop here for online mode
  }

  // --- Local Mode Logic ---
  console.log(`Local Move Selection: Player ${playerIndex}, Move:`, move);

  if (!gameState.selectedPawn) {
    console.error("Move selected but no pawn is selected!");
    return;
  }

  // Handle different action states requiring move selection
  switch (gameState.currentAction) {
    case "select-move": // Standard move, or Card 11 move-only
      executeMove(gameState.selectedPawn, move);
      // Turn advancement is handled by executeMove
      break;
    case "select-11-action": // Player chose the move part of card 11
      executeMove(gameState.selectedPawn, move);
      break;
    case "select-7-move1": // Player chose move for first pawn of split-7
      const moveValue = move.value; // Value of the chosen move (1 to 7)
      executeMove(gameState.selectedPawn, move); // Execute the first part of the move (advances turn if moveValue == 7)

      // Check if turn already advanced (means move was for full 7)
      if (gameState.currentPlayerIndex === playerIndex && !gameState.gameOver) {
        const remainingValue = 7 - moveValue;
        if (remainingValue > 0) {
          // Need to select second pawn
          gameState.splitData.firstPawn = gameState.selectedPawn;
          gameState.splitData.firstMoveValue = moveValue;
          gameState.selectedPawn = null; // Clear selection for next pawn
          gameState.validMoves = []; // Clear moves
          gameState.selectablePawns = []; // Clear old selectable pawns

          // Find selectable pawns for the second move (excluding the first pawn)
          gameState.players[playerIndex].pawns.forEach((pawn) => {
            if (
              pawn !== gameState.splitData.firstPawn &&
              (pawn.positionType === "board" || pawn.positionType === "safe") &&
              getPossibleMovesForPawn(pawn, remainingValue.toString()).length >
                0
            ) {
              gameState.selectablePawns.push(pawn);
            }
          });

          if (gameState.selectablePawns.length > 0) {
            gameState.currentAction = "select-7-pawn2";
            gameState.message = `First move done (${moveValue}). Select second pawn for remaining ${remainingValue}.`;
          } else {
            // No valid second pawn/move, turn ends (should have been handled by executeMove's nextTurn call)
            gameState.message = `First move done (${moveValue}). No valid second move. Turn ends.`;
            console.log(
              "No valid second pawn/move for 7-split. Turn should end."
            );
            // Force turn end if executeMove didn't? Unlikely needed.
            // window.dispatchEvent(new Event("nextTurn"));
          }
        }
        // If remainingValue is 0, executeMove already advanced the turn
      }
      break;
    case "select-7-move2": // Player chose move for second pawn of split-7
      executeMove(gameState.selectedPawn, move);
      // Turn ends (handled by executeMove)
      gameState.message = `Completed 7-split move.`;
      break;
    default:
      console.error(
        `Unexpected state in performMoveSelection: ${gameState.currentAction}`
      );
      break;
  }

  // executeMove handles UI update and redraw after move logic is complete
}

// Handles clicks on the canvas (pawn or square selection)
function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;

  const playerIndex = gameState.currentPlayerIndex;

  // --- Online Mode Turn Check ---
  if (currentGameMode === "online" && playerIndex !== localPlayerIndex) {
    console.log("Canvas clicked, but it's not your turn (Online).");
    return; // Ignore clicks if it's not the local player's turn online
  }
  // -----------------------------

  // Ignore clicks if game is over or no action expected
  if (gameState.gameOver || !gameState.currentAction) {
    console.log("Canvas clicked, but no action expected.");
    return;
  }

  console.log(
    `Canvas Clicked. Action: ${gameState.currentAction}, SelectedPawn: ${gameState.selectedPawn?.id}`
  );

  let clickedPawn = null;
  let clickedMove = null;
  let clickedTarget = null;

  // Determine what the user might be clicking on based on current action
  switch (gameState.currentAction) {
    // --- Pawn Selection States ---
    case "select-pawn":
    case "select-sorry-pawn":
    case "select-11-pawn":
    case "select-7-pawn1":
    case "select-7-pawn2":
      clickedPawn = isClickOnPawn(clickX, clickY, gameState.selectablePawns);
      if (clickedPawn) {
        console.log(`Clicked on Selectable Pawn: ${clickedPawn.id}`);
        // Call the correct function based on mode
        if (currentGameMode === "online") {
          requestSelectPawn(clickedPawn); // Send request online
          // Provide immediate visual feedback that selection was sent?
          if (canvas) canvas.style.cursor = "wait";
          setTimeout(() => {
            if (canvas) canvas.style.cursor = "";
          }, 750);
        } else {
          executeLocalPawnSelection(playerIndex, clickedPawn); // Execute locally
        }
        return;
      }
      break;

    // --- Target Selection States ---
    case "select-sorry-target":
    case "select-11-swap-target":
      clickedTarget = isClickOnPawn(
        clickX,
        clickY,
        gameState.targetableOpponents
      );
      if (clickedTarget) {
        console.log(`Clicked on Targetable Opponent: ${clickedTarget.id}`);
        if (gameState.currentAction === "select-sorry-target") {
          if (currentGameMode === "online") {
            requestSorry(clickedTarget);
          } else {
            executeSorry(gameState.selectedPawn, clickedTarget);
          }
        } else {
          // 11-swap target
          if (currentGameMode === "online") {
            requestSwap(clickedTarget);
          } else {
            executeSwap(gameState.selectedPawn, clickedTarget);
          }
        }
        return;
      }
      break;

    // --- Move/Action Selection States ---
    case "select-move":
    case "select-7-move1":
    case "select-7-move2":
      clickedMove = isClickOnSquare(clickX, clickY, gameState.validMoves);
      if (clickedMove) {
        console.log("Clicked on Valid Move:", clickedMove);
        performMoveSelection(playerIndex, clickedMove);
        return;
      }
      break;

    case "select-11-action": // Can click move OR target
      clickedMove = isClickOnSquare(clickX, clickY, gameState.validMoves);
      if (clickedMove) {
        console.log("Clicked on Valid Move (for 11):".clickedMove);
        performMoveSelection(playerIndex, clickedMove);
        return;
      }
      clickedTarget = isClickOnPawn(
        clickX,
        clickY,
        gameState.targetableOpponents
      );
      if (clickedTarget) {
        console.log(
          `Clicked on Targetable Opponent (for 11 swap): ${clickedTarget.id}`
        );
        if (currentGameMode === "online") {
          requestSwap(clickedTarget);
        } else {
          executeSwap(gameState.selectedPawn, clickedTarget);
        }
        return;
      }
      break;

    default:
      console.log(
        `Click occurred during unhandled action state: ${gameState.currentAction}`
      );
      break;
  }

  console.log("Click did not match any actionable item for the current state.");
}

// Reset game state and UI
function resetGame() {
  console.log("Reset Game button clicked.");
  // Dispatch event for main.js to handle full reset (including potential disconnect)
  window.dispatchEvent(new Event("resetGame"));
}

// Skip turn action (for debugging)
function skipTurnAction() {
  console.log("Skip Turn button clicked.");
  if (currentGameMode === "local" && !gameState.gameOver) {
    // In local mode, check if it's a human turn before skipping
    if (gameState.players[gameState.currentPlayerIndex]?.type === "human") {
      window.dispatchEvent(new Event("nextTurn"));
    } else {
      console.log("Cannot skip AI turn locally.");
    }
  } else if (currentGameMode === "online") {
    // In online mode, only allow skip if it's your turn
    if (
      gameState.currentPlayerIndex === localPlayerIndex &&
      !gameState.gameOver
    ) {
      console.log("Requesting skip turn from server...");
      emitAction("skipTurn");
    } else {
      console.log("Cannot skip turn: Not your turn or game over (Online).");
    }
  }
}
