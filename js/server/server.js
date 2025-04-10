// server.js (Conceptual Example)
const { Server } = require("socket.io");
const http = require("http");

// --- Enhanced logging setup ---
function logWithTimestamp(type, message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

// Enable Socket.IO debug logs - will output to console
process.env.DEBUG = "socket.io:*";

// Create HTTP server and bind to all interfaces (0.0.0.0)
const httpServer = http.createServer((req, res) => {
  // Add request logging to see incoming connections
  logWithTimestamp("HTTP", `${req.method} ${req.url} HTTP/${req.httpVersion}`);

  // Simple health check endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", time: new Date().toISOString() }));
    return;
  }

  // For all other requests, return 404
  res.writeHead(404);
  res.end();
});

// Enhanced Socket.IO configuration with detailed logging
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow connections from any origin for simplicity (adjust for production)
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Add Socket.IO specific configuration parameters
  connectTimeout: 45000, // Longer timeout for debugging (45s vs default 20s)
  pingTimeout: 30000, // Longer ping timeout
  pingInterval: 25000, // Longer ping interval
});

// Listen on all interfaces
httpServer.listen(3000, "0.0.0.0", () => {
  logWithTimestamp("Server", "Socket.IO server listening on 0.0.0.0:3000");

  // Log the environment
  logWithTimestamp("Server", "Environment details:", {
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    env: process.env.NODE_ENV || "development",
  });
});

// *** Enhanced HTTP Server Error Logging ***
httpServer.on("error", (err) => {
  logWithTimestamp("HTTP Error", `Server error: ${err.message}`, {
    code: err.code,
    syscall: err.syscall,
    stack: err.stack,
  });
});
// ************************************

// --- IO Server Event Handlers ---
io.engine.on("connection_error", (err) => {
  logWithTimestamp("Socket.IO Engine", `Connection error:`, {
    message: err.message,
    code: err.code,
    type: err.type,
    stack: err.stack,
    req: err.req
      ? {
          url: err.req.url,
          headers: err.req.headers,
          method: err.req.method,
        }
      : "No request data",
  });
});

// Monitor Socket.IO server events
io.on("connect_error", (err) => {
  logWithTimestamp("Socket.IO Server", `Connect error:`, {
    message: err.message,
    code: err.code,
    stack: err.stack,
  });
});

// Log every Socket.IO handshake attempt, successful or not
io.engine.on("initial_headers", (headers, req) => {
  logWithTimestamp("Socket.IO Handshake", `Initial headers for ${req.url}`, {
    url: req.url,
    method: req.method,
    headers: req.headers,
  });
});

let rooms = {}; // { roomId: { gameState: {...}, players: { socketId: { name: '', playerIndex: X, pawns: [...] } }, playerOrder: [socketId,...], ... } }
let players = {}; // { socketId: { name: '', currentRoomId: '...' } }

// --- Simplified PLAYERS constant for server-side use ---
const PLAYERS_SERVER = [
  { name: "Red", color: "#ef4444" },
  { name: "Blue", color: "#3b82f6" },
  { name: "Yellow", color: "#eab308" },
  { name: "Green", color: "#22c55e" },
];

// --- Ported Constants (Essential for Server Logic) ---
const PATH_LENGTH = 60;
const SAFETY_ZONE_LENGTH = 5;
const PAWNS_PER_PLAYER = 4;
// Player start and safety zone info (Assuming client structure is correct)
const PLAYER_START_INFO_SERVER = [
  { exitIndex: 4, safetyEntryIndex: 1 }, // Red
  { exitIndex: 19, safetyEntryIndex: 16 }, // Blue
  { exitIndex: 34, safetyEntryIndex: 31 }, // Yellow
  { exitIndex: 49, safetyEntryIndex: 46 }, // Green
];
// Slide information (Assuming client structure is correct)
const SLIDE_INFO_SERVER = {
  0: { len: 4, endBoardIndex: 4, colorIndex: 0 },
  8: { len: 5, endBoardIndex: 13, colorIndex: 0 },
  15: { len: 4, endBoardIndex: 19, colorIndex: 1 },
  23: { len: 5, endBoardIndex: 28, colorIndex: 1 },
  30: { len: 4, endBoardIndex: 34, colorIndex: 2 },
  38: { len: 5, endBoardIndex: 43, colorIndex: 2 },
  45: { len: 4, endBoardIndex: 49, colorIndex: 3 },
  53: { len: 5, endBoardIndex: (53 + 5) % PATH_LENGTH, colorIndex: 3 },
};
// NOTE: BOARD_PATH and SAFETY_ZONES coordinates are NOT directly needed on the server
// if we only handle logic. Pixel coords are client-side concerns.
// However, logic functions might rely on the *existence* and structure.
// We assume the gameState passed to functions will have the correct player/pawn structure.

// --- Server-Side Game State Helpers (Adapted from client gameState.js/moves.js) ---

// Function to check if a pawn is on the main board track ('board' or 'entry')
function isPawnOnBoard(pawn) {
  return (
    pawn && (pawn.positionType === "board" || pawn.positionType === "entry")
  );
}

// Function to check if a pawn is in its safety zone
function isPawnInSafety(pawn) {
  return pawn && pawn.positionType === "safe";
}

// Function to check if a pawn is at Home
function isPawnAtHome(pawn) {
  return pawn && pawn.positionType === "home";
}

// Function to check if a pawn is at Start
function isPawnAtStart(pawn) {
  return pawn && pawn.positionType === "start";
}

// Function to check if a pawn is eligible for standard movement (on board or in safety)
function isPawnMovable(pawn) {
  return pawn && (isPawnOnBoard(pawn) || isPawnInSafety(pawn));
}

function getPawnById(roomGameState, playerIndex, pawnId) {
  if (
    !roomGameState ||
    !roomGameState.players ||
    !roomGameState.players[playerIndex]
  ) {
    console.error(
      `[ServerHelpers] Invalid gameState or playerIndex ${playerIndex} in getPawnById`
    );
    return null;
  }
  const player = roomGameState.players[playerIndex];
  if (!player.pawns) {
    console.error(`[ServerHelpers] Player ${playerIndex} has no pawns array.`);
    return null;
  }
  const pawn = player.pawns.find((p) => p.id === pawnId);
  if (!pawn) {
    // This happens often during setup/initialization, less critical
    // console.warn(`[ServerHelpers] Pawn ${pawnId} not found for player ${playerIndex}. Pawns:`, player.pawns);
  }
  return pawn || null;
}

// Find a pawn at a specific board index (on the main 60-space track)
function getPawnAtBoardIndex(roomGameState, boardIndex) {
  if (!roomGameState || !roomGameState.players) return null;
  for (const player of roomGameState.players) {
    if (player && player.pawns && player.type !== "disconnected") {
      // Check active players
      for (const pawn of player.pawns) {
        if (
          (pawn.positionType === "board" || pawn.positionType === "entry") &&
          pawn.positionIndex === boardIndex
        ) {
          return pawn;
        }
      }
    }
  }
  return null;
}

// Find a player's OWN pawn at a specific index within their safety zone
function getOwnPawnAtSafeZoneIndex(roomGameState, playerIndex, safeIndex) {
  if (
    !roomGameState ||
    !roomGameState.players ||
    !roomGameState.players[playerIndex] ||
    !roomGameState.players[playerIndex].pawns
  )
    return null;
  if (safeIndex < 0 || safeIndex >= SAFETY_ZONE_LENGTH) return null;

  for (const pawn of roomGameState.players[playerIndex].pawns) {
    if (pawn.positionType === "safe" && pawn.positionIndex === safeIndex) {
      return pawn;
    }
  }
  return null;
}

// Check if a board position is occupied by an opponent
function isOccupiedByOpponent(
  roomGameState,
  targetBoardIndex,
  currentPlayerIndex
) {
  const pawn = getPawnAtBoardIndex(roomGameState, targetBoardIndex);
  return pawn !== null && pawn.playerIndex !== currentPlayerIndex;
}

// Check if a board position is occupied by the player's own pawn
function isOccupiedByOwnPawnBoard(
  roomGameState,
  targetBoardIndex,
  playerIndex
) {
  const pawn = getPawnAtBoardIndex(roomGameState, targetBoardIndex);
  return pawn !== null && pawn.playerIndex === playerIndex;
}

// Check if a safety zone position is occupied by the player's own pawn
function isOccupiedByOwnPawnSafe(roomGameState, playerIndex, targetSafeIndex) {
  return (
    getOwnPawnAtSafeZoneIndex(roomGameState, playerIndex, targetSafeIndex) !==
    null
  );
}

// Sends a pawn back to its start position (modifies the pawn object directly)
function sendPawnToStartServer(pawn) {
  if (!pawn) return;
  console.log(
    `[ServerAction] Sending Player ${pawn.playerIndex} Pawn ${pawn.id} back to Start!`
  );
  pawn.positionType = "start";
  pawn.positionIndex = -1;
}

