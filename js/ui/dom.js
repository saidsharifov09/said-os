// Мини-помощники для построения интерфейса без фреймворков.

// h('div.card.big', { onclick: fn, title: '…' }, 'текст', h('span', null, '…'))
export function h(spec, props, ...children) {
  const [tagAndId, ...classes] = spec.split('.');
  const [tag, id] = tagAndId.split('#');
  const el = document.createElement(tag || 'div');
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && k !== 'list' && k !== 'form') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}
export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === '') continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);

// Иконки: тонкие линейные, 24×24. Только содержимое <svg>.
const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  inbox: '<path d="M3 13l2.5-7.5A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 13h5l1.5 3h5L16 13h5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
  note: '<path d="M6 3.5h9l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1-1.5z"/><path d="M9 12h6M9 16h4M14.5 3.5V8H19"/>',
  bookmark: '<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h11M15 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H6M9 21l-3-3 3-3"/>',
  flame: '<path d="M12 21c3.6 0 6-2.5 6-6 0-3-2-5-3-7-1 1.5-1.5 2-2.500 2.500C12.500 8 12 5 10 3c0 3-4 5.500-4 10 0 4 2.500 8 6 8z"/>',
  clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.500-5.800L4 8.500"/><path d="M4 4v4.500h4.500M12 8v4.500l3 1.500"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.300l2-1.500-2-3.400-2.300.9a7 7 0 0 0-2.200-1.300L14 3h-4l-.4 2.400a7 7 0 0 0-2.200 1.300l-2.300-.9-2 3.400 2 1.500a7 7 0 0 0 0 2.600l-2 1.500 2 3.400 2.300-.9a7 7 0 0 0 2.200 1.300L10 21h4l.4-2.400a7 7 0 0 0 2.200-1.300l2.300.9 2-3.400-2-1.500A7 7 0 0 0 19 12z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1.500 1.500 0 0 0 1.500 1.500h7A1.500 1.500 0 0 0 17 19l1-12M9 7V4.500h6V7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevronLeft: '<path d="M14.500 6l-6 6 6 6"/>',
  chevronRight: '<path d="M9.500 6l6 6-6 6"/>',
  chevronDown: '<path d="M6 9.500l6 6 6-6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  star: '<path d="M12 3.500l2.600 5.400 5.900.8-4.300 4.100 1 5.900-5.200-2.800-5.200 2.800 1-5.900-4.300-4.100 5.900-.8z"/>',
  pin: '<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3zM12 15v6"/>',
  archive: '<rect x="3.500" y="4.500" width="17" height="4" rx="1"/><path d="M5 8.500V18a1.500 1.500 0 0 0 1.500 1.500h11A1.500 1.500 0 0 0 19 18V8.500M10 12.500h4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
  image: '<rect x="3.500" y="4.500" width="17" height="15" rx="2.500"/><circle cx="9" cy="10" r="1.600"/><path d="M4 17l4.500-4 3.500 3 3-2.500 5 4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.500 2h-15zM10 20.500a2 2 0 0 0 4 0"/>',
  download: '<path d="M12 4v11M7 10.500l5 5 5-5M5 19.500h14"/>',
  upload: '<path d="M12 15.500v-11M7 9l5-5 5 5M5 19.500h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4"/>',
  sparkle: '<path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800zM18.500 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  sunrise: '<path d="M12 3v5M5.600 10.600l1.400 1.400M2 18h20M17 12l1.400-1.400M7 18a5 5 0 0 1 10 0M9 5.500L12 3l3 2.500"/>',
  sunset: '<path d="M12 8V3M5.600 10.600l1.400 1.400M2 18h20M17 12l1.400-1.400M7 18a5 5 0 0 1 10 0M9 5.500L12 8l3-2.500"/>',
  play: '<path d="M7 4.500v15l12-7.500z"/>',
  undo: '<path d="M8 5L4 9l4 4M4 9h10a6 6 0 0 1 0 12h-3"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v4.500A1.500 1.500 0 0 1 16.500 20h-11A1.500 1.500 0 0 1 4 18.500v-11A1.500 1.500 0 0 1 5.500 6H10"/>',
  share: '<path d="M12 15V3.500M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v7.500a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V12a1 1 0 0 0-1-1h-1"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.500"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
  timer: '<circle cx="12" cy="13.500" r="7.500"/><path d="M12 9.500v4l2.500 2M9.500 3h5M12 3v3"/>',
  list: '<path d="M9 6.500h11M9 12h11M9 17.500h11"/><circle cx="4.500" cy="6.500" r="1"/><circle cx="4.500" cy="12" r="1"/><circle cx="4.500" cy="17.500" r="1"/>',
};

export function icon(name, size = 22) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  return span;
}

// Кнопка с иконкой
export const iconBtn = (name, label, onclick, cls = '') => h('button.icon-btn' + (cls ? '.' + cls : ''), { type: 'button', 'aria-label': label, title: label, onclick }, icon(name));

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Короткое «конфетти» из точек вокруг элемента — приятный отклик на выполнение
export function burst(el) {
  if (reducedMotion() || !el?.getBoundingClientRect) return;
  const r = el.getBoundingClientRect();
  const box = h('div.burst', { style: { left: r.left + r.width / 2 + 'px', top: r.top + r.height / 2 + 'px' } });
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10 + Math.random() * 0.4, d = 20 + Math.random() * 16;
    box.append(h('i', { style: { '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d + 'px' } }));
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 700);
}

// Превращает ссылки в тексте в кликабельные (безопасно, без innerHTML)
export function linkify(text) {
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of (text || '').matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    frag.append(text.slice(last, m.index));
    frag.append(h('a', { href: m[0], target: '_blank', rel: 'noopener noreferrer', onclick: (e) => e.stopPropagation() }, m[0]));
    last = m.index + m[0].length;
  }
  frag.append((text || '').slice(last));
  return frag;
}

// Заменить содержимое элемента. В отличие от replaceChildren пропускает null/false (удобно для условий).
export function fill(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}
