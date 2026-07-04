// js/ui.js
// Shared UI helpers used across pages: toast notifications, button
// ripple effects, animated number counting, background particles,
// and small modal/sidebar utilities.

const UI = {
  /* ---------------- Toasts ---------------- */
  toast(message, type = 'success', duration = 3500) {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-dot"></span><span>${UI.escapeHtml(message)}</span>`;
    stack.appendChild(el);

    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 260);
    }, duration);
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /* ---------------- Button ripple ---------------- */
  attachRipple(root = document) {
    root.querySelectorAll('.btn').forEach((btn) => {
      if (btn.dataset.rippleBound) return;
      btn.dataset.rippleBound = '1';
      btn.addEventListener('click', (e) => {
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        const size = Math.max(rect.width, rect.height);
        ripple.className = 'ripple';
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 650);
      });
    });
  },

  /* ---------------- Animated counter ---------------- */
  animateNumber(el, from, to, duration = 800) {
    if (from === to) {
      el.textContent = to.toLocaleString();
      return;
    }
    const start = performance.now();
    const diff = to - from;

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = Math.round(from + diff * eased);
      el.textContent = value.toLocaleString();
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.classList.add('count-flash');
        setTimeout(() => el.classList.remove('count-flash'), 500);
      }
    }
    requestAnimationFrame(tick);
  },

  /* ---------------- Floating particles ---------------- */
  initParticles(count = 18) {
    const container = document.querySelector('.particles');
    if (!container) return;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = `${Math.random() * 100}%`;
      p.style.bottom = `-10px`;
      const duration = 12 + Math.random() * 18;
      const delay = Math.random() * duration;
      p.style.animationDuration = `${duration}s`;
      p.style.animationDelay = `-${delay}s`;
      p.style.opacity = (0.2 + Math.random() * 0.4).toString();
      container.appendChild(p);
    }
  },

  /* ---------------- Modal ---------------- */
  openModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.add('open');
  },
  closeModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.remove('open');
  },

  /* ---------------- Mobile sidebar ---------------- */
  initSidebarToggle() {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.querySelector('.sidebar-backdrop');
    if (!menuBtn || !sidebar) return;
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop?.classList.toggle('open');
    });
    backdrop?.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('open');
    });
  },

  /* ---------------- Skeleton loading rows ---------------- */
  skeletonRows(columns, rows = 5) {
    let html = '';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < columns; c++) {
        html += `<td><div class="skeleton" style="height:14px;width:${60 + Math.random() * 30}%"></div></td>`;
      }
      html += '</tr>';
    }
    return html;
  },

  /* ---------------- Date formatting ---------------- */
  formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  },

  initials(name) {
    if (!name) return '?';
    return name.trim().charAt(0).toUpperCase();
  },
};

document.addEventListener('DOMContentLoaded', () => {
  UI.attachRipple();
  UI.initParticles();
  UI.initSidebarToggle();
});
