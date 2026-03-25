const API = "http://localhost:3000";

function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = '';
}

function setAlert(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message;
}

// Initialize login after DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('login-btn');

  if (!btn) {
    console.error('Login button not found!');
    return;
  }

  // Attach click event to login button
  btn.addEventListener('click', submitLogin);

  // Allow Enter key to submit
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitLogin();
  });
});

async function submitLogin() {
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const btn = document.getElementById('login-btn');

  if (!emailInput || !passwordInput || !btn) {
    console.error('Login elements not found in DOM!');
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  hideAlert('login-alert');

  if (!email || !password) {
    setAlert('login-alert', 'Please fill in all fields.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Logging in…';

  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const text = await res.text();

    if (text === 'SUCCESS') {
      // Redirect to homepage
      location.href = '/index.html';
    } else if (text === 'INVALID') {
      setAlert('login-alert', 'Invalid email or password.');
    } else {
      setAlert('login-alert', 'Server error.');
    }
  } catch (err) {
    console.error(err);
    setAlert('login-alert', 'Could not connect to server.');
  }

  btn.disabled = false;
  btn.innerHTML = 'Log In';
}

// Optional password toggle button
function togglePw() {
  const inp = document.getElementById('login-password');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}