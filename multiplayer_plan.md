# Multiplayer Support Plan for Sorry! Game

## I. Introduction

This plan outlines the steps required to add multiplayer functionality to the JavaScript Sorry! game. The goal is to support two modes:

1.  **Networked Multiplayer:** Allow up to 4 human players to connect via a server and play against each other in real-time.
2.  **Local AI Multiplayer:** Allow a single human player to play against 1-3 computer-controlled AI opponents on the same machine.

## II. Core Architectural Changes

1.  **Game Mode Selection:**
    - Introduce a pre-game UI (modal or separate screen) to allow the user to select "Local Game" or "Online Game".
    - If "Local Game", allow selection of human/AI players for slots 2-4.
    - If "Online Game", initiate connection flow.
2.  **Server Component (for Networked Mode):**
    - Requires a backend server (e.g., Node.js).
    - Use WebSockets (Socket.IO recommended) for real-time communication.
    - The server will be the authoritative source for game state and turn management in online games.
3.  **Refactor Game State Management (`gameState.js`):**
    - Ensure `gameState` can be easily serialized/deserialized (for network transmission).
    - Potentially separate player-specific state from global game state if needed for network efficiency.
4.  **Abstract Player Actions:**
    - Refactor UI handlers (`ui.js`) and move execution logic (`moves.js`) so actions (draw card, select pawn, execute move) can be triggered by human input, AI logic, or network events.
    - Introduce clear functions like `requestDrawCard()`, `requestSelectPawn(pawn)`, `requestMove(moveDetails)`.
5.  **Player Representation:**
    - Update the `players` array in `gameState` to include a type property (e.g., `'human'`, `'ai'`, `'remote'`).
    - Assign unique IDs to players, especially in networked mode.

## III. Networked Multiplayer Implementation (Client-Side)

1.  **Network Module (`network.js`):**
    - Create a new `network.js` module.
    - Add Socket.IO client library (`index.html`).
    - Implement functions to:
      - Connect/disconnect from the server.
      - Join/create game rooms.
      - Emit player actions (draw, select, move) to the server.
      - Listen for server events (game state updates, opponent moves, turn changes, player join/leave, errors).
2.  **Integrate Network Events:**
    - Modify `main.js`/`ui.js` to initialize network connection if "Online Game" is selected.
    - When receiving game state updates from the server:
      - Update the local `gameState`.
      - Redraw the game (`drawGame()`).
      - Update the UI (`updateUI()`).
    - Disable direct game state manipulation for the current player's actions; instead, send requests to the server. The UI should update based on the server's response.
3.  **UI Enhancements:**
    - Display connection status.
    - Show a list of players in the current game room.
    - Implement basic lobby functionality (list available games, create new game).
    - Handle player disconnections gracefully (e.g., show message, potentially allow game to continue if feasible).

## IV. Networked Multiplayer Implementation (Server-Side - Conceptual)

_(Requires separate Node.js project)_

1.  **Server Setup:**
    - Node.js + Express (optional, for serving client files) + Socket.IO.
2.  **Connection Management:**
    - Handle client connections/disconnections.
    - Assign unique IDs to connected players.
3.  **Game Room Management:**
    - Allow creation of game rooms.
    - Manage players joining/leaving rooms.
    - Limit rooms to 4 players.
    - Start the game when enough players join (or manually).
4.  **Game State Synchronization:**
    - Maintain the authoritative `gameState` for each active game room.
    - Receive player action requests (draw, move).
    - Validate actions against game rules and current state.
    - If valid, update the server's `gameState`.
    - Broadcast the updated state (or specific changes) to all players in the room.
5.  **Turn Management:**
    - Control whose turn it is.
    - Notify the appropriate client when their turn begins.
    - Handle turn timeouts (optional).

## V. Local AI Multiplayer Implementation

1.  **AI Logic Module (`ai.js`):**
    - Create a new `ai.js` module.
    - Implement `aiTakeTurn(playerIndex)` function.
    - Inside `aiTakeTurn`:
      - Simulate drawing a card (using existing `drawCard` logic, but potentially without UI update until decision is made).
      - Analyze the drawn card and current `gameState`.
      - Call `getPossibleMovesForPawn` for all AI pawns to find valid actions.
      - Implement decision-making heuristics:
        - Prioritize getting pawns out of start (cards 1, 2).
        - Prioritize "Sorry!" bumps if available.
        - Prioritize safety zone entry/movement.
        - Prioritize slides (especially bumping slides).
        - Prioritize moves that land on opponent pawns (for bumping).
        - Consider card 7 split strategy.
        - Consider card 11 swap strategy.
        - Default to simple forward movement.
      - Select the "best" action based on heuristics.
      - Execute the chosen action using refactored action functions (e.g., `executeMove`, `executeSorry`).
2.  **Game Loop Integration:**
    - Modify the turn transition logic (likely in `main.js` or `ui.js` after a move completes or turn skips).
    - Check `gameState.players[newPlayerIndex].type`.
    - If `'ai'`, disable human input and call `aiTakeTurn(newPlayerIndex)` after a short delay (e.g., `setTimeout(aiTakeTurn, 1000)`).
3.  **UI Setup:**
    - Implement the UI elements for selecting human/AI players before starting a local game.
    - Store the selected player types in `gameState.players`.

## VI. Refactoring and Integration

1.  **Isolate Core Logic:** Ensure `board.js`, `cards.js`, `moves.js`, `constants.js`, and `drawing.js` remain focused on game rules and representation, independent of player type or network status.
2.  **Centralize Action Execution:** Ensure that whether an action originates from human input, AI, or the network, it goes through the same validation and state update functions (e.g., `executeMove`).
3.  **Event-Driven Updates:** Rely on events or callbacks after actions complete to trigger UI updates and turn transitions, rather than assuming synchronous execution.

## VII. Testing

1.  **Local AI:**
    - Test games with 1 Human + 3 AI, 1 Human + 1 AI, etc.
    - Verify AI makes valid moves according to rules.
    - Observe AI decision-making – does it behave reasonably?
    - Test edge cases (AI has no moves, AI wins).
2.  **Networked:**
    - Use multiple browser windows/tabs to simulate players.
    - Test joining/leaving games.
    - Verify state synchronization across all clients.
    - Test player actions being correctly relayed and validated.
    - Test handling of disconnections.

## VIII. Future Enhancements (Optional)

- Implement different AI difficulty levels.
- Add chat functionality for networked games.
- Add spectator mode.
- Improve lobby system (player names, game settings).
