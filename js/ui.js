// UI module for the Sorry! game
import { gameState, getOpponentPawnsOnBoard, getPlayerPawnsInStart } from './gameState.js';
import { PLAYERS } from './constants.js';
import { drawGame, isClickOnPawn, isClickOnSquare } from './drawing.js';
import { getPossibleMovesForPawn, executeMove, executeSorry, executeSwap, checkForAnyValidAction } from './moves.js';
import { drawCard } from './cards.js';

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
    drawCardButton.addEventListener('click', drawCardAction);
    resetButton.addEventListener('click', resetGame);
    canvas.addEventListener('click', handleCanvasClick);
    
    // Add Skip Turn button functionality (for debugging)
    const skipTurnButton = document.getElementById('skipTurnButton');
    if (skipTurnButton) {
        skipTurnButton.addEventListener('click', skipTurnAction);
    }
}

// Update UI elements based on game state
export function updateUI() {
    // Update player indicator
    currentPlayerNameEl.textContent = PLAYERS[gameState.currentPlayerIndex].name;
    currentPlayerColorEl.style.backgroundColor = PLAYERS[gameState.currentPlayerIndex].color;
    
    // Update card display
    cardDrawnEl.textContent = gameState.currentCard ? gameState.currentCard.toString() : '-';
    
    // Update message
    messageAreaEl.textContent = gameState.message;
    
    // Update buttons
    drawCardButton.disabled = gameState.currentCard !== null || gameState.gameOver;
    resetButton.classList.toggle('hidden', !gameState.gameOver);
    
    // Update canvas cursor
    if (gameState.currentCard && !gameState.gameOver && 
        (gameState.selectablePawns.length > 0 || 
         gameState.validMoves.length > 0 || 
         gameState.targetableOpponents.length > 0)) {
        canvas.classList.add('clickable');
    } else {
        canvas.classList.remove('clickable');
    }
}

// Handle draw card button click
export function drawCardAction() {
    if (gameState.currentCard !== null || gameState.gameOver) return;
    
    const cardDrawn = drawCard();
    
    if (cardDrawn) {
        handleCardDraw(gameState.currentPlayerIndex, gameState.currentCard);
    } else {
        updateUI();
    }
}

// Reset the game
export function resetGame() {
    // This will be implemented in main.js
    // We'll just dispatch a custom event that main.js will listen for
    window.dispatchEvent(new Event('resetGame'));
}

// Handle card draw
export function handleCardDraw(playerIndex, card) {
    // Reset selection state
    gameState.selectablePawns = [];
    gameState.targetableOpponents = [];
    gameState.validMoves = [];
    gameState.currentAction = null;
    
    const player = gameState.players[playerIndex];
    
    // Check for standard moves
    const canDoStandardMove = player.pawns.some(p => getPossibleMovesForPawn(p, card).length > 0);
    
    if (card === 'Sorry!') {
        const pawnsInStart = getPlayerPawnsInStart(playerIndex);
        const opponentsOnBoard = getOpponentPawnsOnBoard(playerIndex);
        
        if (pawnsInStart.length > 0 && opponentsOnBoard.length > 0) {
            gameState.selectablePawns = pawnsInStart;
            gameState.targetableOpponents = opponentsOnBoard;
            gameState.currentAction = 'select-sorry-pawn';
            gameState.message = "Sorry! Select your pawn from Start.";
        }
    } else if (card === '11') {
        const pawnsOnBoard = player.pawns.filter(p => p.positionType === 'board');
        const opponentsOnBoard = getOpponentPawnsOnBoard(playerIndex);
        const canSwap = pawnsOnBoard.length > 0 && opponentsOnBoard.length > 0;
        
        player.pawns.forEach(pawn => {
            if (getPossibleMovesForPawn(pawn, '11').length > 0 || (pawn.positionType === 'board' && canSwap)) {
                gameState.selectablePawns.push(pawn);
            }
        });
        
        if (gameState.selectablePawns.length > 0) {
            gameState.currentAction = 'select-11-pawn';
            gameState.message = "Draw 11: Select pawn to move 11 or swap.";
            if (canSwap) gameState.targetableOpponents = opponentsOnBoard;
        }
    } else if (card === '7') {
        // Fix: Only include pawns NOT in 'start' position for 7 card
        player.pawns.forEach(pawn => {
            // Only allow pawns that are already on the board or in safety zone
            if ((pawn.positionType === 'board' || pawn.positionType === 'safe') && 
                getPossibleMovesForPawn(pawn, '1').length > 0) {
                gameState.selectablePawns.push(pawn);
            }
        });
        
        if (gameState.selectablePawns.length > 0) {
            gameState.currentAction = 'select-7-pawn1';
            gameState.message = "Draw 7: Select first pawn to move or split.";
        }
    } else {
        player.pawns.forEach(pawn => {
            if (getPossibleMovesForPawn(pawn, card).length > 0) {
                gameState.selectablePawns.push(pawn);
            }
        });
        
        if (gameState.selectablePawns.length > 0) {
            gameState.currentAction = 'select-pawn';
            gameState.message = `Draw ${card}: Select pawn to move.`;
        }
    }
    
    // If no valid action, skip turn
    if (!gameState.currentAction && !checkForAnyValidAction(playerIndex, card)) {
        gameState.message = `Draw ${card}: No possible moves. Turn skipped.`;
        console.log(`Player ${playerIndex} has no valid actions for card ${card}.`);
        
        // Discard card and move to next turn
        gameState.discardPile.push(gameState.currentCard);
        gameState.currentCard = null;
        
        // Use setTimeout to give player a chance to see the message
        setTimeout(() => {
            // This will be implemented in main.js
            window.dispatchEvent(new Event('nextTurn'));
        }, 1500);
    }
    
    updateUI();
    drawGame();
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
    gameState.splitData = { firstPawn: null, firstMoveValue: 0, secondPawn: null };
    
    // Add debug message
    gameState.message = "DEBUG: Turn skipped manually";
    
    // Update UI
    updateUI();
    drawGame();
    
    // Trigger next turn
    setTimeout(() => {
        window.dispatchEvent(new Event('nextTurn'));
    }, 500);
}

