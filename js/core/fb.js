/* ==========================================================================
   js/core/fb.js — підключення Firebase: завантаження бібліотеки, вхід
   (Authentication) і спільна база (Firestore) з локальним кешем.

   Кеш: Firestore зберігає копію даних на пристрої й дочитує лише зміни —
   так база не перечитується при кожному відкритті (ТЗ 26.9). Розмір кешу
   не обмежений, щоб браузер не викидав із нього записи (js/core/store.js
   бере звідти все, що вже бачив, і дочитує з бази лише змінене).
   Оновлено: 30.10.2026 · Етап 1, крок 2
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
      try {
        db.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED, merge: true });
      } catch (e) { console.warn('Firestore: розмір кешу не змінено', e && e.code); }
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

  /** Додати елементи до масиву в документі, не перезаписуючи чужі (історія змін). */
  function arrayUnion(...items) { return api.firebase.firestore.FieldValue.arrayUnion(...items); }

  /** Мітка часу Firestore з мілісекунд (для запитів «змінено після…»). */
  function timestamp(ms) { return api.firebase.firestore.Timestamp.fromMillis(ms); }

  NG.fb = {
    configured, ready, loadSdk, serverTime, arrayUnion, timestamp,
    get api() { return api; },
    get projectId() { return config().projectId; }
  };
})(window.NG);
