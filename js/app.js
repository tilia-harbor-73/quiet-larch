/* ==========================================================================
   js/app.js — запуск CRM: вигляд, екрани входу, каркас, пошук, застосунок,
   спільні дані (клієнти) і перехід курсу 1 вересня.
   Підключається останнім.
   Оновлено: 30.10.2026 · Етап 1, крок 2
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const root = document.getElementById('app');
  let shellOn = false;
  let dataOn = false;

  /** Спільні дані — щойно відомо, хто увійшов (ТЗ 3.9: автоматичні дії — коли хтось відкриває CRM). */
  function startData() {
    if (dataOn) return;
    dataOn = true;
    NG.store.open('clients').catch((e) => console.error('clients', e));
  }

  function render() {
    const st = NG.session.state;
    if (st.phase === 'ready') {
      if (!shellOn) { NG.shell.mount(root); shellOn = true; }
      return;
    }
    if (shellOn) { NG.shell.unmount(); shellOn = false; }
    NG.ui.mount(root, NG.gate.screen(st));
  }

  /** «+ Замовлення» у верхній панелі й «+» на телефоні (ТЗ 8.1). */
  function newOrder() {
    NG.ui.toast('Нове замовлення можна буде створити після кроку 3 етапу 1.');
  }

  NG.session.on((st, what) => {
    NG.look.syncPending();
    NG.look.apply();
    if (what === 'phase' || (what === 'signin' && st.phase !== 'ready')) render();
    if (st.phase === 'ready') startData();
  });

  NG.app = { render, newOrder };

  NG.look.apply();
  render();
  NG.search.init();
  NG.rollover.init();
  NG.pwa.init();
  NG.session.start();
})(window.NG);
