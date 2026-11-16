// Окно «Добавить в Календарь iPhone»: собирает .ics с напоминаниями (VALARM) и отдаёт файл.
// Это главный надёжный способ получить напоминание при закрытом приложении (см. docs/NOTIFICATIONS.md).

import { h, icon } from './dom.js';
import { openSheet, toast } from './sheet.js';
import { buildIcs } from '../core/ics.js';
import { downloadBlob } from '../core/backup.js';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// item: { id, title, notes, location, date, start, duration, repeat, exDates }
export function openIcsSheet(item, defaultRemind = null) {
  if (!item.date) { toast('Сначала укажи дату'); return; }
  const allDay = !item.start;
  const options = allDay
    ? [{ v: 0, label: 'В 9:00 в этот день' }, { v: 1440, label: 'Накануне в 9:00' }]
    : [{ v: 0, label: 'В момент начала' }, { v: 10, label: 'За 10 минут' }, { v: 60, label: 'За 1 час' }, { v: 1440, label: 'За 1 день' }];
  const chosen = new Set([allDay ? 0 : (options.some((o) => o.v === defaultRemind) ? defaultRemind : 10)]);
  if (!allDay) chosen.add(0);

  const makeText = () => buildIcs([item], () => [...chosen].sort((a, b) => a - b));
  const name = (item.title || 'event').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 40) || 'event';
  const fileName = name + '.ics';

  const openDirect = () => {
    // iPhone: Safari сам показывает окно «Добавить в Календарь» для такого адреса
    const a = h('a', { href: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(makeText()), target: '_blank', rel: 'noopener' });
    document.body.append(a); a.click(); a.remove();
  };
  const download = () => downloadBlob(fileName, new Blob([makeText()], { type: 'text/calendar' }));
  const share = async () => {
    try {
      const file = new File([makeText()], fileName, { type: 'text/calendar' });
      await navigator.share({ files: [file] });
    } catch (e) { if (e.name !== 'AbortError') download(); }
  };
  const canShare = (() => { try { return navigator.canShare?.({ files: [new File(['x'], 'a.ics', { type: 'text/calendar' })] }); } catch { return false; } })();

  const sheet = openSheet({
    title: 'В Календарь iPhone',
    cls: 'menu-sheet',
    body: h('div.stack', null,
      h('p.muted', null, 'Событие попадёт в системный Календарь, и iPhone сам напомнит в нужное время — даже если SAID OS закрыт.'),
      h('div.field', null, h('span.field-label', null, 'Напоминания'),
        h('div.stack.tight', null, options.map((o) => h('label.check-line', null,
          h('input', { type: 'checkbox', checked: chosen.has(o.v), onchange: (e) => { e.target.checked ? chosen.add(o.v) : chosen.delete(o.v); } }),
          h('span', null, o.label))))),
      h('button.btn.btn-primary.big', { type: 'button', onclick: () => { (isIOS() ? openDirect : download)(); } }, icon('calendar'), isIOS() ? 'Добавить в Календарь' : 'Скачать файл .ics'),
      h('div.row.gap', null,
        canShare && h('button.btn.btn-soft.grow', { type: 'button', onclick: share }, icon('share', 18), 'Поделиться файлом'),
        isIOS() && h('button.btn.btn-soft.grow', { type: 'button', onclick: download }, icon('download', 18), 'Скачать .ics')),
      h('p.muted.small', null, isIOS()
        ? 'Если окно Календаря не открылось — нажми «Поделиться файлом» или «Скачать .ics» и открой файл: iPhone предложит добавить событие.'
        : 'На компьютере откроется в Outlook или Календаре Windows. На iPhone кнопка сразу откроет окно добавления в Календарь.')),
  });
  return sheet;
}
