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

// Debug the safety entry points at startup
export function debugSafetyEntries() {
    console.log("=== SAFETY ENTRY DEBUG ===");
    PLAYER_START_INFO.forEach((info, idx) => {
        console.log(`Player ${idx} (${PLAYERS[idx].name}): Safety Entry at board index ${info.safetyEntryIndex}`);
        if (BOARD_PATH[info.safetyEntryIndex]) {
            console.log(`  - Grid position: (${BOARD_PATH[info.safetyEntryIndex].gridX}, ${BOARD_PATH[info.safetyEntryIndex].gridY})`);
            console.log(`  - Pixel coordinates: (${BOARD_PATH[info.safetyEntryIndex].pixelX}, ${BOARD_PATH[info.safetyEntryIndex].pixelY})`);
            
            // For Yellow (player 2), also check position 30
            if (idx === 2) {
                console.log(`  - YELLOW CHECK: Position 30 is at (${BOARD_PATH[30].gridX}, ${BOARD_PATH[30].gridY})`);
                console.log(`  - YELLOW CHECK: Position 30 pixel coords: (${BOARD_PATH[30].pixelX}, ${BOARD_PATH[30].pixelY})`);
                
                // Check distance between position 30 and 31
                const pos30 = BOARD_PATH[30];
                const pos31 = BOARD_PATH[31];
                const gridDist = Math.abs(pos30.gridX - pos31.gridX) + Math.abs(pos30.gridY - pos31.gridY);
                console.log(`  - YELLOW CHECK: Grid distance between pos 30 and 31: ${gridDist}`);
                
                // Check distance to safety zone start
                const safetyStart = SAFETY_ZONES[2][0];
                const dist30ToSafety = Math.abs(pos30.gridX - safetyStart.gridX) + Math.abs(pos30.gridY - safetyStart.gridY);
                const dist31ToSafety = Math.abs(pos31.gridX - safetyStart.gridX) + Math.abs(pos31.gridY - safetyStart.gridY);
                console.log(`  - YELLOW CHECK: Distance from pos 30 to safety start: ${dist30ToSafety}`);
                console.log(`  - YELLOW CHECK: Distance from pos 31 to safety start: ${dist31ToSafety}`);
            }
        } else {
            console.error(`  - Invalid safety entry index: ${info.safetyEntryIndex}`);
        }
    });
    console.log("=== END SAFETY ENTRY DEBUG ===");
}

// Diagnostic function to verify safety zone structure and movement
export function diagnoseSafetyZones() {
    console.log("\n======== SAFETY ZONE DIAGNOSTIC ========");
    
    // 1. Verify SAFETY_ZONES data structure
    console.log("SAFETY_ZONES Structure Check:");
    SAFETY_ZONES.forEach((zone, playerIdx) => {
        console.log(`\nPlayer ${playerIdx} (${PLAYERS[playerIdx].name}) Safety Zone:`);
        console.log(`  - Length: ${zone.length}`);
        
        if (zone.length !== SAFETY_ZONE_LENGTH) {
            console.error(`  - ERROR: Expected ${SAFETY_ZONE_LENGTH} spaces, found ${zone.length}`);
        }
        
        zone.forEach((space, idx) => {
            console.log(`  - Space ${idx}: Grid(${space.gridX},${space.gridY}), Pixel(${space.pixelX},${space.pixelY})`);
            
            // Check for missing or invalid coordinates
            if (!space.pixelX || !space.pixelY) {
                console.error(`    - ERROR: Missing coordinates!`);
            }
        });
    });
    
    // 2. Test safety zone movement calculations
    console.log("\nSafety Zone Movement Tests:");
    
    // For each player, test movements for a pawn at each safety zone position
    PLAYERS.forEach((player, playerIdx) => {
        console.log(`\nPlayer ${playerIdx} (${player.name}) Movement Tests:`);
        
        // Create a test pawn at each safety position
        for (let safePos = 0; safePos < SAFETY_ZONE_LENGTH; safePos++) {
            console.log(`\n  Pawn at Safety Position ${safePos}:`);
            
            const testPawn = {
                id: 999,
                playerIndex: playerIdx,
                positionType: 'safe',
                positionIndex: safePos
            };
            
            // Test with cards 1-6
            for (let card = 1; card <= 6; card++) {
                console.log(`    Testing Card ${card}:`);
                
                // Calculate target position
                const targetPos = safePos + card;
                
                // Is the target position valid?
                if (targetPos < SAFETY_ZONE_LENGTH) {
                    console.log(`      ✓ Should move to safety position ${targetPos}`);
                } else if (targetPos === SAFETY_ZONE_LENGTH) {
                    console.log(`      ✓ Should move to Home (exact count)`);
                } else {
                    console.log(`      ✗ Invalid: Overshoots Home by ${targetPos - SAFETY_ZONE_LENGTH} spaces`);
                }
                
                // Test with real movement function
                const moves = getPossibleMovesForPawn(testPawn, card.toString());
                console.log(`      → Got ${moves.length} moves from getPossibleMovesForPawn()`);
                
                if (moves.length === 0) {
                    console.error(`      → ERROR: Expected valid move, got none!`);
                } else {
                    const move = moves[0];
                    console.log(`      → Move: Type=${move.positionType}, Index=${move.positionIndex}, Coords=(${move.pixelX},${move.pixelY})`);
                }
            }
        }
    });
    
    console.log("\n======== END DIAGNOSTIC ========\n");
}

