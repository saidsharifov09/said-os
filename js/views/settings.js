// Настройки: оформление, напоминания, резервные копии, перенос между устройствами, категории, демо-данные.

import { h, icon } from '../ui/dom.js';
import { toast, confirmSheet, promptSheet, openSheet } from '../ui/sheet.js';
import { segmented, toggle, colorPicker, field } from '../ui/controls.js';
import { getTheme, setTheme } from '../ui/theme.js';
import * as store from '../core/store.js';
import * as actions from '../core/actions.js';
import { exportBackup, readBackup, applyBackup, saveFile, pickFile } from '../core/backup.js';
import { buildIcs, parseIcs, taskAsEvent } from '../core/ics.js';
import { loadDemo, removeDemo, hasDemo } from '../core/demo.js';
import { categories } from '../core/selectors.js';
import { colorOf, STORE_LABELS } from '../core/schema.js';
import { fmtDateTime, ymd } from '../core/dates.js';
import { APP_VERSION } from '../version.js';

const block = (title, ...children) => h('section.card.settings-block', null, h('h2', null, title), ...children);

async function doExport(password) {
  try {
    const { name, text } = await exportBackup(password);
    const res = await saveFile(name, text);
    if (res !== 'cancelled') toast(password ? 'Зашифрованная копия готова' : 'Копия готова');
  } catch (e) { toast('Не удалось сделать копию: ' + e.message); }
}

async function doImport() {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  try {
    let res = await readBackup(file.text);
    while (res.needPassword) {
      const pw = await promptSheet({ title: 'Копия зашифрована', text: 'Введи пароль, с которым она была создана.', type: 'password', placeholder: 'Пароль', ok: 'Открыть' });
      if (pw == null) return;
      try { res = await readBackup(file.text, pw); } catch (e) { toast(e.message); }
    }
    const { payload, counts, exportedAt } = res;
    const summary = Object.entries(counts).filter(([, n]) => n).map(([s, n]) => `${STORE_LABELS[s]}: ${n}`).join(' · ') || 'пусто';
    const sheet = openSheet({
      title: 'Импорт копии', cls: 'menu-sheet',
      body: h('div.stack', null,
        h('p', null, `Копия от ${fmtDateTime(new Date(exportedAt).getTime())}.`), h('p.muted.small', null, summary),
        h('button.btn.btn-primary.big', { type: 'button', onclick: async () => {
          sheet.close();
          const r = await applyBackup(payload, 'merge');
          toast(`Объединено: добавлено ${r.added}, обновлено ${r.updated}`);
        } }, 'Объединить с текущими данными'),
        h('p.muted.small', null, 'Объединение безопасно: ничего не удаляется. Если запись есть в обоих местах, остаётся более свежая версия.'),
        h('button.btn.btn-soft.danger', { type: 'button', onclick: async () => {
          if (!(await confirmSheet({ title: 'Заменить ВСЕ данные на этом устройстве?', text: 'Всё, что сейчас есть в приложении на этом устройстве, будет стёрто и заменено содержимым копии. Отменить нельзя.', ok: 'Заменить', danger: true }))) return;
          sheet.close();
          await applyBackup(payload, 'replace');
          toast('Данные заменены содержимым копии');
        } }, 'Заменить всё содержимым копии')),
    });
  } catch (e) { toast(e.message, { timeout: 7000 }); }
}

function editCategory(cat) {
  const draft = cat ? { name: cat.name, color: cat.color } : { name: '', color: 'blue' };
  const sheet = openSheet({
    title: cat ? 'Категория' : 'Новая категория', cls: 'menu-sheet',
    onClose: () => { if (!draft.name.trim() || draft.deleted) return; cat ? actions.updateCategory(cat.id, { name: draft.name.trim(), color: draft.color }) : actions.addCategory(draft.name, draft.color); },
    body: h('div.stack', null,
      h('input.input', { value: draft.name, placeholder: 'Название', 'aria-label': 'Название категории', oninput: (e) => { draft.name = e.target.value; } }),
      colorPicker(draft.color, (c) => { draft.color = c; }),
      cat && h('button.btn.btn-soft.danger', { type: 'button', onclick: () => { draft.deleted = true; actions.deleteCategory(cat.id); sheet.close(); } }, icon('trash', 18), 'Удалить категорию')),
  });
  if (!cat) sheet.body.querySelector('input').focus();
}

