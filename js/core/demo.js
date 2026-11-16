// Демо-данные: загружаются только по кнопке в настройках и удаляются одной кнопкой.
// Все демо-записи помечены demo: true. Личных данных здесь нет — только выдуманные примеры.

import * as store from './store.js';
import * as actions from './actions.js';
import { today, addDays } from './dates.js';

export const hasDemo = () => store.STORES.some((s) => store.all(s).some((r) => r.demo));

export function loadDemo() {
  const t = today(), demo = true;
  const d = (n) => addDays(t, n);
  [['Купить корм коту завтра', { date: d(1), time: null, clean: 'Купить корм коту' }], ['Идея: вести список подарков заранее', null], ['https://example.com/interesting-article', null]]
    .forEach(([text, hint]) => { const r = actions.captureInbox(text, hint); store.update('inbox', r.id, { demo }); });

  actions.addTask({ title: 'Разобрать почту', date: t, priority: 2, category: 'cat-work', demo });
  actions.addTask({ title: 'Позвонить в поликлинику', date: t, time: '11:30', priority: 3, category: 'cat-health', demo });
  actions.addTask({ title: 'Зарядка 10 минут', date: t, repeat: { type: 'daily' }, category: 'cat-health', demo });
  actions.addTask({ title: 'Оплатить интернет', date: d(-2), priority: 3, category: 'cat-home', demo });
  actions.addTask({ title: 'Подготовить презентацию', date: d(1), priority: 2, category: 'cat-work', demo,
    subtasks: [{ id: 'a', title: 'Собрать материалы', done: true }, { id: 'b', title: 'Набросать структуру', done: false }, { id: 'c', title: 'Оформить слайды', done: false }] });
  actions.addTask({ title: 'Полить цветы', date: d(2), repeat: { type: 'days', days: [3, 6] }, category: 'cat-home', demo });
  actions.addTask({ title: 'Записаться к стоматологу', date: d(9), category: 'cat-health', demo });
  actions.addTask({ title: 'Разобрать шкаф', priority: 1, category: 'cat-home', demo });
  const doneTask = actions.addTask({ title: 'Вынести мусор', date: t, demo });
  actions.toggleTask(doneTask.id);

  actions.addEvent({ title: 'Созвон с командой', date: t, start: '10:00', duration: 45, category: 'cat-work', repeat: { type: 'days', days: [1, 3] }, demo });
  actions.addEvent({ title: 'Обед с другом', date: t, start: '14:00', duration: 60, color: 'teal', location: 'Кафе у парка', demo });
  actions.addEvent({ title: 'Тренировка', date: d(1), start: '19:00', duration: 90, category: 'cat-health', repeat: { type: 'weekly' }, demo });
  actions.addEvent({ title: 'День рождения друга', date: d(3), color: 'pink', demo });

  actions.addNote({ sectionId: 'sec-ideas', title: 'Идеи для выходных', text: 'Сходить в музей\nПокататься на велосипеде\nИспечь пирог', tags: ['отдых'], pinned: true, demo });
  actions.addNote({ sectionId: 'sec-buy', title: 'Список покупок', text: 'Молоко, хлеб, яблоки, кофе', demo });
  actions.addNote({ sectionId: 'sec-books', title: 'Прочитать', text: '«Атомные привычки» — Джеймс Клир', tags: ['книги'], demo });
  actions.addLater('Интересная статья про сон https://example.com/sleep', 'article', demo);
  actions.addLater('Интерстеллар', 'film', demo);

  actions.addGoal({ title: 'Выучить английский до B2', deadline: d(120), demo,
    milestones: [{ id: 'm1', title: 'Пройти тест уровня', done: true }, { id: 'm2', title: 'Закончить учебник', done: false }, { id: 'm3', title: 'Сдать пробный экзамен', done: false }] });
  const marks = {};
  [1, 2, 3, 5, 6, 7, 8].forEach((n) => { marks[d(-n)] = 1; });
  actions.addHabit({ title: 'Стакан воды утром', color: 'sky', marks, demo });
  actions.addHabit({ title: 'Чтение 15 минут', color: 'indigo', marks: { [d(-1)]: 1, [d(-3)]: 1 }, demo });

  actions.addLog({ type: 'met', text: 'Встретился со старым другом', people: 'Друг', place: 'Кафе у парка', date: d(-1), time: '18:30', demo });
  actions.addLog({ type: 'learned', text: 'Узнал, что короткая прогулка помогает сосредоточиться', date: d(-1), time: '21:00', demo });
  actions.addLog({ type: 'decision', text: 'Решил планировать день с вечера', date: d(-2), time: '22:10', demo });
}

// Удаляет все демо-записи навсегда (мимо корзины)
export function removeDemo() {
  let n = 0;
  for (const s of store.STORES) for (const r of [...store.all(s), ...store.trashed().filter((x) => x.store === s).map((x) => x.rec)]) {
    if (r.demo) { store.purge(s, r.id); n++; }
  }
  return n;
}
