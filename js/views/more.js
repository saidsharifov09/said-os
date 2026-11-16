// «Ещё»: все остальные разделы (на телефоне).

import { h, icon } from '../ui/dom.js';
import * as store from '../core/store.js';
import { LATER_SECTION } from '../core/schema.js';

export function render(el) {
  const later = store.all('notes').filter((n) => n.sectionId === LATER_SECTION && !n.watched && !n.archived).length;
  const items = [
    ['inbox', 'inbox', 'Входящие', store.count('inbox') || ''],
    ['notes', 'note', 'Блокнот', ''],
    ['later', 'bookmark', 'Посмотреть позже', later || ''],
    ['goals', 'target', 'Цели', ''],
    ['habits', 'flame', 'Привычки', ''],
    ['log', 'history', 'История', ''],
    ['review', 'sunrise', 'Обзор дня', ''],
    ['focus', 'timer', 'Фокус', ''],
    ['search', 'search', 'Поиск', ''],
    ['trash', 'trash', 'Корзина', store.trashed().length || ''],
    ['settings', 'settings', 'Настройки и копии', ''],
  ];
  el.append(h('div.more-grid', null, items.map(([route, ic, label, badge]) => h('a.more-item.card', { href: '#/' + route }, icon(ic, 26), h('span', null, label), badge !== '' && h('span.count', null, badge)))));
}
