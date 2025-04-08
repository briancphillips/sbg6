# Refactoring Plan for Sorry! Game Clone (sbg6-1)

This document outlines a plan for cleaning up, refactoring, and applying DRY (Don't Repeat Yourself) principles to the codebase, focusing on improving maintainability, readability, and potentially performance without breaking existing functionality.

**Testing Strategy:** Before starting any refactoring, ensure a basic testing approach is in place. This could involve:
1.  Manual testing of core features (starting a game, drawing cards, moving pawns, slides, Sorry! card, winning).
2.  Leveraging the existing `scenarioManager.js` to quickly load and test specific game states.
3.  *Optional:* Implementing basic automated tests if feasible.

## Phase 1: Code Cleanup & Consistency

*   **Objective:** Standardize formatting, remove dead code, improve comments.
*   **Actions:**
    *   Run a code formatter (like Prettier) across all `.js` files.
    *   Review code for commented-out blocks that are no longer needed.
    *   Ensure consistent naming conventions (e.g., camelCase for variables/functions, PascalCase for classes if any).
    *   Add/improve comments explaining complex logic or "why" something is done.
    *   Remove excessive `console.log` statements used for debugging, especially those marked `DETAILED DEBUG` or similar (e.g., `gameState.js:80-98`, `gameState.js:104-118`). Replace critical ones with more targeted logging if needed.

## Phase 2: DRY - Reducing Redundancy

*   **Objective:** Identify and consolidate repeated code blocks or logic.
*   **Potential Areas:**
    *   **DOM Element Selection:** Check if elements are selected multiple times across different functions or modules (e.g., in `main.js` and `ui.js`). Consider selecting them once in `main.js` during initialization and passing them down or creating a dedicated UI elements module.
        *   _Example:_ `document.getElementById('...')` calls in `main.js` (lines 20-34, 367-380) and potentially `ui.js`.
    *   **Pawn Position Checking:** The logic for checking pawn positions (`start`, `board`, `safe`, `home`) is used in various places (`moves.js`, `ui.js`, `ai.js`). Look for opportunities to centralize these checks, perhaps adding more helper functions to `gameState.js`.
        *   _Example:_ Variations of loops checking `pawn.positionType` might exist across files handling move validation or UI updates.
    *   **Player Iteration:** Loops iterating through `gameState.players` (e.g., `gameState.js:60`, `gameState.js:161`, likely elsewhere) could potentially be abstracted if the core logic inside the loop is similar.

## Phase 3: Refactoring for Clarity & Structure

*   **Objective:** Improve the organization and clarity of complex functions or modules.
*   **Potential Areas:**
    *   **`main.js`:** This file handles initialization, event listeners, and coordination. Consider if some logic could be moved to more specific modules.
        *   _Example:_ The `handleNextTurn` function (`main.js:234-290`) is quite long. Could parts of it (like AI turn triggering, UI updates) be broken into smaller, more focused functions?
        *   _Example:_ Network status handling (`main.js:132-179`) might become complex. Ensure clear separation of concerns between `main.js` and `network.js`.
    *   **`ui.js`:** Review functions like `updateUI` and `determineActionsForCard`. Ensure they have single responsibilities. Could `determineActionsForCard` be potentially moved closer to `moves.js` or `gameState.js` if it's primarily about game logic rather than direct DOM manipulation? (Need to review `ui.js` content first).
    *   **`moves.js`:** This file likely contains core move validation and execution logic. Ensure functions are well-defined and potentially break down very large validation functions. (Need to review `moves.js` content first).
    *   **Server-Side (`server.js`):** Although marked as conceptual, if implemented, the server-side action handling (`server.js:141-172`) needs robust validation and state management separate from client-side assumptions. This would involve porting/creating server-side equivalents of game logic functions.

## Phase 4: State Management Improvements

*   **Objective:** Ensure game state updates are predictable and easy to trace.
*   **Actions:**
    *   Strictly enforce that only designated functions (potentially mostly within `gameState.js` or `moves.js` for move execution) modify the `gameState` object directly. Avoid direct modifications from UI or other modules.
    *   Review how state changes are communicated (e.g., events vs. direct calls). Ensure consistency.
    *   Consider if the `gameState` structure itself can be improved for clarity (e.g., how `splitData` is managed).

**Important:** Make small, incremental changes and test frequently after each step to minimize the risk of introducing regressions. Use version control (like Git) effectively to track changes and revert if necessary.
