// Простое распознавание русских дат и времени в тексте: «завтра», «в пятницу», «через неделю», «в 15:00».
// Результат — только ПОДСКАЗКА: пользователь видит её и может убрать одним нажатием.

import { ymd, addDays, addMonths, weekday, fmtRel, pad } from './dates.js';

const L = 'а-яёa-z0-9'; // «буквы» для границ слов (в JS \b не работает с кириллицей)
const B = `(^|[^${L}])`; // левая граница
const E = `(?![${L}])`; // правая граница

const WEEKDAYS = {
  понедельник: 1, пн: 1, вторник: 2, вт: 2, среду: 3, среда: 3, ср: 3, четверг: 4, чт: 4,
  пятницу: 5, пятница: 5, пт: 5, субботу: 6, суббота: 6, сб: 6, воскресенье: 0, вс: 0,
};
const MONTHS = { января: 0, февраля: 1, марта: 2, апреля: 3, мая: 4, июня: 5, июля: 6, августа: 7, сентября: 8, октября: 9, ноября: 10, декабря: 11 };

const validTime = (h, m) => h >= 0 && h <= 23 && m >= 0 && m <= 59;

export function parseRu(text, now = new Date()) {
  const src = text;
  const low = text.toLowerCase();
  const todayStr = ymd(now);
  let date = null, time = null;
  const spans = []; // найденные куски текста [начало, конец]

  // Ищет шаблон; левая граница — первая группа, её в найденный кусок не включаем
  const find = (re, fn) => {
    const m = new RegExp(B + re + E, 'i').exec(low);
    if (!m) return false;
    const start = m.index + m[1].length;
    const res = fn(m.slice(2));
    if (res === false) return false;
    spans.push([start, m.index + m[0].length]);
    return true;
  };

  // --- Дата ---
  find('(послезавтра|завтра|сегодня)', ([w]) => { date = addDays(todayStr, { сегодня: 0, завтра: 1, послезавтра: 2 }[w]); })
  || find('(?:в|во)\\s+следующ(?:ий|ую|ее)\\s+(' + Object.keys(WEEKDAYS).join('|') + ')', ([w]) => {
    const nextMonday = addDays(todayStr, 7 - ((weekday(todayStr) + 6) % 7));
    date = addDays(nextMonday, (WEEKDAYS[w] + 6) % 7);
  })
  || find('(?:в|во)\\s+(' + Object.keys(WEEKDAYS).join('|') + ')', ([w]) => {
    const diff = (WEEKDAYS[w] - weekday(todayStr) + 7) % 7 || 7;
    date = addDays(todayStr, diff);
  })
  || find('через\\s+(?:(\\d{1,3})\\s+)?(день|дня|дней|неделю|недели|недель|месяц|месяца|месяцев|год|года|лет)', ([n, unit]) => {
    const k = n ? Number(n) : 1;
    if (unit.startsWith('д')) date = addDays(todayStr, k);
    else if (unit.startsWith('н')) date = addDays(todayStr, 7 * k);
    else if (unit.startsWith('м')) date = addMonths(todayStr, k);
    else date = addMonths(todayStr, 12 * k);
  })
  || find('на\\s+следующей\\s+неделе', () => { date = addDays(todayStr, 7 - ((weekday(todayStr) + 6) % 7)); })
  || find('на\\s+выходных', () => { date = addDays(todayStr, (6 - weekday(todayStr) + 7) % 7); })
  || find('(\\d{1,2})\\s+(' + Object.keys(MONTHS).join('|') + ')(?:\\s+(\\d{4}))?', ([d, mon, y]) => {
    const day = Number(d);
    if (day < 1 || day > 31) return false;
    let year = y ? Number(y) : now.getFullYear();
    let cand = `${year}-${pad(MONTHS[mon] + 1)}-${pad(day)}`;
    if (!y && cand < todayStr) cand = `${year + 1}-${pad(MONTHS[mon] + 1)}-${pad(day)}`;
    date = cand;
  })
  || find('(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{4}|\\d{2}))?', ([d, mo, y]) => {
    const day = Number(d), month = Number(mo);
    if (day < 1 || day > 31 || month < 1 || month > 12) return false;
    let year = y ? Number(y.length === 2 ? '20' + y : y) : now.getFullYear();
    let cand = `${year}-${pad(month)}-${pad(day)}`;
    if (!y && cand < todayStr) cand = `${year + 1}-${pad(month)}-${pad(day)}`;
    date = cand;
  });

  // --- Время ---
  find('(?:(?:в|к)\\s+)?(\\d{1,2}):(\\d{2})', ([h, m]) => {
    if (!validTime(+h, +m)) return false;
    time = `${pad(+h)}:${pad(+m)}`;
  })
  || find('(?:в|к)\\s+(\\d{1,2})\\s*(?:часов|часа|час|ч)?\\s*(утра|вечера|дня|ночи)', ([h, part]) => {
    let hh = +h;
    if ((part === 'вечера' || part === 'дня') && hh < 12) hh += 12;
    if (part === 'ночи' && hh === 12) hh = 0;
    if (!validTime(hh, 0)) return false;
    time = `${pad(hh)}:00`;
  })
  || find('(?:в|к)\\s+(\\d{1,2})\\s*(?:часов|часа|час|ч)', ([h]) => {
    if (!validTime(+h, 0)) return false;
    time = `${pad(+h)}:00`;
  })
  || find('через\\s+(?:(\\d{1,3})\\s+)?(полчаса|час|часа|часов|минуту|минуты|минут|мин)', ([n, unit]) => {
    let mins = unit === 'полчаса' ? 30 : unit.startsWith('ч') ? 60 * (n ? +n : 1) : (n ? +n : 1);
    const t = new Date(now.getTime() + mins * 60000);
    time = `${pad(t.getHours())}:${pad(t.getMinutes())}`;
    if (!date) date = ymd(t);
  });

  if (!date && !time) return null;
  if (!date) {
    // Только время: сегодня, а если оно уже прошло — завтра
    const cur = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    date = time > cur ? todayStr : addDays(todayStr, 1);
  }

  // Текст без распознанных кусков (его предложим как название)
  let clean = src;
  spans.sort((a, b) => b[0] - a[0]).forEach(([s, e]) => { clean = clean.slice(0, s) + ' ' + clean.slice(e); });
  clean = clean.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').replace(/^[\s,.-]+|[\s,-]+$/g, '');

  return { date, time, clean: clean || src.trim(), label: hintLabel({ date, time }, now) };
}

export function hintLabel(hint) {
  if (!hint?.date) return '';
  return fmtRel(hint.date) + (hint.time ? `, ${hint.time}` : '');
}

const URL_RE = /https?:\/\/[^\s<>"']+/gi;
export const findUrls = (text) => (text || '').match(URL_RE) || [];
