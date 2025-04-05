// Import required modules
import { 
    PLAYERS, PLAYER_START_INFO, SLIDE_INFO, PATH_LENGTH, SAFETY_ZONE_LENGTH,
    getPlayerCoords, BOARD_LAYOUT, SQUARE_SIZE
} from './constants.js';
import { 
    BOARD_PATH, SAFETY_ZONES, gameState, getPawnAtBoardIndex, isOccupiedByOwnPawnBoard, 
    isOccupiedByOwnPawnSafe, sendPawnToStart, getOpponentPawnsOnBoard,
    getPlayerPawnsInStart, isOccupiedByOpponent
} from './gameState.js';
import { drawGame } from './drawing.js';
import { updateUI } from './ui.js';

// Helper function to check if a board position is occupied by an opponent's pawn
function isOccupiedByOppPawnBoard(position, playerIndex) {
    // Get the pawn at this board position
    const pawn = getPawnAtBoardIndex(position);
    
    // If there's a pawn and it belongs to another player, return true
    return pawn && pawn.playerIndex !== playerIndex;
}

// Calculate the possible moves for a pawn based on a card
export function getPossibleMovesForPawn(pawn, card, stepsOverride = null) {
    const moves = [];
    const playerIndex = pawn.playerIndex;
    const startInfo = PLAYER_START_INFO[playerIndex];
    const cardValue = stepsOverride !== null ? stepsOverride.toString() : card;
    const numericCardValue = parseInt(cardValue);

    if (cardValue === '4') {
        if (pawn.positionType === 'board') {
            // Fix: Ensure proper backward movement with wrap-around
            // Adding PATH_LENGTH ensures we avoid negative indices
            const targetIndex = (pawn.positionIndex - 4 + PATH_LENGTH) % PATH_LENGTH;
            if (!isOccupiedByOwnPawnBoard(targetIndex, playerIndex)) {
                moves.push({
                    type: 'move',
                    positionType: 'board',
                    positionIndex: targetIndex,
                    pixelX: BOARD_PATH[targetIndex].pixelX,
                    pixelY: BOARD_PATH[targetIndex].pixelY
                });
            }
        }
        // Allow backward movement in safety zone
        if (pawn.positionType === 'safe' && pawn.positionIndex >= 4) {
            const targetSafeIndex = pawn.positionIndex - 4;
            if (!isOccupiedByOwnPawnSafe(playerIndex, targetSafeIndex)) {
                moves.push({
                    type: 'move',
                    positionType: 'safe',
                    positionIndex: targetSafeIndex,
                    pixelX: SAFETY_ZONES[playerIndex][targetSafeIndex].pixelX,
                    pixelY: SAFETY_ZONES[playerIndex][targetSafeIndex].pixelY
                });
            }
        }
    } else if (cardValue === '10') {
        if (pawn.positionType === 'board' || pawn.positionType === 'safe') {
            const fwd10 = calculateForwardSteps(pawn, 10, startInfo);
            if (fwd10.type !== 'invalid') moves.push({ type: 'move', ...fwd10 });
        }
        
        if (pawn.positionType === 'board') {
            // Fix: Ensure proper backward movement with wrap-around for the card 10's backward 1
            // Adding PATH_LENGTH ensures we avoid negative indices
            const targetIndex = (pawn.positionIndex - 1 + PATH_LENGTH) % PATH_LENGTH;
            if (!isOccupiedByOwnPawnBoard(targetIndex, playerIndex)) {
                moves.push({
                    type: 'move',
                    positionType: 'board',
                    positionIndex: targetIndex,
                    pixelX: BOARD_PATH[targetIndex].pixelX,
                    pixelY: BOARD_PATH[targetIndex].pixelY
                });
            }
        }
        // Allow backward movement in safety zone
        if (pawn.positionType === 'safe' && pawn.positionIndex >= 1) {
            const targetSafeIndex = pawn.positionIndex - 1;
            if (!isOccupiedByOwnPawnSafe(playerIndex, targetSafeIndex)) {
                moves.push({
                    type: 'move',
                    positionType: 'safe',
                    positionIndex: targetSafeIndex,
                    pixelX: SAFETY_ZONES[playerIndex][targetSafeIndex].pixelX,
                    pixelY: SAFETY_ZONES[playerIndex][targetSafeIndex].pixelY
                });
            }
        }
    } else if (cardValue === '7') {
        // Special handling for card 7 - calculate all possible moves between 1-7 spaces
        if (pawn.positionType === 'board' || pawn.positionType === 'safe') {
            // Calculate all possible move distances from 1 to 7
            for (let steps = 1; steps <= 7; steps++) {
                const fwdMove = calculateForwardSteps(pawn, steps, startInfo);
                if (fwdMove.type !== 'invalid') {
                    moves.push({ 
                        type: 'move', 
                        ...fwdMove,
                        // Add a steps property so we know how many steps this move represents
                        steps: steps 
                    });
                }
            }
        }
    } else if (!isNaN(numericCardValue) && numericCardValue > 0) {
        if (pawn.positionType === 'start' && (cardValue === '1' || cardValue === '2')) {
            const exitIndex = startInfo.exitIndex;
            if (!isOccupiedByOwnPawnBoard(exitIndex, playerIndex)) {
                moves.push({
                    type: 'move',
                    positionType: 'board',
                    positionIndex: exitIndex,
                    pixelX: BOARD_PATH[exitIndex].pixelX,
                    pixelY: BOARD_PATH[exitIndex].pixelY
                });
            }
        } else if (pawn.positionType === 'board' || pawn.positionType === 'safe') {
            const fwdMove = calculateForwardSteps(pawn, numericCardValue, startInfo);
            if (fwdMove.type !== 'invalid') moves.push({ type: 'move', ...fwdMove });
        }
    }
    
    return moves;
}