// Get opponent pawns currently on the main board track
function getOpponentPawnsOnBoard(roomGameState, currentPlayerIndex) {
  const opponents = [];
  if (!roomGameState || !roomGameState.players) return opponents;

  roomGameState.players.forEach((player, index) => {
    if (
      index !== currentPlayerIndex &&
      player &&
      player.pawns &&
      player.type !== "disconnected"
    ) {
      player.pawns.forEach((pawn) => {
        if (isPawnOnBoard(pawn)) {
          // Uses helper above
          opponents.push(pawn);
        }
      });
    }
  });
  return opponents;
}

// Get a player's pawns currently in their Start area
function getPlayerPawnsInStart(roomGameState, playerIndex) {
  if (
    !roomGameState ||
    !roomGameState.players ||
    !roomGameState.players[playerIndex] ||
    !roomGameState.players[playerIndex].pawns
  )
    return [];
  return roomGameState.players[playerIndex].pawns.filter(isPawnAtStart); // Uses helper
}

// Server-side equivalent of resetTurnState - clears specific fields in gameState
function resetTurnStateServer(roomGameState) {
  if (!roomGameState) return;
  console.log(
    `[ServerAction] Resetting turn state for room ${roomGameState.roomId}`
  );
  roomGameState.selectedPawn = null; // Store selected pawn OBJECT reference
  roomGameState.selectablePawns = []; // Store PAWN IDs
  roomGameState.validMoves = []; // Store move objects { type, positionType, positionIndex, ... }
  roomGameState.targetableOpponents = []; // Store PAWN IDs
  roomGameState.currentAction = null;
  roomGameState.splitData = {
    firstPawn: null,
    firstMoveValue: 0,
    secondPawn: null,
  };
  roomGameState.splitMandatory = false;
  // Do not reset message or currentCard here
}

// --- Server-Side Move Calculation Logic (Adapted from client moves.js) ---

// Calculate forward steps from a position (Server version)
// Returns a move object { positionType, positionIndex } or { type: "invalid" }
function calculateForwardStepsServer(roomGameState, pawn, steps) {
  const playerIndex = pawn.playerIndex;
  const startInfo = PLAYER_START_INFO_SERVER[playerIndex];
  let currentPos = pawn.positionIndex;
  let currentType = pawn.positionType;
  let stepsLeft = steps;

  // Log initial state for debugging on server
  console.log(
    `[ServerMoveCalc] Calculating forward steps: Player ${playerIndex}, Pawn ${pawn.id} at ${currentType} ${currentPos}, moving ${steps} steps`
  );

  // Handle movement entirely within safety zone
  if (currentType === "safe") {
    const targetSafeIndex = currentPos + steps;
    if (targetSafeIndex < SAFETY_ZONE_LENGTH) {
      if (
        !isOccupiedByOwnPawnSafe(roomGameState, playerIndex, targetSafeIndex)
      ) {
        return { positionType: "safe", positionIndex: targetSafeIndex };
      } else {
        return { type: "invalid" };
      }
    } else if (targetSafeIndex === SAFETY_ZONE_LENGTH) {
      return { positionType: "home", positionIndex: -1 };
    } else {
      return { type: "invalid" }; // Overshot home
    }
  }

  // Check if move would pass *through* safety entry (invalid)
  if (currentType === "board") {
    const safetyEntry = startInfo.safetyEntryIndex;
    for (let i = 1; i <= steps; i++) {
      const checkPos = (currentPos + i) % PATH_LENGTH;
      if (checkPos === safetyEntry && i < steps) {
        console.log(
          `[ServerMoveCalc] Invalid move: Cannot pass through safety entry point ${safetyEntry}`
        );
        return { type: "invalid" };
      }
    }
  }

  // Step-by-step movement simulation
  while (stepsLeft > 0) {
    let intermediatePos;
    if (currentType === "board") {
      const nextPos = (currentPos + 1) % PATH_LENGTH;
      intermediatePos = currentPos === 59 ? 0 : nextPos; // Handle wrap-around

      // Check intermediate occupation by OWN pawn (invalid)
      if (
        stepsLeft > 1 &&
        isOccupiedByOwnPawnBoard(roomGameState, intermediatePos, playerIndex)
      ) {
        const occupier = getPawnAtBoardIndex(roomGameState, intermediatePos);
        // Ensure it's not the moving pawn itself somehow
        if (
          !occupier ||
          occupier.id !== pawn.id ||
          occupier.playerIndex !== playerIndex
        ) {
          console.log(
            `[ServerMoveCalc] Invalid move: Path blocked by own pawn at intermediate step ${intermediatePos}`
          );
          return { type: "invalid" };
        }
      }
      currentPos = intermediatePos; // Update position

      // Check if landing exactly on safety entry point *on the last step*
      if (currentPos === startInfo.safetyEntryIndex && stepsLeft === 1) {
        // Check if entry point itself is occupied by OWN pawn (board or entry type)
        let entryOccupied = false;
        for (const otherPawn of roomGameState.players[playerIndex].pawns) {
          if (
            otherPawn.id !== pawn.id &&
            (otherPawn.positionType === "board" ||
              otherPawn.positionType === "entry") &&
            otherPawn.positionIndex === currentPos
          ) {
            entryOccupied = true;
            break;
          }
        }
        if (entryOccupied) {
          console.log(
            `[ServerMoveCalc] Invalid move: Entry point ${currentPos} already occupied by own pawn`
          );
          return { type: "invalid" };
        }
        console.log(
          `[ServerMoveCalc] Landed on safety entry point ${currentPos}`
        );
        return { positionType: "entry", positionIndex: currentPos };
      }
    } else if (currentType === "safe") {
      // This case should be handled by the initial check, but include for robustness
      const targetSafeIndex = currentPos + 1;
      if (targetSafeIndex < SAFETY_ZONE_LENGTH) {
        // Check intermediate occupation by own pawn
        if (
          stepsLeft > 1 &&
          isOccupiedByOwnPawnSafe(roomGameState, playerIndex, targetSafeIndex)
        ) {
          console.log(
            `[ServerMoveCalc] Invalid move: Safety path blocked by own pawn at intermediate step ${targetSafeIndex}`
          );
          return { type: "invalid" };
        }
        currentPos = targetSafeIndex;
      } else if (targetSafeIndex === SAFETY_ZONE_LENGTH && stepsLeft === 1) {
        // Exact move to home on last step
        return { positionType: "home", positionIndex: -1 };
      } else {
        // Overshot or blocked intermediate step to home
        return { type: "invalid" };
      }
    } else if (currentType === "entry") {
      // If somehow calculateForwardStepsServer is called on an 'entry' pawn (shouldn't happen)
      console.error(
        "[ServerMoveCalc] Error: calculateForwardStepsServer called on pawn already at 'entry'"
      );
      return { type: "invalid" };
    }

    stepsLeft--;
  }

  // Final position check after all steps
  if (currentType === "board") {
    if (isOccupiedByOwnPawnBoard(roomGameState, currentPos, playerIndex)) {
      // Landed on own pawn (different from intermediate check)
      console.log(
        `[ServerMoveCalc] Invalid move: Final board position ${currentPos} occupied by own pawn`
      );
      return { type: "invalid" };
    }
    // Landing on opponent is allowed (bump happens later)
    // Landing on empty square is allowed
    return { positionType: "board", positionIndex: currentPos };
  } else if (currentType === "safe") {
    // Should have returned earlier if moving within safe or to home
    // This path implies an error or overshoot condition not caught
    console.warn(
      `[ServerMoveCalc] Unexpected state: Reached end of calculation for safe pawn at pos ${currentPos}`
    );
    return { type: "invalid" };
  }

  // Should not be reached
  console.error(
    "[ServerMoveCalc] Error: Calculation reached unexpected end state."
  );
  return { type: "invalid" };
}

