// Экран может попросить перерисовать себя (например, после смены фильтра): refresh()
let fn = () => {};
export const setRefresher = (f) => { fn = f; };
export const refresh = () => fn();
