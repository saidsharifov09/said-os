// «Блокнот»: разделы и заметки. #/notes — список разделов, #/notes/<id> — заметки раздела.

import { h, icon, fill } from '../ui/dom.js';
import { refresh } from '../ui/refresh.js';
import { toast, confirmSheet, promptSheet, openSheet } from '../ui/sheet.js';
import { empty, sectionHead } from '../ui/items.js';
import { openNoteEditor } from '../ui/edit-note.js';
import * as store from '../core/store.js';
import * as actions from '../core/actions.js';
import { sections } from '../core/selectors.js';
import { LATER_SECTION } from '../core/schema.js';
import { fmtRel, ymd, plural } from '../core/dates.js';

const state = { tag: '', archive: false };

export const title = (params) => (params[0] && store.get('sections', params[0])?.name) || 'Блокнот';

const sortNotes = (list) => list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);

export function noteCard(n, { showSection = false } = {}) {
  const img = n.images?.[0];
  return h('button.card.note-card', { type: 'button', onclick: () => openNoteEditor(n.id) },
    h('span.note-card-title', null, n.pinned && icon('pin', 16), n.title || (n.text ? '' : 'Без названия')),
    n.text && h('span.note-card-text', null, n.text),
    img && h('img.note-card-img', { src: img.data, alt: '', loading: 'lazy' }),
    h('span.note-card-foot', null,
      showSection && h('span', null, store.get('sections', n.sectionId)?.name || ''),
      (n.tags || []).map((t) => h('span.tag', null, '#' + t)),
      n.images?.length > 1 && h('span', null, `📷 ${n.images.length}`),
      h('span', null, fmtRel(ymd(new Date(n.updatedAt))).toLowerCase())));
}

// Окно управления разделами: создать, переименовать, удалить, изменить порядок
function manageSections() {
  const box = h('div.card.list');
  const draw = () => fill(box, sections().map((s, i, arr) => h('div.section-manage', null,
    h('span.section-emoji', null, s.emoji || '📁'), h('span.grow.task-title', null, s.name),
    h('button.icon-btn.small', { type: 'button', 'aria-label': 'Выше', disabled: i === 0, onclick: () => { actions.moveSection(s.id, -1); draw(); } }, icon('arrowUp', 18)),
    h('button.icon-btn.small', { type: 'button', 'aria-label': 'Ниже', disabled: i === arr.length - 1, onclick: () => { actions.moveSection(s.id, 1); draw(); } }, icon('arrowDown', 18)),
    h('button.icon-btn.small', { type: 'button', 'aria-label': 'Переименовать', onclick: async () => {
      const name = await promptSheet({ title: 'Название раздела', value: s.name });
      if (name?.trim()) { actions.renameSection(s.id, name); draw(); }
    } }, icon('edit', 18)),
    h('button.icon-btn.small.danger', { type: 'button', 'aria-label': 'Удалить раздел', disabled: !!s.system, title: s.system ? 'Системный раздел нельзя удалить' : 'Удалить', onclick: async () => {
      const n = store.all('notes').filter((x) => x.sectionId === s.id).length;
      if (!(await confirmSheet({ title: `Удалить раздел «${s.name}»?`, text: n ? `Заметки (${n}) не пропадут — переедут в «Разное».` : 'Раздел пуст.', ok: 'Удалить', danger: true }))) return;
      actions.deleteSection(s.id); draw();
    } }, icon('trash', 18)))));
  draw();
  openSheet({ title: 'Разделы блокнота', body: h('div.stack', null, box,
    h('button.btn.btn-primary.big', { type: 'button', onclick: async () => {
      const name = await promptSheet({ title: 'Новый раздел', placeholder: 'Название' });
      if (name?.trim()) { actions.addSection(name); draw(); }
    } }, icon('plus'), 'Новый раздел')) });
}

function sectionList(el) {
  const notes = store.all('notes');
  const active = notes.filter((n) => !n.archived);
  el.append(h('div.row.gap', null,
    h('button.btn.btn-primary.grow', { type: 'button', onclick: () => openNoteEditor({}) }, icon('plus', 18), 'Новая заметка'),
    h('button.btn.btn-soft', { type: 'button', onclick: manageSections }, icon('settings', 18), 'Разделы')));
  el.append(h('div.section-grid', null, sections().map((s) => {
    const n = active.filter((x) => x.sectionId === s.id && !(s.id === LATER_SECTION && x.watched)).length;
    return h('a.card.section-card', { href: s.id === LATER_SECTION ? '#/later' : '#/notes/' + s.id },
      h('span.section-emoji', null, s.emoji || '📁'), h('b', null, s.name),
      h('span.muted.small', null, n ? `${n} ${plural(n, 'запись', 'записи', 'записей')}` : 'пусто'));
  })));
  const pinned = sortNotes(active.filter((n) => n.pinned && n.sectionId !== LATER_SECTION));
  if (pinned.length) el.append(h('section', null, sectionHead('Закреплённые', pinned.length), pinned.map((n) => noteCard(n, { showSection: true }))));
  const recent = active.filter((n) => !n.pinned && n.sectionId !== LATER_SECTION).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  if (recent.length) el.append(h('section', null, sectionHead('Недавние'), recent.map((n) => noteCard(n, { showSection: true }))));
}

function sectionView(el, sec) {
  const all = store.all('notes').filter((n) => n.sectionId === sec.id);
  const archived = all.filter((n) => n.archived);
  let list = all.filter((n) => !!n.archived === state.archive);
  const tags = [...new Set(list.flatMap((n) => n.tags || []))].sort();
  if (state.tag && !tags.includes(state.tag)) state.tag = '';
  if (state.tag) list = list.filter((n) => n.tags?.includes(state.tag));

  const quick = h('input.input.quick-add', { placeholder: `+ Быстрая заметка в «${sec.name}»`, enterKeyHint: 'done', 'aria-label': 'Новая заметка', dataset: { keep: 'note-add' }, onkeydown: (e) => {
    if (e.key === 'Enter' && quick.value.trim()) { actions.addNote({ sectionId: sec.id, title: quick.value }); quick.value = ''; }
  } });
  el.append(h('div.row.gap.toolbar', null, quick,
    h('button.icon-btn.soft', { type: 'button', 'aria-label': 'Подробная заметка', title: 'Подробная заметка', onclick: () => openNoteEditor({ sectionId: sec.id }) }, icon('edit'))));

  if (tags.length || archived.length) el.append(h('div.chips', null,
    tags.map((t) => h('button.chip' + (state.tag === t ? '.active' : ''), { type: 'button', onclick: () => { state.tag = state.tag === t ? '' : t; refresh(); } }, '#' + t)),
    (archived.length > 0 || state.archive) && h('button.chip' + (state.archive ? '.active' : ''), { type: 'button', onclick: () => { state.archive = !state.archive; refresh(); } }, icon('archive', 14), `Архив · ${archived.length}`)));

  if (!list.length) el.append(empty(sec.emoji || '📝', state.archive ? 'В архиве пусто' : 'Здесь пока пусто', state.archive ? '' : 'Напиши первую заметку в поле выше.'));
  else el.append(...sortNotes(list).map((n) => noteCard(n)));
}

export function render(el, params) {
  const sec = params[0] && store.get('sections', params[0]);
  if (sec && !sec.deletedAt) {
    el.append(h('a.btn.btn-soft.small', { href: '#/notes', style: { alignSelf: 'flex-start' } }, icon('chevronLeft', 16), 'Все разделы'));
    sectionView(el, sec);
  } else sectionList(el);
}
