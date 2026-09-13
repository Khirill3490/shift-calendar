'use strict';
const Schedule = (() => {
  const DAY = 86400000, ANCHOR = Date.UTC(2026, 8, 13);
  const types = {extra:'Подработка', sick:'Больничный', vacation:'Отпуск', leave:'Отгул', other:'Другое'};
  const key = ms => new Date(ms).toISOString().slice(0, 10);
  function parse(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Укажи корректную дату.');
    const ms = Date.parse(value + 'T00:00:00Z');
    if (!Number.isFinite(ms) || key(ms) !== value || value < '1900-01-01' || value > '2200-12-31') throw Error('Дата должна быть между 1900 и 2200 годом.');
    return ms;
  }
  const phase = ms => ((Math.round((ms - ANCHOR) / DAY) % 4) + 4) % 4;
  const baseWork = ms => phase(ms) >= 2;
  function working(ms, marks) {
    const mark = marks[key(ms)];
    if (!mark) return baseWork(ms);
    if (mark.type === 'extra') return true;
    if (mark.type !== 'other') return false;
    return mark.effect === 'base' ? baseWork(ms) : mark.effect === 'work';
  }
  function range(from, to) {
    const start = parse(from), end = parse(to);
    if (end < start) throw Error('Конец периода должен быть не раньше начала.');
    if ((end - start) / DAY >= 366) throw Error('Выбери период не длиннее 366 дней.');
    return Array.from({length: (end - start) / DAY + 1}, (_, i) => key(start + i * DAY));
  }
  function validateMarks(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length > 20000) throw Error('Некорректный файл отметок.');
    const result = Object.create(null);
    for (const [date, mark] of Object.entries(input)) {
      parse(date);
      if (!mark || !Object.hasOwn(types, mark.type) || typeof mark.note !== 'string' || mark.note.length > 500 || typeof mark.title !== 'string' || mark.title.length > 60 || !['base','work','off'].includes(mark.effect) || (mark.type === 'other' && !mark.title.trim())) throw Error('В файле есть некорректная отметка.');
      result[date] = {type:mark.type, note:mark.note, title:mark.title, effect:mark.effect};
    }
    return result;
  }
  function readBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch { throw Error('Не удалось прочитать JSON-файл.'); }
    if (data?.app !== 'shift-calendar' || data.version !== 1) throw Error('Выбери файл, сохранённый этим календарём.');
    return validateMarks(data.marks);
  }
  const label = mark => mark.type === 'other' ? mark.title : types[mark.type];
  return {DAY, ANCHOR, key, parse, phase, baseWork, working, range, validateMarks, readBackup, label};
})();
