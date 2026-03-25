import { state, COLUMNS } from "./state.js";
import { getTasks, deleteBoard } from "./services/sync.js";
import { KanbanColumn } from "./components/kanban-column/kanban-column.js";
import { createDeleteModal } from "./components/delete-modal/delete-modal.js";
import { createElement } from "../utils/dom-utils.js";
import { UI_ELEMENTS } from "./dom.js";

export function closeSidebarOnMobile() {
  if (window.innerWidth <= 768) {
    UI_ELEMENTS.SIDEBAR.classList.remove("sidebar--active");
    UI_ELEMENTS.SIDEBAR_OVERLAY.classList.remove("sidebar-overlay--active");
  }
}

export function toggleSidebar() {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    UI_ELEMENTS.SIDEBAR.classList.toggle("sidebar--active");
    UI_ELEMENTS.SIDEBAR_OVERLAY.classList.toggle("sidebar-overlay--active");
  } else {
    UI_ELEMENTS.SIDEBAR.classList.toggle("sidebar--collapsed");
  }
}

export function renderBoardsNav() {
  if (!UI_ELEMENTS.BOARDS_NAV) return;
  UI_ELEMENTS.BOARDS_NAV.innerHTML = "";

  state.boards.forEach((board) => {
    const isActive = board.id === state.currentBoardId;

    const link = createElement(
      "div",
      `board-link focus-none focus-ring ${isActive ? "board-link--active" : ""}`,
      {
        "dataset.boardId": board.id,
        tabindex: "0",
        role: "button",
        "aria-label": `Switch to board: ${board.name}`,
      },
    );

    const icon = createElement("i", "", {
      "dataset.lucide": "layout",
      "aria-hidden": "true",
    });
    link.appendChild(icon);

    const text = createElement("span", "board-link__text");
    text.textContent = board.name;
    link.appendChild(text);

    const switchBoard = async () => {
      state.currentBoardId = board.id;
      renderBoardsNav();
      await renderBoard();
      closeSidebarOnMobile();
    };

    link.addEventListener("click", switchBoard);
    link.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        switchBoard();
      }
    });

    if (state.boards.length > 1) {
      const deleteBtn = createElement(
        "button",
        "board-link__delete-button focus-none focus-ring",
        {
          "aria-label": `Delete board: ${board.name}`,
        },
      );
      deleteBtn.innerHTML = `<i data-lucide="trash-2" class="board-link__delete-icon" aria-hidden="true"></i>`;

      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();

        document._lastFocusedBeforeModal = document.activeElement;
        createDeleteModal({
          title: "Delete Board",
          message: `Delete board "${board.name}"? This will also delete all its tasks.`,
          onConfirm: async () => {
            await deleteBoard(board.id);
            state.boards = state.boards.filter((b) => b.id !== board.id);

            if (state.currentBoardId === board.id) {
              state.currentBoardId = state.boards[0].id;
            }

            renderBoardsNav();
            await renderBoard();
          },
        });
      });

      deleteBtn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          deleteBtn.click();
        }
      });

      link.appendChild(deleteBtn);
    }

    UI_ELEMENTS.BOARDS_NAV.appendChild(link);
  });

  if (window.lucide) window.lucide.createIcons();
}

export async function renderBoard() {
  if (!UI_ELEMENTS.APP) return;

  const currentBoard = state.boards.find(
    (board) => board.id === state.currentBoardId,
  );
  if (UI_ELEMENTS.BOARD_TITLE) {
    UI_ELEMENTS.BOARD_TITLE.textContent = currentBoard
      ? currentBoard.name
      : "Kanban Board";
  }

  UI_ELEMENTS.APP.innerHTML = "";

  const boardContainer = createElement("div", "kanban-board");

  const boardTasks = await getTasks(state.currentBoardId);

  const columnPromises = COLUMNS.map((column) => {
    const columnTasks = boardTasks.filter(
      (task) => task.columnId === column.id,
    );
    const kanbanColumn = new KanbanColumn(
      column,
      columnTasks,
      state.currentBoardId,
    );
    return kanbanColumn.render();
  });

  const columnElements = await Promise.all(columnPromises);
  columnElements.forEach((columnElement) => {
    boardContainer.appendChild(columnElement);
  });

  UI_ELEMENTS.APP.appendChild(boardContainer);
  if (window.lucide) window.lucide.createIcons();
}
