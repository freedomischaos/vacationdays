// public/js/utils.js

/**
 * showToast(message)
 * Displays a brief floating message at the bottom of the screen.
 * Expects an element with id="toast" to exist in the DOM.
 */
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 2000);
}
