const API =
  window.location.port !== "3000" && window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : window.location.origin;

function hideAlert(id) {
  const $el = document.getElementById(id);
  if ($el) $el.textContent = "";
}

function setAlert(id, message) {
  const $el = document.getElementById(id);
  if ($el) $el.textContent = message;
}

document.addEventListener("DOMContentLoaded", () => {
  const $loginBtn = document.getElementById("login-btn");
  const $signupLinkBtn = document.getElementById("signup-link-btn");

  if ($loginBtn) $loginBtn.addEventListener("click", handleLoginSubmit);
  if ($signupLinkBtn)
    $signupLinkBtn.addEventListener("click", handleSignupLinkClick);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLoginSubmit();
  });
});

function handleSignupLinkClick() {
  location.href = "signup.html";
}

async function loginUser(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

async function handleLoginSubmit() {
  const $emailInput = document.getElementById("login-email");
  const $passwordInput = document.getElementById("login-password");
  const $loginBtn = document.getElementById("login-btn");

  if (!$emailInput || !$passwordInput || !$loginBtn) return;

  const email = $emailInput.value.trim();
  const password = $passwordInput.value;

  hideAlert("login-alert");

  if (!email || !password) {
    setAlert("login-alert", "Please fill in all fields.");
    return;
  }

  setLoginLoadingState($loginBtn, true);

  try {
    const data = await loginUser(email, password);
    handleLoginResponse(data);
  } catch (err) {
    console.error(err);
    setAlert("login-alert", "Could not connect to server.");
  } finally {
    setLoginLoadingState($loginBtn, false);
  }
}

function setLoginLoadingState($btn, isLoading) {
  if (isLoading) {
    $btn.disabled = true;
    $btn.innerHTML = '<span class="spinner"></span> Logging in…';
  } else {
    $btn.disabled = false;
    $btn.innerHTML = "Log In";
  }
}

function handleLoginResponse(data) {
  if (data.success) {
    localStorage.setItem("token", data.token);
    location.href = "/index.html";
  } else {
    setAlert("login-alert", data.message || "Invalid email or password.");
  }
}
