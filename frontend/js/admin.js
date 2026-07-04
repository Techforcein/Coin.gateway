// js/admin.js — UPDATED with Marketplace management tab

let allUsersCache = [];

/* ── Tab switching ──────────────────────────────────────────────────────── */
const TAB_TITLES = {
  usersTab:   'Admin · Users',
  marketTab:  'Admin · Marketplace',
  txTab:      'Admin · Transactions',
  noticesTab: 'Admin · Notices',
};
const ALL_TABS = ['usersTab','marketTab','txTab','noticesTab'];

function switchTab(tabId) {
  document.querySelectorAll('[data-tab]').forEach(l => l.classList.toggle('active', l.dataset.tab === tabId));
  ALL_TABS.forEach(id => document.getElementById(id).classList.toggle('hidden', id !== tabId));
  document.getElementById('adminTopbarTitle').textContent = TAB_TITLES[tabId] || 'Admin';
  if (tabId === 'txTab')      loadTransactions(1);
  if (tabId === 'noticesTab') loadNotices();
  if (tabId === 'marketTab')  loadAdminItems();
}

/* ── Stats ──────────────────────────────────────────────────────────────── */
async function loadStats() {
  try {
    const res = await Api.get('/admin/statistics');
    const s = res.statistics;
    UI.animateNumber(document.getElementById('statTotalUsers'), 0, s.totalUsers, 600);
    UI.animateNumber(document.getElementById('statTotalCoins'), 0, s.totalCoinsInCirculation, 600);
    UI.animateNumber(document.getElementById('statTotalTx'),    0, s.totalTransactions, 600);
  } catch (err) { UI.toast(err.message || 'Failed to load statistics.', 'error'); }
}

/* ── Users ──────────────────────────────────────────────────────────────── */
async function loadUsers(query = '') {
  const tbody = document.getElementById('usersTbody');
  tbody.innerHTML = UI.skeletonRows(5, 6);
  try {
    const path = query ? `/admin/users?q=${encodeURIComponent(query)}` : '/admin/users';
    const res = await Api.get(path);
    allUsersCache = res.users;
    renderUsers(allUsersCache);
  } catch (_) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Failed to load users.</td></tr>`;
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTbody');
  if (!users?.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="table-empty"><div class="table-empty-icon">👤</div>No users found.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>
        <div class="flex gap-12" style="align-items:center;">
          <div class="avatar" style="width:30px;height:30px;font-size:12px;">${UI.initials(u.username)}</div>
          <span>${UI.escapeHtml(u.username)}</span>
          ${u.role === 'admin' ? '<span class="badge credit" style="margin-left:6px;">Admin</span>' : ''}
        </div>
      </td>
      <td class="text-muted">${UI.escapeHtml(u.email)}</td>
      <td class="mono">¢ ${u.coins.toLocaleString()}</td>
      <td><span class="badge ${u.is_frozen ? 'failed' : 'success'}">${u.is_frozen ? 'Frozen' : 'Active'}</span></td>
      <td>
        <div class="user-row-actions">
          <button class="btn btn-ghost btn-sm" data-action="add"    data-id="${u.id}" data-username="${UI.escapeHtml(u.username)}">+ Coins</button>
          <button class="btn btn-ghost btn-sm" data-action="deduct" data-id="${u.id}" data-username="${UI.escapeHtml(u.username)}">− Coins</button>
          <button class="btn btn-ghost btn-sm" data-action="freeze" data-id="${u.id}" data-frozen="${u.is_frozen ? '1' : '0'}">${u.is_frozen ? 'Unfreeze' : 'Freeze'}</button>
          ${u.role !== 'admin' ? `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${u.id}" data-username="${UI.escapeHtml(u.username)}">Delete</button>` : ''}
        </div>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => handleUserAction(btn)));
}

let coinModalMode = 'add';

function handleUserAction(btn) {
  const { action, id, username } = btn.dataset;
  if (action === 'add' || action === 'deduct') {
    coinModalMode = action;
    document.getElementById('coinModalTitle').textContent = action === 'add' ? 'Add Coins to User' : 'Deduct Coins from User';
    document.getElementById('coinSubmitBtn').textContent  = action === 'add' ? 'Add Coins' : 'Deduct Coins';
    document.getElementById('coinModalUserId').value   = id;
    document.getElementById('coinModalUsername').value = username;
    document.getElementById('coinAmount').value = '';
    document.getElementById('coinReason').value = '';
    UI.openModal('coinModal');
  } else if (action === 'freeze') {
    toggleFreeze(id, btn.dataset.frozen !== '1');
  } else if (action === 'delete') {
    document.getElementById('deleteUserId').value = id;
    document.getElementById('deleteUsername').textContent = username;
    UI.openModal('deleteModal');
  }
}

