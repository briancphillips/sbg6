// Import constants and game state
import { 
    BOARD_SIZE, SQUARE_SIZE, BOARD_MARGIN, PAWN_RADIUS, 
    START_AREA_SIZE, HOME_AREA_SIZE, PLAYERS, SLIDE_INFO
} from './constants.js';
import { BOARD_PATH, SAFETY_ZONES, gameState } from './gameState.js';

// Canvas context
let ctx;

// Initialize the drawing module
export function initDrawing(canvasContext) {
    ctx = canvasContext;
}

// Helper drawing functions
export function drawRoundedRect(x, y, width, height, radius, color, outline = null) {
    ctx.fillStyle = color;
    ctx.strokeStyle = outline || color;
    ctx.lineWidth = outline ? 1 : 0;
    
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    
    ctx.fill();
    if (outline) ctx.stroke();
}

export function drawCircle(pixelX, pixelY, radius, color, outline = '#555', lineWidth = 2) {
    ctx.fillStyle = color;
    ctx.strokeStyle = outline;
    ctx.lineWidth = lineWidth;
    
    ctx.beginPath();
    ctx.arc(pixelX, pixelY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}

// Color utility functions
export function adjustColor(hex, percent) {
    try {
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        
        const num = parseInt(hex, 16);
        const amt = Math.round(2.55 * percent);
        
        let r = (num >> 16) + amt;
        let g = ((num >> 8) & 0x00FF) + amt;
        let b = (num & 0x0000FF) + amt;
        
        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));
        
        return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
    } catch (e) {
        console.error("Error adjusting color:", hex, e);
        return hex;
    }
}

export function lightenColor(hex, percent) {
    return adjustColor(hex, Math.abs(percent));
}

export function darkenColor(hex, percent) {
    return adjustColor(hex, -Math.abs(percent));
}

// Get pixel coordinates for pawns
export function getPixelCoordsForPawn(pawn) {
    if (!pawn) return null;
    
    let coords = null;
    try {
        if (pawn.positionType === 'start') {
            const playerDetails = PLAYERS[pawn.playerIndex];
            const angle = (pawn.id / 4) * Math.PI * 2 + pawn.playerIndex * Math.PI / 2;
            const radiusOffset = START_AREA_SIZE * 0.25;
            
            coords = {
                x: playerDetails.startCoord.x + Math.cos(angle) * radiusOffset,
                y: playerDetails.startCoord.y + Math.sin(angle) * radiusOffset
            };
        } else if (pawn.positionType === 'board') {
            if (pawn.positionIndex >= 0 && pawn.positionIndex < BOARD_PATH.length) {
                coords = {
                    x: BOARD_PATH[pawn.positionIndex].pixelX,
                    y: BOARD_PATH[pawn.positionIndex].pixelY
                };
            } else {
                console.error(`Invalid board index ${pawn.positionIndex} for pawn ${pawn.id}`);
            }
        } else if (pawn.positionType === 'safe') {
            if (pawn.positionIndex >= 0 && pawn.positionIndex < SAFETY_ZONES[pawn.playerIndex].length) {
                coords = {
                    x: SAFETY_ZONES[pawn.playerIndex][pawn.positionIndex].pixelX,
                    y: SAFETY_ZONES[pawn.playerIndex][pawn.positionIndex].pixelY
                };
            } else {
                console.error(`Invalid safe index ${pawn.positionIndex} for pawn ${pawn.id}`);
            }
        } else if (pawn.positionType === 'home') {
            const playerDetails = PLAYERS[pawn.playerIndex];
            const angle = (pawn.id / 4) * Math.PI * 2 + pawn.playerIndex * Math.PI / 1.5;
            const radiusOffset = HOME_AREA_SIZE * 0.25;
            
            coords = {
                x: playerDetails.homeCoord.x + Math.cos(angle) * radiusOffset,
                y: playerDetails.homeCoord.y + Math.sin(angle) * radiusOffset
            };
        }
    } catch (e) {
        console.error("Error in getPixelCoordsForPawn:", e, "Pawn:", pawn);
    }
    
    if (!coords) {
        console.error("Could not get coordinates for pawn:", pawn);
        return { x: -100, y: -100 };
    }
    
    return coords;
}

// Calculate squared distance (for efficiency)
export function distSq(x1, y1, x2, y2) {
    return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}

// Check if a click hits a pawn
export function isClickOnPawn(clickX, clickY, pawn) {
    const coords = getPixelCoordsForPawn(pawn);
    if (!coords) return false;
    return distSq(clickX, clickY, coords.x, coords.y) <= PAWN_RADIUS * PAWN_RADIUS;
}

// Check if a click hits a square
export function isClickOnSquare(clickX, clickY, squarePixelX, squarePixelY) {
    return distSq(clickX, clickY, squarePixelX, squarePixelY) <= (SQUARE_SIZE / 2) * (SQUARE_SIZE / 2);
}

