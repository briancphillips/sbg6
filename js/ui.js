// UI module for the Sorry! game
import {
  gameState,
  getOpponentPawnsOnBoard,
  getPlayerPawnsInStart,
  isPawnOnBoard,
  isPawnInSafety,
  isPawnAtHome,
  isPawnAtStart,
  isPawnMovable,
  resetTurnState,
  getPawnObjectById,
} from "./gameState.js";
import { PLAYERS, BOARD_SIZE, BOARD_MARGIN } from "./constants.js";
import { drawGame, isClickOnPawn, isClickOnSquare } from "./drawing.js";
import {
  getPossibleMovesForPawn,
  executeMove,
  executeSorry,
  executeSwap,
  checkForAnyValidAction,
} from "./moves.js";
import { drawCard, initializeDeck } from "./cards.js";
import { listScenarios } from "./scenarioManager.js";
import {
  requestDrawCard,
  requestSelectPawn,
  requestMoveSelection,
  requestSorry,
  requestSwap,
  emitAction, // Generic action emitter
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
let roomCodeDisplayEl; // Added for online mode
let startGameOnlineButtonEl; // Added for online mode
let skipTurnButton; // Added
// Scenario Panel Elements (passed from main.js)
let toggleScenarioPanelButton;
let scenarioContent;
let scenarioPlayerSelect;
let scenarioButtons = [];

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
  roomCodeDisplayEl = elements.roomCodeDisplayEl;
  startGameOnlineButtonEl = elements.startGameOnlineButtonEl;
  // Store ref to skip button
  skipTurnButton = elements.skipTurnButton;
  // Store refs to scenario elements
  toggleScenarioPanelButton = elements.toggleScenarioPanelButton;
  scenarioContent = elements.scenarioContent;
  scenarioPlayerSelect = elements.scenarioPlayerSelect;
  scenarioButtons = elements.scenarioButtons; // Should be an array

  // Add event listeners
  drawCardButton.addEventListener("click", handleDrawCardButtonClick);
  resetButton.addEventListener("click", resetGame);
  canvas.addEventListener("click", handleCanvasClick);

  // Add Skip Turn button functionality (for debugging)
  if (skipTurnButton) {
    skipTurnButton.addEventListener("click", skipTurnAction);
  } else {
    console.warn("Skip turn button element not passed to initUI.");
  }

  // Add listeners for events dispatched by network.js
  document.addEventListener("assignPlayer", handleAssignPlayer);
  document.addEventListener("gameStateUpdate", handleGameStateUpdate);
  document.addEventListener("roomUpdate", handleRoomUpdate);
  document.addEventListener("turnStart", handleTurnStart);
  document.addEventListener("serverMessage", handleServerMessage);
  document.addEventListener("serverError", handleServerError);
  document.addEventListener("gameOverUpdate", handleGameOverUpdate);

  // Setup canvas dimensions (assuming it's consistent)
  const boardSize = BOARD_SIZE + BOARD_MARGIN * 2;
  canvas.width = boardSize;

  // Initialize scenario manager UI
  initScenarioManagerUI();

  // Initial UI update
  updateUI(); // Initial update assumes local mode
}

