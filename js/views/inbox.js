// «Входящие»: всё, что записано через быстрый захват. Разбор в один тап.

import { h, icon, linkify } from '../ui/dom.js';
import { toast } from '../ui/sheet.js';
import { empty } from '../ui/items.js';
import { openCapture } from '../ui/capture.js';
import { openTaskEditor } from '../ui/edit-task.js';
import { openEventEditor } from '../ui/edit-event.js';
import { openNoteEditor } from '../ui/edit-note.js';
import * as store from '../core/store.js';
import * as actions from '../core/actions.js';
import { fmtDateTime } from '../core/dates.js';
import { hintLabel, findUrls } from '../core/parse-date.js';

const edit = (label, fn) => ({ action: { label, onclick: fn }, timeout: 5000 });

function card(item) {
  const hasUrl = findUrls(item.text).length > 0;
  const go = (kind) => {
    if (kind === 'task') { const t = actions.inboxToTask(item.id); toast('Стало задачей' + (t.date ? ' · ' + hintLabel(t).toLowerCase() : ''), edit('Изменить', () => openTaskEditor(t.id))); }
    if (kind === 'event') { const e = actions.inboxToEvent(item.id); if (item.hint?.date) toast('Стало событием · ' + hintLabel({ date: e.date, time: e.start }).toLowerCase(), edit('Изменить', () => openEventEditor(e.id, e.date))); else openEventEditor(e.id, e.date); }
    if (kind === 'note') { const n = actions.inboxToNote(item.id); toast('Стало заметкой в «Разное»', edit('Изменить', () => openNoteEditor(n.id))); }
    if (kind === 'later') { const n = actions.inboxToLater(item.id); toast('В «Посмотреть позже»', edit('Изменить', () => openNoteEditor(n.id))); }
  };
  const btn = (kind, ic, label, primary) => h('button.triage-btn' + (primary ? '.primary' : ''), { type: 'button', onclick: () => go(kind) }, icon(ic, 20), h('span', null, label));
  return h('article.card.inbox-card', null,
    h('div.inbox-text', null, linkify(item.text)),
    h('div.inbox-meta', null,
      item.hint?.date && h('span.chip.active.static', null, icon('calendar', 14), hintLabel(item.hint)),
      h('span.muted.small', null, fmtDateTime(item.createdAt)),
      h('span.grow'),
      h('button.icon-btn.small.ghost', { type: 'button', 'aria-label': 'Удалить', onclick: () => { actions.deleteInbox(item.id); toast('Удалено', { action: { label: 'Вернуть', onclick: () => actions.restoreItem('inbox', item.id) } }); } }, icon('trash', 18))),
    h('div.triage', null,
      btn('task', 'checkCircle', 'Задача', !hasUrl),
      btn('event', 'calendar', 'Событие'),
      btn('note', 'note', 'Заметка'),
      btn('later', 'bookmark', 'Позже', hasUrl)));
}

export function render(el) {
  const items = store.all('inbox').sort((a, b) => b.createdAt - a.createdAt);
  if (!items.length) {
    el.append(empty('📥', 'Входящие пусты', 'Всё разобрано. Новая мысль? Жми «+» — запись займёт пару секунд.',
      h('button.btn.btn-primary', { type: 'button', onclick: () => openCapture() }, icon('plus', 18), 'Быстрая запись')));
    return;
  }
  el.append(h('p.muted.lead', null, 'Выбери, чем станет каждая запись. Один тап — и она на своём месте.'), ...items.map(card));
}
