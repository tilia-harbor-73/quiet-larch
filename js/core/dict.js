/* ==========================================================================
   js/core/dict.js — довідники: палітра з 10 кольорів (ТЗ 2.3, 2.7),
   кольори «горить» (2.8), теми (2.2), Марко й Назік, розділи меню
   (1.10, порядок і групи — за макетом, рішення П1).
   Самі значення кольорів — у css/base.css (окремо для темної й світлої теми).
   Оновлено: 30.10.2026 · Етап 1, крок 2
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const dict = {
    // Порядок і назви — як у ТЗ 2.3
    palette: [
      { id: 'blue', name: 'синій' },
      { id: 'indigo', name: 'індиго' },
      { id: 'violet', name: 'фіолетовий' },
      { id: 'pink', name: 'малиновий' },
      { id: 'red', name: 'червоний' },
      { id: 'terracotta', name: 'теракотовий' },
      { id: 'amber', name: 'бурштиновий' },
      { id: 'green', name: 'зелений' },
      { id: 'teal', name: 'бірюзовий' },
      { id: 'slate', name: 'сіро-синій' }
    ],

    // ТЗ 2.8: кораловий (за замовчуванням), червоний, малиновий, помаранчевий
    hot: [
      { id: 'coral', name: 'кораловий' },
      { id: 'red', name: 'червоний' },
      { id: 'crimson', name: 'малиновий' },
      { id: 'orange', name: 'помаранчевий' }
    ],

    themes: [
      { id: 'dark', label: 'Темна', icon: 'moon' },
      { id: 'light', label: 'Світла', icon: 'sun' },
      { id: 'system', label: 'Як у системі' }
    ],

    // ТЗ 2.2 (темна), 2.3 (бурштиновий), 2.8 (кораловий)
    defaults: { theme: 'dark', accent: 'amber', hot: 'coral' },

    // ТЗ 2.7: за замовчуванням Марко — бурштиновий, Назік — бірюзовий
    people: {
      marko: { id: 'marko', name: 'Марко', initial: 'М', color: 'amber', partner: 'nazik' },
      nazik: { id: 'nazik', name: 'Назік', initial: 'Н', color: 'teal', partner: 'marko' }
    },

    /* Розділи меню. stage — етап, на якому розділ з’явиться (ТЗ 27.1);
       step — крок етапу 1; ready — розділ уже працює. */
    sections: [
      {
        group: 'Робота',
        items: [
          { id: 'home', label: 'Головна', icon: 'house', stage: 2 },
          { id: 'tasks', label: 'Задачі', icon: 'tasks', stage: 2 },
          { id: 'orders', label: 'Замовлення', icon: 'orders', stage: 1, step: 3 },
          { id: 'clients', label: 'Клієнти', icon: 'users', stage: 1, step: 2, ready: true },
          { id: 'calendar', label: 'Календар', icon: 'calendar', stage: 2 }
        ]
      },
      {
        group: 'Гроші',
        items: [
          { id: 'finance', label: 'Фінанси', icon: 'wallet', stage: 3 },
          { id: 'price', label: 'Прайс', icon: 'tag', stage: 3 },
          { id: 'referral', label: 'Рефералка', icon: 'link', stage: 4 }
        ]
      },
      {
        group: 'Інше',
        items: [
          { id: 'analytics', label: 'Аналітика', icon: 'chart', stage: 5 },
          { id: 'knowledge', label: 'База знань', icon: 'book', stage: 5 },
          { id: 'settings', label: 'Налаштування', icon: 'sliders', ready: true }
        ]
      }
    ],

    // Телефон (ТЗ 2.10): меню внизу — ці чотири + «Ще»
    mobileNav: ['home', 'tasks', 'orders', 'clients'],

    // Поки немає Головної, CRM відкривається на «Замовленнях» (рішення П1)
    startRoute: 'orders'
  };

  dict.section = (id) => {
    for (const g of dict.sections) {
      const it = g.items.find((x) => x.id === id);
      if (it) return it;
    }
    return null;
  };
  dict.paletteName = (id) => (dict.palette.find((c) => c.id === id) || {}).name || '';
  dict.hotName = (id) => (dict.hot.find((c) => c.id === id) || {}).name || '';
  dict.isColor = (id) => dict.palette.some((c) => c.id === id);
  dict.isHot = (id) => dict.hot.some((c) => c.id === id);
  dict.isTheme = (id) => dict.themes.some((t) => t.id === id);

  NG.dict = dict;
})(window.NG);
