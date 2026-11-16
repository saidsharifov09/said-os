// Сквозная проверка в настоящем браузере (Chromium через Playwright).
// Запуск:  python3 -m http.server 8765  →  node tests/e2e.cjs
// Необязательно для работы приложения; нужна только разработчику или ИИ для самопроверки.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const URL_ = process.env.APP_URL || 'http://localhost:8765/';
const only = process.argv[2];

const sizes = { phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, laptop: { viewport: { width: 1366, height: 768 } } };
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

// Помощники
const go = async (p, route) => { await p.evaluate((r) => { location.hash = '#/' + r; }, route); await p.waitForTimeout(120); };
const all = (p, store) => p.evaluate(async (s) => (await import('./js/core/store.js')).all(s), store);
const act = (p, fn, ...args) => p.evaluate(async ([fn, args]) => { const a = await import('./js/core/actions.js'); return a[fn](...args); }, [fn, args]);
const closeSheet = async (p) => { await p.click('.sheet-done >> nth=-1'); await p.waitForTimeout(300); };

test('быстрый захват → входящие → задача', async (p) => {
  await p.click('#fab');
  await p.waitForSelector('.capture-input:focus');
  await p.keyboard.type('Купить молоко завтра в 15:00');
  await p.waitForSelector('.capture-hint .chip');
  assert.match(await p.textContent('.capture-hint .chip'), /Завтра, 15:00/);
  await p.keyboard.press('Enter');
  await p.waitForSelector('.capture-wrap', { state: 'detached' });
  let inbox = await all(p, 'inbox');
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].text, 'Купить молоко завтра в 15:00');
  await go(p, 'inbox');
  await p.click('.triage-btn >> text=Задача');
  await p.waitForTimeout(100);
  const tasks = await all(p, 'tasks');
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, 'Купить молоко');
  assert.equal(tasks[0].date, plusDays(1));
  assert.equal(tasks[0].time, '15:00');
  assert.equal((await all(p, 'inbox')).length, 0);
  assert.ok(await p.isVisible('text=Входящие пусты'));
});

test('захват: подсказку можно убрать, «несколько подряд», остальные виды разбора', async (p) => {
  await p.click('#fab');
  await p.keyboard.type('Сходить в кино в пятницу');
  await p.click('.capture-hint .chip');
  assert.equal(await p.locator('.capture-hint .chip').count(), 0);
  await p.click('text=Несколько подряд');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(50);
  await p.keyboard.type('https://example.com/video');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Идея для проекта');
  await p.keyboard.press('Enter');
  await p.keyboard.press('Escape');
  await p.waitForSelector('.capture-wrap', { state: 'detached' });
  const inbox = await all(p, 'inbox');
  assert.equal(inbox.length, 3);
  assert.equal(inbox.find((i) => i.text.includes('кино')).hint, null);
  await go(p, 'inbox');
  await p.click('.inbox-card:has-text("Идея") .triage-btn >> text=Заметка');
  await p.click('.inbox-card:has-text("example.com") .triage-btn >> text=Позже');
  await p.click('.inbox-card:has-text("кино") .triage-btn >> text=Событие');
  await p.waitForSelector('.sheet'); // без даты событие открывается в редакторе
  await closeSheet(p);
  const notes = await all(p, 'notes');
  assert.equal(notes.length, 2);
  assert.equal(notes.find((n) => n.url).sectionId, 'sec-later');
  assert.equal((await all(p, 'events')).length, 1);
  assert.equal((await all(p, 'inbox')).length, 0);
  await p.click('#fab'); await p.click('text=Несколько подряд'); await p.keyboard.press('Escape');
});

