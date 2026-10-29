/* ==========================================================================
   js/look.js — вигляд: тема (ТЗ 2.2), колір інтерфейсу (2.3), кольори
   Марка й Назіка (2.7), колір «горить» (2.8).

   Звідки береться: з документа людини в базі (people/{я}), тож однаково
   на комп’ютері й телефоні (рішення П11). Копія — у localStorage цього
   пристрою, щоб при запуску не було «блимання» (див. скрипт у index.html).
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const D = () => NG.dict;
  const mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let last = '';
  let pending = {}; // щойно змінене, поки база ще не підтвердила запис

  function mine() {
    const me = NG.session && NG.session.me();
    return me ? Object.assign({}, me, pending) : null;
  }

  /** Поточний вибір: з бази (якщо увійшли) або з копії на пристрої. */
  function prefs() {
    const src = mine() || NG.utils.ls.get('look', {}) || {};
    const def = D().defaults;
    return {
      theme: D().isTheme(src.theme) ? src.theme : def.theme,
      accent: D().isColor(src.accent) ? src.accent : def.accent,
      hot: D().isHot(src.hot) ? src.hot : def.hot
    };
  }

  /** Тема, що діє зараз: 'dark' | 'light'. */
  function resolvedTheme(pref) {
    const p = pref || prefs().theme;
    if (p === 'light' || p === 'dark') return p;
    return mql && !mql.matches ? 'light' : 'dark';
  }

  /**
   * «Мій колір» людини (ТЗ 2.7). Якщо людина ще не обирала — колір за
   * замовчуванням (Марко — бурштиновий, Назік — бірюзовий), а якщо його вже
   * взяв партнер — перший вільний з палітри: однакових кольорів не буває.
   */
  function colorOf(personId, peopleIn) {
    const people = Object.assign({}, peopleIn || (NG.session ? NG.session.state.people : {}) || {});
    if (!peopleIn && NG.session && NG.session.state.person && pending.myColor) {
      const me = NG.session.state.person;
      people[me] = Object.assign({}, people[me], { myColor: pending.myColor });
    }
    const own = people[personId];
    if (own && D().isColor(own.myColor)) return own.myColor;
    const partnerId = D().people[personId].partner;
    const partner = people[partnerId];
    const taken = partner && D().isColor(partner.myColor) ? partner.myColor : D().people[partnerId].color;
    const def = D().people[personId].color;
    if (def !== taken) return def;
    return D().palette.find((c) => c.id !== taken).id;
  }

  function apply() {
    const p = prefs();
    const theme = resolvedTheme(p.theme);
    const root = document.documentElement;
    const cm = colorOf('marko');
    const cn = colorOf('nazik');
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-accent', p.accent);
    root.setAttribute('data-hot', p.hot);
    root.style.setProperty('--c-marko', `var(--pal-${cm})`);
    root.style.setProperty('--c-nazik', `var(--pal-${cn})`);
    // Колір рядка стану телефона — як фон меню
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#16130f' : '#efeae0');
    if (mine()) NG.utils.ls.set('look', { theme: p.theme, accent: p.accent, hot: p.hot });
    const sig = [theme, p.theme, p.accent, p.hot, cm, cn].join('|');
    if (sig !== last) {
      last = sig;
      document.dispatchEvent(new CustomEvent('ng:look'));
    }
  }

  /** Змінити й зберегти: set({ theme: 'light' }) або set({ myColor: 'green' }). */
  async function set(changes) {
    Object.assign(pending, changes);
    apply(); // одразу на екрані
    const ok = await NG.session.savePrefs(changes);
    if (!ok) {
      Object.keys(changes).forEach((k) => { if (pending[k] === changes[k]) delete pending[k]; });
      apply();
    }
    return ok;
  }

  /** База підтвердила — прибираємо «щойно змінене», яке вже збігається з базою. */
  function syncPending() {
    const me = NG.session && NG.session.me();
    if (!me) { pending = {}; return; }
    Object.keys(pending).forEach((k) => { if (me[k] === pending[k]) delete pending[k]; });
  }

  if (mql && mql.addEventListener) mql.addEventListener('change', () => { if (prefs().theme === 'system') apply(); });

  NG.look = { prefs, resolvedTheme, colorOf, apply, set, syncPending };
})(window.NG);
