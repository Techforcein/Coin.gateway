// js/wallet.js — UPDATED
// "Add Credits" self-service is REMOVED. Coins are admin-only.
// Quick action "Add Coins" replaced with "Marketplace" and "My Codes".

let currentBalance = 0;

async function loadWallet() {
  try {
    const [walletRes, statsRes, historyRes] = await Promise.all([
      Api.get('/wallet'),
      Api.get('/stats'),
      Api.get('/history?limit=5'),
    ]);

    const newBalance = walletRes.coins;
    UI.animateNumber(document.getElementById('balanceNumber'), currentBalance, newBalance);
    currentBalance = newBalance;

    const stats = statsRes.stats;
    document.getElementById('metaReceived').textContent = `+${stats.totalReceived.toLocaleString()} received`;
    document.getElementById('metaSpent').textContent    = `−${stats.totalSpent.toLocaleString()} spent`;
    UI.animateNumber(document.getElementById('statReceived'), 0, stats.totalReceived, 600);
    UI.animateNumber(document.getElementById('statSpent'),    0, stats.totalSpent,    600);
    UI.animateNumber(document.getElementById('statBalance'),  0, stats.currentBalance, 600);
    UI.animateNumber(document.getElementById('statCount'),    0, stats.transactionCount, 600);

    renderTxPreview(historyRes.transactions);
  } catch (err) {
    UI.toast(err.message || 'Failed to load wallet data.', 'error');
  }
}

function renderTxPreview(transactions) {
  const container = document.getElementById('txPreview');
  if (!transactions || transactions.length === 0) {
    container.innerHTML = `<p class="text-muted" style="padding:16px 0;font-size:13.5px;">No transactions yet. Visit the <a href="marketplace.html" style="color:var(--accent);">Marketplace</a> to spend your credits.</p>`;
    return;
  }
  container.innerHTML = transactions.map((tx) => `
    <div class="tx-row">
      <div class="tx-row-left">
        <span class="tx-dot ${tx.type}"></span>
        <span>${UI.escapeHtml(tx.reason)}</span>
      </div>
      <span class="tx-amount ${tx.type}">${tx.type === 'credit' ? '+' : '−'}${tx.amount.toLocaleString()}</span>
    </div>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  loadWallet();

  document.getElementById('qaMarket')?.addEventListener('click',      () => window.location.href = 'marketplace.html');
  document.getElementById('qaMyPurchases')?.addEventListener('click', () => window.location.href = 'marketplace.html#my-codes');
  document.getElementById('qaHistory')?.addEventListener('click',     () => window.location.href = 'history.html');
  document.getElementById('qaRefresh')?.addEventListener('click', () => {
    UI.toast('Refreshing balance…', 'success', 1200);
    loadWallet();
  });
});