export function render(el) {
  // --- Оформление ---
  el.append(block('Оформление',
    segmented([{ v: 'light', label: 'Светлая' }, { v: 'dark', label: 'Тёмная' }, { v: 'system', label: 'Как в системе' }], getTheme(), setTheme, 'wide'),
    field('Как к тебе обращаться (необязательно, хранится только на устройстве)', h('input.input', { value: store.getMeta('name', ''), placeholder: 'Имя', dataset: { keep: 'name' }, onchange: (e) => store.setMeta('name', e.target.value.trim()) }))));

  // --- Напоминания ---
  const canNotify = 'Notification' in window;
  el.append(block('Напоминания',
    h('p.muted.small', null, 'Напоминания внутри SAID OS работают, только пока приложение открыто. Чтобы iPhone напомнил при закрытом приложении, нажми «В Календарь iPhone» в задаче или событии.'),
    toggle('Звук напоминания', store.getMeta('sound', true), (v) => store.setMeta('sound', v)),
    canNotify && toggle('Системные уведомления, пока приложение открыто в фоне (ноутбук)', store.getMeta('sysNotify', false) && Notification.permission === 'granted', async (v) => {
      if (v && Notification.permission !== 'granted') {
        const p = await Notification.requestPermission();
        if (p !== 'granted') { toast('Уведомления запрещены в настройках браузера'); store.setMeta('sysNotify', false); return; }
      }
      store.setMeta('sysNotify', v);
    })));

  // --- Копии и перенос ---
  const last = store.getMeta('lastBackupAt', 0);
  const pw = h('input.input', { type: 'password', placeholder: 'Пароль для шифрования (необязательно)', autocomplete: 'new-password', 'aria-label': 'Пароль для шифрования копии', dataset: { keep: 'backup-pw' } });
  el.append(block('Резервная копия и перенос',
    h('p.muted.small', null, 'Все данные хранятся только на этом устройстве. Копия — это один файл. Чтобы перенести данные между iPhone и ноутбуком: сохрани копию, отправь файл себе (Telegram «Избранное», почта, iCloud Drive) и импортируй на другом устройстве. Это перенос файлом, не синхронизация.'),
    h('p.small', null, last ? `Последняя копия: ${fmtDateTime(last)}` : 'Копий ещё не было.'),
    pw,
    h('button.btn.btn-primary.big', { type: 'button', onclick: () => doExport(pw.value) }, icon('download'), 'Сохранить копию'),
    h('p.muted.small', null, 'С паролем файл шифруется (AES-256). Без пароля восстановить зашифрованную копию невозможно — не забудь его.'),
    h('button.btn.btn-soft.big', { type: 'button', onclick: doImport }, icon('upload'), 'Импорт из файла копии')));

  // --- Календарь .ics ---
  el.append(block('Календарь в формате .ics',
    h('p.muted.small', null, 'Выгрузка всех событий и задач с датой в стандартный файл календаря — и загрузка событий из такого файла (например, из Google или Apple Календаря).'),
    h('div.row.gap.wrap', null,
      h('button.btn.btn-soft', { type: 'button', onclick: async () => {
        const items = [...store.all('events'), ...store.all('tasks').filter((t) => t.date && t.status !== 'done').map(taskAsEvent)];
        if (!items.length) { toast('Нет событий для экспорта'); return; }
        await saveFile(`said-os-calendar-${ymd()}.ics`, buildIcs(items, (it) => (it.remind != null ? [it.remind] : [])), 'text/calendar');
      } }, icon('download', 18), 'Экспорт .ics'),
      h('button.btn.btn-soft', { type: 'button', onclick: async () => {
        const file = await pickFile('.ics,text/calendar');
        if (!file) return;
        const events = parseIcs(file.text);
        if (!events.length) { toast('В файле не нашлось событий'); return; }
        if (!(await confirmSheet({ title: `Добавить событий: ${events.length}?`, text: 'События из файла появятся в календаре SAID OS.', ok: 'Добавить' }))) return;
        let added = 0;
        const known = new Set(store.all('events').map((e) => e.icsUid).filter(Boolean));
        for (const e of events) {
          if (e.uid && known.has(e.uid)) continue; // уже импортировали раньше
          const ev = actions.addEvent(e);
          store.update('events', ev.id, { exDates: e.exDates || [], icsUid: e.uid || null });
          added++;
        }
        toast(`Добавлено событий: ${added}` + (added < events.length ? ` (пропущено повторов: ${events.length - added})` : ''));
      } }, icon('upload', 18), 'Импорт .ics'))));

  // --- Категории ---
  el.append(block('Категории задач и событий',
    h('div.chips', null, categories().map((c) => h('button.chip', { type: 'button', onclick: () => editCategory(c) }, h('i.dot', { style: { background: colorOf(c.color) } }), c.name)),
      h('button.chip', { type: 'button', onclick: () => editCategory(null) }, '+ Добавить'))));

  // --- Демо ---
  const demo = hasDemo();
  el.append(block('Демо-данные',
    h('p.muted.small', null, 'Примеры задач, событий и заметок, чтобы посмотреть, как всё выглядит. Удаляются одной кнопкой, твои записи не трогают.'),
    demo
      ? h('button.btn.btn-soft.danger', { type: 'button', onclick: () => { const n = removeDemo(); toast(`Демо-данные удалены (${n})`); } }, icon('trash', 18), 'Удалить демо-данные')
      : h('button.btn.btn-soft', { type: 'button', onclick: () => { loadDemo(); toast('Демо-данные загружены'); } }, icon('sparkle', 18), 'Загрузить демо-данные')));

  // --- Данные и приложение ---
  const usage = h('span.muted.small', null, '');
  navigator.storage?.estimate?.().then((e) => { if (e?.usage != null) usage.textContent = `Занято на устройстве: ${(e.usage / 1048576).toFixed(1)} МБ`; }).catch(() => {});
  el.append(block('Данные и приложение',
    h('div.row.gap.wrap', null,
      h('a.btn.btn-soft', { href: '#/trash' }, icon('trash', 18), 'Корзина'),
      h('button.btn.btn-soft', { type: 'button', onclick: async () => {
        try {
          const reg = await navigator.serviceWorker?.getRegistration();
          await reg?.update();
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
          location.reload();
        } catch { location.reload(); }
      } }, icon('repeat', 18), 'Обновить приложение'),
      h('button.btn.btn-soft.danger', { type: 'button', onclick: async () => {
        if (!(await confirmSheet({ title: 'Стереть все данные?', text: 'Удалятся все задачи, события, заметки и настройки на этом устройстве. Сначала сделай копию. Отменить нельзя.', ok: 'Стереть всё', danger: true }))) return;
        const typed = await promptSheet({ title: 'Точно стереть?', text: 'Напиши слово «стереть», чтобы подтвердить.', placeholder: 'стереть', ok: 'Подтвердить' });
        if ((typed || '').trim().toLowerCase() !== 'стереть') { toast('Отменено'); return; }
        await store.replaceAll({}, {});
        location.reload();
      } }, 'Стереть все данные')),
    usage,
    h('p.muted.small', null, `SAID OS · версия ${APP_VERSION}. Работает без интернета, данные не покидают устройство.`)));
}