// Draw the board
export function drawBoard() {
    // Clear background
    ctx.fillStyle = '#FEFDFB';
    ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

    // Draw outer board margin/border
    ctx.strokeStyle = '#a09383';
    ctx.lineWidth = BOARD_MARGIN * 0.8;
    ctx.strokeRect(BOARD_MARGIN / 2, BOARD_MARGIN / 2, BOARD_SIZE - BOARD_MARGIN, BOARD_SIZE - BOARD_MARGIN);
    
    ctx.strokeStyle = '#d4c8bc';
    ctx.lineWidth = BOARD_MARGIN * 0.2;
    ctx.strokeRect(BOARD_MARGIN * 0.9, BOARD_MARGIN * 0.9, BOARD_SIZE - BOARD_MARGIN * 1.8, BOARD_SIZE - BOARD_MARGIN * 1.8);

    // --- Layer 1: Draw Base Track & Corner Squares (Opaque White) ---
    const trackColor = '#ffffff';
    const outlineColor = '#e0e0e0';
    
    // Draw main path squares from BOARD_PATH data
    BOARD_PATH.forEach((sq, index) => {
        drawRoundedRect(sq.gridX * SQUARE_SIZE + 2, sq.gridY * SQUARE_SIZE + 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 4, trackColor, outlineColor);
    });
    
    // Explicitly draw the four corner squares using the same style
    drawRoundedRect(0 * SQUARE_SIZE + 2, 0 * SQUARE_SIZE + 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 4, trackColor, outlineColor); // Top-left (0,0)
    drawRoundedRect(15 * SQUARE_SIZE + 2, 0 * SQUARE_SIZE + 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 4, trackColor, outlineColor); // Top-right (15,0)
    drawRoundedRect(0 * SQUARE_SIZE + 2, 15 * SQUARE_SIZE + 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 4, trackColor, outlineColor); // Bottom-left (0,15)
    drawRoundedRect(15 * SQUARE_SIZE + 2, 15 * SQUARE_SIZE + 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 4, trackColor, outlineColor); // Bottom-right (15,15)

    // --- Layer 2: Draw Safety Zones ---
    SAFETY_ZONES.forEach((zone, playerIndex) => {
        const color = PLAYERS[playerIndex].color + '55'; // Semi-transparent fill
        const zoneOutline = PLAYERS[playerIndex].color + '88'; // Stronger outline
        
        zone.forEach(sq => {
            drawRoundedRect(sq.gridX * SQUARE_SIZE + 2, sq.gridY * SQUARE_SIZE + 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 4, color, zoneOutline);
        });
    });

    // --- Layer 3: Draw Slide Path Overlays & Start Markers ---
    BOARD_PATH.forEach((sq, index) => {
        let slidePathColor = null;
        let isSlideStart = false;
        const slideAtStart = SLIDE_INFO[index]; // Check if this index is a slide START

        // Determine if this square is part of any slide's path
        for (const startIdx in SLIDE_INFO) {
            const s = SLIDE_INFO[startIdx];
            const endIdx = s.endBoardIndex;
            const startIndex = parseInt(startIdx);
            const pathColor = PLAYERS[s.colorIndex].color + '30'; // Very transparent path

            if (index === startIndex) { // Is it the start square?
                isSlideStart = true;
                slidePathColor = PLAYERS[s.colorIndex].color + '50'; // Slightly stronger for start square background
                break; // Found the definitive role for this square
            } else if (startIndex > endIdx) { // Wrap around case
                if (index > startIndex || index < endIdx) { slidePathColor = pathColor; break; }
            } else { // Normal case
                if (index > startIndex && index < endIdx) { slidePathColor = pathColor; break; }
            }
        }

        // Draw slide path overlay if applicable (on top of white base)
        if (slidePathColor) {
            drawRoundedRect(sq.gridX * SQUARE_SIZE + 2, sq.gridY * SQUARE_SIZE + 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 4, slidePathColor);
        }

        // Draw slide START triangle indicator (on top of overlay)
        if (isSlideStart && slideAtStart) {
            ctx.fillStyle = PLAYERS[slideAtStart.colorIndex].color; // Opaque marker color
            ctx.beginPath();
            const cx = sq.pixelX;
            const cy = sq.pixelY;
            const sz = SQUARE_SIZE * 0.18;
            
            if (index < 15) {
                ctx.moveTo(cx - sz, cy + sz*1.5);
                ctx.lineTo(cx + sz, cy + sz*1.5);
                ctx.lineTo(cx, cy + sz*1.5 - sz*1.732);
            } else if (index < 30) {
                ctx.moveTo(cx - sz*1.5, cy - sz);
                ctx.lineTo(cx - sz*1.5, cy + sz);
                ctx.lineTo(cx - sz*1.5 + sz*1.732, cy);
            } else if (index < 45) {
                ctx.moveTo(cx - sz, cy - sz*1.5);
                ctx.lineTo(cx + sz, cy - sz*1.5);
                ctx.lineTo(cx, cy - sz*1.5 + sz*1.732);
            } else {
                ctx.moveTo(cx + sz*1.5, cy - sz);
                ctx.lineTo(cx + sz*1.5, cy + sz);
                ctx.lineTo(cx + sz*1.5 - sz*1.732, cy);
            }
            
            ctx.closePath();
            ctx.fill();
        }
    });

    // --- Layer 4: Draw Start and Home Areas ---
    PLAYERS.forEach(player => {
        // Draw Start Area
        const startSize = START_AREA_SIZE * 0.9;
        const startX = player.startCoord.x - startSize / 2;
        const startY = player.startCoord.y - startSize / 2;
        
        drawRoundedRect(startX, startY, startSize, startSize, 10, player.color + '44', player.color);
        drawRoundedRect(startX + 5, startY + 5, startSize - 10, startSize - 10, 8, '#ffffffcc');
        
        ctx.fillStyle = player.color;
        ctx.font = `bold ${SQUARE_SIZE * 0.55}px 'Press Start 2P'`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText('S', player.startCoord.x, player.startCoord.y);
        ctx.shadowColor = 'transparent';
    });
    
    PLAYERS.forEach(player => {
        // Draw Home Area
        drawCircle(player.homeCoord.x, player.homeCoord.y, HOME_AREA_SIZE / 2, player.color + '22', player.color + 'aa', 3);
        drawCircle(player.homeCoord.x, player.homeCoord.y, HOME_AREA_SIZE / 2.5, player.color + '88', player.color + 'aa', 2);
        
        ctx.fillStyle = player.color;
        ctx.font = `bold ${SQUARE_SIZE * 0.55}px 'Press Start 2P'`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText('H', player.homeCoord.x, player.homeCoord.y);
        ctx.shadowColor = 'transparent';
    });
}

