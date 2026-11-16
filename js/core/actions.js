// СЛОЙ ДЕЙСТВИЙ. Все изменения данных в приложении проходят через функции этого файла.
// Экраны не пишут в хранилище напрямую. Позже сюда же подключается ИИ-ассистент
// (см. js/core/ai-bridge.js и docs/AI.md): он сможет только предлагать вызовы этих действий.

import * as store from './store.js';
import { today, addDays, ymd } from './dates.js';
import { nextDate } from './recur.js';
import { findUrls } from './parse-date.js';
import { LATER_SECTION, MISC_SECTION } from './schema.js';
import { focusTasks } from './selectors.js';

const clean = (s) => (s || '').trim();

// ======================= Входящие =======================
export function captureInbox(text, hint = null) {
  text = clean(text);
  if (!text) return null;
  return store.add('inbox', { text, hint });
}
export const deleteInbox = (id) => store.remove('inbox', id);

// Название для новой записи из входящих: если есть подсказка даты — без слов «завтра в 15:00»
const inboxTitle = (item) => (item.hint?.clean ? item.hint.clean : item.text);

export function inboxToTask(id, extra = {}) {
  const item = store.get('inbox', id);
  if (!item) return null;
  const task = addTask({ title: inboxTitle(item), date: item.hint?.date || null, time: item.hint?.time || null, ...extra });
  store.purge('inbox', id);
  return task;
}
export function inboxToEvent(id, extra = {}) {
  const item = store.get('inbox', id);
  if (!item) return null;
  const ev = addEvent({ title: inboxTitle(item), date: item.hint?.date || today(), start: item.hint?.time || null, ...extra });
  store.purge('inbox', id);
  return ev;
}
export function inboxToNote(id, sectionId = MISC_SECTION) {
  const item = store.get('inbox', id);
  if (!item) return null;
  const lines = item.text.split('\n');
  const long = item.text.length > 80 || lines.length > 1;
  const note = addNote({ sectionId, title: long ? lines[0].slice(0, 80) : item.text, text: long ? item.text : '' });
  store.purge('inbox', id);
  return note;
}
export function inboxToLater(id) {
  const item = store.get('inbox', id);
  if (!item) return null;
  const note = addLater(item.text);
  store.purge('inbox', id);
  return note;
}

// ======================= Задачи =======================
export function addTask(f = {}) {
  return store.add('tasks', {
    title: clean(f.title) || 'Без названия', notes: f.notes || '', date: f.date || null, time: f.time || null,
    remind: f.remind ?? (f.time ? 0 : null), // за сколько минут напомнить; null — не напоминать
    priority: f.priority || 0, category: f.category || null, subtasks: f.subtasks || [],
    status: 'open', doneAt: null, repeat: f.repeat || null, goalId: f.goalId || null,
    focusDate: f.focusDate || null, ...(f.demo ? { demo: true } : {}),
  });
}
export function updateTask(id, patch) {
  if ('title' in patch) patch.title = clean(patch.title) || 'Без названия';
  if (patch.time === '') patch.time = null;
  if (patch.date === '') patch.date = null;
  return store.update('tasks', id, patch);
}
export const deleteTask = (id) => store.remove('tasks', id);

// Отметить выполненной / вернуть. Повторяющаяся задача после выполнения переезжает на следующую дату,
// а в «Выполнено» остаётся её копия. Возвращает функцию отмены.
export function toggleTask(id) {
  const t = store.get('tasks', id);
  if (!t) return null;
  if (t.status === 'done') {
    store.update('tasks', id, { status: 'open', doneAt: null });
    return () => store.update('tasks', id, { status: 'done', doneAt: t.doneAt });
  }
  // Связанное событие тоже отмечаем
  if (t.repeat && t.date) {
    const start = t.seriesStart || t.date;
    let next = nextDate(t.repeat, t.date, start);
    const now = today();
    while (next && next < now) next = nextDate(t.repeat, next, start);
    const { id: _id, createdAt, updatedAt, ...rest } = t;
    const copy = store.add('tasks', { ...rest, repeat: null, status: 'done', doneAt: Date.now(), repeatOf: t.id, focusDate: null });
    store.update('tasks', id, {
      date: next || t.date, seriesStart: start, focusDate: null,
      subtasks: (t.subtasks || []).map((s) => ({ ...s, done: false })),
    });
    return () => { store.purge('tasks', copy.id); store.update('tasks', id, { date: t.date, focusDate: t.focusDate, subtasks: t.subtasks }); };
  }
  store.update('tasks', id, { status: 'done', doneAt: Date.now() });
  return () => store.update('tasks', id, { status: 'open', doneAt: null });
}
// Перенести задачу на дату (null — «без даты»)
export const moveTask = (id, date) => store.update('tasks', id, { date: date || null, ...(date ? {} : { time: null }) });
export function moveTasks(ids, date) { ids.forEach((id) => moveTask(id, date)); }

