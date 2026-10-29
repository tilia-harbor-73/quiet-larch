/* ==========================================================================
   js/pwa.js — CRM як застосунок на телефоні й комп’ютері (ТЗ 1.8):
   • реєструє «помічника у фоні» (sw.js): копія файлів сайту → швидкий
     запуск і робота без інтернету;
   • плашка «Є нова версія · Оновити»; якщо не натиснути — нова версія
     вмикається сама при наступному запуску; після оновлення — «Що нового»;
   • попередження, якщо нову версію завантажено на GitHub не повністю;
   • рядок «Версія … · Перевірити оновлення» в меню профілю.
   З file:// помічник не реєструється. Підхід — як в особистій CRM.
   Оновлено: 30.10.2026 · Етап 1, крок 2
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  // Номер версії — РРРР.ММ.ДД-N. Міняти при КОЖНІЙ доставці коду (і додавати запис у CHANGES),
  // потім запустити instrumenty/make-sw.js — він переносить номер у sw.js і рахує контрольні суми файлів.
  const VERSION = '2026.10.30-1';
  const CHANGES = [
    { v: '2026.10.30-1', items: ['Розділ «Клієнти»: картка клієнта, статуси, «проблемний», пошук і фільтри, «Кому скоро курсова».', 'Ctrl K шукає клієнтів.', 'Історія змін у картці: хто, що і коли змінив.'] },
    { v: '2026.10.29-1', items: ['Перша версія: вхід через Google, оформлення, меню, налаштування вигляду.'] }
  ];

  const { h } = NG.ui;
  const ls = NG.utils.ls;
  const startHref = location.href;

  let reg = null;
  let hadController = false;
  let initiated = false;
  let waitingVersion = null;
  let lastCheck = null;     // { at, result }
  let checking = null;
  let barEl = null;
  let warned = false;

  const isFile = () => location.protocol === 'file:';
  const hasUpdate = () => !!(reg && reg.waiting && navigator.serviceWorker.controller);
  function changed() { document.dispatchEvent(new CustomEvent('ng:pwa')); }

  /** '2026.10.29-1' → '29 жовтня 2026' */
  function versionLabel(v) {
    const m = /^(\d{4})\.(\d{2})\.(\d{2})(?:-(\d+))?$/.exec(v || '');
    if (!m) return v || '';
    const s = NG.utils.dateLong(`${m[1]}-${m[2]}-${m[3]}`);
    return m[4] && m[4] !== '1' ? `${s}, № ${m[4]}` : s;
  }

  function ask(worker, type) {
    return new Promise((resolve) => {
      if (!worker) { resolve(null); return; }
      const ch = new MessageChannel();
      const t = setTimeout(() => resolve(null), 3000);
      ch.port1.onmessage = (e) => { clearTimeout(t); resolve(e.data || null); };
      try { worker.postMessage({ type }, [ch.port2]); } catch (e) { clearTimeout(t); resolve(null); }
    });
  }

  // ---------- Плашка внизу екрана ----------
  function closeBar() { if (barEl) barEl.remove(); barEl = null; }
  function bar(o) {
    closeBar();
    barEl = h('div', { class: 'pwa-bar', role: 'status', 'aria-live': 'polite' },
      h('span', { class: 'pwa-bar-icon' }, NG.icon(o.icon || 'refresh')),
      h('div', { class: 'pwa-bar-text' },
        h('div', { class: 'pwa-bar-title' }, o.title),
        o.text ? h('div', { class: 'pwa-bar-sub' }, o.text) : null,
        o.list ? h('ul', { class: 'pwa-bar-list' }, o.list.map((t) => h('li', null, t))) : null),
      o.action ? h('button', { type: 'button', class: 'btn btn-primary btn-sm', onClick: o.action.onClick }, o.action.label) : null,
      o.busy ? null : h('button', { type: 'button', class: 'toast-close', 'aria-label': 'Закрити', onClick: closeBar }, NG.icon('x', { size: 'sm' })));
    document.body.appendChild(barEl);
    if (o.duration) setTimeout(() => { if (barEl && barEl.dataset.id === o.id) closeBar(); }, o.duration);
    barEl.dataset.id = o.id || '';
  }

  function restart() {
    if (startHref !== location.href) { try { history.replaceState(null, '', startHref); } catch (e) { /* не критично */ } }
    location.reload();
  }

  function applyUpdate() {
    if (!hasUpdate()) { location.reload(); return; }
    initiated = true;
    ls.set('pwa.from', VERSION);
    bar({ title: 'Оновлюю…', busy: true });
    reg.waiting.postMessage({ type: 'skipWaiting' });
    setTimeout(restart, 5000);
  }

  async function onWaiting() {
    if (!hasUpdate()) return;
    const info = await ask(reg.waiting, 'version');
    waitingVersion = (info && info.version) || null;
    ls.set('pwa.fail', null);
    changed();
    bar({
      id: 'update', title: 'Є нова версія CRM',
      text: (waitingVersion ? 'Від ' + versionLabel(waitingVersion) + '. ' : '') + 'Якщо не оновити зараз — увімкнеться при наступному запуску.',
      action: { label: 'Оновити', onClick: applyUpdate }
    });
  }

  function settle(worker) {
    return new Promise((resolve) => {
      const done = () => ['installed', 'activating', 'activated', 'redundant'].includes(worker.state);
      if (done()) { resolve(worker.state); return; }
      const on = () => { if (done()) { worker.removeEventListener('statechange', on); resolve(worker.state); } };
      worker.addEventListener('statechange', on);
    });
  }

  function watch(worker) {
    if (!worker) return;
    settle(worker).then((state) => { if (state === 'installed') onWaiting(); else changed(); });
  }

  // Нову версію на GitHub завантажено не повністю: працює попередня, попереджаємо
  function onFailed(d) {
    if (d.offline) return;
    const prev = ls.get('pwa.fail', null);
    const fail = { version: d.version, problems: (d.problems || []).slice(0, 20), first: prev && prev.version === d.version ? prev.first : Date.now() };
    ls.set('pwa.fail', fail);
    changed();
    // Перші хвилини після завантаження GitHub ще публікує файли — попереджаємо, лише якщо проблема тримається
    if (!warned && Date.now() - fail.first > 5 * 60 * 1000) {
      warned = true;
      const names = fail.problems.slice(0, 3).map((p) => p.path).join(', ');
      NG.ui.toast(`Нову версію CRM на GitHub завантажено не повністю (${names}${fail.problems.length > 3 ? ' та інші' : ''}), тож поки працює попередня. Завантаж на GitHub увесь вміст папки sait.`, { type: 'error', duration: 15000 });
    }
  }

  function check() {
    if (!reg) return Promise.resolve(null);
    if (checking) return checking;
    checking = (async () => {
      changed();
      let result;
      try {
        if (navigator.onLine === false) result = 'offline';
        else {
          if (!reg.active && !reg.waiting && !reg.installing) await doRegister(); else await reg.update();
          if (reg.installing) await settle(reg.installing);
          if (hasUpdate()) { await onWaiting(); result = 'ready'; }
          else result = ls.get('pwa.fail', null) ? 'broken' : 'latest';
        }
      } catch (e) {
        result = navigator.onLine === false ? 'offline' : 'error';
      }
      lastCheck = { at: Date.now(), result };
      checking = null;
      changed();
      return result;
    })();
    return checking;
  }

  /** Рядок для меню профілю: версія і «Перевірити оновлення». */
  function versionLine() {
    const text = h('span', { class: 'version-text' });
    const btn = h('button', { type: 'button', class: 'link-btn', onClick: () => check() }, 'Перевірити оновлення');
    const line = h('div', { class: 'version-line' }, text, reg ? btn : null);
    function draw() {
      if (line.dataset.shown && !line.isConnected) { document.removeEventListener('ng:pwa', draw); return; } // меню закрили
      let s = 'Версія від ' + versionLabel(VERSION);
      if (checking) s += ' · перевіряю…';
      else if (hasUpdate()) s += ' · є нова';
      else if (lastCheck) {
        s += {
          latest: ' · це остання', offline: ' · немає інтернету', error: ' · не вдалося перевірити',
          ready: ' · є нова', broken: ' · нова завантажена не повністю'
        }[lastCheck.result] || '';
      }
      text.textContent = s;
      text.title = VERSION;
      btn.disabled = !!checking;
    }
    draw();
    document.addEventListener('ng:pwa', draw);
    requestAnimationFrame(() => { line.dataset.shown = '1'; });
    return line;
  }

  function whatsNew() {
    const seen = ls.get('pwa.seen', null);
    if (seen === VERSION) return;
    const from = ls.get('pwa.from', null) || seen;
    ls.set('pwa.seen', VERSION);
    ls.set('pwa.from', null);
    if (!from) return; // новий пристрій — показувати нічого
    const list = [];
    for (const c of CHANGES) { if (c.v === from) break; list.push(...c.items); }
    if (!list.length) return;
    bar({ id: 'news', icon: 'check', title: 'CRM оновлено', text: 'Версія від ' + versionLabel(VERSION) + '. Що нового:', list: list.slice(0, 6), action: { label: 'Добре', onClick: closeBar }, duration: 30000 });
  }

  async function doRegister() {
    const r = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    if (r !== reg) {
      reg = r;
      if (r.installing) watch(r.installing);
      r.addEventListener('updatefound', () => watch(r.installing));
    }
    return r;
  }

  async function register() {
    if (isFile() || !('serviceWorker' in navigator) || !window.isSecureContext || !window.caches) return;
    const sws = navigator.serviceWorker;
    hadController = !!sws.controller;
    sws.addEventListener('controllerchange', () => {
      if (!hadController) { hadController = true; return; } // перше встановлення
      if (initiated) { restart(); return; }
      bar({ id: 'other', title: 'CRM оновлено в іншій вкладці', action: { label: 'Перезавантажити', onClick: () => location.reload() } });
    });
    sws.addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.type === 'ng-sw-failed') onFailed(d);
      else if (d.type === 'ng-sw-installed') { ls.set('pwa.fail', null); changed(); }
    });
    try { await doRegister(); } catch (e) { console.warn('sw.js не зареєстровано:', e); return; }
    if (hasUpdate()) {
      // Нова версія чекала з минулого разу — вмикаємо одразу при запуску
      initiated = true;
      ls.set('pwa.from', VERSION);
      reg.waiting.postMessage({ type: 'skipWaiting' });
      setTimeout(restart, 5000);
      return;
    }
    changed();
    setTimeout(check, 4000);
    setInterval(() => { if (document.visibilityState === 'visible') check(); }, 30 * 60 * 1000);
    let lastAuto = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastAuto > 60 * 1000) { lastAuto = Date.now(); check(); }
    });
  }

  function init() {
    register().catch((e) => console.warn(e));
    setTimeout(whatsNew, 800);
  }

  NG.pwa = { VERSION, init, check, applyUpdate, versionLine, versionLabel };
})(window.NG);
