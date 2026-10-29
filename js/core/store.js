/* ==========================================================================
   js/core/store.js — спільні дані CRM (клієнти, далі — замовлення й задачі)
   з бази Firestore.

   Як економимо читання бази (ТЗ 26.9, рішення кроку 1):
   • при відкритті CRM усе, що пристрій уже бачив, береться з локальної
     копії Firestore на пристрої (кеш, без читань бази);
   • з бази дочитується лише змінене — записи з полем updatedAt, новішим
     за найновіший запис у кеші (із запасом 10 хвилин);
   • раз на добу на кожному пристрої — повне звіряння колекції (на випадок,
     якщо кеш щось загубив).
   Тож кожен запис має поле updatedAt (час сервера), а видалення —
   «м’яке» (поле deletedAt; кошик — крок 5), щоб воно теж дійшло до
   іншого пристрою як зміна.

   Історія змін (ТЗ 1.5) — масив history у самому записі: хто, що і коли
   змінив. Додається через arrayUnion, тож одночасні зміни Марка й Назіка
   одна одну не затирають.

   Зміни показуються на екрані одразу, не чекаючи відповіді бази; без
   інтернету вони чекають у Firestore і надсилаються, щойно з’явиться зв’язок.
   Оновлено: 30.10.2026 · Етап 1, крок 2
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const U = NG.utils;
  const FULL_EVERY = 24 * 3600 * 1000;  // повне звіряння — раз на добу
  const MARGIN = 10 * 60 * 1000;        // запас для «змінено після…»
  const cols = new Map();               // назва колекції → стан

  // ---------- Перетворення даних із бази ----------
  /** Мітки часу Firestore → ISO-рядок; решта — як є (рекурсивно). */
  function plain(v) {
    if (v == null) return v;
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    if (Array.isArray(v)) return v.map(plain);
    if (typeof v === 'object') {
      const o = {};
      Object.keys(v).forEach((k) => { o[k] = plain(v[k]); });
      return o;
    }
    return v;
  }

  function fromDoc(doc) {
    return Object.assign(plain(doc.data({ serverTimestamps: 'estimate' })) || {}, { id: doc.id });
  }

  const ms = (iso) => { const t = iso ? Date.parse(iso) : NaN; return isNaN(t) ? 0 : t; };

  // ---------- Стан колекції ----------
  function state(name) {
    let st = cols.get(name);
    if (!st) {
      st = { name, map: new Map(), loaded: false, synced: false, error: null, unsub: null, listeners: new Set(), ready: null, queued: false };
      cols.set(name, st);
    }
    return st;
  }

  function emit(st) {
    if (st.queued) return;
    st.queued = true;
    queueMicrotask(() => {
      st.queued = false;
      st.listeners.forEach((fn) => { try { fn(st.name); } catch (e) { console.error(e); } });
      document.dispatchEvent(new CustomEvent('ng:data', { detail: { name: st.name } }));
    });
  }

  /** Підключити колекцію: спершу кеш пристрою, потім лише зміни з бази. */
  function open(name) {
    const st = state(name);
    if (st.ready) return st.ready;
    st.ready = (async () => {
      const { db } = await NG.fb.ready();
      const ref = db.collection(name);
      let maxMs = 0;
      try {
        const snap = await ref.get({ source: 'cache' });
        snap.forEach((d) => {
          const r = fromDoc(d);
          st.map.set(d.id, r);
          if (!d.metadata.hasPendingWrites) maxMs = Math.max(maxMs, ms(r.updatedAt));
        });
      } catch (e) { /* кешу ще немає — усе прийде з бази */ }
      st.loaded = true;
      emit(st);

      const uid = (NG.session.state.user || {}).uid || 'x';
      const fullKey = `sync.${uid}.${name}`;
      const full = !maxMs || Date.now() - (U.ls.get(fullKey, 0) || 0) > FULL_EVERY;
      const q = full ? ref : ref.where('updatedAt', '>=', NG.fb.timestamp(maxMs - MARGIN));
      st.unsub = q.onSnapshot({ includeMetadataChanges: true }, (snap) => {
        let changed = false;
        snap.docChanges().forEach((c) => {
          if (c.type === 'removed') {
            // У запиті «змінено після…» запис «зникає», поки його нова зміна летить до бази, — це не видалення
            if (full) { st.map.delete(c.doc.id); changed = true; }
            return;
          }
          st.map.set(c.doc.id, fromDoc(c.doc));
          changed = true;
        });
        if (!snap.metadata.fromCache && !st.synced) {
          st.synced = true;
          st.error = null;
          if (full) U.ls.set(fullKey, Date.now());
          changed = true;
        }
        if (changed) emit(st);
      }, (e) => {
        console.error(name, e);
        st.error = e;
        emit(st);
      });
    })();
    st.ready.catch((e) => { st.error = e; st.ready = null; emit(st); });
    return st.ready;
  }

  function stopAll() {
    cols.forEach((st) => { if (st.unsub) { try { st.unsub(); } catch (e) { /* уже зупинено */ } } });
    cols.clear();
  }

  // ---------- Читання ----------
  /** Записи колекції (без видалених). opts.deleted: true — разом із видаленими. */
  function list(name, opts) {
    const st = cols.get(name);
    if (!st) return [];
    const all = Array.from(st.map.values());
    return opts && opts.deleted ? all : all.filter((r) => !r.deletedAt);
  }

  function get(name, id) {
    const st = cols.get(name);
    return (st && st.map.get(id)) || null;
  }

  /** Підписка на зміни колекції. Повертає функцію відписки. */
  function on(name, fn) {
    const st = state(name);
    st.listeners.add(fn);
    return () => st.listeners.delete(fn);
  }

  const loaded = (name) => !!(cols.get(name) && cols.get(name).loaded);
  const synced = (name) => !!(cols.get(name) && cols.get(name).synced);
  const error = (name) => (cols.get(name) ? cols.get(name).error : null);

  // ---------- Історія змін (ТЗ 1.5) ----------
  /** Запис історії: entry('edit', [{ f, from, to }], { reason }). by — хто (marko | nazik | auto). */
  function entry(type, changes, extra) {
    return Object.assign({ id: U.uid(), at: new Date().toISOString(), by: NG.session.state.person || 'auto', type }, changes ? { changes } : {}, extra || {});
  }

  function writeError(e, what) {
    console.error(e);
    NG.ui.toast(`Не вдалося зберегти ${what}` + (e && e.code ? ` (${e.code})` : '') + '. Онови сторінку й спробуй ще раз.', { type: 'error' });
  }

  async function reread(name, id) {
    try {
      const d = await NG.fb.api.db.collection(name).doc(id).get();
      const st = state(name);
      if (d.exists) st.map.set(id, fromDoc(d)); else st.map.delete(id);
      emit(st);
    } catch (e) { /* лишаємо як є */ }
  }

  // ---------- Запис ----------
  /** Новий запис. Повертає його id одразу (запис на екрані з’являється без очікування бази). */
  function create(name, data, hist) {
    const st = state(name);
    const me = NG.session.state.person;
    const ref = NG.fb.api.db.collection(name).doc();
    const now = new Date().toISOString();
    const h = hist || entry('create');
    const remote = Object.assign({}, data, {
      createdAt: NG.fb.serverTime(), createdBy: me, updatedAt: NG.fb.serverTime(), updatedBy: me, deletedAt: null, history: [h]
    });
    st.map.set(ref.id, Object.assign({}, data, { id: ref.id, createdAt: now, createdBy: me, updatedAt: now, updatedBy: me, deletedAt: null, history: [h] }));
    emit(st);
    ref.set(remote).catch((e) => { writeError(e, 'запис'); reread(name, ref.id); });
    return ref.id;
  }

  /** Змінити поля запису й додати запис в історію (hist може бути масивом). */
  function update(name, id, changes, hist) {
    const st = state(name);
    const me = NG.session.state.person;
    const cur = st.map.get(id) || { id };
    const hs = hist ? (Array.isArray(hist) ? hist : [hist]) : [];
    const now = new Date().toISOString();
    const remote = Object.assign({}, changes, { updatedAt: NG.fb.serverTime(), updatedBy: me });
    if (hs.length) remote.history = NG.fb.arrayUnion(...hs);
    st.map.set(id, Object.assign({}, cur, changes, { updatedAt: now, updatedBy: me, history: (cur.history || []).concat(hs) }));
    emit(st);
    const p = NG.fb.api.db.collection(name).doc(id).update(remote);
    p.catch((e) => { writeError(e, 'зміни'); reread(name, id); });
    return p;
  }

  NG.store = { open, stopAll, list, get, on, loaded, synced, error, entry, create, update, plain };
})(window.NG);
