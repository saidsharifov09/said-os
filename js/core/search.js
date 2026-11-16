// Поиск по всему приложению: простое совпадение всех слов запроса (без учёта регистра).

import * as store from './store.js';
import { fmtRel } from './dates.js';
import { LATER_SECTION } from './schema.js';

const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е');

export function search(query, limitPerGroup = 30) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const match = (...fields) => { const hay = norm(fields.join(' \n ')); return words.every((w) => hay.includes(w)); };
  const secName = (id) => store.get('sections', id)?.name || '';

  const groups = [
    { key: 'tasks', label: 'Задачи', items: store.all('tasks').filter((t) => match(t.title, t.notes, (t.subtasks || []).map((s) => s.title).join(' ')))
      .sort((a, b) => (a.status === 'done') - (b.status === 'done') || b.updatedAt - a.updatedAt)
      .map((t) => ({ store: 'tasks', id: t.id, title: t.title, sub: (t.status === 'done' ? 'Выполнено · ' : '') + fmtRel(t.date), done: t.status === 'done' })) },
    { key: 'events', label: 'События', items: store.all('events').filter((e) => match(e.title, e.notes, e.location))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((e) => ({ store: 'events', id: e.id, title: e.title, sub: fmtRel(e.date) + (e.start ? `, ${e.start}` : '') })) },
    { key: 'inbox', label: 'Входящие', items: store.all('inbox').filter((i) => match(i.text))
      .map((i) => ({ store: 'inbox', id: i.id, title: i.text, sub: 'Во входящих' })) },
    { key: 'notes', label: 'Заметки', items: store.all('notes').filter((n) => match(n.title, n.text, (n.tags || []).join(' '), n.url))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((n) => ({ store: 'notes', id: n.id, title: n.title || n.text.slice(0, 60) || 'Без названия', later: n.sectionId === LATER_SECTION,
        sub: secName(n.sectionId) + (n.archived ? ' · архив' : '') })) },
    { key: 'goals', label: 'Цели', items: store.all('goals').filter((g) => match(g.title, g.notes, (g.milestones || []).map((m) => m.title).join(' ')))
      .map((g) => ({ store: 'goals', id: g.id, title: g.title, sub: 'Цель' })) },
    { key: 'habits', label: 'Привычки', items: store.all('habits').filter((h) => match(h.title))
      .map((h) => ({ store: 'habits', id: h.id, title: h.title, sub: 'Привычка' })) },
    { key: 'log', label: 'История', items: store.all('log').filter((l) => match(l.text, l.people, l.place))
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
      .map((l) => ({ store: 'log', id: l.id, title: l.text, sub: fmtRel(l.date) })) },
  ];
  return groups.filter((g) => g.items.length).map((g) => ({ ...g, total: g.items.length, items: g.items.slice(0, limitPerGroup) }));
}
