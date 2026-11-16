// ЗАГОТОВКА под ИИ-ассистента (сам ИИ НЕ подключён). Подробности — docs/AI.md.
// Идея: ИИ получает список разрешённых действий (describeActions) и текущие данные (context),
// а в ответ присылает ПРЕДЛОЖЕНИЕ — массив вызовов. Приложение показывает его человеку,
// и только после подтверждения выполняет через applyProposal.

import * as actions from './actions.js';
import * as store from './store.js';
import { search } from './search.js';
import { today } from './dates.js';
import { tasksOn, overdueTasks, eventsOn } from './selectors.js';

// Что ИИ разрешено предлагать. params — описание полей для подсказки модели.
export const AI_ACTIONS = {
  'inbox.add': { title: 'Записать во входящие', params: { text: 'string' }, run: (p) => actions.captureInbox(p.text) },
  'task.add': { title: 'Добавить задачу', params: { title: 'string', date: 'YYYY-MM-DD?', time: 'HH:MM?', priority: '0..3?', notes: 'string?' }, run: (p) => actions.addTask(p) },
  'task.update': { title: 'Изменить задачу', params: { id: 'string', patch: 'object' }, run: (p) => actions.updateTask(p.id, p.patch) },
  'task.move': { title: 'Перенести задачу', params: { id: 'string', date: 'YYYY-MM-DD|null' }, run: (p) => actions.moveTask(p.id, p.date) },
  'task.complete': { title: 'Отметить задачу выполненной', params: { id: 'string' }, run: (p) => { if (store.get('tasks', p.id)?.status !== 'done') actions.toggleTask(p.id); } },
  'event.add': { title: 'Добавить событие', params: { title: 'string', date: 'YYYY-MM-DD', start: 'HH:MM?', duration: 'minutes?' }, run: (p) => actions.addEvent(p) },
  'event.update': { title: 'Изменить событие', params: { id: 'string', patch: 'object' }, run: (p) => actions.updateEvent(p.id, p.patch) },
  'note.add': { title: 'Добавить заметку', params: { title: 'string', text: 'string?', sectionId: 'string?' }, run: (p) => actions.addNote(p) },
  'log.add': { title: 'Записать в историю', params: { text: 'string', type: 'did|place|met|learned|decision|other' }, run: (p) => actions.addLog(p) },
};
// Действия только для чтения — их можно выполнять без подтверждения
export const AI_QUERIES = {
  find: (p) => search(p.query, 10),
  today: () => ({ date: today(), tasks: tasksOn(today()), overdue: overdueTasks(), events: eventsOn(today()).map((o) => o.ev) }),
};

export const describeActions = () => Object.entries(AI_ACTIONS).map(([name, a]) => ({ name, title: a.title, params: a.params }));

// Человекочитаемое описание предложения — его показываем перед подтверждением
export function previewProposal(calls) {
  return calls.map((c) => {
    const a = AI_ACTIONS[c.action];
    if (!a) return { ok: false, text: `Неизвестное действие: ${c.action}` };
    const target = c.params?.id ? (store.get('tasks', c.params.id) || store.get('events', c.params.id))?.title : (c.params?.title || c.params?.text);
    return { ok: true, text: `${a.title}: ${target || ''}`.trim() };
  });
}

// Выполнить предложение. confirm — функция, которая спрашивает человека (обязательна!).
export async function applyProposal(calls, confirm) {
  if (typeof confirm !== 'function') throw new Error('Изменения от ИИ выполняются только после подтверждения человеком');
  const preview = previewProposal(calls);
  if (preview.some((p) => !p.ok)) throw new Error('В предложении есть неизвестные действия');
  if (!(await confirm(preview))) return { applied: 0 };
  let applied = 0;
  for (const c of calls) { AI_ACTIONS[c.action].run(c.params || {}); applied++; }
  return { applied };
}
