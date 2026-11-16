// Всплывающие окна: шторка снизу (на телефоне) / окно по центру (на ноутбуке), меню, подтверждение, тосты.

import { h, icon, iconBtn } from './dom.js';

const stack = []; // открытые шторки
const root = () => document.getElementById('overlays');

// Клавиатура iPhone перекрывает низ экрана — поднимаем шторки на её высоту
if (window.visualViewport) {
  const sync = () => {
    const kb = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop);
    document.documentElement.style.setProperty('--kb', kb + 'px');
  };
  visualViewport.addEventListener('resize', sync);
  visualViewport.addEventListener('scroll', sync);
}

// openSheet({ title, body, footer, onClose, cls }) → { close, el, body }
// onClose вызывается при любом закрытии (кнопка, фон, Esc) — там редакторы сохраняют изменения.
export function openSheet({ title = '', body, footer = null, onClose = null, cls = '', headerExtra = null } = {}) {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    stack.splice(stack.indexOf(api), 1);
    try { onClose?.(); } catch (e) { console.error(e); }
    wrap.classList.add('closing');
    setTimeout(() => wrap.remove(), 220);
    if (!stack.length) document.body.classList.remove('sheet-open');
    prevFocus?.focus?.({ preventScroll: true });
  };
  const prevFocus = document.activeElement;
  const bodyEl = h('div.sheet-body', null, body);
  const sheet = h('div.sheet' + (cls ? '.' + cls : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Окно' },
    h('div.sheet-head', null,
      h('div.sheet-title', null, title),
      headerExtra,
      h('button.btn.btn-soft.sheet-done', { type: 'button', onclick: close }, 'Готово')),
    bodyEl,
    footer && h('div.sheet-foot', null, footer));
  const wrap = h('div.sheet-wrap', { onmousedown: (e) => { if (e.target === wrap) close(); } }, sheet);
  root().append(wrap);
  document.body.classList.add('sheet-open');
  const api = { close, el: sheet, body: bodyEl };
  stack.push(api);
  return api;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) { e.preventDefault(); stack[stack.length - 1].close(); }
});
export const sheetOpen = () => stack.length > 0;
export const closeAllSheets = () => [...stack].reverse().forEach((s) => s.close());

// Меню действий: items = [{ label, icon, onclick, danger, hint }]
export function openMenu(title, items) {
  const sheet = openSheet({
    title, cls: 'menu-sheet',
    body: h('div.menu', null, items.filter(Boolean).map((it) => h('button.menu-item' + (it.danger ? '.danger' : ''), {
      type: 'button', onclick: () => { sheet.close(); it.onclick(); },
    }, it.icon && icon(it.icon), h('span.grow', null, it.label), it.hint && h('span.muted.small', null, it.hint)))),
  });
  return sheet;
}

// Подтверждение. Возвращает Promise<boolean>
export function confirmSheet({ title, text = '', ok = 'Да', cancel = 'Отмена', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const sheet = openSheet({
      title, cls: 'menu-sheet confirm-sheet', onClose: () => resolve(result),
      body: h('div', null,
        text && h('p.confirm-text', null, text),
        h('div.row.gap', null,
          h('button.btn.btn-soft.grow', { type: 'button', onclick: () => sheet.close() }, cancel),
          h('button.btn.grow' + (danger ? '.btn-danger' : '.btn-primary'), { type: 'button', onclick: () => { result = true; sheet.close(); } }, ok))),
    });
  });
}

// Запрос строки (название раздела, пароль…). Возвращает Promise<string|null>
export function promptSheet({ title, value = '', placeholder = '', ok = 'Сохранить', type = 'text', text = '' }) {
  return new Promise((resolve) => {
    let result = null;
    const input = h('input.input', { type, value, placeholder, autocomplete: 'off', enterKeyHint: 'done' });
    const submit = () => { result = input.value; sheet.close(); };
    // preventDefault обязателен: иначе Enter «нажмёт» кнопку, на которую вернётся фокус, и окно откроется снова
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    const sheet = openSheet({
      title, cls: 'menu-sheet confirm-sheet', onClose: () => resolve(result),
      body: h('div', null, text && h('p.confirm-text', null, text), input,
        h('div.row.gap.mt', null, h('button.btn.btn-primary.grow', { type: 'button', onclick: submit }, ok))),
    });
    input.focus();
  });
}

// Короткое сообщение внизу экрана. action = { label, onclick } — например «Отменить»
export function toast(msg, { action = null, timeout = 4200 } = {}) {
  const box = document.getElementById('toasts');
  const el = h('div.toast', { role: 'status' }, h('span.grow', null, msg),
    action && h('button.toast-action', { type: 'button', onclick: () => { action.onclick(); hide(); } }, action.label));
  const hide = () => { el.classList.add('closing'); setTimeout(() => el.remove(), 200); };
  box.append(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(hide, timeout);
  return hide;
}

export { iconBtn };
