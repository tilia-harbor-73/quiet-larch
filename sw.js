/* ==========================================================================
   sw.js — «помічник у фоні» (service worker) застосунку NewGen (ТЗ 1.8).

   Що робить:
   • зберігає копію файлів сайту → CRM відкривається швидко й без інтернету;
   • нову версію бере, лише коли ВСІ її файли на місці й збігаються з
     контрольними сумами нижче (захист від неповного завантаження на GitHub);
     тоді сторінка показує плашку «Є нова версія · Оновити»;
   • бібліотеку Firebase з jsDelivr — теж зберігає (адреси з номером версії
     не змінюються), шрифти Google — оновлює у фоні.
   Дані CRM помічник не чіпає: запити до Google і Firebase йдуть у мережу.

   Блок між позначками нижче генерує скрипт instrumenty/make-sw.js: він рахує
   sha256 кожного файлу сайту. Будь-яка зміна файлу → новий sw.js → браузер
   помічає нову версію. Вручну цей блок не правити.
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
'use strict';

// ---- АВТОМАТИЧНИЙ БЛОК (instrumenty/make-sw.js) ----
const VERSION = '2026.10.29-1';
const BUILD = 'c40b2f0d235d';
const FILES = {
  'css/base.css': '4c041eda5a3a1513',
  'css/components.css': '26e6ad6a553b83ff',
  'css/layout.css': '578a35169106bce2',
  'icons/apple-touch-icon.png': 'cbe2e921300461ec',
  'icons/icon-192.png': 'e230488bd500d0ec',
  'icons/icon-512.png': 'd35828062268cabf',
  'icons/icon-maskable-512.png': '79e96aa6ba4c6dfc',
  'icons/icon.svg': 'e72a20d6afb1e6b9',
  'index.html': 'e1907e7ed87f2478',
  'js/app.js': '75eb442ed96c07d9',
  'js/auth-screens.js': 'ff77b657ebaa4d55',
  'js/core/dict.js': 'f16770d9a89f1185',
  'js/core/fb.js': '17afc06bfdd3d36f',
  'js/core/icons.js': 'bcb37c967136096b',
  'js/core/session.js': '6503be98767c4f77',
  'js/core/ui.js': 'b24c3e41432705e3',
  'js/core/utils.js': 'd6c3e0eb602f1675',
  'js/firebase-config.js': '41548494439653a1',
  'js/look.js': 'b4add8f5c387ee07',
  'js/notify.js': '824ea5deff38a5ba',
  'js/pages/later.js': '3acb31f3548e4b1f',
  'js/pages/settings.js': 'a84300dc19525533',
  'js/pwa.js': '8742243620b7f01d',
  'js/router.js': '40705de3cdd7b113',
  'js/search.js': '6e187de6be84ec14',
  'js/shell.js': 'dd5cae0061120899',
  'manifest.json': 'bdfb9b4064a61657'
};
const CDN = [
  'https://cdn.jsdelivr.net/npm/firebase@12.19.0/firebase-app-compat.js',
  'https://cdn.jsdelivr.net/npm/firebase@12.19.0/firebase-auth-compat.js',
  'https://cdn.jsdelivr.net/npm/firebase@12.19.0/firebase-firestore-compat.js'
];
// ---- КІНЕЦЬ АВТОМАТИЧНОГО БЛОКУ ----

const APP_CACHE = 'ng-app-' + VERSION + '-' + BUILD;
const CDN_CACHE = 'ng-cdn';
const FONT_CACHE = 'ng-fonts';
const BASE = new URL('./', self.location).href;
const BASE_PATH = new URL(BASE).pathname;

/** Перші 16 символів sha256 (hex) — як у FILES. */
async function hash16(buf) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  let s = '';
  for (let i = 0; i < 8; i++) s += d[i].toString(16).padStart(2, '0');
  return s;
}

async function tell(msg) {
  try {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    list.forEach((c) => c.postMessage(msg));
  } catch (e) { /* немає відкритих вкладок */ }
}

