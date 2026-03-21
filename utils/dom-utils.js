export function createElement(tag, className = "", attributes = {}) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  for (const [key, value] of Object.entries(attributes)) {
    if (key.startsWith("dataset.")) {
      element.dataset[key.replace("dataset.", "")] = value;
    } else {
      element.setAttribute(key, value);
    }
  }
  return element;
}

export function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.disabled && el.offsetParent !== null);
}

export function handleTrapFocus(event, container) {
  if (event.key !== "Tab") return;

  const focusable = getFocusableElements(container);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
