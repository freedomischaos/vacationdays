// public/js/board.js

// DOM Elements
const boardContainer = document.querySelector('.board');
const themeToggle = document.getElementById('theme-toggle');
const toast = document.getElementById('toast');
const addColumnBtn = document.getElementById('add-column');

// Board selector elements (if you still keep a multi-board menu)
const currentBoardBtn = document.getElementById('current-board');
const boardMenu = document.getElementById('board-menu');
const boardsListMenu = document.getElementById('boards-list-menu');

let boardData = {};      // The currently loaded board’s JSON: { name, columns: { columnId: { name, tasks: [] }, … } }
let currentBoard = '';   // Set by initBoard.js

// Show/hide boards list on current board button click (if used)
if (currentBoardBtn && boardMenu) {
  currentBoardBtn.addEventListener('click', () => {
    boardMenu.hidden = !boardMenu.hidden;
  });
}

// If you maintain a dropdown of all boards in one UI, you’d need an endpoint GET /api/boards
// For now, clicking a board in boardsListMenu just switches currentBoard and reloads.
if (boardsListMenu) {
  boardsListMenu.addEventListener('click', async (e) => {
    const button = e.target;
    if (!button.dataset.board) return;

    const boardId = button.dataset.board;
    if (boardId === currentBoard) return;

    try {
      currentBoard = boardId;
      currentBoardBtn.textContent = boardId;
      boardMenu.hidden = true;
      await loadTasks();
      showToast('Switched to ' + boardId);
    } catch (error) {
      console.error('Error switching board:', error);
      showToast('Error switching board');
    }
  });
}

// Close board menu when clicking outside
document.addEventListener('click', (e) => {
  if (
    currentBoardBtn &&
    boardMenu &&
    !currentBoardBtn.contains(e.target) &&
    !boardMenu.contains(e.target)
  ) {
    boardMenu.hidden = true;
  }
});

// Load tasks (GET /api/board/:boardName)
async function loadTasks() {
  try {
    const response = await fetch(`/api/board/${encodeURIComponent(currentBoard)}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (response.status === 404) {
      showToast('Board not found');
      return;
    }
    if (!response.ok) throw new Error('Failed to load board data');
    const data = await response.json();

    // data has shape: { name: <string>, columns: { columnId: { name, tasks: [] }, … } }
    boardData = { boards: { [currentBoard]: data }, activeBoard: currentBoard };

    // Update UI
    currentBoardBtn.textContent = data.name;
    renderTasks();
    updateBoardSelector();
  } catch (error) {
    console.error('Error loading tasks:', error);
    showToast('Error loading tasks');
  }
}

// Update board selector (GET /api/board/:currentBoard, just to refresh name)
// If you want a list of all boards, you’d need a separate GET /api/boards endpoint.
async function updateBoardSelector() {
  try {
    const response = await fetch(`/api/board/${encodeURIComponent(currentBoard)}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to fetch board selector data');
    const data = await response.json();

    currentBoardBtn.textContent = data.name;
    boardData.boards[currentBoard] = data;
  } catch (error) {
    console.error('Error updating board selector:', error);
  }
}

// Column name editing (delegated after rendering)
function attachColumnNameListeners() {
  document.querySelectorAll('.column-name').forEach(nameEl => {
    nameEl.addEventListener('blur', () => {
      const column = nameEl.closest('.column').dataset.column;
      boardData.boards[currentBoard].columns[column].name = nameEl.textContent;
      saveTasks();
    });
    nameEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nameEl.blur();
      }
    });
  });
}

// Task Modal Elements
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskModalTitle = document.getElementById('task-modal-title');
let currentTaskAction = { type: 'add', column: null, task: null };

// Handle Enter key in task input
if (taskInput) {
  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      taskForm.requestSubmit();
    }
  });
}

function openTaskModal(type, column, task = null) {
  currentTaskAction = { type, column, task };
  taskModalTitle.textContent = type === 'add' ? 'Add Task' : 'Edit Task';
  taskInput.value = task ? task.querySelector('.task-text').textContent : '';

  const deleteBtn = document.getElementById('delete-task-btn');
  if (type === 'edit') {
    deleteBtn.style.display = 'block';
    deleteBtn.onclick = () => {
      if (confirm('Are you sure you want to delete this task?')) {
        const columnId = task.parentElement.id;
        const index = Array.from(task.parentElement.children).indexOf(task);
        boardData.boards[currentBoard].columns[columnId].tasks.splice(index, 1);
        task.remove();
        saveTasks();
        showToast('Task deleted');
        closeTaskModal();
      }
    };
  } else {
    deleteBtn.style.display = 'none';
  }

  taskModal.style.display = 'flex';
  taskInput.focus();
}