export function toggleSubtask(taskId, subId) {
  const t = store.get('tasks', taskId);
  if (!t) return;
  store.update('tasks', taskId, { subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) });
}

// Главные приоритеты дня (не больше трёх). Возвращает false, если мест нет.
export function setFocus(id, on, date = today()) {
  if (!on) { store.update('tasks', id, { focusDate: null }); return true; }
  const cur = focusTasks(date);
  if (cur.some((t) => t.id === id)) return true;
  if (cur.length >= 3) return false;
  const t = store.get('tasks', id);
  store.update('tasks', id, { focusDate: date, focusOrder: Date.now(), ...(t.date ? {} : { date }) });
  return true;
}

// ======================= События =======================
export function addEvent(f = {}) {
  return store.add('events', {
    title: clean(f.title) || 'Без названия', notes: f.notes || '', location: f.location || '',
    date: f.date || today(), start: f.start || null, // start = null — событие на весь день
    duration: f.duration ?? 60, color: f.color || null, category: f.category || null,
    repeat: f.repeat || null, exDates: [], doneDates: [], taskId: f.taskId || null,
    remind: f.remind ?? (f.start ? 10 : null), ...(f.demo ? { demo: true } : {}),
  });
}
export function updateEvent(id, patch) {
  if ('title' in patch) patch.title = clean(patch.title) || 'Без названия';
  if (patch.start === '') patch.start = null;
  return store.update('events', id, patch);
}
// Удалить событие целиком или только один день повторяющегося (scope = 'one')
export function deleteEvent(id, { date = null, scope = 'all' } = {}) {
  const ev = store.get('events', id);
  if (!ev) return;
  if (scope === 'one' && ev.repeat && date) store.update('events', id, { exDates: [...(ev.exDates || []), date] });
  else store.remove('events', id);
}
// Отметить событие выполненным в конкретный день. Связанная задача отмечается вместе с ним.
export function toggleEventDone(id, date) {
  const ev = store.get('events', id);
  if (!ev) return;
  const has = ev.doneDates?.includes(date);
  store.update('events', id, { doneDates: has ? ev.doneDates.filter((d) => d !== date) : [...(ev.doneDates || []), date] });
  const task = ev.taskId && store.get('tasks', ev.taskId);
  if (task && !task.deletedAt && (task.status === 'done') === !!has) toggleTask(task.id);
}
// Запланировать задачу в календаре: создаёт связанное событие
export function scheduleTask(taskId, { date, start, duration = 60 } = {}) {
  const t = store.get('tasks', taskId);
  if (!t) return null;
  return addEvent({ title: t.title, date: date || t.date || today(), start: start || t.time || null, duration, category: t.category, taskId });
}

// ======================= Блокнот =======================
export function addNote(f = {}) {
  return store.add('notes', {
    sectionId: f.sectionId || MISC_SECTION, title: clean(f.title), text: f.text || '', tags: f.tags || [],
    images: f.images || [], pinned: !!f.pinned, archived: false,
    // поля для «Посмотреть позже»
    url: f.url || '', kind: f.kind || null, watched: false, ...(f.demo ? { demo: true } : {}),
  });
}
export const updateNote = (id, patch) => store.update('notes', id, patch);
export const deleteNote = (id) => store.remove('notes', id);

