// «Цели»: этапы, сроки, привязанные задачи и прогресс.

import { h, icon } from '../ui/dom.js';
import { empty, sectionHead } from '../ui/items.js';
import { openGoalEditor } from '../ui/edit-misc.js';
import * as store from '../core/store.js';
import { goalProgress } from '../core/selectors.js';
import { colorOf } from '../core/schema.js';
import { today, diffDays, fmtShort, plural } from '../core/dates.js';

function deadlineText(g) {
  if (!g.deadline) return null;
  const d = diffDays(today(), g.deadline);
  if (g.status !== 'active') return h('span', null, 'срок: ' + fmtShort(g.deadline));
  if (d < 0) return h('span.overdue-text', null, `срок прошёл ${-d} ${plural(-d, 'день', 'дня', 'дней')} назад`);
  if (d === 0) return h('span.overdue-text', null, 'срок сегодня');
  return h('span', null, `осталось ${d} ${plural(d, 'день', 'дня', 'дней')} · до ${fmtShort(g.deadline)}`);
}

function card(g) {
  const p = goalProgress(g);
  const next = (g.milestones || []).find((m) => !m.done);
  return h('button.card.goal-card', { type: 'button', style: { '--c': colorOf(g.color) }, onclick: () => openGoalEditor(g.id) },
    h('div.row.gap', null, h('b.grow', null, g.title), h('span.count', null, p.percent + '%')),
    h('div.progress', { role: 'progressbar', 'aria-valuenow': p.percent, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: { width: p.percent + '%' } })),
    h('div.task-meta', null,
      p.total > 0 && h('span', null, `${p.done} из ${p.total} шагов`),
      deadlineText(g),
      next && h('span', null, 'дальше: ' + next.title)));
}

export function render(el) {
  const goals = store.all('goals').sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || a.createdAt - b.createdAt);
  el.append(h('button.btn.btn-primary', { type: 'button', style: { alignSelf: 'flex-start' }, onclick: () => openGoalEditor({}) }, icon('plus', 18), 'Новая цель'));
  if (!goals.length) { el.append(empty('🎯', 'Целей пока нет', 'Большая цель = несколько понятных этапов. Привяжи к цели задачи — и прогресс будет считаться сам.')); return; }
  const groups = [['active', 'В работе'], ['paused', 'На паузе'], ['done', 'Достигнуты']];
  for (const [status, label] of groups) {
    const list = goals.filter((g) => (g.status || 'active') === status);
    if (list.length) el.append(h('section', null, sectionHead(label, list.length), list.map(card)));
  }
}