// --- Event Handlers for Network Events ---
function handleAssignPlayer(event) {
  localPlayerIndex = event.detail.index;
  console.log(`UI received player index assignment: ${localPlayerIndex}`);
  console.log(`Full assignment details:`, event.detail);
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
  // Full UI update needed as room changes might affect more than just the list
  updateUI();
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
  // Get elements (now using passed refs)
  // const toggleButton = document.getElementById("toggleScenarioPanel"); // REMOVED
  // const scenarioContent = document.getElementById("scenarioContent"); // REMOVED
  // const scenarioButtons = document.querySelectorAll(".scenario-btn"); // REMOVED
  // const playerSelect = document.getElementById("scenarioPlayer"); // REMOVED

  // Ensure elements were passed correctly
  if (!toggleScenarioPanelButton || !scenarioContent || !scenarioPlayerSelect) {
    console.warn("Scenario panel elements not passed to initUI.");
    return;
  }

  // Toggle scenario panel visibility
  toggleScenarioPanelButton.addEventListener("click", () => {
    const isHidden = scenarioContent.classList.contains("hidden");

    if (isHidden) {
      scenarioContent.classList.remove("hidden");
      toggleScenarioPanelButton.textContent = "Hide Test Scenarios";
    } else {
      scenarioContent.classList.add("hidden");
      toggleScenarioPanelButton.textContent = "Show Test Scenarios";
    }
  });

  // Add click handlers for scenario buttons
  scenarioButtons.forEach((button) => {
    if (!button) return; // Skip if button element is null/undefined
    button.addEventListener("click", () => {
      const scenarioName = button.getAttribute("data-scenario");
      const playerIndex = parseInt(scenarioPlayerSelect.value);

      if (currentGameMode === "local") {
        // Only allow in local mode
        // console.log(`Requesting scenario load: ${scenarioName}`);
        // Dispatch an event for main.js to handle the loading process
        window.dispatchEvent(
          new CustomEvent("loadScenarioRequest", {
            detail: {
              scenarioName: scenarioName,
              playerIndexOrConfig: playerIndex,
            },
          })
        );
      } else {
        console.warn("Scenarios can only be loaded in Local Game mode.");
      }
    });
  });

  // Log available scenarios to console for reference
  // console.log("Scenario Manager initialized.");
  listScenarios();
}

/**
 * Update UI elements based on game state, mode, and local player index.
 * @param {string} [mode=currentGameMode] - The current game mode ('local' or 'online').
 * @param {number} [localIdx=localPlayerIndex] - The index of the local player (defaults to module state).
 */
