/* ==========================================================================
   js/app.js — запуск CRM: вигляд, екрани входу, каркас, пошук, застосунок.
   Підключається останнім.
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const root = document.getElementById('app');
  let shellOn = false;

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
  });

  NG.app = { render, newOrder };

  NG.look.apply();
  render();
  NG.search.init();
  NG.pwa.init();
  NG.session.start();
})(window.NG);
