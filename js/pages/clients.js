/* ==========================================================================
   js/pages/clients.js — розділ «Клієнти»: список, пошук (ТЗ 9.6), фільтри
   й сортування (9.7), збережений фільтр «Кому скоро курсова» (рішення П16),
   статуси за двома шкалами (9.3, П4, П14), питання після 4 курсу (9.5).
   Картка клієнта — js/pages/client-card.js (адреса #/clients/<id>).
   Вибір пошуку, фільтрів і сортування запам’ятовується на цьому пристрої.
   Оновлено: 30.10.2026 · Етап 1, крок 2
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const { h } = NG.ui;
  const U = NG.utils;
  const C = () => NG.clients;
  const KEY = 'clients.view';

  function loadView() {
    const v = U.ls.get(KEY, {}) || {};
    return {
      q: typeof v.q === 'string' ? v.q : '',
      sort: C().SORTS.some((s) => s.id === v.sort) ? v.sort : 'last',
      f: Object.assign({}, C().EMPTY_FILTER, v.f || {})
    };
  }
  const saveView = (v) => U.ls.set(KEY, v);

  // ---------- Дрібні частини ----------
  /** Кружечок клієнта з ініціалами (контур, як на макеті). */
  function clientAvatar(c, size) {
    return h('span', { class: 'client-ava' + (size ? ' client-ava-' + size : ''), 'aria-hidden': 'true' }, C().initials(c));
  }

  /** Статуси: «новий · активний» і окремо «проблемний» (9.3). */
  function statusLine(s, opts) {
    const o = opts || {};
    return h('span', { class: 'status-line' },
      h('span', { class: 'status status-' + s.orderScale }, C().label(C().ORDER_SCALE, s.orderScale)),
      h('span', { class: 'status-sep', 'aria-hidden': 'true' }, '·'),
      h('span', { class: 'status status-' + s.activity }, C().label(C().ACTIVITY, s.activity)),
      s.problem ? (o.problemButton || h('span', { class: 'chip-hot chip-sm' }, 'проблемний')) : null);
  }

  /** Хто привів — коротко: кружечок Марка/Назіка або текст. */
  function broughtShort(c) {
    if (c.broughtBy === 'marko' || c.broughtBy === 'nazik') return h('span', { class: 'brought' }, NG.ui.avatar(c.broughtBy, { size: 'sm' }), h('span', { class: 'brought-text' }, 'привів ' + NG.dict.people[c.broughtBy].name));
    if (c.broughtBy === 'client') {
      const r = c.referrerId ? NG.store.get('clients', c.referrerId) : null;
      return h('span', { class: 'brought muted' }, 'за рекомендацією' + (r ? ': ' + C().fullName(r).split(' ').slice(0, 2).join(' ') : ''));
    }
    if (c.broughtBy === 'self') return h('span', { class: 'brought muted' }, 'прийшов сам');
    return null;
  }

  function subLine(c) {
    return [C().courseLabel(c.course), c.group, c.specialty].filter(Boolean).join(' · ');
  }

  function row(c, s) {
    return h('a', { class: 'client-row', href: '#/clients/' + c.id, dataset: { id: c.id } },
      clientAvatar(c),
      h('span', { class: 'client-main' },
        h('span', { class: 'client-name' }, C().fullName(c), c.personal ? h('span', { class: 'tag-personal', title: 'Особистий клієнт Марка' }, 'особистий') : null),
        h('span', { class: 'client-sub' }, subLine(c) || 'курс і група не вказані')),
      h('span', { class: 'client-status' }, statusLine(s)),
      h('span', { class: 'client-meta' },
        h('span', { class: 'mono' }, U.dateShort(s.lastContact)),
        h('span', { class: 'client-meta-sub' }, `${s.count} ${U.plural(s.count, ['замовлення', 'замовлення', 'замовлень'])}`)),
      h('span', { class: 'client-by' }, broughtShort(c)));
  }

  // ---------- Фільтри ----------
  function toggles(options, selected, onChange) {
    const set = new Set(selected);
    const el = h('div', { class: 'toggles' }, options.map((o) => {
      const b = h('button', {
        type: 'button', class: 'toggle' + (set.has(o.id) ? ' is-on' : ''), 'aria-pressed': set.has(o.id) ? 'true' : 'false', dataset: { value: o.id },
        onClick: () => {
          if (set.has(o.id)) set.delete(o.id); else set.add(o.id);
          b.classList.toggle('is-on', set.has(o.id));
          b.setAttribute('aria-pressed', set.has(o.id) ? 'true' : 'false');
          onChange(Array.from(set));
        }
      }, o.label);
      return b;
    }));
    return el;
  }

  function filterGroup(title, control, note) {
    return h('div', { class: 'fgroup' }, h('div', { class: 'fgroup-title' }, title), control, note ? h('div', { class: 'field-hint' }, note) : null);
  }

  function openFilters(view, onApply) {
    const f = JSON.parse(JSON.stringify(view.f));
    const all = NG.store.list('clients');
    const today = U.today();
    const countBtn = NG.ui.button({ label: 'Показати', variant: 'primary', onClick: () => { m.close(); onApply(f); } });
    const idx = C().ordersIndex();
    function recount() {
      const n = all.filter((c) => { const o = idx.get(c.id) || []; return C().passes(c, C().stats(c, o, today), f, o, today); }).length;
      countBtn.querySelector('span').textContent = `Показати ${n}`;
    }
    const set = (k) => (v) => { f[k] = v; recount(); };
    const opts = (list) => list.map((x) => ({ id: x, label: x }));
    const num = (k) => {
      const i = NG.form.input({ type: 'number', min: 0, step: 1, inputmode: 'numeric', value: f[k], class: 'input input-num', 'aria-label': k === 'countFrom' ? 'Замовлень від' : 'Замовлень до' });
      i.addEventListener('input', () => { f[k] = i.value === '' ? '' : String(Math.max(0, Math.floor(Number(i.value)))); recount(); });
      return i;
    };
    const date = (k, label) => {
      const i = NG.form.input({ type: 'date', value: f[k], class: 'input input-date', 'aria-label': label });
      i.addEventListener('input', () => { f[k] = i.value; recount(); });
      return i;
    };
    const groups = C().values(all, 'group');
    const specs = C().values(all, 'specialty');
    const tags = C().values(all, 'tags');
    const body = h('div', { class: 'filters' },
      filterGroup('Статус за замовленнями', toggles(C().ORDER_SCALE, f.orderScale, set('orderScale'))),
      filterGroup('Активність', toggles(C().ACTIVITY, f.activity, set('activity'))),
      filterGroup('«Проблемний»', NG.form.segmented({ value: f.problem, options: [{ id: '', label: 'Усі' }, { id: 'yes', label: 'Лише проблемні' }, { id: 'no', label: 'Без проблемних' }], onChange: set('problem') })),
      filterGroup('Кількість замовлень', h('div', { class: 'range' }, h('span', null, 'від'), num('countFrom'), h('span', null, 'до'), num('countTo'))),
      filterGroup('Дата останнього звернення', h('div', { class: 'range' }, h('span', null, 'з'), date('lastFrom', 'Звернення з'), h('span', null, 'по'), date('lastTo', 'Звернення по'))),
      filterGroup('Курс', toggles(C().COURSES.concat([{ id: '', label: 'не вказано' }]), f.course, set('course'))),
      groups.length ? filterGroup('Група', toggles(opts(groups), f.group, set('group'))) : null,
      specs.length ? filterGroup('Спеціальність', toggles(opts(specs), f.specialty, set('specialty'))) : null,
      filterGroup('Хто привів', toggles(C().BROUGHT, f.broughtBy, set('broughtBy'))),
      filterGroup('Що замовляє', NG.form.segmented({ value: f.kind, options: [{ id: '', label: 'Усе' }, { id: 'course', label: 'Курсові й дипломи' }, { id: 'science', label: 'Наукові' }], onChange: set('kind') })),
      tags.length ? filterGroup('Ручні мітки', toggles(opts(tags), f.tags, set('tags'))) : null,
      filterGroup('Рівень рейтингу', h('div', { class: 'muted' }, 'З’явиться на етапі 4 разом із рейтингом класності.')));
    const m = NG.ui.modal({
      title: 'Фільтри', className: 'modal-form modal-filters', body,
      footer: [NG.ui.button({ label: 'Скинути', onClick: () => { m.close(); onApply(Object.assign({}, C().EMPTY_FILTER, { soon: f.soon })); } }), countBtn]
    });
    recount();
  }

  /** Підписи активних фільтрів — для «чипів» над списком. */
  function chipsOf(f) {
    const out = [];
    const lbl = (list, id) => (list.find((x) => x.id === id) || { label: id || 'не вказано' }).label;
    const many = (k, list, title) => { if (f[k].length) out.push({ key: k, text: title + ': ' + f[k].map((id) => (list ? lbl(list, id) : id)).join(', ') }); };
    many('orderScale', C().ORDER_SCALE, 'Замовлення');
    many('activity', C().ACTIVITY, 'Активність');
    if (f.problem) out.push({ key: 'problem', text: f.problem === 'yes' ? 'Лише проблемні' : 'Без проблемних' });
    if (f.countFrom !== '' || f.countTo !== '') out.push({ key: 'count', text: 'Замовлень: ' + (f.countFrom !== '' ? 'від ' + f.countFrom + ' ' : '') + (f.countTo !== '' ? 'до ' + f.countTo : '') });
    if (f.lastFrom || f.lastTo) out.push({ key: 'last', text: 'Звернення: ' + (f.lastFrom ? 'з ' + U.dateShort(f.lastFrom) + ' ' : '') + (f.lastTo ? 'по ' + U.dateShort(f.lastTo) : '') });
    many('course', C().COURSES, 'Курс');
    many('group', null, 'Група');
    many('specialty', null, 'Спеціальність');
    many('broughtBy', C().BROUGHT, 'Привів');
    if (f.kind) out.push({ key: 'kind', text: f.kind === 'course' ? 'Замовляє курсові й дипломи' : 'Замовляє наукові' });
    many('tags', null, 'Мітки');
    return out;
  }

  function clearChip(f, key) {
    const e = C().EMPTY_FILTER;
    if (key === 'count') { f.countFrom = ''; f.countTo = ''; }
    else if (key === 'last') { f.lastFrom = ''; f.lastTo = ''; }
    else f[key] = Array.isArray(e[key]) ? [] : e[key];
  }

  // ---------- Питання після 4 курсу (9.5) ----------
  function openPromote() {
    let m = null;
    const body = h('div', { class: 'promote-list' });
    function draw() {
      const list = NG.store.list('clients').filter((c) => c.promoteAsk).sort((a, b) => C().sortKey(a).localeCompare(C().sortKey(b), 'uk'));
      if (!list.length) { if (m) m.close(); return; }
      NG.ui.mount(body, list.map((c) => h('div', { class: 'promote-row' },
        h('div', { class: 'promote-name' }, h('a', { href: '#/clients/' + c.id, onClick: () => m.close() }, C().fullName(c)), h('span', { class: 'muted' }, [c.group, c.specialty].filter(Boolean).join(' · '))),
        h('div', { class: 'promote-actions' },
          NG.ui.button({ label: 'Вступив у магістратуру', size: 'sm', onClick: () => { NG.rollover.answer(c.id, 'm1'); draw(); } }),
          NG.ui.button({ label: 'Випустився', size: 'sm', onClick: () => { NG.rollover.answer(c.id, 'grad'); draw(); } })))));
    }
    draw();
    m = NG.ui.modal({
      title: 'Після 4 курсу', className: 'modal-form', text: '1 вересня ці клієнти закінчили 4 курс. Вступили в магістратуру (1 курс магістратури) чи випустилися?',
      body, footer: [NG.ui.button({ label: 'Пізніше', onClick: () => m.close() })]
    });
  }

  // ---------- Сторінка ----------
  function renderList(container) {
    const view = loadView();
    const listEl = h('div', { class: 'client-list', role: 'list' });
    const subEl = h('p', { class: 'page-sub' });
    const chipsEl = h('div', { class: 'filter-chips' });
    const bannerEl = h('div');
    const search = h('input', {
      type: 'search', class: 'input input-search', placeholder: 'Пошук: ім’я, прізвище, група, Telegram, телефон, пошта, тема',
      'aria-label': 'Пошук клієнтів', autocomplete: 'off', spellcheck: 'false', value: view.q
    });
    const filterBtn = h('button', { type: 'button', class: 'btn btn-filter', onClick: () => openFilters(view, (f) => { view.f = f; changed(); }) });
    const sortSel = NG.form.select({ value: view.sort, options: C().SORTS });
    sortSel.classList.add('select-sort');
    sortSel.setAttribute('aria-label', 'Сортування');

    function changed() { saveView(view); draw(); }
    search.addEventListener('input', () => { view.q = search.value; changed(); });
    sortSel.addEventListener('change', () => { view.sort = sortSel.value; changed(); });

    function draw() {
      const today = U.today();
      const all = NG.store.list('clients');
      const n = C().activeCount(view.f);
      NG.ui.mount(filterBtn, NG.icon('sliders', { size: 'sm' }), h('span', null, 'Фільтри'), n ? h('span', { class: 'btn-count' }, String(n)) : null);

      // Чипи: збережений фільтр + активні
      const chips = [h('button', {
        type: 'button', class: 'chip-saved' + (view.f.soon ? ' is-on' : ''), 'aria-pressed': view.f.soon ? 'true' : 'false',
        title: 'Брали курсову чи диплом, «Здача до» минула, ще навчаються й нової курсової не замовили',
        onClick: () => { view.f.soon = !view.f.soon; changed(); }
      }, NG.icon('bookmark', { size: 'sm' }), 'Кому скоро курсова')];
      chipsOf(view.f).forEach((ch) => chips.push(h('span', { class: 'chip-filter' }, ch.text,
        h('button', { type: 'button', class: 'tag-x', 'aria-label': 'Прибрати фільтр: ' + ch.text, onClick: () => { clearChip(view.f, ch.key); changed(); } }, NG.icon('x', { size: 'sm' })))));
      if (n || view.f.soon || view.q) chips.push(h('button', { type: 'button', class: 'link-btn', onClick: () => { view.f = Object.assign({}, C().EMPTY_FILTER); view.q = ''; search.value = ''; changed(); } }, 'Скинути все'));
      NG.ui.mount(chipsEl, chips);

      // Питання після 4 курсу
      const ask = all.filter((c) => c.promoteAsk).length;
      NG.ui.mount(bannerEl, ask ? h('div', { class: 'callout callout-ask' }, NG.icon('info'),
        h('span', { class: 'callout-text' }, `Після 4 курсу: ${ask} ${U.plural(ask, ['клієнт', 'клієнти', 'клієнтів'])} — вступили в магістратуру чи випустилися?`),
        NG.ui.button({ label: 'Відповісти', size: 'sm', onClick: openPromote })) : null);

      if (!NG.store.loaded('clients')) {
        subEl.textContent = 'Завантажую…';
        NG.ui.mount(listEl, h('div', { class: 'empty-small' }, NG.icon('loader', { size: 'lg', className: 'spin' }), h('div', null, 'Завантажую клієнтів…')));
        return;
      }
      const rows = [];
      const idx = C().ordersIndex();
      all.forEach((c) => {
        const orders = idx.get(c.id) || [];
        if (!C().matches(c, view.q, orders)) return;
        const s = C().stats(c, orders, today);
        if (!C().passes(c, s, view.f, orders, today)) return;
        rows.push({ c, s });
      });
      rows.sort(C().sorter(view.sort));
      const word = (k) => U.plural(k, ['клієнт', 'клієнти', 'клієнтів']);
      subEl.textContent = rows.length === all.length ? `${all.length} ${word(all.length)}` : `Знайдено ${rows.length} з ${all.length}`;

      if (!all.length) {
        const err = NG.store.error('clients');
        NG.ui.mount(listEl, h('div', { class: 'empty' },
          h('div', { class: 'empty-title' }, err ? 'Не вдалося завантажити клієнтів' : 'Клієнтів ще немає'),
          h('p', { class: 'muted' }, err ? 'Перевір інтернет і онови сторінку.' : 'Додай першого — кнопка «Клієнт» угорі. Реальні дані вносимо після кроку 5 (копії й кошик).')));
        return;
      }
      if (!rows.length) {
        NG.ui.mount(listEl, h('div', { class: 'empty' },
          h('div', { class: 'empty-title' }, 'Нікого не знайдено'),
          view.f.soon && !NG.store.list('orders').length
            ? h('p', { class: 'muted' }, '«Кому скоро курсова» рахується за замовленнями — вони з’являться на кроці 3.')
            : h('p', { class: 'muted' }, 'Зміни пошук або фільтри.')));
        return;
      }
      NG.ui.mount(listEl, rows.map((r) => row(r.c, r.s)));
    }

    const head = h('header', { class: 'page-head page-head-row' },
      h('div', null, h('h1', { class: 'page-title' }, 'Клієнти'), subEl),
      NG.ui.button({ label: 'Клієнт', icon: 'plus', variant: 'primary', className: 'btn-add', onClick: () => NG.clientForm.open() }));
    NG.ui.mount(container, head,
      h('div', { class: 'list-toolbar' },
        h('label', { class: 'searchbox' }, NG.icon('search', { size: 'sm' }), search),
        filterBtn, sortSel),
      chipsEl, bannerEl, listEl);
    draw();

    const offC = NG.store.on('clients', draw);
    const offO = NG.store.on('orders', draw);
    const onDay = () => draw();
    document.addEventListener('ng:daychange', onDay);
    return () => { offC(); offO(); document.removeEventListener('ng:daychange', onDay); };
  }

  function render(container, route) {
    if (route.sub) return NG.clientCard.render(container, route.sub);
    return renderList(container);
  }

  NG.router.register('clients', { render });
  NG.clientsUi = { clientAvatar, statusLine, broughtShort, subLine, openPromote };
})(window.NG);
