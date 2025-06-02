// public/js/renderTasks.js

let socket; // single Socket.IO connection

/**
 * loadTasks()
 * • Fetches this board’s JSON from /api/board/:boardName
 * • Stores it in window.boardData (shape: { name, columns })
 * • Calls renderTasks() to draw columns & tasks
 * • Calls updateBoardSelector() to refresh the “select board” menu
 * • Connects to Socket.IO (once) and listens for real-time events
 */
async function loadTasks() {
  try {
    // 1) Fetch this board’s data
    const response = await fetch(
      `/api/board/${encodeURIComponent(window.currentBoard)}`
    );
    if (!response.ok) {
      if (response.status === 404) {
        // If the board doesn’t exist, go home
        window.location.href = "/";
        return;
      }
      throw new Error("Failed to load tasks");
    }
    const data = await response.json();

    // 2) Save as the single board object (no .boards property here)
    //    Expected structure: { name: "...", columns: { colId: { name, tasks: [] }, ... } }
    window.boardData = data;

    // 3) Render columns & tasks in the UI
    renderTasks();

    // 4) Refresh the board‐selector dropdown
    updateBoardSelector();

    // 5) Only initialize Socket.IO once
    if (!socket) {
      socket = io();

      // When any client does PUT /api/board/:boardName → server emits "boardUpdated"
      socket.on("boardUpdated", ({ boardId, boardData: newData }) => {
        if (boardId === window.currentBoard) {
          console.log("[socket] boardUpdated", boardId);
          window.boardData = newData;
          renderTasks();
        }
      });

      // When any client does POST /api/board/:boardName → server emits "boardCreated"
      socket.on("boardCreated", ({ boardId, boardData: newBoardData }) => {
        console.log("[socket] boardCreated", boardId);
        updateBoardSelector();
      });

      // When any client does DELETE /api/board/:boardName → server emits "boardDeleted"
      socket.on("boardDeleted", ({ boardId }) => {
        console.log("[socket] boardDeleted", boardId);
        updateBoardSelector();
        if (boardId === window.currentBoard) {
          window.location.href = "/";
        }
      });
    }
  } catch (error) {
    console.error("Error loading tasks:", error);
    showToast("Error loading tasks");
  }
}

/**
 * renderTasks()
 * • Reads window.boardData.columns (an object: { columnId: { name, tasks[] } })
 * • Recreates the HTML for each column and its tasks
 */