export function updateUI(mode = currentGameMode, localIdx = localPlayerIndex) {
  console.log(`--- updateUI called ---`);
  console.log(`  Mode: ${mode}, Local Index: ${localIdx}`);
  console.log(
    `  Game State: Started=${gameState.gameStarted}, CurrentPlayer=${gameState.currentPlayerIndex}, PlayerCount=${gameState.players?.length}`
  );
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
    // Handle both local (player.details) and online (player.name) structures
    currentPlayerNameEl.textContent =
      player.details?.name || player.name || "Unknown";
    // Handle both local (player.index) and online (player.playerIndex) structures
    const playerIdx = player.index ?? player.playerIndex; // Use nullish coalescing
    currentPlayerColorEl.style.backgroundColor =
      PLAYERS[playerIdx]?.color || "transparent"; // Use optional chaining for safety
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

  // Room Code Display
  if (roomCodeDisplayEl) {
    if (gameState.roomId) {
      roomCodeDisplayEl.classList.remove("hidden");
      // Assuming gameState.roomId exists and is populated by network.js
      roomCodeDisplayEl.querySelector("span").textContent = gameState.roomId;
    } else {
      roomCodeDisplayEl.classList.add("hidden");
    }
  }

  // Start Game Button Display (Host only, before game starts)
  if (startGameOnlineButtonEl) {
    console.log(
      `[Button Debug] localIdx=${localIdx}, gameStarted=${gameState.gameStarted}`
    );
    if (localIdx === 0 && !gameState.gameStarted) {
      console.log("[Button Debug] Should be showing the Start Game button");
      startGameOnlineButtonEl.classList.remove("hidden");
      startGameOnlineButtonEl.disabled = false; // Re-enable if it was disabled
      startGameOnlineButtonEl.textContent = "Start Online Game";
    } else {
      console.log("[Button Debug] Should be hiding the Start Game button");
      startGameOnlineButtonEl.classList.add("hidden");
    }
  }

  // Update win message
  // This is now handled by handleGameOverUpdate based on server message
  if (!gameState.gameOver) {
    winMessageEl.textContent = "";
  } else if (!winMessageEl.textContent) {
    // If game is over but message not set by network event yet, provide fallback
    const winnerIndex = gameState.players.findIndex((p) =>
      p.pawns.every(isPawnAtHome)
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
      // Handle both local and online player structures
      const playerIdx = player.index ?? player.playerIndex;
      const color = PLAYERS[playerIdx]?.color || "#888888"; // Fallback color
      const name =
        player.details?.name || player.name || `Player ${playerIdx + 1}`;

      li.style.color = color;
      // Use determined name, indicate if it's the local player
      li.textContent = `${name} (${
        playerIdx === localPlayerIndex ? "You" : "Remote"
      })`;
      if (playerIdx === localPlayerIndex) {
        li.style.fontWeight = "bold";
      }
      if (playerIdx === gameState.currentPlayerIndex) {
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
      // console.log("Requesting draw card from server...");
      requestDrawCard();
      // Disable button immediately to prevent double clicks, UI update will confirm
      drawCardButton.disabled = true;
    } else {
      console.warn("Draw card clicked, but it's not your turn!");
    }
  } else {
    // Local mode: Perform draw directly
    // console.log("Draw Card button clicked by human (Local).");
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
    // console.log("Attempted to draw card when not allowed.");
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
// This function updates the local gameState to provide UI feedback (highlighting)
// It does NOT execute moves directly. Called after drawing locally.
// Export needed for main.js to call it when loading scenarios.
export function determineActionsForCard(playerIndex, card) {
  // Reset selection state using the centralized function
  resetTurnState();

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
      pawnsInStart.forEach((pawn) => {
        // Add the ID, not the object
        gameState.selectablePawns.push(pawn.id);
      });
      // Set targets
      gameState.targetableOpponents = opponentsOnBoard.map((p) => p.id);
      console.log(
        `[TargetsSet] Sorry! - Set ${opponentsOnBoard.length} targetable opponents.`
      );
      gameState.currentAction = "select-sorry-pawn";
      gameState.message = "Sorry! Select your pawn from Start.";
    } else {
      gameState.message = "Sorry! No valid targets."; // Set message if Sorry! has no effect
      if (!checkForAnyValidAction(playerIndex, card)) {
        triggerLocalTurnSkip(playerIndex);
      }
    }
  } else if (card === "11") {
    // Use helpers
    const pawnsOnBoardOrSafe = player.pawns.filter(isPawnMovable);
    const opponentsOnBoard = getOpponentPawnsOnBoard(playerIndex);
    const canSwap =
      pawnsOnBoardOrSafe.some(isPawnOnBoard) && // Check if any movable pawn is specifically on board
      opponentsOnBoard.length > 0;

    // Check pawns that can move 11 steps OR can participate in a swap
    player.pawns.forEach((pawn) => {
      const canMove11 = getPossibleMovesForPawn(pawn, "11").length > 0;
      // Use helper
      const isSwappable = isPawnOnBoard(pawn) && canSwap;
      if (canMove11 || isSwappable) {
        // Add logging here
        console.log(
          `[SelectableCheck] Card: ${card}, Player: ${playerIndex}, Adding Pawn ${pawn.id} (Pos: ${pawn.positionType} ${pawn.positionIndex})`
        );
        gameState.selectablePawns.push(pawn.id);
      }
    });

    if (gameState.selectablePawns.length > 0) {
      gameState.currentAction = "select-11-pawn";
      gameState.message = "Draw 11: Select pawn to move 11 or swap.";
      // Need to provide targets for potential swap later
      if (canSwap) {
        gameState.targetableOpponents = opponentsOnBoard.map((p) => p.id);
        console.log(
          `[TargetsSet] Card 11 - Set ${opponentsOnBoard.length} targetable opponents.`
        );
      }
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
      // Use helper
      if (isPawnMovable(pawn) && canMoveSevenSplit) {
        // Add logging here
        console.log(
          `[SelectableCheck] Card: ${card}, Player: ${playerIndex}, Adding Pawn ${pawn.id} (Pos: ${pawn.positionType} ${pawn.positionIndex})`
        );
        gameState.selectablePawns.push(pawn.id);
      }
    });

    if (gameState.selectablePawns.length > 0) {
      gameState.currentAction = "select-7-pawn1";
      gameState.message = "Draw 7: Select first pawn to move or split.";
      // Set the mandatory flag
      gameState.splitMandatory = gameState.selectablePawns.length >= 2;
      console.log(
        `[ActionSet] Card 7: Set currentAction to '${gameState.currentAction}', splitMandatory=${gameState.splitMandatory}`
      );
    } else {
      gameState.message = "Draw 7: No pawns available to move.";
      if (!checkForAnyValidAction(playerIndex, card)) {
        triggerLocalTurnSkip(playerIndex);
      }
    }
  } else {
    // Handle standard numbered cards (1, 2, 3, 4, 5, 8, 10, 12)
    player.pawns.forEach((pawn) => {
      // Add logging here
      const moves = getPossibleMovesForPawn(pawn, card);
      if (moves.length > 0) {
        console.log(
          `[SelectableCheck] Card: ${card}, Player: ${playerIndex}, Adding Pawn ${pawn.id} (Pos: ${pawn.positionType} ${pawn.positionIndex}), Moves:`,
          moves
        );
        gameState.selectablePawns.push(pawn.id);
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
  let nextAction = null; // Store the determined next action

  // Reset moves (always done after pawn selection)
  gameState.validMoves = [];
  // Target state will be decided based on nextAction

  // Determine next state based on the current action state
  switch (gameState.currentAction) {
    case "select-pawn":
      const standardMoves = getPossibleMovesForPawn(pawn, card);
      // *** ADD LOGGING ***
      console.log(
        `[PawnSelect Debug] Moves calculated for ${pawn.id} (Card ${card}):`,
        JSON.stringify(standardMoves)
      );
      // *******************
      gameState.validMoves = standardMoves;
      nextAction = "select-move"; // Does NOT require targets
      gameState.message = `Selected Pawn ${pawn.id}. Choose a move.`;
      break;
    case "select-sorry-pawn": // Pawn from start selected
      // Targets (opponents on board) were already determined
      nextAction = "select-sorry-target"; // Requires targets
      gameState.message = `Selected Pawn ${pawn.id}. Choose opponent pawn to bump.`;
      break;
    case "select-11-pawn": // Pawn selected for card 11
      const elevenMoves = getPossibleMovesForPawn(pawn, "11");
      // *** ADD LOGGING ***
      console.log(
        `[PawnSelect Debug] Moves calculated for ${pawn.id} (Card 11):`,
        JSON.stringify(elevenMoves)
      );
      // *******************
      gameState.validMoves = elevenMoves;
      // Check if swap is possible *with this specific pawn* (must be on board)
      // Keep targetableOpponents check here, as they were set in determineActionsForCard
      const canSwapThisPawn =
        isPawnOnBoard(pawn) && gameState.targetableOpponents.length > 0;

      if (gameState.validMoves.length > 0 && canSwapThisPawn) {
        nextAction = "select-11-action"; // Requires targets (for swap option)
        gameState.message = `Selected Pawn ${pawn.id}. Choose move or opponent to swap.`;
      } else if (gameState.validMoves.length > 0) {
        // Only move is possible
        nextAction = "select-move"; // Does NOT require targets
        gameState.message = `Selected Pawn ${pawn.id}. Choose move.`;
      } else if (canSwapThisPawn) {
        // Only swap is possible
        nextAction = "select-11-swap-target"; // Requires targets
        gameState.message = `Selected Pawn ${pawn.id}. Choose opponent to swap.`;
      } else {
        // This pawn selected, but has no moves and cannot swap? Error.
        console.error("Pawn selected for card 11 has no move/swap options?");
        gameState.message = "Error: No move or swap for this pawn.";
        // Reset selection? Re-run determineActions to reset state properly
        determineActionsForCard(playerIndex, card); // This will reset action/targets
        return; // Exit to avoid further updates
      }
      break;
    case "select-7-pawn1": // First pawn selected for card 7
      // Player selected the first pawn. Show its potential moves (up to 7).
      let potentialMoves = getPossibleMovesForPawn(pawn, "7"); // Show all possible split moves

      // *** If split is mandatory, remove the 7-step move option ***
      if (gameState.splitMandatory) {
        console.log(
          "[SplitCheck] Split is mandatory, filtering out 7-step move."
        );
        potentialMoves = potentialMoves.filter((move) => move.steps !== 7);
      }
      // *** ADD LOGGING ***
      console.log(
        `[PawnSelect Debug] Moves calculated for ${pawn.id} (Card 7, Part 1):`,
        JSON.stringify(potentialMoves)
      );
      // *******************
      gameState.validMoves = potentialMoves;
      nextAction = "select-7-move1"; // Does NOT require targets
      gameState.message = `Selected Pawn ${
        pawn.id
      }. Choose a move (can be split${
        gameState.splitMandatory ? ", must be 1-6" : ""
      }).`;
      break;
    case "select-7-pawn2": // Selecting second pawn for 7-split
      gameState.splitData.secondPawn = pawn;
      // Calculate remaining moves for the second pawn
      const remainingValueForSecond = 7 - gameState.splitData.firstMoveValue;
      const secondSevenMoves = getPossibleMovesForPawn(
        pawn,
        remainingValueForSecond.toString()
      );
      // *** ADD LOGGING ***
      console.log(
        `[PawnSelect Debug] Moves calculated for ${pawn.id} (Card 7, Part 2, ${remainingValueForSecond}):`,
        JSON.stringify(secondSevenMoves)
      );
      // *******************
      gameState.validMoves = secondSevenMoves;
      if (gameState.validMoves.length > 0) {
        nextAction = "select-7-move2"; // Does NOT require targets
        gameState.message = `Selected second Pawn ${pawn.id}. Choose its move.`;
      } else {
        // This shouldn't happen if selection was valid, but handle it
        console.error("Error: No valid moves for second pawn in 7-split?");
        gameState.message = "Error: No moves for second pawn.";
        // Reset selection state for the second pawn choice
        gameState.splitData.secondPawn = null;
        gameState.selectedPawn = gameState.splitData.firstPawn; // Re-select first pawn? Maybe not best.
        // Go back to selecting the second pawn
        nextAction = "select-7-pawn2";
        gameState.message = `Error with Pawn ${pawn.id}. Select a different second pawn for remaining ${remainingValueForSecond}.`;
        // Ensure selectablePawns for this state are repopulated correctly
        // (This case might need more robust error handling/state reset)
        gameState.selectablePawns = [];
        gameState.players[playerIndex].pawns.forEach((otherPawn) => {
          if (
            otherPawn !== gameState.splitData.firstPawn &&
            isPawnMovable(otherPawn)
          ) {
            const secondMoves = getPossibleMovesForPawn(
              otherPawn,
              remainingValueForSecond.toString()
            );
            if (secondMoves.length > 0) {
              gameState.selectablePawns.push(otherPawn.id);
            }
          }
        });
        // If still no selectable pawns, turn should probably end.
      }
      break;
    default:
      console.error(
        `Unexpected state in executeLocalPawnSelection: ${gameState.currentAction}`
      );
      nextAction = gameState.currentAction; // Keep current action on error
      break;
  }

  // Now, clear targets based on the *next* action state
  const nextActionRequiresTargets = [
    "select-sorry-target",
    "select-11-swap-target",
    "select-11-action", // Requires targets because swap is an option
  ].includes(nextAction);

  if (!nextActionRequiresTargets) {
    // Only clear if the state we are *entering* doesn't need them.
    if (gameState.targetableOpponents.length > 0) {
      console.log(
        `[StateReset] Clearing targetableOpponents as next action '${nextAction}' does not require them.`
      );
      gameState.targetableOpponents = [];
    }
  } else {
    // Keep targets if next action needs them
    if (gameState.targetableOpponents.length > 0) {
      console.log(
        `[StateReset] Preserving targetableOpponents (${gameState.targetableOpponents.length}) as next action '${nextAction}' requires them.`
      );
    } else {
      // This case might occur if e.g. Card 11 was drawn, pawn selected,
      // but no actual opponents were on board to target.
      console.log(
        `[StateReset] Next action '${nextAction}' requires targets, but none are currently set.`
      );
      // Should we re-fetch here just in case? Might be redundant if determineActions did it.
      // Let's assume determineActions set it correctly if needed.
    }
  }

  // Update the current action
  gameState.currentAction = nextAction;

  updateUI();
  drawGame(); // Redraw to highlight selected pawn and maybe moves/targets
}

// Performs the action of selecting a move/destination square
// In Online mode, if it's the local player's turn, sends request to server
// In Local mode, executes the move (or part of it for split 7)
export function performMoveSelection(move) {
  if (currentGameMode === "online") {
    if (gameState.currentPlayerIndex === localPlayerIndex) {
      console.log(
        `[UI->Net] Requesting selectMove. State: ${gameState.currentAction}, Move:`,
        JSON.stringify(move)
      );
      console.log(
        `[UI->Net] Valid Moves (Client):`,
        JSON.stringify(
          gameState.validMoves.map((m) => ({
            pT: m.positionType,
            pI: m.positionIndex,
            s: m.steps,
          }))
        ) // Log key details
      );
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
  console.log(
    `Local Move Selection: Player ${gameState.currentPlayerIndex}, Move:`,
    move
  );

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
      const moveValue = move.steps; // Use the 'steps' property added earlier

      // *** Check for mandatory split violation ***
      if (moveValue === 7 && gameState.splitMandatory) {
        gameState.message =
          "Invalid move: Must split 7 if possible (select move 1-6).";
        console.warn("Attempted 7-step move when split was possible.");
        updateUI();
        drawGame();
        return; // Reject the move selection
      }

      // Proceed with executing the first part of the move
      // console.log(
      //   `Split-7: Part 1 executed (${moveValue} steps). Calculating remaining.`
      // );
      // *** Pass false for endTurnAfter for the first part of split ***
      executeMove(gameState.selectedPawn, move, false);

      // Check if turn already advanced by executeMove (shouldn't happen now)
      // or if game ended
      if (
        gameState.currentPlayerIndex === localPlayerIndex &&
        !gameState.gameOver
      ) {
        const remainingValue = 7 - moveValue;
        // console.log(`Split-7: Remaining value = ${remainingValue}`);
        if (remainingValue > 0) {
          // Need to select second pawn
          gameState.splitData.firstPawn = gameState.selectedPawn;
          gameState.splitData.firstMoveValue = moveValue;
          gameState.selectedPawn = null; // Clear selection for next pawn
          gameState.validMoves = []; // Clear moves
          gameState.selectablePawns = []; // Clear old selectable pawns
          // console.log("Split-7: Finding other pawns for second move...");

          // Find OTHER selectable pawns for the second move
          gameState.players[localPlayerIndex].pawns.forEach((pawn) => {
            // console.log(
            //   `  - Checking Pawn ID ${pawn.id} (Type: ${pawn.positionType})`
            // );
            // Use helper
            if (pawn !== gameState.splitData.firstPawn && isPawnMovable(pawn)) {
              const secondMoves = getPossibleMovesForPawn(
                pawn,
                remainingValue.toString()
              );
              // console.log(
              //   `    - Can Pawn ${pawn.id} move ${remainingValue} steps? ${
              //     secondMoves.length > 0 ? "Yes" : "No"
              //   }`
              // );
              if (secondMoves.length > 0) {
                gameState.selectablePawns.push(pawn.id);
              }
            }
          });

          // console.log(
          //   `Split-7: Found ${gameState.selectablePawns.length} other pawn(s) for second move.`
          // );

          if (gameState.selectablePawns.length > 0) {
            // If OTHER pawns CAN move, force selection of one of them
            // console.log("Split-7: Transitioning to select-7-pawn2 state.");
            gameState.currentAction = "select-7-pawn2";
            gameState.message = `First move done (${moveValue}). Select second pawn for remaining ${remainingValue}.`;
            // Update UI to show options for second pawn
            updateUI();
            drawGame();
          } else {
            // If NO OTHER pawn can make the remaining move, the turn ends.
            // The first pawn does NOT get to use the remaining steps.
            console.log(
              "[Split-7 Debug] Entered 'else' block - no second pawn can move."
            );
            gameState.message = `First move done (${moveValue}). No valid second move. Turn ends.`;
            console.log("[Split-7 Debug] State before dispatching nextTurn:", {
              currentAction: gameState.currentAction,
              selectedPawn: gameState.selectedPawn,
              splitData: { ...gameState.splitData },
              currentPlayerIndex: gameState.currentPlayerIndex,
              nextTurnPending: true,
            });
            window.dispatchEvent(new Event("nextTurn"));
            console.log("[Split-7 Debug] Dispatched 'nextTurn' event.");
          }
        } else {
          // Move used exactly 7 steps
          // console.log(
          //   "Split-7: Used exactly 7 steps in one move. Ending turn."
          // );
          window.dispatchEvent(new Event("nextTurn")); // Force turn end if exactly 7 steps used
        }
      }
      break;
    case "select-7-move2": // Player chose move for second pawn of split-7
      executeMove(gameState.selectedPawn, move, true); // End turn after second move
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
  // Add log here to check action state on click
  console.log(
    `[CanvasClick] Handling click. Current Action: ${gameState.currentAction}`
  );

  // --- Online Mode Turn Check ---
  // *** ADD LOGGING HERE ***
  console.log(
    `[TurnCheck Debug] CurrentPlayerIndex: ${gameState.currentPlayerIndex}, LocalPlayerIndex: ${localPlayerIndex}`
  );
  // **************************
  if (
    currentGameMode === "online" &&
    gameState.currentPlayerIndex !== localPlayerIndex
  ) {
    console.log("Canvas clicked, but it's not your turn (Online).");
    return; // Ignore clicks if it's not the local player's turn online
  }
  // -----------------------------

  // Ignore clicks if game is over or no action expected
  if (gameState.gameOver || !gameState.currentAction) {
    // console.log("Canvas clicked, but no action expected.");
    return;
  }

  // console.log(
  //   `Canvas Clicked. Action: ${gameState.currentAction}, SelectedPawn: ${gameState.selectedPawn?.id}`
  // );

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
      // Get actual pawn objects from IDs stored in gameState.selectablePawns
      const selectablePawnObjects = gameState.selectablePawns
        .map((pawnId) => getPawnObjectById(playerIndex, pawnId))
        .filter((p) => p !== null); // Filter out nulls if any pawn wasn't found

      clickedPawn = isClickOnPawn(clickX, clickY, selectablePawnObjects);
      if (clickedPawn) {
        // console.log(`Clicked on Selectable Pawn: ${clickedPawn.id}`);
        // Call the correct function based on mode
        if (currentGameMode === "online") {
          console.log(
            `[UI->Net] Requesting selectPawn. State: ${gameState.currentAction}, PawnID: ${clickedPawn.id}`
          );
          console.log(
            `[UI->Net] Selectable Pawns (Client): ${JSON.stringify(
              gameState.selectablePawns
            )}`
          );
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
      // Targetable opponents are stored by ID, need to get objects
      const targetableOpponentObjects = gameState.targetableOpponents
        .map((pawnId) => {
          // Need to find which player this opponent belongs to
          for (let i = 0; i < gameState.players.length; i++) {
            if (i === playerIndex) continue; // Skip current player
            const opponentPawn = getPawnObjectById(i, pawnId);
            if (opponentPawn) return opponentPawn;
          }
          return null; // Pawn ID not found among opponents
        })
        .filter((p) => p !== null);

      clickedTarget = isClickOnPawn(clickX, clickY, targetableOpponentObjects);
      if (clickedTarget) {
        // console.log(`Clicked on Targetable Opponent: ${clickedTarget.id}`);
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
      // *** ADD LOGGING HERE ***
      console.log(`[CanvasClick Debug] State: ${gameState.currentAction}`);
      console.log(
        `[CanvasClick Debug] Valid Moves:`,
        JSON.stringify(gameState.validMoves)
      );
      console.log(`[CanvasClick Debug] Clicked Move Result:`, clickedMove);
      // *************************
      if (clickedMove) {
        // console.log("Clicked on Valid Move:", clickedMove);
        if (currentGameMode === "online") {
          console.log(
            `[UI->Net] Requesting selectMove. State: ${gameState.currentAction}, Move:`,
            JSON.stringify(clickedMove)
          );
          console.log(
            `[UI->Net] Valid Moves (Client):`,
            JSON.stringify(
              gameState.validMoves.map((m) => ({
                pT: m.positionType,
                pI: m.positionIndex,
                s: m.steps,
              }))
            ) // Log key details
          );
        }
        performMoveSelection(clickedMove);
        return;
      }
      break;

    case "select-11-action": // Can click move OR target
      clickedMove = isClickOnSquare(clickX, clickY, gameState.validMoves);
      // *** ADD LOGGING HERE ***
      console.log(`[CanvasClick Debug] State: ${gameState.currentAction}`);
      console.log(
        `[CanvasClick Debug] Valid Moves (for 11):`,
        JSON.stringify(gameState.validMoves)
      );
      console.log(
        `[CanvasClick Debug] Clicked Move Result (for 11):`,
        clickedMove
      );
      // *************************
      if (clickedMove) {
        // console.log("Clicked on Valid Move (for 11):".clickedMove);
        if (currentGameMode === "online") {
          console.log(
            `[UI->Net] Requesting selectMove (for 11). State: ${gameState.currentAction}, Move:`,
            JSON.stringify(clickedMove)
          );
          console.log(
            `[UI->Net] Valid Moves (Client):`,
            JSON.stringify(
              gameState.validMoves.map((m) => ({
                pT: m.positionType,
                pI: m.positionIndex,
                s: m.steps,
              }))
            ) // Log key details
          );
        }
        performMoveSelection(clickedMove);
        return;
      }
      clickedTarget = isClickOnPawn(
        clickX,
        clickY,
        // Need opponent objects here too for 11-swap
        gameState.targetableOpponents
          .map((pawnId) => {
            for (let i = 0; i < gameState.players.length; i++) {
              if (i === playerIndex) continue;
              const opponentPawn = getPawnObjectById(i, pawnId);
              if (opponentPawn) return opponentPawn;
            }
            return null;
          })
          .filter((p) => p !== null)
      );
      if (clickedTarget) {
        // console.log(
        //   `Clicked on Targetable Opponent (for 11 swap): ${clickedTarget.id}`
        // );
        if (currentGameMode === "online") {
          requestSwap(clickedTarget);
        } else {
          executeSwap(gameState.selectedPawn, clickedTarget);
        }
        return;
      }
      break;

    default:
      // console.log(
      //   `Click occurred during unhandled action state: ${gameState.currentAction}`
      // );
      break;
  }

  // console.log("Click did not match any actionable item for the current state.");
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
      // console.log("Requesting skip turn from server...");
      emitAction("skipTurn");
    } else {
      console.log("Cannot skip turn: Not your turn or game over (Online).");
    }
  }
}
