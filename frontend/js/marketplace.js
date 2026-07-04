// js/marketplace.js
// User-facing marketplace: browse items, confirm & buy, reveal code, view owned codes.

let userBalance = 0;
let allItems = [];

// ── Tab switching ────────────────────────────────────────────────────────────
function switchMarketTab(tabId) {
  document.querySelectorAll('[data-mtab]').forEach(t => t.classList.toggle('active', t.dataset.mtab === tabId));
  ['shopTab','myCodesTab'].forEach(id => document.getElementById(id).classList.toggle('hidden', id !== tabId));
  if (tabId === 'myCodesTab') loadMyPurchases();
}

// ── Balance ──────────────────────────────────────────────────────────────────
async function loadBalance() {
  try {
    const res = await Api.get('/wallet');
    userBalance = res.coins;
    document.getElementById('topbalance').textContent = userBalance.toLocaleString();
  } catch (_) {}
}

// ── Items ────────────────────────────────────────────────────────────────────
const ITEM_ICONS = ['🎮','💎','⚡','🔑','🌟','🎯','🔥','🛡️','🎁','🏆'];

async function loadItems() {
  const grid = document.getElementById('itemsGrid');
  try {
    const res = await Api.get('/marketplace');
    allItems = res.items || [];
    if (!allItems.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">🏪</div><div>No items available yet.<br><span class="text-faint" style="font-size:13px;">Check back later or ask an admin.</span></div></div>`;
      return;
    }
    grid.innerHTML = allItems.map((item, i) => {
      const avail = Number(item.available_codes);
      const stockLabel = avail === 0
        ? `<span class="item-stock out">Out of stock</span>`
        : avail <= 5
          ? `<span class="item-stock low">${avail} left</span>`
          : `<span class="item-stock">${avail} available</span>`;
      const canBuy = avail > 0 && userBalance >= item.price;
      return `
        <div class="glass-card item-card" data-id="${item.id}">
          <div class="item-card-icon">${ITEM_ICONS[i % ITEM_ICONS.length]}</div>
          <div class="item-name">${UI.escapeHtml(item.name)}</div>
          <div class="item-desc">${UI.escapeHtml(item.description || 'A premium digital item.')}</div>
          <div class="item-footer">
            <div>
              <div class="item-price">¢ ${item.price.toLocaleString()}</div>
              ${stockLabel}
            </div>
            <button class="btn btn-primary btn-sm buy-btn"
              data-id="${item.id}" data-name="${UI.escapeHtml(item.name)}" data-price="${item.price}"
              ${!canBuy ? 'disabled' : ''}
            >${avail === 0 ? 'Sold Out' : userBalance < item.price ? 'Need More Coins' : 'Buy Now'}</button>
          </div>
        </div>`;
    }).join('');

    // Wire buy buttons
    grid.querySelectorAll('.buy-btn:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openBuyModal(btn.dataset.id, btn.dataset.name, btn.dataset.price);
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">❌</div><div>${UI.escapeHtml(err.message || 'Failed to load items.')}</div></div>`;
  }
}

// ── Buy modal ────────────────────────────────────────────────────────────────
function openBuyModal(itemId, name, price) {
  document.getElementById('modalItemId').value    = itemId;
  document.getElementById('modalItemName').textContent  = name;
  document.getElementById('modalItemPrice').textContent = `${Number(price).toLocaleString()} credits`;
  const after = userBalance - Number(price);
  document.getElementById('modalAfterBalance').textContent = `${after.toLocaleString()} credits`;
  UI.openModal('buyModal');
}

document.getElementById('confirmBuyBtn')?.addEventListener('click', async () => {
  const itemId = document.getElementById('modalItemId').value;
  const btn = document.getElementById('confirmBuyBtn');
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-loading-dots"><span></span><span></span><span></span></span>`;

  try {
    const res = await Api.post('/marketplace/buy', { itemId: parseInt(itemId, 10) });
    UI.closeModal('buyModal');
    userBalance = res.balance;
    document.getElementById('topbalance').textContent = userBalance.toLocaleString();

    // Show success modal with the code
    document.getElementById('successCode').textContent = res.code;
    UI.openModal('successModal');

    // Refresh items
    loadItems();
  } catch (err) {
    UI.toast(err.message || 'Purchase failed.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Buy Now';
  }
});

document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
  const code = document.getElementById('successCode').textContent;
  navigator.clipboard?.writeText(code).then(() => {
    UI.toast('Code copied to clipboard!', 'success');
  }).catch(() => {
    UI.toast(`Your code: ${code}`, 'success', 6000);
  });
});

// ── My Codes ─────────────────────────────────────────────────────────────────
async function loadMyPurchases() {
  const list = document.getElementById('myCodesList');
  list.innerHTML = `<div class="skeleton" style="height:80px;border-radius:16px;margin-bottom:12px;"></div><div class="skeleton" style="height:80px;border-radius:16px;"></div>`;
  try {
    const res = await Api.get('/marketplace/my-purchases');
    const purchases = res.purchases || [];
    if (!purchases.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎟️</div><div>No purchases yet.<br><span class="text-faint" style="font-size:13px;">Buy an item from the Shop tab to get your first code.</span></div></div>`;
      return;
    }
    list.innerHTML = purchases.map(p => `
      <div class="glass-card code-card">
        <div class="code-info">
          <div class="code-item-name">${UI.escapeHtml(p.item_name)}</div>
          <div class="code-price">¢ ${p.coins_spent.toLocaleString()} spent</div>
          <div class="code-date">${UI.formatDate(p.created_at)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          <div class="code-value">${UI.escapeHtml(p.code)}</div>
          <button class="code-copy-btn" data-code="${UI.escapeHtml(p.code)}">Copy</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('.code-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard?.writeText(btn.dataset.code).then(() => {
          UI.toast('Code copied!', 'success');
        }).catch(() => {
          UI.toast(`Code: ${btn.dataset.code}`, 'success', 5000);
        });
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div>${UI.escapeHtml(err.message || 'Failed to load purchases.')}</div></div>`;
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Tab wiring
  document.querySelectorAll('[data-mtab]').forEach(tab => {
    tab.addEventListener('click', () => switchMarketTab(tab.dataset.mtab));
  });

  // If URL hash is #my-codes, jump to that tab
  if (window.location.hash === '#my-codes') switchMarketTab('myCodesTab');

  await loadBalance();
  await loadItems();
});