// Direct, simplified function to handle movement within safety zones without complex logic
function getMovesWithinSafetyZone(pawn, steps) {
    // Simple validation
    if (pawn.positionType !== 'safe') return [];
    if (steps <= 0) return [];
    
    const moves = [];
    const playerIndex = pawn.playerIndex;
    const currentSafePos = pawn.positionIndex;
    const targetSafePos = currentSafePos + steps;
    
    console.log(`\n---- SAFETY ZONE MOVEMENT CHECK ----`);
    console.log(`Pawn ${pawn.id} (Player ${playerIndex}) at safety position ${currentSafePos}, steps=${steps}`);
    console.log(`Safety zone length: ${SAFETY_ZONE_LENGTH}`);
    
    // Case 1: Move stays within safety zone
    if (targetSafePos < SAFETY_ZONE_LENGTH) {
        // Check if destination is occupied
        const occupied = isOccupiedByOwnPawnSafe(playerIndex, targetSafePos);
        
        if (!occupied) {
            console.log(`Valid move within safety zone from ${currentSafePos} to ${targetSafePos}`);
            moves.push({
                type: 'move',
                positionType: 'safe',
                positionIndex: targetSafePos,
                pixelX: SAFETY_ZONES[playerIndex][targetSafePos].pixelX,
                pixelY: SAFETY_ZONES[playerIndex][targetSafePos].pixelY
            });
        }
    }
    // Case 2: Exact move to Home
    else if (targetSafePos === SAFETY_ZONE_LENGTH) {
        // Exact move to home
        console.log(`Exact move to home from safety position ${currentSafePos}`);
        moves.push({
            type: 'move',
            positionType: 'home',
            positionIndex: -1,
            pixelX: BOARD_LAYOUT.homeAreas[pawn.playerIndex].x * SQUARE_SIZE,
            pixelY: BOARD_LAYOUT.homeAreas[pawn.playerIndex].y * SQUARE_SIZE
        });
    }
    // Case 3: Overshoots Home
    else {
        // Overshot home
        console.log(`Overshot home from safety position ${currentSafePos} with ${steps} steps`);
    }
    
    return moves;
}