/** Той самий файл (та сама сума) з попередньої версії — щоб не завантажувати вдруге. */
async function fromOld(path, hash) {
  const keys = await caches.keys();
  for (const key of keys) {
    if (!key.startsWith('ng-app-') || key === APP_CACHE) continue;
    const r = await (await caches.open(key)).match(BASE + path);
    if (r && r.headers.get('X-NG-Hash') === hash) return r;
  }
  return null;
}

async function install() {
  const cache = await caches.open(APP_CACHE);
  const problems = [];
  await Promise.all(Object.keys(FILES).map(async (path) => {
    const hash = FILES[path];
    try {
      let res = await fromOld(path, hash);
      if (!res) {
        // ?v=… і cache: 'reload' — повз кеш браузера й CDN, щоб узяти саме нову версію файлу
        const r = await fetch(BASE + path + '?v=' + hash, { cache: 'reload' });
        if (!r.ok) { problems.push({ path, why: r.status === 404 ? 'missing' : 'http', status: r.status }); return; }
        const buf = await r.arrayBuffer();
        if (await hash16(buf) !== hash) { problems.push({ path, why: 'different' }); return; }
        res = new Response(buf, { status: 200, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/octet-stream', 'X-NG-Hash': hash } });
      }
      await cache.put(BASE + path, res);
    } catch (e) {
      problems.push({ path, why: 'network' });
    }
  }));
  if (problems.length) {
    await caches.delete(APP_CACHE);
    await tell({ type: 'ng-sw-failed', version: VERSION, offline: problems.every((p) => p.why === 'network'), problems });
    throw new Error('NewGen ' + VERSION + ': не всі файли нової версії на місці');
  }
  // Бібліотека Firebase — не обов’язково зараз (довантажиться при першому запиті)
  try {
    const c = await caches.open(CDN_CACHE);
    await Promise.all(CDN.map(async (url) => {
      try {
        if (await c.match(url)) return;
        const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (r.ok) await c.put(url, r);
      } catch (e) { /* спробуємо при наступному запиті */ }
    }));
  } catch (e) { /* не критично */ }
  await tell({ type: 'ng-sw-installed', version: VERSION });
}

self.addEventListener('install', (event) => { event.waitUntil(install()); });

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('ng-app-') && k !== APP_CACHE).map((k) => caches.delete(k)));
    try {
      const c = await caches.open(CDN_CACHE);
      const reqs = await c.keys();
      await Promise.all(reqs.filter((r) => !CDN.includes(r.url)).map((r) => c.delete(r)));
    } catch (e) { /* не критично */ }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const d = event.data || {};
  const reply = (msg) => { if (event.ports && event.ports[0]) event.ports[0].postMessage(msg); };
  if (d.type === 'skipWaiting') self.skipWaiting();
  else if (d.type === 'version') reply({ version: VERSION });
  else if (d.type === 'files') reply({ version: VERSION, files: FILES });
});

// ---------- Відповіді на запити ----------
async function appFile(req, path) {
  const hit = await (await caches.open(APP_CACHE)).match(BASE + path);
  return hit || fetch(req); // збережену копію браузер міг видалити — тоді з мережі
}

async function cdnFile(req) {
  const c = await caches.open(CDN_CACHE);
  const hit = await c.match(req.url);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok && (r.type === 'cors' || r.type === 'basic')) c.put(req.url, r.clone()).catch(() => {});
  return r;
}

async function fontFile(event, req) {
  const c = await caches.open(FONT_CACHE);
  const hit = await c.match(req);
  const net = fetch(req).then((r) => {
    if (r.ok || r.type === 'opaque') c.put(req, r.clone()).catch(() => {});
    return r;
  }).catch(() => null);
  if (hit) { event.waitUntil(net); return hit; }
  return (await net) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(BASE_PATH) || url.searchParams.has('fresh')) return;
    let path = decodeURIComponent(url.pathname.slice(BASE_PATH.length));
    if (req.mode === 'navigate' && path === '') path = 'index.html';
    if (!Object.prototype.hasOwnProperty.call(FILES, path)) return; // README тощо — з мережі
    event.respondWith(appFile(req, path));
    return;
  }
  if (CDN.includes(url.href)) { event.respondWith(cdnFile(req)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(fontFile(event, req));
});
