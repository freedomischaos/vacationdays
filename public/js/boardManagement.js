// public/js/boardManagement.js

/**
 * boardManagement.js
 * • Handles Add‐Day modal open/close & submission (with proper date‐order sorting)
 * • Handles Delete‐Day modal open/close & confirmation
 * • Handles Delete‐Board modal open/close & confirmation
 */

(() => {
  // ─────────────────────────────────────────────────────────────────────
  // A) DEFINE GLOBAL FUNCTIONS FOR OPEN/CLOSE MODALS (so inline onclick works)
  // ─────────────────────────────────────────────────────────────────────

  window.openAddDayModal = () => {};
  window.closeAddDayModal = () => {};
  window.openDeleteDayModal = () => {};
  window.closeDeleteDayModal = () => {};
  window.openDeleteBoardModal = () => {};
  window.closeDeleteBoardModal = () => {};

  // ─────────────────────────────────────────────────────────────────────
  // B) WAIT FOR DOMContentLoaded TO CACHE ELEMENTS & WIRE UP LISTENERS
  // ─────────────────────────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", () => {
    // ─── 1) CACHE “ADD DAY” ELEMENTS ──────────────────────────────────
    const addDayBtn = document.getElementById("add-day");
    const addDayModal = document.getElementById("add-day-modal");
    const addDayForm = document.getElementById("add-day-form");
    const addDayStart = document.getElementById("add-day-date-start");
    const addDayEnd = document.getElementById("add-day-date-end");
    const toggleRangeChk = document.getElementById("toggle-range");

    // Expose these two globally so inline onclick works:
    window.openAddDayModal = openAddDayModal;
    window.closeAddDayModal = closeAddDayModal;

    // Initialize “Use Date Range?” checkbox logic
    if (toggleRangeChk && addDayEnd) {
      toggleRangeChk.checked = false;
      // Hide end‐date by default
      addDayEnd.parentElement.style.display = "none";

      toggleRangeChk.addEventListener("change", () => {
        if (toggleRangeChk.checked) {
          addDayEnd.parentElement.style.display = "block";
        } else {
          addDayEnd.parentElement.style.display = "none";
        }
      });
    }

    // If the “+ Add Day” button exists, wire it up:
    if (addDayBtn && addDayModal) {
      addDayBtn.addEventListener("click", openAddDayModal);
    }

    // Handle clicks outside AddDayModal content or press ESC to close
    if (addDayModal) {
      addDayModal.addEventListener("click", (e) => {
        if (e.target === addDayModal) {
          closeAddDayModal();
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && addDayModal.style.display === "flex") {
          closeAddDayModal();
        }
      });
    }

    // ─── 2) “ADD DAY” FORM SUBMISSION ───────────────────────────────────
    if (addDayForm && addDayStart && addDayEnd) {
      addDayForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const startRaw = addDayStart.value;
        const endRaw = toggleRangeChk.checked ? addDayEnd.value : addDayStart.value;

        if (!startRaw) {
          showToast("Please pick a start date.");
          return;
        }
        if (toggleRangeChk.checked && !endRaw) {
          showToast("Please pick an end date.");
          return;
        }

        // Parse into Date objects without timezone shift:
        const [sY, sM, sD] = startRaw.split("-").map(Number);
        const [eY, eM, eD] = endRaw.split("-").map(Number);
        const startDate = new Date(sY, sM - 1, sD);
        const endDate = new Date(eY, eM - 1, eD);

        if (endDate < startDate) {
          showToast("End date cannot be before start date.");
          return;
        }

        // Build an array of all dates between startDate and endDate inclusive
        const datesToAdd = [];
        let cursor = new Date(startDate);
        while (cursor <= endDate) {
          const yy = cursor.getFullYear();
          const mm = String(cursor.getMonth() + 1).padStart(2, "0");
          const dd = String(cursor.getDate()).padStart(2, "0");
          datesToAdd.push(`${yy}-${mm}-${dd}`);
          cursor.setDate(cursor.getDate() + 1);
        }

        // Remove duplicates or existing columns
        const boardCols = window.boardData.columns || {};
        const uniqueDates = datesToAdd.filter((iso) => !boardCols.hasOwnProperty(iso));
        if (uniqueDates.length === 0) {
          showToast("All selected days already exist.");
          closeAddDayModal();
          return;
        }

        // Sort the array of new dates (ascending) – though it's already in order
        uniqueDates.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

        // Insert each day into in‐memory structure
        uniqueDates.forEach((iso) => {
          const [Y, M, D] = iso.split("-").map(Number);
          const dObj = new Date(Y, M - 1, D);
          const dayOfMonth = dObj.getDate();
          const j = dayOfMonth % 10,
            k = dayOfMonth % 100;
          const suffix =
            j === 1 && k !== 11
              ? "st"
              : j === 2 && k !== 12
              ? "nd"
              : j === 3 && k !== 13
              ? "rd"
              : "th";
          const weekday = dObj.toLocaleDateString("en-US", { weekday: "long" });
          const monthYear = dObj.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          });
          const displayName = `${weekday}, ${dayOfMonth}${suffix} of ${monthYear}`;

          boardCols[iso] = { name: displayName, tasks: [] };
        });

        // After inserting, rebuild the entire columns object sorted by key
        const sortedKeys = Object.keys(boardCols).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        const newColumns = {};
        sortedKeys.forEach((k) => {
          newColumns[k] = boardCols[k];
        });
        window.boardData.columns = newColumns;

        try {
          await saveTasks();
          renderTasks();
          showToast("Day(s) added");
          closeAddDayModal();
        } catch (err) {
          console.error("Error adding day(s):", err);
          showToast("Error adding day(s)");
        }
      });
    }

    // ─── 3) “DELETE DAY” MODAL SETUP ───────────────────────────────────
    const deleteDayModal = document.getElementById("delete-column-modal");
    const confirmDeleteDay = document.getElementById("confirm-delete-day-btn");
    let dayToDelete = null;

    window.openDeleteDayModal = openDeleteDayModal;
    window.closeDeleteDayModal = closeDeleteDayModal;

    function openDeleteDayModal(columnId) {
      dayToDelete = columnId;
      if (!deleteDayModal) return;
      deleteDayModal.style.display = "flex";
    }
    function closeDeleteDayModal() {
      if (!deleteDayModal) return;
      deleteDayModal.style.display = "none";
      dayToDelete = null;
    }

    if (deleteDayModal) {
      deleteDayModal.addEventListener("click", (e) => {
        if (e.target === deleteDayModal) {
          closeDeleteDayModal();
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && deleteDayModal.style.display === "flex") {
          closeDeleteDayModal();
        }
      });
    }

    if (confirmDeleteDay) {
      confirmDeleteDay.addEventListener("click", async () => {
        if (!dayToDelete) {
          showToast("No day selected");
          closeDeleteDayModal();
          return;
        }
        delete window.boardData.columns[dayToDelete];

        // Re‐sort remaining keys
        const boardCols = window.boardData.columns;
        const sortedKeys = Object.keys(boardCols).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        const newColumns = {};
        sortedKeys.forEach((k) => {
          newColumns[k] = boardCols[k];
        });
        window.boardData.columns = newColumns;

        try {
          await saveTasks();
          renderTasks();
          showToast("Day deleted");
          closeDeleteDayModal();
        } catch (err) {
          console.error("Error deleting day:", err);
          showToast("Error deleting day");
        }
      });
    }

    // ─── 4) “DELETE BOARD” MODAL SETUP ─────────────────────────────────
    const deleteBoardModal = document.getElementById("delete-board-modal");
    const deleteBoardNameEl = document.getElementById("delete-board-name");
    const deleteConfirmText = document.getElementById("delete-board-confirm-text");
    const deleteBoardInput = document.getElementById("delete-board-input");
    const confirmDeleteBoard = document.getElementById("confirm-delete-btn");
    let boardToDelete = null;

    window.openDeleteBoardModal = openDeleteBoardModal;
    window.closeDeleteBoardModal = closeDeleteBoardModal;

    function openDeleteBoardModal(boardId) {
      boardToDelete = boardId;
      if (!deleteBoardModal) return;
      if (boardId === window.currentBoard && window.boardData) {
        const name = window.boardData.name || "";
        if (deleteBoardNameEl) deleteBoardNameEl.textContent = name;
        if (deleteConfirmText) deleteConfirmText.textContent = name;
        if (deleteBoardInput) deleteBoardInput.value = "";
      }
      deleteBoardModal.style.display = "flex";
    }
    function closeDeleteBoardModal() {
      if (!deleteBoardModal) return;
      deleteBoardModal.style.display = "none";
      boardToDelete = null;
    }

    if (deleteBoardModal) {
      deleteBoardModal.addEventListener("click", (e) => {
        if (
          e.target.dataset.action === "close-modal" ||
          e.target === deleteBoardModal
        ) {
          closeDeleteBoardModal();
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && deleteBoardModal.style.display === "flex") {
          closeDeleteBoardModal();
        }
      });
    }
    if (confirmDeleteBoard && deleteBoardInput) {
      confirmDeleteBoard.addEventListener("click", async () => {
        const typedName = deleteBoardInput.value.trim();
        const realName = window.boardData.name || "";
        if (typedName !== realName) {
          showToast("Board name does not match");
          return;
        }
        try {
          const resp = await fetch(
            `/api/board/${encodeURIComponent(boardToDelete)}`,
            { method: "DELETE" }
          );
          if (!resp.ok) {
            showToast(resp.status === 404 ? "Board not found" : "Error deleting board");
            return;
          }
          window.location.href = "/";
        } catch (err) {
          console.error("Error deleting board:", err);
          showToast("Error deleting board");
        }
      });
    }
    // Header “Delete Board” button opens modal
    const headerTrashBtn = document.getElementById("delete-board-button");
    if (headerTrashBtn) {
      headerTrashBtn.addEventListener("click", () => {
        openDeleteBoardModal(window.currentBoard);
      });
    }
  }); // end DOMContentLoaded

  // ─────────────────────────────────────────────────────────────────────
  // C) FUNCTIONS FOR “ADD DAY” MODAL (GLOBAL)
  // ─────────────────────────────────────────────────────────────────────

  function openAddDayModal() {
    const addDayModal = document.getElementById("add-day-modal");
    const addDayStart = document.getElementById("add-day-date-start");
    const addDayEnd = document.getElementById("add-day-date-end");
    const toggleRangeChk = document.getElementById("toggle-range");

    if (!addDayModal || !addDayStart || !addDayEnd || !toggleRangeChk) return;

    const today = new Date();
    const isoToday = today.toISOString().split("T")[0];
    addDayStart.value = isoToday;
    addDayEnd.value = isoToday;
    toggleRangeChk.checked = false;
    addDayEnd.parentElement.style.display = "none";

    addDayModal.style.display = "flex";
    addDayStart.focus();
  }

  function closeAddDayModal() {
    const addDayModal = document.getElementById("add-day-modal");
    const addDayStart = document.getElementById("add-day-date-start");
    const addDayEnd = document.getElementById("add-day-date-end");
    const toggleRangeChk = document.getElementById("toggle-range");

    if (!addDayModal) return;
    addDayModal.style.display = "none";

    if (addDayStart) addDayStart.value = "";
    if (addDayEnd) addDayEnd.value = "";
    if (toggleRangeChk) toggleRangeChk.checked = false;
  }

  // ─────────────────────────────────────────────────────────────────────
  // D) FUNCTIONS FOR “DELETE DAY” MODAL (GLOBAL)
  // ─────────────────────────────────────────────────────────────────────

  function openDeleteDayModal(columnId) {
    // overwritten in DOMContentLoaded
  }
  function closeDeleteDayModal() {
    // overwritten in DOMContentLoaded
  }

  // ─────────────────────────────────────────────────────────────────────
  // E) FUNCTIONS FOR “DELETE BOARD” MODAL (GLOBAL)
  // ─────────────────────────────────────────────────────────────────────

  function openDeleteBoardModal(boardId) {
    // overwritten in DOMContentLoaded
  }
  function closeDeleteBoardModal() {
    // overwritten in DOMContentLoaded
  }
})();
