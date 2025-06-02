// public/js/headerButtons.js

document.addEventListener("DOMContentLoaded", () => {
  const newBoardBtn = document.getElementById("new-board-btn");
  if (newBoardBtn) {
    newBoardBtn.addEventListener("click", () => {
      window.location.href = "/join-or-create.html";
    });
  }
});
