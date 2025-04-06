// Import constants and game state
import { 
    SQUARE_SIZE, SAFETY_ZONE_LENGTH, PATH_LENGTH, 
    BOARD_LAYOUT, PLAYER_START_INFO, getPlayerCoords, PLAYERS
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
    
    // Verify and correct safety entry points
    validateSafetyEntryPoints();
}

// Validate safety entry points by checking coordinates of safety zone starts against board path positions
function validateSafetyEntryPoints() {
    console.log("=== VALIDATING SAFETY ENTRY POINTS ===");
    
    // For each player, determine the correct safety entry point based on geometry
    for (let playerIdx = 0; playerIdx < 4; playerIdx++) {
        // Get the claimed entry point from constants
        const claimedEntryIdx = PLAYER_START_INFO[playerIdx].safetyEntryIndex;
        console.log(`Player ${playerIdx} (${PLAYERS[playerIdx].name}): Claimed entry at position ${claimedEntryIdx}`);
        
        // Check the coordinates of the first safety zone position for this player
        const safetyStart = SAFETY_ZONES[playerIdx][0];
        
        if (!safetyStart) {
            console.error(`Missing safety zone start for player ${playerIdx}`);
            continue;
        }
        
        // Get direction vectors for each safety zone based on how they're constructed in initializeBoardPaths
        let entryDirection = { x: 0, y: 0 };
        
        switch (playerIdx) {
            case 0: // Red safety zone extends down, so entry is from above (0, -1)
                entryDirection.x = 0;
                entryDirection.y = -1;
                break;
            case 1: // Blue safety zone extends left, so entry is from right (1, 0)
                entryDirection.x = 1;
                entryDirection.y = 0;
                break;
            case 2: // Yellow safety zone extends up, so entry is from below (0, 1)
                entryDirection.x = 0;
                entryDirection.y = 1;
                break;
            case 3: // Green safety zone extends right, so entry is from left (-1, 0)
                entryDirection.x = -1;
                entryDirection.y = 0;
                break;
        }
        
        // Calculate the expected entry point grid position
        // This is the position adjacent to the safety zone start in the direction of entry
        const expectedEntryGridX = safetyStart.gridX + entryDirection.x;
        const expectedEntryGridY = safetyStart.gridY + entryDirection.y;
        
        console.log(`Safety zone start: (${safetyStart.gridX}, ${safetyStart.gridY})`);
        console.log(`Expected entry point: (${expectedEntryGridX}, ${expectedEntryGridY})`);
        
        // Find the board position with EXACTLY these grid coordinates
        let correctEntryIdx = -1;
        
        for (let i = 0; i < BOARD_PATH.length; i++) {
            const pos = BOARD_PATH[i];
            // Use exact grid coordinate matching, not distance
            if (pos.gridX === expectedEntryGridX && pos.gridY === expectedEntryGridY) {
                console.log(`Found exact match at board position ${i}: (${pos.gridX}, ${pos.gridY})`);
                correctEntryIdx = i;
                break;
            }
        }
        
        if (correctEntryIdx === -1) {
            console.error(`Could not find exact match for expected entry point (${expectedEntryGridX}, ${expectedEntryGridY})!`);
            console.log("Checking nearby positions as fallback...");
            
            // If we can't find an exact match, find the nearest board position as a fallback
            let minDistance = Infinity;
            
            for (let i = 0; i < BOARD_PATH.length; i++) {
                const pos = BOARD_PATH[i];
                const distance = Math.sqrt(
                    Math.pow(pos.gridX - expectedEntryGridX, 2) + 
                    Math.pow(pos.gridY - expectedEntryGridY, 2)
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    correctEntryIdx = i;
                }
            }
            
            console.log(`Falling back to nearest position ${correctEntryIdx} at distance ${minDistance.toFixed(2)}`);
        }
        
        // Check if there's a mismatch
        if (correctEntryIdx !== claimedEntryIdx) {
            console.warn(`MISMATCH DETECTED! Claimed: ${claimedEntryIdx}, Correct: ${correctEntryIdx}`);
            console.log(`Board position ${claimedEntryIdx} coordinates: (${BOARD_PATH[claimedEntryIdx].gridX}, ${BOARD_PATH[claimedEntryIdx].gridY})`);
            console.log(`Board position ${correctEntryIdx} coordinates: (${BOARD_PATH[correctEntryIdx].gridX}, ${BOARD_PATH[correctEntryIdx].gridY})`);
            
            // Update the constants at runtime (this won't change the file)
            PLAYER_START_INFO[playerIdx].safetyEntryIndex = correctEntryIdx;
            console.log(`Corrected entry point to: ${correctEntryIdx}`);
        } else {
            console.log(`Entry point ${claimedEntryIdx} is correct! Coordinates: (${BOARD_PATH[claimedEntryIdx].gridX}, ${BOARD_PATH[claimedEntryIdx].gridY})`);
        }
    }
    
    console.log("=== SAFETY ENTRY VALIDATION COMPLETE ===");
}
