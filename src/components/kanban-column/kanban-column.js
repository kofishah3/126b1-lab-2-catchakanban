import { TaskCard } from "../task-card/task-card.js";

const ICONS = {
  TODO: "circle",
  DOING: "pencil",
  DONE: "check",
  DEFAULT: "list",
};

export class KanbanColumn {
  static template = null;

  constructor({ id, title }, tasks = [], boardId) {
    this.id = id;
    this.title = title;
    this.tasks = tasks;
    this.boardId = boardId;
  }

  async render() {
    const $section = document.createElement("section");
    const columnClassModifier = this.title.toLowerCase().replace(/\s+/g, "-");
    $section.className = `kanban-column bg-column rounded-lg flex flex-col border kanban-column--${columnClassModifier}`;
    $section.dataset.columnId = this.id;
    $section.setAttribute("aria-label", `${this.title} column`);

    if (!KanbanColumn.template) {
      const response = await fetch(
        "./src/components/kanban-column/kanban-column.html",
      );
      KanbanColumn.template = await response.text();
    }

    $section.innerHTML = KanbanColumn.template;

    const titleText = $section.querySelector(".kanban-column__title");
    titleText.textContent = this.title;

    const icon = $section.querySelector(".kanban-column__icon");
    icon.setAttribute("data-lucide", this.getIconForTitle(this.title));

    const addButton = $section.querySelector(".kanban-column__add-button");
    addButton.setAttribute("aria-label", `Add task to ${this.title}`);

    const tasksContainer = $section.querySelector(
      ".kanban-column__tasks-container",
    );
    tasksContainer.setAttribute("aria-label", `${this.title} tasks`);

    for (const task of this.tasks) {
      const taskCardInstance = new TaskCard(task, this.boardId);
      const taskCard = await taskCardInstance.render();
      taskCard.setAttribute("role", "listitem");
      tasksContainer.appendChild(taskCard);
    }

    $section.addEventListener("dragover", (e) => {
      e.preventDefault();
      $section.classList.add("kanban-column--drag-over");
    });

    $section.addEventListener("dragleave", () => {
      $section.classList.remove("kanban-column--drag-over");
    });

    $section.addEventListener("drop", (e) => {
      e.preventDefault();
      $section.classList.remove("kanban-column--drag-over");
      const taskId = e.dataTransfer.getData("text/plain");

      document.dispatchEvent(
        new CustomEvent("move-task-to-column", {
          detail: { taskId, newColumnId: this.id },
        }),
      );
    });

    addButton.addEventListener("click", () => {
      document._lastFocusedBeforeModal = addButton;
      document.dispatchEvent(
        new CustomEvent("open-create-task", {
          detail: { columnId: this.id },
        }),
      );
    });

    addButton.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        addButton.click();
      }
    });

    return $section;
  }

  getIconForTitle(title) {
    const normalizedTitle = title.toLowerCase();
    if (normalizedTitle.includes("todo") || normalizedTitle.includes("to do"))
      return ICONS.TODO;
    if (normalizedTitle.includes("doing") || normalizedTitle.includes("progress"))
      return ICONS.DOING;
    if (normalizedTitle.includes("done") || normalizedTitle.includes("completed"))
      return ICONS.DONE;
    return ICONS.DEFAULT;
  }
}