// Calculate forward steps from a position
export function calculateForwardSteps(pawn, steps, startInfo) {
    let currentPos = pawn.positionIndex;
    let currentType = pawn.positionType;
    let stepsLeft = steps;
    
    // Log the initial position and steps for debugging
    console.log(`Calculating forward steps: Pawn at ${currentType} position ${currentPos}, moving ${steps} steps`);
    
    // Special case: If pawn is already in safety zone, handle direct movement within it
    if (currentType === 'safe') {
        const targetSafeIndex = currentPos + steps;
        
        // Check if move stays within the safety zone bounds
        if (targetSafeIndex < SAFETY_ZONE_LENGTH) {
            // Check if the position is not occupied
            if (!isOccupiedByOwnPawnSafe(pawn.playerIndex, targetSafeIndex)) {
                // Valid move within safety zone
                console.log(`Direct movement within safety zone from ${currentPos} to ${targetSafeIndex}`);
                return {
                    positionType: 'safe',
                    positionIndex: targetSafeIndex,
                    pixelX: SAFETY_ZONES[pawn.playerIndex][targetSafeIndex].pixelX,
                    pixelY: SAFETY_ZONES[pawn.playerIndex][targetSafeIndex].pixelY
                };
            } else {
                // Position is occupied
                return { type: 'invalid' };
            }
        } else if (targetSafeIndex === SAFETY_ZONE_LENGTH) {
            // Reach home with exact count
            console.log(`Exact move to home from safety position ${currentPos}`);
            return {
                positionType: 'home',
                positionIndex: -1,
                pixelX: BOARD_LAYOUT.homeAreas[pawn.playerIndex].x * SQUARE_SIZE,
                pixelY: BOARD_LAYOUT.homeAreas[pawn.playerIndex].y * SQUARE_SIZE
            };
        } else {
            // Overshot home
            return { type: 'invalid' };
        }
    }
    
    // Special case: If we're landing exactly on a safety entry point
    if (currentType === 'board' && stepsLeft > 0) {
        // Calculate the destination position without entering safety zone to check 
        // if it would land exactly on safety entry
        const destBoardPos = (currentPos + steps) % PATH_LENGTH;
        if (destBoardPos === startInfo.safetyEntryIndex) {
            // Valid move directly into safety zone
            console.log(`Direct entry to safety zone from ${currentPos} to entry point ${startInfo.safetyEntryIndex}`);
            return {
                positionType: 'safe',
                positionIndex: 0,
                pixelX: SAFETY_ZONES[pawn.playerIndex][0].pixelX,
                pixelY: SAFETY_ZONES[pawn.playerIndex][0].pixelY
            };
        }
    }
    
    // Normal step-by-step movement
    while (stepsLeft > 0) {
        // Move forward one step
        if (currentType === 'board') {
            // Check if the NEXT position would be the safety entry point for this player
            const nextPos = (currentPos + 1) % PATH_LENGTH;
            if (nextPos === startInfo.safetyEntryIndex) {
                // We're about to enter the safety zone
                currentType = 'safe';
                currentPos = 0;  // First safety zone space
                console.log(`Entering safety zone at safetyEntryIndex ${startInfo.safetyEntryIndex}`);
            } else {
                // Handle special wrap-around from position 59 to position 0
                if (currentPos === 59) {
                    currentPos = 0;
                } else {
                    // Standard increment for other positions
                    currentPos = nextPos;
                }
                
                // Log each step for debugging wrap-around
                console.log(`Step ${steps - stepsLeft + 1}: Now at board position ${currentPos}`);
            }
        } else if (currentType === 'safe') {
            // Moving within safety zone
            currentPos++;
            console.log(`Step ${steps - stepsLeft + 1}: Now at safety position ${currentPos}`);
            
            // Check if we've reached home
            if (currentPos === SAFETY_ZONE_LENGTH) {
                // Reached home with exact count
                console.log(`Exact move to home from safety position ${currentPos-1}`);
                return {
                    positionType: 'home',
                    positionIndex: -1,
                    pixelX: BOARD_LAYOUT.homeAreas[pawn.playerIndex].x * SQUARE_SIZE,
                    pixelY: BOARD_LAYOUT.homeAreas[pawn.playerIndex].y * SQUARE_SIZE
                };
            }
        }
        
        stepsLeft--;
    }
    
    // After all steps are taken, check if we're at a valid position
    if (currentType === 'board') {
        // Check if the position is occupied
        if (isOccupiedByOppPawnBoard(currentPos, pawn.playerIndex)) {
            // Can bump opponent's pawn
            return {
                positionType: 'board',
                positionIndex: currentPos,
                pixelX: BOARD_PATH[currentPos].pixelX,
                pixelY: BOARD_PATH[currentPos].pixelY,
                bump: true
            };
        } else if (isOccupiedByOwnPawnBoard(pawn.playerIndex, currentPos)) {
            // Position is occupied by own pawn - invalid move
            return { type: 'invalid' };
        }
        
        // Valid move to board position
        return {
            positionType: 'board',
            positionIndex: currentPos,
            pixelX: BOARD_PATH[currentPos].pixelX,
            pixelY: BOARD_PATH[currentPos].pixelY
        };
    } else if (currentType === 'safe') {
        // Check if position is within safety zone bounds
        if (currentPos < SAFETY_ZONE_LENGTH) {
            // Check if the position is occupied by own pawn
            if (isOccupiedByOwnPawnSafe(pawn.playerIndex, currentPos)) {
                // Position is occupied - invalid move
                return { type: 'invalid' };
            }
            
            // Valid move within safety zone
            return {
                positionType: 'safe',
                positionIndex: currentPos,
                pixelX: SAFETY_ZONES[pawn.playerIndex][currentPos].pixelX,
                pixelY: SAFETY_ZONES[pawn.playerIndex][currentPos].pixelY
            };
        } else {
            // Overshot home
            return { type: 'invalid' };
        }
    }
}

