import { renderBoardsNav, renderBoard } from "./ui.js";
import { setupEventListeners } from "./events.js";
import { setupKeyboardShortcuts } from "./keyboard.js";
import { migrateFromLocalStorage } from "./data/local/migrate.js";
import { initializeState } from "./state.js";

async function initializeApp() {
  await migrateFromLocalStorage();
  await initializeState();

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
