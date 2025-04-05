// Main entry point for the Sorry! game
import { initializeBoardPaths } from './board.js';
import { initDrawing, drawGame } from './drawing.js';
import { gameState, initializeGameState } from './gameState.js';
import { initializeDeck } from './cards.js';
import { initUI, updateUI } from './ui.js';

// Initialize the game
export function initializeGame() {
    console.log("Initializing game...");
    
    // Get canvas and context
    const canvas = document.getElementById('sorryCanvas');
    const ctx = canvas.getContext('2d');
    
    // Initialize drawing module
    initDrawing(ctx);
    
    // Initialize the board paths
    initializeBoardPaths();
    
    // Initialize game state 
    initializeGameState();
    
    // Initialize the deck
    initializeDeck();
    
    // Initialize UI
    initUI({
        canvas: canvas,
        currentPlayerNameEl: document.getElementById('currentPlayerName'),
        currentPlayerColorEl: document.getElementById('currentPlayerColor'),
        cardDrawnEl: document.getElementById('cardDrawn'),
        messageAreaEl: document.getElementById('messageArea'),
        winMessageEl: document.getElementById('winMessage'),
        drawCardButton: document.getElementById('drawCardButton'),
        resetButton: document.getElementById('resetButton')
    });
    
    // Set up event listeners for game events
    window.addEventListener('resetGame', initializeGame);
    window.addEventListener('nextTurn', () => {
        nextTurn();
    });
    
    // Initial UI update and draw
    updateUI();
    drawGame();
    
    console.log("Game Initialized");
}

// Handle next turn 
function nextTurn() {
    // Move to next player
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    
    // Update message
    gameState.message = `${gameState.players[gameState.currentPlayerIndex].details.name}'s turn. Draw a card.`;
    
    // Update UI
    drawGame();
    updateUI();
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeGame);
