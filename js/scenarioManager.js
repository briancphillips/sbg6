// Scenario Manager for Sorry! Game Testing
import { gameState, BOARD_PATH, SAFETY_ZONES } from './gameState.js';
import { PLAYERS, PLAYER_START_INFO } from './constants.js';
import { drawGame } from './drawing.js';
import { updateUI } from './ui.js';

// Collection of predefined scenarios
const SCENARIOS = {
    // Scenario 1: Test pawn collision at safety entry
    "safetyEntryCollision": {
        description: "Two pawns of the same color at safety entry point",
        setup: (playerIndex = 2) => { // Yellow by default
            // Reset the game state first
            resetGameState();
            
            // Set current player
            gameState.currentPlayerIndex = playerIndex;
            gameState.message = `Scenario: ${SCENARIOS.safetyEntryCollision.description}`;
            
            // Place one pawn at the safety entry position
            const entryIndex = PLAYER_START_INFO[playerIndex].safetyEntryIndex;
            const player = gameState.players[playerIndex];
            
            // First pawn at the entry point
            player.pawns[0].positionType = 'entry';
            player.pawns[0].positionIndex = entryIndex;
            
            // Second pawn one position before
            player.pawns[1].positionType = 'board';
            player.pawns[1].positionIndex = (entryIndex - 1 + BOARD_PATH.length) % BOARD_PATH.length;
            
            // Force specific card
            gameState.currentCard = "1";
            
            // Update display
            refresh();
            
            console.log(`Scenario loaded: ${SCENARIOS.safetyEntryCollision.description}`);
            console.log(`Player ${playerIndex} (${PLAYERS[playerIndex].name}) with two pawns near safety entry at ${entryIndex}`);
        }
    },
    
    // Scenario 2: Test safety zone movement and occupation checks
    "safetyZoneOccupation": {
        description: "Test safety zone occupation validation",
        setup: (playerIndex = 0) => { // Red by default
            // Reset the game state
            resetGameState();
            
            // Set current player
            gameState.currentPlayerIndex = playerIndex;
            gameState.message = `Scenario: ${SCENARIOS.safetyZoneOccupation.description}`;
            
            // Place pawns in the safety zone at different positions
            const player = gameState.players[playerIndex];
            
            // First pawn at safety position 0
            player.pawns[0].positionType = 'safe';
            player.pawns[0].positionIndex = 0;
            
            // Second pawn at safety position 2
            player.pawns[1].positionType = 'safe'; 
            player.pawns[1].positionIndex = 2;
            
            // Third pawn at board position one step before safety entry
            const entryIndex = PLAYER_START_INFO[playerIndex].safetyEntryIndex;
            player.pawns[2].positionType = 'board';
            player.pawns[2].positionIndex = (entryIndex - 1 + BOARD_PATH.length) % BOARD_PATH.length;
            
            // Force specific card
            gameState.currentCard = "2";
            
            // Update display
            refresh();
            
            console.log(`Scenario loaded: ${SCENARIOS.safetyZoneOccupation.description}`);
            console.log(`Player ${playerIndex} (${PLAYERS[playerIndex].name}) with pawns in safety zone`);
        }
    },
    
    // Scenario 3: Test slides and bumping
    "slideAndBump": {
        description: "Test slide mechanics and bumping",
        setup: (playerIndex = 0) => { // Red by default
            // Reset the game state
            resetGameState();
            
            // Set current player
            gameState.currentPlayerIndex = playerIndex;
            gameState.message = `Scenario: ${SCENARIOS.slideAndBump.description}`;
            
            // Place pawn at the position before a slide
            const slidePosition = 7; // Near red's first slide
            const player = gameState.players[playerIndex];
            
            // Place the current player's pawn before the slide
            player.pawns[0].positionType = 'board';
            player.pawns[0].positionIndex = slidePosition; 
            
            // Place opponent pawns on the slide path
            // Find opponent pawns (not from the current player)
            let opponentIndex = (playerIndex + 1) % 4;
            let opponent = gameState.players[opponentIndex];
            
            // Opponent pawn in the middle of the slide path
            opponent.pawns[0].positionType = 'board';
            opponent.pawns[0].positionIndex = slidePosition + 2;
            
            // Opponent pawn at the end of the slide
            opponent = gameState.players[(playerIndex + 2) % 4];
            opponent.pawns[0].positionType = 'board';
            opponent.pawns[0].positionIndex = slidePosition + 5;
            
            // Force specific card
            gameState.currentCard = "1";
            
            // Update display
            refresh();
            
            console.log(`Scenario loaded: ${SCENARIOS.slideAndBump.description}`);
            console.log(`Player ${playerIndex} (${PLAYERS[playerIndex].name}) before slide at position ${slidePosition}`);
        }
    },
    
    // Scenario 4: Test card 7 splitting
    "splitCard7": {
        description: "Test card 7 splitting mechanics",
        setup: (playerIndex = 0) => { // Red by default
            // Reset the game state
            resetGameState();
            
            // Set current player
            gameState.currentPlayerIndex = playerIndex;
            gameState.message = `Scenario: ${SCENARIOS.splitCard7.description}`;
            
            const player = gameState.players[playerIndex];
            
            // Place two pawns on the board at different positions
            player.pawns[0].positionType = 'board';
            player.pawns[0].positionIndex = 10;
            
            player.pawns[1].positionType = 'board';
            player.pawns[1].positionIndex = 20;
            
            // Force card 7
            gameState.currentCard = "7";
            
            // Update display
            refresh();
            
            console.log(`Scenario loaded: ${SCENARIOS.splitCard7.description}`);
            console.log(`Player ${playerIndex} (${PLAYERS[playerIndex].name}) with two pawns at positions 10 and 20`);
        }
    },
    
    // Scenario 5: Custom scenario (fully customizable)
    "custom": {
        description: "Custom scenario - fully configurable",
        setup: (config) => {
            // Reset the game state
            resetGameState();
            
            if (!config) {
                console.error("Custom scenario requires a configuration object");
                return;
            }
            
            // Set current player if specified
            if (config.currentPlayer !== undefined) {
                gameState.currentPlayerIndex = config.currentPlayer;
            }
            
            // Set custom message
            gameState.message = config.message || "Custom scenario";
            
            // Set pawn positions if provided
            if (config.pawns && Array.isArray(config.pawns)) {
                config.pawns.forEach(pawnSetup => {
                    if (pawnSetup.playerIndex >= 0 && pawnSetup.playerIndex < 4 &&
                        pawnSetup.pawnId >= 0 && pawnSetup.pawnId < 4) {
                        
                        const pawn = gameState.players[pawnSetup.playerIndex].pawns[pawnSetup.pawnId];
                        pawn.positionType = pawnSetup.positionType || 'start';
                        pawn.positionIndex = pawnSetup.positionIndex !== undefined ? pawnSetup.positionIndex : -1;
                    }
                });
            }
            
            // Set current card if specified
            if (config.card) {
                gameState.currentCard = config.card;
            }
            
            // Update display
            refresh();
            
            console.log("Custom scenario loaded");
        }
    }
};