// Calculate possible moves for a pawn based on a card (Server version)
// Returns an array of valid move objects { type, positionType, positionIndex, steps? (for 7), bump? }
function getPossibleMovesForPawnServer(roomGameState, pawn, card) {
  const moves = [];
  if (!pawn || !card) return moves;

  const playerIndex = pawn.playerIndex;
  const startInfo = PLAYER_START_INFO_SERVER[playerIndex];
  const numericCardValue = parseInt(card);
  const isNumeric = !isNaN(numericCardValue);

  // --- Handle Pawn in Safety Zone ---
  if (isPawnInSafety(pawn)) {
    const currentSafePos = pawn.positionIndex;
    // Card 4: Move back 4
    if (card === "4" && currentSafePos >= 4) {
      const targetSafeIndex = currentSafePos - 4;
      if (
        !isOccupiedByOwnPawnSafe(roomGameState, playerIndex, targetSafeIndex)
      ) {
        moves.push({
          type: "move",
          positionType: "safe",
          positionIndex: targetSafeIndex,
        });
      }
    }
    // Card 10: Move back 1
    else if (card === "10" && currentSafePos >= 1) {
      const targetSafeIndex = currentSafePos - 1;
      if (
        !isOccupiedByOwnPawnSafe(roomGameState, playerIndex, targetSafeIndex)
      ) {
        moves.push({
          type: "move",
          positionType: "safe",
          positionIndex: targetSafeIndex,
        });
      }
      // Also handle forward 10 below
    }
    // Card 7: Split moves (1-7)
    else if (card === "7") {
      for (let steps = 1; steps <= 7; steps++) {
        const targetSafePos = currentSafePos + steps;
        if (targetSafePos < SAFETY_ZONE_LENGTH) {
          if (
            !isOccupiedByOwnPawnSafe(roomGameState, playerIndex, targetSafePos)
          ) {
            moves.push({
              type: "move",
              positionType: "safe",
              positionIndex: targetSafePos,
              steps: steps,
            });
          }
        } else if (targetSafePos === SAFETY_ZONE_LENGTH) {
          moves.push({
            type: "move",
            positionType: "home",
            positionIndex: -1,
            steps: steps,
          });
        }
      }
    }
    // Regular forward moves (1, 2, 3, 5, 8, 10, 12)
    else if (isNumeric && numericCardValue > 0 && card !== "4") {
      const targetSafePos = currentSafePos + numericCardValue;
      if (targetSafePos < SAFETY_ZONE_LENGTH) {
        if (
          !isOccupiedByOwnPawnSafe(roomGameState, playerIndex, targetSafePos)
        ) {
          moves.push({
            type: "move",
            positionType: "safe",
            positionIndex: targetSafePos,
          });
        }
      } else if (targetSafePos === SAFETY_ZONE_LENGTH) {
        moves.push({ type: "move", positionType: "home", positionIndex: -1 });
      }
    }
    return moves; // All safety zone logic handled
  }

  // --- Handle Pawn at Safety Zone Entrance ('entry') ---
  if (pawn.positionType === "entry") {
    // Card 7: Split moves into safety zone
    if (card === "7") {
      for (let steps = 1; steps <= 7; steps++) {
        const targetSafeIndex = steps - 1; // 1 step = index 0, 2 steps = index 1, ...
        if (
          targetSafeIndex < SAFETY_ZONE_LENGTH &&
          !isOccupiedByOwnPawnSafe(roomGameState, playerIndex, targetSafeIndex)
        ) {
          moves.push({
            type: "move",
            positionType: "safe",
            positionIndex: targetSafeIndex,
            steps: steps,
          });
        }
      }
    }
    // Regular forward moves (1, 2, 3, 5, 8, 10, 12)
    else if (isNumeric && numericCardValue > 0 && card !== "4") {
      const targetSafeIndex = numericCardValue - 1;
      if (
        targetSafeIndex < SAFETY_ZONE_LENGTH &&
        !isOccupiedByOwnPawnSafe(roomGameState, playerIndex, targetSafeIndex)
      ) {
        moves.push({
          type: "move",
          positionType: "safe",
          positionIndex: targetSafeIndex,
        });
      }
    }
    // No other moves possible from 'entry' position (no backward, no Sorry!, no 11 swap)
    return moves;
  }

  // --- Handle Pawn at Start ('start') ---
  if (isPawnAtStart(pawn)) {
    // Card 1 or 2: Move to exit square
    if (card === "1" || card === "2") {
      const exitIndex = startInfo.exitIndex;
      if (!isOccupiedByOwnPawnBoard(roomGameState, exitIndex, playerIndex)) {
        moves.push({
          type: "move",
          positionType: "board",
          positionIndex: exitIndex,
        });
      }
    }
    // Sorry! card is handled differently (selecting target opponent)
    // No other cards allow movement from start
    return moves;
  }

  // --- Handle Pawn on Board ('board') ---
  if (isPawnOnBoard(pawn)) {
    // Card 4: Move backward 4
    if (card === "4") {
      const targetIndex = (pawn.positionIndex - 4 + PATH_LENGTH) % PATH_LENGTH;
      if (!isOccupiedByOwnPawnBoard(roomGameState, targetIndex, playerIndex)) {
        moves.push({
          type: "move",
          positionType: "board",
          positionIndex: targetIndex,
        });
      }
    }
    // Card 10: Forward 10 OR Backward 1
    else if (card === "10") {
      // Forward 10
      const fwd10 = calculateForwardStepsServer(roomGameState, pawn, 10);
      if (fwd10.type !== "invalid") moves.push({ type: "move", ...fwd10 });
      // Backward 1
      const targetIndexBwd =
        (pawn.positionIndex - 1 + PATH_LENGTH) % PATH_LENGTH;
      if (
        !isOccupiedByOwnPawnBoard(roomGameState, targetIndexBwd, playerIndex)
      ) {
        moves.push({
          type: "move",
          positionType: "board",
          positionIndex: targetIndexBwd,
        });
      }
    }
    // Card 7: Split moves (1-7)
    else if (card === "7") {
      for (let steps = 1; steps <= 7; steps++) {
        const fwdMove = calculateForwardStepsServer(roomGameState, pawn, steps);
        if (fwdMove.type !== "invalid") {
          moves.push({ type: "move", ...fwdMove, steps: steps });
        }
      }
    }
    // Card 11: Move forward 11 (swap is handled separately)
    else if (card === "11") {
      const fwd11 = calculateForwardStepsServer(roomGameState, pawn, 11);
      if (fwd11.type !== "invalid") moves.push({ type: "move", ...fwd11 });
    }
    // Regular forward moves (1, 2, 3, 5, 8, 12)
    else if (
      isNumeric &&
      numericCardValue > 0 &&
      card !== "4" &&
      card !== "10" &&
      card !== "7" &&
      card !== "11"
    ) {
      const fwdMove = calculateForwardStepsServer(
        roomGameState,
        pawn,
        numericCardValue
      );
      if (fwdMove.type !== "invalid") moves.push({ type: "move", ...fwdMove });
    }
  }

  // Add bump check for moves ending on the board
  moves.forEach((move) => {
    if (
      move.positionType === "board" &&
      isOccupiedByOpponent(roomGameState, move.positionIndex, playerIndex)
    ) {
      move.bump = true;
    }
  });

  return moves;
}

// Determine selectable pawns and targets based on card (Server version)
// Returns an object { selectablePawns: [pawnId...], targetableOpponents: [pawnId...], splitMandatory: bool }
// Modifies roomGameState by setting currentAction
function determineActionsForCardServer(roomGameState, playerIndex, card) {
  resetTurnStateServer(roomGameState); // Clear previous turn state first
  const player = roomGameState.players[playerIndex];
  const results = {
    selectablePawns: [],
    targetableOpponents: [],
    splitMandatory: false,
  };

  if (!player || !player.pawns) return results; // Should not happen in active game

  if (card === "Sorry!") {
    const pawnsInStart = getPlayerPawnsInStart(roomGameState, playerIndex);
    const opponentsOnBoard = getOpponentPawnsOnBoard(
      roomGameState,
      playerIndex
    );
    if (pawnsInStart.length > 0 && opponentsOnBoard.length > 0) {
      results.selectablePawns = pawnsInStart.map((p) => p.id);
      results.targetableOpponents = opponentsOnBoard.map((p) => p.id);
      roomGameState.currentAction = "select-sorry-pawn";
      roomGameState.message = "Sorry! Select your pawn from Start.";
    }
  } else if (card === "11") {
    const movablePawns = player.pawns.filter((p) => isPawnMovable(p));
    const opponentsOnBoard = getOpponentPawnsOnBoard(
      roomGameState,
      playerIndex
    );
    const canSwap =
      movablePawns.some(isPawnOnBoard) && opponentsOnBoard.length > 0;

    movablePawns.forEach((pawn) => {
      const canMove11 =
        getPossibleMovesForPawnServer(roomGameState, pawn, "11").length > 0;
      const isSwappable = isPawnOnBoard(pawn) && canSwap;
      if (canMove11 || isSwappable) {
        results.selectablePawns.push(pawn.id);
      }
    });

    if (results.selectablePawns.length > 0) {
      roomGameState.currentAction = "select-11-pawn";
      roomGameState.message = "Draw 11: Select pawn to move 11 or swap.";
      if (canSwap) {
        results.targetableOpponents = opponentsOnBoard.map((p) => p.id);
      }
    }
  } else if (card === "7") {
    const movablePawns = player.pawns.filter((p) => isPawnMovable(p));
    movablePawns.forEach((pawn) => {
      // Check if pawn can move *at all* with a value from 1 to 7
      let canMoveAnySplit = false;
      for (let i = 1; i <= 7; i++) {
        if (
          getPossibleMovesForPawnServer(roomGameState, pawn, i.toString())
            .length > 0
        ) {
          canMoveAnySplit = true;
          break;
        }
      }
      if (canMoveAnySplit) {
        results.selectablePawns.push(pawn.id);
      }
    });

    if (results.selectablePawns.length > 0) {
      roomGameState.currentAction = "select-7-pawn1";
      roomGameState.message = "Draw 7: Select first pawn to move or split.";
      results.splitMandatory = results.selectablePawns.length >= 2;
      roomGameState.splitMandatory = results.splitMandatory; // Store in gameState too
    }
  } else {
    // Handle standard numbered cards (1, 2, 3, 4, 5, 8, 10, 12)
    const movablePawns = player.pawns.filter(
      (p) => isPawnMovable(p) || isPawnAtStart(p)
    ); // Include start pawns for 1/2
    movablePawns.forEach((pawn) => {
      if (getPossibleMovesForPawnServer(roomGameState, pawn, card).length > 0) {
        results.selectablePawns.push(pawn.id);
      }
    });

    if (results.selectablePawns.length > 0) {
      roomGameState.currentAction = "select-pawn";
      roomGameState.message = `Draw ${card}: Select a pawn to move.`;
    }
  }

  // If no actions possible, set message and clear action
  if (
    results.selectablePawns.length === 0 &&
    results.targetableOpponents.length === 0
  ) {
    roomGameState.message = `Draw ${card}: No possible moves.`;
    roomGameState.currentAction = null; // No action can be taken
    // Server will need logic to auto-advance turn here
    console.log(
      `[ServerActions] Player ${playerIndex} drew ${card} but has no valid actions.`
    );
    // TODO: Add auto-skip logic here or in playerAction handler
  }

  // Add results to gameState for client UI
  roomGameState.selectablePawns = results.selectablePawns;
  roomGameState.targetableOpponents = results.targetableOpponents;

  return results; // Return calculated actions
}

