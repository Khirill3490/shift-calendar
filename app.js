'use strict';
const {DAY, key, parse, phase, baseWork, working, range, label} = Schedule;
const STORAGE = 'shift-calendar.marks.v1';
const el = id => document.getElementById(id);
const fmt = (ms, options) => new Intl.DateTimeFormat('ru-RU', {...options, timeZone:'UTC'}).format(new Date(ms));
const upper = text => text.charAt(0).toUpperCase() + text.slice(1);
function moscowToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Moscow', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date());
  const get = type => Number(parts.find(p => p.type === type).value);
  return Date.UTC(get('year'), get('month') - 1, get('day'));
}
let marks = Object.create(null), storageReady = true;
function notify(message) { el('notice').textContent = message; el('notice').hidden = false; }
try {
  const raw = localStorage.getItem(STORAGE);
  if (raw) marks = Schedule.validateMarks(JSON.parse(raw));
} catch {
  storageReady = false;
  notify('Не удалось прочитать сохранённые отметки. Они не перезаписаны. Проверь доступ к хранилищу браузера и перезагрузи страницу.');
}
function persist(next) {
  if (!storageReady) throw Error('Хранилище недоступно. Проверь настройки браузера и перезагрузи страницу.');
  const clean = Schedule.validateMarks(next);
  try { localStorage.setItem(STORAGE, JSON.stringify(clean)); }
  catch { throw Error('Не удалось сохранить. Возможно, память браузера заполнена или сохранение запрещено.'); }
  marks = clean;
  render();
}
let today = moscowToday(), month = new Date(today).getUTCMonth(), year = new Date(today).getUTCFullYear(), editorDate = null;
function textElement(tag, text, className) {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className;
  return node;
}
function render() {
  const mark = marks[key(today)], p = phase(today);
  el('todayTitle').textContent = mark ? 'Сегодня: ' + label(mark).toLocaleLowerCase('ru') : baseWork(today) ? 'Сегодня рабочий день' : 'Сегодня выходной';
  el('todayDetail').textContent = upper(fmt(today,{weekday:'long',day:'numeric',month:'long'})) + ' · ' + (mark ? 'По графику: ' + (baseWork(today) ? 'рабочий' : 'выходной') : (p % 2 === 0 ? 'Первый' : 'Второй') + ' ' + (baseWork(today) ? 'рабочий день' : 'выходной') + ' из двух');
  let next = today + DAY;
  while (!working(next, marks)) next += DAY;
  el('nextWork').textContent = fmt(next,{day:'numeric',month:'long'});
  const first = Date.UTC(year,month,1), count = new Date(Date.UTC(year,month+1,0)).getUTCDate(), offset = (new Date(first).getUTCDay()+6)%7;
  el('monthTitle').textContent = upper(fmt(first,{month:'long',year:'numeric'}).replace(' г.',''));
  let work = 0, marked = 0;
  for (let d=0; d<count; d++) {const ms=first+d*DAY; if(working(ms,marks)) work++; if(marks[key(ms)]) marked++;}
  el('monthStats').textContent = `Рабочих: ${work} · Нерабочих: ${count-work}` + (marked ? ` · Отметок: ${marked}` : '');
  el('days').replaceChildren();
  for (let i=0; i<Math.ceil((offset+count)/7)*7; i++) {
    const ms=first+(i-offset)*DAY, date=new Date(ms), record=marks[key(ms)], off=!working(ms,marks);
    const item=document.createElement('button'); item.type='button';
    item.className='day'+(off?' off':'')+(date.getUTCMonth()!==month?' other':'')+(ms===today?' current':'')+(record?' marked mark-'+record.type:'');
    item.dataset.date=key(ms);
    item.setAttribute('aria-label',fmt(ms,{day:'numeric',month:'long',year:'numeric'})+', '+(record?label(record):off?'выходной':'рабочий')+(ms===today?', сегодня':'')+'. Изменить отметку');
    if(ms===today) item.setAttribute('aria-current','date');
    item.append(textElement('span',date.getUTCDate(),'number'),textElement('span',record?label(record):off?'Выходной':'Рабочий','day-label'));
    item.onclick=()=>openEditor(key(ms)); el('days').append(item);
  }
  el('upcoming').replaceChildren();
  for(let i=0;i<8;i++) {
    const ms=today+i*DAY, record=marks[key(ms)], item=document.createElement('button');
    item.className='upcoming-item'+(!working(ms,marks)?' off':'')+(record?' mark-'+record.type:'');
    item.append(textElement('span',i===0?'Сегодня':upper(fmt(ms,{weekday:'short'}))),textElement('strong',fmt(ms,{day:'numeric',month:'short'})),textElement('span',record?label(record):working(ms,marks)?'Рабочий':'Выходной'));
    item.onclick=()=>openEditor(key(ms)); el('upcoming').append(item);
  }
  el('records').replaceChildren();
  const dates=Object.keys(marks).filter(date=>{const d=new Date(parse(date));return d.getUTCFullYear()===year&&d.getUTCMonth()===month;}).sort();
  if(!dates.length) el('records').append(textElement('p','Пока без отметок. Добавь подработку, отпуск или свои планы.','muted empty-records'));
  for(const date of dates) {
    const record=marks[date], row=document.createElement('button');row.className='record mark-'+record.type;
    const copy=document.createElement('span');copy.append(textElement('strong',label(record)),textElement('span',record.note||'Без заметки','muted'));
    row.append(textElement('span',fmt(parse(date),{day:'numeric',month:'short'}),'record-date'),copy,textElement('span','Изменить','muted'));
    row.onclick=()=>openEditor(date);el('records').append(row);
  }
}
function syncType() {
  const custom=el('markType').value==='other';
  el('customField').hidden=!custom;el('effectField').hidden=!custom;el('customTitle').required=custom;
}
function updatePeriodInfo() {
  el('formError').textContent='';
  try {
    const dates=range(el('dateFrom').value,el('dateTo').value), existing=dates.filter(date=>marks[date]).length;
    el('baseInfo').textContent=dates.length===1?'По графику 2/2: '+(baseWork(parse(dates[0]))?'рабочий день':'выходной'):`Дней в периоде: ${dates.length}`;
    if(existing)el('baseInfo').textContent+=` · Уже с отметками: ${existing}`;
    el('deleteMark').hidden=!existing;
    el('deleteMark').textContent=dates.length===1?'Убрать отметку':'Убрать отметки периода';
  } catch { el('baseInfo').textContent='Укажи начало и конец периода.';el('deleteMark').hidden=true; }
}
function openEditor(date) {
  editorDate=date; const record=marks[date];
  el('markForm').reset();el('dateFrom').value=date;el('dateTo').value=date;
  el('markType').value=record?.type||'extra';el('markNote').value=record?.note||'';
  el('customTitle').value=record?.title||'';el('markEffect').value=record?.effect||'base';
  el('editorTitle').textContent=record?'Изменить отметку':'Добавить отметку';
  syncType();updatePeriodInfo();el('editor').showModal();
}
function closeEditor() {
  el('editor').close();
  const day=el('days').querySelector(`[data-date="${editorDate}"]`);if(day)day.focus({preventScroll:true});
}
function confirmAction(message) {
  return new Promise(resolve=>{
    const dialog=el('confirmDialog');el('confirmText').textContent=message;
    let accepted=false;
    el('confirmOK').onclick=()=>{accepted=true;dialog.close();};
    el('confirmCancel').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>resolve(accepted),{once:true});dialog.showModal();
  });
}
el('markForm').onsubmit=async event=>{
  event.preventDefault();
  try {
    const dates=range(el('dateFrom').value,el('dateTo').value), existing=dates.filter(date=>marks[date]).length;
    const record={type:el('markType').value,title:el('markType').value==='other'?el('customTitle').value.trim():'',effect:el('markEffect').value,note:el('markNote').value.trim()};
    if(record.type==='other'&&!record.title)throw Error('Введи название отметки.');
    if(existing && (dates.length>1||dates[0]!==editorDate) && !await confirmAction(`В выбранном периоде уже есть отметки (${existing}). Заменить их новой отметкой?`))return;
    const next={...marks};for(const date of dates)next[date]={...record};persist(next);closeEditor();notify(`Сохранено дней: ${dates.length}. Отметки доступны в этом браузере.`);
  } catch(error) {el('formError').textContent=error.message;}
};
el('deleteMark').onclick=async()=>{
  try {
    const dates=range(el('dateFrom').value,el('dateTo').value), existing=dates.filter(date=>marks[date]);
    if(!existing.length)return;
    if(!await confirmAction(`Убрать отметки (${existing.length})? Для этих дней снова будет действовать обычный график 2/2.`))return;
    const next={...marks};for(const date of existing)delete next[date];persist(next);closeEditor();notify('Отметки удалены. График 2/2 восстановлен.');
  } catch(error) {el('formError').textContent=error.message;}
};
el('closeEditor').onclick=closeEditor;el('markType').onchange=syncType;
el('dateFrom').onchange=()=>{if(el('dateFrom').value>el('dateTo').value)el('dateTo').value=el('dateFrom').value;updatePeriodInfo();};el('dateTo').onchange=updatePeriodInfo;
el('addMark').onclick=()=>openEditor(key(Date.UTC(year,month,year===new Date(today).getUTCFullYear()&&month===new Date(today).getUTCMonth()?new Date(today).getUTCDate():1)));
el('export').onclick=()=>{
  if(!storageReady){notify('Не удалось прочитать отметки. Экспорт отменён.');return;}
  const blob=new Blob([JSON.stringify({app:'shift-calendar',version:1,marks},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`my-shifts-${key(today)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
el('import').onclick=()=>el('importFile').click();
el('importFile').onchange=async()=>{
  const file=el('importFile').files[0];if(!file)return;
  try {
    if(file.size>5*1024*1024)throw Error('Файл слишком большой. Максимум — 5 МБ.');
    const incoming=Schedule.readBackup(await file.text()),count=Object.keys(incoming).length,overlap=Object.keys(incoming).filter(date=>marks[date]).length;
    if(!count)throw Error('В файле нет отметок.');
    if(!await confirmAction(`Загрузить отметки (${count})? Совпадающие даты (${overlap}) будут заменены данными из файла. Остальные отметки сохранятся.`))return;
    persist({...marks,...incoming});notify(`Загружено отметок: ${count}.`);
  } catch(error) {notify(error.message);}finally{el('importFile').value='';}
};
function move(n){const date=new Date(Date.UTC(year,month+n,1));year=date.getUTCFullYear();month=date.getUTCMonth();render();}
el('prev').onclick=()=>move(-1);el('next').onclick=()=>move(1);
el('today').onclick=()=>{today=moscowToday();year=new Date(today).getUTCFullYear();month=new Date(today).getUTCMonth();render();};
function refreshDate(){const now=moscowToday();if(now!==today){today=now;render();}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDate();});
window.addEventListener('storage',event=>{
  if(event.key!==STORAGE)return;
  try {marks=event.newValue?Schedule.validateMarks(JSON.parse(event.newValue)):Object.create(null);render();if(el('editor').open)closeEditor();notify('Отметки обновлены в другой вкладке.');}
  catch {notify('Не удалось прочитать изменения из другой вкладки. Перезагрузи страницу.');}
});
setInterval(refreshDate,60000);render();
