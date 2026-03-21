import { UI_ELEMENTS } from "./dom.js";
import { toggleSidebar } from "./ui.js";
import { getFocusableElements } from "../utils/dom-utils.js";

export function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      UI_ELEMENTS.UNIVERSAL_ADD_TASK_BTN.click();
    }

    if (e.altKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (window.innerWidth <= 768) {
        toggleSidebar();
      } else {
        const firstBoard = UI_ELEMENTS.BOARDS_NAV.querySelector(".board-link");
        if (firstBoard) firstBoard.focus();
        else UI_ELEMENTS.ADD_BOARD_BTN.focus();
      }
    }

    if (e.altKey && e.key.toLowerCase() === "h") {
      e.preventDefault();
      UI_ELEMENTS.SIDEBAR_TOGGLE.focus();
    }

    if (e.altKey && e.key.toLowerCase() === "b") {
      e.preventDefault();
      UI_ELEMENTS.ADD_BOARD_BTN.click();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.shiftKey) {
      const focusables = getFocusableElements(document);
      const lastFocusable = focusables[focusables.length - 1];

      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        focusables[0].focus();
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      const focusables = getFocusableElements(document);
      const firstFocusable = focusables[0];

      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        focusables[focusables.length - 1].focus();
      }
    }
  });
}
