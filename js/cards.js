// Cards module for the Sorry! game

import { gameState } from './gameState.js';
import { PLAYERS } from './constants.js';

// Create a new deck of cards
export function createDeck() {
    const deck = [];
    const cardCounts = {
        '1': 5,
        '2': 4,
        '3': 4,
        '4': 4,
        '5': 4,
        'Sorry!': 4,
        '7': 4,
        '8': 4,
        '10': 4,
        '11': 4,
        '12': 4
    };
    
    for (const card in cardCounts) {
        for (let i = 0; i < cardCounts[card]; i++) {
            deck.push(card);
        }
    }
    
    return deck;
}

// Shuffle the deck using Fisher-Yates algorithm
export function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

// Initialize the deck
export function initializeDeck() {
    gameState.deck = createDeck();
    shuffleDeck(gameState.deck);
    gameState.discardPile = [];
}

// Draw a card from the deck
export function drawCard() {
    if (gameState.currentCard !== null || gameState.gameOver) return;
    
    // If deck is empty, reshuffle discard pile if available
    if (gameState.deck.length === 0) {
        if (gameState.discardPile.length === 0) {
            gameState.message = "No cards left!";
            return false;
        }
        
        gameState.deck = [...gameState.discardPile];
        gameState.discardPile = [];
        shuffleDeck(gameState.deck);
        gameState.message = "Reshuffled discard pile.";
    }
    
    // Verify we have cards to draw
    if (gameState.deck.length === 0) {
        console.error("Error: Attempted to draw from an empty deck");
        gameState.message = "Error: No cards available";
        return false;
    }
    
    // Draw a card
    gameState.currentCard = gameState.deck.pop();
    
    // Validate the drawn card
    if (gameState.currentCard === undefined || gameState.currentCard === null) {
        console.error("Error: Drew a null/undefined card");
        // Recover by creating a new deck
        initializeDeck();
        gameState.currentCard = gameState.deck.pop();
        gameState.message = "Card error detected - deck reset";
    }
    
    const currentPlayerName = PLAYERS[gameState.currentPlayerIndex].name;
    console.log(`Player ${gameState.currentPlayerIndex} (${currentPlayerName}) drew: ${gameState.currentCard}`);
    
    return true;
}