// Draw pawns
export function drawPawns() {
    gameState.players.forEach(player => {
        player.pawns.forEach(pawn => {
            const coords = getPixelCoordsForPawn(pawn);
            if (coords && coords.x > -10) {
                // Get the correct color from the PLAYERS constant
                const color = PLAYERS[pawn.playerIndex].color;
                try {
                    // Draw shadow
                    drawCircle(coords.x, coords.y + 2, PAWN_RADIUS, 'rgba(0,0,0,0.15)');
                    
                    // Create gradient for pawn (optimizing to reduce lag)
                    const gradient = ctx.createRadialGradient(
                        coords.x - PAWN_RADIUS*0.2,
                        coords.y - PAWN_RADIUS*0.3,
                        PAWN_RADIUS*0.1,
                        coords.x,
                        coords.y,
                        PAWN_RADIUS
                    );
                    gradient.addColorStop(0, lightenColor(color, 30));
                    gradient.addColorStop(1, color);
                    
                    // Draw pawn
                    drawCircle(coords.x, coords.y, PAWN_RADIUS, gradient, darkenColor(color, 20), 2);
                    
                    const highlightOutlineWidth = 5;
                    
                    // Highlight selectable pawns
                    if (gameState.selectablePawns.includes(pawn)) {
                        drawCircle(coords.x, coords.y, PAWN_RADIUS + highlightOutlineWidth*0.6, 'rgba(0,0,0,0)', '#ffcc00', highlightOutlineWidth);
                    }
                    
                    // Highlight selected pawn
                    if (gameState.selectedPawn === pawn) {
                        drawCircle(coords.x, coords.y, PAWN_RADIUS + highlightOutlineWidth*0.6, 'rgba(0,0,0,0)', '#007bff', highlightOutlineWidth);
                    }
                    
                    // Highlight targetable opponents
                    if (gameState.targetableOpponents.includes(pawn)) {
                        drawCircle(coords.x, coords.y, PAWN_RADIUS + highlightOutlineWidth*0.6, 'rgba(0,0,0,0)', '#dc3545', highlightOutlineWidth);
                    }
                } catch (e) {
                    console.error("Error drawing pawn:", pawn, "at coords:", coords, e);
                    // Fallback to simpler drawing if gradient fails
                    drawCircle(coords.x, coords.y, PAWN_RADIUS, color, '#000000', 1);
                }
            } else if (coords.x <= -10) {
                console.warn(`Skipping drawing pawn ${pawn.id} due to off-screen coords.`);
            }
        });
    });
}

// Draw highlights for valid moves
export function drawHighlights() {
    if (gameState.selectedPawn && gameState.validMoves.length > 0) {
        ctx.fillStyle = 'rgba(76, 175, 80, 0.4)';
        ctx.strokeStyle = '#388E3C';
        ctx.lineWidth = 2.5;
        
        gameState.validMoves.forEach(move => {
            if (move.type === 'move') {
                ctx.beginPath();
                ctx.arc(move.pixelX, move.pixelY, SQUARE_SIZE * 0.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        });
    }
}

// Main drawing function
export function drawGame() {
    drawBoard();
    drawPawns();
    drawHighlights();
}
