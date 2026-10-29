/* ==========================================================================
   js/router.js — перемикання розділів за адресою (#/orders, #/settings…).
   Розділ, якого ще немає, показує заглушку «з’явиться на етапі N».
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const routes = new Map();
  const renderHooks = new Set();
  let container = null;
  let cleanup = null;
  let current = null;

  /** register('settings', { title, render(container, params) → cleanup? }) */
  function register(id, def) { routes.set(id, def); }

  function parse() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const params = {};
    new URLSearchParams(query || '').forEach((v, k) => { params[k] = v; });
    return { id: parts[0] || '', sub: parts[1] || '', params };
  }

  function render() {
    if (!container) return;
    let r = parse();
    if (!r.id || (!routes.has(r.id) && !NG.dict.section(r.id))) {
      r = { id: NG.dict.startRoute, sub: '', params: {} };
      history.replaceState(null, '', '#/' + r.id);
    }
    const def = routes.get(r.id) || routes.get('later');
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } }
    cleanup = null;
    current = { id: r.id, sub: r.sub, params: r.params, def };
    container.replaceChildren();
    try {
      cleanup = def.render(container, current) || null;
    } catch (e) {
      console.error(e);
      container.textContent = 'Не вдалося показати розділ: ' + e.message;
    }
    const sec = NG.dict.section(r.id);
    document.title = (sec ? sec.label + ' · ' : '') + 'NewGen';
    renderHooks.forEach((fn) => fn(current));
    container.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function start(el) {
    container = el;
    window.addEventListener('hashchange', render);
    render();
  }

  function stop() {
    window.removeEventListener('hashchange', render);
    if (cleanup) { try { cleanup(); } catch (e) { /* ігноруємо */ } }
    cleanup = null;
    container = null;
  }

  function go(id, sub) {
    const target = '#/' + id + (sub ? '/' + sub : '');
    if (location.hash === target) render(); else location.hash = target;
  }

  NG.router = {
    register, start, stop, go, rerender: render,
    onRender(fn) { renderHooks.add(fn); return () => renderHooks.delete(fn); },
    get current() { return current; }
  };
})(window.NG);