// Check win condition for a player (Server version)
function checkWinConditionServer(roomGameState, playerIndex) {
  if (
    !roomGameState ||
    !roomGameState.players ||
    !roomGameState.players[playerIndex] ||
    !roomGameState.players[playerIndex].pawns
  ) {
    return false;
  }
  const player = roomGameState.players[playerIndex];
  // Use helper function isPawnAtHome
  const allHome = player.pawns.every(isPawnAtHome);
  return allHome;
}

// Advances the turn to the next active player (Server version)
// Modifies room.gameState directly
function advanceTurnServer(room) {
  if (!room || !room.gameState || room.gameState.gameOver) {
    console.error(
      "[ServerTurn] Cannot advance turn: Invalid room state or game over."
    );
    return;
  }

  const gameState = room.gameState;
  // Use playerOrder which should only contain socket IDs of currently connected players
  const connectedPlayerSocketIds = room.playerOrder;
  const numActivePlayers = connectedPlayerSocketIds.length;

  if (numActivePlayers === 0) {
    console.error(
      "[ServerTurn] Cannot advance turn: No connected players in order."
    );
    // If no active players, game should likely end
    gameState.gameOver = true;
    gameState.message = "Game over - No active players left.";
    resetTurnStateServer(gameState);
    return;
  }

  let nextPlayerIndex = -1;
  let searchAttempts = 0;
  let currentTurnOrderIndex = connectedPlayerSocketIds.indexOf(
    gameState.players[gameState.currentPlayerIndex]?.socketId
  );
  if (currentTurnOrderIndex === -1 && gameState.currentPlayerIndex !== -1) {
    // If the current player wasn't found in playerOrder (maybe just disconnected?), start search from index 0
    console.warn(
      `[ServerTurn] Current player ${gameState.currentPlayerIndex} not found in playerOrder. Starting search from beginning.`
    );
    currentTurnOrderIndex = -1; // Ensure the loop starts correctly
  }

  // Loop to find the next *active* player in the order
  do {
    // Calculate next index in the playerOrder array
    currentTurnOrderIndex = (currentTurnOrderIndex + 1) % numActivePlayers;
    const nextPlayerSocketId = connectedPlayerSocketIds[currentTurnOrderIndex];

    // Find the player details in the main players array using socketId
    const nextPlayer = gameState.players.find(
      (p) => p.socketId === nextPlayerSocketId
    );

    if (nextPlayer && nextPlayer.type === "human") {
      // Ensure player is still human and connected
      nextPlayerIndex = nextPlayer.playerIndex; // We found the next active player's original index
    }
    searchAttempts++;
  } while (nextPlayerIndex === -1 && searchAttempts <= numActivePlayers); // Prevent infinite loop if somehow no active players found

  if (nextPlayerIndex === -1) {
    console.error(
      "[ServerTurn] Could not find an active player to advance turn to!"
    );
    // Handle this case - end game
    gameState.gameOver = true;
    gameState.message = "Game over - No active players left.";
    resetTurnStateServer(gameState);
    return;
  }

  // --- Set New Turn State ---
  gameState.currentPlayerIndex = nextPlayerIndex; // Set the actual player index
  // Reset state for the new turn
  resetTurnStateServer(gameState); // Clear selections, moves, etc.
  gameState.currentCard = null; // Clear the card from previous turn

  const nextPlayerInfo = gameState.players[nextPlayerIndex];
  gameState.message = `${nextPlayerInfo.name}'s turn. Draw a card.`;
  console.log(
    `[ServerTurn] Advanced turn to Player ${nextPlayerIndex} (${nextPlayerInfo.name}), Socket ID: ${nextPlayerInfo.socketId}`
  );

  // --- Emit 'yourTurn' ---
  if (nextPlayerInfo.socketId) {
    io.to(nextPlayerInfo.socketId).emit("yourTurn", {
      currentPlayerIndex: nextPlayerIndex,
    });
    console.log(
      `[ServerTurn] Emitted 'yourTurn' to ${nextPlayerInfo.socketId}`
    );
  } else {
    console.error(
      `[ServerTurn] Cannot emit 'yourTurn': Socket ID missing for player ${nextPlayerIndex}`
    );
  }
}

// --- Server-Side Card Logic (Adapted from client) ---

function createDeckServer() {
  const deck = [];
  const cardCounts = {
    1: 5,
    2: 4,
    3: 4,
    4: 4,
    5: 4,
    "Sorry!": 4,
    7: 4,
    8: 4,
    10: 4,
    11: 4,
    12: 4,
  };

  for (const card in cardCounts) {
    for (let i = 0; i < cardCounts[card]; i++) {
      deck.push(card);
    }
  }
  return deck;
}

