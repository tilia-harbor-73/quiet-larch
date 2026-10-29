/* ==========================================================================
   js/pages/settings.js — Налаштування (ТЗ 25). Зараз вкладка «Вигляд»
   (ТЗ 25.1, 2.2–2.3, 2.7–2.8); інші вкладки з’являться разом зі своїми
   етапами (рішення П12). Кожен налаштовує вигляд для себе (рішення П11).
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const { h } = NG.ui;
  const D = () => NG.dict;

  const TABS = [
    { id: 'vyhliad', label: 'Вигляд', render: renderLook }
  ];

  function row(title, desc, control, extra) {
    return h('div', { class: 'set-row' },
      h('div', { class: 'set-text' }, h('div', { class: 'set-title' }, title), desc ? h('div', { class: 'set-desc' }, desc) : null),
      h('div', { class: 'set-control' }, control, extra || null));
  }

  function swatch(o) {
    return h('button', {
      type: 'button', role: 'radio', class: 'swatch' + (o.active ? ' is-active' : '') + (o.taken ? ' is-taken' : ''),
      style: { '--sw': o.color }, dataset: { key: o.key },
      'aria-checked': o.active ? 'true' : 'false', 'aria-label': o.label, title: o.label,
      disabled: !!o.taken, tabIndex: o.active ? 0 : -1, onClick: o.onClick
    }, o.taken ? h('span', { class: 'swatch-mark' }, o.taken) : null);
  }

  /** Стрілки ← → між кружечками групи, як у звичайних перемикачах. */
  function radioKeys(group) {
    group.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const list = Array.from(group.querySelectorAll('button:not([disabled])'));
      const i = list.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      const next = list[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + list.length) % list.length];
      next.focus();
      next.click();
    });
    return group;
  }

  function renderLook() {
    const st = NG.session.state;
    const me = st.person;
    const partner = D().people[me].partner;
    const pName = D().people[partner].name;
    const p = NG.look.prefs();

    // Тема
    const themeSeg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Тема' },
      D().themes.map((t) => h('button', {
        type: 'button', role: 'radio', class: p.theme === t.id ? 'is-active' : '', dataset: { key: 'theme-' + t.id },
        'aria-checked': p.theme === t.id ? 'true' : 'false', onClick: () => NG.look.set({ theme: t.id })
      }, t.label)));

    // Колір інтерфейсу
    const accent = radioKeys(h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Колір інтерфейсу' },
      D().palette.map((c) => swatch({
        key: 'accent-' + c.id, color: `var(--pal-${c.id})`, active: p.accent === c.id,
        label: NG.utils.cap(c.name), onClick: () => NG.look.set({ accent: c.id })
      }))));

    // Мій колір: колір партнера зайнятий і позначений його ініціалом
    const mine = NG.look.colorOf(me);
    const theirs = NG.look.colorOf(partner);
    const my = radioKeys(h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Мій колір' },
      D().palette.map((c) => swatch({
        key: 'my-' + c.id, color: `var(--pal-${c.id})`, active: mine === c.id,
        taken: c.id === theirs ? D().people[partner].initial : null,
        label: NG.utils.cap(c.name) + (c.id === theirs ? ` — зайнятий: ${pName}` : ''),
        onClick: () => { if (c.id !== theirs) NG.look.set({ myColor: c.id }); }
      }))));
    const myLegend = h('div', { class: 'legend' },
      h('span', { class: 'legend-item' }, NG.ui.avatar(me, { size: 'sm' }), 'ти'),
      h('span', { class: 'legend-item' }, NG.ui.avatar(partner, { size: 'sm' }), `${pName} — ${D().paletteName(theirs)}, цей колір уже зайнятий`));

    // Колір «горить»
    const hot = radioKeys(h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Колір «горить» і «терміново»' },
      D().hot.map((c) => swatch({
        key: 'hot-' + c.id, color: `var(--hot-${c.id})`, active: p.hot === c.id,
        label: NG.utils.cap(c.name), onClick: () => NG.look.set({ hot: c.id })
      }))));
    const hotSample = h('div', { class: 'legend' },
      h('span', { class: 'chip-hot' }, 'терміново'),
      h('span', { class: 'text-hot' }, '2 горять'),
      h('span', { class: 'muted' }, '· ' + D().hotName(p.hot) + (p.hot === D().defaults.hot ? ', за замовчуванням' : '')));

    return h('div', { class: 'set-list' },
      row('Тема', 'За замовчуванням темна.', themeSeg),
      row('Колір інтерфейсу', 'Кнопки, активне меню, смужки прогресу і премії.', accent),
      row('Мій колір', `Ним позначені твої задачі, роботи й навантаження. ${pName} бачить тебе цим кольором.`, my, myLegend),
      row('Колір «горить» і «терміново»', 'Дедлайни в найближчі 48 годин, прострочене, не оплачено.', hot, hotSample));
  }

  function render(container, route) {
    const tab = TABS.find((t) => t.id === route.sub) || TABS[0];
    const body = h('div', { class: 'set-body' });
    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Розділи налаштувань' },
      TABS.map((t) => h('a', {
        class: 'tab-link' + (t === tab ? ' is-active' : ''), href: '#/settings/' + t.id, role: 'tab',
        'aria-selected': t === tab ? 'true' : 'false'
      }, t.label)));

    function draw() {
      const focusKey = document.activeElement && body.contains(document.activeElement) ? document.activeElement.dataset.key : null;
      NG.ui.mount(body, tab.render());
      if (focusKey) {
        const again = body.querySelector(`[data-key="${focusKey}"]`) || body.querySelector('.is-active');
        if (again) again.focus();
      }
    }

    NG.ui.mount(container, NG.ui.pageHead({ title: 'Налаштування' }), tabs, body);
    draw();

    const onLook = () => draw();
    document.addEventListener('ng:look', onLook);
    const off = NG.session.on((st, what) => { if (what === 'people') draw(); });
    return () => { document.removeEventListener('ng:look', onLook); off(); };
  }

  NG.router.register('settings', { render });
})(window.NG);
