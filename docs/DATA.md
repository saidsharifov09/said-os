# Данные: где лежат, как устроены, как менять

## Где хранятся
Всё хранится **только на устройстве**, в IndexedDB браузера, база `said-os`. Никаких серверов.
Единственное, что лежит вне базы, — выбранная тема в `localStorage` (`said-os-theme`), чтобы экран не мигал при запуске.

Код:
- `js/core/db.js` — тонкая обёртка над IndexedDB (единственное место, где она используется);
- `js/core/store.js` — данные в памяти + запись в базу, корзина, подписка на изменения;
- `js/core/schema.js` — версия схемы, миграции, стартовые разделы и категории;
- `js/core/actions.js` — все изменения данных (экраны вызывают только их).

## Версии
- **Версия структуры базы** (`DB_VERSION` в `db.js`) = 1. Меняется, только если добавляется новое хранилище.
- **Версия схемы данных** (`SCHEMA_VERSION` в `schema.js`) = 1. Хранится в `meta.schemaVersion` и в каждом файле копии (`schema`).

## Хранилища и поля
У каждой записи есть служебные поля: `id` (строка), `createdAt`, `updatedAt` (миллисекунды), `deletedAt` (если запись в корзине), `demo: true` (если это демо-данные).
Даты — строки `YYYY-MM-DD`, время — `HH:MM`.

| Хранилище | Что это | Поля |
|---|---|---|
| `inbox` | Входящие | `text`, `hint` = `{date, time, clean}` или `null` (подсказка даты) |
| `tasks` | Задачи | `title`, `notes`, `date`, `time`, `remind` (за сколько минут напомнить, `null` — нет), `priority` 0–3, `category` (id), `subtasks` = `[{id,title,done}]`, `status` `open`/`done`, `doneAt`, `repeat`, `seriesStart`, `repeatOf` (id исходной задачи у копии-выполнения), `goalId`, `focusDate` (день, когда задача — «главное»), `focusOrder` |
| `events` | События | `title`, `notes`, `location`, `date` (начало/начало серии), `start` (`null` = весь день), `duration` (мин), `color`, `category`, `repeat`, `exDates` (исключённые дни), `doneDates` (дни, отмеченные выполненными), `taskId` (связанная задача), `remind`, `icsUid` (если импортировано из .ics) |
| `notes` | Заметки и «Посмотреть позже» | `sectionId`, `title`, `text`, `tags` `[]`, `images` = `[{id, data}]` (JPEG data-URL), `pinned`, `archived`; для «позже»: `url`, `kind` (`link/article/video/film/other`), `watched` |
| `sections` | Разделы блокнота | `name`, `emoji`, `order`, `system` (нельзя удалить) |
| `categories` | Категории задач/событий | `name`, `color` (ключ палитры из `schema.js`), `order` |
| `goals` | Цели | `title`, `notes`, `deadline`, `milestones` = `[{id,title,done}]`, `status` `active/done/paused`, `color` |
| `habits` | Привычки | `title`, `color`, `days` (дни недели 0–6, пусто = каждый день), `marks` = `{ 'YYYY-MM-DD': 1 }`, `archived` |
| `log` | История | `date`, `time`, `type` (`did/place/met/learned/decision/other`), `text`, `people`, `place`, `taskId`, `eventId` |
| `meta` | Настройки (ключ → значение) | `theme`, `name`, `sound`, `sysNotify`, `seeded`, `schemaVersion`, `firstRunAt`, `lastBackupAt`, `backupSnoozeUntil`, `reviews`, `fired`, `snooze`, `captureKeepOpen` |

`repeat` = `null` или `{ type: 'daily' | 'weekly' | 'monthly' | 'days', days?: [0..6], until?: 'YYYY-MM-DD' }` (0 — воскресенье).

## Файл резервной копии
Без шифрования:
```json
{ "app": "said-os", "schema": 1, "exportedAt": "2026-11-16T19:00:00.000Z", "encrypted": false,
  "data": { "tasks": [...], "events": [...], ... }, "meta": { ... } }
```
С паролем `data` и `meta` заменяются на зашифрованный `payload` (AES-GCM 256; ключ — PBKDF2-SHA256, 250 000 итераций; `salt` и `iv` лежат рядом в base64).

## Как добавить поле или изменить формат (миграция)
1. Измени код, который создаёт запись (`actions.js`).
2. Если старым записям нужно значение по умолчанию: в `schema.js` увеличь `SCHEMA_VERSION` (например, до 2) и добавь функцию в `MIGRATIONS`:
   ```js
   const MIGRATIONS = {
     1: ({ data }) => { data.tasks.forEach((t) => { t.estimate ??= null; }); },
   };
   ```
   Она выполнится один раз при запуске на каждом устройстве и при импорте старых копий.
3. Опиши поле в таблице выше.
4. Увеличь `VERSION` в `sw.js` и `APP_VERSION` в `js/version.js`.

Новое хранилище: добавь имя в `STORES` в `db.js` и увеличь там `DB_VERSION`.
