// public/js/taskModal.js

// ─────────────────────────────────────────────────────────────────────
// A) GRAB ELEMENTS FOR “ADD / EDIT TASK” MODAL
// ─────────────────────────────────────────────────────────────────────
const taskModal       = document.getElementById("task-modal");
const taskForm        = document.getElementById("task-form");
const taskInput       = document.getElementById("task-input");
const taskModalTitle  = document.getElementById("task-modal-title");
const deleteTaskBtn   = document.getElementById("delete-task-btn");

// This will hold the context when editing:
// { type: "add" | "edit", column: columnId, taskEl: <div class="task"> }
let currentTaskAction = { type: "add", column: null, taskEl: null };

// Expose closeTaskModal globally for inline onclick on “Cancel”
window.closeTaskModal = closeTaskModal;


// ─────────────────────────────────────────────────────────────────────
// B) GRAB ELEMENTS FOR “DELETE TASK” CONFIRMATION MODAL (if it exists)
// ─────────────────────────────────────────────────────────────────────
const deleteTaskModal       = document.getElementById("delete-task-modal");
const confirmDeleteTaskBtn  = document.getElementById("confirm-delete-task-btn");

// We will store which task‐element is pending deletion here:
let taskToDelete = null;

// Expose closeDeleteTaskModal() globally so inline onclick works
window.closeDeleteTaskModal = closeDeleteTaskModal;


/**
 * openTaskModal(action, columnId, taskEl?):
 *   • action: "add" or "edit"
 *   • columnId: string (e.g. "2025-06-01")
 *   • taskEl: the existing <div class="task"> (only for "edit")
 */
function openTaskModal(action, columnId, taskEl = null) {
  currentTaskAction = { type: action, column: columnId, taskEl };

  if (!taskModalTitle || !taskInput || !deleteTaskBtn) {
    console.error("openTaskModal: Missing required DOM elements.");
    return;
  }

  if (action === "add") {
    taskModalTitle.textContent = "Add Task";
    taskInput.value = "";
    deleteTaskBtn.style.display = "none";
    taskToDelete = null;
  }
  else if (action === "edit" && taskEl) {
    taskModalTitle.textContent = "Edit Task";
    // Populate textarea with existing text
    const existingText = taskEl.querySelector(".task-text")?.textContent || "";
    taskInput.value = existingText;
    deleteTaskBtn.style.display = "block";

    // When user clicks “Delete Task” button inside this modal:
    deleteTaskBtn.onclick = () => {
      // If we DO have a “Delete Task” modal in the DOM, open that:
      if (deleteTaskModal) {
        taskToDelete = { column: columnId, taskEl };
        openDeleteTaskModal();
      }
      else {
        // Fallback: plain window.confirm()
        if (confirm("Are you sure you want to delete this task?")) {
          performTaskDeletion(columnId, taskEl);
          closeTaskModal();
        }
      }
    };
  }

  // Show the add/edit modal
  if (taskModal) {
    taskModal.style.display = "flex";
    taskInput.focus();
  }
}


/**
 * closeTaskModal():
 *   Hides the “Add/Edit Task” modal and clears state
 */
function closeTaskModal() {
  if (taskModal) {
    taskModal.style.display = "none";
  }
  taskInput.value = "";
  currentTaskAction = { type: "add", column: null, taskEl: null };
  taskToDelete = null;
}


// ─────────────────────────────────────────────────────────────────────
// C) HANDLE FORM SUBMISSION (both Add & Edit)
// ─────────────────────────────────────────────────────────────────────
if (taskForm) {
  taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    if (!text) return;

    const columnId = currentTaskAction.column;
    const boardCols = window.boardData?.columns || {};

    if (currentTaskAction.type === "add") {
      // 1) Update in‐memory data
      if (!Array.isArray(boardCols[columnId]?.tasks)) {
        boardCols[columnId].tasks = [];
      }
      boardCols[columnId].tasks.push(text);

      // 2) Create a new task <div> in the DOM
      const newTaskEl = createTask(columnId, text);
      if (newTaskEl) {
        const tasksContainer = document.getElementById(columnId);
        tasksContainer?.appendChild(newTaskEl);
      }
    }
    else if (currentTaskAction.type === "edit") {
      const taskEl = currentTaskAction.taskEl;
      if (taskEl) {
        // 1) Find index of this task in its parent
        const tasksContainer = taskEl.parentElement;
        const index = Array.from(tasksContainer.children).indexOf(taskEl);
        if (index >= 0) {
          // 2) Update in‐memory
          boardCols[columnId].tasks[index] = text;
          // 3) Update DOM
          taskEl.querySelector(".task-text").textContent = text;
        }
      }
    }

    // 3) Save to server (PUT /api/board/:boardName)
    try {
      await saveTasks();
      closeTaskModal();
      showToast("Task saved");
    } catch (err) {
      console.error("Error saving task:", err);
      showToast("Error saving task");
    }
  });
}


