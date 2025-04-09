// AI Player Logic for Sorry!
import { gameState } from "./gameState.js";
import { PLAYERS } from "./constants.js";
import {
  performDrawCard,
  performMoveSelection,
  executeLocalPawnSelection,
} from "./ui.js";
import { executeSorry, executeSwap } from "./moves.js"; // Keep direct execute for Sorry/Swap for now

const AI_THINK_DELAY = 500; // ms delay for AI "thinking" before drawing
const AI_ACTION_DELAY = 750; // ms delay between AI drawing and starting action sequence
const AI_EXECUTION_DELAY = 600; // ms delay between steps in AI sequence (e.g., select pawn -> select move)

// Helper function for delays
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulates an AI player taking their turn.
 * Draws a card, then chooses and executes an action based on simple heuristics.
 *
 * @param {number} playerIndex - The index of the AI player taking the turn.
 */
export async function aiTakeTurn(playerIndex) {
  // Make async for delays
  const playerName = PLAYERS[playerIndex].name;
  console.log(`AI Turn: Player ${playerIndex} (${playerName}) is thinking...`);

  // Simulate AI "thinking" time before drawing
  await delay(AI_THINK_DELAY);
  console.log(`AI (${playerName}) is drawing a card...`);

  // --- AI Draws Card ---
  const cardDrawn = performDrawCard(playerIndex);

  if (cardDrawn) {
    console.log(
      `AI (${playerName}) drew ${gameState.currentCard}. Evaluating options... Initial Action: ${gameState.currentAction}`
    );

    if (gameState.currentAction) {
      // Add a delay before the AI starts its action sequence
      await delay(AI_ACTION_DELAY);
      await chooseAndExecuteAIAction(playerIndex); // Await the completion of the sequence
    } else {
      console.log(
        `AI (${playerName}) drew ${gameState.currentCard}, but no actions are possible. Turn should skip automatically.`
      );
    }
  } else {
    console.log(
      `AI (${playerName}) failed to draw card (deck empty?). Turn should advance automatically.`
    );
  }
  // Turn advancement is handled by executeMove/Sorry/Swap or the skip logic in determineActionsForCard
}

/**
 * AI chooses and executes a complete action sequence based on the current game state.
 * Uses simple "choose first valid option" heuristics.
 * Handles multi-step actions (e.g., select pawn -> select move).
 * @param {number} playerIndex - Index of the current AI player.
 */
async function chooseAndExecuteAIAction(playerIndex) {
  // Make async
  const playerName = PLAYERS[playerIndex].name;
  let currentAction = gameState.currentAction;
  console.log(`AI (${playerName}) deciding action for state: ${currentAction}`);

  // --- Main Action Loop (Handles multi-step turns like 7-split) ---
  while (
    currentAction &&
    playerIndex === gameState.currentPlayerIndex &&
    !gameState.gameOver
  ) {
    console.log(`AI (${playerName}) processing action: ${currentAction}`);
    let actionExecuted = false;

    // Ensure it's still this AI's turn and an action is pending
    if (playerIndex !== gameState.currentPlayerIndex || !currentAction) {
      console.log(`AI (${playerName}) action loop aborted. State changed.`);
      break;
    }

    switch (currentAction) {
      // === Pawn Selection Required ===
      case "select-pawn":
      case "select-sorry-pawn":
      case "select-11-pawn":
      case "select-7-pawn1":
      case "select-7-pawn2":
        if (gameState.selectablePawns.length > 0) {
          const chosenPawn = gameState.selectablePawns[0];
          console.log(
            `AI (${playerName}) choosing Pawn ${chosenPawn.id} for state ${currentAction}`
          );
          await delay(AI_EXECUTION_DELAY); // Delay before pawn selection
          executeLocalPawnSelection(playerIndex, chosenPawn);
          actionExecuted = true;
        } else {
          console.error(
            `AI (${playerName}) Error: In state ${currentAction} but no selectable pawns!`
          );
        }
        break;

      // === Move Selection Required ===
      case "select-move":
      case "select-11-action": // Handles move part of 11
      case "select-7-move1":
      case "select-7-move2":
        if (gameState.validMoves.length > 0) {
          const chosenMove = gameState.validMoves[0];
          console.log(
            `AI (${playerName}) choosing Move for state ${currentAction}:`,
            chosenMove
          );
          await delay(AI_EXECUTION_DELAY); // Delay before move selection
          performMoveSelection(playerIndex, chosenMove);
          actionExecuted = true;
        } else {
          console.error(
            `AI (${playerName}) Error: In state ${currentAction} but no valid moves!`
          );
        }
        break;

      // === Target Selection Required ===
      case "select-11-swap-target": // Handles swap part of 11 (if only swap is possible)
      case "select-sorry-target":
        const targets = gameState.targetableOpponents;
        if (targets.length > 0 && gameState.selectedPawn) {
          const targetPawn = targets[0];
          const actionName =
            currentAction === "select-sorry-target" ? "Sorry!" : "Swap";
          console.log(
            `AI (${playerName}) choosing ${actionName} target: Pawn ${targetPawn.id}`
          );
          await delay(AI_EXECUTION_DELAY);
          if (actionName === "Sorry!") {
            executeSorry(gameState.selectedPawn, targetPawn);
          } else {
            executeSwap(gameState.selectedPawn, targetPawn);
          }
          actionExecuted = true;
        } else {
          console.error(
            `AI (${playerName}) Error: In state ${currentAction} but no targetable opponents or no pawn selected!`
          );
        }
        break;

      default:
        console.error(
          `AI (${playerName}) encountered unknown action state: ${currentAction}`
        );
        actionExecuted = false; // Stop the loop if state is unknown
    }

    // If an error occurred or action failed, break the loop to prevent infinite processing
    if (!actionExecuted) {
      console.log(
        `AI (${playerName}) failed to execute action for state ${currentAction}. Ending AI turn.`
      );
      break;
    }

    // Check the game state AFTER the action was performed
    currentAction = gameState.currentAction;

    // If currentAction is null, it means the move execution function ended the turn
    // (or should have), so we break the loop.
    if (currentAction === null) {
      console.log(
        `AI (${playerName}) action resulted in null state, turn should be ending.`
      );
      break;
    }
  }
  console.log(`AI (${playerName}) finished action sequence.`);
}
