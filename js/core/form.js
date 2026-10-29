/* ==========================================================================
   js/core/form.js — поля форм: підпис, поле, підказка, помилка;
   перемикач-сегменти, галочка, мітки (теги), вибір запису зі списку
   з пошуком. Використовують форми клієнтів, далі — замовлень і задач.
   Оновлено: 30.10.2026 · Етап 1, крок 2
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const { h } = NG.ui;
  const U = NG.utils;
  let n = 0;
  const nextId = () => 'f' + (++n);

  /** Поле з підписом: field({ label, control, hint, required, wide }) → { el, setError(text) } */
  function field(o) {
    const id = o.control.id || (o.control.id = nextId());
    const err = h('div', { class: 'field-error', role: 'alert', hidden: true });
    const el = h('div', { class: 'field' + (o.wide ? ' field-wide' : '') + (o.className ? ' ' + o.className : '') },
      o.label ? h('label', { class: 'field-label', for: o.control.matches('input, select, textarea') ? id : null },
        o.label, o.required ? h('span', { class: 'field-req', 'aria-hidden': 'true' }, ' *') : null) : null,
      o.control,
      o.hint ? h('div', { class: 'field-hint' }, o.hint) : null,
      err);
    // Почали виправляти — підказку про помилку прибираємо
    const clear = () => { if (!err.hidden) { err.hidden = true; err.textContent = ''; el.classList.remove('has-error'); } };
    o.control.addEventListener('input', clear);
    o.control.addEventListener('click', (e) => { if (e.target.closest('button')) clear(); });
    return {
      el,
      setError(text) {
        err.textContent = text || '';
        err.hidden = !text;
        el.classList.toggle('has-error', !!text);
        if (text) {
          const focusable = el.querySelector('input, select, textarea, button');
          if (focusable) focusable.focus();
        }
      }
    };
  }

  function input(a) { return h('input', Object.assign({ class: 'input', type: 'text', autocomplete: 'off' }, a || {})); }
  function textarea(a) { return h('textarea', Object.assign({ class: 'input textarea', rows: 3 }, a || {})); }

  /** select({ value, options: [{ id, label }], empty: 'текст порожнього варіанта' }) */
  function select(o) {
    const s = h('select', { class: 'input select', name: o.name || null },
      o.empty != null ? h('option', { value: '' }, o.empty) : null,
      o.options.map((x) => h('option', { value: x.id }, x.label)));
    s.value = o.value == null ? '' : o.value;
    return s;
  }

  /** Галочка: checkbox({ label, checked, hint }) → label-елемент; .input — сам прапорець. */
  function checkbox(o) {
    const box = h('input', { type: 'checkbox', class: 'check-input', name: o.name || null });
    box.checked = !!o.checked;
    const el = h('label', { class: 'check' }, box, h('span', { class: 'check-mark', 'aria-hidden': 'true' }, NG.icon('check', { size: 'sm', stroke: 2.4 })),
      h('span', { class: 'check-text' }, h('span', null, o.label), o.hint ? h('span', { class: 'check-hint' }, o.hint) : null));
    el.input = box;
    return el;
  }

  /** Сегменти (один варіант): segmented({ value, options, onChange }) → el з .value */
  function segmented(o) {
    let value = o.value || '';
    const el = h('div', { class: 'segmented segmented-form', role: 'radiogroup', 'aria-label': o.label || null });
    function draw() {
      NG.ui.mount(el, o.options.map((x) => h('button', {
        type: 'button', role: 'radio', class: x.id === value ? 'is-active' : '', dataset: { value: x.id },
        'aria-checked': x.id === value ? 'true' : 'false',
        onClick: () => { value = x.id; draw(); if (o.onChange) o.onChange(value); }
      }, x.label)));
    }
    draw();
    Object.defineProperty(el, 'value', { get: () => value, set: (v) => { value = v; draw(); } });
    return el;
  }

  /** Мітки: tags({ value: [], suggestions: [] }) → el з .value (масив). Enter або кома — додати. */
  function tags(o) {
    let list = (o.value || []).slice();
    const listId = nextId();
    const chips = h('span', { class: 'tags-chips' });
    const inp = h('input', { class: 'tags-input', type: 'text', list: listId, placeholder: o.placeholder || 'Нова мітка — Enter', 'aria-label': o.label || 'Мітки', autocomplete: 'off' });
    const dl = h('datalist', { id: listId }, (o.suggestions || []).map((s) => h('option', { value: s })));
    const el = h('div', { class: 'input tags' }, chips, inp, dl);
    function add(raw) {
      String(raw || '').split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean).forEach((t) => {
        if (!list.some((x) => U.norm(x) === U.norm(t))) list.push(t.slice(0, 40));
      });
      inp.value = '';
      draw();
    }
    function draw() {
      NG.ui.mount(chips, list.map((t, i) => h('span', { class: 'tag' }, t,
        h('button', { type: 'button', class: 'tag-x', 'aria-label': 'Прибрати мітку ' + t, onClick: () => { list.splice(i, 1); draw(); inp.focus(); } }, NG.icon('x', { size: 'sm' })))));
    }
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(inp.value); }
      else if (e.key === 'Backspace' && !inp.value && list.length) { list.pop(); draw(); }
    });
    inp.addEventListener('change', () => { if (inp.value.includes(',') || (o.suggestions || []).includes(inp.value)) add(inp.value); });
    inp.addEventListener('blur', () => { if (inp.value.trim()) add(inp.value); });
    el.addEventListener('click', (e) => { if (e.target === el || e.target === chips) inp.focus(); });
    draw();
    Object.defineProperty(el, 'value', { get: () => { if (inp.value.trim()) add(inp.value); return list.slice(); } });
    el.input = inp;
    return el;
  }

  /**
   * Вибір запису зі списку з пошуком: picker({ items: [{ id, label, sub }], value, placeholder, onChange })
   * → el з .value (id або '').
   */
  function picker(o) {
    let value = o.value || '';
    const inp = h('input', { class: 'input', type: 'search', placeholder: o.placeholder || 'Почни вводити…', autocomplete: 'off', 'aria-label': o.label || null });
    const box = h('div', { class: 'picker-list', role: 'listbox', hidden: true });
    const chosen = h('div', { class: 'picker-chosen', hidden: true });
    const el = h('div', { class: 'picker' }, chosen, inp, box);
    let active = 0;
    let shown = [];

    function choose(id) {
      value = id;
      inp.value = '';
      box.hidden = true;
      draw();
      if (o.onChange) o.onChange(value);
    }
    function draw() {
      const it = o.items.find((x) => x.id === value);
      chosen.hidden = !it;
      inp.hidden = !!it;
      NG.ui.mount(chosen, it ? [h('span', { class: 'picker-chosen-text' }, h('strong', null, it.label), it.sub ? h('span', { class: 'muted' }, ' · ' + it.sub) : null),
        h('button', { type: 'button', class: 'link-btn', onClick: () => { choose(''); inp.focus(); } }, 'Змінити')] : []);
    }
    function search() {
      const q = U.norm(inp.value);
      shown = o.items.filter((x) => !q || U.norm(x.label + ' ' + (x.sub || '')).includes(q)).slice(0, 8);
      active = 0;
      NG.ui.mount(box, shown.length ? shown.map((x, i) => h('button', {
        type: 'button', role: 'option', class: 'picker-item' + (i === active ? ' is-active' : ''), 'aria-selected': i === active ? 'true' : 'false',
        onPointerdown: (e) => e.preventDefault(), onClick: () => choose(x.id)
      }, h('span', null, x.label), x.sub ? h('span', { class: 'muted' }, x.sub) : null)) : h('div', { class: 'picker-empty' }, 'Нікого не знайдено'));
      box.hidden = false;
    }
    function mark() {
      box.querySelectorAll('.picker-item').forEach((b, i) => { b.classList.toggle('is-active', i === active); b.setAttribute('aria-selected', i === active ? 'true' : 'false'); });
    }
    inp.addEventListener('input', search);
    inp.addEventListener('focus', search);
    inp.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 120));
    inp.addEventListener('keydown', (e) => {
      if (box.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, shown.length - 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) choose(shown[active].id); }
      else if (e.key === 'Escape') { e.stopPropagation(); box.hidden = true; }
    });
    draw();
    Object.defineProperty(el, 'value', { get: () => value });
    el.input = inp;
    return el;
  }

  NG.form = { field, input, textarea, select, checkbox, segmented, tags, picker };
})(window.NG);
