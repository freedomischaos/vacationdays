// public/js/initBoard.js

(function () {
  // 1) Figure out boardName from the URL path
  const segments = window.location.pathname.split("/").filter(Boolean);
  const boardName = segments.length > 0 ? segments[0] : "";

  window.currentBoard = boardName; // global

  // 2) Update placeholders in the DOM, only if those elements exist
  const headerTitleEl = document.getElementById("header-title");
  const boardTitleEl = document.getElementById("board-title");
  const currentBoardBtnEl    = document.getElementById("current-board");
  const overlayTitleEl       = document.getElementById("overlay-title");
  const deleteBoardNameEl    = document.getElementById("delete-board-name");
  const deleteConfirmTextEl  = document.getElementById("delete-board-confirm-text");

  if (headerTitleEl)       headerTitleEl.textContent       = boardName || "Vacation Days";
  if (currentBoardBtnEl)   currentBoardBtnEl.textContent   = boardName || "Select Board";
  if (overlayTitleEl)      overlayTitleEl.textContent      = boardName || "Vacation Days";
  if (deleteBoardNameEl)   deleteBoardNameEl.textContent   = boardName;
  if (deleteConfirmTextEl) deleteConfirmTextEl.textContent = boardName;

  // 3) If boardName is invalid or empty → show the overlay (only if overlay exists)
  if (!boardName.match(/^[a-zA-Z0-9]+$/)) {
    const overlay = document.getElementById("boardname-overlay");
    if (overlay) {
      overlay.style.display = "flex";

      const boardForm = document.getElementById("boardname-form");
      if (boardForm) {
        boardForm.addEventListener("submit", function (e) {
          e.preventDefault();
          const inputEl  = document.getElementById("overlay-input");
          const errorEl  = document.getElementById("boardname-error");
          const inputVal = inputEl ? inputEl.value.trim() : "";

          if (!/^[a-zA-Z0-9]+$/.test(inputVal)) {
            if (errorEl) errorEl.style.display = "block";
          } else {
            window.location.href = "/" + encodeURIComponent(inputVal);
          }
        });
      }
    }

    // Don’t proceed to loadTasks() if invalid boardName
    return;
  }

  // 4) If valid, wait for DOMContentLoaded then call loadTasks()
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof loadTasks === "function") {
      loadTasks()
        .then(() => {
          const boardDisplayName = window.boardData?.name || boardName;
          document.title = boardDisplayName;

          if (headerTitleEl) headerTitleEl.textContent = boardDisplayName;
          if (boardTitleEl) boardTitleEl.textContent = boardDisplayName;
          if (currentBoardBtnEl) currentBoardBtnEl.textContent = boardDisplayName;
        })
        .catch((err) => {
          console.error("initBoard: Failed to load tasks:", err);
          if (err.status === 401 || err.status === 404) {
            window.location.href = "/join-or-create.html";
          } else {
            if (typeof showToast === "function") {
              showToast("Error loading board");
            }
          }
        });
    } else {
      console.error("loadTasks() is not defined. Did you include api.js?");
    }
  });

  // 5) Wire up the “board selector” toggle, only if those elements exist
  const boardMenuEl = document.getElementById("board-menu");
  if (currentBoardBtnEl && boardMenuEl) {
    currentBoardBtnEl.addEventListener("click", () => {
      boardMenuEl.hidden = !boardMenuEl.hidden;
    });

    document.addEventListener("click", (e) => {
      if (!currentBoardBtnEl.contains(e.target) && !boardMenuEl.contains(e.target)) {
        boardMenuEl.hidden = true;
      }
    });
  }
})();