test('задачи: добавление, редактор, подзадачи, выполнение, отмена', async (p) => {
  await go(p, 'tasks');
  await p.fill('.quick-add', 'Написать отчёт');
  await p.press('.quick-add', 'Enter');
  await p.fill('.quick-add', 'Позвонить через неделю');
  await p.press('.quick-add', 'Enter');
  let tasks = await all(p, 'tasks');
  assert.equal(tasks.find((t) => t.title === 'Написать отчёт').date, ymd());
  assert.equal(tasks.find((t) => t.title === 'Позвонить').date, plusDays(7));
  // редактор
  await p.click('.task-row:has-text("Написать отчёт") .task-main');
  await p.waitForSelector('.sheet');
  await p.fill('.sheet .title-input', 'Написать большой отчёт');
  await p.click('.sheet .segmented >> text=Высокий');
  await p.fill('.sheet .checklist-add', 'Собрать цифры');
  await p.press('.sheet .checklist-add', 'Enter');
  await p.fill('.sheet .checklist-add', 'Написать выводы');
  await p.press('.sheet .checklist-add', 'Enter');
  await p.click('.sheet .chip >> text=Работа');
  await closeSheet(p);
  await p.reload(); await p.waitForSelector('html.ready');
  tasks = await all(p, 'tasks');
  const t = tasks.find((x) => x.title === 'Написать большой отчёт');
  assert.ok(t, 'изменения сохранились после перезагрузки');
  assert.equal(t.priority, 3);
  assert.equal(t.subtasks.length, 2);
  assert.equal(t.category, 'cat-work');
  // выполнение и отмена
  await go(p, 'tasks');
  await p.click('.task-row:has-text("Написать большой отчёт") .check');
  await p.waitForSelector('.toast >> text=Готово');
  assert.equal((await all(p, 'tasks')).find((x) => x.id === t.id).status, 'done');
  await p.click('.toast-action');
  assert.equal((await all(p, 'tasks')).find((x) => x.id === t.id).status, 'open');
  await p.click('.task-row:has-text("Написать большой отчёт") .check');
  await p.waitForTimeout(600);
  await p.click('.bucket >> text=Выполнено');
  assert.ok(await p.isVisible('.task-row.done:has-text("Написать большой отчёт")'));
});

test('задачи: повторение, перенос, просроченные, фильтр', async (p) => {
  const rep = await act(p, 'addTask', { title: 'Зарядка', date: ymd(), repeat: { type: 'daily' } });
  const old = await act(p, 'addTask', { title: 'Старое дело', date: plusDays(-3), priority: 2 });
  await go(p, 'tasks/today');
  await p.click('.task-row:has-text("Зарядка") .check');
  await p.waitForSelector('.toast >> text=Следующий раз');
  let tasks = await all(p, 'tasks');
  assert.equal(tasks.find((x) => x.id === rep.id).date, plusDays(1));
  assert.equal(tasks.find((x) => x.id === rep.id).status, 'open');
  assert.ok(tasks.find((x) => x.repeatOf === rep.id && x.status === 'done'));
  // просроченные и перенос
  await p.click('.bucket >> text=Просрочено');
  assert.ok(await p.isVisible('.task-row.overdue:has-text("Старое дело")'));
  await p.click('.task-row:has-text("Старое дело") [aria-label="Перенести"]');
  await p.click('.menu-item >> text=Завтра');
  await p.waitForTimeout(300);
  assert.equal((await all(p, 'tasks')).find((x) => x.id === old.id).date, plusDays(1));
  // фильтр по приоритету
  await p.click('.bucket >> text=Завтра');
  await p.click('[aria-label="Фильтры и сортировка"]');
  await p.selectOption('.filters select >> nth=1', '2');
  assert.equal(await p.locator('.task-row').count(), 1);
  assert.ok(await p.isVisible('.task-row:has-text("Старое дело")'));
  await p.click('.filters >> text=Сбросить');
  await p.click('[aria-label="Фильтры и сортировка"]');
});

