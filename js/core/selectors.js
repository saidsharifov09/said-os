// Выборки из данных: «задачи на сегодня», «события дня», «прогресс» и т. п. Только чтение.

import * as store from './store.js';
import { today, addDays, weekStart, ymd, toMin } from './dates.js';
import { occursOn } from './recur.js';

export const TASK_BUCKETS = [
  { v: 'today', label: 'Сегодня' },
  { v: 'tomorrow', label: 'Завтра' },
  { v: 'week', label: 'Неделя' },
  { v: 'future', label: 'Будущее' },
  { v: 'nodate', label: 'Без даты' },
  { v: 'overdue', label: 'Просрочено' },
  { v: 'done', label: 'Выполнено' },
];

export const isOverdue = (t) => t.status !== 'done' && !!t.date && t.date < today();

// В какой раздел попадает задача
export function bucketOf(t, now = today()) {
  if (t.status === 'done') return 'done';
  if (!t.date) return 'nodate';
  if (t.date < now) return 'overdue';
  if (t.date === now) return 'today';
  if (t.date === addDays(now, 1)) return 'tomorrow';
  if (t.date <= addDays(weekStart(now), 6)) return 'week';
  return 'future';
}

export function tasksIn(bucket) {
  const list = store.all('tasks').filter((t) => bucketOf(t) === bucket);
  return bucket === 'done' ? list.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)) : sortTasks(list, 'time');
}
export function bucketCounts() {
  const c = Object.fromEntries(TASK_BUCKETS.map((b) => [b.v, 0]));
  store.all('tasks').forEach((t) => { c[bucketOf(t)]++; });
  return c;
}

export const SORTS = [
  { v: 'time', label: 'По дате и времени' },
  { v: 'priority', label: 'По приоритету' },
  { v: 'new', label: 'Сначала новые' },
  { v: 'alpha', label: 'По алфавиту' },
];
export function sortTasks(list, mode = 'time') {
  const byTime = (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '99:99').localeCompare(b.time || '99:99')
    || (b.priority || 0) - (a.priority || 0) || a.createdAt - b.createdAt;
  const fns = {
    time: byTime,
    priority: (a, b) => (b.priority || 0) - (a.priority || 0) || byTime(a, b),
    new: (a, b) => b.createdAt - a.createdAt,
    alpha: (a, b) => a.title.localeCompare(b.title, 'ru'),
  };
  return [...list].sort(fns[mode] || byTime);
}

// Открытые задачи на дату
export const tasksOn = (date) => sortTasks(store.all('tasks').filter((t) => t.status !== 'done' && t.date === date));
// Задачи, выполненные в этот день
export const tasksDoneOn = (date) => store.all('tasks').filter((t) => t.status === 'done' && t.doneAt && ymd(new Date(t.doneAt)) === date);
export const overdueTasks = () => sortTasks(store.all('tasks').filter(isOverdue));

// События на дату (с учётом повторов). Возвращает [{ ev, date, done }], отсортировано по времени
export function eventsOn(date) {
  return store.all('events')
    .filter((e) => occursOn(e, date))
    .map((ev) => ({ ev, date, done: !!ev.doneDates?.includes(date) }))
    .sort((a, b) => (a.ev.start || '').localeCompare(b.ev.start || ''));
}

// Расписание дня: события и задачи со временем, строго по времени
export function schedule(date) {
  const items = [];
  for (const o of eventsOn(date)) if (o.ev.start) items.push({ kind: 'event', time: o.ev.start, end: toMin(o.ev.start) + (o.ev.duration || 0), ...o });
  for (const t of store.all('tasks')) {
    if (t.date === date && t.time && t.status !== 'done') items.push({ kind: 'task', time: t.time, end: toMin(t.time), task: t });
  }
  return items.sort((a, b) => a.time.localeCompare(b.time));
}

// Прогресс дня: сколько из сегодняшних задач выполнено
export function progress(date = today()) {
  const done = tasksDoneOn(date).length;
  const open = tasksOn(date).length;
  const total = done + open;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

// Три главных приоритета дня
export const focusTasks = (date = today()) => store.all('tasks').filter((t) => t.focusDate === date)
  .sort((a, b) => (a.focusOrder || 0) - (b.focusOrder || 0));

export const categoryOf = (id) => (id ? store.get('categories', id) : null);
export const categories = () => store.all('categories').sort((a, b) => (a.order || 0) - (b.order || 0));
export const sections = () => store.all('sections').sort((a, b) => (a.order || 0) - (b.order || 0));

// ---------- Цели ----------
export function goalProgress(goal) {
  const ms = goal.milestones || [];
  const tasks = store.all('tasks').filter((t) => t.goalId === goal.id);
  const total = ms.length + tasks.length;
  const done = ms.filter((m) => m.done).length + tasks.filter((t) => t.status === 'done').length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : (goal.status === 'done' ? 100 : 0), tasks };
}

// ---------- Привычки ----------
// Запланирована ли привычка на дату (days — дни недели; пусто = каждый день)
export const habitDue = (h, date) => !h.days?.length || h.days.includes(new Date(date + 'T00:00').getDay());
export const habitDone = (h, date) => !!h.marks?.[date];

// Текущая серия: подряд выполненные запланированные дни (сегодняшний невыполненный день серию не рвёт)
export function habitStreak(h, now = today()) {
  let n = 0, d = now;
  const start = ymd(new Date(h.createdAt || Date.now()));
  for (let i = 0; i < 3660; i++) {
    if (habitDue(h, d)) {
      if (habitDone(h, d)) n++;
      else if (d !== now) break;
    } else if (habitDone(h, d)) n++;
    d = addDays(d, -1);
    if (d < start && !habitDone(h, d)) break;
  }
  return n;
}
export function habitBest(h) {
  const dates = Object.keys(h.marks || {}).filter((d) => h.marks[d]).sort();
  if (!dates.length) return 0;
  let best = 0, cur = 0, d = dates[0];
  const end = dates[dates.length - 1];
  while (d <= end) {
    if (habitDone(h, d)) { cur++; best = Math.max(best, cur); }
    else if (habitDue(h, d)) cur = 0;
    d = addDays(d, 1);
  }
  return best;
}
// Статистика за последние n дней: выполнено из запланированных
export function habitStats(h, n, now = today()) {
  let due = 0, done = 0;
  const start = ymd(new Date(h.createdAt || Date.now()));
  for (let i = 0; i < n; i++) {
    const d = addDays(now, -i);
    if (habitDone(h, d)) { done++; due++; }
    else if (habitDue(h, d) && d >= start) due++;
  }
  return { due, done, percent: due ? Math.round((done / due) * 100) : 0 };
}
