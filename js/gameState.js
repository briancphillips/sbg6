// Import constants
import { 
    BOARD_LAYOUT, PLAYER_START_INFO, SQUARE_SIZE, 
    PLAYERS, SLIDE_INFO, getPlayerCoords, PAWNS_PER_PLAYER
} from './constants.js';

// Board path and safety zones
export const BOARD_PATH = Array(60).fill().map((_, i) => {
    return {
        pixelX: 0,
        pixelY: 0,
        boardIndex: i
    };
});

export const SAFETY_ZONES = [
    Array(5).fill().map((_, i) => ({ pixelX: 0, pixelY: 0, safeIndex: i })), // Red (safety at index 2)
    Array(5).fill().map((_, i) => ({ pixelX: 0, pixelY: 0, safeIndex: i })), // Blue (safety at index 17)
    Array(5).fill().map((_, i) => ({ pixelX: 0, pixelY: 0, safeIndex: i })), // Yellow (safety at index 32)
    Array(5).fill().map((_, i) => ({ pixelX: 0, pixelY: 0, safeIndex: i }))  // Green (safety at index 47)
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
        secondPawn: null 
    } 
};

// Game state utility functions
export function getPawnAtBoardIndex(boardIndex) { 
    for (const player of gameState.players) { 
        for (const pawn of player.pawns) { 
            // Note: Position types can be 'start', 'board', 'entry', 'safe', or 'home'
            // Where 'entry' means the pawn is at the safety zone entrance (must enter on next turn)
            if ((pawn.positionType === 'board' || pawn.positionType === 'entry') && pawn.positionIndex === boardIndex) { 
                return pawn; 
            } 
        } 
    } 
    return null; 
}

export function getOwnPawnAtSafeZoneIndex(playerIndex, safeIndex) { 
    if (safeIndex < 0 || safeIndex >= SAFETY_ZONES[playerIndex].length) return null; 
    
    // Add detailed debug logging to see which pawns are being found
    console.log(`DETAILED DEBUG: Checking pawns at safety zone ${safeIndex} for player ${playerIndex}`)
    
    for (const pawn of gameState.players[playerIndex].pawns) {
        console.log(`DETAILED DEBUG: Pawn ${pawn.id} is at ${pawn.positionType} position ${pawn.positionIndex}`);
        
        if (pawn.positionType === 'safe' && pawn.positionIndex === safeIndex) {
            console.log(`DETAILED DEBUG: Found pawn ${pawn.id} at safety position ${safeIndex}`);
            return pawn;
        }
    }
    
    console.log(`DETAILED DEBUG: No pawn found at safety position ${safeIndex}`);
    return null;
}

export function isOccupiedByOwnPawnSafe(playerIndex, targetSafeIndex) { 
    // Add debug logging to identify why safety zone movement is failing
    console.log(`Checking if safety zone position ${targetSafeIndex} is occupied for player ${playerIndex}`);
    
    const result = getOwnPawnAtSafeZoneIndex(playerIndex, targetSafeIndex) !== null;
    console.log(`  - Result: ${result ? 'Occupied' : 'Not occupied'}`);
    
    // Add additional logging to inspect each pawn's position
    console.log(`  - DEBUG: Player ${playerIndex} pawns positions:`);
    gameState.players[playerIndex].pawns.forEach(pawn => {
        console.log(`    - Pawn ${pawn.id}: ${pawn.positionType} position ${pawn.positionIndex}`);
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
        console.log(`WARNING: Parameters to isOccupiedByOwnPawnBoard appear to be in wrong order! Swapping.`);
        [targetBoardIndex, playerIndex] = [playerIndex, targetBoardIndex];
    }
    
    console.log(`OCCUPATION CHECK: Board position ${targetBoardIndex}, Player ${playerIndex}`);
    const pawn = getPawnAtBoardIndex(targetBoardIndex); 
    console.log(`OCCUPATION RESULT: ${pawn ? `Found pawn belonging to player ${pawn.playerIndex}` : 'No pawn found'}`);
    
    return pawn !== null && pawn.playerIndex === playerIndex; 
}

export function sendPawnToStart(pawn) { 
    if (!pawn) return; 
    console.log(`Sending Player ${pawn.playerIndex} Pawn ${pawn.id} back to Start!`); 
    pawn.positionType = 'start'; 
    pawn.positionIndex = -1; 
}

export function getOpponentPawnsOnBoard(currentPlayerIndex) { 
    const opponents = []; 
    gameState.players.forEach((player, index) => { 
        if (index !== currentPlayerIndex) { 
            player.pawns.forEach(pawn => { 
                if (pawn.positionType === 'board' || pawn.positionType === 'entry') { 
                    opponents.push(pawn); 
                } 
            }); 
        } 
    }); 
    return opponents; 
}

export function getPlayerPawnsInStart(playerIndex) { 
    return gameState.players[playerIndex].pawns.filter(pawn => pawn.positionType === 'start'); 
}

export function initializeGameState() {
    gameState.players = PLAYERS.map((playerDetails, index) => {
        const pawns = [];
        for (let i = 0; i < PAWNS_PER_PLAYER; i++) {
            pawns.push({
                id: i,
                playerIndex: index,
                positionType: 'start',
                positionIndex: -1
            });
        }
        return {
            index: index,
            details: playerDetails,
            pawns: pawns
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
    gameState.splitData = { firstPawn: null, firstMoveValue: 0, secondPawn: null };
    gameState.message = `${PLAYERS[0].name}'s turn. Draw a card.`;
}