function shuffleDeckServer(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

// Draws a card for a specific room's gameState
// Returns true if a card was drawn, false otherwise
function drawCardServer(roomGameState) {
  if (roomGameState.currentCard !== null || roomGameState.gameOver)
    return false;

  // If deck is empty, reshuffle discard pile if available
  if (!roomGameState.deck || roomGameState.deck.length === 0) {
    if (!roomGameState.discardPile || roomGameState.discardPile.length === 0) {
      roomGameState.message = "No cards left!";
      console.log(`Room ${roomGameState.roomId}: Deck empty, no discard pile.`);
      return false;
    }

    console.log(`Room ${roomGameState.roomId}: Reshuffling discard pile.`);
    roomGameState.deck = [...roomGameState.discardPile];
    roomGameState.discardPile = [];
    shuffleDeckServer(roomGameState.deck);
    roomGameState.message = "Reshuffled discard pile.";
  }

  // Verify we have cards to draw
  if (roomGameState.deck.length === 0) {
    console.error(
      `Room ${roomGameState.roomId}: Error: Attempted to draw from an empty deck after trying reshuffle`
    );
    roomGameState.message = "Error: No cards available";
    return false;
  }

  // Draw a card
  const drawnCard = roomGameState.deck.pop();

  // Validate the drawn card
  if (drawnCard === undefined || drawnCard === null) {
    console.error(
      `Room ${roomGameState.roomId}: Error: Drew a null/undefined card`
    );
    // Simple recovery: just skip this card (might happen if state gets corrupted)
    roomGameState.message = "Card error detected.";
    return false;
  }

  roomGameState.currentCard = drawnCard;
  console.log(
    `Room ${roomGameState.roomId}: Player ${roomGameState.currentPlayerIndex} drew ${roomGameState.currentCard}`
  );
  roomGameState.message = `Player ${
    PLAYERS_SERVER[roomGameState.currentPlayerIndex]?.name
  } drew ${roomGameState.currentCard}.`;
  // TODO: Server needs to determine valid actions here and add to gameState if needed by client UI
  return true;
}

// --- Server-Side Game State Initialization ---
function initializeGameStateServerVersion(roomId) {
  // Basic initial state
  const initialGameState = {
    roomId: roomId,
    players: [], // Populated when players join
    deck: [],
    discardPile: [],
    currentPlayerIndex: -1, // Set when game starts
    currentCard: null,
    selectedPawn: null,
    selectablePawns: [], // Server might not need this detailed state, but client does
    validMoves: [], // Client UI needs this
    targetableOpponents: [], // Client UI needs this
    message: "Waiting for players...",
    gameOver: false,
    currentAction: null, // Server might manage state differently
    splitData: { firstPawn: null, firstMoveValue: 0, secondPawn: null },
    splitMandatory: false,
    gameStarted: false,
  };
  // Initialize pawns structure for 4 potential players
  for (let i = 0; i < 4; i++) {
    initialGameState.players.push({
      playerIndex: i,
      name: `Player ${i + 1}`, // Placeholder name
      socketId: null, // Set when player joins
      pawns: Array(4)
        .fill(null)
        .map((_, pawnId) => ({
          id: pawnId,
          playerIndex: i,
          positionType: "start",
          positionIndex: -1,
        })),
      type: "pending", // Could be 'human', 'ai' (if server supports AI takeover), 'disconnected'
    });
  }
  return initialGameState;
}

// --- Socket.IO Event Handlers ---

// --- Main Connection Handler ---
logWithTimestamp("Server", "Setting up connection handler...");

io.on("connection", (socket) => {
  // Log detailed connection info
  logWithTimestamp("Connection", `New connection: ${socket.id}`, {
    socketId: socket.id,
    handshake: {
      url: socket.handshake.url,
      address: socket.handshake.address,
      query: socket.handshake.query,
      headers: socket.handshake.headers,
      auth: socket.handshake.auth,
    },
  });

  let playerName = "Anonymous"; // Default name

  // Add more detailed query parameter handling
  if (socket.handshake.query && socket.handshake.query.playerName) {
    playerName = socket.handshake.query.playerName;
    logWithTimestamp("Player", `Player name from query params: ${playerName}`);
  } else {
    logWithTimestamp(
      "Player",
      `No playerName in query, using default: ${playerName}`
    );
  }

  players[socket.id] = { name: playerName, currentRoomId: null };
  logWithTimestamp("Player", `Player connected: ${socket.id} - ${playerName}`);

  socket.on("createRoom", () => {
    const roomId = `room_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`${playerName} (${socket.id}) creating room ${roomId}`);

    // Initialize server-side game state for the room
    const initialGameState = initializeGameStateServerVersion(roomId);

    rooms[roomId] = {
      roomId: roomId,
      gameState: initialGameState,
      hostSocketId: socket.id,
      players: {}, // Map socket.id to player info within the room
      playerOrder: [], // Array of socket.ids in turn order
    };

    // Add creator as player 0
    const creatorPlayerIndex = 0;
    rooms[roomId].gameState.players[creatorPlayerIndex].name = playerName; // Set host name
    rooms[roomId].gameState.players[creatorPlayerIndex].socketId = socket.id;
    rooms[roomId].gameState.players[creatorPlayerIndex].type = "human";

    rooms[roomId].players[socket.id] = {
      name: playerName,
      playerIndex: creatorPlayerIndex,
    };
    rooms[roomId].playerOrder.push(socket.id);
    players[socket.id].currentRoomId = roomId;

    socket.join(roomId);

    // Tell creator their assigned index
    socket.emit("assignPlayerData", {
      playerId: socket.id,
      playerIndex: creatorPlayerIndex,
    });

    // Send initial room/game state back to creator
    // Send only the players part of the gameState initially
    const roomDataForClient = {
      roomId: roomId,
      players: rooms[roomId].gameState.players.filter(
        (p) => p.socketId !== null
      ), // Only send joined players
      initialGameState: rooms[roomId].gameState, // Send full initial state
    };
    socket.emit("roomCreated", roomDataForClient);

    console.log(
      `Room ${roomId} created. Host: ${playerName}. State initialized.`
    );
  });

  socket.on("joinRoom", (roomId) => {
    console.log(
      `${playerName} (${socket.id}) attempting to join room ${roomId}`
    );
    const room = rooms[roomId];

    if (!room) {
      console.log(`Room ${roomId} not found.`);
      socket.emit("joinFailed", "Room not found.");
      return;
    }

    const currentPlayers = room.gameState.players.filter(
      (p) => p.socketId !== null
    );
    const playerCount = currentPlayers.length;

    if (playerCount >= 4) {
      console.log(`Room ${roomId} is full.`);
      socket.emit("joinFailed", "Room is full.");
      return;
    }

    if (room.gameState.gameStarted) {
      console.log(`Game already started in room ${roomId}. Cannot join.`);
      socket.emit("joinFailed", "Game already in progress.");
      return;
    }

    // Find the next available player slot index
    let playerIndex = -1;
    for (let i = 0; i < 4; i++) {
      if (room.gameState.players[i].socketId === null) {
        playerIndex = i;
        break;
      }
    }

    if (playerIndex === -1) {
      // Should not happen if playerCount < 4
      console.error(
        `Room ${roomId} Error: No available player slot found, but player count is ${playerCount}`
      );
      socket.emit("joinFailed", "Internal server error (slots).");
      return;
    }

    // Update the game state with the new player's info
    room.gameState.players[playerIndex].name = playerName;
    room.gameState.players[playerIndex].socketId = socket.id;
    room.gameState.players[playerIndex].type = "human";

    // Update room tracking structures
    room.players[socket.id] = {
      name: playerName,
      playerIndex: playerIndex,
    };
    // Add to playerOrder only if not already there (reconnection case?)
    if (!room.playerOrder.includes(socket.id)) {
      room.playerOrder.push(socket.id);
    }
    players[socket.id].currentRoomId = roomId;

    socket.join(roomId);

    console.log(
      `${playerName} (${socket.id}) joined room ${roomId} as player ${playerIndex}`
    );

    // Tell joining player their info
    socket.emit("assignPlayerData", {
      playerId: socket.id,
      playerIndex: playerIndex,
    });

    // Send current room/game state to joining player
    const roomDataForClient = {
      roomId: roomId,
      players: room.gameState.players.filter((p) => p.socketId !== null), // Send updated list
      initialGameState: room.gameState, // Send full current state
      yourPlayerIndex: playerIndex, // Make sure client knows its index
    };
    socket.emit("roomJoined", roomDataForClient);

    // Notify others in the room (send updated player list)
    const updatedPlayerList = room.gameState.players.filter(
      (p) => p.socketId !== null
    );
    socket.to(roomId).emit("roomInfoUpdate", {
      players: updatedPlayerList,
    });
    socket.to(roomId).emit("message", `${playerName} has joined the game!`);

    // Optional: Start game automatically if full (adjust as needed)
    if (updatedPlayerList.length === 4 && !room.gameState.gameStarted) {
      console.log(`Room ${roomId} is now full.`);
      // Host still needs to click start, don't auto-start here
    }
  });

  // --- Game Start Listener ---
  socket.on("start_game", () => {
    // Removed data arg, not needed if using player's currentRoomId
    const roomId = players[socket.id]?.currentRoomId;
    if (!roomId || !rooms[roomId]) {
      console.error(`Start game request from ${socket.id} with no valid room.`);
      socket.emit("gameError", "You are not in a valid room.");
      return;
    }

    const room = rooms[roomId];
    const playerInfo = room.players[socket.id]; // Player info { name, playerIndex }

    if (!playerInfo) {
      console.error(`Player info not found for ${socket.id} in room ${roomId}`);
      socket.emit("gameError", "Internal server error (player not found).");
      return;
    }

    // --- Action Validation ---
    // 1. Check if game has started
    if (room.gameState.gameStarted) {
      socket.emit("gameError", "Game has already started.");
      return;
    }
    // 2. Check if it's the player's turn
    if (room.gameState.currentPlayerIndex !== playerInfo.playerIndex) {
      socket.emit("gameError", "It's not your turn!");
      return;
    }

    console.log(
      `Received action from ${playerName} (Player ${playerInfo.playerIndex}) in room ${roomId}: ${action.actionType}`
    );

    // --- Handle Specific Actions ---
    let stateChanged = false; // Flag to track if gameState was modified

    switch (action.actionType) {
      case "drawCard":
        // 3. Check if card already drawn this turn
        if (room.gameState.currentCard !== null) {
          socket.emit("gameError", "Card already drawn for this turn.");
          break; // Don't process further
        }

        console.log(`Player ${playerInfo.playerIndex} requested drawCard.`);
        const cardDrawn = drawCardServer(room.gameState);

        if (cardDrawn) {
          console.log(
            ` > Card ${room.gameState.currentCard} drawn successfully.`
          );
          // --- Determine Actions After Draw ---
          determineActionsForCardServer(
            room.gameState,
            playerInfo.playerIndex,
            room.gameState.currentCard
          );
          console.log(
            ` > Determined next action: ${
              room.gameState.currentAction
            }, Selectable: ${room.gameState.selectablePawns?.join(",")}`
          );

          // --- Auto-Skip if No Actions Possible ---
          if (room.gameState.currentAction === null) {
            console.log(
              `[ServerTurn] Auto-skipping turn for Player ${playerInfo.playerIndex} as no actions are possible with card ${room.gameState.currentCard}.`
            );
            advanceTurnServer(room); // This resets state and emits yourTurn
          }
          // ---------------------------------------
          stateChanged = true;
        } else {
          console.log(` > Failed to draw card (deck empty?).`);
          // If drawing failed (e.g., deck and discard empty), the turn should end.
          room.gameState.message =
            "No cards left in deck or discard! Turn skipped.";
          advanceTurnServer(room);
          stateChanged = true;
        }
        break;

      case "selectPawn":
        console.log(
          `Player ${playerInfo.playerIndex} selected pawn:`,
          action.payload
        );
        // --- selectPawn Implementation ---
        // 1. Validate payload
        if (!action.payload || action.payload.pawnId === undefined) {
          socket.emit("gameError", "Invalid payload for selectPawn.");
          break;
        }
        const pawnIdToSelect = action.payload.pawnId;
        // *** ADD LOGGING HERE ***
        console.log(
          `[Server] Received selectPawn. Action: ${room.gameState.currentAction}, ReqPawnID: ${pawnIdToSelect}`
        );
        console.log(
          `[Server] Selectable Pawns: ${JSON.stringify(
            room.gameState.selectablePawns
          )}`
        );

        // 2. Validate current game state allows pawn selection
        // This depends on the specific card/action flow, which determineActionsForCardServer sets.
        const allowedStates = [
          "select-pawn",
          "select-sorry-pawn",
          "select-11-pawn",
          "select-7-pawn1",
          "select-7-pawn2",
        ];
        if (!allowedStates.includes(room.gameState.currentAction)) {
          socket.emit(
            "gameError",
            `Cannot select pawn in current state: ${room.gameState.currentAction}`
          );
          break;
        }

        // 3. Validate if the selected pawn ID is in the list of selectable pawns
        const isSelectable =
          room.gameState.selectablePawns?.includes(pawnIdToSelect);
        // *** ADD LOGGING HERE ***
        console.log(
          `[Server] Is Pawn ${pawnIdToSelect} selectable? ${isSelectable}`
        );
        if (!isSelectable) {
          socket.emit("gameError", `Pawn ${pawnIdToSelect} is not selectable.`);
          console.warn(
            `Selectable pawns were: ${room.gameState.selectablePawns?.join(
              ", "
            )}`
          );
          break;
        }

        // 4. Get the server-side pawn object
        const selectedPawnObject = getPawnById(
          room.gameState,
          playerInfo.playerIndex,
          pawnIdToSelect
        );

        if (!selectedPawnObject) {
          socket.emit(
            "gameError",
            `Internal error: Could not find pawn ${pawnIdToSelect}.`
          );
          console.error(
            `Could not find pawn object for ID ${pawnIdToSelect}, Player ${playerInfo.playerIndex}`
          );
          break;
        }

        // 5. Update game state
        room.gameState.selectedPawn = selectedPawnObject; // Store the OBJECT reference
        room.gameState.validMoves = []; // Clear previous valid moves
        room.gameState.targetableOpponents = []; // Clear previous targets unless needed for next step
        room.gameState.message = `Selected Pawn ${pawnIdToSelect}.`; // Generic message

        // 6. Determine next action state and valid moves/targets based on current card/action
        const card = room.gameState.currentCard;
        let nextAction = null;

        switch (room.gameState.currentAction) {
          case "select-pawn": // Standard cards
            room.gameState.validMoves = getPossibleMovesForPawnServer(
              room.gameState,
              selectedPawnObject,
              card
            );
            if (room.gameState.validMoves.length > 0) {
              nextAction = "select-move";
              room.gameState.message = `Selected Pawn ${pawnIdToSelect}. Choose a move.`;
            } else {
              // This shouldn't happen if the pawn was selectable, but handle defensively
              nextAction = null;
              room.gameState.message = `Error: No moves for selected pawn ${pawnIdToSelect}?`;
              console.error(
                `Pawn ${pawnIdToSelect} was selectable but had no moves for card ${card}?`
              );
              // Reset selection? Or let turn potentially end?
              room.gameState.selectedPawn = null;
            }
            break;
          case "select-sorry-pawn":
            // Targets were already set by determineActionsForCardServer
            room.gameState.targetableOpponents = getOpponentPawnsOnBoard(
              room.gameState,
              playerInfo.playerIndex
            ).map((p) => p.id);
            if (room.gameState.targetableOpponents.length > 0) {
              nextAction = "select-sorry-target";
              room.gameState.message = `Selected Pawn ${pawnIdToSelect}. Choose opponent to bump.`;
            } else {
              nextAction = null; // Should not happen if pawn was selectable
              room.gameState.message =
                "Error: No opponents to target for Sorry!";
              room.gameState.selectedPawn = null;
            }
            break;
          case "select-11-pawn":
            room.gameState.validMoves = getPossibleMovesForPawnServer(
              room.gameState,
              selectedPawnObject,
              "11"
            );
            const opponentsForSwap = getOpponentPawnsOnBoard(
              room.gameState,
              playerInfo.playerIndex
            );
            const canSwapThisPawn =
              isPawnOnBoard(selectedPawnObject) && opponentsForSwap.length > 0;
            room.gameState.targetableOpponents = canSwapThisPawn
              ? opponentsForSwap.map((p) => p.id)
              : [];

            if (room.gameState.validMoves.length > 0 && canSwapThisPawn) {
              nextAction = "select-11-action";
              room.gameState.message = `Selected Pawn ${pawnIdToSelect}. Choose move or opponent to swap.`;
            } else if (room.gameState.validMoves.length > 0) {
              nextAction = "select-move"; // Only move possible
              room.gameState.message = `Selected Pawn ${pawnIdToSelect}. Choose move.`;
            } else if (canSwapThisPawn) {
              nextAction = "select-11-swap-target"; // Only swap possible
              room.gameState.message = `Selected Pawn ${pawnIdToSelect}. Choose opponent to swap.`;
            } else {
              nextAction = null;
              room.gameState.message = `Error: No move or swap for selected pawn ${pawnIdToSelect}.`;
              console.error(
                `Pawn ${pawnIdToSelect} selected for 11 but no actions possible?`
              );
              room.gameState.selectedPawn = null;
            }
            break;
          case "select-7-pawn1":
            let potentialMoves = getPossibleMovesForPawnServer(
              room.gameState,
              selectedPawnObject,
              "7"
            );
            if (room.gameState.splitMandatory) {
              potentialMoves = potentialMoves.filter(
                (move) => move.steps !== 7
              );
            }
            room.gameState.validMoves = potentialMoves;
            if (room.gameState.validMoves.length > 0) {
              nextAction = "select-7-move1";
              room.gameState.message = `Selected Pawn ${pawnIdToSelect}. Choose move (split: ${
                room.gameState.splitMandatory ? "Mandatory" : "Optional"
              }).`;
            } else {
              nextAction = null;
              room.gameState.message = `Error: No moves for first pawn ${pawnIdToSelect} on card 7?`;
              console.error(
                `Pawn ${pawnIdToSelect} selected for 7 but no moves possible?`
              );
              room.gameState.selectedPawn = null;
            }
            break;
          case "select-7-pawn2":
            const remainingValue = 7 - room.gameState.splitData.firstMoveValue;
            room.gameState.validMoves = getPossibleMovesForPawnServer(
              room.gameState,
              selectedPawnObject,
              remainingValue.toString()
            );
            if (room.gameState.validMoves.length > 0) {
              nextAction = "select-7-move2";
              room.gameState.message = `Selected second Pawn ${pawnIdToSelect}. Choose its move (${remainingValue}).`;
              room.gameState.splitData.secondPawn = selectedPawnObject; // Store second pawn reference
            } else {
              // If the selected second pawn has no moves, error and prompt again
              nextAction = "select-7-pawn2"; // Stay in this state
              room.gameState.message = `Pawn ${pawnIdToSelect} cannot make the remaining ${remainingValue} move. Select a different second pawn.`;
              // Client UI needs to re-enable selection of other pawns
              // Server state reflects the attempt but doesn't store the invalid second pawn
              room.gameState.selectedPawn = null; // Clear invalid selection
              // Recalculate selectable pawns for the second move
              const firstPawn = room.gameState.splitData.firstPawn;
              room.gameState.selectablePawns = [];
              room.gameState.players[playerInfo.playerIndex].pawns.forEach(
                (p) => {
                  if (p.id !== firstPawn?.id && isPawnMovable(p)) {
                    if (
                      getPossibleMovesForPawnServer(
                        room.gameState,
                        p,
                        remainingValue.toString()
                      ).length > 0
                    ) {
                      room.gameState.selectablePawns.push(p.id);
                    }
                  }
                }
              );
            }
            break;
          default:
            // Should not happen if initial state check passed
            console.error(
              `Unexpected state in selectPawn handler: ${room.gameState.currentAction}`
            );
            break;
        }

        room.gameState.currentAction = nextAction;
        stateChanged = true;
        break;

      case "selectMove":
        console.log(
          `Player ${playerInfo.playerIndex} selected move:`,
          action.payload
        );
        // --- selectMove Implementation ---
        // 1. Validate payload and current state
        if (!action.payload || !action.payload.moveDetails) {
          socket.emit("gameError", "Invalid payload for selectMove.");
          break;
        }
        const moveDetails = action.payload.moveDetails; // { type, positionType, positionIndex, ...}
        const currentState = room.gameState.currentAction;
        // *** ADD LOGGING HERE ***
        console.log(
          `[Server] Received selectMove. Action: ${currentState}, SelectedPawn: ${room.gameState.selectedPawn?.id}, ReqMove:`,
          JSON.stringify(moveDetails)
        );
        console.log(
          `[Server] Valid Moves: `,
          JSON.stringify(
            room.gameState.validMoves?.map((m) => ({
              pT: m.positionType,
              pI: m.positionIndex,
              s: m.steps,
            })) || []
          )
        );

        const allowedMoveStates = [
          "select-move",
          "select-11-action", // Card 11 move part
          "select-7-move1",
          "select-7-move2",
        ];
        if (!allowedMoveStates.includes(currentState)) {
          socket.emit(
            "gameError",
            `Cannot select move in current state: ${currentState}`
          );
          break;
        }
        if (!room.gameState.selectedPawn) {
          socket.emit("gameError", "Cannot select move: No pawn selected.");
          break;
        }

        // 2. Validate the selected move against the server's valid moves
        // Need to compare key properties, not object identity
        const serverValidMove = room.gameState.validMoves.find(
          (validMove) =>
            validMove.positionType === moveDetails.positionType &&
            validMove.positionIndex === moveDetails.positionIndex &&
            // For card 7, ensure the steps match if provided
            (moveDetails.steps === undefined ||
              validMove.steps === moveDetails.steps)
        );

        // *** ADD LOGGING HERE ***
        console.log(
          `[Server] Was move found in valid moves? ${!!serverValidMove}`
        );

        if (!serverValidMove) {
          socket.emit("gameError", "Invalid move selected.");
          console.warn("Client move details:", moveDetails);
          console.warn("Server valid moves:", room.gameState.validMoves);
          break;
        }

        // 3. Execute the move
        const pawnToMove = room.gameState.selectedPawn;
        const destination = serverValidMove; // Use the validated server move object
        let message = "";
        let gameWon = false;
        let turnEndedByMove = false;

        // --- Bumping Logic ---
        if (destination.positionType === "board") {
          const bumpedPawn = getPawnAtBoardIndex(
            room.gameState,
            destination.positionIndex
          );
          // Ensure the bumped pawn is not the one moving and belongs to an opponent
          if (
            bumpedPawn &&
            bumpedPawn.id !== pawnToMove.id &&
            bumpedPawn.playerIndex !== pawnToMove.playerIndex
          ) {
            console.log(
              `[ServerMove] Bumping Player ${bumpedPawn.playerIndex} Pawn ${bumpedPawn.id}`
            );
            sendPawnToStartServer(bumpedPawn);
            message = `Bumped ${
              PLAYERS_SERVER[bumpedPawn.playerIndex].name
            }'s pawn! `;
          }
        }

        // --- Update Pawn Position --- (Before slide check)
        pawnToMove.positionType = destination.positionType;
        pawnToMove.positionIndex = destination.positionIndex;
        console.log(
          `[ServerMove] Moved Pawn ${pawnToMove.id} to ${pawnToMove.positionType} ${pawnToMove.positionIndex}`
        );

        // --- Sliding Logic ---
        if (pawnToMove.positionType === "board") {
          const slide = SLIDE_INFO_SERVER[pawnToMove.positionIndex];
          // Must land on slide start AND it must not be own color slide
          if (slide && slide.colorIndex !== pawnToMove.playerIndex) {
            message += `Landed on ${
              PLAYERS_SERVER[slide.colorIndex].name
            }'s slide! `;
            const slideEndIndex = slide.endBoardIndex;
            let currentSlideCheckPos =
              (pawnToMove.positionIndex + 1) % PATH_LENGTH;

            // Bump pawns along the slide path (excluding the slider)
            while (true) {
              const pawnOnSlide = getPawnAtBoardIndex(
                room.gameState,
                currentSlideCheckPos
              );
              if (pawnOnSlide && pawnOnSlide.id !== pawnToMove.id) {
                // Don't bump self
                console.log(
                  `[ServerSlide] Sliding into Player ${pawnOnSlide.playerIndex} Pawn ${pawnOnSlide.id}`
                );
                sendPawnToStartServer(pawnOnSlide);
                message += ` slid into & bumped ${
                  PLAYERS_SERVER[pawnOnSlide.playerIndex].name
                }! `;
              }
              if (currentSlideCheckPos === slideEndIndex) break;
              currentSlideCheckPos = (currentSlideCheckPos + 1) % PATH_LENGTH;
              // Safety break for infinite loop, though logic should prevent it
              if (
                currentSlideCheckPos ===
                (pawnToMove.positionIndex + 1) % PATH_LENGTH
              ) {
                console.error("Slide check infinite loop detected!");
                break;
              }
            }

            // Move pawn to slide end
            pawnToMove.positionIndex = slideEndIndex;
            console.log(
              `[ServerSlide] Slid Pawn ${pawnToMove.id} to board ${pawnToMove.positionIndex}`
            );

            // Check for bump at the slide end
            const finalBumpedPawn = getPawnAtBoardIndex(
              room.gameState,
              slideEndIndex
            );
            if (
              finalBumpedPawn &&
              finalBumpedPawn.id !== pawnToMove.id &&
              finalBumpedPawn.playerIndex !== pawnToMove.playerIndex
            ) {
              console.log(
                `[ServerSlide] Bumping Player ${finalBumpedPawn.playerIndex} Pawn ${finalBumpedPawn.id} at slide end`
              );
              sendPawnToStartServer(finalBumpedPawn);
              message += ` Bumped another pawn after slide!`;
            }
          }
        }

        // --- Check Win Condition ---
        if (pawnToMove.positionType === "home") {
          gameWon = checkWinConditionServer(
            room.gameState,
            pawnToMove.playerIndex
          );
          if (gameWon) {
            console.log(
              `[ServerWin] Player ${pawnToMove.playerIndex} has won!`
            );
            room.gameState.gameOver = true;
            room.gameState.message = `${
              PLAYERS_SERVER[pawnToMove.playerIndex].name
            } wins!`;
            // Send game over immediately? Or rely on state broadcast?
            io.to(roomId).emit("gameOver", {
              winnerIndex: pawnToMove.playerIndex,
              winnerName: PLAYERS_SERVER[pawnToMove.playerIndex].name,
            });
          }
        }

        room.gameState.message = message.trim() || "Move complete.";

        // 4. Handle Turn Advancement / Next Step
        if (gameWon) {
          // Game is over, no next turn. Reset state but don't advance.
          resetTurnStateServer(room.gameState);
          stateChanged = true;
          // Break from action switch, let stateChanged broadcast the final state.
        } else if (currentState === "select-7-move1") {
          const moveValue = serverValidMove.steps;
          // Validate mandatory split
          if (moveValue === 7 && room.gameState.splitMandatory) {
            socket.emit(
              "gameError",
              "Invalid move: Must split 7 if possible (select move 1-6)."
            );
            // Don't change state, let player choose again
            stateChanged = false; // Revert state change if any
            break; // Exit switch case
          }

          const remainingValue = 7 - moveValue;
          if (remainingValue > 0) {
            // Need to select second pawn
            room.gameState.splitData.firstPawn = pawnToMove; // Store reference to the moved pawn
            room.gameState.splitData.firstMoveValue = moveValue;
            room.gameState.selectedPawn = null; // Clear selection for next pawn
            room.gameState.validMoves = []; // Clear moves
            room.gameState.selectablePawns = []; // Clear old selectable pawns

            // Find OTHER selectable pawns for the second move
            room.gameState.players[playerInfo.playerIndex].pawns.forEach(
              (pawn) => {
                if (pawn.id !== pawnToMove.id && isPawnMovable(pawn)) {
                  const secondMoves = getPossibleMovesForPawnServer(
                    room.gameState,
                    pawn,
                    remainingValue.toString()
                  );
                  if (secondMoves.length > 0) {
                    room.gameState.selectablePawns.push(pawn.id);
                  }
                }
              }
            );

            if (room.gameState.selectablePawns.length > 0) {
              // Transition to selecting the second pawn
              room.gameState.currentAction = "select-7-pawn2";
              room.gameState.message = `First move done (${moveValue}). Select second pawn for remaining ${remainingValue}.`;
            } else {
              // No other pawn can move, turn ends here
              console.log(
                `[ServerMove] 7-Split: No second move possible for remaining ${remainingValue}. Ending turn.`
              );
              room.gameState.message = `First move done (${moveValue}). No valid second move. Turn ends.`;
              advanceTurnServer(room); // Advance turn
              turnEndedByMove = true;
            }
          } else {
            // Used exactly 7 steps, turn ends
            advanceTurnServer(room);
            turnEndedByMove = true;
          }
          stateChanged = true;
        } else if (currentState === "select-7-move2") {
          // Second part of 7 split complete, end turn
          advanceTurnServer(room);
          turnEndedByMove = true;
          stateChanged = true;
          room.gameState.message = `Completed 7-split move.`;
        } else {
          // Default case: Standard move, 11-move completed. End turn.
          advanceTurnServer(room);
          turnEndedByMove = true;
          stateChanged = true;
        }

        // If turn didn't end above (e.g., game won, or waiting for 2nd part of 7), reset turn state
        if (!turnEndedByMove && !gameWon) {
          // This case primarily covers starting the second part of split 7
          // We DON'T reset the splitData here
          room.gameState.selectedPawn = null;
          room.gameState.validMoves = [];
          // selectablePawns and targetableOpponents should be set correctly for the next step above
        } else if (!gameWon && turnEndedByMove) {
          // Turn was advanced, ensure state is fully reset for next player
          // advanceTurnServer should handle most of this
        }

        stateChanged = true; // Ensure state is broadcast
        break;

      case "executeSorry":
        console.log(
          `Player ${playerInfo.playerIndex} requested Sorry!`,
          action.payload
        );
        const sorryPayload = action.payload;
        const playerPawn = room.gameState.selectedPawn; // Pawn from Start

        // Basic Validation
        if (room.gameState.currentCard !== "Sorry!") {
          socket.emit("gameError", "Invalid action: Card is not Sorry!");
          break;
        }
        if (!playerPawn || !isPawnAtStart(playerPawn)) {
          socket.emit(
            "gameError",
            "Invalid action: No pawn selected or pawn not in Start."
          );
          break;
        }
        if (
          !sorryPayload ||
          sorryPayload.targetPawnId === undefined ||
          sorryPayload.targetPlayerIndex === undefined
        ) {
          socket.emit("gameError", "Invalid Sorry! target payload.");
          break;
        }
        // Basic check for targeting self
        if (sorryPayload.targetPlayerIndex === playerInfo.playerIndex) {
          socket.emit("gameError", "Cannot target your own pawn with Sorry!");
          break;
        }

        const targetPawn = getPawnById(
          room.gameState,
          sorryPayload.targetPlayerIndex,
          sorryPayload.targetPawnId
        );

        if (!targetPawn || !isPawnOnBoard(targetPawn)) {
          socket.emit(
            "gameError",
            "Invalid Sorry! target: Pawn not found or not on board."
          );
          break;
        }

        // Execute Sorry! logic
        const targetPositionIndex = targetPawn.positionIndex;
        sendPawnToStartServer(targetPawn); // Send opponent home
        playerPawn.positionType = "board"; // Move player pawn
        playerPawn.positionIndex = targetPositionIndex;
        console.log(
          `[Server Sorry!] Moved Player ${playerInfo.playerIndex} Pawn ${playerPawn.id} to board ${targetPositionIndex}, sent Player ${targetPawn.playerIndex} Pawn ${targetPawn.id} to start.`
        );

        room.gameState.message = `Sorry! ${playerInfo.name} bumped ${
          PLAYERS_SERVER[targetPawn.playerIndex].name
        }!`;

        // Advance the turn (this also resets state like selectedPawn, targets, etc.)
        advanceTurnServer(room);
        stateChanged = true;
        break;

      case "executeSwap":
        console.log(
          `Player ${playerInfo.playerIndex} requested Swap`,
          action.payload
        );
        const swapPayload = action.payload;
        const swapPlayerPawn = room.gameState.selectedPawn; // Use new name

        // Basic Validation
        if (room.gameState.currentCard !== "11") {
          socket.emit("gameError", "Invalid action: Card is not 11.");
          break;
        }
        if (!swapPlayerPawn || !isPawnOnBoard(swapPlayerPawn)) {
          // Use new name
          socket.emit(
            "gameError",
            "Invalid action: Player pawn for swap not selected or not on board."
          );
          break;
        }
        if (
          !swapPayload ||
          swapPayload.targetPawnId === undefined ||
          swapPayload.targetPlayerIndex === undefined
        ) {
          socket.emit("gameError", "Invalid Swap target payload.");
          break;
        }
        if (swapPayload.targetPlayerIndex === playerInfo.playerIndex) {
          socket.emit("gameError", "Cannot swap with your own pawn.");
          break;
        }

        const swapTargetPawn = getPawnById(
          // Use new name
          room.gameState,
          swapPayload.targetPlayerIndex,
          swapPayload.targetPawnId
        );

        if (!swapTargetPawn || !isPawnOnBoard(swapTargetPawn)) {
          // Use new name
          socket.emit(
            "gameError",
            "Invalid Swap target: Opponent pawn not found or not on board."
          );
          break;
        }

        // Execute Swap logic
        const playerOriginalPos = swapPlayerPawn.positionIndex; // Use new name
        const targetOriginalPos = swapTargetPawn.positionIndex; // Use new name

        swapPlayerPawn.positionIndex = targetOriginalPos; // Use new name
        swapTargetPawn.positionIndex = playerOriginalPos; // Use new name

        console.log(
          `[Server Swap] Swapped Player ${swapPlayerPawn.playerIndex} Pawn ${swapPlayerPawn.id} (to ${targetOriginalPos}) with Player ${swapTargetPawn.playerIndex} Pawn ${swapTargetPawn.id} (to ${playerOriginalPos})` // Use new names
        );

        room.gameState.message = `Swapped places with ${
          PLAYERS_SERVER[swapTargetPawn.playerIndex].name
        }!`; // Use new name

        // TODO: Server-side slide/bump check after swap?

        // Advance the turn (this also resets state)
        advanceTurnServer(room);
        stateChanged = true;
        break;

      case "skipTurn": // Handle the skip turn action added to client UI
        console.log(`Player ${playerInfo.playerIndex} requested skipTurn.`);
        // TODO: Validate if skipping is allowed (e.g., only if no moves possible?)
        // TODO: Advance turn
        stateChanged = true; // Placeholder
        break;

      default:
        console.warn(`Unhandled action type: ${action.actionType}`);
        socket.emit("gameError", `Unknown action: ${action.actionType}`);
        break;
    }

    // --- Broadcast State Update ---
    if (stateChanged) {
      // Send the entire updated gameState to all clients in the room
      io.to(roomId).emit("gameStateUpdate", room.gameState);
      console.log(`Room ${roomId}: Broadcasted updated gameState.`);

      // TODO: Determine if turn should end and emit 'yourTurn' to the next player
      // This logic depends heavily on the action performed (move, skip, etc.)
    }
  });

  socket.on("disconnect", (reason) => {
    logWithTimestamp("Disconnect", `Player disconnected: ${socket.id}`, {
      reason: reason,
      wasClean:
        reason === "client namespace disconnect" ||
        reason === "transport close",
      playerData: players[socket.id],
    });

    console.log(`Player disconnected: ${socket.id}`);
    const player = players[socket.id];
    if (player && player.currentRoomId) {
      const roomId = player.currentRoomId;
      const room = rooms[roomId];
      if (room) {
        console.log(`${player.name} left room ${roomId}`);
        const leftPlayerIndex = room.players[socket.id]?.playerIndex;

        // Clear player info from room tracking
        delete room.players[socket.id];
        room.playerOrder = room.playerOrder.filter((id) => id !== socket.id);

        // Update the player entry in gameState to mark as disconnected
        if (
          leftPlayerIndex !== undefined &&
          room.gameState.players[leftPlayerIndex]
        ) {
          room.gameState.players[leftPlayerIndex].socketId = null;
          room.gameState.players[leftPlayerIndex].type = "disconnected";
          console.log(
            `Marked Player ${leftPlayerIndex} as disconnected in gameState.`
          );
        }

        // TODO: Handle game state if player leaves mid-game
        // Options:
        // 1. Pause game: Set a flag, prevent further actions until player reconnects or times out.
        // 2. Assign AI: Replace the disconnected player with an AI (complex).
        // 3. End Game: Forfeit the game or declare remaining player winner if only one left.
        // 4. Allow play to continue: Skip the disconnected player's turns. (Simplest for now)

        // Notify others
        const currentPlayersList = room.gameState.players.filter(
          (p) => p.socketId !== null
        );
        io.to(roomId).emit("message", `${player.name} has left the game.`);
        io.to(roomId).emit("roomInfoUpdate", {
          players: currentPlayersList, // Send list of remaining players
        });
        // Also send full state update in case disconnection affects turn/game state
        io.to(roomId).emit("gameStateUpdate", room.gameState);

        // Delete room if empty
        if (currentPlayersList.length === 0) {
          console.log(`Room ${roomId} is empty, deleting.`);
          delete rooms[roomId];
        } else if (
          room.gameState.gameStarted &&
          room.gameState.currentPlayerIndex === leftPlayerIndex
        ) {
          // If it was the disconnected player's turn, advance the turn immediately
          console.log(
            `Advancing turn as disconnected player ${leftPlayerIndex}'s turn.`
          );
          // TODO: Implement robust turn advancement logic here
          // For now, simple advance:
          room.gameState.currentPlayerIndex =
            (room.gameState.currentPlayerIndex + 1) % room.playerOrder.length; // Careful: playerOrder might be wrong length now
          room.gameState.currentCard = null; // Ensure next player needs to draw
          // Find next active player's socketId
          // ... needs more logic ... emit yourTurn to next active player
          io.to(roomId).emit("gameStateUpdate", room.gameState); // Broadcast state change
        }
      }
    }
    delete players[socket.id];
  });

  // Log socket errors explicitly
  socket.on("error", (err) => {
    logWithTimestamp("Socket Error", `Error for socket ${socket.id}:`, {
      message: err.message,
      stack: err.stack,
    });
  });
});

console.log("Socket.IO server listening on port 3000");
