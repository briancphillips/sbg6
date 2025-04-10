// Import constants and game state
import { 
    BOARD_SIZE, SQUARE_SIZE, BOARD_MARGIN, PAWN_RADIUS,
    BOARD_LAYOUT, PLAYERS, SLIDE_INFO, getPlayerCoords
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
            // Get start position directly from BOARD_LAYOUT
            const startCoord = {
                x: BOARD_LAYOUT.startAreas[pawn.playerIndex].x * SQUARE_SIZE,
                y: BOARD_LAYOUT.startAreas[pawn.playerIndex].y * SQUARE_SIZE
            };
            const angle = (pawn.id / 4) * Math.PI * 2 + pawn.playerIndex * Math.PI / 2;
            const radiusOffset = SQUARE_SIZE * BOARD_LAYOUT.startAreaRadius * 0.55;
            
            coords = {
                x: startCoord.x + Math.cos(angle) * radiusOffset,
                y: startCoord.y + Math.sin(angle) * radiusOffset
            };
        } else if (pawn.positionType === 'board' || pawn.positionType === 'entry') {
            // Both 'board' and 'entry' positions use board coordinates
            // 'entry' is visually the same as 'board' but with different game logic
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
            // Get home position directly from BOARD_LAYOUT
            const homeCoord = {
                x: BOARD_LAYOUT.homeAreas[pawn.playerIndex].x * SQUARE_SIZE,
                y: BOARD_LAYOUT.homeAreas[pawn.playerIndex].y * SQUARE_SIZE
            };
            const angle = (pawn.id / 4) * Math.PI * 2 + pawn.playerIndex * Math.PI / 1.5;
            const radiusOffset = SQUARE_SIZE * BOARD_LAYOUT.homeAreaRadius * 0.25;
            
            coords = {
                x: homeCoord.x + Math.cos(angle) * radiusOffset,
                y: homeCoord.y + Math.sin(angle) * radiusOffset
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
    // ctx.strokeStyle = '#a09383';
    // ctx.lineWidth = BOARD_MARGIN * 0.8;
    // ctx.strokeRect(BOARD_MARGIN / 2, BOARD_MARGIN / 2, BOARD_SIZE - BOARD_MARGIN, BOARD_SIZE - BOARD_MARGIN);
    
    // ctx.strokeStyle = '#d4c8bc';
    // ctx.lineWidth = BOARD_MARGIN * 0.2;
    // ctx.strokeRect(BOARD_MARGIN * 0.9, BOARD_MARGIN * 0.9, BOARD_SIZE - BOARD_MARGIN * 1.8, BOARD_SIZE - BOARD_MARGIN * 1.8);

    // --- Layer 1: Draw Base Track & Corner Squares (Opaque White) ---
    const trackColor = '#ffffff';
    const outlineColor = '#e0e0e0';
    
    // Draw main path squares from BOARD_PATH data
    BOARD_PATH.forEach((sq, index) => {
        drawRoundedRect(sq.gridX * SQUARE_SIZE + 2, sq.gridY * SQUARE_SIZE + 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 4, trackColor, outlineColor);
        
        // DEBUG: Draw position index on each square
        ctx.fillStyle = '#333333';
        ctx.font = `${SQUARE_SIZE * 0.25}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(index.toString(), sq.pixelX, sq.pixelY);
        
        // DEBUG: Draw grid coordinates in smaller text
        ctx.font = `${SQUARE_SIZE * 0.18}px monospace`;
        ctx.fillText(`(${sq.gridX},${sq.gridY})`, sq.pixelX, sq.pixelY + SQUARE_SIZE * 0.25);
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
            // Use grid coordinates for drawing
            drawRoundedRect(sq.gridX * SQUARE_SIZE + 2, sq.gridY * SQUARE_SIZE + 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 4, color, zoneOutline);
            
            // Draw safety zone index numbers for debugging
            ctx.fillStyle = '#000';
            ctx.font = `${SQUARE_SIZE * 0.25}px monospace`;
            ctx.fillText(sq.safeIndex.toString(), sq.pixelX, sq.pixelY);
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
                // Top row - should point right (east)
                ctx.moveTo(cx - sz, cy - sz*0.5);
                ctx.lineTo(cx - sz, cy + sz*0.5);
                ctx.lineTo(cx - sz + sz*0.866, cy);
            } else if (index < 30) {
                // Right column - should point down (south)
                ctx.moveTo(cx - sz*0.5, cy - sz);
                ctx.lineTo(cx + sz*0.5, cy - sz);
                ctx.lineTo(cx, cy - sz + sz*0.866);
            } else if (index < 45) {
                // Bottom row - should point left (west)
                ctx.moveTo(cx + sz, cy - sz*0.5);
                ctx.lineTo(cx + sz, cy + sz*0.5);
                ctx.lineTo(cx + sz - sz*0.866, cy);
            } else {
                // Left column - should point up (north)
                ctx.moveTo(cx - sz*0.5, cy + sz);
                ctx.lineTo(cx + sz*0.5, cy + sz);
                ctx.lineTo(cx, cy + sz - sz*0.866);
            }
            
            ctx.closePath();
            ctx.fill();
        }
    });

    // --- Layer 4: Draw Start and Home Areas ---
    PLAYERS.forEach((player, playerIndex) => {
        // Get player coordinates directly from BOARD_LAYOUT
        const startCoord = {
            x: BOARD_LAYOUT.startAreas[playerIndex].x * SQUARE_SIZE,
            y: BOARD_LAYOUT.startAreas[playerIndex].y * SQUARE_SIZE
        };
        const homeCoord = {
            x: BOARD_LAYOUT.homeAreas[playerIndex].x * SQUARE_SIZE,
            y: BOARD_LAYOUT.homeAreas[playerIndex].y * SQUARE_SIZE
        };
        
        // DEBUG: Log player coordinates
        console.log(`Player ${playerIndex} (${player.name}) - Drawing start at:`, 
            startCoord.x / SQUARE_SIZE, startCoord.y / SQUARE_SIZE,
            "Home at:", homeCoord.x / SQUARE_SIZE, homeCoord.y / SQUARE_SIZE);
        
        // Draw Start Area
        const startSize = SQUARE_SIZE * BOARD_LAYOUT.startAreaRadius * 2;
        const startX = startCoord.x - startSize / 2;
        const startY = startCoord.y - startSize / 2;
        
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
        ctx.fillText('S', startCoord.x, startCoord.y);
        ctx.shadowColor = 'transparent';
    });
    
    PLAYERS.forEach((player, playerIndex) => {
        // Get player coordinates directly from BOARD_LAYOUT
        const homeCoord = {
            x: BOARD_LAYOUT.homeAreas[playerIndex].x * SQUARE_SIZE,
            y: BOARD_LAYOUT.homeAreas[playerIndex].y * SQUARE_SIZE
        };
        
        // Draw Home Area
        const homeSize = SQUARE_SIZE * BOARD_LAYOUT.homeAreaRadius * 2;
        drawCircle(homeCoord.x, homeCoord.y, homeSize / 2, player.color + '22', player.color + 'aa', 3);
        drawCircle(homeCoord.x, homeCoord.y, homeSize / 2, player.color + '88', player.color + 'aa', 2);
        
        ctx.fillStyle = player.color;
        ctx.font = `bold ${SQUARE_SIZE * 0.55}px 'Press Start 2P'`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText('H', homeCoord.x, homeCoord.y);
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