test('мой день: приоритеты, прогресс, расписание', async (p) => {
  await act(p, 'addTask', { title: 'Дело раз', date: ymd() });
  await act(p, 'addTask', { title: 'Дело два', date: ymd(), time: '23:58' });
  await act(p, 'addEvent', { title: 'Встреча-тест', date: ymd(), start: '23:50', duration: 5 });
  await go(p, 'today');
  assert.ok(await p.isVisible('.hero-clock'));
  await p.click('.focus-slot.empty-slot >> nth=0');
  await p.click('.menu-item >> text=Дело раз');
  await p.waitForTimeout(300);
  assert.ok(await p.isVisible('.focus-slot:has-text("Дело раз")'));
  const before = await p.textContent('.hero .ring b');
  await p.click('.focus-slot:has-text("Дело раз") .check');
  await p.waitForTimeout(700);
  const after = await p.textContent('.hero .ring b');
  assert.notEqual(before, after, 'процент выполнения изменился');
  const sched = await p.locator('section:has(h2:text("Расписание")) .list').textContent();
  assert.ok(sched.indexOf('Встреча-тест') < sched.indexOf('Дело два'), 'расписание по времени');
  assert.ok(await p.isVisible('.day-cards'));
});

test('календарь: создать, изменить, выполнить, повтор, удалить', async (p) => {
  await go(p, 'calendar/month');
  await p.click('.cal-add');
  await p.waitForSelector('.sheet');
  await p.fill('.sheet .title-input', 'Стоматолог');
  await p.click('.sheet .toggle >> text=Весь день');
  await p.fill('.sheet input[type=time] >> nth=0', '10:00');
  await p.click('.sheet .chip >> text=30 мин');
  await closeSheet(p);
  let ev = (await all(p, 'events')).find((e) => e.title === 'Стоматолог');
  assert.equal(ev.start, '10:00'); assert.equal(ev.duration, 30); assert.equal(ev.date, ymd());
  // день и неделя
  await p.click('.segmented >> text=День');
  assert.ok(await p.isVisible('.tg-event:has-text("Стоматолог")'));
  await p.click('.segmented >> text=Неделя');
  assert.ok(await p.isVisible('.tg-event:has-text("Стоматолог")'));
  // изменить: перенос на завтра + повтор каждую неделю
  await p.click('.tg-event:has-text("Стоматолог")');
  await p.click('.sheet .chips >> text=Завтра');
  await p.selectOption('.sheet select[aria-label="Повторение"]', 'weekly');
  await closeSheet(p);
  ev = (await all(p, 'events')).find((e) => e.title === 'Стоматолог');
  assert.equal(ev.date, plusDays(1)); assert.equal(ev.repeat.type, 'weekly');
  // выполнено в конкретный день
  await go(p, 'calendar/day/' + plusDays(8));
  await p.click('.tg-event:has-text("Стоматолог")');
  await p.click('.sheet .btn >> text=Выполнено');
  await p.waitForTimeout(300);
  ev = (await all(p, 'events')).find((e) => e.title === 'Стоматолог');
  assert.deepEqual(ev.doneDates, [plusDays(8)]);
  // удалить один день серии
  await p.click('.tg-event:has-text("Стоматолог")');
  await p.click('.sheet .btn >> text=Удалить');
  await p.click('.menu-item >> text=Только этот день');
  await p.waitForTimeout(300);
  ev = (await all(p, 'events')).find((e) => e.title === 'Стоматолог');
  assert.deepEqual(ev.exDates, [plusDays(8)]);
  assert.equal(await p.locator('.tg-event:has-text("Стоматолог")').count(), 0);
  // связь с задачей
  const task = await act(p, 'addTask', { title: 'Связанная задача', date: ymd() });
  const linked = await act(p, 'scheduleTask', task.id, { start: '12:00' });
  await act(p, 'toggleEventDone', linked.id, ymd());
  assert.equal((await all(p, 'tasks')).find((t) => t.id === task.id).status, 'done');
});