// Calculate the possible moves for a pawn based on a card
export function getPossibleMovesForPawn(pawn, card, stepsOverride = null) {
    const moves = [];
    const playerIndex = pawn.playerIndex;
    const startInfo = PLAYER_START_INFO[playerIndex];
    const cardValue = stepsOverride !== null ? stepsOverride.toString() : card;
    const numericCardValue = parseInt(cardValue);

    // If pawn is in safety zone, use our dedicated safety zone movement engine
    if (pawn.positionType === 'safe') {
        // Delegate ALL safety zone movement to our dedicated engine
        console.log(`Using safety zone movement engine for pawn ${pawn.id} with card ${cardValue}`);
        
        // For testing/debugging, we'll force-allow moves in the safety zone
        const forceAllowMove = false; // Changed from true to false to enforce occupation checks
        
        // Handle standard forward movement
        if (!isNaN(numericCardValue) && numericCardValue > 0 && cardValue !== '4') {
            // For regular numbered cards, simply pass to the engine
            moves.push(...safetyzoneMovementEngine(pawn, numericCardValue, forceAllowMove));
        }
        
        // Handle card 7 (splitting is handled at the UI level)
        if (cardValue === '7') {
            // Generate all possible moves for 1-7 spaces
            for (let steps = 1; steps <= 7; steps++) {
                const safetyMoves = safetyzoneMovementEngine(pawn, steps, forceAllowMove);
                
                // Add steps property for 7 card tracking
                safetyMoves.forEach(move => {
                    move.steps = steps;
                });
                
                moves.push(...safetyMoves);
            }
        }
        
        // Handle backward movement for card 4
        if (cardValue === '4' && pawn.positionIndex >= 4) {
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
        
        // Handle backward movement for card 10
        if (cardValue === '10' && pawn.positionIndex >= 1) {
            // Forward 10 (handled by standard movement above)
            
            // Backward 1 for card 10
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
        
        // Return now - we've handled all safety zone movement
        return moves;
    }

    // New handle for the 'entry' position type (pawn at safety zone entrance)
    if (pawn.positionType === 'entry') {
        // Pawn is at safety zone entrance - must enter safety zone if card allows forward movement
        if (cardValue !== '4' && cardValue !== 'Sorry!' && cardValue !== '11' && 
            (!isNaN(numericCardValue) && numericCardValue > 0)) {
            
            // The first step is used to enter the safety zone, leaving numericCardValue-1 steps
            // for movement within the safety zone
            const stepCount = numericCardValue - 1;
            
            // Safety zone has 5 spaces, and Home is at position 6 from the entrance
            // Entry counts as 1 move, so we need exactly 5 more to reach home
            
            // If we'd go beyond the safety zone's end (which is 4), it's invalid
            if (stepCount > 4) {
                // A move that would overshoot Home is invalid - need exact count to reach home
                console.log(`Invalid move: Card ${numericCardValue} would overshoot Home from entrance`);
                return [];
            }
            
            // Valid move into the safety zone
            return [{
                type: 'move',
                positionType: 'safe',
                positionIndex: stepCount,
                pixelX: SAFETY_ZONES[playerIndex][stepCount].pixelX,
                pixelY: SAFETY_ZONES[playerIndex][stepCount].pixelY
            }];
        }
        
        // No valid moves for this pawn if card doesn't allow forward movement into safety zone
        return [];
    }

    if (cardValue === '4') {
        if (pawn.positionType === 'board') {
            // Fix: Ensure proper backward movement with wrap-around
            // Adding PATH_LENGTH ensures we avoid negative indices
            const targetIndex = (pawn.positionIndex - 4 + PATH_LENGTH) % PATH_LENGTH;
            if (!isOccupiedByOwnPawnBoard(targetIndex, pawn.playerIndex)) {
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
        if (pawn.positionType === 'board') {
            const fwd10 = calculateForwardSteps(pawn, 10, startInfo);
            if (fwd10.type !== 'invalid') moves.push({ type: 'move', ...fwd10 });
        }
        
        if (pawn.positionType === 'board') {
            // Fix: Ensure proper backward movement with wrap-around for the card 10's backward 1
            // Adding PATH_LENGTH ensures we avoid negative indices
            const targetIndex = (pawn.positionIndex - 1 + PATH_LENGTH) % PATH_LENGTH;
            if (!isOccupiedByOwnPawnBoard(targetIndex, pawn.playerIndex)) {
                moves.push({
                    type: 'move',
                    positionType: 'board',
                    positionIndex: targetIndex,
                    pixelX: BOARD_PATH[targetIndex].pixelX,
                    pixelY: BOARD_PATH[targetIndex].pixelY
                });
            }
        }
    } else if (cardValue === '7') {
        // Special handling for card 7 - calculate all possible moves between 1-7 spaces
        if (pawn.positionType === 'board') {
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
            if (!isOccupiedByOwnPawnBoard(exitIndex, pawn.playerIndex)) {
                moves.push({
                    type: 'move',
                    positionType: 'board',
                    positionIndex: exitIndex,
                    pixelX: BOARD_PATH[exitIndex].pixelX,
                    pixelY: BOARD_PATH[exitIndex].pixelY
                });
            }
        } else if (pawn.positionType === 'board') {
            // Regular board movement
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
        
        // Check if move stays within the safety zone bounds (0-4 are valid positions)
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
            // Reached home with exact count - which is what we want
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

    // Important check: If we're starting on the board, we need to check if we would pass
    // through the safety entry point during our move - if so, the move is invalid per rule #3
    if (currentType === 'board') {
        // Get the safety entry point for this player
        const safetyEntry = startInfo.safetyEntryIndex;
        
        // Check if we would pass through the safety entry point
        // We need to check each position on our path
        for (let i = 1; i <= steps; i++) {
            const checkPos = (currentPos + i) % PATH_LENGTH;
            
            // If we'd pass through the safety entry (but not land on it), it's invalid
            if (checkPos === safetyEntry && i < steps) {
                console.log(`Invalid move: Cannot pass through safety entry point at ${safetyEntry}`);
                return { type: 'invalid' };
            }
        }
    }
    
    // Normal step-by-step movement
    while (stepsLeft > 0) {
        // Move forward one step
        if (currentType === 'board') {
            // Check if the NEXT position would be the safety entry point for this player
            const nextPos = (currentPos + 1) % PATH_LENGTH;
            
            // Handle regular movement (no automatic entry into safety zone)
            // Handle special wrap-around from position 59 to position 0
            if (currentPos === 59) {
                currentPos = 0;
            } else {
                // Standard increment for other positions
                currentPos = nextPos;
            }
            
            // Log each step for debugging wrap-around
            console.log(`Step ${steps - stepsLeft + 1}: Now at board position ${currentPos}`);
            
            // Check if we've landed exactly on the safety entry point with the last step
            if (currentPos === startInfo.safetyEntryIndex && stepsLeft === 1) {
                // Log detailed information about this safety entry
                console.log(`Landed on safety entry point at ${currentPos}, marking as 'entry'`);
                console.log(`SAFETY ENTRY DEBUG: Player ${pawn.playerIndex} (${PLAYERS[pawn.playerIndex].name})`);
                console.log(`SAFETY ENTRY DEBUG: Entry point defined as ${startInfo.safetyEntryIndex}`);
                
                // Return the right type of position
                return {
                    positionType: 'entry',  // Mark as at entry point
                    positionIndex: currentPos,
                    pixelX: BOARD_PATH[currentPos].pixelX,
                    pixelY: BOARD_PATH[currentPos].pixelY
                };
            }
        } else if (currentType === 'safe') {
            // Moving within safety zone
            currentPos++;
            console.log(`Step ${steps - stepsLeft + 1}: Now at safety position ${currentPos}`);
            
            // Check if we've reached home
            if (currentPos === SAFETY_ZONE_LENGTH) {
                // Reached home with exact count - but only if we've used all our steps
                if (stepsLeft === 1) {
                    console.log(`Exact move to home from safety position ${currentPos-1}`);
                    return {
                        positionType: 'home',
                        positionIndex: -1,
                        pixelX: BOARD_LAYOUT.homeAreas[pawn.playerIndex].x * SQUARE_SIZE,
                        pixelY: BOARD_LAYOUT.homeAreas[pawn.playerIndex].y * SQUARE_SIZE
                    };
                } else {
                    // Can't move to home if we have steps remaining - "bounce back"
                    console.log(`Overshot home from safety position ${currentPos-1} with ${stepsLeft-1} steps remaining`);
                    return { type: 'invalid' };
                }
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
        } else if (isOccupiedByOwnPawnBoard(currentPos, pawn.playerIndex)) {
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
    
    // Safety check: Ensure we're not landing on our own pawn
    if (destination.positionType === 'board' || destination.positionType === 'entry') {
        if (isOccupiedByOwnPawnBoard(destination.positionIndex, playerIndex)) {
            console.error(`ERROR: Cannot move to position already occupied by own pawn!`);
            gameState.message = "Invalid move: space already occupied by your pawn.";
            
            // Reset selection state
            gameState.selectedPawn = null;
            gameState.validMoves = [];
            gameState.selectablePawns = [];
            gameState.targetableOpponents = [];
            
            drawGame();
            updateUI();
            return; // Abort move
        }
    } else if (destination.positionType === 'safe') {
        if (isOccupiedByOwnPawnSafe(playerIndex, destination.positionIndex)) {
            console.error(`ERROR: Cannot move to safety position already occupied by own pawn!`);
            gameState.message = "Invalid move: safety space already occupied by your pawn.";
            
            // Reset selection state
            gameState.selectedPawn = null;
            gameState.validMoves = [];
            gameState.selectablePawns = [];
            gameState.targetableOpponents = [];
            
            drawGame();
            updateUI();
            return; // Abort move
        }
    }
    
    // Check for bumping opponent pawns when landing on a board square or safety entry point
    if (destination.positionType === 'board' || destination.positionType === 'entry') {
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
            if (finalBumpedPawn && finalBumpedPawn !== pawn && finalBumpedPawn.playerIndex !== playerIndex) {
                sendPawnToStart(finalBumpedPawn);
                message += ` Bumped another pawn after slide!`;
                console.log("Unexpected bump after slide!");
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

// ----- PHASE 2: ISOLATED SAFETY ZONE IMPLEMENTATION -----

/**
 * Standalone module for handling all safety zone movement
 * This function is the ONLY place that should generate safety zone moves
 * 
 * @param {Object} pawn - The pawn object with playerIndex, positionType='safe', positionIndex
 * @param {number|string} steps - Number of steps to move (from a card value)
 * @param {boolean} forceAllowMove - Optional: Force allow moves even if they would normally be blocked
 * @returns {Array} Array of valid move objects
 */
export function safetyzoneMovementEngine(pawn, steps, forceAllowMove = false) {
    // Input validation
    if (!pawn || typeof pawn !== 'object') {
        console.error("ERROR: Invalid pawn object");
        return [];
    }
    
    if (pawn.positionType !== 'safe') {
        console.error(`ERROR: Pawn position type is ${pawn.positionType}, not 'safe'`);
        return [];
    }
    
    // Convert steps to a number if it's a string (just like getPossibleMovesForPawn does)
    if (typeof steps === 'string') {
        steps = parseInt(steps);
    }
    
    if (typeof steps !== 'number' || isNaN(steps) || steps <= 0) {
        console.error(`ERROR: Invalid step count ${steps}`);
        return [];
    }
    
    // Setup
    const playerIndex = pawn.playerIndex;
    const currentPos = pawn.positionIndex;
    const targetPos = currentPos + steps;
    const moves = [];
    
    console.log(`\n[SAFETY ENGINE] Player ${playerIndex}/${PLAYERS[playerIndex].name}, pawn at position ${currentPos}, steps=${steps}`);
    
    // Check zone configuration
    if (!SAFETY_ZONES[playerIndex] || SAFETY_ZONES[playerIndex].length !== SAFETY_ZONE_LENGTH) {
        console.error(`ERROR: Safety zone for player ${playerIndex} is not properly configured`);
        return [];
    }
    
    // CASE 1: Moving within the safety zone (to position 0-4)
    if (targetPos < SAFETY_ZONE_LENGTH) {
        console.log(`[SAFETY ENGINE] Target is within zone at position ${targetPos}`);
        
        // Check if occupied by own pawn
        const occupied = isOccupiedByOwnPawnSafe(playerIndex, targetPos);
        
        if (!occupied || forceAllowMove) {
            // Either not occupied or we're forcing the move
            if (occupied && forceAllowMove) {
                console.log(`[SAFETY ENGINE] Position ${targetPos} is occupied but move forced!`);
            } else {
                console.log(`[SAFETY ENGINE] Creating move to safety position ${targetPos}`);
            }
            
            // Get coordinates
            const targetSpace = SAFETY_ZONES[playerIndex][targetPos];
            if (!targetSpace || !targetSpace.pixelX || !targetSpace.pixelY) {
                console.error(`ERROR: Missing coordinates for safety position ${targetPos}`);
                return [];
            }
            
            moves.push({
                type: 'move',
                positionType: 'safe',
                positionIndex: targetPos,
                pixelX: targetSpace.pixelX,
                pixelY: targetSpace.pixelY
            });
        } else {
            console.log(`[SAFETY ENGINE] Position ${targetPos} is occupied by own pawn. Move invalid.`);
        }
    }
    // CASE 2: Exact move to Home
    else if (targetPos === SAFETY_ZONE_LENGTH) {
        console.log(`[SAFETY ENGINE] Target is exact move to Home`);
        
        // Get home coordinates
        const homeCoord = BOARD_LAYOUT.homeAreas[playerIndex];
        if (!homeCoord || !homeCoord.x || !homeCoord.y) {
            console.error(`ERROR: Missing home coordinates for player ${playerIndex}`);
            return [];
        }
        
        moves.push({
            type: 'move',
            positionType: 'home',
            positionIndex: -1,
            pixelX: homeCoord.x * SQUARE_SIZE,
            pixelY: homeCoord.y * SQUARE_SIZE
        });
    }
    // CASE 3: Overshoots Home
    else {
        console.log(`[SAFETY ENGINE] Move invalid: overshoots Home by ${targetPos - SAFETY_ZONE_LENGTH} spaces`);
    }
    
    console.log(`[SAFETY ENGINE] Returning ${moves.length} valid moves\n`);
    return moves;
}

// ---- HELPER FUNCTIONS -----
