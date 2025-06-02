// public/js/api.js

/**
 * fetchBoard(boardId)
 * • GET /api/board/:boardId
 * • Returns the board JSON ({ name, columns })
 */
async function fetchBoard(boardId) {
  try {
    const resp = await fetch(`/api/board/${encodeURIComponent(boardId)}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!resp.ok) {
      throw new Error(`Failed to fetch board "${boardId}" (${resp.status})`);
    }
    return await resp.json();
  } catch (err) {
    console.error("Error in fetchBoard:", err);
    throw err;
  }
}

/**
 * fetchAllBoards()
 * • GET /api/boards
 * • Returns an array: [ { id, name }, … ]
 */
async function fetchAllBoards() {
  try {
    const resp = await fetch("/api/boards", {
      headers: { "Content-Type": "application/json" },
    });
    if (!resp.ok) {
      throw new Error(`Failed to fetch boards (${resp.status})`);
    }
    return await resp.json();
  } catch (err) {
    console.error("Error in fetchAllBoards:", err);
    throw err;
  }
}

/**
 * saveTasks()
 * • PUT /api/board/:currentBoard
 * • Sends window.boardData (shape { name, columns }) as JSON
 * • Returns the server’s JSON or throws on error
 */
async function saveTasks() {
  if (!window.currentBoard || !window.boardData) {
    console.error("saveTasks: Missing window.currentBoard or window.boardData");
    return;
  }

  try {
    const payload = JSON.stringify(window.boardData, null, 2);
    const resp = await fetch(
      `/api/board/${encodeURIComponent(window.currentBoard)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: payload,
      }
    );
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Failed to save board (${resp.status})${text ? ": " + text : ""}`);
    }
    return await resp.json();
  } catch (err) {
    console.error("Error in saveTasks:", err);
    throw err;
  }
}

/**
 * createNewBoard(boardId, boardObject)
 * • POST /api/board/:boardId with body = boardObject
 * • boardObject must be { name: string, columns: { ... } }
 * • Returns the server’s JSON or throws on error
 */
async function createNewBoard(boardId, boardObject) {
  try {
    const payload = JSON.stringify(boardObject, null, 2);
    const resp = await fetch(`/api/board/${encodeURIComponent(boardId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    if (resp.status === 409) {
      throw new Error("Board already exists (409)");
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Failed to create board (${resp.status})${text ? ": " + text : ""}`);
    }
    return await resp.json();
  } catch (err) {
    console.error("Error in createNewBoard:", err);
    throw err;
  }
}

/**
 * deleteBoard(boardId)
 * • DELETE /api/board/:boardId
 * • Returns the server’s JSON or throws on error
 */
async function deleteBoard(boardId) {
  try {
    const resp = await fetch(`/api/board/${encodeURIComponent(boardId)}`, {
      method: "DELETE",
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Failed to delete board "${boardId}" (${resp.status})${text ? ": " + text : ""}`);
    }
    return await resp.json();
  } catch (err) {
    console.error("Error in deleteBoard:", err);
    throw err;
  }
}

// Expose these functions globally so other modules can use them
window.fetchBoard      = fetchBoard;
window.fetchAllBoards  = fetchAllBoards;
window.saveTasks       = saveTasks;
window.createNewBoard  = createNewBoard;
window.deleteBoard     = deleteBoard;
