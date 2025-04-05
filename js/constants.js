// Game Constants
export const BOARD_SIZE = 600;
export const GRID_SIZE = 16;
export const SQUARE_SIZE = BOARD_SIZE / GRID_SIZE;
export const PAWN_RADIUS = SQUARE_SIZE * 0.35;
export const START_AREA_SIZE = SQUARE_SIZE * 4;
export const HOME_AREA_SIZE = SQUARE_SIZE * 3;
export const PATH_LENGTH = 60;
export const SAFETY_ZONE_LENGTH = 5;
export const BOARD_MARGIN = SQUARE_SIZE * 0.25;
export const PAWNS_PER_PLAYER = 4;

// Player definitions
export const PLAYERS = [
    { name: 'Red',    color: '#ef4444', startCoord: { x: 4 * SQUARE_SIZE, y: 4 * SQUARE_SIZE },  homeCoord: {x: 7.5 * SQUARE_SIZE, y: 2.5 * SQUARE_SIZE} },
    { name: 'Blue',   color: '#3b82f6', startCoord: { x: 12 * SQUARE_SIZE, y: 4 * SQUARE_SIZE }, homeCoord: {x: 13.5 * SQUARE_SIZE, y: 7.5 * SQUARE_SIZE} },
    { name: 'Yellow', color: '#eab308', startCoord: { x: 12 * SQUARE_SIZE, y: 12 * SQUARE_SIZE }, homeCoord: {x: 7.5 * SQUARE_SIZE, y: 13.5 * SQUARE_SIZE} },
    { name: 'Green',  color: '#22c55e', startCoord: { x: 4 * SQUARE_SIZE, y: 12 * SQUARE_SIZE }, homeCoord: {x: 2.5 * SQUARE_SIZE, y: 7.5 * SQUARE_SIZE} }
];

// Player start and safety zone info
export const PLAYER_START_INFO = [ 
    { exitIndex: 4, safetyEntryIndex: 1 }, 
    { exitIndex: 19, safetyEntryIndex: 16 }, 
    { exitIndex: 34, safetyEntryIndex: 31 }, 
    { exitIndex: 49, safetyEntryIndex: 46 } 
];

// Slide information
export const SLIDE_INFO = { 
    1: { len: 4, endBoardIndex: 5, colorIndex: 0 }, 
    9: { len: 5, endBoardIndex: 14, colorIndex: 0 }, 
    16: { len: 4, endBoardIndex: 20, colorIndex: 1 }, 
    24: { len: 5, endBoardIndex: 29, colorIndex: 1 }, 
    31: { len: 4, endBoardIndex: 35, colorIndex: 2 }, 
    39: { len: 5, endBoardIndex: 44, colorIndex: 2 }, 
    46: { len: 4, endBoardIndex: 50, colorIndex: 3 }, 
    54: { len: 5, endBoardIndex: (54+5) % PATH_LENGTH, colorIndex: 3 } 
};
