// Повторно используемые элементы форм: переключатели, чипы, выбор даты, цвета, повторов.

import { h, fill } from './dom.js';
import { today, addDays, WD_SHORT, WEEK_ORDER, fmtRel, fmtShort } from '../core/dates.js';
import { COLORS } from '../core/schema.js';
import { REPEAT_OPTIONS } from '../core/recur.js';

export const field = (label, ...control) => h('label.field', null, h('span.field-label', null, label), ...control);
// Блок с подписью, но без <label> (для групп кнопок)
export const group = (label, ...control) => h('div.field', null, h('span.field-label', null, label), ...control);

// Сегментированный переключатель: options = [{ v, label }]
export function segmented(options, value, onchange, cls = '') {
  const el = h('div.segmented' + (cls ? '.' + cls : ''), { role: 'tablist' });
  const draw = () => {
    fill(el, ...options.map((o) => h('button' + (o.v === value ? '.active' : ''), {
      type: 'button', role: 'tab', 'aria-selected': String(o.v === value),
      onclick: () => { if (value === o.v) return; value = o.v; draw(); onchange(value); },
    }, o.label, o.badge ? h('span.seg-badge', null, o.badge) : null)));
  };
  draw();
  return el;
}

// Чипы выбора одного значения (повторное нажатие снимает выбор, если allowNone)
export function chipSelect(options, value, onchange, { allowNone = false } = {}) {
  const el = h('div.chips');
  const draw = () => {
    fill(el, ...options.map((o) => h('button.chip' + (o.v === value ? '.active' : ''), {
      type: 'button', 'aria-pressed': String(o.v === value),
      onclick: () => { value = (allowNone && value === o.v) ? null : o.v; draw(); onchange(value); },
    }, o.color && h('i.dot', { style: { background: o.color } }), o.emoji && h('span', null, o.emoji), o.label)));
  };
  draw();
  return el;
}

// Быстрый выбор даты: Сегодня / Завтра / календарь / Без даты
export function datePicker(value, onchange, { allowNone = true } = {}) {
  const el = h('div.chips');
  const set = (v) => { value = v; draw(); onchange(value); };
  const draw = () => {
    const t = today(), tm = addDays(t, 1);
    // Свой чип поверх системного поля даты: на iPhone пустое поле даты выглядит как пустой прямоугольник
    const custom = value && value !== t && value !== tm;
    const input = h('input.date-overlay', { type: 'date', value: value || '', 'aria-label': 'Выбрать дату',
      onchange: (e) => { if (e.target.value || allowNone) set(e.target.value || null); },
      onclick: (e) => { try { e.target.showPicker?.(); } catch { /* откроется штатно */ } } });
    const pick = h('label.chip.date-chip' + (custom ? '.active' : ''), null, '📅 ', custom ? fmtShort(value) : 'Дата…', input);
    fill(el, 
      h('button.chip' + (value === t ? '.active' : ''), { type: 'button', onclick: () => set(t) }, 'Сегодня'),
      h('button.chip' + (value === tm ? '.active' : ''), { type: 'button', onclick: () => set(tm) }, 'Завтра'),
      pick,
      allowNone && h('button.chip' + (!value ? '.active' : ''), { type: 'button', onclick: () => set(null) }, 'Без даты'),
    );
  };
  draw();
  return el;
}

export function weekdayPicker(days, onchange) {
  let cur = [...(days || [])];
  const el = h('div.weekdays');
  const draw = () => fill(el, ...WEEK_ORDER.map((d) => h('button' + (cur.includes(d) ? '.active' : ''), {
    type: 'button', 'aria-pressed': String(cur.includes(d)),
    onclick: () => { cur = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]; draw(); onchange(cur); },
  }, WD_SHORT[d])));
  draw();
  return el;
}

export function colorPicker(value, onchange) {
  const el = h('div.colors');
  const draw = () => fill(el, ...Object.entries(COLORS).map(([k, c]) => h('button' + (k === value ? '.active' : ''), {
    type: 'button', 'aria-label': 'Цвет ' + k, style: { '--c': c }, onclick: () => { value = k; draw(); onchange(k); },
  })));
  draw();
  return el;
}

