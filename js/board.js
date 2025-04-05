// Import constants and game state
import { 
    SQUARE_SIZE, SAFETY_ZONE_LENGTH, PATH_LENGTH, 
    BOARD_LAYOUT, PLAYER_START_INFO, getPlayerCoords 
} from './constants.js';
import { BOARD_PATH, SAFETY_ZONES } from './gameState.js';

// Initialize the board paths and safety zones
export function initializeBoardPaths() {
    console.log("Initializing board paths...");
    
    // Clear any existing paths
    while (BOARD_PATH.length > 0) BOARD_PATH.pop();
    SAFETY_ZONES.forEach(zone => { while(zone.length > 0) zone.pop(); });
    
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
    // Top row (15 cells)
    for (let i = 0; i < 15; i++) addSq(i + 1, 0);      
    
    // Right column (15 cells)
    for (let i = 0; i < 15; i++) addSq(15, i + 1);     
    
    // Bottom row (15 cells)
    for (let i = 0; i < 15; i++) addSq(14 - i, 15);    
    
    // Left column - properly space all 15 positions with unique coordinates
    for (let i = 0; i < 15; i++) {
        // Use 14-i to go from bottom to top
        if (i < 14) {
            addSq(0, 14 - i);  // Normal positions 45-58
        } else {
            // Ensure position 59 is at (0,0) to fix the path continuity
            addSq(0, 0);       // Position 59 at the top-left corner
        }
    }
    
    // Verify path length
    if (BOARD_PATH.length !== PATH_LENGTH) {
        console.error(`Board path length mismatch! Expected ${PATH_LENGTH}, got ${BOARD_PATH.length}`);
    }
    
    // Create safety zones using the BOARD_LAYOUT configuration
    // Red safety zone
    for (let i = 0; i < SAFETY_ZONE_LENGTH; i++) {
        const startX = BOARD_LAYOUT.safetyZones[0].x;
        const startY = BOARD_LAYOUT.safetyZones[0].y;
        // Direction: Moving down toward home
        SAFETY_ZONES[0].push({
            safeIndex: i,
            gridX: Math.floor(startX),
            gridY: Math.floor(startY) + i,
            pixelX: (Math.floor(startX) + 0.5) * SQUARE_SIZE,
            pixelY: (Math.floor(startY) + i + 0.5) * SQUARE_SIZE
        });
    }
    
    // Blue safety zone
    for (let i = 0; i < SAFETY_ZONE_LENGTH; i++) {
        const startX = BOARD_LAYOUT.safetyZones[1].x;
        const startY = BOARD_LAYOUT.safetyZones[1].y;
        // Direction: Moving left toward home
        SAFETY_ZONES[1].push({
            safeIndex: i,
            gridX: Math.floor(startX) - i,
            gridY: Math.floor(startY),
            pixelX: (Math.floor(startX) - i + 0.5) * SQUARE_SIZE,
            pixelY: (Math.floor(startY) + 0.5) * SQUARE_SIZE
        });
    }
    
    // Yellow safety zone
    for (let i = 0; i < SAFETY_ZONE_LENGTH; i++) {
        const startX = BOARD_LAYOUT.safetyZones[2].x;
        const startY = BOARD_LAYOUT.safetyZones[2].y;
        // Direction: Moving up toward home
        SAFETY_ZONES[2].push({
            safeIndex: i,
            gridX: Math.floor(startX),
            gridY: Math.floor(startY) - i,
            pixelX: (Math.floor(startX) + 0.5) * SQUARE_SIZE,
            pixelY: (Math.floor(startY) - i + 0.5) * SQUARE_SIZE
        });
    }
    
    // Green safety zone
    for (let i = 0; i < SAFETY_ZONE_LENGTH; i++) {
        const startX = BOARD_LAYOUT.safetyZones[3].x;
        const startY = BOARD_LAYOUT.safetyZones[3].y;
        // Direction: Moving right toward home
        SAFETY_ZONES[3].push({
            safeIndex: i,
            gridX: Math.floor(startX) + i,
            gridY: Math.floor(startY),
            pixelX: (Math.floor(startX) + i + 0.5) * SQUARE_SIZE,
            pixelY: (Math.floor(startY) + 0.5) * SQUARE_SIZE
        });
    }
}
