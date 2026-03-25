export class TaskCard {
  constructor(task, boardId) {
    this.task = task;
    this.boardId = boardId;
    this.element = null;
  }

  async render() {
    this.element = await this.createElement();
    this.attachEventListeners();
    return this.element;
  }

  async createElement() {
    const { id, title, deadline, priority } = this.task;
    const $card = document.createElement("div");
    $card.className =
      "task-card focus-none bg-primary p-md rounded-md shadow-card mb-md border flex flex-col gap-sm";
    $card.dataset.taskId = id;
    $card.setAttribute("tabindex", "0");
    $card.setAttribute("role", "article");
    $card.setAttribute(
      "aria-label",
      `Task: ${title}${priority ? `, priority ${priority}` : ""}${deadline ? `, deadline ${deadline}` : ""}`,
    );
    $card.draggable = true;

    if (!TaskCard.template) {
      const response = await fetch("./src/components/task-card/task-card.html");
      TaskCard.template = await response.text();
    }
    $card.innerHTML = TaskCard.template;

    $card.querySelector(".task-card__title").textContent = title;

    if (deadline) {
      $card.querySelector(".task-card__info").innerHTML = `
        <div class="task-card__deadline flex items-center text-xs text-todo font-medium">
          <i data-lucide="clock" class="task-card__deadline-icon" aria-hidden="true"></i>
          <span>${deadline}</span>
        </div>
      `;
    }

    if (priority) {
      $card.querySelector(".task-card__footer").innerHTML = `
        <span class="task-card__priority task-card__priority--${priority.toLowerCase()} uppercase font-bold tracking-wide rounded-sm px-sm py-xs text-xs" aria-label="Priority: ${priority}">
          ${priority}
        </span>
      `;
    }

    return $card;
  }

  attachEventListeners() {
    const { id } = this.task;

    this.element
      .querySelector(".task-card__move-button")
      .addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("move-task", { detail: { taskId: id } }),
        );
      });

    this.element
      .querySelector(".task-card__move-back-button")
      .addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("move-task-back", { detail: { taskId: id } }),
        );
      });

    this.element
      .querySelector(".task-card__edit-button")
      .addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("edit-task", { detail: { task: this.task } }),
        );
      });

    this.element
      .querySelector(".task-card__delete-button")
      .addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("delete-task", { detail: { taskId: id } }),
        );
      });

    this.element.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", id);
      this.element.classList.add("task-card--dragging");
    });

    this.element.addEventListener("dragend", () => {
      this.element.classList.remove("task-card--dragging");
    });
  }
}