test('обзоры: утро и вечер, перенос на завтра', async (p) => {
  await act(p, 'addTask', { title: 'Недоделка', date: ymd() });
  await act(p, 'addTask', { title: 'Хвост', date: plusDays(-1) });
  await go(p, 'review/morning');
  assert.ok(await p.isVisible('text=Осталось с прошлых дней'));
  await p.click('text=Всё на сегодня');
  await p.waitForTimeout(200);
  await go(p, 'review/evening');
  assert.ok(await p.isVisible('text=Что не успел'));
  await p.click('text=Перенести всё на завтра');
  await p.waitForTimeout(200);
  const tasks = await all(p, 'tasks');
  assert.equal(tasks.find((t) => t.title === 'Недоделка').date, plusDays(1));
  assert.equal(tasks.find((t) => t.title === 'Хвост').date, plusDays(1));
  await p.fill('textarea[data-keep="evening-note"]', 'Хороший день');
  await p.click('text=Закрыть день');
  await p.waitForTimeout(200);
  assert.ok((await all(p, 'log')).some((l) => l.text === 'Хороший день'));
});

test('поиск по всему', async (p) => {
  await act(p, 'addNote', { title: 'Рецепт шарлотки', text: 'яблоки, мука' });
  await go(p, 'search');
  await p.fill('.search-input', 'шарлот');
  assert.ok(await p.isVisible('.result-row:has-text("Рецепт шарлотки")'));
  await p.fill('.search-input', 'стоматолог');
  assert.ok(await p.isVisible('.result-row:has-text("Стоматолог")'));
  await p.fill('.search-input', 'ъъъъ');
  assert.ok(await p.isVisible('text=Ничего не нашлось'));
  await p.fill('.search-input', '');
});

test('корзина: удалить, вернуть, удалить навсегда', async (p) => {
  const t = await act(p, 'addTask', { title: 'Удаляемая' });
  await act(p, 'deleteTask', t.id);
  assert.ok(!(await all(p, 'tasks')).some((x) => x.id === t.id));
  await go(p, 'trash');
  await p.click('.trash-row:has-text("Удаляемая") >> text=Вернуть');
  await p.waitForTimeout(100);
  assert.ok((await all(p, 'tasks')).some((x) => x.id === t.id));
  await act(p, 'deleteTask', t.id);
  await p.click('.trash-row:has-text("Удаляемая") [aria-label="Удалить навсегда"]');
  await p.click('.confirm-sheet .btn-danger');
  await p.waitForTimeout(400);
  assert.equal(await p.locator('.trash-row:has-text("Удаляемая")').count(), 0);
});

test('копия: шифрование, неверный пароль, замена и объединение', async (p) => {
  const res = await p.evaluate(async () => {
    const b = await import('./js/core/backup.js');
    const store = await import('./js/core/store.js');
    const actions = await import('./js/core/actions.js');
    const before = store.all('tasks').length;
    const plain = await b.exportBackup('');
    const enc = await b.exportBackup('секрет123');
    const out = { before, encHasTitle: enc.text.includes('Купить молоко'), plainHasTitle: plain.text.includes('Купить молоко') };
    out.need = (await b.readBackup(enc.text)).needPassword === true;
    try { await b.readBackup(enc.text, 'не тот'); out.wrong = 'принят'; } catch (e) { out.wrong = e.message; }
    try { await b.readBackup('{"x":1}'); out.bad = 'принят'; } catch (e) { out.bad = e.message; }
    const ok = await b.readBackup(enc.text, 'секрет123');
    // после копии: одну задачу меняем, одну добавляем, одну стираем навсегда
    const tasks = store.all('tasks');
    actions.updateTask(tasks[0].id, { title: 'ИЗМЕНЕНО ПОСЛЕ КОПИИ' });
    const extra = actions.addTask({ title: 'Новая после копии' });
    store.purge('tasks', tasks[1].id);
    const m = await b.applyBackup(ok.payload, 'merge');
    out.merge = m;
    out.afterMerge = store.all('tasks').length;
    out.keptNewer = store.get('tasks', tasks[0].id).title;
    out.keptExtra = !!store.get('tasks', extra.id);
    await b.applyBackup(ok.payload, 'replace');
    out.afterReplace = store.all('tasks').length;
    out.replacedTitle = store.get('tasks', tasks[0].id).title;
    out.extraGone = !store.get('tasks', extra.id);
    return out;
  });
  assert.equal(res.encHasTitle, false, 'в зашифрованном файле нет открытого текста');
  assert.equal(res.plainHasTitle, true);
  assert.equal(res.need, true);
  assert.match(res.wrong, /Неверный пароль/);
  assert.match(res.bad, /не файл копии/);
  assert.equal(res.merge.added, 1);
  assert.equal(res.afterMerge, res.before + 1);
  assert.equal(res.keptNewer, 'ИЗМЕНЕНО ПОСЛЕ КОПИИ');
  assert.equal(res.keptExtra, true);
  assert.equal(res.afterReplace, res.before);
  assert.notEqual(res.replacedTitle, 'ИЗМЕНЕНО ПОСЛЕ КОПИИ');
  assert.equal(res.extraGone, true);
  await p.reload(); await p.waitForSelector('html.ready');
  assert.equal((await all(p, 'tasks')).length, res.before, 'после перезагрузки данные на месте');
});

