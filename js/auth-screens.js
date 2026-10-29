/* ==========================================================================
   js/auth-screens.js — екрани до входу в CRM: завантаження, «Увійти через
   Google» (ТЗ 3.4), «Немає доступу» (ТЗ 3.5), «Хто ти?» при першому вході,
   а також підказки, якщо Firebase ще не налаштовано.
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const { h } = NG.ui;
  const D = () => NG.dict;

  function frame(...children) {
    return h('div', { class: 'gate' },
      h('div', { class: 'gate-card' },
        h('div', { class: 'gate-brand' }, NG.logo(30), h('span', null, 'NewGen')),
        children));
  }

  function callout(kind, text) {
    return h('div', { class: 'callout callout-' + kind, role: kind === 'error' ? 'alert' : null },
      NG.icon(kind === 'error' ? 'alert' : 'info', { size: 'sm' }), h('span', null, text));
  }

  function boot() {
    return h('div', { class: 'gate gate-boot', 'aria-busy': 'true' },
      h('div', { class: 'boot-mark' }, NG.logo(44)), h('span', { class: 'sr-only' }, 'Завантаження…'));
  }

  function signedOut(st) {
    const btn = NG.ui.button({
      label: st.signingIn ? 'Чекаю на Google…' : 'Увійти через Google', variant: 'primary', className: 'btn-wide',
      disabled: st.signingIn, onClick: () => NG.session.signIn()
    });
    // Firebase вантажимо, щойно видно намір увійти, — щоб вікно Google не заблокувалось
    ['pointerenter', 'focus', 'touchstart'].forEach((ev) => btn.addEventListener(ev, () => NG.fb.loadSdk().catch(() => {}), { once: true, passive: true }));
    return frame(
      h('h1', { class: 'gate-title' }, 'Вхід'),
      h('p', { class: 'gate-text' }, 'Увійди своїм Google-акаунтом.'),
      btn,
      st.slow ? h('div', { class: 'gate-slow' },
        callout('info', 'Вхід не завершився? Якщо вікно Google закрилося чи зависло — скасуй і спробуй ще раз.'),
        NG.ui.button({ label: 'Скасувати', size: 'sm', onClick: () => NG.session.cancelSignIn() })) : null,
      st.authError ? callout('error', st.authError) : null);
  }

  function noAccess(st) {
    return frame(
      h('div', { class: 'gate-icon' }, NG.icon('shield', { size: 'lg' })),
      h('h1', { class: 'gate-title' }, 'Немає доступу'),
      h('p', { class: 'gate-text' }, 'Акаунт ', h('strong', null, st.user ? st.user.email : ''), ' не має доступу до цієї CRM.'),
      NG.ui.button({ label: 'Увійти іншим акаунтом', variant: 'primary', className: 'btn-wide', onClick: () => NG.session.signOut() }),
      h('p', { class: 'gate-note' }, 'Якщо це твій акаунт — перевір у консолі Firebase правила доступу (Firestore → Rules): там має бути саме ця адреса, і правила мають бути опубліковані.'));
  }

  function choose(st) {
    const cards = ['marko', 'nazik'].map((id) => {
      const p = D().people[id];
      const owner = st.people[id];
      const taken = !!owner;
      return h('button', {
        type: 'button', class: 'who' + (taken ? ' is-taken' : ''), disabled: taken,
        style: { '--pc': `var(--pal-${NG.look.colorOf(id)})` },
        onClick: () => pick(id, st)
      },
      h('span', { class: 'avatar avatar-xl', style: { '--pc': `var(--pal-${NG.look.colorOf(id)})` } }, p.initial),
      h('span', { class: 'who-name' }, p.name),
      h('span', { class: 'who-sub' }, taken ? 'уже обрано іншим акаунтом' : 'це я'));
    });
    const bothTaken = st.people.marko && st.people.nazik;
    return frame(
      h('h1', { class: 'gate-title' }, 'Хто ти?'),
      h('p', { class: 'gate-text' }, 'Обери один раз — CRM запам’ятає, що акаунт ', h('strong', null, st.user.email), ' твій.'),
      h('div', { class: 'who-list' }, cards),
      bothTaken ? callout('error', 'Обидва місця вже зайняті іншими акаунтами. Увійди своїм акаунтом.') : null,
      NG.ui.button({ label: 'Вийти', size: 'sm', className: 'gate-link', onClick: () => NG.session.signOut() }));
  }

  async function pick(id, st) {
    const p = D().people[id];
    const ok = await NG.ui.confirm({
      title: `Ти — ${p.name}?`,
      text: `Акаунт ${st.user.email} буде закріплено за «${p.name}». Змінити це потім можна лише в консолі Firebase.`,
      confirmText: `Так, я ${p.name}`
    });
    if (!ok) return;
    document.querySelectorAll('.who').forEach((b) => { b.disabled = true; });
    const saved = await NG.session.choose(id);
    if (!saved) NG.app.render();
  }

  function notConfigured() {
    return frame(
      h('h1', { class: 'gate-title' }, 'Firebase ще не налаштовано'),
      h('p', { class: 'gate-text' }, 'У файлі js/firebase-config.js ще не вписано адресу проєкту Firebase. Після цього тут з’явиться кнопка входу.'));
  }

  function fileMode() {
    return frame(
      h('h1', { class: 'gate-title' }, 'Відкрий за адресою сайту'),
      h('p', { class: 'gate-text' }, 'Вхід через Google не працює, коли сторінку відкрито як файл з комп’ютера. Відкрий CRM за адресою сайту на GitHub Pages.'));
  }

  function error(st) {
    return frame(
      h('h1', { class: 'gate-title' }, 'Щось пішло не так'),
      callout('error', (st.error && st.error.text) || 'Невідома помилка.'),
      h('div', { class: 'gate-actions' },
        NG.ui.button({ label: 'Спробувати ще раз', icon: 'refresh', variant: 'primary', onClick: () => NG.session.retry() }),
        st.user ? NG.ui.button({ label: 'Вийти', onClick: () => NG.session.signOut() }) : null));
  }

  /** Екран для поточного стану входу (крім 'ready'). */
  function screen(st) {
    switch (st.phase) {
      case 'config': return notConfigured();
      case 'file': return fileMode();
      case 'signedout': return signedOut(st);
      case 'noaccess': return noAccess(st);
      case 'choose': return choose(st);
      case 'error': return error(st);
      default: return boot();
    }
  }

  NG.gate = { screen };
})(window.NG);
