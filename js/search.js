/* ==========================================================================
   js/search.js — пошук (Ctrl K або ⌘ K, ТЗ 2.4).
   Шукати він почне на кроках 2–3 етапу 1, коли з’являться клієнти
   й замовлення; зараз — лише вікно пошуку з поясненням.
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const { h } = NG.ui;
  let m = null;

  function open() {
    if (m) return;
    const input = h('input', {
      type: 'search', class: 'search-input', placeholder: 'Пошук: клієнт, тема, замовлення',
      'aria-label': 'Пошук', autocomplete: 'off', spellcheck: 'false'
    });
    const result = h('div', { class: 'search-result' },
      h('div', { class: 'empty-small' }, NG.icon('search', { size: 'lg' }),
        h('div', null, 'Шукати поки нема чого: пошук по клієнтах і замовленнях запрацює, щойно вони з’являться в CRM.')));
    m = NG.ui.modal({
      title: 'Пошук', className: 'modal-search',
      body: h('div', { class: 'search-box' }, h('label', { class: 'search-line' }, NG.icon('search'), input), result),
      onClose: () => { m = null; }
    });
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