// Check if any valid actions are possible for a player with a card
export function checkForAnyValidAction(playerIndex, card) {
    const player = gameState.players[playerIndex];
    
    // Check for standard moves
    for (const pawn of player.pawns) {
        if (getPossibleMovesForPawn(pawn, card).length > 0) {
            return true;
        }
    }
    
    // Check for Sorry! card
    if (card === 'Sorry!') {
        const pawnsInStart = getPlayerPawnsInStart(playerIndex);
        const opponentsOnBoard = getOpponentPawnsOnBoard(playerIndex);
        return pawnsInStart.length > 0 && opponentsOnBoard.length > 0;
    }
    
    // Check for 11 card (swaps)
    if (card === '11') {
        const pawnsOnBoard = player.pawns.filter(p => p.positionType === 'board');
        const opponentsOnBoard = getOpponentPawnsOnBoard(playerIndex);
        return pawnsOnBoard.length > 0 && opponentsOnBoard.length > 0;
    }
    
    // Check for 7 card (split moves)
    if (card === '7') {
        let movablePawns = 0;
        for (const pawn of player.pawns) {
            if ((pawn.positionType === 'board' || pawn.positionType === 'safe') && 
                getPossibleMovesForPawn(pawn, '1').length > 0) {
                movablePawns++;
                if (movablePawns > 1) return true;
            }
        }
    }
    
    return false;
}

