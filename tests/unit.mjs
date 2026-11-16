// Быстрые проверки логики без браузера:  node tests/unit.mjs
// (Необязательно для работы приложения — это страховка при изменениях.)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRu } from '../js/core/parse-date.js';
import { nextDate, occursOn } from '../js/core/recur.js';
import { addDays, addMonths, weekStart, diffDays, fmtRel } from '../js/core/dates.js';
import { buildIcs, parseIcs } from '../js/core/ics.js';

let n = 0;
const t = (name, fn) => { fn(); n++; };
const NOW = new Date(2026, 10, 16, 12, 0); // понедельник, 16 ноября 2026, 12:00
const p = (s) => parseRu(s, NOW);

t('даты', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(weekStart('2026-11-22'), '2026-11-16');
  assert.equal(diffDays('2026-11-16', '2026-11-20'), 4);
});
t('распознавание: простые слова', () => {
  assert.equal(p('Купить хлеб завтра').date, '2026-11-17');
  assert.equal(p('Купить хлеб завтра').clean, 'Купить хлеб');
  assert.equal(p('послезавтра врач').date, '2026-11-18');
  assert.equal(p('сегодня в 15:00 созвон').time, '15:00');
  assert.equal(p('сегодня в 15:00 созвон').date, '2026-11-16');
  assert.equal(p('сегодня в 15:00 созвон').clean, 'созвон');
});
t('распознавание: дни недели', () => {
  assert.equal(p('в пятницу кино').date, '2026-11-20');
  assert.equal(p('во вторник зал').date, '2026-11-17');
  assert.equal(p('в понедельник отчёт').date, '2026-11-23'); // сегодня понедельник → следующий
  assert.equal(p('в следующую среду').date, '2026-11-25');
});
t('распознавание: через …', () => {
  assert.equal(p('через неделю оплатить').date, '2026-11-23');
  assert.equal(p('через 3 дня').date, '2026-11-19');
  assert.equal(p('через 2 недели').date, '2026-11-30');
  assert.equal(p('через месяц').date, '2026-12-16');
  assert.equal(p('через 2 часа позвонить').time, '14:00');
  assert.equal(p('через полчаса').time, '12:30');
});
t('распознавание: числа и время', () => {
  assert.equal(p('25 декабря подарки').date, '2026-12-25');
  assert.equal(p('5 января').date, '2027-01-05');
  assert.equal(p('встреча 20.11').date, '2026-11-20');
  assert.equal(p('в 9:30 зарядка').date, '2026-11-17'); // время уже прошло → завтра
  assert.equal(p('в 18:00 зал').date, '2026-11-16');
  assert.equal(p('в 7 вечера ужин').time, '19:00');
  assert.equal(p('в 15 часов').time, '15:00');
});
t('распознавание: без самодеятельности', () => {
  assert.equal(p('Купить 2 батона'), null);
  assert.equal(p('Посмотреть сериал'), null);
  assert.equal(p('завтрак с мамой'), null);
  assert.equal(p('в среднем 5 штук'), null);
  assert.equal(p('версия 1.25.3 не работает'), null);
});
t('повторы', () => {
  assert.equal(nextDate({ type: 'daily' }, '2026-11-16'), '2026-11-17');
  assert.equal(nextDate({ type: 'weekly' }, '2026-11-16'), '2026-11-23');
  assert.equal(nextDate({ type: 'monthly' }, '2026-01-31', '2026-01-31'), '2026-02-28');
  assert.equal(nextDate({ type: 'monthly' }, '2026-02-28', '2026-01-31'), '2026-03-31');
  assert.equal(nextDate({ type: 'days', days: [1, 5] }, '2026-11-16'), '2026-11-20');
  const ev = { date: '2026-11-16', repeat: { type: 'days', days: [1, 3] }, exDates: ['2026-11-18'] };
  assert.equal(occursOn(ev, '2026-11-23'), true);
  assert.equal(occursOn(ev, '2026-11-18'), false);
  assert.equal(occursOn(ev, '2026-11-17'), false);
  assert.equal(occursOn({ date: '2026-01-31', repeat: { type: 'monthly' } }, '2026-02-28'), true);
  assert.equal(occursOn({ date: '2026-11-16', repeat: null }, '2026-11-17'), false);
});
t('ics: туда и обратно', () => {
  const src = [{ id: 'a1', title: 'Встреча; важная, очень', notes: 'строка 1\nстрока 2', date: '2026-11-20', start: '15:30', duration: 45, repeat: { type: 'days', days: [1, 5] } },
    { id: 'a2', title: 'День рождения', date: '2026-12-01', start: null }];
  const text = buildIcs(src, () => [0, 10]);
  assert.ok(text.includes('BEGIN:VALARM') && text.includes('TRIGGER:-PT10M') && text.includes('RRULE:FREQ=WEEKLY;BYDAY=MO,FR'));
  assert.ok(text.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75));
  const back = parseIcs(text);
  assert.equal(back.length, 2);
  assert.equal(back[0].title, 'Встреча; важная, очень');
  assert.equal(back[0].notes, 'строка 1\nстрока 2');
  assert.equal(back[0].start, '15:30');
  assert.equal(back[0].duration, 45);
  assert.deepEqual(back[0].repeat, { type: 'days', days: [1, 5] });
  assert.equal(back[1].start, null);
});
t('service worker: все файлы приложения в списке кэша', () => {
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const walk = (dir) => fs.readdirSync(new URL('../' + dir, import.meta.url), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
  for (const f of [...walk('js'), ...walk('css')]) assert.ok(sw.includes(`'${f}'`), `нет в sw.js: ${f}`);
});
console.log(`OK: ${n} групп проверок`);
