// «Мой день» — главный экран: дата, время, расписание, приоритеты, задачи, прогресс, ближайшие дни.

import { h, icon } from '../ui/dom.js';
import { openMenu, toast } from '../ui/sheet.js';
import { taskRow, eventRow, sectionHead, ring, empty, completeWithFeedback } from '../ui/items.js';
import { openTaskEditor } from '../ui/edit-task.js';
import { openEventEditor } from '../ui/edit-event.js';
import * as store from '../core/store.js';
import * as actions from '../core/actions.js';
import { today, addDays, fmtFull, fmtRel, nowHM, toMin, plural, WD_SHORT, weekday, parseYmd } from '../core/dates.js';
import { tasksOn, overdueTasks, eventsOn, schedule, progress, focusTasks, habitDue, habitDone } from '../core/selectors.js';
import { backupDue } from '../core/backup.js';
import { parseRu } from '../core/parse-date.js';
import { colorOf } from '../core/schema.js';

function greeting() {
  const hr = new Date().getHours();
  const g = hr < 5 ? 'Доброй ночи' : hr < 12 ? 'Доброе утро' : hr < 18 ? 'Добрый день' : 'Добрый вечер';
  const name = store.getMeta('name', '');
  return name ? `${g}, ${name}` : g;
}

// Живые часы: обновляем только текст, без перерисовки экрана
setInterval(() => { const c = document.getElementById('clock'); if (c) c.textContent = nowHM(); }, 5000);

// Ближайшее событие: сегодня (ещё не закончилось) или в ближайшие 14 дней
function nextEvent() {
  const t = today(), now = toMin(nowHM());
  for (let i = 0; i < 14; i++) {
    const d = addDays(t, i);
    const list = eventsOn(d).filter((o) => !o.done && (i > 0 || !o.ev.start || toMin(o.ev.start) + (o.ev.duration || 0) > now));
    const timed = list.find((o) => o.ev.start) || (i > 0 ? list[0] : null);
    if (timed) return timed;
  }
  return null;
}

function untilText(occ) {
  if (occ.date !== today() || !occ.ev.start) return fmtRel(occ.date);
  const diff = toMin(occ.ev.start) - toMin(nowHM());
  if (diff <= 0) return 'идёт сейчас';
  if (diff < 60) return `через ${diff} мин`;
  const hrs = Math.floor(diff / 60), m = diff % 60;
  return `через ${hrs} ч${m ? ' ' + m + ' мин' : ''}`;
}

function pickFocus() {
  const candidates = [...overdueTasks(), ...tasksOn(today())].filter((t) => t.focusDate !== today());
  openMenu('Главное на сегодня', [
    ...candidates.slice(0, 12).map((t) => ({ label: t.title, icon: 'star', onclick: () => { if (!actions.setFocus(t.id, true)) toast('Уже выбрано 3 дела'); } })),
    { label: 'Новая задача…', icon: 'plus', onclick: () => openTaskEditor({ date: today(), focusDate: today() }) },
  ]);
}

