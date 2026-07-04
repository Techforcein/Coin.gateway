// js/profile.js
// Loads the current user's profile from the backend (never trusts
// localStorage alone for balance/role display - always refetches).

async function loadProfile() {
  try {
    const res = await Api.get('/profile');
    const user = res.user;

    const initials = UI.initials(user.username);
    document.getElementById('profileAvatar').textContent = initials;
    document.getElementById('profileUsername').textContent = user.username;
    document.getElementById('profileEmail').textContent = user.email;

    const roleBadge = document.getElementById('profileRoleBadge');
    roleBadge.textContent = user.role === 'admin' ? 'Admin' : 'User';
    roleBadge.className = `badge ${user.role === 'admin' ? 'credit' : 'debit'}`;

    document.getElementById('detailUserId').textContent = `#${user.id}`;
    document.getElementById('detailUsername').textContent = user.username;
    document.getElementById('detailEmail').textContent = user.email;
    document.getElementById('detailBalance').textContent = `${user.coins.toLocaleString()} credits`;
    document.getElementById('detailJoined').textContent = new Date(user.created_at).toLocaleDateString(
      undefined,
      { year: 'numeric', month: 'long', day: 'numeric' }
    );

    // Keep cached user object fresh too.
    Auth.setUser({ ...Auth.getUser(), ...user });
  } catch (err) {
    UI.toast(err.message || 'Failed to load profile.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', loadProfile);
