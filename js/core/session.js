/* ==========================================================================
   js/core/session.js — хто увійшов і хто він у CRM.

   • Вхід — особистим Google-акаунтом (ТЗ 3.4).
   • Доступ перевіряє база: правила Firestore пускають лише дві адреси (ТЗ 3.5).
     Якщо база відмовила — екран «Немає доступу».
   • Перший вхід: «Хто ти?» — Марко чи Назік. Вибір зберігається в базі
     в документі people/marko або people/nazik (поле uid — чий це акаунт).
     Зайняте місце вдруге обрати не можна (це перевіряють і правила бази).
   • У тому самому документі — особистий вигляд: тема, колір інтерфейсу
     (рішення П11), «Мій колір» (ТЗ 2.7), колір «горить» (ТЗ 2.8).
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const D = () => NG.dict;
  const SLOW_MS = 20000;

  /*
   * phase:
   *   boot      — завантаження
   *   config    — у js/firebase-config.js ще не вписано адресу проєкту
   *   file      — сайт відкрито як файл (вхід Google так не працює)
   *   signedout — ніхто не увійшов
   *   loading   — увійшли, чекаємо відповіді бази
   *   noaccess  — база не пускає цей акаунт
   *   choose    — «Хто ти?»
   *   ready     — можна працювати
   *   error     — інша помилка (state.error)
   */
  const state = {
    phase: 'boot', user: null, person: null, people: { marko: null, nazik: null },
    error: null, authError: null, signingIn: false, slow: false
  };
  const listeners = new Set();
  let unsubPeople = null;
  let signInTry = 0;
  let slowTimer = null;
  let waitTimer = null;

  function emit(what) { listeners.forEach((fn) => { try { fn(state, what); } catch (e) { console.error(e); } }); }
  function setPhase(p, extra) {
    Object.assign(state, extra || {});
    state.phase = p;
    emit('phase');
  }

  // ---------- Тексти помилок ----------
  function authErrorText(e) {
    const code = (e && e.code) || '';
    switch (code) {
      case 'auth/popup-blocked': return 'Браузер заблокував вікно входу Google. Натисни «Увійти через Google» ще раз; якщо не допоможе — дозволь спливні вікна для цього сайту (значок праворуч в адресному рядку).';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
      case 'auth/user-cancelled': return null;
      case 'auth/unauthorized-domain': return `Адресу ${location.hostname} не додано у Firebase: Authentication → Settings → Authorized domains.`;
      case 'auth/operation-not-allowed': return 'Вхід через Google не ввімкнено у Firebase: Authentication → Sign-in method → Google → Enable.';
      case 'auth/network-request-failed': return 'Немає зв’язку з Google. Перевір інтернет і спробуй ще раз.';
      case 'auth/invalid-api-key':
      case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.': return 'Firebase не впізнав ключ проєкту. Перевір значення в js/firebase-config.js.';
      case 'sdk': return e.message;
      default: return 'Не вдалося увійти' + (code ? ` (${code})` : '') + '. Спробуй ще раз.';
    }
  }

  function dbErrorText(e) {
    const code = (e && e.code) || '';
    const msg = String((e && e.message) || '');
    if (code === 'failed-precondition' || code === 'not-found' || /does not exist|not found/i.test(msg)) {
      return 'Базу даних Firestore ще не створено: консоль Firebase → Firestore Database → Create database.';
    }
    if (code === 'unavailable') return 'Немає зв’язку з базою. Для першого входу на цьому пристрої потрібен інтернет.';
    return 'Помилка бази даних' + (code ? ` (${code})` : '') + '. Спробуй ще раз.';
  }

  // ---------- Документи people ----------
  function mineOf(people, uid) {
    return Object.keys(people).find((k) => people[k] && people[k].uid === uid) || null;
  }

  function listenPeople() {
    stopPeople();
    const { db } = NG.fb.api;
    const uid = state.user.uid;
    let decided = false;
    clearTimeout(waitTimer);
    // Немає ні кешу, ні зв’язку — не чекаємо вічно
    waitTimer = setTimeout(() => {
      if (!decided && state.phase === 'loading') setPhase('error', { error: { text: dbErrorText({ code: 'unavailable' }), retry: true } });
    }, 15000);

    unsubPeople = db.collection('people').onSnapshot({ includeMetadataChanges: true }, (snap) => {
      const people = { marko: null, nazik: null };
      snap.forEach((d) => { if (Object.prototype.hasOwnProperty.call(people, d.id)) people[d.id] = d.data(); });
      const mine = mineOf(people, uid);
      // Порожній кеш ще нічого не означає — чекаємо відповіді сервера
      if (!mine && snap.metadata.fromCache && !decided) { state.people = people; return; }
      decided = true;
      clearTimeout(waitTimer);
      state.people = people;
      state.person = mine;
      if (mine) {
        if (state.phase !== 'ready') setPhase('ready'); else emit('people');
      } else if (state.phase !== 'choose' || !snap.metadata.hasPendingWrites) {
        setPhase('choose');
      }
    }, (e) => {
      decided = true;
      clearTimeout(waitTimer);
      unsubPeople = null;
      if (e && e.code === 'permission-denied') setPhase('noaccess');
      else setPhase('error', { error: { text: dbErrorText(e), code: e && e.code, retry: true } });
    });
  }

  function stopPeople() {
    if (unsubPeople) { try { unsubPeople(); } catch (e) { /* уже зупинено */ } }
    unsubPeople = null;
  }

  // ---------- Вхід ----------
  function onAuth(u) {
    if (u) {
      state.user = { uid: u.uid, email: u.email || '', name: u.displayName || '' };
      state.authError = null;
      setPhase('loading');
      listenPeople();
    } else {
      stopPeople();
      state.user = null;
      state.person = null;
      if (!state.signingIn) setPhase('signedout');
    }
  }

  async function start() {
    if (!NG.fb.configured()) { setPhase('config'); return; }
    if (NG.utils.isFile()) { setPhase('file'); return; }
    try {
      const { auth } = await NG.fb.ready();
      auth.onAuthStateChanged(onAuth, (e) => setPhase('error', { error: { text: authErrorText(e), retry: true } }));
    } catch (e) {
      setPhase('error', { error: { text: e.code === 'sdk' ? e.message : authErrorText(e), retry: true } });
    }
  }

  async function signIn() {
    const my = ++signInTry;
    state.signingIn = true;
    state.slow = false;
    state.authError = null;
    emit('signin');
    clearTimeout(slowTimer);
    // Вікно входу іноді «зависає» (iPhone у режимі застосунку) — тоді підкажемо й дамо скасувати
    slowTimer = setTimeout(() => { if (my === signInTry && state.signingIn) { state.slow = true; emit('signin'); } }, SLOW_MS);
    try {
      const { firebase, auth } = await NG.fb.ready();
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await auth.signInWithPopup(provider);
    } catch (e) {
      if (my !== signInTry) return;
      state.authError = authErrorText(e);
    } finally {
      if (my === signInTry) {
        clearTimeout(slowTimer);
        state.signingIn = false;
        state.slow = false;
        if (!state.user) setPhase('signedout'); else emit('signin');
      }
    }
  }

  function cancelSignIn() {
    signInTry++;
    clearTimeout(slowTimer);
    state.signingIn = false;
    state.slow = false;
    emit('signin');
  }

  /** Вихід: прибираємо й локальну копію даних з цього пристрою. */
  async function signOut() {
    stopPeople();
    const a = NG.fb.api;
    try { if (a) await a.auth.signOut(); } catch (e) { /* уже вийшли */ }
    try {
      if (a) { await a.db.terminate(); await a.db.clearPersistence(); }
    } catch (e) { console.warn(e); }
    location.reload();
  }

  function retry() {
    if (!state.user) { start(); return; }
    setPhase('loading', { error: null });
    listenPeople();
  }

  // ---------- «Хто ти?» ----------
  async function choose(personId) {
    const { db } = NG.fb.api;
    const data = {
      uid: state.user.uid,
      email: state.user.email,
      googleName: state.user.name,
      myColor: NG.look.colorOf(personId, state.people),
      theme: D().defaults.theme,
      accent: D().defaults.accent,
      hot: D().defaults.hot,
      createdAt: NG.fb.serverTime(),
      updatedAt: NG.fb.serverTime()
    };
    try {
      await db.collection('people').doc(personId).set(data);
      return true;
    } catch (e) {
      NG.ui.toast(e && e.code === 'permission-denied'
        ? `«${D().people[personId].name}» уже обрано іншим акаунтом.`
        : 'Не вдалося зберегти вибір' + (e && e.code ? ` (${e.code})` : '') + '. Спробуй ще раз.', { type: 'error' });
      return false;
    }
  }

  // ---------- Особисті налаштування вигляду ----------
  /** savePrefs({ theme | accent | hot | myColor }) — запис у people/{я}. → true / false */
  async function savePrefs(changes) {
    if (!state.person) return false;
    const ref = NG.fb.api.db.collection('people').doc(state.person);
    try {
      await ref.update(Object.assign({}, changes, { updatedAt: NG.fb.serverTime() }));
      return true;
    } catch (e) {
      NG.ui.toast('Не вдалося зберегти' + (e && e.code ? ` (${e.code})` : '') + '. Зміну скасовано.', { type: 'error' });
      return false;
    }
  }

  NG.session = {
    state, start, signIn, cancelSignIn, signOut, retry, choose, savePrefs,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    me() { return state.person ? state.people[state.person] : null; },
    partnerId() { return state.person ? D().people[state.person].partner : null; }
  };
})(window.NG);
