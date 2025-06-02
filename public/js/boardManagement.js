// public/js/boardManagement.js

/**
 * boardManagement.js
 * • Opens/closes the Add Day modal
 * • Opens/closes the Delete Day modal
 * • Submits new Day(s) to window.boardData via saveTasks()
 * • Handles column (day) deletion
 * • Handles Delete Board modal
 */

(function () {
  // ─── A) CACHE ELEMENTS ───────────────────────────────────────────
  const addDayBtn      = document.getElementById("add-day");
  const addDayModal    = document.getElementById("add-day-modal");
  const addDayForm     = document.getElementById("add-day-form");
  const startDateInput = document.getElementById("add-day-date-start");
  const toggleRange    = document.getElementById("toggle-range");
  const rangeContainer = document.getElementById("add-day-date-range");
  const endDateInput   = document.getElementById("add-day-date-end");

  const deleteDayModal    = document.getElementById("delete-column-modal");
  let   dayToDelete       = null;

  const deleteBoardBtn     = document.getElementById("delete-board-button");
  const deleteBoardModal   = document.getElementById("delete-board-modal");
  const deleteNameLabel    = document.getElementById("delete-board-name");
  const deleteConfirmText  = document.getElementById("delete-board-confirm-text");
  const deleteBoardInput   = document.getElementById("delete-board-input");
  const deleteBoardForm    = document.getElementById("delete-board-form");
  let   boardToDelete      = null;

  // ─── B) OPEN / CLOSE “ADD DAY(S)” ────────────────────────────────

  // Expose globally so the inline onclick="closeAddDayModal()" works:
  window.closeAddDayModal = function () {
    if (addDayModal) {
      addDayModal.style.display = "none";
      startDateInput.value = "";
      endDateInput.value = "";
      toggleRange.checked = false;
      rangeContainer.style.display = "none";
    }
  };

  function openAddDayModal() {
    if (!addDayModal) return;
    // 1) Pre-fill Start Date with today
    const today = new Date();
    startDateInput.value = today.toISOString().split("T")[0];
    endDateInput.value = "";
    toggleRange.checked = false;
    rangeContainer.style.display = "none";
    addDayModal.style.display = "flex";
    startDateInput.focus();
  }

  if (addDayBtn) {
    addDayBtn.addEventListener("click", openAddDayModal);
  }

  // Toggle showing/hiding the End Date
  if (toggleRange && rangeContainer) {
    toggleRange.addEventListener("change", () => {
      rangeContainer.style.display = toggleRange.checked ? "flex" : "none";
      if (!toggleRange.checked) {
        endDateInput.value = "";
      }
    });
  }

  // ─── C) SUBMIT “ADD DAY(S)” FORM ─────────────────────────────────
  if (addDayForm && startDateInput && endDateInput) {
    addDayForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const rawStart = startDateInput.value; // “YYYY-MM-DD”
      const rawEnd   = toggleRange.checked ? endDateInput.value : rawStart;

      if (!rawStart) {
        showToast("Please pick at least a start date.");
        return;
      }
      if (toggleRange.checked && !rawEnd) {
        showToast("Please pick an end date.");
        return;
      }

      // 1) Compute all dates between start and end (inclusive)
      const datesToAdd = [];
      const [sy, sm, sd] = rawStart.split("-").map(Number);
      const [ey, em, ed] = rawEnd.split("-").map(Number);
      const startDate = new Date(sy, sm - 1, sd);
      const endDate   = new Date(ey, em - 1, ed);
      if (endDate < startDate) {
        showToast("End date cannot be before start date.");
        return;
      }
      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        datesToAdd.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
      }

      // 2) For each date, generate id and displayName, skip existing
      const newColumns = { ...window.boardData.columns }; // shallow copy
      datesToAdd.forEach((d) => {
        const isoKey = d.toISOString().split("T")[0]; // “YYYY-MM-DD”
        if (newColumns[isoKey]) {
          // already exists → skip
          return;
        }
        // Format displayName e.g. “Sunday, 1st of June 2025”
        const dayOfMonth = d.getDate();
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
        const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
        const monthYear = d.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
        const displayName = `${weekday}, ${dayOfMonth}${suffix} of ${monthYear}`;

        newColumns[isoKey] = {
          name: displayName,
          tasks: [],
        };
      });

      // 3) Sort all keys chronologically and rebuild columns object
      const sortedKeys = Object.keys(newColumns).sort((a, b) => {
        return new Date(a) - new Date(b);
      });
      const sortedColumns = {};
      sortedKeys.forEach((k) => {
        sortedColumns[k] = newColumns[k];
      });
      window.boardData.columns = sortedColumns;

      // 4) Persist and re-render
      try {
        await saveTasks(); // PUT /api/board/:boardName
        renderTasks();     // re-draw the day-columns
        showToast("Day(s) added");
        window.closeAddDayModal();
      } catch (err) {
        console.error("Error adding day(s):", err);
        showToast("Error adding day(s)");
      }
    });
  }

  // Close “Add Day” modal when clicking outside its content
  if (addDayModal) {
    addDayModal.addEventListener("click", (e) => {
      if (e.target === addDayModal) {
        window.closeAddDayModal();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && addDayModal.style.display === "flex") {
        window.closeAddDayModal();
      }
    });
  }

  // ─── D) DELETE DAY (COLUMN) ───────────────────────────────────────
  // Expose so renderTasks.js’s remove‐column button can call it:
  window.openDeleteDayModal = function (dayId) {
    dayToDelete = dayId;
    if (!deleteDayModal) return;
    deleteDayModal.style.display = "flex";
  };

  function closeDeleteDayModal() {
    if (deleteDayModal) {
      deleteDayModal.style.display = "none";
      dayToDelete = null;
    }
  }
  // Expose so inline data-action="close-delete-day" works:
  window.closeDeleteDayModal = closeDeleteDayModal;

  // Hook close on background click or cancel‐button click
  if (deleteDayModal) {
    deleteDayModal.addEventListener("click", (e) => {
      if (
        e.target === deleteDayModal ||
        e.target.dataset.action === "close-delete-day"
      ) {
        closeDeleteDayModal();
      }
    });
  }

  // Hook the “Delete Day” confirm button
  const confirmDeleteDayBtn = document.getElementById("confirm-delete-day-btn");
  if (confirmDeleteDayBtn) {
    confirmDeleteDayBtn.addEventListener("click", async () => {
      if (!dayToDelete) {
        showToast("No day selected");
        return;
      }
      delete window.boardData.columns[dayToDelete];

      // Re-sort after deletion (optional, since keys are already sorted)
      const remainingKeys = Object.keys(window.boardData.columns).sort(
        (a, b) => new Date(a) - new Date(b)
      );
      const reordered = {};
      remainingKeys.forEach((k) => {
        reordered[k] = window.boardData.columns[k];
      });
      window.boardData.columns = reordered;

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

  // ─── E) DELETE BOARD ──────────────────────────────────────────────
  window.openDeleteBoardModal = function (boardId) {
    boardToDelete = boardId;
    if (!deleteBoardModal) return;
    // If deleting current board, fetch its display name
    const name = window.boardData?.name || "";
    deleteNameLabel.textContent = name;
    deleteConfirmText.textContent = name;
    deleteBoardInput.value = "";
    deleteBoardModal.style.display = "flex";
  };

  function closeDeleteBoardModal() {
    if (deleteBoardModal) {
      deleteBoardModal.style.display = "none";
      boardToDelete = null;
    }
  }
  window.closeDeleteBoardModal = closeDeleteBoardModal;

  if (deleteBoardModal) {
    deleteBoardModal.addEventListener("click", (e) => {
      if (
        e.target === deleteBoardModal ||
        e.target.dataset.action === "close-modal"
      ) {
        closeDeleteBoardModal();
      }
    });
  }

  if (deleteBoardForm) {
    deleteBoardForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const typedName = deleteBoardInput.value.trim();
      const realName  = window.boardData?.name || "";
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

  if (deleteBoardBtn) {
    deleteBoardBtn.addEventListener("click", () => {
      openDeleteBoardModal(window.currentBoard);
    });
  }

  // ─── F) ON LOAD, NO “loadTasks()” HERE ────────────────────────────
  // renderTasks.js calls loadTasks() which will incorporate the updated columns
})();