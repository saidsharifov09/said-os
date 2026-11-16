// «Посмотреть позже»: ссылки, фильмы, видео, статьи. Быстрое добавление — вставь ссылку и нажми Enter.

import { h, icon } from '../ui/dom.js';
import { refresh } from '../ui/refresh.js';
import { toast } from '../ui/sheet.js';
import { empty } from '../ui/items.js';
import { openNoteEditor } from '../ui/edit-note.js';
import * as store from '../core/store.js';
import * as actions from '../core/actions.js';
import { LATER_SECTION, LATER_KINDS } from '../core/schema.js';

const state = { kind: '', watched: false, addKind: '' };
const kindOf = (v) => LATER_KINDS.find((k) => k.v === v) || LATER_KINDS[0];
const domain = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

function row(n) {
  const k = kindOf(n.kind);
  return h('div.later-row' + (n.watched ? '.done' : ''), null,
    h('span.later-emoji', { title: k.label }, k.emoji),
    h('button.task-main', { type: 'button', onclick: () => openNoteEditor(n.id) },
      h('span.task-title', null, n.title || domain(n.url) || 'Без названия'),
      h('span.task-meta', null, [k.label, domain(n.url)].filter(Boolean).join(' · '))),
    n.url && h('a.icon-btn.small', { href: n.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Открыть ссылку', title: 'Открыть ссылку' }, icon('external', 20)),
    h('button.check' + (n.watched ? '.checked' : ''), { type: 'button', 'aria-label': n.watched ? 'Вернуть в список' : 'Отметить просмотренным',
      onclick: () => { actions.updateNote(n.id, { watched: !n.watched }); if (!n.watched) toast('Просмотрено', { action: { label: 'Отменить', onclick: () => actions.updateNote(n.id, { watched: false }) } }); } }),
    h('span', { style: { width: '6px' } }));
}

export function render(el) {
  const all = store.all('notes').filter((n) => n.sectionId === LATER_SECTION && !n.archived);
  const input = h('input.input.quick-add', { placeholder: '+ Вставь ссылку или название', inputMode: 'url', enterKeyHint: 'done', autocapitalize: 'off', 'aria-label': 'Добавить в «Посмотреть позже»', dataset: { keep: 'later-add' }, onkeydown: (e) => {
    if (e.key === 'Enter' && input.value.trim()) { actions.addLater(input.value, state.addKind || null); input.value = ''; toast('Добавлено'); }
  } });
  // Вставить ссылку из буфера одним нажатием (если браузер разрешает)
  const paste = navigator.clipboard?.readText && h('button.icon-btn.soft', { type: 'button', 'aria-label': 'Вставить из буфера', title: 'Вставить из буфера', onclick: async () => {
    try { const t = (await navigator.clipboard.readText()).trim(); if (t) { actions.addLater(t, state.addKind || null); toast('Добавлено из буфера'); } else toast('Буфер пуст'); }
    catch { toast('Браузер не дал доступ к буферу — вставь вручную'); input.focus(); }
  } }, icon('link'));
  el.append(h('div.row.gap.toolbar', null, input, paste));

  const counts = Object.fromEntries(LATER_KINDS.map((k) => [k.v, all.filter((n) => !n.watched && (n.kind || 'link') === k.v).length]));
  el.append(h('div.chips.scroll', null,
    h('button.chip' + (!state.kind ? '.active' : ''), { type: 'button', onclick: () => { state.kind = ''; state.addKind = ''; refresh(); } }, 'Все'),
    LATER_KINDS.map((k) => h('button.chip' + (state.kind === k.v ? '.active' : ''), { type: 'button', onclick: () => { state.kind = state.addKind = k.v; refresh(); } }, k.emoji, ' ', k.label, counts[k.v] ? ` · ${counts[k.v]}` : '')),
    h('button.chip' + (state.watched ? '.active' : ''), { type: 'button', onclick: () => { state.watched = !state.watched; refresh(); } }, icon('check', 14), 'Просмотренные')));

  let list = all.filter((n) => !!n.watched === state.watched);
  if (state.kind) list = list.filter((n) => (n.kind || 'link') === state.kind);
  list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt);
  if (!list.length) el.append(empty('🔖', state.watched ? 'Просмотренного пока нет' : 'Список пуст', state.watched ? '' : 'Наткнулся на что-то интересное? Вставь ссылку — вернёшься, когда будет время.'));
  else el.append(h('div.card.list', null, list.map(row)));
}
