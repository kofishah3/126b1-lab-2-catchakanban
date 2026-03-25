function setAlert(id, message) {
  const $el = document.getElementById(id);
  if (!$el) return;
  $el.textContent = message;
  $el.style.display = "block";
  $el.style.color = "red";
}

function hideAlert(id) {
  const $el = document.getElementById(id);
  if (!$el) return;
  $el.textContent = "";
  $el.style.display = "none";
}

const Signup = {
  currentStep: 1,

  init() {
    this.attachEventListeners();
  },

  attachEventListeners() {
    const $nextBtn = document.getElementById("next-step-btn");
    const $prevBtn = document.getElementById("prev-step-btn");
    const $submitBtn = document.getElementById("submit-btn");
    const $backHomeBtn = document.getElementById("back-home-btn");
    const $loginRedirectBtn = document.getElementById("login-redirect-btn");
    const $loginLinkBtn = document.getElementById("login-link-btn");

    if ($nextBtn) $nextBtn.addEventListener("click", () => this.handleNextClick());
    if ($prevBtn) $prevBtn.addEventListener("click", () => this.handleBackClick());
    if ($submitBtn) $submitBtn.addEventListener("click", () => this.handleSubmitClick());
    
    if ($backHomeBtn) $backHomeBtn.addEventListener("click", () => location.href = "index.html");
    if ($loginRedirectBtn) $loginRedirectBtn.addEventListener("click", () => location.href = "login.html");
    if ($loginLinkBtn) $loginLinkBtn.addEventListener("click", () => location.href = "login.html");
  },

  handleNextClick() {
    if (!this.validateStep(this.currentStep)) return;
    this.goToStep(this.currentStep + 1);
  },

  handleBackClick() {
    this.goToStep(this.currentStep - 1);
  },

  validateStep(step) {
    hideAlert("signup-alert");
    if (step === 1) return this.validateStepOne();
    if (step === 2) return this.validateStepTwo();
    return true;
  },

  validateStepOne() {
    const $first = document.getElementById("reg-first-name");
    const $last = document.getElementById("reg-last-name");
    const $email = document.getElementById("reg-email");

    if (!$first.value.trim() || !$last.value.trim() || !$email.value.trim()) {
      setAlert("signup-alert", "Please fill in all fields.");
      return false;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test($email.value.trim())) {
      setAlert("signup-alert", "Please enter a valid email address.");
      return false;
    }
    return true;
  },

  validateStepTwo() {
    const $pw = document.getElementById("reg-password");
    const $pw2 = document.getElementById("reg-confirm");

    if (!$pw.value || $pw.value.length < 6) {
      setAlert("signup-alert", "Password must be at least 6 characters.");
      return false;
    }
    if ($pw.value !== $pw2.value) {
      setAlert("signup-alert", "Passwords do not match.");
      return false;
    }
    return true;
  },

  updateStepIndicators(oldStep, newStep) {
    const $oldInd = document.getElementById(`step-ind-${oldStep}`);
    const $newInd = document.getElementById(`step-ind-${newStep}`);

    if ($oldInd) {
      $oldInd.classList.remove("active");
      if (newStep > oldStep) $oldInd.classList.add("done");
      else $oldInd.classList.remove("done");
    }

    if ($newInd) {
      $newInd.classList.remove("done");
      $newInd.classList.add("active");
    }
  },

  goToStep(n) {
    const $oldPanel = document.getElementById(`panel-${this.currentStep}`);
    const $newPanel = document.getElementById(`panel-${n}`);

    if ($oldPanel) $oldPanel.classList.remove("active");
    
    this.updateStepIndicators(this.currentStep, n);
    this.currentStep = n;

    if ($newPanel) $newPanel.classList.add("active");
  },

  async handleSubmitClick() {
    hideAlert("signup-alert");

    const $btn = document.getElementById("submit-btn");
    const formData = this.getFormData();

    if (!formData) return;

    this.setLoadingState($btn, true);

    try {
      const data = await this.registerUser(formData);
      this.handleRegisterResponse(data, $btn);
    } catch (err) {
      console.error(err);
      setAlert("signup-alert", "Could not connect to server.");
      this.setLoadingState($btn, false);
    }
  },

  getFormData() {
    const firstName = document.getElementById("reg-first-name").value.trim();
    const lastName = document.getElementById("reg-last-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;

    if (!firstName || !lastName || !email || !password) {
      setAlert("signup-alert", "Please fill in all required fields.");
      return null;
    }

    return { firstName, lastName, email, password };
  },

  setLoadingState($btn, isLoading) {
    if (!$btn) return;
    $btn.disabled = isLoading;
    $btn.innerHTML = isLoading ? "Submitting…" : "Submit →";
  },

  async registerUser(userData) {
    const res = await fetch("http://localhost:3000/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    return res.json();
  },

  handleRegisterResponse(data, $btn) {
    if (data.success) {
      this.showSuccessScreen();
    } else {
      setAlert("signup-alert", data.message || "Registration failed.");
      this.setLoadingState($btn, false);
    }
  },

  showSuccessScreen() {
    const $formArea = document.getElementById("form-area");
    const $footer = document.getElementById("signup-footer");
    const $success = document.getElementById("signup-success");

    if ($formArea) $formArea.style.display = "none";
    if ($footer) $footer.style.display = "none";
    if ($success) {
      $success.removeAttribute("hidden");
      $success.style.display = "block";
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  Signup.init();
});
