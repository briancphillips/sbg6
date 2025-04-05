// Import required modules
import { 
    PLAYERS, PLAYER_START_INFO, SLIDE_INFO, PATH_LENGTH, SAFETY_ZONE_LENGTH 
} from './constants.js';
import { 
    BOARD_PATH, SAFETY_ZONES, gameState, getPawnAtBoardIndex, isOccupiedByOwnPawnBoard, 
    isOccupiedByOwnPawnSafe, sendPawnToStart, getOpponentPawnsOnBoard,
    getPlayerPawnsInStart 
} from './gameState.js';
import { drawGame } from './drawing.js';
import { updateUI } from './ui.js';

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
    
    while (stepsLeft > 0) {
        // Check if we're approaching the safety entry
        if (currentType === 'board') {
            // Check if we need to enter the safety zone
            // Make sure exact position is compared and correct player entry points are checked
            if (currentPos === startInfo.safetyEntryIndex) {
                currentType = 'safe';
                currentPos = -1; // Start before the first safety zone space
            }
        }
        
        // Move forward
        if (currentType === 'board') {
            // Ensure proper calculation for the wrap-around
            currentPos = (currentPos + 1) % PATH_LENGTH;
        } else {
            currentPos++;
        }
        
        stepsLeft--;
        
        // Check if we reached home
        if (currentType === 'safe' && currentPos === SAFETY_ZONE_LENGTH) {
            if (stepsLeft === 0) return {
                positionType: 'home',
                positionIndex: -1,
                pixelX: PLAYERS[pawn.playerIndex].homeCoord.x,
                pixelY: PLAYERS[pawn.playerIndex].homeCoord.y
            };
            else return { type: 'invalid' };
        }
        
        if (currentType === 'safe' && currentPos > SAFETY_ZONE_LENGTH) {
            return { type: 'invalid' };
        }
    }
    
    // Check if the final position is occupied by your own pawn
    if (currentType === 'board' && isOccupiedByOwnPawnBoard(currentPos, pawn.playerIndex)) {
        return { type: 'invalid' };
    }
    
    if (currentType === 'safe' && isOccupiedByOwnPawnSafe(pawn.playerIndex, currentPos)) {
        return { type: 'invalid' };
    }
    
    // Return the calculated destination
    if (currentType === 'board') {
        return {
            positionType: 'board',
            positionIndex: currentPos,
            pixelX: BOARD_PATH[currentPos].pixelX,
            pixelY: BOARD_PATH[currentPos].pixelY
        };
    } else {
        return {
            positionType: 'safe',
            positionIndex: currentPos,
            pixelX: SAFETY_ZONES[pawn.playerIndex][currentPos].pixelX,
            pixelY: SAFETY_ZONES[pawn.playerIndex][currentPos].pixelY
        };
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
