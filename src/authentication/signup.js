function setAlert(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
  el.style.color = 'red'; // optional styling
}

function hideAlert(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = '';
  el.style.display = 'none';
}

const Signup = {
  currentStep: 1,

  next() {
    if (!this._validate(this.currentStep)) return;
    this._goStep(this.currentStep + 1);
  },

  back() {
    this._goStep(this.currentStep - 1);
  },

  _validate(step) {
    hideAlert('signup-alert');

    if (step === 1) {
      const first = document.getElementById('reg-first-name').value.trim();
      const last  = document.getElementById('reg-last-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();

      if (!first || !last || !email) {
        setAlert('signup-alert', 'Please fill in all fields.');
        return false;
      }

      // Basic email pattern check
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        setAlert('signup-alert', 'Please enter a valid email address.');
        return false;
      }
    }

    if (step === 2) {
      const pw  = document.getElementById('reg-password').value;
      const pw2 = document.getElementById('reg-confirm').value;

      if (!pw || pw.length < 6) {
        setAlert('signup-alert', 'Password must be at least 6 characters.');
        return false;
      }
      if (pw !== pw2) {
        setAlert('signup-alert', 'Passwords do not match.');
        return false;
      }
    }

    return true;
  },

  _goStep(n) {
    const oldPanel = document.getElementById(`panel-${this.currentStep}`);
    const newPanel = document.getElementById(`panel-${n}`);
    const oldInd   = document.getElementById(`step-ind-${this.currentStep}`);
    const newInd   = document.getElementById(`step-ind-${n}`);

    if (oldPanel) oldPanel.classList.remove('active');
    if (oldInd) {
      oldInd.classList.remove('active');
      if (n > this.currentStep) oldInd.classList.add('done');
      else oldInd.classList.remove('done');
    }

    this.currentStep = n;

    if (newPanel) newPanel.classList.add('active');
    if (newInd) {
      newInd.classList.remove('done');
      newInd.classList.add('active');
    }
  },

  async submit() {
    hideAlert('signup-alert');

    const btn = document.getElementById('submit-btn');
    if (!btn) return console.error('Submit button not found');

    const firstName = document.getElementById('reg-first-name').value.trim();
    const lastName  = document.getElementById('reg-last-name').value.trim();
    const email     = document.getElementById('reg-email').value.trim();
    const password  = document.getElementById('reg-password').value;

    if (!firstName || !lastName || !email || !password) {
      setAlert('signup-alert', 'Please fill in all required fields.');
      return;
    }

    btn.disabled  = true;
    btn.innerHTML = 'Submitting…';

    try {
      const res = await fetch('http://localhost:3000/register', { // adjust API URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password
        })
      });

      const data = await res.json();

      if (data.success) {
        this._showSuccess();
      } else {
        setAlert('signup-alert', data.message || 'Registration failed.');
        btn.disabled = false;
        btn.innerHTML = 'Submit →';
      }
    } catch (err) {
      console.error(err);
      setAlert('signup-alert', 'Could not connect to server.');
      btn.disabled = false;
      btn.innerHTML = 'Submit →';
    }
  },

  _showSuccess() {
    document.getElementById('form-area').style.display    = 'none';
    document.getElementById('signup-footer').style.display = 'none';
    const success = document.getElementById('signup-success');
    if (success) success.style.display = 'block';
  }
};