// js/app.js
// Shared bootstrap for all authenticated pages.
// Runs AFTER DOM is ready to safely read body dataset.
// Also re-validates role from the API on admin pages so a stale
// localStorage object can never bypass the guard.

document.addEventListener('DOMContentLoaded', async () => {

  // ── 1. Must be logged in ─────────────────────────────────
  if (!Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  // ── 2. Admin-only pages ──────────────────────────────────
  const isAdminPage = document.body.dataset.requiresAdmin === 'true';
  if (isAdminPage) {
    // Always re-fetch profile so a stale localStorage role can't
    // let a regular user slip through to the admin panel.
    try {
      const res = await Api.get('/profile');
      const freshUser = res.user;
      // Update cached user with fresh data from server
      Auth.setUser(freshUser);
      if (freshUser.role !== 'admin') {
        window.location.href = 'wallet.html';
        return;
      }
    } catch (err) {
      // Token invalid/expired — kick to login
      Auth.clear();
      window.location.href = 'login.html';
      return;
    }
  }

  // ── 3. Fill topbar ───────────────────────────────────────
  const user = Auth.getUser();
  const usernameEl = document.getElementById('topbarUsername');
  const avatarEl   = document.getElementById('topbarAvatar');
  if (usernameEl && user) usernameEl.textContent = user.username;
  if (avatarEl   && user) avatarEl.textContent   = UI.initials(user.username);

  // ── 4. Logout ────────────────────────────────────────────
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    Auth.clear();
    window.location.href = 'login.html';
  });
});
