// Service worker: приложение работает без интернета.
// Все файлы кладутся в кэш при установке. Дальше отдаём из кэша мгновенно,
// а в фоне тихо скачиваем свежую версию (она появится при следующем открытии).
//
// ВАЖНО при изменениях: 1) добавил новый файл — впиши его в FILES;
// 2) увеличь VERSION (и APP_VERSION в js/version.js) — тогда обновление придёт всем сразу и целиком.

const VERSION = '1.0.0';
const CACHE = `said-os-${VERSION}`;

const FILES = [
  './',
  'index.html',
  'manifest.json',
  'css/base.css',
  'css/ui.css',
  'css/views.css',
  'js/app.js',
  'js/version.js',
  'js/core/actions.js',
  'js/core/ai-bridge.js',
  'js/core/backup.js',
  'js/core/dates.js',
  'js/core/db.js',
  'js/core/demo.js',
  'js/core/ics.js',
  'js/core/parse-date.js',
  'js/core/recur.js',
  'js/core/schema.js',
  'js/core/search.js',
  'js/core/selectors.js',
  'js/core/store.js',
  'js/ui/capture.js',
  'js/ui/controls.js',
  'js/ui/dom.js',
  'js/ui/edit-event.js',
  'js/ui/edit-misc.js',
  'js/ui/edit-note.js',
  'js/ui/edit-task.js',
  'js/ui/ics-sheet.js',
  'js/ui/items.js',
  'js/ui/refresh.js',
  'js/ui/reminders.js',
  'js/ui/sheet.js',
  'js/ui/theme.js',
  'js/views/calendar.js',
  'js/views/focus.js',
  'js/views/goals.js',
  'js/views/habits.js',
  'js/views/inbox.js',
  'js/views/later.js',
  'js/views/log.js',
  'js/views/more.js',
  'js/views/notes.js',
  'js/views/review.js',
  'js/views/search.js',
  'js/views/settings.js',
  'js/views/tasks.js',
  'js/views/today.js',
  'js/views/trash.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('said-os-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Любой переход по страницам приложения — это index.html
    const key = req.mode === 'navigate' ? './' : req;
    const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    const refresh = fetch(req.mode === 'navigate' ? './' : req, { cache: 'no-cache' })
      .then((res) => { if (res.ok) cache.put(key, res.clone()); return res; })
      .catch(() => null);
    if (cached) { event.waitUntil(refresh); return cached; }
    return (await refresh) || new Response('Нет соединения', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});

// Нажатие на системное уведомление — открыть приложение
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow('./'))));
});