// Execute a move for a pawn
export function executeMove(pawn, destination, endTurnAfter = true) {
    console.log(`Executing Move: Pawn ${pawn.id} to Type: ${destination.positionType}, Index: ${destination.positionIndex}`);
    
    const playerIndex = pawn.playerIndex;
    let message = "";
    
    // Check for bumping opponent pawns when landing on a board square
    if (destination.positionType === 'board') {
        const bumpedPawn = getPawnAtBoardIndex(destination.positionIndex);
        if (bumpedPawn && bumpedPawn.playerIndex !== playerIndex) {
            sendPawnToStart(bumpedPawn);
            message = `Bumped ${PLAYERS[bumpedPawn.playerIndex].name}'s pawn! `;
            console.log(message);
        }
    }
    
    // Update pawn position
    pawn.positionType = destination.positionType;
    pawn.positionIndex = destination.positionIndex;
    
    let didSlide = false;
    
    // Check for slides
    if (pawn.positionType === 'board') {
        const slide = SLIDE_INFO[pawn.positionIndex];
        if (slide && slide.colorIndex !== playerIndex) {
            didSlide = true;
            message += `Landed on ${PLAYERS[slide.colorIndex].name}'s slide! `;
            console.log(message);
            
            const slideStartIndex = pawn.positionIndex;
            const slideEndIndex = slide.endBoardIndex;
            let currentIndex = (slideStartIndex + 1) % PATH_LENGTH;
            
            // Check for pawns along the slide
            while (true) {
                const pawnOnSlide = getPawnAtBoardIndex(currentIndex);
                if (pawnOnSlide) {
                    sendPawnToStart(pawnOnSlide);
                    message += ` slid into & bumped ${PLAYERS[pawnOnSlide.playerIndex].name}! `;
                    console.log(`Slide bumped pawn at index ${currentIndex}`);
                }
                
                if (currentIndex === slideEndIndex) break;
                
                currentIndex = (currentIndex + 1) % PATH_LENGTH;
                if (currentIndex === (slideStartIndex + 1) % PATH_LENGTH) {
                    console.error("Infinite loop detected in slide bumping!");
                    break;
                }
            }
            
            // Update pawn to slide end position
            pawn.positionIndex = slideEndIndex;
            console.log(`Pawn slid to index ${slideEndIndex}`);
            
            // Check for bumping at the end of the slide
            const finalBumpedPawn = getPawnAtBoardIndex(slideEndIndex);
            if (finalBumpedPawn && finalBumpedPawn.playerIndex !== playerIndex) {
                sendPawnToStart(finalBumpedPawn);
                message += ` Bumped ${PLAYERS[finalBumpedPawn.playerIndex].name} at slide end!`;
                console.log(message);
            }
        }
    }
    
    gameState.message = message.trim() || "Move complete.";
    
    // Check for win condition
    let won = false;
    if (pawn.positionType === 'home') {
        won = checkWinCondition(playerIndex);
    }
    
    // Reset selection state
    gameState.selectedPawn = null;
    gameState.validMoves = [];
    gameState.selectablePawns = [];
    gameState.targetableOpponents = [];
    
    if (endTurnAfter && !won) {
        nextTurn();
    } else {
        drawGame();
        updateUI();
    }
}

