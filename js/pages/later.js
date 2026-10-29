/* ==========================================================================
   js/pages/later.js — заглушка для розділів, яких ще немає (рішення П1):
   розділ видно в меню, а тут сказано, на якому етапі він з’явиться.
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const { h } = NG.ui;

  function render(container, route) {
    const sec = NG.dict.section(route.id) || { label: 'Розділ', icon: 'info', stage: '' };
    const when = sec.stage === 1 && sec.step
      ? `Розділ з’явиться на кроці ${sec.step} етапу 1.`
      : `Розділ з’явиться на етапі ${sec.stage}.`;
    NG.ui.mount(container,
      NG.ui.pageHead({ title: sec.label }),
      h('section', { class: 'later' },
        h('span', { class: 'later-icon' }, NG.icon(sec.icon, { size: 'lg' })),
        h('div', null,
          h('div', { class: 'later-title' }, 'Ще в роботі'),
          h('p', { class: 'later-text' }, when))));
  }

  NG.router.register('later', { render });
})(window.NG);
