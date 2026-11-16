// Работа с датами. Дата везде хранится строкой 'YYYY-MM-DD' (местное время),
// время — строкой 'HH:MM'. Так данные не ломаются при смене часового пояса.

export const WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
export const WD_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
export const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
// Порядок дней недели для интерфейса: с понедельника
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const pad = (n) => String(n).padStart(2, '0');

export function ymd(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const today = () => ymd(new Date());
export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
// Прибавить месяцы; если такого числа в месяце нет — берём последний день
export function addMonths(s, n, dayOfMonth) {
  const d = parseYmd(s);
  const day = dayOfMonth || d.getDate();
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  first.setDate(Math.min(day, last));
  return ymd(first);
}
// Разница b − a в днях
export function diffDays(a, b) {
  return Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
}
export const weekday = (s) => parseYmd(s).getDay();
// Понедельник недели, в которую входит дата
export function weekStart(s) {
  return addDays(s, -((weekday(s) + 6) % 7));
}
export const monthStart = (s) => s.slice(0, 8) + '01';

export const toMin = (hm) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};
export const fromMin = (n) => {
  n = ((Math.round(n) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
};
export function nowHM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Дата+время → объект Date
export function toDate(date, time) {
  const d = parseYmd(date);
  if (time) {
    const m = toMin(time);
    d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  }
  return d;
}

// «Сегодня», «Завтра», «пн, 16 ноя»
export function fmtRel(s) {
  if (!s) return 'Без даты';
  const diff = diffDays(today(), s);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  if (diff === 2) return 'Послезавтра';
  if (diff === -1) return 'Вчера';
  return fmtShort(s);
}
export function fmtShort(s) {
  const d = parseYmd(s);
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${WD_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${year}`;
}
// «понедельник, 16 ноября»
export function fmtFull(s) {
  const d = parseYmd(s);
  return `${WD_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}
export function fmtMonth(s) {
  const d = parseYmd(s);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtDuration(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return [h ? `${h} ч` : '', m ? `${m} мин` : ''].filter(Boolean).join(' ');
}
export function fmtDateTime(ts) {
  const d = new Date(ts);
  return `${fmtRel(ymd(d))}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