// Submit on “Enter” (without Shift) inside textarea
if (taskInput) {
  taskInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      taskForm.requestSubmit();
    }
  });
}

// Close modal when clicking outside its content
if (taskModal) {
  taskModal.addEventListener("click", (e) => {
    if (e.target === taskModal) {
      closeTaskModal();
    }
  });
}

// Close modal when pressing Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && taskModal?.style.display === "flex") {
    closeTaskModal();
  }
});


// ─────────────────────────────────────────────────────────────────────
// D) ACTUAL TASK DELETION LOGIC (used by both confirm-modal & fallback)
// ─────────────────────────────────────────────────────────────────────
async function performTaskDeletion(columnId, taskEl) {
  if (!columnId || !taskEl) return;

  // 1) Remove from in‐memory data
  const tasksArr = window.boardData.columns[columnId].tasks;
  const parentDiv = taskEl.parentElement; // `.tasks` container
  const index = Array.from(parentDiv.children).indexOf(taskEl);
  if (index >= 0) {
    tasksArr.splice(index, 1);
  }

  // 2) Remove from DOM
  taskEl.remove();

  // 3) Save to server
  try {
    await saveTasks();
    showToast("Task deleted");
  } catch (err) {
    console.error("Error deleting task:", err);
    showToast("Error deleting task");
  }
}


// ─────────────────────────────────────────────────────────────────────
// E) “DELETE TASK” CONFIRMATION MODAL LOGIC
// ─────────────────────────────────────────────────────────────────────

/**
 * openDeleteTaskModal():
 *   • If you have <div id="delete-task-modal">…</div> in your HTML,
 *     this will show it. Otherwise, fallback was already handled above.
 */
function openDeleteTaskModal() {
  if (!deleteTaskModal) return; 
  // Show the delete‐modal:
  deleteTaskModal.style.display = "flex";
}

/**
 * closeDeleteTaskModal():
 *   • Hides the “Delete Task” modal
 *   • Clears taskToDelete
 */
function closeDeleteTaskModal() {
  if (!deleteTaskModal) return;
  deleteTaskModal.style.display = "none";
  taskToDelete = null;
}

// If the user clicks outside the deleteTaskModal content, close it
if (deleteTaskModal) {
  deleteTaskModal.addEventListener("click", (e) => {
    if (e.target === deleteTaskModal) {
      closeDeleteTaskModal();
    }
  });
}

// When the user presses “Escape” && the deleteTaskModal is visible, close it
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && deleteTaskModal?.style.display === "flex") {
    closeDeleteTaskModal();
  }
});

// Hook up the “Confirm Delete Task” button inside the delete‐modal
if (confirmDeleteTaskBtn) {
  confirmDeleteTaskBtn.addEventListener("click", async () => {
    if (!taskToDelete) {
      showToast("No task selected to delete");
      closeDeleteTaskModal();
      return;
    }
    const { column, taskEl } = taskToDelete;

    // Perform the deletion, close modals
    await performTaskDeletion(column, taskEl);
    closeDeleteTaskModal();
    closeTaskModal();
  });
}


// ─────────────────────────────────────────────────────────────────────
// F) “createTask” HELPER (UNCHANGED)
// ─────────────────────────────────────────────────────────────────────
let lastTapTime = 0;
function handleTouchForEdit(e) {
  const currentTime = new Date().getTime();
  const tapLength = currentTime - lastTapTime;
  clearTimeout(this.tapTimeout);

  if (tapLength < 500 && tapLength > 0) {
    e.preventDefault();
    openTaskModal("edit", this.parentElement.id, this);
  } else {
    this.tapTimeout = setTimeout(() => {}, 500);
  }
  lastTapTime = currentTime;
}

function updateTasksArray() {
  const columns = window.boardData.columns || {};
  Object.keys(columns).forEach((columnId) => {
    const tasksContainer = document.getElementById(columnId);
    if (!tasksContainer) return;

    const tasks = Array.from(
      tasksContainer.querySelectorAll(".task .task-text")
    )
      .map((span) => span.textContent.trim())
      .filter((t) => t);

    columns[columnId].tasks = tasks;
  });

  // Save to server & broadcast via Socket.IO
  saveTasks();
}

