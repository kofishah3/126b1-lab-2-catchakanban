import { state, COLUMNS } from "./state.js";
import { addBoard, addTask, deleteTask, moveTask, getTasks } from "./services/sync.js";
import { createKanbanBoardModal } from "./components/kanban-board-modal/kanban-board-modal.js";
import { createTaskModal } from "./components/task-modal/task-modal.js";
import { createDeleteModal } from "./components/delete-modal/delete-modal.js";
import { UI_ELEMENTS } from "./dom.js";
import { toggleSidebar, closeSidebarOnMobile, renderBoardsNav, renderBoard } from "./ui.js";

export function setupEventListeners() {
  UI_ELEMENTS.SIDEBAR_TOGGLE.addEventListener("click", toggleSidebar);
  UI_ELEMENTS.SIDEBAR_OVERLAY.addEventListener("click", closeSidebarOnMobile);

  UI_ELEMENTS.ADD_BOARD_BTN.addEventListener("click", () => {
    document._lastFocusedBeforeModal = UI_ELEMENTS.ADD_BOARD_BTN;
    createKanbanBoardModal();
  });

  document.addEventListener("create-board", async (e) => {
    const newBoard = addBoard(e.detail.name);
    state.boards.push(newBoard);
    state.currentBoardId = newBoard.id;
    renderBoardsNav();
    await renderBoard();
  });

  UI_ELEMENTS.UNIVERSAL_ADD_TASK_BTN.addEventListener("click", () => {
    document._lastFocusedBeforeModal = UI_ELEMENTS.UNIVERSAL_ADD_TASK_BTN;
    createTaskModal("todo");
  });

  document.addEventListener("create-task", async (e) => {
    addTask(state.currentBoardId, {
      title: e.detail.title,
      columnId: e.detail.columnId,
      priority: e.detail.priority,
      deadline: e.detail.deadline,
      createdAt: new Date().toISOString(),
    });
    await renderBoard();
  });

  document.addEventListener("delete-task", async (e) => {
    document._lastFocusedBeforeModal = document.activeElement;
    createDeleteModal({
      title: "Delete Task",
      message: "Are you sure you want to delete this task?",
      onConfirm: async () => {
        deleteTask(state.currentBoardId, e.detail.taskId);
        await renderBoard();
      },
    });
  });

  document.addEventListener("move-task", async (e) => {
    const tasks = getTasks(state.currentBoardId);
    const task = tasks.find((t) => t.id === e.detail.taskId);
    if (!task) return;

    const columnIndex = COLUMNS.findIndex((col) => col.id === task.columnId);
    if (columnIndex === -1 || columnIndex === COLUMNS.length - 1) return;

    const nextColumnId = COLUMNS[columnIndex + 1].id;
    moveTask(state.currentBoardId, task.id, nextColumnId);
    await renderBoard();
  });

  document.addEventListener("move-task-back", async (e) => {
    const tasks = getTasks(state.currentBoardId);
    const task = tasks.find((t) => t.id === e.detail.taskId);
    if (!task) return;

    const columnIndex = COLUMNS.findIndex((col) => col.id === task.columnId);
    if (columnIndex === -1 || columnIndex === 0) return;

    const prevColumnId = COLUMNS[columnIndex - 1].id;
    moveTask(state.currentBoardId, task.id, prevColumnId);
    await renderBoard();
  });

  document.addEventListener("move-task-to-column", async (e) => {
    moveTask(state.currentBoardId, e.detail.taskId, e.detail.newColumnId);
    await renderBoard();
  });

  document.addEventListener("open-create-task", (e) => {
    createTaskModal(e.detail.columnId);
  });

  document.addEventListener("refresh-board", async () => {
    await renderBoard();
  });
}
