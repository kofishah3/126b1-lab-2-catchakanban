export function showToast(message, type = "error") {
  const $toast = createToastElement(message, type);
  document.body.appendChild($toast);
  removeToastAfterDelay($toast);
}

function createToastElement(message, type) {
  const $toast = document.createElement("div");
  $toast.className = `toast toast--${type}`;
  $toast.textContent = message;
  return $toast;
}

function removeToastAfterDelay($toast) {
  setTimeout(() => $toast.remove(), 4000);
}