function createTask(columnId, text = "") {
  const boardCols = window.boardData.columns;
  if (!boardCols[columnId]) {
    console.error("Invalid column:", columnId);
    return null;
  }

  const taskEl = document.createElement("div");
  taskEl.className = "task";
  taskEl.draggable = true;

  // (a) Move indicator for mobile drag – now hidden via CSS
  const moveIndicator = document.createElement("div");
  moveIndicator.className = "move-indicator";
  moveIndicator.innerHTML = "⋮⋮";
  moveIndicator.title = "Hold and drag to move";
  taskEl.appendChild(moveIndicator);

  // (b) Task content wrapper
  const taskContent = document.createElement("div");
  taskContent.className = "task-content";
  const taskText = document.createElement("span");
  taskText.className = "task-text";
  taskText.textContent = text;
  taskContent.appendChild(taskText);
  taskEl.appendChild(taskContent);

  // Double-click or double-tap to edit
  taskEl.addEventListener("dblclick", () => {
    openTaskModal("edit", columnId, taskEl);
  });
  taskEl.addEventListener("touchstart", handleTouchForEdit);

  // Desktop drag‐and‐drop
  taskEl.addEventListener("dragstart", () => {
    taskEl.classList.add("dragging");
    showToast("Drop in another day to move");
  });
  taskEl.addEventListener("dragend", () => {
    taskEl.classList.remove("dragging");
    document.querySelectorAll(".tasks").forEach((col) => col.classList.remove("drag-over"));
    updateTasksArray();
    showToast("Task moved");
  });

  // Mobile drag & drop (unchanged from before)
  let isDragging = false;
  let touchStartX = 0, touchStartY = 0, feedbackTimeout, originalColumnEl = null;

  taskEl.addEventListener("touchstart", (e) => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    originalColumnEl = taskEl.parentElement;
    feedbackTimeout = setTimeout(() => {
      taskEl.classList.add("dragging");
      showToast("Move task to another day");
      isDragging = true;
    }, 200);
  });

  taskEl.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!isDragging) {
      if (
        Math.abs(e.touches[0].clientX - touchStartX) > 5 ||
        Math.abs(e.touches[0].clientY - touchStartY) > 5
      ) {
        clearTimeout(feedbackTimeout);
      }
      return;
    }
    const touch = e.touches[0];
    const elementsUnder = document.elementsFromPoint(touch.clientX, touch.clientY);
    const columnUnder = elementsUnder.find((el) => el.classList.contains("tasks"));
    if (columnUnder) {
      columnUnder.classList.add("drag-over");
      const tasksInColumn = [
        ...columnUnder.querySelectorAll(".task:not(.dragging)"),
      ];
      const closest = tasksInColumn.reduce(
        (closestMatch, child) => {
          const rect = child.getBoundingClientRect();
          const offset = touch.clientY - (rect.top + rect.height / 2);
          if (offset < 0 && offset > closestMatch.offset) {
            return { offset, element: child };
          } else {
            return closestMatch;
          }
        },
        { offset: Number.NEGATIVE_INFINITY, element: null }
      ).element;

      if (closest) {
        columnUnder.insertBefore(taskEl, closest);
      } else {
        columnUnder.appendChild(taskEl);
      }
      document.querySelectorAll(".tasks").forEach((col) => {
        if (col !== columnUnder) col.classList.remove("drag-over");
      });
    }
  });

  taskEl.addEventListener("touchend", (e) => {
    e.preventDefault();
    clearTimeout(feedbackTimeout);
    if (isDragging) {
      taskEl.classList.remove("dragging");
      document.querySelectorAll(".tasks").forEach((col) => col.classList.remove("drag-over"));
      updateTasksArray();
      showToast("Task moved");
    }
    isDragging = false;
  });

  taskEl.addEventListener("touchcancel", (e) => {
    e.preventDefault();
    clearTimeout(feedbackTimeout);
    taskEl.classList.remove("dragging");
    document.querySelectorAll(".tasks").forEach((col) => col.classList.remove("drag-over"));
    isDragging = false;
    if (originalColumnEl) {
      originalColumnEl.appendChild(taskEl);
    }
  });

  return taskEl;
}


// Export openTaskModal globally so other code (e.g. renderTasks.js) can call it
window.openTaskModal = openTaskModal;