async function toggleFreeze(userId, frozen) {
  try {
    await Api.post('/admin/freeze', { userId: parseInt(userId, 10), frozen });
    UI.toast(frozen ? 'Wallet frozen.' : 'Wallet unfrozen.', 'success');
    loadUsers(document.getElementById('userSearchInput').value.trim());
  } catch (err) { UI.toast(err.message || 'Failed.', 'error'); }
}

document.getElementById('coinForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const userId = parseInt(document.getElementById('coinModalUserId').value, 10);
  const amount = parseInt(document.getElementById('coinAmount').value, 10);
  const reason = document.getElementById('coinReason').value.trim();
  if (!amount || amount <= 0) { UI.toast('Enter a valid amount.', 'error'); return; }

  const btn = document.getElementById('coinSubmitBtn');
  btn.disabled = true;
  try {
    const ep = coinModalMode === 'add' ? '/admin/addcoins' : '/admin/deductcoins';
    await Api.post(ep, { userId, amount, reason: reason || undefined });
    UI.toast(`Coins ${coinModalMode === 'add' ? 'added to' : 'deducted from'} user.`, 'success');
    UI.closeModal('coinModal');
    loadUsers(document.getElementById('userSearchInput').value.trim());
    loadStats();
  } catch (err) { UI.toast(err.message || 'Operation failed.', 'error'); }
  finally { btn.disabled = false; }
});

document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
  const userId = document.getElementById('deleteUserId').value;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true;
  try {
    await Api.delete(`/admin/users/${userId}`);
    UI.toast('User deleted.', 'success');
    UI.closeModal('deleteModal');
    loadUsers(document.getElementById('userSearchInput').value.trim());
    loadStats();
  } catch (err) { UI.toast(err.message || 'Failed.', 'error'); }
  finally { btn.disabled = false; }
});

/* ── Marketplace ────────────────────────────────────────────────────────── */
async function loadAdminItems() {
  const grid = document.getElementById('adminItemsGrid');
  grid.innerHTML = `<div class="skeleton" style="height:160px;border-radius:16px;"></div><div class="skeleton" style="height:160px;border-radius:16px;"></div>`;
  try {
    const res = await Api.get('/admin/marketplace');
    const items = res.items || [];
    if (!items.length) {
      grid.innerHTML = `<div style="color:var(--text-muted);padding:20px;font-size:14px;">No items yet. Create one above.</div>`;
      return;
    }
    grid.innerHTML = items.map(item => `
      <div class="glass-card item-admin-card">
        <div class="item-admin-name">${UI.escapeHtml(item.name)}</div>
        <div class="item-admin-meta">${UI.escapeHtml(item.description || '—')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <span class="price-badge">¢ ${item.price.toLocaleString()}</span>
          <span class="code-badge">${item.available_codes} codes</span>
          <span class="badge ${item.is_active ? 'success' : 'failed'}">${item.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="item-admin-footer">
          <button class="btn btn-ghost btn-sm manage-item-btn"
            data-id="${item.id}" data-name="${UI.escapeHtml(item.name)}">⚙ Manage Codes</button>
        </div>
      </div>`).join('');

    grid.querySelectorAll('.manage-item-btn').forEach(btn => {
      btn.addEventListener('click', () => openItemModal(btn.dataset.id, btn.dataset.name));
    });
  } catch (err) {
    grid.innerHTML = `<div style="color:var(--danger);padding:20px;">${UI.escapeHtml(err.message)}</div>`;
  }
}

document.getElementById('createItemForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const name  = document.getElementById('itemName').value.trim();
  const price = parseInt(document.getElementById('itemPrice').value, 10);
  const description = document.getElementById('itemDesc').value.trim();
  if (!name || !price || price <= 0) { UI.toast('Name and price are required.', 'error'); return; }
  const btn = document.getElementById('createItemBtn');
  btn.disabled = true;
  try {
    await Api.post('/admin/marketplace', { name, price, description });
    UI.toast('Item created!', 'success');
    document.getElementById('createItemForm').reset();
    loadAdminItems();
  } catch (err) { UI.toast(err.message || 'Failed to create item.', 'error'); }
  finally { btn.disabled = false; }
});

