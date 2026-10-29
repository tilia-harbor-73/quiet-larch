/* ==========================================================================
   js/notify.js — дзвіночок сповіщень у верхній панелі (ТЗ 2.4, 5.1).
   На етапі 1 сповіщень лише два (рішення П2): «щоденна копія не зробилася»
   і «партнер вручну змінив ціну чи поділ». Вони з’являться разом із копіями
   (крок 5) і замовленнями (крок 3); зараз список порожній.
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const { h } = NG.ui;
  let items = [];        // { id, title, text, at, read }
  const bells = new Set();
  let pop = null;

  function unread() { return items.filter((n) => !n.read).length; }

  function updateBadges() {
    const n = unread();
    bells.forEach((b) => {
      const badge = b.querySelector('.bell-badge');
      badge.textContent = n > 9 ? '9+' : String(n);
      badge.hidden = n === 0;
      b.setAttribute('aria-label', n ? `Сповіщення: ${n} нових` : 'Сповіщення');
    });
  }

  function createBell() {
    const b = h('button', { type: 'button', class: 'icon-btn bell', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', onClick: () => open(b) },
      NG.icon('bell'), h('span', { class: 'bell-badge', hidden: true }));
    bells.add(b);
    updateBadges();
    return b;
  }

  function list() {
    if (!items.length) {
      return h('div', { class: 'empty-small' }, NG.icon('bell', { size: 'lg' }), h('div', null, 'Сповіщень немає'));
    }
    return h('div', { class: 'notif-list' }, items.map((n) => h('div', { class: 'notif' + (n.read ? '' : ' is-unread') },
      h('div', { class: 'notif-title' }, n.title), n.text ? h('div', { class: 'notif-text' }, n.text) : null)));
  }

  function open(anchor) {
    if (pop) { pop.close(); return; }
    pop = NG.ui.popover(anchor, h('div', { class: 'notif-pop' },
      h('div', { class: 'popover-head' }, 'Сповіщення'), list()), { align: 'right', className: 'popover-notif', onClose: () => { pop = null; } });
  }

  NG.notify = { createBell, unread, set(list) { items = list || []; updateBadges(); } };
})(window.NG);
