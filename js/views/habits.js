// «Привычки»: отметки по дням, серии, статистика за неделю и месяц.

import { h, icon, burst } from '../ui/dom.js';
import { empty, sectionHead, ring } from '../ui/items.js';
import { openHabitEditor } from '../ui/edit-misc.js';
import * as store from '../core/store.js';
import * as actions from '../core/actions.js';
import { colorOf } from '../core/schema.js';
import { today, addDays, WD_SHORT, weekday, parseYmd } from '../core/dates.js';
import { habitDue, habitDone, habitStreak, habitStats } from '../core/selectors.js';

function row(hb) {
  const t = today(), start = addDays(t, -6); // последние 7 дней, сегодня — справа
  const streak = habitStreak(hb), w = habitStats(hb, 7), m = habitStats(hb, 30);
  return h('div.card.habit-row', { style: { '--c': colorOf(hb.color) } },
    h('div.habit-row-head', null,
      h('button.task-main', { type: 'button', onclick: () => openHabitEditor(hb.id) },
        h('span.task-title', null, hb.title),
        h('span.task-meta', null, h('span', null, `неделя ${w.percent}%`), h('span', null, `месяц ${m.percent}%`))),
      streak > 0 && h('span.streak', { title: 'Текущая серия' }, `🔥 ${streak}`),
      h('button.icon-btn.small.ghost', { type: 'button', 'aria-label': 'Статистика и настройки', onclick: () => openHabitEditor(hb.id) }, icon('chevronRight', 18))),
    h('div.habit-week', null, Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i), on = habitDone(hb, d), future = d > t;
      return h('button.habit-day' + (on ? '.on' : '') + (d === t ? '.today' : '') + (!habitDue(hb, d) ? '.off' : ''), {
        type: 'button', disabled: future, 'aria-pressed': String(on), 'aria-label': `${WD_SHORT[weekday(d)]} ${parseYmd(d).getDate()}: ${on ? 'выполнено' : 'не отмечено'}`,
        style: future ? { opacity: 0.4 } : null,
        onclick: (e) => { if (!on) burst(e.currentTarget.querySelector('i')); actions.toggleHabit(hb.id, d); },
      }, WD_SHORT[weekday(d)], h('i', null, '✓'));
    })));
}

export function render(el) {
  const all = store.all('habits').sort((a, b) => a.createdAt - b.createdAt);
  const active = all.filter((x) => !x.archived), archived = all.filter((x) => x.archived);
  const t = today();
  const dueToday = active.filter((x) => habitDue(x, t));
  const doneToday = dueToday.filter((x) => habitDone(x, t)).length;

  if (active.length) el.append(h('div.card.hero', null,
    h('div.hero-text', null, h('div.hero-greet', null, 'Сегодня'),
      h('div.hero-date', null, dueToday.length ? `${doneToday} из ${dueToday.length}` : 'Выходной от привычек'),
      h('div.muted', null, doneToday === dueToday.length && dueToday.length ? 'Всё отмечено. Отлично!' : 'Нажми на кружок дня, чтобы отметить.')),
    h('div.hero-ring', null, ring(dueToday.length ? Math.round((doneToday / dueToday.length) * 100) : 0, 76))));

  el.append(h('button.btn.btn-primary', { type: 'button', style: { alignSelf: 'flex-start' }, onclick: () => openHabitEditor({}) }, icon('plus', 18), 'Новая привычка'));
  if (!all.length) { el.append(empty('🌱', 'Привычек пока нет', 'Начни с одной совсем маленькой — например, «стакан воды утром».')); return; }
  el.append(...active.map(row));
  if (archived.length) el.append(h('section', null, sectionHead('Архив', archived.length),
    h('div.card.list', null, archived.map((x) => h('button.result-row', { type: 'button', onclick: () => openHabitEditor(x.id) }, icon('archive', 20), h('span.event-main', null, h('span.task-title', null, x.title)))))));
}
