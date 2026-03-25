import { renderBoardsNav, renderBoard } from "./ui.js";
import { setupEventListeners } from "./events.js";
import { setupKeyboardShortcuts } from "./keyboard.js";
import { runMigrations } from "./data/local/migrate.js";
import { initializeState } from "./state.js";
import { initialSync, startSync } from "./services/networkSync.js";

async function initializeApp() {
  try {
    await runMigrations();
    await initialSync();
    await initializeState();

    renderBoardsNav();
    await renderBoard();

    startSync();

    if (window.lucide) {
      window.lucide.createIcons();
    } else {
      window.addEventListener("load", () => {
        if (window.lucide) window.lucide.createIcons();
      });
    }

    setupEventListeners();
    setupKeyboardShortcuts();
  } catch (error) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;background:#1e1e2e;color:#cdd6f4;">
        <div style="text-align:center;max-width:28rem;padding:2rem;">
          <h1 style="font-size:1.5rem;margin-bottom:1rem;color:#f38ba8;">Failed to start application</h1>
          <p style="color:#a6adc8;">${error.message}</p>
        </div>
      </div>
    `;
  }
}

initializeApp();