// Handle canvas clicks
export function handleCanvasClick(event) {
    if (!gameState.currentCard || gameState.gameOver) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;
    
    const currentPlayerIndex = gameState.currentPlayerIndex;
    const currentCard = gameState.currentCard;
    
    // Find what was clicked
    let clickedPawn = null;
    let clickedMove = null;
    
    // Check for clicked pawns
    for (const player of gameState.players) {
        for (const pawn of player.pawns) {
            if (isClickOnPawn(clickX, clickY, pawn)) {
                clickedPawn = pawn;
                break;
            }
        }
        if (clickedPawn) break;
    }
    
    // Check for clicked move destinations
    if (gameState.validMoves.length > 0) {
        for (const move of gameState.validMoves) {
            if (move.type === 'move' && isClickOnSquare(clickX, clickY, move.pixelX, move.pixelY)) {
                clickedMove = move;
                break;
            }
        }
    }
    
    console.log("Click Action:", gameState.currentAction, "Clicked Pawn:", clickedPawn?.id, "Clicked Move:", clickedMove);
    
    // Handle null currentAction - restore proper state
    if (gameState.currentAction === null && gameState.currentCard) {
        // Re-initialize action state based on current card
        handleCardDraw(currentPlayerIndex, currentCard);
        
        // Update UI and redraw
        drawGame();
        updateUI();
        return;
    }
    
    // Handle clicks based on current action
    switch (gameState.currentAction) {
        case 'select-pawn':
            if (clickedPawn && gameState.selectablePawns.includes(clickedPawn)) {
                gameState.selectedPawn = clickedPawn;
                gameState.validMoves = getPossibleMovesForPawn(clickedPawn, currentCard);
                gameState.selectablePawns = [];
                gameState.currentAction = 'select-move';
                gameState.message = `Pawn ${clickedPawn.id} selected. Click destination.`;
            } else {
                gameState.message = "Please click one of your highlighted pawns.";
            }
            break;
            
        case 'select-move':
            if (clickedMove && gameState.selectedPawn) {
                executeMove(gameState.selectedPawn, clickedMove);
                return;
            } else if (clickedPawn === gameState.selectedPawn) {
                gameState.message = "Pawn deselected. Select a pawn.";
                gameState.selectedPawn = null;
                gameState.validMoves = [];
                handleCardDraw(currentPlayerIndex, currentCard);
                return;
            } else {
                gameState.message = "Click a valid green destination square.";
            }
            break;
            
        case 'select-sorry-pawn':
            if (clickedPawn && gameState.selectablePawns.includes(clickedPawn)) {
                gameState.selectedPawn = clickedPawn;
                gameState.selectablePawns = [];
                gameState.currentAction = 'select-sorry-target';
                gameState.message = "Select an opponent's pawn to bump.";
            } else {
                gameState.message = "Select one of your pawns from Start.";
            }
            break;
            
        case 'select-sorry-target':
            if (clickedPawn && gameState.targetableOpponents.includes(clickedPawn)) {
                executeSorry(gameState.selectedPawn, clickedPawn);
                return;
            } else {
                gameState.message = "Select a highlighted opponent's pawn.";
            }
            break;
            
        case 'select-11-pawn':
            if (clickedPawn && gameState.selectablePawns.includes(clickedPawn)) {
                gameState.selectedPawn = clickedPawn;
                gameState.validMoves = getPossibleMovesForPawn(clickedPawn, '11');
                gameState.selectablePawns = [];
                gameState.currentAction = 'select-11-action';
                gameState.message = "Move 11 (click green square) or Swap (click opponent)?";
            } else {
                gameState.message = "Select one of your highlighted pawns.";
            }
            break;
            
        case 'select-11-action':
            if (clickedMove && gameState.selectedPawn) {
                executeMove(gameState.selectedPawn, clickedMove);
                return;
            } else if (clickedPawn && gameState.targetableOpponents.includes(clickedPawn)) {
                executeSwap(gameState.selectedPawn, clickedPawn);
                return;
            } else {
                gameState.message = "Click a green square (move 11) or a highlighted opponent (swap).";
            }
            break;
            
        case 'select-7-pawn1':
            if (clickedPawn && gameState.selectablePawns.includes(clickedPawn)) {
                gameState.selectedPawn = clickedPawn;
                gameState.validMoves = getPossibleMovesForPawn(clickedPawn, '7');
                
                // Store for split move
                gameState.splitData.firstPawn = clickedPawn;
                gameState.splitData.firstMoveValue = 0;
                gameState.splitData.secondPawn = null;
                
                gameState.selectablePawns = [];
                gameState.currentAction = 'select-7-move1';
                gameState.message = "Select destination for 7 spaces, or split (1-6).";
            } else {
                gameState.message = "Select one of your highlighted pawns for the first part of 7.";
            }
            break;
            
        case 'select-7-move1':
            if (clickedMove && gameState.selectedPawn) {
                // Get the steps from the clicked move
                const steps = clickedMove.steps || 7; // Default to 7 if not specified
                
                // Store how many steps we used for the first part
                gameState.splitData.firstMoveValue = steps;
                
                // Execute the first part of the split move
                executeMove(gameState.selectedPawn, clickedMove, steps === 7); // End turn only if using full 7
                
                // If we used all 7 steps, we're done
                if (steps === 7) return;
                
                // Prepare for the second part of the split
                const remainingSteps = 7 - steps;
                gameState.message = `Now select a pawn for the remaining ${remainingSteps} steps.`;
                
                // Find pawns that can move the remaining steps
                gameState.selectablePawns = [];
                gameState.players[gameState.currentPlayerIndex].pawns.forEach(pawn => {
                    if (pawn !== gameState.splitData.firstPawn && 
                        getPossibleMovesForPawn(pawn, remainingSteps.toString()).length > 0) {
                        gameState.selectablePawns.push(pawn);
                    }
                });
                
                gameState.currentAction = 'select-7-pawn2';
                gameState.selectedPawn = null;
                gameState.validMoves = [];
                
                // If no pawns can move the remaining steps, skip to next turn
                if (gameState.selectablePawns.length === 0) {
                    gameState.message = `No valid moves for remaining ${remainingSteps} steps. Turn ended.`;
                    setTimeout(() => {
                        // Discard card and move to next turn
                        gameState.discardPile.push(gameState.currentCard);
                        gameState.currentCard = null;
                        window.dispatchEvent(new Event('nextTurn'));
                    }, 1500);
                }
                
                // Update UI and redraw
                drawGame();
                updateUI();
                return;
            } else {
                gameState.message = "Click a valid green destination square.";
            }
            break;
            
        case 'select-7-pawn2':
            if (clickedPawn && gameState.selectablePawns.includes(clickedPawn)) {
                gameState.selectedPawn = clickedPawn;
                gameState.splitData.secondPawn = clickedPawn;
                
                // Get valid moves for the remaining steps
                const remainingSteps = 7 - gameState.splitData.firstMoveValue;
                gameState.validMoves = getPossibleMovesForPawn(clickedPawn, remainingSteps.toString());
                
                gameState.selectablePawns = [];
                gameState.currentAction = 'select-7-move2';
                gameState.message = `Select destination for the remaining ${remainingSteps} steps.`;
            } else {
                gameState.message = "Select a highlighted pawn for the second part of 7.";
            }
            break;
            
        case 'select-7-move2':
            if (clickedMove && gameState.selectedPawn) {
                executeMove(gameState.selectedPawn, clickedMove);
                return;
            } else {
                gameState.message = "Click a valid green destination square to complete the split 7 move.";
            }
            break;
            
        default:
            console.error("Unknown action state:", gameState.currentAction);
    }
    
    // Update UI and redraw
    drawGame();
    updateUI();
}
