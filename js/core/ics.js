// Формат .ics (iCalendar): выгрузка задач и событий в Календарь iPhone с напоминаниями (VALARM),
// а также экспорт и импорт всего календаря.

import { pad, parseYmd, addDays, toMin, fromMin, ymd } from './dates.js';

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const unesc = (s) => String(s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
const dCompact = (date) => date.replace(/-/g, '');
const tCompact = (time) => time.replace(':', '') + '00';

// Длинные строки по стандарту переносятся (не больше 75 байт)
function fold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > 73) { out.push(cur); cur = ' '; bytes = 1; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

function stamp(d = new Date()) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function rrule(repeat) {
  if (!repeat) return null;
  let r = { daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY' }[repeat.type];
  if (repeat.type === 'days') r = repeat.days?.length ? `FREQ=WEEKLY;BYDAY=${repeat.days.map((d) => DAY_CODES[d]).join(',')}` : 'FREQ=DAILY';
  if (r && repeat.until) r += `;UNTIL=${dCompact(repeat.until)}T235959`;
  return r;
}

// Одно событие VEVENT. item: { id, title, notes, location, date, start, duration, repeat, exDates }, alarms — минуты «за сколько»
function vevent(item, alarms = []) {
  const L = ['BEGIN:VEVENT', `UID:${item.id}@said-os`, `DTSTAMP:${stamp()}`, `SUMMARY:${esc(item.title)}`];
  if (item.start) {
    // «Плавающее» местное время: событие будет в то же время по часам устройства
    const endMin = toMin(item.start) + (item.duration || 30);
    const endDate = addDays(item.date, Math.floor(endMin / 1440));
    L.push(`DTSTART:${dCompact(item.date)}T${tCompact(item.start)}`, `DTEND:${dCompact(endDate)}T${tCompact(fromMin(endMin))}`);
  } else {
    L.push(`DTSTART;VALUE=DATE:${dCompact(item.date)}`, `DTEND;VALUE=DATE:${dCompact(addDays(item.date, 1))}`);
  }
  if (item.notes) L.push(`DESCRIPTION:${esc(item.notes)}`);
  if (item.location) L.push(`LOCATION:${esc(item.location)}`);
  const rr = rrule(item.repeat);
  if (rr) L.push(`RRULE:${rr}`);
  for (const ex of item.exDates || []) L.push(item.start ? `EXDATE:${dCompact(ex)}T${tCompact(item.start)}` : `EXDATE;VALUE=DATE:${dCompact(ex)}`);
  for (const min of alarms) {
    // Для события «на весь день» отсчёт идёт от полуночи: «в 9:00 этого дня» = +9 часов
    const trigger = item.start ? (min === 0 ? 'PT0M' : `-PT${min}M`) : (min === 0 ? 'PT9H' : `-PT${Math.max(min - 540, 0)}M`);
    L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(item.title)}`, `TRIGGER:${trigger}`, 'END:VALARM');
  }
  L.push('END:VEVENT');
  return L;
}

export function buildIcs(items, alarmsFor = () => []) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SAID OS//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const it of items) lines.push(...vevent(it, alarmsFor(it)));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// Задача → вид события для .ics (задача со временем занимает 30 минут)
export const taskAsEvent = (t) => ({ id: t.id, title: t.title, notes: t.notes, date: t.date, start: t.time, duration: 30, repeat: t.repeat });

// ---------- Импорт ----------
function parseDt(value) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(value.trim());
  if (!m) return null;
  if (!m[4]) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: null };
  if (m[7]) { // UTC → местное время
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    return { date: ymd(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
}
function parseRrule(v) {
  const p = Object.fromEntries(v.split(';').map((x) => x.split('=')));
  if (p.INTERVAL && p.INTERVAL !== '1') return null; // «раз в 2 недели» пока не поддерживаем
  let repeat = null;
  if (p.FREQ === 'DAILY') repeat = { type: 'daily' };
  else if (p.FREQ === 'MONTHLY') repeat = { type: 'monthly' };
  else if (p.FREQ === 'WEEKLY') {
    const days = (p.BYDAY || '').split(',').map((d) => DAY_CODES.indexOf(d.slice(-2))).filter((d) => d >= 0);
    repeat = days.length > 1 ? { type: 'days', days } : { type: 'weekly' };
  }
  if (repeat && p.UNTIL) { const u = parseDt(p.UNTIL); if (u) repeat.until = u.date; }
  return repeat;
}
function parseDurationMin(v) {
  const m = /P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/.exec(v);
  return m ? (+m[1] || 0) * 10080 + (+m[2] || 0) * 1440 + (+m[3] || 0) * 60 + (+m[4] || 0) : 60;
}

// Разобрать .ics → список событий в формате приложения
export function parseIcs(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let cur = null, inAlarm = false;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { exDates: [] }; continue; }
    if (line === 'END:VEVENT') {
      if (cur?.date && cur.title) {
        if (cur.start && cur.end) {
          const mins = Math.round((parseYmd(cur.end.date) - parseYmd(cur.date)) / 60000) + toMin(cur.end.time || '00:00') - toMin(cur.start);
          cur.duration = Math.max(5, mins);
        } else if (cur.start && !cur.duration) cur.duration = 60;
        if (!cur.start) cur.duration = 60;
        delete cur.end;
        events.push(cur);
      }
      cur = null; continue;
    }
    if (!cur) continue;
    if (line === 'BEGIN:VALARM') { inAlarm = true; continue; }
    if (line === 'END:VALARM') { inAlarm = false; continue; }
    if (inAlarm) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const name = line.slice(0, i).split(';')[0].toUpperCase();
    const value = line.slice(i + 1);
    if (name === 'SUMMARY') cur.title = unesc(value);
    else if (name === 'DESCRIPTION') cur.notes = unesc(value);
    else if (name === 'LOCATION') cur.location = unesc(value);
    else if (name === 'DTSTART') { const d = parseDt(value); if (d) { cur.date = d.date; cur.start = d.time; } }
    else if (name === 'DTEND') { const d = parseDt(value); if (d) cur.end = d; }
    else if (name === 'DURATION') cur.duration = parseDurationMin(value);
    else if (name === 'RRULE') cur.repeat = parseRrule(value);
    else if (name === 'EXDATE') value.split(',').forEach((v) => { const d = parseDt(v); if (d) cur.exDates.push(d.date); });
    else if (name === 'UID') cur.uid = value;
  }
  return events;
}
