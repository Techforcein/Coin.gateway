// js/login.js
// Handles login.html and register.html.
// After login, role is read directly from the server response — never
// from a pre-existing localStorage value — so admin accounts always
// land on admin.html correctly.

function showError(bannerId, message) {
  const banner = document.getElementById(bannerId);
  if (!banner) return;
  banner.textContent = message;
  banner.classList.add('show');
}

function hideError(bannerId) {
  const banner = document.getElementById(bannerId);
  if (!banner) return;
  banner.classList.remove('show');
}

function setFieldError(fieldId, message) {
  const el = document.getElementById(`${fieldId}Error`);
  if (el) el.textContent = message || '';
}

function setLoading(btn, labelEl, isLoading, loadingText, idleText) {
  btn.disabled = isLoading;
  labelEl.innerHTML = isLoading
    ? `<span class="btn-loading-dots"><span></span><span></span><span></span></span> ${loadingText}`
    : idleText;
}

// Redirect already-logged-in users — re-verify role from server
document.addEventListener('DOMContentLoaded', async () => {
  if (Auth.isLoggedIn()) {
    try {
      const res = await Api.get('/profile');
      Auth.setUser(res.user);
      window.location.href = res.user.role === 'admin' ? 'admin.html' : 'wallet.html';
    } catch (e) {
      // Token stale — clear and let them log in fresh
      Auth.clear();
    }
  }
});

/* ── Login form ──────────────────────────────────────────── */
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('errorBanner');
    setFieldError('email', '');
    setFieldError('password', '');

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email)    return setFieldError('email',    'Email is required.');
    if (!password) return setFieldError('password', 'Password is required.');

    const btn   = document.getElementById('submitBtn');
    const label = document.getElementById('submitLabel');
    setLoading(btn, label, true, 'Logging in', 'Log in');

    try {
      const data = await Api.post('/login', { email, password });

      // Store token and FULL user object (including role) from server
      Auth.setToken(data.token);
      Auth.setUser(data.user);

      UI.toast('Login successful. Redirecting…', 'success', 1200);

      // Use server-returned role — never trust localStorage for this redirect
      setTimeout(() => {
        window.location.href = data.user.role === 'admin' ? 'admin.html' : 'wallet.html';
      }, 500);

    } catch (err) {
      showError('errorBanner', err.message || 'Login failed. Check your credentials.');
      document.querySelector('.auth-card')?.classList.add('shake');
      setTimeout(() => document.querySelector('.auth-card')?.classList.remove('shake'), 400);
    } finally {
      setLoading(btn, label, false, '', 'Log in');
    }
  });
}

/* ── Register form ───────────────────────────────────────── */
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  const passwordInput = document.getElementById('password');
  const strengthBar   = document.getElementById('strengthBar');

  passwordInput?.addEventListener('input', () => {
    const val = passwordInput.value;
    let score = 0;
    if (val.length >= 8)  score++;
    if (val.length >= 12) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val))        score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const pct = Math.min((score / 5) * 100, 100);
    strengthBar.style.width      = `${pct}%`;
    strengthBar.style.background =
      score <= 1 ? 'var(--danger)' : score <= 3 ? 'var(--warning)' : 'var(--success)';
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('errorBanner');
    setFieldError('username', '');
    setFieldError('email',    '');
    setFieldError('password', '');

    const username = document.getElementById('username').value.trim();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    let hasError = false;
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      setFieldError('username', '3–30 characters: letters, numbers, underscores only.');
      hasError = true;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('email', 'Enter a valid email address.');
      hasError = true;
    }
    if (password.length < 8) {
      setFieldError('password', 'Password must be at least 8 characters.');
      hasError = true;
    }
    if (hasError) return;

    const btn   = document.getElementById('submitBtn');
    const label = document.getElementById('submitLabel');
    setLoading(btn, label, true, 'Creating account', 'Create account');

    try {
      const data = await Api.post('/register', { username, email, password });
      Auth.setToken(data.token);
      Auth.setUser(data.user);
      UI.toast('Account created. Redirecting…', 'success', 1200);
      setTimeout(() => { window.location.href = 'wallet.html'; }, 500);
    } catch (err) {
      showError('errorBanner', err.message || 'Registration failed.');
      document.querySelector('.auth-card')?.classList.add('shake');
      setTimeout(() => document.querySelector('.auth-card')?.classList.remove('shake'), 400);
    } finally {
      setLoading(btn, label, false, '', 'Create account');
    }
  });
}
