/* ==========================================================================
   js/shell.js — каркас CRM за макетом «Темний 2.0»:
   • комп'ютер: бічне меню з групами «Робота / Гроші / Інше» (ТЗ 2.1, 1.10,
     рішення П1), профіль унизу меню з виходом, верхня панель — дата й номер
     тижня, пошук (Ctrl K), тема, дзвіночок, «+ Замовлення» (ТЗ 2.4);
   • телефон: меню внизу (Головна, Задачі, Замовлення, Клієнти, Ще), кнопка
     «+» внизу справа, угорі — пошук, тема й дзвіночок (ТЗ 2.10).
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const { h } = NG.ui;
  const U = NG.utils;
  const el = {};
  let unsubs = [];
  let lastDay = null;
  let timer = null;

  function stageLabel(item) { return 'етап ' + item.stage; }

  // ---------- Бічне меню ----------
  function navItem(item, opts) {
    const o = opts || {};
    const later = !item.ready;
    const a = h('a', {
      class: 'nav-item' + (later ? ' is-later' : ''), href: '#/' + item.id, dataset: { route: item.id },
      title: later ? `${item.label} — з’явиться на етапі ${item.stage}` : null
    },
    NG.icon(item.icon),
    h('span', { class: 'nav-label' }, item.label),
    later ? h('span', { class: 'nav-stage' }, stageLabel(item)) : h('span', { class: 'nav-count', dataset: { count: item.id } }));
    if (o.onClick) a.addEventListener('click', o.onClick);
    return a;
  }

  function buildSidebar() {
    el.nav = h('nav', { class: 'nav', 'aria-label': 'Розділи' },
      NG.dict.sections.map((g) => h('div', { class: 'nav-group' },
        h('div', { class: 'nav-group-label' }, g.group),
        g.items.map((it) => navItem(it)))));

    el.profileAvatar = h('span', { class: 'profile-avatar' });
    el.profileName = h('span', { class: 'profile-name' });
    el.profileBtn = h('button', {
      type: 'button', class: 'profile', 'aria-haspopup': 'dialog', 'aria-expanded': 'false',
      onClick: () => openProfileMenu(el.profileBtn, 'above')
    }, el.profileAvatar, h('span', { class: 'profile-text' }, el.profileName, h('span', { class: 'profile-sub' }, 'Вхід через Google')));

    return h('aside', { class: 'sidebar' },
      h('a', { class: 'brand', href: '#/' + NG.dict.startRoute, 'aria-label': 'NewGen — на початок' }, NG.logo(26), h('span', null, 'NewGen')),
      el.nav,
      el.profileBtn);
  }

  // ---------- Верхня панель ----------
  function themeButtons() {
    el.themePill = h('div', { class: 'theme-pill', role: 'group', 'aria-label': 'Тема' },
      ['dark', 'light'].map((t) => h('button', {
        type: 'button', class: 'theme-pill-btn', dataset: { theme: t },
        title: t === 'dark' ? 'Темна тема' : 'Світла тема', 'aria-label': t === 'dark' ? 'Темна тема' : 'Світла тема',
        onClick: () => NG.look.set({ theme: t })
      }, NG.icon(t === 'dark' ? 'moon' : 'sun', { size: 'sm' }))));
    el.themeIcon = h('button', {
      type: 'button', class: 'icon-btn only-mobile', 'aria-label': 'Змінити тему',
      onClick: () => NG.look.set({ theme: NG.look.resolvedTheme() === 'dark' ? 'light' : 'dark' })
    });
  }

  function updateTheme() {
    const cur = NG.look.resolvedTheme();
    el.themePill.querySelectorAll('button').forEach((b) => {
      const on = b.dataset.theme === cur;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    el.themeIcon.replaceChildren(NG.icon(cur === 'dark' ? 'moon' : 'sun'));
    el.themeIcon.title = cur === 'dark' ? 'Зараз темна тема — увімкнути світлу' : 'Зараз світла тема — увімкнути темну';
  }

  function buildTopbar() {
    el.date = h('strong', { class: 'topbar-day' });
    el.week = h('span', { class: 'topbar-week' });
    themeButtons();
    el.bell = NG.notify.createBell();
    const kbd = U.isMac() ? '⌘ K' : 'Ctrl K';
    return h('header', { class: 'topbar' },
      h('div', { class: 'topbar-left' },
        h('a', { class: 'brand brand-mobile', href: '#/' + NG.dict.startRoute, 'aria-label': 'NewGen — на початок' }, NG.logo(24), h('span', null, 'NewGen')),
        h('div', { class: 'topbar-date' }, el.date, el.week)),
      h('div', { class: 'topbar-right' },
        h('button', { type: 'button', class: 'search-field', onClick: () => NG.search.open(), 'aria-label': 'Пошук (' + kbd + ')' },
          NG.icon('search', { size: 'sm' }),
          h('span', { class: 'search-placeholder' }, 'Пошук: клієнт, тема, замовлення'),
          h('kbd', { class: 'kbd' }, kbd)),
        h('button', { type: 'button', class: 'icon-btn only-mobile', 'aria-label': 'Пошук', onClick: () => NG.search.open() }, NG.icon('search')),
        el.themePill,
        el.themeIcon,
        el.bell,
        h('button', { type: 'button', class: 'btn btn-primary btn-new-order', onClick: () => NG.app.newOrder() },
          NG.icon('plus', { size: 'sm' }), h('span', null, 'Замовлення'))));
  }

  function updateDate() {
    const day = U.today();
    el.date.textContent = U.dateHeading(day);
    el.week.textContent = U.weekLabel(U.isoWeek(day));
    if (lastDay && day !== lastDay) document.dispatchEvent(new CustomEvent('ng:daychange', { detail: { day } }));
    lastDay = day;
  }

  // ---------- Телефон: меню внизу і «Ще» ----------
  function buildTabbar() {
    const items = NG.dict.mobileNav.map((id) => {
      const it = NG.dict.section(id);
      return h('a', {
        class: 'tab' + (it.ready ? '' : ' is-later'), href: '#/' + id, dataset: { route: id },
        title: it.ready ? null : `${it.label} — з’явиться на етапі ${it.stage}`
      }, NG.icon(it.icon), h('span', null, it.label));
    });
    el.moreBtn = h('button', { type: 'button', class: 'tab', dataset: { route: '__more' }, onClick: openMore, 'aria-haspopup': 'dialog' },
      NG.icon('menu'), h('span', null, 'Ще'));
    return h('nav', { class: 'tabbar', 'aria-label': 'Розділи' }, items, el.moreBtn);
  }

  function openMore() {
    const inBar = new Set(NG.dict.mobileNav);
    let sh = null;
    const close = () => sh && sh.close();
    const groups = NG.dict.sections.map((g) => {
      const items = g.items.filter((it) => !inBar.has(it.id));
      if (!items.length) return null;
      return h('div', { class: 'nav-group' },
        h('div', { class: 'nav-group-label' }, g.group),
        items.map((it) => navItem(it, { onClick: close })));
    });
    const me = NG.session.state;
    sh = NG.ui.sheet({
      title: 'Ще',
      body: h('div', { class: 'more' },
        h('nav', { class: 'nav', 'aria-label': 'Інші розділи' }, groups),
        profileCard(me, close)),
      onClose: () => { sh = null; }
    });
    markActive(sh.el);
  }

  // ---------- Профіль і вихід ----------
  function profileCard(st, closeFn) {
    const p = NG.dict.people[st.person];
    return h('div', { class: 'profile-card' },
      h('div', { class: 'profile-card-head' },
        NG.ui.avatar(st.person, { size: 'lg' }),
        h('div', { class: 'profile-card-text' },
          h('div', { class: 'profile-card-name' }, p ? p.name : ''),
          h('div', { class: 'profile-card-mail' }, st.user ? st.user.email : ''))),
      h('div', { class: 'menu-list' },
        h('a', { class: 'menu-item', href: '#/settings', onClick: closeFn }, NG.icon('sliders', { size: 'sm' }), 'Налаштування'),
        h('button', {
          type: 'button', class: 'menu-item', onClick: async () => {
            closeFn();
            const ok = await NG.ui.confirm({
              title: 'Вийти з CRM?',
              text: 'На цьому пристрої CRM забуде вхід і збережену копію даних. Дані в базі нікуди не зникнуть — увійдеш знову, і вони повернуться.',
              confirmText: 'Вийти'
            });
            if (ok) NG.session.signOut();
          }
        }, NG.icon('logout', { size: 'sm' }), 'Вийти')),
      NG.pwa ? NG.pwa.versionLine() : null);
  }

  let profilePop = null;
  function openProfileMenu(anchor, placement) {
    if (profilePop) { profilePop.close(); return; }
    profilePop = NG.ui.popover(anchor, profileCard(NG.session.state, () => profilePop && profilePop.close()), {
      align: 'left', placement, className: 'popover-profile', onClose: () => { profilePop = null; }
    });
  }

  function updateProfile() {
    const st = NG.session.state;
    const p = NG.dict.people[st.person];
    el.profileAvatar.replaceChildren(NG.ui.avatar(st.person));
    el.profileName.textContent = p ? p.name : '';
  }

  // ---------- Активний пункт ----------
  function markActive(root) {
    const cur = NG.router.current ? NG.router.current.id : '';
    root.querySelectorAll('[data-route]').forEach((a) => {
      let on = a.dataset.route === cur;
      if (a.dataset.route === '__more') on = !NG.dict.mobileNav.includes(cur);
      a.classList.toggle('is-active', on);
      if (on && a.tagName === 'A') a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  // ---------- Збирання ----------
  function mount(app) {
    el.page = h('main', { class: 'page', id: 'page', tabIndex: -1 });
    el.fab = h('button', { type: 'button', class: 'fab', 'aria-label': 'Нове замовлення', onClick: () => NG.app.newOrder() }, NG.icon('plus', { size: 'lg', stroke: 2.2 }));
    el.app = h('div', { class: 'app' },
      buildSidebar(),
      h('div', { class: 'main' }, buildTopbar(), el.page),
      buildTabbar(),
      el.fab);
    NG.ui.mount(app, el.app);

    updateDate();
    updateTheme();
    updateProfile();
    unsubs.push(NG.router.onRender(() => markActive(el.app)));
    const onLook = () => updateTheme();
    document.addEventListener('ng:look', onLook);
    unsubs.push(() => document.removeEventListener('ng:look', onLook));
    unsubs.push(NG.session.on((st, what) => { if (what === 'people') updateProfile(); }));
    timer = setInterval(updateDate, 60 * 1000);
    NG.router.start(el.page);
  }

  function unmount() {
    unsubs.forEach((f) => f());
    unsubs = [];
    clearInterval(timer);
    NG.router.stop();
  }

  NG.shell = { mount, unmount, openProfileMenu };
})(window.NG);