function renderTasks() {
  const boardContainer = document.querySelector(".board");
  if (!boardContainer || !window.boardData) return;

  // Find the “+ Add Column” button inside this .board container
  const addColumnBtn = boardContainer.querySelector("#add-column");

  // Remove all existing column elements (everything before addColumnBtn)
  // (so that we can re‐insert the new columns in order)
  while (
    boardContainer.firstChild &&
    boardContainer.firstChild !== addColumnBtn
  ) {
    boardContainer.removeChild(boardContainer.firstChild);
  }

  // 1) Get this board’s columns object
  const columnsData = window.boardData.columns || {};

  // 2) For each [columnId, columnObj], build its DOM
  Object.entries(columnsData).forEach(([columnId, column]) => {
    // Column wrapper
    const columnEl = document.createElement("div");
    columnEl.className = "column";
    columnEl.dataset.column = columnId;

    // Column header: <h2 contentEditable> + remove‐column button
    const headerDiv = document.createElement("div");
    headerDiv.className = "column-header";

    const h2 = document.createElement("h2");
    h2.className = "column-name";
    h2.contentEditable = true;
    h2.textContent = column.name;
    h2.addEventListener("blur", () => {
      // Update in‐memory and push to server
      window.boardData.columns[columnId].name = h2.textContent.trim();
      saveTasks();
    });
    h2.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        h2.blur();
      }
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-column";
    removeBtn.innerHTML = "×";
    removeBtn.title = "Remove Day";
    removeBtn.addEventListener("click", () => openDeleteDayModal(columnId));

    headerDiv.appendChild(h2);
    headerDiv.appendChild(removeBtn);
    columnEl.appendChild(headerDiv);

    // Tasks container
    const tasksDiv = document.createElement("div");
    tasksDiv.className = "tasks";
    tasksDiv.id = columnId;

    // Insert existing tasks (filtered for non‐empty, unique)
    const tasksArray = Array.isArray(column.tasks) ? column.tasks : [];
    const uniqueTasks = [...new Set(tasksArray)].filter((t) => t && t.trim());
    uniqueTasks.forEach((taskText) => {
      const taskEl = createTask(columnId, taskText);
      if (taskEl) tasksDiv.appendChild(taskEl);
    });

    // + Add Task button
    const addBtn = document.createElement("button");
    addBtn.className = "add-task";
    addBtn.dataset.column = columnId;
    addBtn.textContent = "+ Add Task";
    addBtn.addEventListener("click", () => openTaskModal("add", columnId));

    columnEl.appendChild(tasksDiv);
    columnEl.appendChild(addBtn);

    // Insert column before the “+ Add Column” button (if it still exists)
    if (addColumnBtn && addColumnBtn.parentElement === boardContainer) {
      boardContainer.insertBefore(columnEl, addColumnBtn);
    } else {
      // if addColumnBtn is missing or moved, just append at end
      boardContainer.appendChild(columnEl);
    }
  });

  // Reattach drag & drop listeners now that columns exist
  addColumnEventListeners();
}

/**
 * updateBoardSelector()
 * • Fetches all boards via GET /api/boards (returns [ {id,name}, … ])
 * • Updates the dropdown menu (id="boards-list-menu") and the “current-board” text
 */
async function updateBoardSelector() {
  try {
    const resp = await fetch("/api/boards", {
      headers: { "Content-Type": "application/json" },
    });
    if (!resp.ok) throw new Error("Failed to fetch boards");
    const boardList = await resp.json(); // [ { id, name }, … ]

    // Update the “current board” button text
    const currentBoardBtn = document.getElementById("current-board");
    const currentInfo = boardList.find((b) => b.id === window.currentBoard);
    if (currentInfo && currentBoardBtn) {
      currentBoardBtn.textContent = currentInfo.name;
    }

    // Populate the dropdown menu
    const boardsListMenu = document.getElementById("boards-list-menu");
    if (boardsListMenu) {
      boardsListMenu.innerHTML = "";
      boardList.forEach(({ id, name }) => {
        const btn = document.createElement("button");
        btn.dataset.board = id;
        btn.textContent = name;
        if (id === window.currentBoard) btn.classList.add("active");
        boardsListMenu.appendChild(btn);
      });
    }
  } catch (error) {
    console.error("Error updating board selector:", error);
  }
}

/**
 * addColumnEventListeners()
 * • Attaches dragover/dragleave listeners to all .tasks containers
 * • Allows dragging a .task element to reorder within and across columns
 */
function addColumnEventListeners() {
  document.querySelectorAll(".tasks").forEach((tasksContainer) => {
    tasksContainer.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = document.querySelector(".dragging");
      if (!dragging) return;

      // Find insertion point
      const notDragging = [
        ...tasksContainer.querySelectorAll(".task:not(.dragging)"),
      ];
      const nextTask = notDragging.find((task) => {
        const rect = task.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2;
      });

      if (nextTask) {
        tasksContainer.insertBefore(dragging, nextTask);
      } else {
        tasksContainer.appendChild(dragging);
      }

      tasksContainer.classList.add("drag-over");
      document.querySelectorAll(".tasks").forEach((col) => {
        if (col !== tasksContainer) col.classList.remove("drag-over");
      });
    });

    tasksContainer.addEventListener("dragleave", () => {
      tasksContainer.classList.remove("drag-over");
    });
  });
}

// Kick things off once DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  loadTasks();
});