// Helper function to reset the game state to starting position
function resetGameState() {
    // Clear existing pawns
    gameState.players.forEach(player => {
        player.pawns.forEach(pawn => {
            pawn.positionType = 'start';
            pawn.positionIndex = -1;
        });
    });
    
    // Reset other game state
    gameState.currentCard = null;
    gameState.selectedPawn = null;
    gameState.validMoves = [];
    gameState.selectablePawns = [];
    gameState.targetableOpponents = [];
    gameState.splitData = { firstPawn: null, firstMoveValue: 0, secondPawn: null };
    gameState.gameOver = false;
    gameState.currentAction = null;
}

// Helper function to refresh the display
function refresh() {
    drawGame();
    updateUI();
}

// Main function to load a scenario
export function loadScenario(scenarioName, config) {
    const scenario = SCENARIOS[scenarioName];
    
    if (!scenario) {
        console.error(`Unknown scenario: ${scenarioName}`);
        console.log(`Available scenarios: ${Object.keys(SCENARIOS).join(', ')}`);
        return;
    }
    
    // Load the scenario
    if (scenarioName === 'custom') {
        scenario.setup(config);
    } else {
        scenario.setup(config);
    }
}

// Export function to list available scenarios
export function listScenarios() {
    console.log("Available Test Scenarios:");
    
    Object.entries(SCENARIOS).forEach(([name, scenario]) => {
        console.log(`- ${name}: ${scenario.description}`);
    });
}
