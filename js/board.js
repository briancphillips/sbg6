// Import constants and game state
import { SQUARE_SIZE, SAFETY_ZONE_LENGTH, PATH_LENGTH } from './constants.js';
import { BOARD_PATH, SAFETY_ZONES } from './gameState.js';

// Initialize the board paths and safety zones
export function initializeBoardPaths() {
    console.log("Initializing board paths...");
    
    // Clear any existing paths
    BOARD_PATH.length = 0;
    SAFETY_ZONES.forEach(zone => zone.length = 0);
    
    // Helper to add a square to the board path
    function addSq(x, y) {
        BOARD_PATH.push({
            gridX: x,
            gridY: y,
            pixelX: (x + 0.5) * SQUARE_SIZE,
            pixelY: (y + 0.5) * SQUARE_SIZE
        });
    }
    
    // Create the main board path - clockwise from top left
    for (let i = 0; i < 15; i++) addSq(i + 1, 0);      // Top row
    for (let i = 0; i < 15; i++) addSq(15, i + 1);     // Right column
    for (let i = 0; i < 15; i++) addSq(14 - i, 15);    // Bottom row
    for (let i = 0; i < 15; i++) addSq(0, 14 - i);     // Left column
    
    // Fix the last square to ensure proper path length
    if (BOARD_PATH.length > 59) {
        BOARD_PATH[59] = {
            gridX: 0,
            gridY: 1,
            pixelX: 0.5 * SQUARE_SIZE,
            pixelY: 1.5 * SQUARE_SIZE
        };
    }
    
    // Verify path length
    if (BOARD_PATH.length !== PATH_LENGTH) {
        console.error(`Board path length mismatch! Expected ${PATH_LENGTH}, got ${BOARD_PATH.length}`);
    }
    
    // Create safety zones
    // Red safety zone (top)
    for (let i = 0; i < SAFETY_ZONE_LENGTH; i++) {
        SAFETY_ZONES[0].push({
            gridX: i + 1,
            gridY: 1,
            pixelX: (i + 1.5) * SQUARE_SIZE,
            pixelY: (1.5) * SQUARE_SIZE
        });
    }
    
    // Blue safety zone (right)
    for (let i = 0; i < SAFETY_ZONE_LENGTH; i++) {
        SAFETY_ZONES[1].push({
            gridX: 14,
            gridY: i + 1,
            pixelX: (14.5) * SQUARE_SIZE,
            pixelY: (i + 1.5) * SQUARE_SIZE
        });
    }
    
    // Yellow safety zone (bottom)
    for (let i = 0; i < SAFETY_ZONE_LENGTH; i++) {
        SAFETY_ZONES[2].push({
            gridX: 14 - i,
            gridY: 14,
            pixelX: (14.5 - i) * SQUARE_SIZE,
            pixelY: (14.5) * SQUARE_SIZE
        });
    }
    
    // Green safety zone (left)
    for (let i = 0; i < SAFETY_ZONE_LENGTH; i++) {
        SAFETY_ZONES[3].push({
            gridX: 1,
            gridY: 14 - i,
            pixelX: (1.5) * SQUARE_SIZE,
            pixelY: (14.5 - i) * SQUARE_SIZE
        });
    }
}
