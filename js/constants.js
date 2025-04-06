// Game Constants
export const BOARD_SIZE = 600;
export const GRID_SIZE = 16;
export const SQUARE_SIZE = BOARD_SIZE / GRID_SIZE;
export const PAWN_RADIUS = SQUARE_SIZE * 0.35;
export const PATH_LENGTH = 60;
export const SAFETY_ZONE_LENGTH = 5;
export const BOARD_MARGIN = SQUARE_SIZE * 0.25;
export const PAWNS_PER_PLAYER = 4;

// Board layout configuration - independent of scaling
export const BOARD_LAYOUT = {
    // Positions are in grid units (will be multiplied by SQUARE_SIZE when used)
    startAreas: [
        { x: 5, y: 3 },    // Red
        { x: 13, y: 5 },   // Blue
        { x: 11, y: 13 },  // Yellow
        { x: 3, y: 11 }    // Green
    ],
    homeAreas: [
        { x: 2.5, y: 7 },    // Red
        { x: 9, y: 2.5 },   // Blue
        { x: 13.5, y: 9 },   // Yellow
        { x: 7, y: 13.5 }     // Green
    ],
    safetyZones: [
        { x: 2, y: 1 },    // Red (moving down towards home)
        { x: 14, y: 2 },   // Blue (moving left towards home)
        { x: 13, y: 14 },   // Yellow (moving up towards home)
        { x: 1, y: 13 }     // Green (moving right towards home)
    ],
    // Visual properties
    startAreaRadius: 1.5,  // In grid units
    homeAreaRadius: 1.0    // In grid units
};

// Player definitions - simplified without coordinates
export const PLAYERS = [
    { name: 'Red',    color: '#ef4444' },
    { name: 'Blue',   color: '#3b82f6' },
    { name: 'Yellow', color: '#eab308' },
    { name: 'Green',  color: '#22c55e' }
];

// Function to get player coordinates based on BOARD_LAYOUT
export function getPlayerCoords(playerIndex) {
    return {
        startCoord: {
            x: BOARD_LAYOUT.startAreas[playerIndex].x * SQUARE_SIZE,
            y: BOARD_LAYOUT.startAreas[playerIndex].y * SQUARE_SIZE
        },
        homeCoord: {
            x: BOARD_LAYOUT.homeAreas[playerIndex].x * SQUARE_SIZE,
            y: BOARD_LAYOUT.homeAreas[playerIndex].y * SQUARE_SIZE
        }
    };
}

// Player start and safety zone info
export const PLAYER_START_INFO = [ 
    { exitIndex: 4, safetyEntryIndex: 1 },  // Red - adjusted for (2,1) position
    { exitIndex: 19, safetyEntryIndex: 16 }, // Blue - adjusted for (14,2) position
    { exitIndex: 34, safetyEntryIndex: 31 }, // Yellow - adjusted for (13,14) position
    { exitIndex: 49, safetyEntryIndex: 46 }  // Green - corrected based on visual debug overlay
];

// Slide information
export const SLIDE_INFO = { 
    0: { len: 4, endBoardIndex: 4, colorIndex: 0 }, 
    8: { len: 5, endBoardIndex: 13, colorIndex: 0 }, 
    15: { len: 4, endBoardIndex: 19, colorIndex: 1 }, 
    23: { len: 5, endBoardIndex: 28, colorIndex: 1 }, 
    30: { len: 4, endBoardIndex: 34, colorIndex: 2 }, 
    38: { len: 5, endBoardIndex: 43, colorIndex: 2 }, 
    45: { len: 4, endBoardIndex: 49, colorIndex: 3 }, 
    53: { len: 5, endBoardIndex: (53+5) % PATH_LENGTH, colorIndex: 3 } 
};