function closeTaskModal() {
  taskModal.style.display = 'none';
  taskInput.value = '';
}

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;

  if (currentTaskAction.type === 'add') {
    boardData.boards[currentBoard].columns[currentTaskAction.column].tasks.push(text);
    const task = createTask(currentTaskAction.column, text);
    if (task) {
      document.getElementById(currentTaskAction.column).appendChild(task);
    }
  } else {
    const task = currentTaskAction.task;
    const columnId = task.closest('.column').dataset.column;
    const tasksContainer = task.parentElement;
    const index = Array.from(tasksContainer.children).indexOf(task);
    boardData.boards[currentBoard].columns[columnId].tasks[index] = text;
    task.querySelector('.task-text').textContent = text;
  }

  await saveTasks();
  closeTaskModal();
});

// Create a task DOM element (same as before)
function createTask(column, text = '') {
  if (!boardData.boards[currentBoard].columns[column]) {
    console.error('Invalid column:', column);
    return null;
  }

  const task = document.createElement('div');
  task.className = 'task';
  task.draggable = true;

  // Move indicator
  const moveIndicator = document.createElement('div');
  moveIndicator.className = 'move-indicator';
  moveIndicator.innerHTML = '⋮⋮';
  moveIndicator.title = 'Hold and drag to move';
  task.appendChild(moveIndicator);

  // Content wrapper
  const taskContent = document.createElement('div');
  taskContent.className = 'task-content';

  // Text
  const taskText = document.createElement('span');
  taskText.className = 'task-text';
  taskText.textContent = text;
  taskContent.appendChild(taskText);
  task.appendChild(taskContent);

  // Double click / double tap behavior omitted for brevity…
  // Desktop drag events
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

  // Touch drag omitted…

  return task;
}

// Close move buttons when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.task')) {
    document.querySelectorAll('.move-buttons').forEach(btns => (btns.style.display = 'none'));
  }
});

// Add task buttons (rendered dynamically in renderTasks)
function attachAddTaskListeners() {
  document.querySelectorAll('.add-task').forEach(button => {
    button.addEventListener('click', () => {
      const column = button.dataset.column;
      openTaskModal('add', column);
    });
  });
}

// Close modal when clicking outside
if (taskModal) {
  taskModal.addEventListener('click', (e) => {
    if (e.target === taskModal) {
      closeTaskModal();
    }
  });
}

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && taskModal && taskModal.style.display === 'flex') {
    closeTaskModal();
  }
});

// Update the in-memory tasks array after a drag & drop
function updateTasksArray() {
  document.querySelectorAll('.column').forEach(column => {
    const columnId = column.dataset.column;
    const tasksContainer = column.querySelector('.tasks');
    if (!tasksContainer) return;

    const tasks = tasksContainer.querySelectorAll('.task');
    boardData.boards[currentBoard].columns[columnId].tasks = Array.from(tasks)
      .map(task => task.querySelector('.task-text')?.textContent.trim() || '')
      .filter(text => text);
  });

  saveTasks();
}

