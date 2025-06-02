// public/js/joinOrCreate.js

document.addEventListener("DOMContentLoaded", () => {
  // ─── Grab the actual IDs from join-or-create.html ───────────────────────────
  const form      = document.getElementById("join-form");
  const input     = document.getElementById("join-board-input");
  const errorEl   = document.getElementById("join-error");
  const themeToggle = document.getElementById("theme-toggle");

  if (!form || !input || !errorEl) {
    console.error("joinOrCreate.js: Missing expected form or input elements in the DOM.");
    return;
  }

  // ─── When the user submits, attempt to create or join ───────────────────────
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const displayName = input.value.trim();
    // Validate: only letters, numbers, spaces, and hyphens
    if (!/^[A-Za-z0-9 \-]+$/.test(displayName)) {
      errorEl.style.display = "block";
      return;
    }
    errorEl.style.display = "none";

    // Build a slug by removing spaces & non-alphanumeric characters
    const boardId = displayName
      .replace(/\s+/g, "")
      .replace(/[^A-Za-z0-9]/g, "");
    if (!boardId) {
      showToast("Cannot create or join a board with that name.");
      return;
    }

    try {
      // 1) Fetch the defaultData.json template
      const templateResp = await fetch("/data/defaultData.json", {
        headers: { "Content-Type": "application/json" },
      });
      if (!templateResp.ok) {
        showToast("Error loading board template");
        return;
      }
      const defaultData = await templateResp.json();

      // 2) Extract the template board via activeBoard key
      const templateId = defaultData.activeBoard;
      if (
        !defaultData.boards ||
        typeof defaultData.boards !== "object" ||
        !templateId ||
        !defaultData.boards[templateId]
      ) {
        showToast("Invalid board template");
        return;
      }
      const templateBoard = defaultData.boards[templateId];

      // 3) Clone template columns and assign the new display name
      const newBoardObject = {
        name: displayName,
        columns: JSON.parse(JSON.stringify(templateBoard.columns)),
      };

      // 4) Attempt to create it via POST /api/board/:boardId
      const createResp = await fetch(
        `/api/board/${encodeURIComponent(boardId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newBoardObject, null, 2),
        }
      );

      if (createResp.status === 409) {
        // Already exists → simply redirect to that board
        window.location.href = `/${encodeURIComponent(boardId)}`;
        return;
      }
      if (!createResp.ok) {
        const text = await createResp.text().catch(() => "");
        showToast(`Error creating board${text ? ": " + text : ""}`);
        return;
      }

      // 5) Success: redirect to /<boardId>
      window.location.href = `/${encodeURIComponent(boardId)}`;
    } catch (err) {
      console.error("[joinOrCreate] Exception:", err);
      showToast("Error creating or joining board");
    }
  });

  // ─── Hide the error message if the user types again ────────────────────────
  input.addEventListener("input", () => {
    if (errorEl.style.display === "block") {
      errorEl.style.display = "none";
    }
  });

  // ─── Toggle dark mode (matching your theme.js behavior) ────────────────────
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark-theme");
      themeToggle.textContent = isDark ? "☀️" : "🌙";
    });
  }
});
