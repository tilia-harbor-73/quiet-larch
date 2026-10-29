/* ==========================================================================
   js/core/utils.js — дрібні помічники: дати за київським часом (ТЗ 26.4),
   номер тижня, форматування дати для верхньої панелі, ініціали,
   localStorage без помилок.
   Оновлено: 29.10.2026 · Етап 1, крок 1
   ========================================================================== */
window.NG = window.NG || {};

(function (NG) {
  'use strict';

  const TZ = 'Europe/Kyiv';
  const pad = (n) => String(n).padStart(2, '0');

  const partsFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });

  /** Частини дати й часу за Києвом: { year, month, day, hour, minute }. */
  function kyivParts(date) {
    const o = {};
    partsFmt.formatToParts(date || new Date()).forEach((p) => {
      if (p.type !== 'literal') o[p.type] = Number(p.value);
    });
    return o;
  }

  /** Сьогоднішня дата за Києвом: 'РРРР-ММ-ДД'. */
  function today() {
    const p = kyivParts();
    return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  }

  function toUTC(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  /** Номер тижня за ISO (тиждень з понеділка): '2026-10-27' → 44. */
  function isoWeek(iso) {
    const t = toUTC(iso);
    const dow = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dow);
    const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }

  const WEEKDAYS = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'п’ятниця', 'субота'];
  const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

  /** '2026-10-27' → 'Вівторок, 27 жовтня' */
  function dateHeading(iso) {
    const t = toUTC(iso);
    return `${cap(WEEKDAYS[t.getUTCDay()])}, ${t.getUTCDate()} ${MONTHS_GEN[t.getUTCMonth()]}`;
  }

  /** '2026-10-29' → '29 жовтня 2026' */
  function dateLong(iso) {
    const t = toUTC(iso);
    return `${t.getUTCDate()} ${MONTHS_GEN[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
  }

  /** 44 → '44-й тиждень' */
  const weekLabel = (n) => `${n}-й тиждень`;

  /** Перша літера імені великою: 'Марко' → 'М'. */
  const initial = (name) => (String(name || '').trim().charAt(0) || '?').toUpperCase();

  /** localStorage із префіксом ng. — без помилок у приватному режимі. */
  const ls = {
    get(key, def) {
      try {
        const v = localStorage.getItem('ng.' + key);
        return v == null ? def : JSON.parse(v);
      } catch (e) { return def; }
    },
    set(key, value) {
      try {
        if (value == null) localStorage.removeItem('ng.' + key);
        else localStorage.setItem('ng.' + key, JSON.stringify(value));
      } catch (e) { /* сховище недоступне — не критично */ }
    }
  };

  const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  const isFile = () => location.protocol === 'file:';

  NG.utils = { TZ, pad, kyivParts, today, isoWeek, dateHeading, dateLong, weekLabel, cap, initial, ls, isMac, isFile };
})(window.NG);