export function addSection(name, emoji = '📁') {
  const order = Math.max(-1, ...store.all('sections').map((s) => s.order || 0)) + 1;
  return store.add('sections', { name: clean(name) || 'Новый раздел', emoji, order });
}
export const renameSection = (id, name, emoji) => store.update('sections', id, { name: clean(name) || 'Раздел', ...(emoji ? { emoji } : {}) });
// При удалении раздела заметки не пропадают — переезжают в «Разное»
export function deleteSection(id) {
  const sec = store.get('sections', id);
  if (!sec || sec.system) return false;
  store.all('notes').filter((n) => n.sectionId === id).forEach((n) => store.update('notes', n.id, { sectionId: MISC_SECTION }));
  store.remove('sections', id);
  return true;
}
// Сдвинуть раздел вверх (-1) или вниз (+1)
export function moveSection(id, dir) {
  const list = store.all('sections').sort((a, b) => (a.order || 0) - (b.order || 0));
  const i = list.findIndex((s) => s.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((s, k) => { if (s.order !== k) store.update('sections', s.id, { order: k }); });
}

// ======================= Посмотреть позже =======================
// Это заметки в системном разделе «Посмотреть позже» с полями url / kind / watched
export function guessKind(url) {
  if (!url) return 'other';
  if (/youtube\.com|youtu\.be|vimeo\.com|rutube\.ru|vk\.com\/video|twitch\.tv/i.test(url)) return 'video';
  if (/kinopoisk|imdb\.com|netflix|okko|ivi\.ru/i.test(url)) return 'film';
  return 'link';
}
export function addLater(text, kind = null, demo = false) {
  text = clean(text);
  if (!text) return null;
  const url = findUrls(text)[0] || '';
  let title = clean(text.replace(url, ''));
  if (!title && url) { try { title = new URL(url).hostname.replace(/^www\./, ''); } catch { title = url; } }
  return addNote({ sectionId: LATER_SECTION, title, url, kind: kind || guessKind(url), demo });
}

// ======================= Цели =======================
export function addGoal(f = {}) {
  return store.add('goals', {
    title: clean(f.title) || 'Новая цель', notes: f.notes || '', deadline: f.deadline || null,
    milestones: f.milestones || [], status: 'active', color: f.color || 'blue', ...(f.demo ? { demo: true } : {}),
  });
}
export const updateGoal = (id, patch) => store.update('goals', id, patch);
export const deleteGoal = (id) => store.remove('goals', id);
export function toggleMilestone(goalId, msId) {
  const g = store.get('goals', goalId);
  if (!g) return;
  store.update('goals', goalId, { milestones: g.milestones.map((m) => (m.id === msId ? { ...m, done: !m.done } : m)) });
}

// ======================= Привычки =======================
export function addHabit(f = {}) {
  return store.add('habits', {
    title: clean(f.title) || 'Новая привычка', emoji: f.emoji || '', color: f.color || 'sky',
    days: f.days || [], marks: f.marks || {}, archived: false, ...(f.demo ? { demo: true } : {}),
  });
}
export const updateHabit = (id, patch) => store.update('habits', id, patch);
export const deleteHabit = (id) => store.remove('habits', id);
export function toggleHabit(id, date = today()) {
  const h = store.get('habits', id);
  if (!h) return;
  const marks = { ...(h.marks || {}) };
  if (marks[date]) delete marks[date]; else marks[date] = 1;
  store.update('habits', id, { marks });
}

// ======================= История (Life Log) =======================
export function addLog(f = {}) {
  const d = new Date();
  return store.add('log', {
    date: f.date || today(), time: f.time ?? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    type: f.type || 'did', text: clean(f.text), people: f.people || '', place: f.place || '',
    taskId: f.taskId || null, eventId: f.eventId || null, ...(f.demo ? { demo: true } : {}),
  });
}
export const updateLog = (id, patch) => store.update('log', id, patch);
export const deleteLog = (id) => store.remove('log', id);

// ======================= Категории =======================
export function addCategory(name, color = 'blue') {
  const order = Math.max(-1, ...store.all('categories').map((s) => s.order || 0)) + 1;
  return store.add('categories', { name: clean(name) || 'Категория', color, order });
}
export const updateCategory = (id, patch) => store.update('categories', id, patch);
export const deleteCategory = (id) => store.remove('categories', id);

// ======================= Обзоры дня =======================
// Перенести все незакрытые задачи до даты включительно на другой день
export function carryOver(toDate = addDays(today(), 1), upTo = today()) {
  const list = store.all('tasks').filter((t) => t.status !== 'done' && t.date && t.date <= upTo);
  list.forEach((t) => store.update('tasks', t.id, { date: toDate }));
  return list.length;
}
export function markReview(kind, date = today()) {
  const r = { ...(store.getMeta('reviews', {})) };
  r[date] = { ...(r[date] || {}), [kind]: Date.now() };
  // храним только последние 60 дней
  const limit = addDays(today(), -60);
  Object.keys(r).forEach((d) => { if (d < limit) delete r[d]; });
  store.setMeta('reviews', r);
}
export const reviewDone = (kind, date = today()) => !!store.getMeta('reviews', {})[date]?.[kind];

// ======================= Корзина =======================
export const restoreItem = (storeName, id) => store.restore(storeName, id);
export const purgeItem = (storeName, id) => store.purge(storeName, id);

export { ymd };
