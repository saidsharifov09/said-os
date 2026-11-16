// Редактор заметки (и записи «Посмотреть позже»). Сохраняет при закрытии окна.

import { h, icon, fill } from './dom.js';
import { openSheet, toast } from './sheet.js';
import { field, group, chipSelect, toggle } from './controls.js';
import * as actions from '../core/actions.js';
import * as store from '../core/store.js';
import { sections } from '../core/selectors.js';
import { LATER_SECTION, LATER_KINDS, MISC_SECTION } from '../core/schema.js';
import { findUrls } from '../core/parse-date.js';
import { autoGrow } from './edit-task.js';

const FIELDS = ['sectionId', 'title', 'text', 'tags', 'images', 'pinned', 'archived', 'url', 'kind', 'watched'];
const pick = (o) => Object.fromEntries(FIELDS.map((k) => [k, o[k] ?? null]));

// Сжать картинку: не больше 1280 px по длинной стороне, JPEG ~70%
export async function compressImage(file, max = 1280, quality = 0.72) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Не удалось открыть изображение')); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.naturalWidth * k), height: Math.round(img.naturalHeight * k) });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}

export function openLightbox(src) {
  const el = h('div.lightbox', { onclick: () => el.remove() }, h('img', { src, alt: 'Изображение' }));
  document.getElementById('overlays').append(el);
}

export function openNoteEditor(arg = {}) {
  const existing = typeof arg === 'string' ? store.get('notes', arg) : null;
  if (typeof arg === 'string' && !existing) return;
  const draft = existing ? structuredClone(pick(existing)) : { ...pick({ sectionId: MISC_SECTION, title: '', text: '', tags: [], images: [], url: '' }), ...arg };
  draft.tags ||= []; draft.images ||= [];
  const before = JSON.stringify(pick(draft));
  let skipSave = false;

  const save = () => {
    if (skipSave) return;
    addTag();
    const hasContent = draft.title?.trim() || draft.text?.trim() || draft.url?.trim() || draft.images.length;
    if (existing) { if (JSON.stringify(pick(draft)) !== before) actions.updateNote(existing.id, pick(draft)); }
    else if (hasContent) { const n = actions.addNote(draft); actions.updateNote(n.id, { pinned: !!draft.pinned, watched: !!draft.watched }); toast('Сохранено'); }
  };

  const title = h('textarea.input.title-input', { rows: 1, placeholder: 'Заголовок', value: draft.title || '', 'aria-label': 'Заголовок',
    oninput: (e) => { draft.title = e.target.value.replace(/\n/g, ' '); autoGrow(e.target); } });
  const links = h('div.chips');
  const drawLinks = () => fill(links, ...[...new Set(findUrls(draft.text))].map((u) => h('a.chip.link-chip', { href: u, target: '_blank', rel: 'noopener noreferrer' }, icon('link', 14), u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 34))));
  const text = h('textarea.input.note-text', { rows: 5, placeholder: 'Текст заметки… Ссылки станут кликабельными.', value: draft.text || '', 'aria-label': 'Текст',
    oninput: (e) => { draft.text = e.target.value; autoGrow(e.target, 480); drawLinks(); } });
  drawLinks();

  // Теги
  const tagsEl = h('div.chips');
  const tagInput = h('input.input', { placeholder: 'Тег и Enter', enterKeyHint: 'done', 'aria-label': 'Новый тег', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } } });
  function addTag() {
    const t = tagInput.value.trim().replace(/^#/, '').toLowerCase();
    tagInput.value = '';
    if (t && !draft.tags.includes(t)) { draft.tags.push(t); drawTags(); }
  }
  const drawTags = () => fill(tagsEl, ...draft.tags.map((t) => h('button.chip.active', { type: 'button', 'aria-label': 'Убрать тег ' + t, onclick: () => { draft.tags = draft.tags.filter((x) => x !== t); drawTags(); } }, '#' + t, ' ✕')));
  drawTags();

  // Изображения
  const imgs = h('div.images');
  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' }, onchange: async (e) => {
    for (const f of e.target.files) {
      try { draft.images.push({ id: store.uid(), data: await compressImage(f) }); } catch (err) { toast(err.message); }
    }
    e.target.value = ''; drawImgs();
  } });
  const drawImgs = () => fill(imgs, 
    ...draft.images.map((im) => h('div.image-thumb', null,
      h('img', { src: im.data, alt: 'Вложение', onclick: () => openLightbox(im.data) }),
      h('button', { type: 'button', 'aria-label': 'Удалить изображение', onclick: () => { draft.images = draft.images.filter((x) => x !== im); drawImgs(); } }, '✕'))),
    h('button.image-add', { type: 'button', 'aria-label': 'Добавить изображение', onclick: () => fileInput.click() }, icon('image'), 'Фото'));
  drawImgs();

  const laterBox = h('div.stack');
  const drawLater = () => fill(laterBox, ...(draft.sectionId === LATER_SECTION ? [
    field('Ссылка', h('input.input', { type: 'url', inputMode: 'url', placeholder: 'https://…', value: draft.url || '', oninput: (e) => { draft.url = e.target.value.trim(); } })),
    group('Тип', chipSelect(LATER_KINDS, draft.kind || 'link', (v) => { draft.kind = v; })),
    toggle('Просмотрено', draft.watched, (v) => { draft.watched = v; }),
  ] : []));
  drawLater();

  const body = h('div.stack', null,
    title, laterBox, text, links,
    group('Изображения', imgs, fileInput),
    group('Теги', tagsEl, tagInput),
    field('Раздел', h('select.input', { onchange: (e) => { draft.sectionId = e.target.value; drawLater(); } },
      sections().map((s) => h('option', { value: s.id, selected: s.id === draft.sectionId }, `${s.emoji || ''} ${s.name}`)))),
    toggle('Закрепить наверху', draft.pinned, (v) => { draft.pinned = v; }),
    existing && toggle('В архиве', draft.archived, (v) => { draft.archived = v; }),
    existing && h('div.editor-actions', null,
      h('button.btn.btn-soft.danger', { type: 'button', onclick: () => {
        skipSave = true; actions.deleteNote(existing.id); sheet.close();
        toast('Заметка в корзине', { action: { label: 'Вернуть', onclick: () => actions.restoreItem('notes', existing.id) } });
      } }, icon('trash', 18), 'Удалить')));

  const sheet = openSheet({ title: draft.sectionId === LATER_SECTION ? 'Посмотреть позже' : (existing ? 'Заметка' : 'Новая заметка'), body, onClose: save, cls: 'tall' });
  requestAnimationFrame(() => { autoGrow(title); autoGrow(text, 480); });
  if (!existing) title.focus();
  return sheet;
}
