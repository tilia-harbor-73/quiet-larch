/* ==========================================================================
   js/core/fb.js — підключення Firebase: завантаження бібліотеки, вхід
   (Authentication) і спільна база (Firestore) з локальним кешем.

   Кеш: Firestore зберігає копію даних на пристрої й дочитує лише зміни —
   так база не перечитується при кожному відкритті (ТЗ 26.9).
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const CFG = NG.FIREBASE;
  let sdkPromise = null;
  let readyPromise = null;
  let api = null;

  const config = () => CFG.config;

  /** Чи вписано адресу проєкту (js/firebase-config.js). */
  function configured() {
    const c = config();
    return ['apiKey', 'authDomain', 'projectId', 'appId'].every((k) => c[k] && String(c[k]).indexOf('<') !== 0);
  }

  function loadScript(src, integrity) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      if (integrity) s.integrity = integrity;
      s.onload = resolve;
      s.onerror = () => { s.remove(); reject(new Error('load')); };
      document.head.appendChild(s);
    });
  }

  function loadSdk() {
    if (window.firebase && window.firebase.auth && window.firebase.firestore) return Promise.resolve(window.firebase);
    if (sdkPromise) return sdkPromise;
    sdkPromise = (async () => {
      for (const f of CFG.sdkFiles) await loadScript(CFG.sdkBase + f.name, f.integrity);
      if (!(window.firebase && window.firebase.auth && window.firebase.firestore)) throw new Error('load');
      return window.firebase;
    })().catch(() => {
      sdkPromise = null;
      const e = new Error('Не вдалося завантажити Firebase. Перевір інтернет або вимкни блокувальник реклами для цього сайту.');
      e.code = 'sdk';
      throw e;
    });
    return sdkPromise;
  }

  /** Запуск: { firebase, auth, db }. */
  function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      const firebase = await loadSdk();
      if (!firebase.apps.length) firebase.initializeApp(config());
      try { firebase.firestore.setLogLevel('error'); } catch (e) { /* не критично */ }
      const auth = firebase.auth();
      const db = firebase.firestore();
      // Локальний кеш на пристрої (спільний для кількох вкладок)
      try {
        await db.enablePersistence({ synchronizeTabs: true });
      } catch (e) {
        console.warn('Firestore без локального кешу:', e && e.code);
      }
      api = { firebase, auth, db };
      return api;
    })();
    readyPromise.catch(() => { readyPromise = null; });
    return readyPromise;
  }

  /** Час сервера для полів «змінено» (updatedAt). */
  function serverTime() { return api.firebase.firestore.FieldValue.serverTimestamp(); }

  NG.fb = {
    configured, ready, loadSdk, serverTime,
    get api() { return api; },
    get projectId() { return config().projectId; }
  };
})(window.NG);