test('копия через интерфейс: скачивание и импорт файла', async (p, { name }) => {
  if (name === 'phone') return; // на телефоне открывается системное «Поделиться» — в тесте его нет
  await go(p, 'settings');
  await p.fill('input[data-keep="backup-pw"]', 'пароль');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=Сохранить копию')]);
  const path = await dl.path();
  assert.match(dl.suggestedFilename(), /^said-os-\d{4}-\d{2}-\d{2}-encrypted\.json$/);
  await act(p, 'addTask', { title: 'Появилась позже' });
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('text=Импорт из файла копии')]);
  await chooser.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: require('fs').readFileSync(path) });
  await p.fill('.confirm-sheet input[type=password]', 'пароль');
  await p.click('.confirm-sheet >> text=Открыть');
  await p.click('text=Заменить всё содержимым копии');
  await p.click('.confirm-sheet .btn-danger');
  await p.waitForSelector('.toast >> text=Данные заменены');
  assert.ok(!(await all(p, 'tasks')).some((t) => t.title === 'Появилась позже'));
});

test('напоминание внутри приложения: баннер, отложить, выполнено', async (p) => {
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const t = await act(p, 'addTask', { title: 'Напомни мне', date: ymd(), time: hm });
  await p.evaluate(async () => (await import('./js/ui/reminders.js')).checkRemindersNow());
  await p.waitForSelector('.banner:has-text("Напомни мне")');
  await p.click('.banner:has-text("Напомни мне") >> text=10 мин');
  await p.waitForTimeout(300);
  let due = await p.evaluate(async () => (await import('./js/ui/reminders.js')).dueReminders().length);
  assert.equal(due, 0, 'отложенное не срабатывает сразу');
  due = await p.evaluate(async () => (await import('./js/ui/reminders.js')).dueReminders(Date.now() + 11 * 60000).map((r) => r.title));
  assert.ok(due.includes('Напомни мне'), 'через 10 минут сработает снова');
  await p.evaluate(async () => { const s = await import('./js/core/store.js'); s.setMeta('snooze', {}); (await import('./js/ui/reminders.js')).checkRemindersNow(); });
  await p.click('.banner:has-text("Напомни мне") >> text=Выполнено');
  await p.waitForTimeout(100);
  assert.equal((await all(p, 'tasks')).find((x) => x.id === t.id).status, 'done');
});

