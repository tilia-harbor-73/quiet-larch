/* ==========================================================================
   js/core/history.js — історія змін запису (ТЗ 1.5): хто, що і коли змінив.
   • diff() — які поля змінилися (для запису в історію);
   • block() — блок «Історія змін» у картці (клієнта, далі — замовлення, задачі).
   Підписи полів і вигляд значень дає розділ (fields: { поле: { label, fmt } }).
   Оновлено: 30.10.2026 · Етап 1, крок 2
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const { h } = NG.ui;
  const U = NG.utils;
  const MAX = 500; // довгі тексти в історії обрізаємо

  const same = (a, b) => JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b);
  const empty = (v) => v == null || v === '' || v === false || (Array.isArray(v) && !v.length);

  function cut(v) {
    if (typeof v === 'string' && v.length > MAX) return v.slice(0, MAX) + '…';
    return v == null ? null : v;
  }

  /** Змінені поля: diff(старий, новий, ['phone', 'course']) → [{ f, from, to }]. */
  function diff(prev, next, fields) {
    const out = [];
    fields.forEach((f) => {
      const a = prev ? prev[f] : null;
      const b = next[f];
      if (same(a, b) || (empty(a) && empty(b))) return;
      out.push({ f, from: cut(a), to: cut(b) });
    });
    return out;
  }

  function who(by) {
    if (by === 'auto') return h('span', { class: 'hist-who' }, h('span', { class: 'avatar avatar-sm avatar-auto', 'aria-hidden': 'true' }, 'A'), 'CRM, автоматично');
    const p = NG.dict.people[by];
    return h('span', { class: 'hist-who' }, NG.ui.avatar(by, { size: 'sm' }), p ? p.name : by || '—');
  }

  function value(def, v) {
    if (empty(v)) return h('span', { class: 'hist-empty' }, 'порожньо');
    const s = def && def.fmt ? def.fmt(v) : (Array.isArray(v) ? v.join(', ') : String(v));
    return h('span', { class: 'hist-val' }, s);
  }

  /**
   * Блок історії: block(record, { fields, types: { тип: (entry) → текст }, limit }).
   * Найновіше — вгорі; спершу видно limit записів, решта — «Показати всю історію».
   */
  function block(rec, o) {
    const list = (rec.history || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const limit = o.limit || 8;
    const wrap = h('div', { class: 'hist' });
    let all = false;

    function item(e) {
      const title = (o.types && o.types[e.type] && o.types[e.type](e)) || (e.type === 'create' ? 'створив запис' : 'змінив');
      return h('li', { class: 'hist-item' },
        h('div', { class: 'hist-head' }, who(e.by), h('span', { class: 'hist-what' }, title), h('time', { class: 'hist-time mono', datetime: e.at }, U.dateTimeShort(e.at))),
        e.changes && e.changes.length ? h('ul', { class: 'hist-changes' }, e.changes.map((c) => {
          const def = o.fields[c.f];
          return h('li', null, h('span', { class: 'hist-field' }, def ? def.label : c.f), ': ', value(def, c.from), h('span', { class: 'hist-arrow', 'aria-label': 'стало' }, ' → '), value(def, c.to));
        })) : null,
        e.reason ? h('div', { class: 'hist-reason' }, 'Причина: ', e.reason) : null);
    }

    function draw() {
      const shown = all ? list : list.slice(0, limit);
      NG.ui.mount(wrap,
        list.length ? h('ol', { class: 'hist-list' }, shown.map(item)) : h('p', { class: 'muted' }, 'Змін ще не було.'),
        list.length > limit ? h('button', { type: 'button', class: 'link-btn hist-more', onClick: () => { all = !all; draw(); } },
          all ? 'Згорнути' : `Показати всю історію (${list.length})`) : null);
    }
    draw();
    return wrap;
  }

  NG.history = { diff, block };
})(window.NG);
