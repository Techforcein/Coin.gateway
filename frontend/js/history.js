// js/history.js
// Loads and renders the user's full transaction history with
// server-side pagination and client-side reason search/filter.

let currentPage = 1;
const PAGE_SIZE = 10;
let allFetchedThisPage = [];

async function loadHistory(page = 1) {
  currentPage = page;
  const tbody = document.getElementById('historyTbody');
  tbody.innerHTML = UI.skeletonRows(5, 6);

  try {
    const res = await Api.get(`/history?page=${page}&limit=${PAGE_SIZE}`);
    allFetchedThisPage = res.transactions;
    renderTable(allFetchedThisPage);
    renderPagination(res.pagination);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Failed to load history: ${UI.escapeHtml(err.message || '')}</td></tr>`;
  }
}

function renderTable(transactions) {
  const tbody = document.getElementById('historyTbody');
  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5">
        <div class="table-empty">
          <div class="table-empty-icon">🪙</div>
          No transactions found.
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = transactions
    .map(
      (tx) => `
      <tr>
        <td class="text-muted">${UI.formatDate(tx.created_at)}</td>
        <td><span class="badge ${tx.type}">${tx.type === 'credit' ? 'Credit' : 'Debit'}</span></td>
        <td class="mono ${tx.type === 'credit' ? 'tx-amount credit' : 'tx-amount debit'}">${tx.type === 'credit' ? '+' : '−'}${tx.amount.toLocaleString()}</td>
        <td>${UI.escapeHtml(tx.reason)}</td>
        <td><span class="badge ${tx.status}">${tx.status === 'success' ? 'Success' : 'Failed'}</span></td>
      </tr>`
    )
    .join('');
}

function renderPagination(pagination) {
  const { page, totalPages, total } = pagination;
  document.getElementById('paginationInfo').textContent = `${total.toLocaleString()} total transactions`;

  const controls = document.getElementById('paginationControls');
  let html = `<button class="page-btn" ${page <= 1 ? 'disabled' : ''} id="prevPageBtn">‹</button>`;

  const maxButtons = 5;
  let start = Math.max(1, page - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages || 1, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);

  for (let p = start; p <= end; p++) {
    html += `<button class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`;
  }
  html += `<button class="page-btn" ${page >= totalPages ? 'disabled' : ''} id="nextPageBtn">›</button>`;
  controls.innerHTML = html;

  controls.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => loadHistory(parseInt(btn.dataset.page, 10)));
  });
  document.getElementById('prevPageBtn')?.addEventListener('click', () => {
    if (page > 1) loadHistory(page - 1);
  });
  document.getElementById('nextPageBtn')?.addEventListener('click', () => {
    if (page < totalPages) loadHistory(page + 1);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadHistory(1);

  let searchTimeout;
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.toLowerCase();
    searchTimeout = setTimeout(() => {
      // Client-side filter on the currently loaded page for instant
      // feedback. A production system with large history could instead
      // add a server-side `?q=` param to /api/history.
      const filtered = allFetchedThisPage.filter((tx) =>
        tx.reason.toLowerCase().includes(query)
      );
      renderTable(query ? filtered : allFetchedThisPage);
    }, 200);
  });
});
