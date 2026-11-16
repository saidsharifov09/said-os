// Корзина: удалённое хранится 30 дней, можно вернуть.

import { h, icon } from '../ui/dom.js';
import { toast, confirmSheet } from '../ui/sheet.js';
import { empty } from '../ui/items.js';
import * as store from '../core/store.js';
import * as actions from '../core/actions.js';
import { STORE_LABELS } from '../core/schema.js';
import { plural } from '../core/dates.js';

const titleOf = (store_, r) => r.title || r.text || r.name || 'Без названия';

export function render(el) {
  const items = store.trashed();
  if (!items.length) { el.append(empty('🗑️', 'Корзина пуста', `Удалённое хранится здесь ${store.TRASH_DAYS} дней — на случай ошибки.`)); return; }
  el.append(h('div.row.gap', null,
    h('p.muted.grow', null, `Удалённое хранится ${store.TRASH_DAYS} дней, потом стирается навсегда.`),
    h('button.btn.btn-soft.danger.small', { type: 'button', onclick: async () => {
      if (await confirmSheet({ title: 'Очистить корзину?', text: 'Это действие нельзя отменить.', ok: 'Очистить', danger: true })) { store.emptyTrash(); toast('Корзина очищена'); }
    } }, 'Очистить')));
  el.append(h('div.card.list', null, items.map(({ store: s, rec }) => {
    const left = Math.max(0, store.TRASH_DAYS - Math.floor((Date.now() - rec.deletedAt) / 864e5));
    return h('div.trash-row', null,
      h('span.event-main', null, h('span.task-title', null, titleOf(s, rec)), h('span.task-meta', null, `${STORE_LABELS[s]} · ещё ${left} ${plural(left, 'день', 'дня', 'дней')}`)),
      h('button.btn.btn-soft.small', { type: 'button', onclick: () => { actions.restoreItem(s, rec.id); toast('Восстановлено'); } }, icon('undo', 16), 'Вернуть'),
      h('button.icon-btn.small.ghost.danger', { type: 'button', 'aria-label': 'Удалить навсегда', onclick: async () => {
        if (await confirmSheet({ title: 'Удалить навсегда?', text: titleOf(s, rec), ok: 'Удалить', danger: true })) actions.purgeItem(s, rec.id);
      } }, icon('trash', 18)));
  })));
}