// Execute a Sorry! card action
export function executeSorry(startPawn, targetPawn) {
    console.log(`Executing Sorry! Pawn ${startPawn.id} bumping Player ${targetPawn.playerIndex} Pawn ${targetPawn.id}`);
    
    const targetPositionIndex = targetPawn.positionIndex;
    
    // Send opponent's pawn back to start
    sendPawnToStart(targetPawn);
    
    // Move player's pawn to opponent's position
    startPawn.positionType = 'board';
    startPawn.positionIndex = targetPositionIndex;
    
    gameState.message = `Sorry! Bumped ${PLAYERS[targetPawn.playerIndex].name}'s pawn!`;
    
    // Reset selection state
    gameState.selectedPawn = null;
    gameState.validMoves = [];
    gameState.selectablePawns = [];
    gameState.targetableOpponents = [];
    
    nextTurn();
}

// Execute a swap (11 card)
export function executeSwap(playerPawn, opponentPawn) {
    console.log(`Executing Swap: Player ${playerPawn.playerIndex} Pawn ${playerPawn.id} with Player ${opponentPawn.playerIndex} Pawn ${opponentPawn.id}`);
    
    const playerPosIndex = playerPawn.positionIndex;
    const opponentPosIndex = opponentPawn.positionIndex;
    
    // Swap positions
    playerPawn.positionIndex = opponentPosIndex;
    opponentPawn.positionIndex = playerPosIndex;
    
    gameState.message = `Swapped places with ${PLAYERS[opponentPawn.playerIndex].name}!`;
    
    // Check if player landed on a slide
    const slide = SLIDE_INFO[playerPawn.positionIndex];
    if (slide && slide.colorIndex !== playerPawn.playerIndex) {
        console.log("Player pawn landed on slide after swap!");
        gameState.message += ` Landed on a slide!`;
    } else {
        // Check if player bumped another pawn
        const bumpedPawn = getPawnAtBoardIndex(playerPawn.positionIndex);
        if (bumpedPawn && bumpedPawn !== opponentPawn && bumpedPawn.playerIndex !== playerPawn.playerIndex) {
            sendPawnToStart(bumpedPawn);
            gameState.message += ` Bumped another pawn after swap!`;
            console.log("Unexpected bump after swap!");
        }
    }
    
    // Reset selection state
    gameState.selectedPawn = null;
    gameState.validMoves = [];
    gameState.selectablePawns = [];
    gameState.targetableOpponents = [];
    
    nextTurn();
}

// Check win condition for a player
export function checkWinCondition(playerIndex) {
    const player = gameState.players[playerIndex];
    const allHome = player.pawns.every(p => p.positionType === 'home');
    
    if (allHome) {
        console.log(`Player ${playerIndex} (${PLAYERS[playerIndex].name}) Wins!`);
        gameState.gameOver = true;
        gameState.message = "";
        document.getElementById('winMessage').textContent = `${PLAYERS[playerIndex].name} Wins! Congratulations!`;
        updateUI();
    }
    
    return allHome;
}

// Move to the next turn
export function nextTurn() {
    // Discard the current card
    gameState.discardPile.push(gameState.currentCard);
    gameState.currentCard = null;
    
    // Move to next player
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    
    // Update message
    gameState.message = `${PLAYERS[gameState.currentPlayerIndex].name}'s turn. Draw a card.`;
    
    // Redraw and update UI
    drawGame();
    updateUI();
}
