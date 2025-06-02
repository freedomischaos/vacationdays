// public/js/boardSelector.js

document.addEventListener("DOMContentLoaded", () => {
  // Use the same socket instance if renderTasks.js already connected
  const socket = window.socket || io();

  // Populate the dropdown menu of all boards
  function updateBoardSelectorList() {
    const selector = document.getElementById("boards-list-menu");
    if (!selector) return;
    selector.innerHTML = "";

    fetch("/api/boards", {
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch boards");
        return res.json();
      })
      .then((boardList) => {
        boardList.forEach(({ id, name }) => {
          const btn = document.createElement("button");
          btn.dataset.board = id;
          btn.textContent = name;
          if (id === window.currentBoard) btn.classList.add("active");
          selector.appendChild(btn);
        });
      })
      .catch((err) => {
        console.error("Error fetching boards for selector:", err);
      });
  }

  // When a new board is created, refresh the dropdown
  socket.on("boardCreated", () => updateBoardSelectorList());
  // When a board is deleted, refresh the dropdown
  socket.on("boardDeleted", () => updateBoardSelectorList());

  // Initial population
  updateBoardSelectorList();
});
