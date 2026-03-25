const API = "http://localhost:3000";

function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = "";
}

function setAlert(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message;
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("login-btn");

  if (!btn) {
    console.error("Login button not found!");
    return;
  }

  btn.addEventListener("click", submitLogin);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitLogin();
  });
});

async function submitLogin() {
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const btn = document.getElementById("login-btn");

  if (!emailInput || !passwordInput || !btn) {
    console.error("Login elements not found in DOM!");
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  hideAlert("login-alert");

  if (!email || !password) {
    setAlert("login-alert", "Please fill in all fields.");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Logging in…';

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem("token", data.token);
      location.href = "/index.html";
    } else {
      setAlert("login-alert", data.message || "Invalid email or password.");
    }
  } catch (err) {
    console.error(err);
    setAlert("login-alert", "Could not connect to server.");
  }

  btn.disabled = false;
  btn.innerHTML = "Log In";
}

function togglePw() {
  const inp = document.getElementById("login-password");
  if (inp) inp.type = inp.type === "password" ? "text" : "password";
}