// Выбор повторения: список + дни недели
export function repeatPicker(repeat, onchange) {
  let cur = repeat ? { ...repeat } : null;
  const el = h('div.stack');
  const draw = () => {
    const sel = h('select.input', { 'aria-label': 'Повторение', onchange: (e) => {
      const v = e.target.value;
      cur = v ? { type: v, ...(v === 'days' ? { days: cur?.days?.length ? cur.days : [1, 2, 3, 4, 5] } : {}) } : null;
      draw(); onchange(cur);
    } }, REPEAT_OPTIONS.map((o) => h('option', { value: o.v, selected: (cur?.type || '') === o.v }, o.label)));
    fill(el, sel, cur?.type === 'days' ? weekdayPicker(cur.days, (d) => { cur = { ...cur, days: d }; onchange(cur); }) : '');
  };
  draw();
  return el;
}

export const REMIND_OPTIONS = [
  { v: '', label: 'Не напоминать' }, { v: '0', label: 'В момент начала' }, { v: '5', label: 'За 5 минут' },
  { v: '10', label: 'За 10 минут' }, { v: '30', label: 'За 30 минут' }, { v: '60', label: 'За 1 час' }, { v: '1440', label: 'За 1 день' },
];
export function remindSelect(value, onchange) {
  return h('select.input', { 'aria-label': 'Напоминание', onchange: (e) => onchange(e.target.value === '' ? null : Number(e.target.value)) },
    REMIND_OPTIONS.map((o) => h('option', { value: o.v, selected: String(value ?? '') === o.v }, o.label)));
}

// Меню «Перенести»: возвращает пункты для openMenu
export function moveOptions(onpick) {
  const t = today();
  const wd = new Date().getDay();
  const nextMon = addDays(t, ((8 - wd) % 7) || 7);
  const sat = addDays(t, (6 - wd + 7) % 7 || 7);
  return [
    { label: 'Сегодня', icon: 'sun', onclick: () => onpick(t) },
    { label: 'Завтра', icon: 'arrowRight', onclick: () => onpick(addDays(t, 1)) },
    { label: 'В выходные', icon: 'calendar', hint: fmtRel(sat), onclick: () => onpick(sat) },
    { label: 'На следующей неделе', icon: 'calendar', hint: fmtRel(nextMon), onclick: () => onpick(nextMon) },
    { label: 'Без даты', icon: 'x', onclick: () => onpick(null) },
  ];
}

// Редактируемый список шагов (подзадачи, этапы цели): [{ id, title, done }]
export function checklistEditor(list, onchange, placeholder = 'Добавить шаг…') {
  let items = list.map((x) => ({ ...x }));
  const el = h('div.checklist');
  const fire = () => onchange(items.map((x) => ({ ...x })));
  const draw = (focusNew = false) => {
    const add = h('input.input.checklist-add', { placeholder, enterKeyHint: 'done', 'aria-label': placeholder, onkeydown: (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addItem(); }
    }, onblur: () => { if (add.value.trim()) addItem(false); } });
    const addItem = (refocus = true) => {
      const title = add.value.trim();
      if (!title) return;
      add.value = ''; // иначе при перерисовке сработает blur и шаг добавится дважды
      items.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title, done: false });
      fire(); draw(refocus);
    };
    fill(el, 
      ...items.map((it) => h('div.checklist-row', null,
        h('button.check.small' + (it.done ? '.checked' : ''), { type: 'button', 'aria-label': it.done ? 'Снять отметку' : 'Отметить', onclick: () => { it.done = !it.done; fire(); draw(); } }),
        h('input.input.bare' + (it.done ? '.struck' : ''), { value: it.title, 'aria-label': 'Шаг', oninput: (e) => { it.title = e.target.value; fire(); } }),
        h('button.icon-btn.small', { type: 'button', 'aria-label': 'Удалить шаг', onclick: () => { items = items.filter((x) => x !== it); fire(); draw(); } }, '✕'))),
      add);
    if (focusNew) add.focus();
  };
  draw();
  return el;
}

// Переключатель-«тумблер»
export function toggle(label, value, onchange) {
  const input = h('input', { type: 'checkbox', checked: !!value, onchange: (e) => onchange(e.target.checked) });
  return h('label.toggle', null, h('span.grow', null, label), input, h('i.toggle-ui'));
}
