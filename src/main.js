import { renderBoardsNav, renderBoard } from "./ui.js";
import { setupEventListeners } from "./events.js";
import { setupKeyboardShortcuts } from "./keyboard.js";
import { migrateFromLocalStorage } from "./data/local/migrate.js";
import { initializeState } from "./state.js";

function requireAuth() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/src/authentication/login.html";
    return false;
  }
  return true;
}

function getUserProfile() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function displayUserProfile() {
  const $userName = document.getElementById("user-name");
  const $userEmail = document.getElementById("user-email");
  const profile = getUserProfile();

  if ($userName) {
    if (profile && profile.firstName && profile.lastName) {
      $userName.textContent = `${profile.firstName} ${profile.lastName}`;
    } else {
      $userName.textContent = "Unknown User";
    }
  }

  if ($userEmail) {
    $userEmail.textContent = profile?.email || "Unknown";
  }
}

async function handleLogout() {
  localStorage.clear();
  try {
    const { getDb } = await import("./data/local/database.js");
    const db = await getDb();
    const tx = db.transaction(["boards", "tasks", "manifest"], "readwrite");
    await tx.objectStore("boards").clear();
    await tx.objectStore("tasks").clear();
    await tx.objectStore("manifest").clear();
    await tx.done;
  } catch (e) {
    console.error("Cleanup error on logout:", e);
  }
  window.location.href = "/src/authentication/login.html";
}

async function initializeApp() {
  if (!requireAuth()) return;

  try {
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
    displayUserProfile();

    const $logoutBtn = document.getElementById("logout-button");
    if ($logoutBtn) $logoutBtn.addEventListener("click", handleLogout);
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
