/* ==========================================================================
   js/clients/rollover.js — перехід клієнтів на наступний курс 1 вересня
   (ТЗ 9.5, 3.9, рішення П5 і П15). Спрацьовує, коли хтось відкриває CRM
   1 вересня чи пізніше:
   • 1–3 курс → +1; 1 курс магістратури → 2; 2 курс магістратури → «випустився»;
   • 4 курс → курс не змінюється, CRM питає: вступив у магістратуру чи випустився;
   • «Не переводити» — курс не змінюється, а галочка знімається (на один раз).
   Кожен клієнт переводиться рівно один раз: у записі є courseYear — рік,
   для якого вказано курс. Запис іде «транзакцією», тож якщо CRM відкриють
   одночасно Марко й Назік, двічі нікого не переведе. Без інтернету
   перехід чекає (транзакції потребують зв’язку) і спрацює пізніше.
   Оновлено: 30.10.2026 · Етап 1, крок 2
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const U = NG.utils;
  const C = () => NG.clients;
  const CHUNK = 100;
  const RETRY_MS = 10 * 60 * 1000;
  let running = null;
  let failedAt = 0;

  /** Записи історії для кроків переходу. */
  function entries(c, plan) {
    const out = [];
    plan.steps.forEach((s) => {
      const y = `${s.year}/${String(s.year + 1).slice(2)}`;
      if (s.kind === 'up') out.push(NG.store.entry('course-auto', [{ f: 'course', from: s.from, to: s.to }], { by: 'auto', year: y }));
      else if (s.kind === 'skip') out.push(NG.store.entry('course-skip', [{ f: 'noPromote', from: true, to: false }], { by: 'auto', year: y }));
      else if (s.kind === 'ask') out.push(NG.store.entry('course-ask', null, { by: 'auto', year: y }));
    });
    return out;
  }

  async function runChunk(db, ids, Y) {
    let moved = 0;
    await db.runTransaction(async (tx) => {
      moved = 0;
      const refs = ids.map((id) => db.collection('clients').doc(id));
      const snaps = [];
      for (const r of refs) snaps.push(await tx.get(r));
      snaps.forEach((snap, i) => {
        if (!snap.exists) return;
        const c = Object.assign(NG.store.plain(snap.data()) || {}, { id: snap.id });
        if (c.deletedAt) return;
        const plan = C().planRollover(c, Y);
        if (!plan) return;
        const hs = entries(c, plan);
        const data = Object.assign({}, plan.changes, { updatedAt: NG.fb.serverTime(), updatedBy: 'auto' });
        if (hs.length) data.history = NG.fb.arrayUnion(...hs);
        tx.update(refs[i], data);
        if (plan.steps.some((x) => x.kind === 'up')) moved++;
      });
    });
    return moved;
  }

  /** Перевірити й за потреби перевести. Кличеться, коли клієнти прийшли з бази чи змінилися, і опівночі. */
  function run() {
    if (running || !NG.store.synced('clients')) return running;
    if (failedAt && Date.now() - failedAt < RETRY_MS) return null; // не вдалося (немає зв’язку) — спробуємо згодом
    const Y = U.academicYear(U.today());
    const due = NG.store.list('clients').filter((c) => C().courseYearOf(c) < Y).map((c) => c.id);
    if (!due.length) return null;
    running = (async () => {
      const { db } = NG.fb.api;
      let moved = 0;
      try {
        for (let i = 0; i < due.length; i += CHUNK) moved += await runChunk(db, due.slice(i, i + CHUNK), Y);
        failedAt = 0;
        if (moved) {
          const ask = NG.store.list('clients').filter((c) => c.promoteAsk).length;
          NG.ui.toast(`1 вересня: курс оновлено в ${moved} ${U.plural(moved, ['клієнта', 'клієнтів', 'клієнтів'])}.` +
            (ask ? ' Після 4 курсу CRM питає про магістратуру — див. «Клієнти».' : ''), { duration: 9000 });
        }
      } catch (e) {
        // Немає зв’язку чи інша помилка — спробуємо при наступному відкритті / завтра
        failedAt = Date.now();
        console.warn('Перехід курсу відкладено:', e && (e.code || e.message));
      } finally {
        running = null;
      }
    })();
    return running;
  }

  /** Відповідь після 4 курсу: 'm1' (вступив у магістратуру) або 'grad' (випустився). */
  function answer(id, course) {
    const c = NG.store.get('clients', id);
    if (!c) return;
    const Y = U.academicYear(U.today());
    NG.store.update('clients', id, { course, promoteAsk: null, courseYear: Y },
      NG.store.entry('course-answer', [{ f: 'course', from: c.course || '', to: course }]));
  }

  function init() {
    NG.store.on('clients', () => { run(); });
    document.addEventListener('ng:daychange', () => { failedAt = 0; run(); });
  }

  NG.rollover = { init, run, answer };
})(window.NG);