export function render(el) {
  const t = today();
  const p = progress(t);
  const sched = schedule(t);
  const allDay = eventsOn(t).filter((o) => !o.ev.start);
  const tasks = tasksOn(t);
  const untimed = tasks.filter((x) => !x.time);
  const overdue = overdueTasks();
  const focus = focusTasks(t);
  const inboxCount = store.count('inbox');
  const hr = new Date().getHours();
  const next = nextEvent();
  const now = nowHM();

  // --- Шапка ---
  el.append(h('section.hero.card', null,
    h('div.hero-text', null,
      h('div.hero-greet', null, greeting()),
      h('div.hero-date', null, fmtFull(t)),
      h('div.hero-clock', { id: 'clock', 'aria-label': 'Текущее время' }, now)),
    h('div.hero-ring', null, ring(p.percent, 84),
      h('div.muted.small', null, p.total ? `${p.done} из ${p.total}` : 'нет задач'))));

  if (p.total > 0 && p.done === p.total) el.append(h('div.card.cheer', null, '🎉 Все задачи на сегодня выполнены. Можно выдохнуть.'));

  // --- Подсказки: обзор, входящие, копия ---
  const prompts = [];
  if (hr >= 5 && hr < 12 && !actions.reviewDone('morning')) prompts.push(h('a.prompt', { href: '#/review/morning' }, icon('sunrise'), h('span.grow', null, h('b', null, 'Утренний обзор'), h('small', null, 'Минута, чтобы собрать день')), icon('chevronRight', 18)));
  if (hr >= 18 && !actions.reviewDone('evening')) prompts.push(h('a.prompt', { href: '#/review/evening' }, icon('sunset'), h('span.grow', null, h('b', null, 'Вечерний отчёт'), h('small', null, 'Что сделал, что перенести')), icon('chevronRight', 18)));
  if (inboxCount) prompts.push(h('a.prompt', { href: '#/inbox' }, icon('inbox'), h('span.grow', null, h('b', null, `Во входящих: ${inboxCount}`), h('small', null, 'Разобрать в один тап')), icon('chevronRight', 18)));
  if (backupDue()) prompts.push(h('div.prompt', null, icon('download'), h('span.grow', null, h('b', null, 'Пора сделать резервную копию'), h('small', null, 'Данные хранятся только на этом устройстве')),
    h('a.btn.btn-primary.small', { href: '#/settings' }, 'Сделать'),
    h('button.btn.btn-soft.small', { type: 'button', onclick: () => store.setMeta('backupSnoozeUntil', Date.now() + 7 * 864e5) }, 'Позже')));
  if (prompts.length) el.append(h('section.prompts', null, prompts));

  // --- Ближайшее событие ---
  if (next) {
    el.append(h('button.card.next-event', { type: 'button', style: { '--c': colorOf(next.ev.color || store.get('categories', next.ev.category)?.color) }, onclick: () => openEventEditor(next.ev.id, next.date) },
      h('span.next-label', null, 'Ближайшее событие · ', untilText(next)),
      h('b', null, next.ev.title),
      h('span.muted', null, [fmtRel(next.date), next.ev.start, next.ev.location].filter(Boolean).join(' · '))));
  }

  // --- Три главных приоритета ---
  const slots = [0, 1, 2].map((i) => {
    const task = focus[i];
    if (!task) return h('button.focus-slot.empty-slot', { type: 'button', onclick: pickFocus }, h('span.focus-num', null, i + 1), h('span.muted', null, 'Выбрать главное дело'));
    const done = task.status === 'done';
    const check = h(`button.check.p${task.priority || 0}` + (done ? '.checked' : ''), { type: 'button', 'aria-label': 'Отметить выполненной', onclick: () => completeWithFeedback(task, slot, check) });
    const slot = h('div.focus-slot' + (done ? '.done' : ''), null, h('span.focus-num', null, i + 1),
      h('button.task-main', { type: 'button', onclick: () => openTaskEditor(task.id) }, h('span.task-title', null, task.title)), check);
    return slot;
  });
  el.append(h('section', null, sectionHead('3 главных дела', null), h('div.card.focus-card', null, slots)));

  // --- Расписание по времени ---
  const schedEl = h('div.card.list');
  if (!sched.length && !allDay.length) schedEl.append(h('div.list-empty', null, 'На сегодня ничего по времени. ', h('button.link', { type: 'button', onclick: () => openEventEditor({ date: t }) }, 'Добавить событие')));
  allDay.forEach((o) => schedEl.append(eventRow(o)));
  let nowShown = false;
  for (const it of sched) {
    if (!nowShown && it.time > now) { nowShown = true; if (sched[0] !== it || allDay.length) schedEl.append(h('div.now-line', null, h('span', null, 'сейчас · ' + now))); }
    const past = it.kind === 'event' ? it.end <= toMin(now) : false;
    const row = it.kind === 'event' ? eventRow(it) : h('div.sched-task', null, h('span.event-time', null, h('b', null, it.time)), taskRow(it.task, { showDate: false, move: false }));
    if (past) row.classList.add('past');
    schedEl.append(row);
  }
  el.append(h('section', null, sectionHead('Расписание', null, h('button.icon-btn.small', { type: 'button', 'aria-label': 'Добавить событие', onclick: () => openEventEditor({ date: t }) }, icon('plus', 20))), schedEl));

  // --- Задачи на сегодня ---
  const quick = h('input.input.quick-add', { placeholder: '+ Задача на сегодня', enterKeyHint: 'done', 'aria-label': 'Новая задача на сегодня', dataset: { keep: 'today-add' }, onkeydown: (e) => {
    if (e.key === 'Enter' && quick.value.trim()) {
      const hint = parseRu(quick.value);
      actions.addTask({ title: hint?.time && hint.date === t ? hint.clean : quick.value, date: t, time: hint?.date === t ? hint.time : null });
      quick.value = '';
    }
  } });
  const tasksEl = h('div.card.list', null, untimed.map((x) => taskRow(x, { showDate: false })), quick);
  el.append(h('section', null, sectionHead('Задачи на сегодня', tasks.length || null,
    tasks.length + overdue.length > 1 ? h('a.btn.btn-soft.small', { href: '#/focus' }, icon('dice', 16), 'С чего начать?') : null), tasksEl));

  // --- Просроченные ---
  if (overdue.length) {
    el.append(h('section', null,
      sectionHead('Просрочено', overdue.length, h('button.btn.btn-soft.small', { type: 'button', onclick: () => { actions.moveTasks(overdue.map((x) => x.id), t); toast('Перенесено на сегодня'); } }, 'Всё на сегодня')),
      h('div.card.list', null, overdue.slice(0, 8).map((x) => taskRow(x)), overdue.length > 8 && h('a.list-more', { href: '#/tasks/overdue' }, `Ещё ${overdue.length - 8}…`))));
  }

  // --- Привычки на сегодня ---
  const habits = store.all('habits').filter((x) => !x.archived && habitDue(x, t));
  if (habits.length) {
    el.append(h('section', null, sectionHead('Привычки', null, h('a.btn.btn-soft.small', { href: '#/habits' }, 'Все')),
      h('div.habit-chips', null, habits.map((x) => h('button.habit-chip' + (habitDone(x, t) ? '.on' : ''), { type: 'button', 'aria-pressed': String(habitDone(x, t)), style: { '--c': colorOf(x.color) },
        onclick: () => actions.toggleHabit(x.id, t) }, h('i.habit-dot'), x.title)))));
  }

  // --- Ближайшие дни ---
  const days = [1, 2, 3].map((i) => {
    const d = addDays(t, i);
    const ev = eventsOn(d), ts = tasksOn(d);
    const items = [...ev.map((o) => (o.ev.start ? o.ev.start + ' ' : '') + o.ev.title), ...ts.map((x) => x.title)];
    return h('a.day-card.card', { href: '#/calendar/day/' + d },
      h('div.day-card-head', null, h('b', null, i === 1 ? 'Завтра' : WD_SHORT[weekday(d)] + ', ' + parseYmd(d).getDate()),
        h('span.muted.small', null, items.length ? `${items.length} ${plural(items.length, 'дело', 'дела', 'дел')}` : 'свободно')),
      items.slice(0, 3).map((s) => h('div.day-card-item', null, s)),
      items.length > 3 && h('div.muted.small', null, `и ещё ${items.length - 3}`));
  });
  el.append(h('section', null, sectionHead('Ближайшие дни'), h('div.day-cards', null, days)));
}
