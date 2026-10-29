/* ==========================================================================
   js/clients/form.js — форма «Новий клієнт» / «Редагувати клієнта»
   (картка 9.2 без рейтингу й бонусів — вони на етапі 4; 1.9; 9.5;
   «Хто порекомендував» — рішення П13). Кожна зміна йде в історію (1.5).
   Оновлено: 30.10.2026 · Етап 1, крок 2
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const { h } = NG.ui;
  const F = NG.form;
  const U = NG.utils;
  const C = () => NG.clients;

  // Поля, зміни яких пишуться в історію (підписи — для блоку «Історія змін»)
  const FIELDS = ['lastName', 'firstName', 'middleName', 'group', 'course', 'noPromote', 'specialty',
    'telegram', 'phone', 'email', 'broughtBy', 'referrerId', 'personal', 'experience', 'tags'];

  const yesNo = (v) => (v ? 'так' : 'ні');
  const HIST_FIELDS = {
    lastName: { label: 'Прізвище' },
    firstName: { label: 'Ім’я' },
    middleName: { label: 'По батькові' },
    group: { label: 'Група' },
    course: { label: 'Курс', fmt: (v) => C().courseLabel(v) || 'не вказано' },
    noPromote: { label: '«Не переводити»', fmt: yesNo },
    specialty: { label: 'Спеціальність' },
    telegram: { label: 'Telegram' },
    phone: { label: 'Телефон' },
    email: { label: 'Корпоративна пошта' },
    broughtBy: { label: 'Хто привів', fmt: (v) => C().label(C().BROUGHT, v) },
    referrerId: { label: 'Хто порекомендував', fmt: (v) => { const r = NG.store.get('clients', v); return r ? C().fullName(r) : 'клієнт (видалено)'; } },
    personal: { label: 'Особистий клієнт Марка', fmt: yesNo },
    experience: { label: 'Попередній досвід' },
    tags: { label: 'Мітки', fmt: (v) => v.join(', ') },
    problem: { label: '«Проблемний»', fmt: () => 'так' },
    promoteAsk: { label: 'Питання після 4 курсу', fmt: (v) => (v ? 'чекає відповіді' : 'немає') }
  };

  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

  function datalist(id, values) {
    return h('datalist', { id }, values.map((v) => h('option', { value: v })));
  }

  /** Відкрити форму. c — наявний клієнт (редагування) або нічого (новий). */
  function open(c) {
    const all = NG.store.list('clients');
    const edit = !!c;
    const v = c || {};
    const Y = U.academicYear(U.today());

    const lastName = F.input({ name: 'lastName', value: v.lastName || '', autocomplete: 'off', maxlength: 60, 'data-autofocus': '' });
    const firstName = F.input({ name: 'firstName', value: v.firstName || '', maxlength: 60 });
    const middleName = F.input({ name: 'middleName', value: v.middleName || '', maxlength: 60 });
    const group = F.input({ name: 'group', value: v.group || '', list: 'dl-group', maxlength: 40, placeholder: 'напр., ФФП-38с' });
    const course = F.select({ name: 'course', value: v.course || '', empty: 'не вказано', options: C().COURSES });
    const specialty = F.input({ name: 'specialty', value: v.specialty || '', list: 'dl-specialty', maxlength: 80, placeholder: 'напр., Психологія' });
    const noPromote = F.checkbox({ name: 'noPromote', label: 'Не переводити', checked: v.noPromote, hint: 'Академвідпустка чи повторний курс: 1 вересня курс не зміниться, а галочка зніметься сама.' });
    const telegram = F.input({ name: 'telegram', value: v.telegram || '', maxlength: 80, placeholder: '@нікнейм' });
    const phone = F.input({ name: 'phone', value: v.phone || '', type: 'tel', maxlength: 30, placeholder: '+380 67 123 45 67' });
    const email = F.input({ name: 'email', value: v.email || '', type: 'email', maxlength: 120, placeholder: 'name@lnu.edu.ua' });
    const others = all.filter((x) => !c || x.id !== c.id)
      .map((x) => ({ id: x.id, label: C().fullName(x), sub: [C().courseLabel(x.course), x.group].filter(Boolean).join(' · ') }))
      .sort((a, b) => a.label.localeCompare(b.label, 'uk'));
    const referrer = F.picker({ items: others, value: v.referrerId || '', placeholder: 'Почни вводити ім’я клієнта', label: 'Хто порекомендував' });
    const fReferrer = F.field({ label: 'Хто порекомендував', control: referrer, required: true, wide: true, hint: 'Наявний клієнт. Якщо його ще немає в CRM — спершу додай його.' });
    const broughtBy = F.segmented({
      value: v.broughtBy || '', options: C().BROUGHT, label: 'Хто привів',
      onChange: (val) => { fReferrer.el.hidden = val !== 'client'; }
    });
    fReferrer.el.hidden = broughtBy.value !== 'client';
    const personal = F.checkbox({ name: 'personal', label: 'Особистий клієнт Марка', checked: v.personal, hint: 'Працює з Марком напряму, без «Марти»; роботи виконує лише Марко.' });
    const experience = F.textarea({ name: 'experience', rows: 3, maxlength: 2000 });
    experience.value = v.experience || '';
    const tags = F.tags({ value: v.tags || [], suggestions: C().values(all, 'tags'), label: 'Ручні мітки' });

    const fLast = F.field({ label: 'Прізвище', control: lastName });
    const fFirst = F.field({ label: 'Ім’я', control: firstName });
    const fBrought = F.field({ label: 'Хто привів', control: broughtBy, required: true, wide: true });
    const fPhone = F.field({ label: 'Телефон', control: phone });
    const fEmail = F.field({ label: 'Корпоративна пошта', control: email });

    const form = h('form', { class: 'form', novalidate: true },
      h('fieldset', { class: 'form-sec' },
        h('legend', { class: 'form-legend' }, 'ПІБ для титульної сторінки'),
        h('div', { class: 'form-grid form-grid-3' }, fLast.el, fFirst.el, F.field({ label: 'По батькові', control: middleName }).el)),
      h('fieldset', { class: 'form-sec' },
        h('legend', { class: 'form-legend' }, 'Навчання'),
        h('div', { class: 'form-grid form-grid-3' },
          F.field({ label: 'Академічна група', control: group }).el,
          F.field({ label: 'Курс', control: course, hint: `На ${Y}/${String(Y + 1).slice(2)} навчальний рік. 1 вересня CRM додасть +1.` }).el,
          F.field({ label: 'Спеціальність', control: specialty }).el),
        noPromote),
      h('fieldset', { class: 'form-sec' },
        h('legend', { class: 'form-legend' }, 'Контакти'),
        h('div', { class: 'form-grid form-grid-3' }, F.field({ label: 'Telegram', control: telegram }).el, fPhone.el, fEmail.el)),
      h('fieldset', { class: 'form-sec' },
        h('legend', { class: 'form-legend' }, 'Звідки клієнт'),
        h('div', { class: 'form-grid' }, fBrought.el, fReferrer.el),
        personal),
      h('fieldset', { class: 'form-sec' },
        h('legend', { class: 'form-legend' }, 'Інше'),
        h('div', { class: 'form-grid' },
          F.field({ label: 'Попередній досвід', control: experience, wide: true }).el,
          F.field({ label: 'Ручні мітки', control: tags, wide: true, hint: 'Enter або кома — додати мітку.' }).el)),
      datalist('dl-group', C().values(all, 'group')),
      datalist('dl-specialty', C().values(all, 'specialty')),
      h('button', { type: 'submit', hidden: true, tabIndex: -1 }));

    function read() {
      const t = (el) => el.value.trim().replace(/\s+/g, ' ');
      return {
        lastName: t(lastName), firstName: t(firstName), middleName: t(middleName),
        group: t(group), course: course.value, specialty: t(specialty), noPromote: noPromote.input.checked,
        telegram: t(telegram), phone: t(phone), email: t(email).toLowerCase(),
        broughtBy: broughtBy.value, referrerId: broughtBy.value === 'client' ? referrer.value || null : null,
        personal: personal.input.checked, experience: experience.value.trim(), tags: tags.value
      };
    }

    function validate(d) {
      [fLast, fFirst, fBrought, fReferrer, fPhone, fEmail].forEach((f) => f.setError(''));
      if (!d.lastName && !d.firstName) { fLast.setError('Вкажи прізвище або ім’я.'); return false; }
      const pd = U.digits(d.phone);
      if (d.phone && (pd.length < 9 || pd.length > 15)) { fPhone.setError('Перевір номер: напр., +380 67 123 45 67.'); return false; }
      if (d.email && !isEmail(d.email)) { fEmail.setError('Перевір адресу пошти.'); return false; }
      if (!d.broughtBy) { fBrought.setError('Обери, хто привів клієнта.'); return false; }
      if (d.broughtBy === 'client' && !d.referrerId) { fReferrer.setError('Обери, хто порекомендував.'); return false; }
      return true;
    }

    function save(e) {
      if (e) e.preventDefault();
      const d = read();
      if (!validate(d)) return;
      if (!edit) {
        const id = NG.store.create('clients', Object.assign(d, { courseYear: Y, promoteAsk: null, problem: null }));
        m.close();
        NG.ui.toast(`Клієнта «${C().fullName(d)}» додано.`);
        NG.router.go('clients', id);
        return;
      }
      const changes = {};
      const diff = NG.history.diff(c, d, FIELDS);
      diff.forEach((x) => { changes[x.f] = d[x.f]; });
      if (!diff.length) { m.close(); return; }
      if ('course' in changes) {
        // Курс ввели вручну — він на поточний навчальний рік; питання після 4 курсу вже не актуальне
        changes.courseYear = Y;
        if (c.promoteAsk) { changes.promoteAsk = null; diff.push({ f: 'promoteAsk', from: c.promoteAsk, to: null }); }
      }
      NG.store.update('clients', c.id, changes, NG.store.entry('edit', diff));
      m.close();
      NG.ui.toast('Зміни збережено.');
    }

    form.addEventListener('submit', save);
    const m = NG.ui.modal({
      title: edit ? 'Редагувати клієнта' : 'Новий клієнт', className: 'modal-form', body: form,
      footer: [NG.ui.button({ label: 'Скасувати', onClick: () => m.close() }), NG.ui.button({ label: edit ? 'Зберегти' : 'Додати клієнта', variant: 'primary', onClick: save })]
    });
    lastName.focus();
    return m;
  }

  NG.clientForm = { open, FIELDS, HIST_FIELDS };
})(window.NG);
