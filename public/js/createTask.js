// public/js/createTask.js

/**
 * createTask(columnId, text)
 * • Builds a <div class="task"> element with the given text under the given columnId.
 * • Attaches event listeners for editing, dragging, and deletion.
 * • Returns the new DOM element so caller can append it to the tasks container.
 *
 * NOTE: window.boardData is the single‐board object with shape:
 *   {
 *     name: "Board Display Name",
 *     columns: {
 *       <columnId>: {
 *         name: "Column Display Name",
 *         tasks: ["Task A", "Task B", ...]
 *       },
 *       ...
 *     }
 *   }
 */
function createTask(columnId, text = "") {
  // Verify that the column exists in the current board
  const boardColumns = window.boardData?.columns;
  if (!boardColumns || !boardColumns[columnId]) {
    console.error("createTask: Invalid columnId:", columnId);
    return null;
  }

  // 1) Build the outer .task div
  const taskEl = document.createElement("div");
  taskEl.className = "task";
  taskEl.draggable = true;

  // 2) Move indicator for mobile
  const moveIndicator = document.createElement("div");
  moveIndicator.className = "move-indicator";
  moveIndicator.innerHTML = "⋮⋮";
  moveIndicator.title = "Hold and drag to move";
  taskEl.appendChild(moveIndicator);

  // 3) Task content wrapper
  const taskContent = document.createElement("div");
  taskContent.className = "task-content";

  const taskText = document.createElement("span");
  taskText.className = "task-text";
  taskText.textContent = text;
  taskContent.appendChild(taskText);
  taskEl.appendChild(taskContent);

  // 4) Double-click (or double-tap) to open edit modal
  taskEl.addEventListener("dblclick", () => {
    openTaskModal("edit", columnId, taskEl);
  });
  // For mobile double-tap, rely on the handleTouchForEdit defined in taskModal.js
  taskEl.addEventListener("touchstart", handleTouchForEdit);

  // 5) Desktop drag events
  taskEl.addEventListener("dragstart", () => {
    taskEl.classList.add("dragging");
    showToast("Drop in another column to move");
  });
  taskEl.addEventListener("dragend", () => {
    taskEl.classList.remove("dragging");
    document.querySelectorAll(".tasks").forEach((col) => col.classList.remove("drag-over"));
    updateTasksArray(); // Sync new order in-memory and save
    showToast("Task moved");
  });

  // 6) Mobile touch drag events
  let isDragging = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let feedbackTimeout;
  let originalColumnEl = null;

  taskEl.addEventListener("touchstart", (e) => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    originalColumnEl = taskEl.parentElement;
    feedbackTimeout = setTimeout(() => {
      taskEl.classList.add("dragging");
      showToast("Move task to another column");
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
      const tasksInColumn = Array.from(columnUnder.querySelectorAll(".task:not(.dragging)"));
      const closest = tasksInColumn.reduce(
        (closestMatch, child) => {
          const rect = child.getBoundingClientRect();
          const offset = touch.clientY - (rect.top + rect.height / 2);
          if (offset < 0 && offset > closestMatch.offset) {
            return { offset, element: child };
          }
          return closestMatch;
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

/**
 * updateTasksArray()
 * • Reads the DOM order of tasks in each .tasks container and updates
 *   window.boardData.columns[columnId].tasks accordingly.
 * • Then calls saveTasks() to persist via PUT /api/board/:boardName.
 */
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

  saveTasks(); // send updated boardData back to server
}