let currentItemId = null;

async function openItemModal(itemId, name) {
  currentItemId = itemId;
  document.getElementById('itemModalId').value = itemId;
  document.getElementById('itemModalTitle').textContent = `Manage: ${name}`;
  UI.openModal('itemModal');
  await loadItemCodes(itemId);
}

async function loadItemCodes(itemId) {
  const tbody = document.getElementById('codesTableBody');
  tbody.innerHTML = UI.skeletonRows(4, 3);
  try {
    const res = await Api.get(`/admin/marketplace/${itemId}/codes`);
    const codes = res.codes || [];
    if (!codes.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="padding:20px;color:var(--text-muted);text-align:center;">No codes yet. Generate some above.</td></tr>`;
      return;
    }
    tbody.innerHTML = codes.map(c => `
      <tr>
        <td class="mono" style="font-size:13px;letter-spacing:.05em;">${UI.escapeHtml(c.code)}</td>
        <td><span class="badge ${c.is_used ? 'failed' : 'success'}">${c.is_used ? 'Used' : 'Available'}</span></td>
        <td class="text-muted">${c.used_by_name ? UI.escapeHtml(c.used_by_name) : '—'}</td>
        <td class="text-muted">${c.used_at ? UI.formatDate(c.used_at) : '—'}</td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--danger);">${UI.escapeHtml(err.message)}</td></tr>`;
  }
}

document.getElementById('genCodesBtn')?.addEventListener('click', async () => {
  const count = parseInt(document.getElementById('genCodeCount').value, 10) || 1;
  const btn = document.getElementById('genCodesBtn');
  btn.disabled = true;
  try {
    const res = await Api.post(`/admin/marketplace/${currentItemId}/codes/generate`, { count });
    UI.toast(`${res.codes.length} code(s) generated.`, 'success');
    loadItemCodes(currentItemId);
    loadAdminItems();
  } catch (err) { UI.toast(err.message || 'Failed.', 'error'); }
  finally { btn.disabled = false; }
});

document.getElementById('addCustomCodeBtn')?.addEventListener('click', async () => {
  const code = (document.getElementById('customCodeInput').value || '').trim().toUpperCase();
  if (!code) { UI.toast('Enter a code.', 'error'); return; }
  if (!/^[A-Z0-9]{9}1AS$/.test(code)) {
    UI.toast('Code must be 12 uppercase alphanumeric characters ending in "1AS".', 'error');
    return;
  }
  const btn = document.getElementById('addCustomCodeBtn');
  btn.disabled = true;
  try {
    await Api.post(`/admin/marketplace/${currentItemId}/codes/custom`, { code });
    UI.toast('Custom code added!', 'success');
    document.getElementById('customCodeInput').value = '';
    loadItemCodes(currentItemId);
    loadAdminItems();
  } catch (err) { UI.toast(err.message || 'Failed.', 'error'); }
  finally { btn.disabled = false; }
});

document.getElementById('toggleItemActiveBtn')?.addEventListener('click', async () => {
  try {
    const res = await Api.get(`/admin/marketplace`);
    const item = (res.items || []).find(i => String(i.id) === String(currentItemId));
    if (!item) return;
    await Api.put(`/admin/marketplace/${currentItemId}`, {
      name: item.name, description: item.description,
      price: item.price, stock: item.stock, is_active: !item.is_active,
    });
    UI.toast(`Item ${item.is_active ? 'deactivated' : 'activated'}.`, 'success');
    loadAdminItems();
  } catch (err) { UI.toast(err.message || 'Failed.', 'error'); }
});

document.getElementById('deleteItemBtn')?.addEventListener('click', async () => {
  if (!confirm('Delete this item and all its codes? This cannot be undone.')) return;
  try {
    await Api.delete(`/admin/marketplace/${currentItemId}`);
    UI.toast('Item deleted.', 'success');
    UI.closeModal('itemModal');
    loadAdminItems();
  } catch (err) { UI.toast(err.message || 'Failed.', 'error'); }
});

