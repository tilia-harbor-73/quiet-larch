/* ==========================================================================
   js/clients/model.js — клієнти: довідники, статуси, перехід курсу,
   «Кому скоро курсова», пошук і фільтри (ТЗ 9.1–9.7, 1.9).
   Тут лише розрахунки, без екранів.

   Запис клієнта (колекція clients):
     lastName, firstName, middleName — ПІБ для титульної сторінки (9.2)
     group, specialty — академічна група, спеціальність
     course — '' | b1 b2 b3 b4 (бакалаврат) | m1 m2 (магістратура) | grad (випустився)
     courseYear — навчальний рік, для якого вказано курс (2026 = 2026/27)
     noPromote — «Не переводити» (9.5; на один раз — рішення П15)
     promoteAsk — рік, коли після 4 курсу CRM чекає відповіді (9.5)
     telegram, phone, email — контакти й корпоративна пошта
     broughtBy — marko | nazik | client | self; referrerId — хто порекомендував (П13)
     personal — «особистий клієнт Марка» (1.9)
     experience — попередній досвід; tags — ручні мітки
     problem — { reason, by, at } або null (9.4, поки лише вручну)
     history — історія змін (1.5), createdAt / updatedAt / deletedAt — службові

   Замовлення з’являться на кроці 3. Щоб статуси вже зараз рахувалися
   правильно, тут домовлено про їхні поля: clientId, status (new, agreed,
   in_work, waiting, revisions, submitted, paid, closed, postponed,
   cancelled, failed — 8.7), cancelledAfterStart, recordDate (дата запису),
   kind (course — курсова чи диплом, science — наукова), dueBy («Здача до»),
   topic (тема), payments ([{ amount, currency }]).
   Оновлено: 30.10.2026 · Етап 1, крок 2
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const U = NG.utils;

  const COURSES = [
    { id: 'b1', label: '1 курс' },
    { id: 'b2', label: '2 курс' },
    { id: 'b3', label: '3 курс' },
    { id: 'b4', label: '4 курс' },
    { id: 'm1', label: '1 курс магістратури' },
    { id: 'm2', label: '2 курс магістратури' },
    { id: 'grad', label: 'випустився' }
  ];
  // Наступний курс 1 вересня (9.5; 2 курс магістратури → «випустився» — рішення П5)
  const NEXT = { b1: 'b2', b2: 'b3', b3: 'b4', m1: 'm2', m2: 'grad' };

  // ТЗ 9.2: хто привів
  const BROUGHT = [
    { id: 'marko', label: 'Марко' },
    { id: 'nazik', label: 'Назік' },
    { id: 'client', label: 'Інший клієнт' },
    { id: 'self', label: 'Прийшов сам' }
  ];

  // ТЗ 9.3: дві шкали
  const ORDER_SCALE = [
    { id: 'request', label: 'запит' },
    { id: 'new', label: 'новий' },
    { id: 'returned', label: 'повернувся' },
    { id: 'regular', label: 'постійний' }
  ];
  const ACTIVITY = [
    { id: 'active', label: 'активний' },
    { id: 'between', label: 'між замовленнями' },
    { id: 'sleeping', label: 'сплячий' }
  ];
  // «Замовлення в роботі» — будь-яке незавершене (рішення П4)
  const IN_WORK = ['new', 'agreed', 'in_work', 'waiting', 'revisions', 'submitted'];

  const label = (list, id) => (list.find((x) => x.id === id) || {}).label || '';
  const courseLabel = (id) => label(COURSES, id);

  // ---------- Імена ----------
  function fullName(c) {
    return [c.lastName, c.firstName, c.middleName].map((s) => String(s || '').trim()).filter(Boolean).join(' ') || 'Без імені';
  }
  /** Ініціали для кружечка: прізвище + ім’я ('Коваль Олена' → 'КО'). */
  function initials(c) {
    const a = [c.lastName, c.firstName].map((s) => String(s || '').trim()).filter(Boolean);
    return (a.map((s) => s.charAt(0)).join('') || '?').toUpperCase().slice(0, 2);
  }
  /** Для сортування: прізвище, ім’я, по батькові. */
  const sortKey = (c) => U.norm(fullName(c));

  // ---------- Замовлення клієнта (з кроку 3) ----------
  function ordersOf(clientId) {
    return NG.store.list('orders').filter((o) => o.clientId === clientId);
  }
  /** Усі замовлення, згруповані за клієнтом: Map(clientId → [замовлення]) — щоб не перебирати їх для кожного клієнта. */
  function ordersIndex() {
    const m = new Map();
    NG.store.list('orders').forEach((o) => { if (!m.has(o.clientId)) m.set(o.clientId, []); m.get(o.clientId).push(o); });
    return m;
  }
  /** Рахується в шкалі «Замовлення»: усе, крім «не відбулось» і скасованих до початку роботи (9.3). */
  const counted = (o) => o.status !== 'failed' && !(o.status === 'cancelled' && !o.cancelledAfterStart);

  function paidOf(orders) {
    const sum = { USD: 0, UAH: 0 };
    orders.forEach((o) => (o.payments || []).forEach((p) => {
      if (p && sum[p.currency] != null) sum[p.currency] += Number(p.amount) || 0;
    }));
    return sum;
  }

  /**
   * Статуси клієнта на дату today (9.3, рішення П4 і П14):
   * { count, orderScale, activity, lastContact, inWork, problem, kinds, paid }.
   */
  function stats(c, ordersIn, todayIn) {
    const today = todayIn || U.today();
    const orders = (ordersIn || ordersOf(c.id)).filter((o) => !o.deletedAt);
    const count = orders.filter(counted).length;
    const orderScale = count === 0 ? 'request' : count === 1 ? 'new' : count === 2 ? 'returned' : 'regular';
    const inWork = orders.filter((o) => IN_WORK.includes(o.status)).length;
    // Останнє звернення — дата запису найновішого замовлення чи запиту, включно з «не відбулось» (П4);
    // поки немає ні замовлень, ні запитів — день створення картки (П14)
    let lastContact = '';
    orders.forEach((o) => { if (o.recordDate && o.recordDate > lastContact) lastContact = o.recordDate; });
    if (!lastContact) lastContact = U.kyivDay(c.createdAt) || today;
    let activity;
    if (inWork) activity = 'active';
    else activity = today < U.addMonths(lastContact, 3) ? 'between' : 'sleeping';
    const kinds = {
      course: orders.some((o) => counted(o) && o.kind === 'course'),
      science: orders.some((o) => counted(o) && o.kind === 'science')
    };
    return { count, orderScale, activity, lastContact, inWork, problem: !!c.problem, kinds, paid: paidOf(orders) };
  }

  /** «Кому скоро курсова» (9.7, рішення П16): курсову здали, нової ще немає. */
  function soonCourse(c, ordersIn, todayIn) {
    if (c.course === 'grad') return false;
    const today = todayIn || U.today();
    const course = (ordersIn || ordersOf(c.id)).filter((o) => !o.deletedAt && o.kind === 'course' && o.dueBy);
    const had = course.some((o) => counted(o) && o.dueBy < today);
    const ahead = course.some((o) => o.status !== 'failed' && o.status !== 'cancelled' && o.dueBy >= today);
    return had && !ahead;
  }

  // ---------- Перехід на наступний курс 1 вересня (9.5, П5, П15) ----------
  /** Навчальний рік, для якого вказано курс клієнта. */
  function courseYearOf(c) {
    if (c.courseYear != null) return c.courseYear;
    return U.academicYear(U.kyivDay(c.createdAt) || U.today());
  }

  /**
   * Що зробити з клієнтом на навчальний рік Y: null — нічого,
   * інакше { changes, steps } (steps — для історії змін).
   * Пропущені роки (CRM довго не відкривали) проходяться по черзі.
   */
  function planRollover(c, Y) {
    let year = courseYearOf(c);
    if (year >= Y) return null;
    let course = c.course || '';
    let noPromote = !!c.noPromote;
    let ask = c.promoteAsk || null;
    const steps = [];
    while (year < Y) {
      year += 1;
      if (noPromote) { noPromote = false; steps.push({ kind: 'skip', year }); continue; } // «Не переводити» — на один раз
      if (ask) continue;                                // після 4 курсу ще чекаємо відповіді
      if (course === 'b4') { ask = year; steps.push({ kind: 'ask', year }); continue; }
      const next = NEXT[course];
      if (next) { steps.push({ kind: 'up', year, from: course, to: next }); course = next; }
    }
    const changes = { courseYear: Y };
    if (course !== (c.course || '')) changes.course = course;
    if (noPromote !== !!c.noPromote) changes.noPromote = noPromote;
    if (ask !== (c.promoteAsk || null)) changes.promoteAsk = ask;
    return { changes, steps };
  }

  // ---------- Пошук (9.6) ----------
  function haystack(c, orders) {
    const parts = [c.lastName, c.firstName, c.middleName, c.group, c.telegram, String(c.telegram || '').replace(/^@/, ''), c.phone, c.email];
    (orders || []).forEach((o) => { if (o.topic) parts.push(o.topic); });
    return U.norm(parts.filter(Boolean).join(' | '));
  }

  /** Чи підходить клієнт під рядок пошуку: кожне слово має знайтися (ім’я, прізвище, група, Telegram, телефон, пошта, тема). */
  function matches(c, query, ordersIn) {
    const q = U.norm(query);
    if (!q) return true;
    const orders = ordersIn || ordersOf(c.id);
    const hay = haystack(c, orders);
    const phone = U.digits(c.phone);
    return q.split(' ').every((w) => {
      const t = w.replace(/^@/, '');
      if (hay.includes(t)) return true;
      // Телефон шукаємо за цифрами: «067 123», «+38067…», «(067)» — однаково
      const d = U.digits(w);
      return /^[\d()+-]+$/.test(w) && d.length >= 3 && phone.includes(d);
    });
  }

  // ---------- Фільтри (9.7) ----------
  const EMPTY_FILTER = {
    soon: false, orderScale: [], activity: [], problem: '', countFrom: '', countTo: '', lastFrom: '', lastTo: '',
    course: [], group: [], specialty: [], broughtBy: [], kind: '', tags: []
  };

  function activeCount(f) {
    let n = 0;
    ['orderScale', 'activity', 'course', 'group', 'specialty', 'broughtBy', 'tags'].forEach((k) => { if (f[k] && f[k].length) n++; });
    ['problem', 'kind'].forEach((k) => { if (f[k]) n++; });
    if (f.countFrom !== '' || f.countTo !== '') n++;
    if (f.lastFrom || f.lastTo) n++;
    return n;
  }

  /** Чи проходить клієнт фільтр f; s — його stats(). */
  function passes(c, s, f, orders, today) {
    if (f.soon && !soonCourse(c, orders, today)) return false;
    if (f.orderScale.length && !f.orderScale.includes(s.orderScale)) return false;
    if (f.activity.length && !f.activity.includes(s.activity)) return false;
    if (f.problem === 'yes' && !s.problem) return false;
    if (f.problem === 'no' && s.problem) return false;
    if (f.countFrom !== '' && s.count < Number(f.countFrom)) return false;
    if (f.countTo !== '' && s.count > Number(f.countTo)) return false;
    if (f.lastFrom && s.lastContact < f.lastFrom) return false;
    if (f.lastTo && s.lastContact > f.lastTo) return false;
    if (f.course.length && !f.course.includes(c.course || '')) return false;
    if (f.group.length && !f.group.includes(String(c.group || '').trim())) return false;
    if (f.specialty.length && !f.specialty.includes(String(c.specialty || '').trim())) return false;
    if (f.broughtBy.length && !f.broughtBy.includes(c.broughtBy)) return false;
    if (f.kind === 'course' && !s.kinds.course) return false;
    if (f.kind === 'science' && !s.kinds.science) return false;
    if (f.tags.length && !(c.tags || []).some((t) => f.tags.includes(t))) return false;
    return true;
  }

  // Сортування (у тому числі за загальною сумою оплат — 9.7; гривні й долари окремо — 1.4)
  const SORTS = [
    { id: 'last', label: 'Останнє звернення — нові спершу' },
    { id: 'name', label: 'ПІБ, А–Я' },
    { id: 'count', label: 'Кількість замовлень — більше спершу' },
    { id: 'paidUSD', label: 'Сума оплат у доларах — більше спершу' },
    { id: 'paidUAH', label: 'Сума оплат у гривнях — більше спершу' }
  ];
  const collator = new Intl.Collator('uk');
  function sorter(id) {
    const byName = (a, b) => collator.compare(sortKey(a.c), sortKey(b.c));
    switch (id) {
      case 'name': return byName;
      case 'count': return (a, b) => b.s.count - a.s.count || byName(a, b);
      case 'paidUSD': return (a, b) => b.s.paid.USD - a.s.paid.USD || byName(a, b);
      case 'paidUAH': return (a, b) => b.s.paid.UAH - a.s.paid.UAH || byName(a, b);
      default: return (a, b) => b.s.lastContact.localeCompare(a.s.lastContact) || byName(a, b);
    }
  }

  /** Унікальні значення поля серед клієнтів (для підказок і фільтрів), за абеткою. */
  function values(clients, field) {
    const set = new Set();
    clients.forEach((c) => {
      const v = c[field];
      if (Array.isArray(v)) v.forEach((x) => { if (String(x).trim()) set.add(String(x).trim()); });
      else if (String(v || '').trim()) set.add(String(v).trim());
    });
    return Array.from(set).sort((a, b) => collator.compare(a, b));
  }

  /** Посилання на Telegram: '@olena_k' або 't.me/olena_k' → 'https://t.me/olena_k'. */
  function telegramUrl(v) {
    const s = String(v || '').trim();
    const m = /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{3,})\/?$/.exec(s) || /^@?([A-Za-z][A-Za-z0-9_]{3,})$/.exec(s);
    return m ? 'https://t.me/' + m[1] : null;
  }

  NG.clients = {
    COURSES, BROUGHT, ORDER_SCALE, ACTIVITY, IN_WORK, SORTS, EMPTY_FILTER,
    label, courseLabel, fullName, initials, sortKey, ordersOf, ordersIndex, counted, stats, soonCourse,
    courseYearOf, planRollover, matches, activeCount, passes, sorter, values, telegramUrl
  };
})(window.NG);
