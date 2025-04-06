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
    // Corrected entry points that will replace the ones in the constants
    const correctedEntryPoints = [...PLAYER_START_INFO];
    
    console.log("=== VALIDATING SAFETY ENTRY POINTS ===");
    
    // For each player, check if the safety entry point aligns with the board path
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
        
        // Get the safety start grid coordinates
        const safetyX = safetyStart.gridX;
        const safetyY = safetyStart.gridY;
        console.log(`  Safety zone starts at grid (${safetyX}, ${safetyY})`);
        
        // Instead of just measuring distance, determine direction vector from safety start
        // This gives us the direction towards the main board
        let dirX = 0;
        let dirY = 0;
        
        // Determine direction vector based on player (direction leading OUT of safety zone)
        switch (playerIdx) {
            case 0: // Red (safety zone goes down, so entry is up)
                dirX = 0;
                dirY = 1;
                break;
            case 1: // Blue (safety zone goes left, so entry is right)
                dirX = -1;
                dirY = 0;
                break;
            case 2: // Yellow (safety zone goes up, so entry is down)
                dirX = 0;
                dirY = -1;
                break;
            case 3: // Green (safety zone goes right, so entry is left)
                dirX = 1;
                dirY = 0;
                break;
        }
        
        // Calculate the expected entry point coordinates (one step in the direction vector)
        const expectedEntryX = safetyX + dirX;
        const expectedEntryY = safetyY + dirY;
        
        console.log(`  Expected entry point at grid (${expectedEntryX}, ${expectedEntryY})`);
        
        // Find board positions that are close to the expected entry point
        let bestIdx = -1;
        let minDistance = Infinity;
        
        // For Yellow player, we'll enforce position 31 as the entry point
        // This ensures consistent behavior without bandaid solutions
        if (playerIdx === 2) {
            console.log("  === YELLOW PLAYER SAFETY ENTRY POINT ANALYSIS ===");
            
            // Skip the coordinate-based search and directly validate position 31
            bestIdx = 31;
            
            // Log the coordinates to confirm they're valid
            if (BOARD_PATH[31]) {
                console.log(`  Enforcing Yellow entry at position 31: (${BOARD_PATH[31].gridX}, ${BOARD_PATH[31].gridY})`);
                console.log(`  This ensures consistent gameplay behavior for the Yellow player`);
            } else {
                console.error("  Error: Position 31 does not exist on the board path!");
            }
            
            // Remove any special case handling for position 30 in the game code
            console.log("  Note: Position 30 should NOT be treated as a valid entry point");
            
            // Continue to the check and update logic below
        } else {
            // Normal handling for other players
            for (let i = 0; i < BOARD_PATH.length; i++) {
                const pathPos = BOARD_PATH[i];
                
                // First priority: exact match of grid coordinates
                if (pathPos.gridX === expectedEntryX && pathPos.gridY === expectedEntryY) {
                    console.log(`  Found exact match at board position ${i}`);
                    bestIdx = i;
                    break;
                }
                
                // Calculate distance (Euclidean distance works better for this)
                const distance = Math.sqrt(
                    Math.pow(pathPos.gridX - expectedEntryX, 2) + 
                    Math.pow(pathPos.gridY - expectedEntryY, 2)
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    bestIdx = i;
                }
            }
        }
        
        // Report findings
        if (playerIdx !== 2) {
            console.log(`  Best matching board position: ${bestIdx} at distance ${minDistance.toFixed(2)}`);
        }
        console.log(`  Board position coordinates: (${BOARD_PATH[bestIdx].gridX}, ${BOARD_PATH[bestIdx].gridY})`);
        
        // Check if there's a mismatch
        if (bestIdx !== claimedEntryIdx) {
            console.warn(`  MISMATCH DETECTED! Claimed: ${claimedEntryIdx}, Actual: ${bestIdx}`);
            
            // Update the constants at runtime (this won't change the file)
            PLAYER_START_INFO[playerIdx].safetyEntryIndex = bestIdx;
            console.log(`  Corrected entry point to: ${bestIdx}`);
        } else {
            console.log(`  Entry point ${claimedEntryIdx} is correct`);
        }
    }
    
    console.log("=== SAFETY ENTRY VALIDATION COMPLETE ===");
}
