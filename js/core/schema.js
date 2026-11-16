// Версия схемы данных и миграции. Подробности — docs/DATA.md.
// Если меняешь формат записей: увеличь SCHEMA_VERSION и добавь функцию в MIGRATIONS.

export const SCHEMA_VERSION = 1;

// MIGRATIONS[n] переводит данные с версии n на версию n+1.
// Получает { data: {tasks:[],...}, meta: {...} } и меняет их на месте.
const MIGRATIONS = {
  // 1: ({ data }) => { data.tasks.forEach((t) => { t.newField ??= null; }); },
};

export function migrate(bundle, fromVersion) {
  let v = fromVersion || 1;
  while (v < SCHEMA_VERSION) {
    MIGRATIONS[v]?.(bundle);
    v++;
  }
  return bundle;
}

// Стартовые разделы блокнота. id фиксированные, чтобы при переносе между устройствами не было дублей.
export const DEFAULT_SECTIONS = [
  ['sec-self', 'Для себя', '🌿'],
  ['sec-later', 'Посмотреть позже', '🔖'],
  ['sec-places', 'Куда сходить', '📍'],
  ['sec-tell', 'Кому рассказать', '💬'],
  ['sec-buy', 'Что купить', '🛒'],
  ['sec-ideas', 'Идеи', '💡'],
  ['sec-facts', 'Интересные факты', '✨'],
  ['sec-important', 'Важная информация', '📌'],
  ['sec-movies', 'Фильмы и сериалы', '🎬'],
  ['sec-books', 'Книги', '📚'],
  ['sec-projects', 'Мои проекты', '🚀'],
  ['sec-misc', 'Разное', '🗂️'],
].map(([id, name, emoji], i) => ({ id, name, emoji, order: i, system: id === 'sec-later' || id === 'sec-misc' }));

export const LATER_SECTION = 'sec-later';
export const MISC_SECTION = 'sec-misc';

// Палитра цветов для категорий, событий, привычек (холодная гамма + несколько тёплых для различимости)
export const COLORS = {
  blue: '#2F7DEB',
  sky: '#2BA6E8',
  cyan: '#14A9BD',
  teal: '#12A594',
  green: '#3BA55D',
  indigo: '#5B6FE0',
  slate: '#64748B',
  amber: '#D98A00',
  orange: '#E5743A',
  pink: '#D9608F',
};
export const colorOf = (key) => COLORS[key] || COLORS.blue;

export const DEFAULT_CATEGORIES = [
  ['cat-personal', 'Личное', 'blue'],
  ['cat-work', 'Работа', 'indigo'],
  ['cat-study', 'Учёба', 'cyan'],
  ['cat-health', 'Здоровье', 'green'],
  ['cat-home', 'Дом', 'amber'],
].map(([id, name, color], i) => ({ id, name, color, order: i }));

export const PRIORITIES = [
  { v: 0, label: 'Нет' },
  { v: 1, label: 'Низкий' },
  { v: 2, label: 'Средний' },
  { v: 3, label: 'Высокий' },
];

export const LOG_TYPES = [
  { v: 'did', label: 'Что делал', emoji: '✅' },
  { v: 'place', label: 'Где был', emoji: '📍' },
  { v: 'met', label: 'С кем встречался', emoji: '🤝' },
  { v: 'learned', label: 'Что узнал', emoji: '💡' },
  { v: 'decision', label: 'Решение', emoji: '⚖️' },
  { v: 'other', label: 'Другое', emoji: '📝' },
];

export const LATER_KINDS = [
  { v: 'link', label: 'Ссылка', emoji: '🔗' },
  { v: 'article', label: 'Статья', emoji: '📰' },
  { v: 'video', label: 'Видео', emoji: '▶️' },
  { v: 'film', label: 'Фильм', emoji: '🎬' },
  { v: 'other', label: 'Другое', emoji: '🔖' },
];

// Названия хранилищ для интерфейса (корзина, поиск)
export const STORE_LABELS = {
  inbox: 'Входящие', tasks: 'Задача', events: 'Событие', notes: 'Заметка', sections: 'Раздел',
  categories: 'Категория', goals: 'Цель', habits: 'Привычка', log: 'История',
};
