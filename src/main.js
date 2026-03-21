import { renderBoardsNav, renderBoard } from "./ui.js";
import { setupEventListeners } from "./events.js";
import { setupKeyboardShortcuts } from "./keyboard.js";

async function initializeApp() {
  renderBoardsNav();
  await renderBoard();

  if (window.lucide) {
    window.lucide.createIcons();
  } else {
    window.addEventListener("load", () => {
      if (window.lucide) window.lucide.createIcons();
    });
  }

  setupEventListeners();
  setupKeyboardShortcuts();
}

initializeApp();