/* ── Transactions ───────────────────────────────────────────────────────── */
async function loadTransactions(page = 1) {
  const tbody = document.getElementById('txTbody');
  tbody.innerHTML = UI.skeletonRows(6, 6);
  try {
    const res = await Api.get(`/admin/transactions?page=${page}&limit=15`);
    renderTxTable(res.transactions);
    renderTxPagination(res.pagination);
  } catch (_) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Failed to load transactions.</td></tr>`;
  }
}

function renderTxTable(transactions) {
  const tbody = document.getElementById('txTbody');
  if (!transactions?.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty">No transactions yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = transactions.map(tx => `
    <tr>
      <td class="text-muted">${UI.formatDate(tx.created_at)}</td>
      <td>${UI.escapeHtml(tx.username)}</td>
      <td><span class="badge ${tx.type}">${tx.type === 'credit' ? 'Credit' : 'Debit'}</span></td>
      <td class="mono ${tx.type === 'credit' ? 'tx-amount credit' : 'tx-amount debit'}">${tx.type === 'credit' ? '+' : '−'}${tx.amount.toLocaleString()}</td>
      <td>${UI.escapeHtml(tx.reason)}</td>
      <td><span class="badge ${tx.status}">${tx.status === 'success' ? 'Success' : 'Failed'}</span></td>
    </tr>`).join('');
}

function renderTxPagination(pagination) {
  const { page, totalPages, total } = pagination;
  document.getElementById('txPaginationInfo').textContent = `${total.toLocaleString()} total transactions`;
  const controls = document.getElementById('txPaginationControls');
  let html = `<button class="page-btn" ${page <= 1 ? 'disabled' : ''} id="txPrevBtn">‹</button>`;
  const max = 5;
  let start = Math.max(1, page - Math.floor(max/2));
  let end   = Math.min(totalPages || 1, start + max - 1);
  start = Math.max(1, end - max + 1);
  for (let p = start; p <= end; p++) {
    html += `<button class="page-btn ${p === page ? 'active' : ''}" data-txpage="${p}">${p}</button>`;
  }
  html += `<button class="page-btn" ${page >= totalPages ? 'disabled' : ''} id="txNextBtn">›</button>`;
  controls.innerHTML = html;
  controls.querySelectorAll('[data-txpage]').forEach(b => b.addEventListener('click', () => loadTransactions(parseInt(b.dataset.txpage, 10))));
  document.getElementById('txPrevBtn')?.addEventListener('click', () => { if (page > 1) loadTransactions(page - 1); });
  document.getElementById('txNextBtn')?.addEventListener('click', () => { if (page < totalPages) loadTransactions(page + 1); });
}

/* ── Notices ────────────────────────────────────────────────────────────── */
async function loadNotices() {
  const list = document.getElementById('noticeList');
  list.innerHTML = `<div class="skeleton" style="height:80px;"></div>`;
  try {
    const res = await Api.get('/admin/notices');
    if (!res.notices?.length) {
      list.innerHTML = `<p class="text-muted" style="font-size:13.5px;">No notices published yet.</p>`;
      return;
    }
    list.innerHTML = res.notices.map(n => `
      <div class="glass-card notice-item">
        <div class="notice-item-title">${UI.escapeHtml(n.title)}</div>
        <div class="text-muted" style="font-size:13.5px;">${UI.escapeHtml(n.message)}</div>
        <div class="notice-item-meta">${UI.formatDate(n.created_at)}</div>
      </div>`).join('');
  } catch (_) { list.innerHTML = `<p class="text-muted">Failed to load notices.</p>`; }
}

document.getElementById('noticeForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const title   = document.getElementById('noticeTitle').value.trim();
  const message = document.getElementById('noticeMessage').value.trim();
  if (!title || !message) return;
  const btn = document.getElementById('noticeSubmitBtn');
  btn.disabled = true;
  try {
    await Api.post('/admin/notices', { title, message });
    UI.toast('Notice published.', 'success');
    document.getElementById('noticeForm').reset();
    loadNotices();
  } catch (err) { UI.toast(err.message || 'Failed.', 'error'); }
  finally { btn.disabled = false; }
});

/* ── Init ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadUsers();

  document.querySelectorAll('[data-tab]').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); switchTab(link.dataset.tab); });
  });

  let searchTimeout;
  document.getElementById('userSearchInput')?.addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadUsers(e.target.value.trim()), 300);
  });

  // Live uppercase + validate custom code field
  document.getElementById('customCodeInput')?.addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
});
