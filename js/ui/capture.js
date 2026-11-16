// БЫСТРЫЙ ЗАХВАТ — главная функция. Открыл → написал → Enter. Запись попадает во «Входящие».
// Панель появляется сверху экрана: так клавиатура iPhone её не закрывает.

import { h, icon, fill } from './dom.js';
import { toast } from './sheet.js';
import * as actions from '../core/actions.js';
import * as store from '../core/store.js';
import { parseRu } from '../core/parse-date.js';

let current = null;

export function openCapture(prefill = '') {
  if (current) { current.input.focus(); return; }
  let hintOff = false; // пользователь убрал подсказку даты
  let hint = null;
  let keepOpen = store.getMeta('captureKeepOpen', false);

  const input = h('textarea.capture-input', { rows: 1, placeholder: 'Что в голове? Просто напиши…', 'aria-label': 'Быстрая запись', enterKeyHint: 'send', autocapitalize: 'sentences', value: prefill });
  const hintBox = h('div.capture-hint');
  const saved = h('span.capture-saved', { 'aria-live': 'polite' });

  const drawHint = () => {
    hint = hintOff ? null : parseRu(input.value);
    fill(hintBox, ...(hint ? [h('button.chip.active', { type: 'button', title: 'Убрать подсказку даты', onclick: () => { hintOff = true; drawHint(); input.focus(); } },
      icon('calendar', 14), hint.label, ' ✕'), h('span.muted.small', null, 'дата — подсказка, применится при разборе')] : []));
  };
  const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; };

  const save = () => {
    const text = input.value.trim();
    if (!text) { close(); return; }
    actions.captureInbox(text, hint ? { date: hint.date, time: hint.time, clean: hint.clean } : null);
    if (keepOpen) {
      input.value = ''; hintOff = false; drawHint(); grow(); input.focus();
      saved.textContent = '✓ Сохранено';
      saved.classList.remove('show'); void saved.offsetWidth; saved.classList.add('show');
    } else {
      close();
      toast('Сохранено во «Входящие»', { action: { label: 'Разобрать', onclick: () => { location.hash = '#/inbox'; } }, timeout: 3000 });
    }
  };
  const close = () => {
    if (!current) return;
    current = null;
    wrap.classList.add('closing');
    document.removeEventListener('keydown', onKey, true);
    setTimeout(() => wrap.remove(), 180);
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };

  input.addEventListener('input', () => { hintOff = hintOff && !!input.value; drawHint(); grow(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); save(); } });

  const keepBtn = h('button.chip' + (keepOpen ? '.active' : ''), { type: 'button', 'aria-pressed': String(keepOpen), title: 'Не закрывать после сохранения — удобно выгружать несколько мыслей подряд',
    onclick: () => { keepOpen = !keepOpen; store.setMeta('captureKeepOpen', keepOpen); keepBtn.classList.toggle('active', keepOpen); keepBtn.setAttribute('aria-pressed', String(keepOpen)); input.focus(); } }, 'Несколько подряд');

  const card = h('div.capture', { role: 'dialog', 'aria-label': 'Быстрая запись' },
    h('div.capture-row', null, input, h('button.capture-send', { type: 'button', 'aria-label': 'Сохранить во входящие', onclick: save }, icon('arrowUp', 22))),
    hintBox,
    h('div.capture-foot', null, keepBtn, saved, h('span.grow'), h('span.muted.small.capture-tip', null, 'Enter — сохранить')));
  const wrap = h('div.capture-wrap', { onmousedown: (e) => { if (e.target === wrap) (input.value.trim() ? save() : close()); } }, card);
  document.getElementById('overlays').append(wrap);
  document.addEventListener('keydown', onKey, true);
  current = { input };
  input.focus();
  drawHint(); grow();
}
export const captureOpen = () => !!current;
