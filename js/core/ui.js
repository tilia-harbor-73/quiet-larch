/* ==========================================================================
   js/core/ui.js — будівельні блоки інтерфейсу: створення елементів (h),
   кнопки, сповіщення внизу екрана (toast), вікна (modal, confirm),
   спливні меню (popover) і нижня шторка на телефоні (sheet).
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  /**
   * h('div', { class: 'card', onClick: fn, dataset: { id: 1 }, style: { width: '10px' } }, 'текст', child, [діти])
   * Текст завжди вставляється як текст (не як HTML).
   */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    const a = attrs || {};
    Object.keys(a).forEach((k) => {
      const v = a[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'style' && typeof v === 'object') {
        Object.keys(v).forEach((s) => {
          if (s.startsWith('--')) el.style.setProperty(s, v[s]); else el.style[s] = v[s];
        });
      } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'tabIndex') el.tabIndex = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    append(el, children);
    return el;
  }

  function append(el, children) {
    children.forEach((c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) append(el, c);
      else if (c instanceof Node) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    });
  }

  /** Замінити вміст елемента. */
  function mount(el, ...children) {
    el.replaceChildren();
    append(el, children);
    return el;
  }

  /** Кнопка: button({ label, icon, variant: 'primary'|'ghost'|'danger', size: 'sm', onClick, title }) */
  function button(o) {
    const cls = ['btn'];
    if (o.variant) cls.push('btn-' + o.variant);
    if (o.size) cls.push('btn-' + o.size);
    if (o.iconOnly) cls.push('btn-icon');
    if (o.className) cls.push(o.className);
    return h('button', {
      type: o.type || 'button', class: cls.join(' '), onClick: o.onClick, disabled: !!o.disabled,
      title: o.title || null, 'aria-label': o.iconOnly ? (o.title || o.label) : null
    }, o.icon ? NG.icon(o.icon, { size: o.size === 'sm' ? 'sm' : null }) : null, o.iconOnly ? null : h('span', null, o.label));
  }

  // ---------- Шари (вікна, меню): Escape і клік поза ними ----------
  const layers = [];
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && layers.length) {
      e.preventDefault();
      layers[layers.length - 1].close();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    const top = layers[layers.length - 1];
    if (!top || !top.outside) return;
    if (top.el.contains(e.target) || (top.anchor && top.anchor.contains(e.target))) return;
    top.close();
  }, true);

  function pushLayer(layer) {
    layers.push(layer);
    return () => {
      const i = layers.indexOf(layer);
      if (i >= 0) layers.splice(i, 1);
    };
  }

  // ---------- Сповіщення внизу екрана ----------
  let toastBox = null;
  /** toast('Збережено', { type: 'success'|'error', duration, action: { label, onClick } }) */
  function toast(text, opts) {
    const o = opts || {};
    if (!toastBox) {
      toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(toastBox);
    }
    const close = () => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 180); };
    const el = h('div', { class: 'toast' + (o.type ? ' toast-' + o.type : '') },
      o.type === 'error' ? NG.icon('alert', { size: 'sm' }) : null,
      h('span', { class: 'toast-text' }, text),
      o.action ? h('button', { type: 'button', class: 'toast-action', onClick: () => { close(); o.action.onClick(); } }, o.action.label) : null,
      h('button', { type: 'button', class: 'toast-close', 'aria-label': 'Закрити', onClick: close }, NG.icon('x', { size: 'sm' })));
    toastBox.appendChild(el);
    setTimeout(close, o.duration || (o.type === 'error' ? 8000 : 4000));
    return close;
  }

  // ---------- Вікно ----------
  /** modal({ title, text, body, footer: [кнопки], onClose, className }) → { el, close } */
  function modal(o) {
    const prevFocus = document.activeElement;
    const titleId = 'm' + Math.random().toString(36).slice(2);
    const dialog = h('div', { class: 'modal' + (o.className ? ' ' + o.className : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h('h2', { class: 'modal-title', id: titleId }, o.title),
      o.text ? h('p', { class: 'modal-text' }, o.text) : null,
      o.body || null,
      o.footer ? h('div', { class: 'modal-foot' }, o.footer) : null);
    const overlay = h('div', { class: 'overlay' }, dialog);
    let closed = false;
    const api = {
      el: dialog,
      close() {
        if (closed) return;
        closed = true;
        drop();
        overlay.classList.add('is-leaving');
        setTimeout(() => overlay.remove(), 150);
        document.body.classList.remove('no-scroll');
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        if (o.onClose) o.onClose();
      }
    };
    const drop = pushLayer({ el: dialog, close: api.close, outside: false });
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) api.close(); });
    document.body.appendChild(overlay);
    document.body.classList.add('no-scroll');
    const first = dialog.querySelector('[data-autofocus]') || dialog.querySelector('button:not([disabled])');
    if (first) first.focus();
    return api;
  }

  /** Підтвердження: await confirm({ title, text, confirmText, cancelText, danger }) → true / false */
  function confirm(o) {
    return new Promise((resolve) => {
      let answer = false;
      const yes = button({ label: o.confirmText || 'Так', variant: o.danger ? 'danger' : 'primary', onClick: () => { answer = true; m.close(); } });
      yes.dataset.autofocus = '';
      const m = modal({
        title: o.title, text: o.text, body: o.body,
        footer: [button({ label: o.cancelText || 'Скасувати', onClick: () => m.close() }), yes],
        onClose: () => resolve(answer)
      });
    });
  }

  // ---------- Спливне меню ----------
  /** popover(anchor, content, { align: 'left'|'right', placement: 'below'|'above' }) → { el, close } */
  function popover(anchor, content, opts) {
    const o = opts || {};
    const el = h('div', { class: 'popover' + (o.className ? ' ' + o.className : ''), role: o.role || 'dialog' }, content);
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const left = o.align === 'left' ? r.left : r.right - w;
    el.style.left = Math.max(8, Math.min(left, window.innerWidth - w - 8)) + 'px';
    if (o.placement === 'above') el.style.bottom = (window.innerHeight - r.top + 8) + 'px';
    else el.style.top = (r.bottom + 8) + 'px';
    anchor.setAttribute('aria-expanded', 'true');
    let closed = false;
    const api = {
      el,
      close() {
        if (closed) return;
        closed = true;
        drop();
        el.remove();
        anchor.setAttribute('aria-expanded', 'false');
        window.removeEventListener('resize', api.close);
        if (o.onClose) o.onClose();
      }
    };
    const drop = pushLayer({ el, anchor, close: api.close, outside: true });
    window.addEventListener('resize', api.close);
    return api;
  }

  // ---------- Нижня шторка (телефон) ----------
  function sheet(o) {
    const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title },
      h('div', { class: 'sheet-grip', 'aria-hidden': 'true' }), o.body);
    const overlay = h('div', { class: 'overlay overlay-sheet' }, panel);
    let closed = false;
    const api = {
      el: panel,
      close() {
        if (closed) return;
        closed = true;
        drop();
        overlay.classList.add('is-leaving');
        setTimeout(() => overlay.remove(), 180);
        document.body.classList.remove('no-scroll');
        if (o.onClose) o.onClose();
      }
    };
    const drop = pushLayer({ el: panel, close: api.close, outside: false });
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) api.close(); });
    document.body.appendChild(overlay);
    document.body.classList.add('no-scroll');
    return api;
  }

  /** Заголовок сторінки: pageHead({ title, sub }) */
  function pageHead(o) {
    return h('header', { class: 'page-head' },
      h('h1', { class: 'page-title' }, o.title),
      o.sub ? h('p', { class: 'page-sub' }, o.sub) : null);
  }

  /** Кружечок з ініціалом людини її кольором (ТЗ 2.7). */
  function avatar(personId, opts) {
    const o = opts || {};
    const p = NG.dict.people[personId];
    return h('span', {
      class: 'avatar' + (o.size ? ' avatar-' + o.size : ''),
      style: { '--pc': `var(--c-${personId})` },
      title: o.title || (p ? p.name : null), 'aria-hidden': o.title ? null : 'true'
    }, p ? p.initial : '?');
  }

  NG.ui = { h, mount, button, toast, modal, confirm, popover, sheet, pageHead, avatar };
})(window.NG);