test('.ics для Календаря iPhone с напоминаниями', async (p, { name }) => {
  const t = await act(p, 'addTask', { title: 'Сдать документы', date: plusDays(2), time: '09:30' });
  await go(p, 'tasks');
  await p.evaluate(async (id) => (await import('./js/ui/edit-task.js')).openTaskEditor(id), t.id);
  await p.click('.sheet >> text=В Календарь iPhone');
  await p.waitForSelector('.menu-sheet >> text=Напоминания');
  await p.check('.check-line:has-text("За 1 день") input');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.menu-sheet .btn.big')]);
  const text = require('fs').readFileSync(await dl.path(), 'utf8');
  assert.match(text, /BEGIN:VEVENT/); assert.match(text, /SUMMARY:Сдать документы/);
  assert.match(text, new RegExp(`DTSTART:${plusDays(2).replace(/-/g, '')}T093000`));
  assert.equal((text.match(/BEGIN:VALARM/g) || []).length, 2);
  assert.match(text, /TRIGGER:-PT1440M/);
  await closeSheet(p); await closeSheet(p);
});

test('тема: светлая по умолчанию, тёмная и системная', async (p) => {
  await go(p, 'settings');
  await p.click('.segmented >> text=Светлая');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'light');
  await p.click('.segmented >> text=Тёмная');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await p.waitForTimeout(150);
  await p.reload(); await p.waitForSelector('html.ready');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'dark', 'тема сохраняется');
  await go(p, 'settings');
  await p.click('.segmented >> text=Как в системе');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'light');
  await p.click('.segmented >> text=Светлая');
});

test('демо-данные: загрузить и удалить, свои записи целы', async (p) => {
  const mine = (await all(p, 'tasks')).length;
  await go(p, 'settings');
  await p.click('text=Загрузить демо-данные');
  await p.waitForTimeout(200);
  assert.ok((await all(p, 'tasks')).length > mine);
  for (const r of ['today', 'inbox', 'tasks', 'calendar/week', 'calendar/day', 'calendar/month', 'notes', 'later', 'goals', 'habits', 'log', 'review', 'focus', 'more', 'trash', 'search']) { await go(p, r); assert.equal(await p.locator('text=Ошибка на экране').count(), 0, r);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'горизонтальная прокрутка на экране ' + r); }
  await go(p, 'settings');
  await p.click('text=Удалить демо-данные');
  await p.waitForTimeout(200);
  assert.equal((await all(p, 'tasks')).length, mine);
  for (const s of ['inbox', 'tasks', 'events', 'notes', 'goals', 'habits', 'log']) assert.ok(!(await all(p, s)).some((r) => r.demo), s);
});

test('офлайн: приложение открывается без сети', async (p, { ctx }) => {
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForFunction(() => !!navigator.serviceWorker.controller || true);
  await p.reload(); await p.waitForSelector('html.ready'); // теперь страницей управляет service worker
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForSelector('html.ready');
  assert.ok(await p.isVisible('#fab'));
  await go(p, 'tasks'); await go(p, 'calendar');
  assert.ok(await p.isVisible('.cal-bar'));
  await ctx.setOffline(false);
});

(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  for (const [name, opts] of Object.entries(sizes)) {
    const ctx = await browser.newContext({ ...opts, acceptDownloads: true });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push(m.text()); });
    await p.goto(URL_);
    await p.waitForSelector('html.ready');
    for (const t of tests) {
      if (only && !t.name.includes(only)) continue;
      try {
        await p.keyboard.press('Escape');
        await t.fn(p, { name, ctx });
        if (errors.length) throw new Error('Ошибки в консоли: ' + errors.splice(0).join(' | '));
        console.log(`✅ [${name}] ${t.name}`);
      } catch (e) {
        failed++;
        console.log(`❌ [${name}] ${t.name}\n   ${String(e.message).split('\n').slice(0, 6).join('\n   ')}`);
        await p.screenshot({ path: `${process.env.SHOT_DIR || '.'}/fail-${name}-${tests.indexOf(t)}.png` }).catch(() => {});
        errors.length = 0;
        await p.evaluate(async () => (await import('./js/ui/sheet.js')).closeAllSheets()).catch(() => {});
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log(failed ? `\nПровалено: ${failed}` : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
