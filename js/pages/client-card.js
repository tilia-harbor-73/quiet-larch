/* ==========================================================================
   js/pages/client-card.js — картка клієнта (#/clients/<id>): ТЗ 9.1–9.2,
   статуси 9.3, «Чому проблемний» 9.4 (поки без рейтингу — етап 4),
   курс і питання після 4 курсу 9.5, особистий клієнт Марка 1.9,
   історія змін 1.5. Замовлення клієнта й сума оплат з’являться на кроці 3.
   Оновлено: 30.10.2026 · Етап 1, крок 2
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const { h } = NG.ui;
  const U = NG.utils;
  const C = () => NG.clients;
  const UI = () => NG.clientsUi;

  const HIST_TYPES = {
    create: () => 'створив картку',
    edit: () => 'змінив',
    'problem-set': () => 'позначив «проблемний»',
    'problem-unset': () => 'зняв «проблемний»',
    'course-auto': (e) => `перевів на наступний курс · 1 вересня, ${e.year}`,
    'course-skip': (e) => `не перевів: стояла галочка «Не переводити» · 1 вересня, ${e.year}`,
    'course-ask': (e) => `після 4 курсу — питання: магістратура чи випустився · ${e.year}`,
    'course-answer': () => 'відповів на питання після 4 курсу'
  };

  function personLine(by, at) {
    const p = NG.dict.people[by];
    return h('span', { class: 'person-line' }, p ? NG.ui.avatar(by, { size: 'sm' }) : null, h('span', null, p ? p.name : 'CRM'), at ? h('span', { class: 'muted' }, '· ' + U.dateTimeShort(at)) : null);
  }

  function section(title, body, opts) {
    const o = opts || {};
    return h('section', { class: 'csec' + (o.className ? ' ' + o.className : '') },
      h('h2', { class: 'csec-title' }, title, o.note ? h('span', { class: 'csec-note' }, o.note) : null),
      body);
  }

  function kv(label, value, empty) {
    return h('div', { class: 'kv' }, h('div', { class: 'kv-k' }, label), h('div', { class: 'kv-v' + (value ? '' : ' muted') }, value || empty || '—'));
  }

  // ---------- «Проблемний» (9.4) ----------
  function askReason(o) {
    return new Promise((resolve) => {
      const ta = NG.form.textarea({ rows: 3, maxlength: 1000, 'data-autofocus': '' });
      const f = NG.form.field({ label: 'Причина', control: ta, required: true });
      let result = null;
      const ok = NG.ui.button({
        label: o.confirm, variant: o.danger ? 'danger' : 'primary', onClick: () => {
          const r = ta.value.trim();
          if (!r) { f.setError('Напиши причину.'); return; }
          result = r;
          m.close();
        }
      });
      const m = NG.ui.modal({
        title: o.title, text: o.text, body: h('div', { class: 'form' }, f.el),
        footer: [NG.ui.button({ label: 'Скасувати', onClick: () => m.close() }), ok],
        onClose: () => resolve(result)
      });
      ta.focus();
    });
  }

  async function setProblem(c) {
    const reason = await askReason({
      title: 'Позначити «проблемний»?', confirm: 'Позначити', danger: true,
      text: `${C().fullName(c)}. Позначку видно в картці й у списку; знімається вона лише вручну.`
    });
    if (!reason) return;
    const by = NG.session.state.person;
    const at = new Date().toISOString();
    NG.store.update('clients', c.id, { problem: { reason, by, at } }, NG.store.entry('problem-set', null, { reason }));
  }

  async function unsetProblem(c) {
    const reason = await askReason({
      title: 'Зняти «проблемний»?', confirm: 'Зняти',
      text: 'Причина потрапить в історію змін. З етапу 4 рейтинг клієнта при цьому підніметься до 30%, якщо був нижчим (9.4).'
    });
    if (!reason) return;
    NG.store.update('clients', c.id, { problem: null }, NG.store.entry('problem-unset', null, { reason }));
  }

  function problemBlock(c) {
    const p = c.problem;
    return h('section', { class: 'problem-block', id: 'problem' },
      h('div', { class: 'problem-head' }, NG.icon('alert', { size: 'sm' }), h('h2', { class: 'csec-title' }, 'Чому проблемний')),
      kv('Причина', p.reason),
      kv('Поставив', personLine(p.by, p.at)),
      kv('Події з журналу рейтингу', null, 'З’являться на етапі 4 разом із рейтингом класності.'),
      h('div', { class: 'problem-actions' }, NG.ui.button({ label: 'Зняти «проблемний»', size: 'sm', onClick: () => unsetProblem(c) })));
  }

  // ---------- Блоки ----------
  function contacts(c) {
    const tg = C().telegramUrl(c.telegram);
    const phoneHref = c.phone ? 'tel:' + c.phone.replace(/[^\d+]/g, '') : null;
    return section('Контакти', h('div', { class: 'kv-list' },
      kv('Telegram', c.telegram ? (tg ? h('a', { href: tg, target: '_blank', rel: 'noopener noreferrer' }, c.telegram) : c.telegram) : null),
      kv('Телефон', c.phone ? h('a', { href: phoneHref }, c.phone) : null),
      kv('Корпоративна пошта', c.email ? h('a', { href: 'mailto:' + c.email }, c.email) : null)));
  }

  function study(c) {
    const Y = C().courseYearOf(c);
    return section('Навчання', h('div', { class: 'kv-list' },
      kv('Курс', c.course ? h('span', null, C().courseLabel(c.course),
        c.course !== 'grad' ? h('span', { class: 'muted' }, ` · ${Y}/${String(Y + 1).slice(2)}`) : null) : null, 'не вказано'),
      c.noPromote ? kv('«Не переводити»', '1 вересня курс не зміниться (галочка потім зніметься сама)') : null,
      kv('Академічна група', c.group),
      kv('Спеціальність', c.specialty)));
  }

  function origin(c) {
    let who = null;
    if (c.broughtBy === 'marko' || c.broughtBy === 'nazik') who = h('span', { class: 'person-line' }, NG.ui.avatar(c.broughtBy, { size: 'sm' }), NG.dict.people[c.broughtBy].name);
    else if (c.broughtBy === 'client') {
      const r = c.referrerId ? NG.store.get('clients', c.referrerId) : null;
      who = h('span', null, 'Інший клієнт: ', r && !r.deletedAt ? h('a', { href: '#/clients/' + r.id }, C().fullName(r)) : h('span', { class: 'muted' }, 'не вказано'));
    } else if (c.broughtBy === 'self') who = 'Прийшов сам';
    return section('Звідки клієнт', h('div', { class: 'kv-list' },
      kv('Хто привів', who),
      kv('Особистий клієнт Марка', c.personal ? 'так — працює з Марком напряму; роботи виконує лише Марко' : 'ні')));
  }

  function orders(c, s) {
    return section('Замовлення', h('div', null,
      h('div', { class: 'kv-list kv-inline' },
        kv('Замовлень', String(s.count)),
        kv('Останнє звернення', U.dateShort(s.lastContact)),
        kv('Оплачено разом', s.paid.USD || s.paid.UAH
          ? [s.paid.UAH ? s.paid.UAH + ' грн' : '', s.paid.USD ? '$' + s.paid.USD : ''].filter(Boolean).join(' · ')
          : null, '—')),
      h('div', { class: 'placeholder' }, NG.icon('orders', { size: 'sm' }),
        h('span', null, 'Замовлення клієнта, «Повторити замовлення» й сума оплат з’являться на кроці 3 етапу 1.'))));
  }

  // ---------- Сторінка ----------
  function render(container, id) {
    let problemOpen = false; // блок «Чому проблемний» відкривається кліком на позначку (9.4)

    function draw() {
      const c = NG.store.get('clients', id);
      const back = h('a', { class: 'back-link', href: '#/clients' }, NG.icon('arrowLeft', { size: 'sm' }), 'Клієнти');
      if (!c || c.deletedAt) {
        NG.ui.mount(container, back, NG.store.loaded('clients') && (NG.store.synced('clients') || c)
          ? h('div', { class: 'empty' }, h('div', { class: 'empty-title' }, 'Клієнта не знайдено'), h('p', { class: 'muted' }, 'Можливо, його видалили або посилання неправильне.'))
          : h('div', { class: 'empty-small' }, NG.icon('loader', { size: 'lg', className: 'spin' }), h('div', null, 'Завантажую…')));
        return;
      }
      document.title = C().fullName(c) + ' · NewGen';
      const s = C().stats(c);
      const problemBtn = h('button', {
        type: 'button', class: 'chip-hot chip-sm chip-btn', 'aria-expanded': problemOpen ? 'true' : 'false', 'aria-controls': 'problem',
        title: 'Чому проблемний', onClick: () => { problemOpen = !problemOpen; draw(); }
      }, 'проблемний');

      const head = h('header', { class: 'client-head' },
        UI().clientAvatar(c, 'xl'),
        h('div', { class: 'client-head-main' },
          h('h1', { class: 'page-title client-title' }, C().fullName(c)),
          h('div', { class: 'client-head-sub' }, UI().subLine(c) || 'курс і група не вказані'),
          h('div', { class: 'client-head-tags' }, UI().statusLine(s, { problemButton: problemBtn }),
            c.personal ? h('span', { class: 'tag-personal' }, 'особистий клієнт Марка') : null,
            (c.tags || []).map((t) => h('span', { class: 'tag tag-plain' }, t)))),
        h('div', { class: 'client-head-actions' },
          NG.ui.button({ label: 'Редагувати', icon: 'pencil', onClick: () => NG.clientForm.open(c) }),
          !c.problem ? NG.ui.button({ label: '«Проблемний»', icon: 'alert', className: 'btn-quiet', title: 'Позначити «проблемний»', onClick: () => setProblem(c) }) : null));

      const ask = c.promoteAsk ? h('div', { class: 'callout callout-ask' }, NG.icon('info'),
        h('span', { class: 'callout-text' }, '1 вересня клієнт закінчив 4 курс. Вступив у магістратуру чи випустився?'),
        h('span', { class: 'callout-actions' },
          NG.ui.button({ label: 'Вступив у магістратуру', size: 'sm', onClick: () => NG.rollover.answer(c.id, 'm1') }),
          NG.ui.button({ label: 'Випустився', size: 'sm', onClick: () => NG.rollover.answer(c.id, 'grad') }))) : null;

      const created = c.history && c.history.find((e) => e.type === 'create');
      NG.ui.mount(container,
        back, head, ask,
        c.problem && problemOpen ? problemBlock(c) : null,
        h('div', { class: 'client-grid' },
          h('div', { class: 'client-col-main' },
            orders(c, s),
            section('Історія змін', NG.history.block(c, { fields: NG.clientForm.HIST_FIELDS, types: HIST_TYPES }), { className: 'csec-history' })),
          h('div', { class: 'client-col-side' },
            contacts(c), study(c), origin(c),
            section('Попередній досвід', h('p', { class: 'prewrap' + (c.experience ? '' : ' muted') }, c.experience || '—')),
            section('Рейтинг класності й бонуси', h('p', { class: 'muted' }, 'З’являться на етапі 4.')),
            created ? h('div', { class: 'client-created' }, 'Картку створив ', personLine(created.by, created.at)) : null)));
    }

    draw();
    const off = NG.store.on('clients', draw);
    const offO = NG.store.on('orders', draw);
    return () => { off(); offO(); };
  }

  NG.clientCard = { render };
})(window.NG);
