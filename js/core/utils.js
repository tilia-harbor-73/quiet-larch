/* ==========================================================================
   js/core/utils.js — дрібні помічники: дати за київським часом (ТЗ 26.4),
   номер тижня, форматування дат, навчальний рік, ініціали, відмінки чисел,
   нормалізація тексту для пошуку, localStorage без помилок.
   Оновлено: 30.10.2026 · Етап 1, крок 2
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

  /** Дата за Києвом для моменту часу (ISO-рядок, Date або мілісекунди): 'РРРР-ММ-ДД'. */
  function kyivDay(t) {
    if (t == null || t === '') return '';
    const d = t instanceof Date ? t : new Date(t);
    if (isNaN(d)) return '';
    const p = kyivParts(d);
    return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  }

  /** Навчальний рік дати: з 1 вересня — цей рік, до 1 вересня — попередній ('2026-10-30' → 2026, '2027-08-25' → 2026). */
  function academicYear(iso) {
    const [y, m] = iso.split('-').map(Number);
    return m >= 9 ? y : y - 1;
  }

  /** '2026-10-30' + 3 місяці → '2027-01-30' (31 число → останній день коротшого місяця). */
  function addMonths(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1 + n, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(Math.min(d, last))}`;
  }

  /** '2026-10-30' → '30.10.2026' */
  function dateShort(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  /** Момент часу → '30.10.2026, 14:05' (за Києвом). */
  function dateTimeShort(t) {
    if (!t) return '';
    const d = t instanceof Date ? t : new Date(t);
    if (isNaN(d)) return '';
    const p = kyivParts(d);
    return `${pad(p.day)}.${pad(p.month)}.${p.year}, ${pad(p.hour)}:${pad(p.minute)}`;
  }

  /** Відмінок за числом: plural(3, ['клієнт', 'клієнти', 'клієнтів']) → 'клієнти'. */
  function plural(n, forms) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b === 1) return forms[0];
    if (b >= 2 && b <= 4) return forms[1];
    return forms[2];
  }

  /** Текст для пошуку: малі літери, один вид апострофа, без зайвих пробілів. */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[’ʼ`´‘]/g, '\'').replace(/\s+/g, ' ').trim();
  }

  /** Лише цифри (для пошуку за телефоном). */
  const digits = (s) => String(s == null ? '' : s).replace(/\D+/g, '');

  /** Випадковий ідентифікатор (для записів історії змін). */
  function uid() {
    const a = new Uint8Array(10);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.from(a, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 16);
  }

  const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  const isFile = () => location.protocol === 'file:';

  NG.utils = {
    TZ, pad, kyivParts, today, isoWeek, dateHeading, dateLong, weekLabel, cap, initial, ls, isMac, isFile,
    kyivDay, academicYear, addMonths, dateShort, dateTimeShort, plural, norm, digits, uid
  };
})(window.NG);
