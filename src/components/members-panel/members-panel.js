import { API_BASE } from "../../config.js";
export async function createMembersPanel(boardId) {
  const $overlay = document.createElement("div");
  $overlay.className = "modal-overlay flex justify-center items-center";
  $overlay.setAttribute("role", "dialog");

  const $modal = document.createElement("div");

  if (!createMembersPanel.template) {
    const res = await fetch(
      "./src/components/members-panel/members-panel.html",
    );
    createMembersPanel.template = await res.text();
  }

  $modal.innerHTML = createMembersPanel.template;
  $overlay.appendChild($modal);
  document.body.appendChild($overlay);

  setupMembersPanelEvents($modal, $overlay, boardId);
  fetchAndRenderMembers($modal, boardId);
  fetchAndRenderAllUsers($modal);
}

function setupMembersPanelEvents($modal, $overlay, boardId) {
  const $closeBtn = $modal.querySelector("#CLOSE_MEMBERS_BTN");
  const $inviteBtn = $modal.querySelector("#INVITE_SUBMIT_BTN");

  $closeBtn.addEventListener("click", () => handleCloseModal($overlay));
  $inviteBtn.addEventListener("click", () =>
    handleInviteClick($modal, boardId),
  );

  $overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") handleCloseModal($overlay);
  });
}

function handleCloseModal($overlay) {
  $overlay.remove();
}

async function handleInviteClick($modal, boardId) {
  const payload = getInvitePayload($modal);

  if (!payload) return;

  try {
    const data = await inviteUserToBoard(boardId, payload.email);
    updateInviteUI($modal, data);
    if (data.success) fetchAndRenderMembers($modal, boardId);
  } catch (err) {
    console.error("Error inviting user", err);
  }
}

function getInvitePayload($modal) {
  const $input = $modal.querySelector("#INVITE_EMAIL_INPUT");
  const email = $input.value.trim();
  return email ? { email, $input } : null;
}

function updateInviteUI($modal, response) {
  const $input = $modal.querySelector("#INVITE_EMAIL_INPUT");

  if (response.success && $input) {
    $input.value = "";
    $input.focus();
  }
}

async function fetchAndRenderMembers($modal, boardId) {
  const $list = $modal.querySelector("#MEMBERS_LIST");
  $list.innerHTML = "Loading...";

  try {
    const members = await getBoardMembers(boardId);
    renderMembersList($list, members);
  } catch (err) {
    $list.innerHTML = "Failed to load members";
  }
}

function renderMembersList($list, members) {
  $list.innerHTML = "";
  members.forEach((member) => {
    const $item = document.createElement("div");
    $item.className = "member-item";

    const $text = document.createElement("span");
    $text.textContent = `${member.first_name} ${member.last_name} (${member.email})`;
    $item.appendChild($text);

    if (member.is_owner) {
      const $pill = document.createElement("span");
      $pill.className = "member-item__owner-pill";
      $pill.textContent = "Owner";
      $item.appendChild($pill);
    }

    $list.appendChild($item);
  });
}

async function fetchAndRenderAllUsers($modal) {
  const $datalist = $modal.querySelector("#ALL_EMAILS_LIST");
  try {
    const users = await getAllUsers();
    users.forEach((user) => {
      const $option = document.createElement("option");
      $option.value = user.email;
      $datalist.appendChild($option);
    });
  } catch (err) {
    console.error("Failed to load users for datalist", err);
  }
}

async function inviteUserToBoard(boardId, email) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/boards/${boardId}/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email }),
  });
  return res.json();
}

async function getBoardMembers(boardId) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/boards/${boardId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.members || [];
}

async function getAllUsers() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.users || [];
}