// Save tasks (PUT /api/board/:boardName)
async function saveTasks() {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const boardPayload = boardData.boards[currentBoard];

    const saveResponse = await fetch(`/api/board/${encodeURIComponent(currentBoard)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(boardPayload, null, 2)
    });

    if (saveResponse.status === 404) {
      showToast('Board not found');
      return;
    }
    if (!saveResponse.ok) throw new Error('Failed to save tasks');
    showToast('Changes saved');
  } catch (error) {
    console.error('Error saving tasks:', error);
    showToast('Error saving changes');
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => (toast.hidden = true), 2000);
}

// Render tasks and columns based on boardData
function renderTasks() {
  // Clear existing columns (except the add-column button)
  document.querySelectorAll('.column').forEach(col => {
    if (col !== addColumnBtn.closest('.column')) {
      col.remove();
    }
  });

  const boardInfo = boardData.boards[currentBoard];
  if (!boardInfo) return;

  Object.entries(boardInfo.columns).forEach(([columnId, column]) => {
    const columnEl = document.createElement('div');
    columnEl.className = 'column';
    columnEl.dataset.column = columnId;

    // Header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'column-header';

    const h2 = document.createElement('h2');
    h2.className = 'column-name';
    h2.contentEditable = true;
    h2.textContent = column.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-column';
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Remove column';
    removeBtn.onclick = () => openDeleteColumnModal(columnId);

    headerDiv.appendChild(h2);
    headerDiv.appendChild(removeBtn);
    columnEl.appendChild(headerDiv);

    // Tasks container
    const tasksDiv = document.createElement('div');
    tasksDiv.className = 'tasks';
    tasksDiv.id = columnId;

    const addButton = document.createElement('button');
    addButton.className = 'add-task';
    addButton.dataset.column = columnId;
    addButton.textContent = '+ Add Task';

    h2.addEventListener('blur', () => {
      boardData.boards[currentBoard].columns[columnId].name = h2.textContent;
      saveTasks();
    });
    h2.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        h2.blur();
      }
    });
    addButton.addEventListener('click', () => openTaskModal('add', columnId));

    columnEl.appendChild(tasksDiv);
    columnEl.appendChild(addButton);

    // Render tasks
    if (Array.isArray(column.tasks)) {
      const uniqueTasks = [...new Set(column.tasks)].filter(t => t.trim());
      uniqueTasks.forEach(taskText => {
        const task = createTask(columnId, taskText);
        if (task) tasksDiv.appendChild(task);
      });
    }

    boardContainer.insertBefore(columnEl, addColumnBtn.closest('.column'));
  });

  // Re-attach listeners after rendering
  attachColumnNameListeners();
  attachAddTaskListeners();
  addColumnEventListeners();
}

// Initialize app
async function initializeApp() {
  try {
    await loadTasks();
  } catch (error) {
    console.error('Failed to load tasks:', error);
    showToast('Error loading tasks');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Theme handling
function setTheme(isDark, showToastMessage = false) {
  if (isDark) {
    document.body.classList.add('dark-theme');
    themeToggle.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    if (showToastMessage) showToast('Dark mode enabled');
  } else {
    document.body.classList.remove('dark-theme');
    themeToggle.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    if (showToastMessage) showToast('Light mode enabled');
  }
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
const savedTheme = localStorage.getItem('theme');

if (savedTheme) {
  setTheme(savedTheme === 'dark', false);
} else {
  setTheme(prefersDark.matches, false);
}

themeToggle.addEventListener('click', () => {
  const isDark = !document.body.classList.contains('dark-theme');
  setTheme(isDark, true);
});

prefersDark.addEventListener('change', (e) => {
  if (!localStorage.getItem('theme')) {
    setTheme(e.matches, true);
  }
});

// Board Management
const manageBoardsModal = document.getElementById('manage-boards-modal');
const boardsList = document.getElementById('boards-list');
const addBoardForm = document.getElementById('add-board-form');
const newBoardInput = document.getElementById('new-board-name');

function openManageBoardsModal() {
  boardMenu.hidden = true;
  manageBoardsModal.style.display = 'flex';
  renderBoardsList();
}

function closeManageBoardsModal() {
  manageBoardsModal.style.display = 'none';
  newBoardInput.value = '';
}

function renderBoardsList() {
  boardsList.innerHTML = '';
  Object.entries(boardData.boards).forEach(([id, boardInfo]) => {
    const item = document.createElement('div');
    item.className = 'board-item';

    const name = document.createElement('span');
    name.className = 'board-name';
    name.textContent = boardInfo.name;
    item.appendChild(name);

    if (Object.keys(boardData.boards).length > 1) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-board';
      deleteBtn.innerHTML = '×';
      deleteBtn.title = 'Delete board';
      deleteBtn.onclick = () => openDeleteBoardModal(id);
      item.appendChild(deleteBtn);
    }

    boardsList.appendChild(item);
  });
}

let boardToDelete = null;
const deleteConfirmForm = document.getElementById('delete-board-form');
const deleteConfirmInput = document.getElementById('delete-board-input');

function openDeleteBoardModal(boardId) {
  boardToDelete = boardId;
  const boardName = boardData.boards[boardId].name;
  document.getElementById('delete-board-name').textContent = boardName;
  document.getElementById('delete-board-confirm-text').textContent = boardName;
  deleteConfirmInput.value = '';
  document.getElementById('delete-board-modal').style.display = 'flex';
}

function closeDeleteBoardModal() {
  document.getElementById('delete-board-modal').style.display = 'none';
  boardToDelete = null;
}

deleteConfirmForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const confirmText = deleteConfirmInput.value.trim();
  const boardName = boardData.boards[boardToDelete].name;

  if (confirmText !== boardName) {
    showToast('Board name does not match');
    return;
  }

  try {
    const response = await fetch(`/api/board/${encodeURIComponent(boardToDelete)}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete board');

    delete boardData.boards[boardToDelete];

    if (boardToDelete === currentBoard) {
      const newBoardId = Object.keys(boardData.boards)[0];
      currentBoard = newBoardId;
      currentBoardBtn.textContent = boardData.boards[newBoardId].name;
      await loadTasks();
    }

    renderBoardsList();
    showToast('Board deleted');
    closeDeleteBoardModal();
    closeManageBoardsModal();
  } catch (error) {
    console.error('Error deleting board:', error);
    showToast('Error deleting board');
  }
});

addBoardForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const boardName = newBoardInput.value.trim();
  if (!boardName) return;

  const boardId = boardName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  try {
    const response = await fetch(`/api/board/${encodeURIComponent(boardId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: boardName,
        columns: {
          todo: { name: 'To Do', tasks: [] },
          doing: { name: 'Doing', tasks: [] },
          done: { name: 'Done', tasks: [] }
        }
      })
    });
    if (!response.ok) throw new Error('Failed to add board');

    boardData.boards[boardId] = {
      name: boardName,
      columns: {
        todo: { name: 'To Do', tasks: [] },
        doing: { name: 'Doing', tasks: [] },
        done: { name: 'Done', tasks: [] }
      }
    };

    renderBoardsList();
    newBoardInput.value = '';
    showToast('Board added');

    currentBoard = boardId;
    currentBoardBtn.textContent = boardName;
    await loadTasks();
    closeManageBoardsModal();
  } catch (error) {
    console.error('Error adding board:', error);
    showToast('Error adding board');
  }
});

// Close modal when clicking outside
manageBoardsModal.addEventListener('click', (e) => {
  if (e.target === manageBoardsModal) {
    closeManageBoardsModal();
  }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && manageBoardsModal.style.display === 'flex') {
    closeManageBoardsModal();
  }
});

// Add Column functionality
addColumnBtn.addEventListener('click', async () => {
  const columnId = 'column-' + Date.now();
  const columnName = 'New Column';

  boardData.boards[currentBoard].columns[columnId] = {
    name: columnName,
    tasks: []
  };

  const column = document.createElement('div');
  column.className = 'column';
  column.dataset.column = columnId;

  const h2 = document.createElement('h2');
  h2.className = 'column-name';
  h2.contentEditable = true;
  h2.textContent = columnName;

  const tasksDiv = document.createElement('div');
  tasksDiv.className = 'tasks';
  tasksDiv.id = columnId;

  const addButton = document.createElement('button');
  addButton.className = 'add-task';
  addButton.dataset.column = columnId;
  addButton.textContent = '+ Add Task';

  h2.addEventListener('blur', () => {
    boardData.boards[currentBoard].columns[columnId].name = h2.textContent;
    saveTasks();
  });
  h2.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      h2.blur();
    }
  });
  addButton.addEventListener('click', () => openTaskModal('add', columnId));

  column.appendChild(h2);
  column.appendChild(tasksDiv);
  column.appendChild(addButton);

  boardContainer.insertBefore(column, addColumnBtn.closest('.column'));

  await saveTasks();
  showToast('Column added');

  addColumnEventListeners();
});

// Add drag and drop event listeners to columns
function addColumnEventListeners() {
  document.querySelectorAll('.tasks').forEach(tasksContainer => {
    tasksContainer.addEventListener('dragover', e => {
      e.preventDefault();
      const dragging = document.querySelector('.dragging');
      if (!dragging) return;

      const notDragging = [...tasksContainer.querySelectorAll('.task:not(.dragging)')];
      const nextTask = notDragging.find(task => {
        const rect = task.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2;
      });

      if (nextTask) {
        tasksContainer.insertBefore(dragging, nextTask);
      } else {
        tasksContainer.appendChild(dragging);
      }

      tasksContainer.classList.add('drag-over');
      document.querySelectorAll('.tasks').forEach(col => {
        if (col !== tasksContainer) col.classList.remove('drag-over');
      });
    });

    tasksContainer.addEventListener('dragleave', () => {
      tasksContainer.classList.remove('drag-over');
    });
  });
}

let columnToDelete = null;

function openDeleteColumnModal(columnId) {
  columnToDelete = columnId;
  document.getElementById('delete-column-modal').style.display = 'flex';
}

function closeDeleteColumnModal() {
  document.getElementById('delete-column-modal').style.display = 'none';
  columnToDelete = null;
}

function confirmDeleteColumn() {
  if (columnToDelete) {
    delete boardData.boards[currentBoard].columns[columnToDelete];
    saveTasks();
    renderTasks();
    showToast('Column removed');
    closeDeleteColumnModal();
  }
}
