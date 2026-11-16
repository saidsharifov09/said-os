// Повторения задач и событий.
// repeat = null | { type: 'daily' | 'weekly' | 'monthly' | 'days', days?: [0..6] }  (0 = воскресенье)

import { addDays, addMonths, weekday, diffDays, parseYmd, WD_SHORT, WEEK_ORDER } from './dates.js';

export const REPEAT_OPTIONS = [
  { v: '', label: 'Не повторять' },
  { v: 'daily', label: 'Каждый день' },
  { v: 'weekly', label: 'Каждую неделю' },
  { v: 'monthly', label: 'Каждый месяц' },
  { v: 'days', label: 'По дням недели' },
];

export function repeatLabel(r) {
  if (!r) return '';
  if (r.type === 'days') {
    const days = WEEK_ORDER.filter((d) => (r.days || []).includes(d)).map((d) => WD_SHORT[d]);
    return days.length ? `по ${days.join(', ')}` : 'по дням';
  }
  return REPEAT_OPTIONS.find((o) => o.v === r.type)?.label.toLowerCase() || '';
}

// Следующая дата повторения строго после from. start — дата начала серии (нужна для месяца).
export function nextDate(repeat, from, start = from) {
  if (!repeat) return null;
  switch (repeat.type) {
    case 'daily': return addDays(from, 1);
    case 'weekly': return addDays(from, 7);
    case 'monthly': return addMonths(from, 1, parseYmd(start).getDate());
    case 'days': {
      const days = repeat.days || [];
      if (!days.length) return addDays(from, 1);
      for (let i = 1; i <= 7; i++) {
        const d = addDays(from, i);
        if (days.includes(weekday(d))) return d;
      }
      return null;
    }
    default: return null;
  }
}

// Выпадает ли повторяющаяся запись (с началом item.date) на дату date
export function occursOn(item, date) {
  if (!item.date) return false;
  if (item.exDates?.includes(date)) return false;
  if (date === item.date) return true;
  const r = item.repeat;
  if (!r || date < item.date) return false;
  if (r.until && date > r.until) return false;
  switch (r.type) {
    case 'daily': return true;
    case 'weekly': return diffDays(item.date, date) % 7 === 0;
    case 'days': return (r.days || []).includes(weekday(date));
    case 'monthly': {
      const startDay = parseYmd(item.date).getDate();
      const d = parseYmd(date);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(startDay, last);
    }
    default: return false;
  }
}
