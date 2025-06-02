// public/js/tasks.js

// We assume global variables `currentBoard` and `boardData` exist.
// They are defined/managed in main.js. This module exports the functions
// that operate on them.

//////////////////////////////////////////////
// createTask(columnId, text)
//    • Build a single `.task` element (DOM) with drag/drop enabled
//    • Return the DOM element (or null on error)
//////////////////////////////////////////////
export function createTask(columnId, text) {
  if (!boardData.boards[currentBoard].columns[columnId]) {
    console.error('Invalid column:', columnId);
    return null;
  }

  const task = document.createElement('div');
  task.className = 'task';
  task.draggable = true;

  // Move indicator (for mobile “hold & drag”)
  const moveIndicator = document.createElement('div');
  moveIndicator.className = 'move-indicator';
  moveIndicator.innerHTML = '⋮⋮';
  moveIndicator.title = 'Hold and drag to move';
  task.appendChild(moveIndicator);

  // Content wrapper
  const taskContent = document.createElement('div');
  taskContent.className = 'task-content';

  // Text span
  const taskText = document.createElement('span');
  taskText.className = 'task-text';
  taskText.textContent = text;
  taskContent.appendChild(taskText);
  task.appendChild(taskContent);

  // Desktop drag events:
  task.addEventListener('dragstart', () => {
    task.classList.add('dragging');
    showToast('Drop in another column to move');
  });
  task.addEventListener('dragend', () => {
    task.classList.remove('dragging');
    document.querySelectorAll('.tasks').forEach(col => col.classList.remove('drag-over'));
    updateTasksArray();
    showToast('Task moved');
  });

  // (You could add touch‐based drag here if you need it again.)

  return task;
}

//////////////////////////////////////////////
// updateTasksArray()
//   • After a drag/drop reordering, read the DOM
//     and update `boardData.boards[currentBoard].columns[...]` accordingly.
//   • Then call saveTasks() to persist.
//////////////////////////////////////////////
export function updateTasksArray() {
  document.querySelectorAll('.column').forEach(column => {
    const columnId = column.dataset.column;
    const tasksContainer = column.querySelector('.tasks');
    if (!tasksContainer) return;

    const tasks = tasksContainer.querySelectorAll('.task');
    boardData.boards[currentBoard].columns[columnId].tasks = Array.from(tasks)
      .map(taskEl => taskEl.querySelector('.task-text')?.textContent.trim() || '')
      .filter(t => t);
  });

  saveTasks(); // persist immediately
}

//////////////////////////////////////////////
// renderTasks()
//   • Completely re‐renders all columns & tasks
//   • Called after loadTasks(), or after each update.
//////////////////////////////////////////////
export function renderTasks() {
  // Clear out existing columns (except the “Add Column” button)
  document.querySelectorAll('.column').forEach(col => {
    if (col !== document.getElementById('add-column').closest('.column')) {
      col.remove();
    }
  });

  const boardInfo = boardData.boards[currentBoard];
  if (!boardInfo) return;

  Object.entries(boardInfo.columns).forEach(([columnId, column]) => {
    // 1) Create the column container
    const columnEl = document.createElement('div');
