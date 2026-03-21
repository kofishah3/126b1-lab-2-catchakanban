export async function createTaskModal(columnId) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay flex justify-center items-center";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "task-modal-title");

  const modal = document.createElement("div");
  modal.className = "task-modal bg-white p-lg rounded-lg flex flex-col gap-md";

  if (!createTaskModal.template) {
    const response = await fetch("./src/components/task-modal/task-modal.html");
    createTaskModal.template = await response.text();
  }

  modal.innerHTML = createTaskModal.template;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  setupDeadlineOptions();
  setupPriorityButtons();

  const titleInput = modal.querySelector("#task-title");
  requestAnimationFrame(() => titleInput.focus());

  const closeModal = () => {
    overlay.remove();
    if (document._lastFocusedBeforeModal) {
      document._lastFocusedBeforeModal.focus();
      document._lastFocusedBeforeModal = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
    }

    if (e.key === "Tab") {
      const focusable = getFocusableElements(modal);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  overlay.addEventListener("keydown", handleKeyDown);

  modal.querySelector("#cancel-task").addEventListener("click", closeModal);

  modal.querySelector("#create-task").addEventListener("click", () => {
    const title = modal.querySelector("#task-title").value.trim();
    if (!title) {
      titleInput.focus();
      titleInput.setAttribute("aria-invalid", "true");
      return alert("Task name is required");
    }

    const priority = modal.querySelector(".priority-buttons__button--active")
      ?.dataset.priority;

    const month = modal.querySelector("#deadline-month").value;
    const day = modal.querySelector("#deadline-day").value;
    const year = modal.querySelector("#deadline-year").value;

    const deadline = month && day && year ? `${year}-${month}-${day}` : null;

    document.dispatchEvent(
      new CustomEvent("create-task", {
        detail: { title, priority, deadline, columnId },
      }),
    );

    closeModal();
  });
}

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.disabled && el.offsetParent !== null);
}

function setupPriorityButtons() {
  document.querySelectorAll(".priority-buttons__button").forEach((btn) => {
    btn.addEventListener("click", handlePriorityClick);
    btn.addEventListener("keydown", handlePriorityKeydown);
  });
}

function handlePriorityClick(e) {
  activatePriority(e.currentTarget);
}

function handlePriorityKeydown(e) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    activatePriority(e.currentTarget);
  }
}

function activatePriority(activeBtn) {
  activeBtn.parentElement
    .querySelectorAll(".priority-buttons__button")
    .forEach((b) => {
      b.classList.remove("priority-buttons__button--active");
      b.setAttribute("aria-pressed", "false");
    });
  activeBtn.classList.add("priority-buttons__button--active");
  activeBtn.setAttribute("aria-pressed", "true");
}

function setupDeadlineOptions() {
  const month = document.getElementById("deadline-month");
  const day = document.getElementById("deadline-day");
  const year = document.getElementById("deadline-year");

  [
    "",
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
    "08",
    "09",
    "10",
    "11",
    "12",
  ].forEach((m) => month.add(new Option(m || "Month", m)));

  day.add(new Option("Day", ""));
  for (let d = 1; d <= 31; d++)
    day.add(new Option(d, String(d).padStart(2, "0")));

  const currentYear = new Date().getFullYear();
  year.add(new Option("Year", ""));
  for (let y = currentYear; y <= currentYear + 5; y++)
    year.add(new Option(y, y));
}
