// public/js/theme.js

// Grab the toggle button and system‐theme media query
const themeToggle = document.getElementById("theme-toggle");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
const savedTheme = localStorage.getItem("theme");

/**
 * setTheme(isDark, showToastMessage = false)
 *   • Adds/removes “dark-theme” class on <body>
 *   • Swaps the icon in themeToggle
 *   • Optionally shows a toast (via showToast())
 */
function setTheme(isDark, showToastMessage = false) {
  if (isDark) {
    document.body.classList.add("dark-theme");
    themeToggle.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    if (showToastMessage && typeof showToast === "function") {
      showToast("Dark mode enabled");
    }
  } else {
    document.body.classList.remove("dark-theme");
    themeToggle.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    if (showToastMessage && typeof showToast === "function") {
      showToast("Light mode enabled");
    }
  }
  localStorage.setItem("theme", isDark ? "dark" : "light");
}

// On load, pick saved theme or follow system preference
if (savedTheme) {
  setTheme(savedTheme === "dark", false);
} else {
  setTheme(prefersDark.matches, false);
}

// Toggle button click
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const isDark = !document.body.classList.contains("dark-theme");
    setTheme(isDark, true);
  });
}

// Follow system changes if user hasn't explicitly chosen
prefersDark.addEventListener("change", (e) => {
  if (!localStorage.getItem("theme")) {
    setTheme(e.matches, true);
  }
});
