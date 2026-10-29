/* ==========================================================================
   js/search.js — пошук (Ctrl K або ⌘ K, ТЗ 2.4).
   Зараз шукає клієнтів — за ім’ям, прізвищем, групою, Telegram, телефоном,
   поштою (ТЗ 9.6); замовлення додадуться на кроці 3.
   ↑ ↓ — вибір, Enter — відкрити, Escape — закрити.
   Оновлено: 30.10.2026 · Етап 1, крок 2
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const { h } = NG.ui;
  const MAX = 8;
  let m = null;

  function open() {
    if (m) return;
    const input = h('input', {
      type: 'search', class: 'search-input', placeholder: 'Пошук: клієнт, тема, замовлення',
      'aria-label': 'Пошук', autocomplete: 'off', spellcheck: 'false'
    });
    const result = h('div', { class: 'search-result', role: 'listbox', 'aria-label': 'Знайдено' });
    let items = [];
    let active = 0;

    function go(c) { m.close(); NG.router.go('clients', c.id); }

    function mark() {
      result.querySelectorAll('.search-item').forEach((el, i) => {
        el.classList.toggle('is-active', i === active);
        el.setAttribute('aria-selected', i === active ? 'true' : 'false');
        if (i === active) el.scrollIntoView({ block: 'nearest' });
      });
    }

    function draw() {
      const q = input.value.trim();
      if (!q) {
        NG.ui.mount(result, h('div', { class: 'empty-small' }, NG.icon('search', { size: 'lg' }),
          h('div', null, 'Ім’я, прізвище, група, Telegram, телефон чи пошта клієнта. Замовлення додадуться на кроці 3.')));
        items = [];
        return;
      }
      const C = NG.clients;
      const idx = C.ordersIndex();
      const found = NG.store.list('clients').filter((c) => C.matches(c, q, idx.get(c.id) || []))
        .sort((a, b) => C.sortKey(a).localeCompare(C.sortKey(b), 'uk'));
      items = found.slice(0, MAX);
      active = 0;
      if (!items.length) {
        NG.ui.mount(result, h('div', { class: 'empty-small' }, h('div', null, 'Нікого не знайдено.')));
        return;
      }
      NG.ui.mount(result,
        h('div', { class: 'search-group' }, 'Клієнти'),
        items.map((c, i) => h('button', {
          type: 'button', role: 'option', class: 'search-item' + (i === active ? ' is-active' : ''), 'aria-selected': i === active ? 'true' : 'false',
          onClick: () => go(c), onMousemove: () => { if (active !== i) { active = i; mark(); } }
        }, NG.clientsUi.clientAvatar(c, 'sm'),
        h('span', { class: 'search-item-main' }, h('span', { class: 'search-item-title' }, C.fullName(c)),
          h('span', { class: 'search-item-sub' }, [C.courseLabel(c.course), c.group, c.telegram, c.phone].filter(Boolean).join(' · '))))),
        found.length > MAX ? h('div', { class: 'search-more' }, `Ще ${found.length - MAX} — уточни пошук або відкрий «Клієнти».`) : null);
    }

    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); active = (active + 1) % items.length; mark(); }
      else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); active = (active - 1 + items.length) % items.length; mark(); }
      else if (e.key === 'Enter' && items[active]) { e.preventDefault(); go(items[active]); }
    });

    m = NG.ui.modal({
      title: 'Пошук', className: 'modal-search',
      body: h('div', { class: 'search-box' }, h('label', { class: 'search-line' }, NG.icon('search'), input), result),
      onClose: () => { m = null; }
    });
    draw();
    input.focus();
  }

  function init() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л')) {
        if (NG.session.state.phase !== 'ready') return;
        e.preventDefault();
        if (m) m.close(); else open();
      }
    });
  }

  NG.search = { init, open };
})(window.NG);
