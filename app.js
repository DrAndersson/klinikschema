const staff = [
  { initials: 'PW', name: 'Per Wahlström', senior: true }, { initials: 'IB', name: 'Izabela Blaszczyk', senior: true },
  { initials: 'CL', name: 'Christina Ljungberg', senior: true }, { initials: 'PJ', name: 'Per Jennalm', senior: true },
  { initials: 'DW', name: 'Dag Welin', senior: true }, { initials: 'PN', name: 'Per Nordmark', senior: true },
  { initials: 'GA', name: 'Gustav Andersson', senior: false }, { initials: 'BB', name: 'Bitte Bergström', senior: false },
  { initials: 'SS', name: 'Staffan Svenlin', senior: false }, { initials: 'CM', name: 'Camilla Mukka', senior: false },
  { initials: 'JL', name: 'Joakim Lundberg', senior: false }, { initials: 'AP', name: 'Anna Pettersson', senior: false }
];
const activities = { clinic: ['Klinik', 'K'], external: ['Annat sjukhus', 'AS'], education: ['Forskning', 'F'], course: ['Kurs', 'Kurs'], admin: ['Administration', 'Adm'], leave: ['Ledig', 'L'], rotation: ['Randning', 'R'] };
const activityColors = { clinic:'#bfe3b6', external:'#d9c3ee', education:'#bde4e6', course:'#ffd0e1', admin:'#f1dcc0', leave:'#e8edf0', rotation:'#e4b8a8' };
const swedishMonths = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];
let currentMonth = 0, currentYear = 2026, selected = null, bulkActive = false;
const bulkSelection = new Set();
let schedule = JSON.parse(localStorage.getItem('kirurgschemat-schedule') || 'null') || {};
let holidays = JSON.parse(localStorage.getItem('kirurgschemat-holidays') || 'null') || {};
let calls = JSON.parse(localStorage.getItem('kirurgschemat-calls-v2') || 'null') || [];
const key = (date, initials) => `${date}-${initials}`;
function daysInMonth() { return new Date(currentYear, currentMonth + 1, 0).getDate(); }
function iso(day) { return `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`; }
function displayDate(dateString) { const date = new Date(`${dateString}T12:00:00`); return `${date.getDate()} ${swedishMonths[date.getMonth()].toLowerCase()}`; }
function formatDate(date) { return date.toISOString().slice(0, 10); }
function addDays(date, days) { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; }
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), month = Math.floor((h + l - 7 * m + 114) / 31) - 1, day = (h + l - 7 * m + 114) % 31 + 1;
  return new Date(Date.UTC(year, month, day));
}
function statutoryHolidayName(dateString) {
  const date = new Date(`${dateString}T12:00:00`), year = date.getFullYear(), fixed = { [`${year}-01-01`]: 'Nyårsdagen', [`${year}-01-06`]: 'Trettondedag jul', [`${year}-05-01`]: 'Första maj', [`${year}-06-06`]: 'Sveriges nationaldag', [`${year}-12-25`]: 'Juldagen', [`${year}-12-26`]: 'Annandag jul' };
  if (fixed[dateString]) return fixed[dateString];
  const easter = easterSunday(year), moveable = { [formatDate(addDays(easter, -2))]: 'Långfredagen', [formatDate(addDays(easter, 1))]: 'Annandag påsk', [formatDate(addDays(easter, 39))]: 'Kristi himmelsfärdsdag', [formatDate(addDays(easter, 49))]: 'Pingstdagen' };
  if (moveable[dateString]) return moveable[dateString];
  const month = date.getMonth(), day = date.getDate(), weekday = date.getDay();
  if (month === 5 && weekday === 6 && day >= 20 && day <= 26) return 'Midsommardagen';
  if ((month === 9 && day === 31 && weekday === 6) || (month === 10 && weekday === 6 && day <= 6)) return 'Alla helgons dag';
  return '';
}
function isHolidayDate(date) { return Boolean(holidays[date] || statutoryHolidayName(date)); }
function isWeekday(date) { const weekday = new Date(`${date}T12:00:00`).getDay(); return weekday !== 0 && weekday !== 6; }
function defaultItem(date) { return { activity: isWeekday(date) && !isHolidayDate(date) ? 'clinic' : '', halfDay:null, unavailable:false, wantsCall:false }; }
function activityText(item) { return item.halfDay ? `${activities[item.halfDay.morning][1]}/${activities[item.halfDay.afternoon][1]}` : item.activity ? activities[item.activity][1] : ''; }
function activityStyle(item) { return item.halfDay ? ` style="--morning:${activityColors[item.halfDay.morning]};--afternoon:${activityColors[item.halfDay.afternoon]}"` : ''; }
function persist() { localStorage.setItem('kirurgschemat-schedule', JSON.stringify(schedule)); localStorage.setItem('kirurgschemat-holidays', JSON.stringify(holidays)); localStorage.setItem('kirurgschemat-calls-v2', JSON.stringify(calls)); document.querySelector('#save-state').textContent = 'Sparat lokalt'; }
function render() {
  document.querySelector('#month-label').textContent = `${swedishMonths[currentMonth]} ${currentYear}`;
  document.querySelector('#schedule-head').innerHTML = `<tr><th class="day-head">Datum</th>${staff.map(p => `<th class="person" title="${p.name}">${p.initials}</th>`).join('')}</tr>`;
  const weekdays = ['Sön','Mån','Tis','Ons','Tor','Fre','Lör'];
  document.querySelector('#schedule-body').innerHTML = Array.from({length:daysInMonth()},(_, i) => {
    const day = i + 1, date = iso(day), weekday = new Date(`${date}T12:00:00`).getDay(), weekend = weekday === 0 || weekday === 6;
    return `<tr class="${weekend?'weekend':''} ${isWeekday(date) && isHolidayDate(date)?'holiday':''}"><td class="day"><span class="date-num">${String(day).padStart(2,'0')}</span>${weekdays[weekday]}</td>${staff.map(person => {
      const item = schedule[key(date,person.initials)] || defaultItem(date);
      return `<td class="activity-cell"><button class="activity-button ${item.halfDay ? 'split' : item.activity || 'empty'} ${bulkSelection.has(key(date,person.initials)) ? 'selected' : ''}"${activityStyle(item)} data-date="${date}" data-person="${person.initials}" aria-label="${person.name}, ${date}: ${item.halfDay ? `${activities[item.halfDay.morning][0]} förmiddag, ${activities[item.halfDay.afternoon][0]} eftermiddag` : item.activity ? activities[item.activity][0] : 'tom aktivitet'}">${activityText(item)}</button>${item.wantsCall?'<span class="desired-dot" title="Önskar jour">✓</span>':''}${item.unavailable?'<span class="unavailable-dot" title="Ej tillgänglig för jour">×</span>':''}</td>`;
    }).join('')}</tr>`;
  }).join('');
  document.querySelectorAll('.activity-button').forEach(button => button.addEventListener('click', () => {
    if (bulkActive) { toggleBulkCell(button.dataset.date, button.dataset.person); return; }
    openActivity(button.dataset.date, button.dataset.person);
  }));
  renderCalls(); renderAvailability();
  document.querySelector('#schedule-summary').textContent = `${daysInMonth()} dagar · ${staff.length} medarbetare`;
  updateBulkUI();
}
function toggleBulkCell(date, initials) {
  const cellKey = key(date, initials);
  bulkSelection.has(cellKey) ? bulkSelection.delete(cellKey) : bulkSelection.add(cellKey);
  document.querySelector(`.activity-button[data-date="${date}"][data-person="${initials}"]`).classList.toggle('selected', bulkSelection.has(cellKey));
  updateBulkUI();
}
function updateBulkUI() {
  document.querySelector('#bulk-mode').hidden = bulkActive;
  document.querySelector('#bulk-controls').hidden = !bulkActive;
  document.querySelector('#selected-count').textContent = `${bulkSelection.size} valda`;
  document.querySelector('#apply-bulk').disabled = bulkSelection.size === 0;
}
function renderCalls() {
  const firstWeekday = (new Date(`${iso(1)}T12:00`).getDay() + 6) % 7;
  const padding = Array.from({length:firstWeekday}, () => '<div class="duty-day blank"></div>').join('');
  const days = Array.from({length:daysInMonth()}, (_, index) => {
    const day = index + 1, date = iso(day), call = calls.find(item => item.date === date);
    const weekday = new Date(`${date}T12:00`).getDay(), weekend = weekday === 0 || weekday === 6;
    const missing = !call?.primary && !call?.backup;
    const primary = call?.primary ? `<span class="duty-entry"><small>PJ</small> ${call.primary}</span>` : '';
    const backup = call?.backup ? `<span class="duty-entry"><small>BJ</small> ${call.backup}</span>` : '';
    return `<button class="duty-day ${weekend?'weekend':''} ${isWeekday(date) && isHolidayDate(date)?'holiday':''} ${missing?'empty-slot':''}" data-duty-date="${date}" aria-label="Planera jour ${displayDate(date)}"><span class="duty-number">${day}</span>${primary}${backup}${missing?'<span class="duty-missing">Obemannad</span>':''}</button>`;
  }).join('');
  document.querySelector('#duty-calendar').innerHTML = padding + days;
  document.querySelectorAll('[data-duty-date]').forEach(button => button.addEventListener('click', () => openCallDialog(button.dataset.dutyDate)));
}
function isUnavailable(date, initials) {
  const item = schedule[key(date, initials)];
  return Boolean(item?.unavailable || item?.activity === 'leave' || item?.halfDay?.morning === 'leave' || item?.halfDay?.afternoon === 'leave');
}
function unavailableLabel(date, initials) {
  const item = schedule[key(date, initials)];
  return item?.activity === 'leave' || item?.halfDay?.morning === 'leave' || item?.halfDay?.afternoon === 'leave' ? 'ledig' : 'ej tillgänglig';
}
function fillCallSelect(selectId, date, selectedValue) {
  const select = document.querySelector(selectId);
  select.innerHTML = '<option value="">Ej bemannad</option>' + staff.map(person => `<option value="${person.initials}" ${isUnavailable(date, person.initials) ? 'disabled' : ''}>${person.name} (${person.initials})${isUnavailable(date, person.initials) ? ` — ${unavailableLabel(date, person.initials)}` : ''}</option>`).join('');
  select.value = selectedValue || '';
}
function openCallDialog(date = iso(1)) {
  const call = calls.find(item => item.date === date) || {};
  document.querySelector('#call-date').value = date;
  document.querySelector('#call-dialog-date-label').textContent = displayDate(date);
  fillCallSelect('#primary-select', date, call.primary);
  fillCallSelect('#backup-select', date, call.backup);
  document.querySelector('#call-dialog').showModal();
}
function renderAvailability() {
  const unavailable = {};
  Object.entries(schedule).forEach(([itemKey,item]) => { if (item.unavailable && itemKey.startsWith(`${currentYear}-${String(currentMonth+1).padStart(2,'0')}`)) { const initials = itemKey.slice(-2); unavailable[initials] = (unavailable[initials] || 0) + 1; } });
  const entries = Object.entries(unavailable).sort((a,b)=>b[1]-a[1]);
  document.querySelector('#availability-list').innerHTML = entries.length ? entries.map(([initials,count]) => `<div class="availability-row"><span>${staff.find(p=>p.initials===initials)?.name || initials}</span><span class="count">${count} dagar</span></div>`).join('') : '<p class="call-note">Inga rapporterade begränsningar den här månaden.</p>';
}
function openActivity(date, initials) {
  selected = {date, initials}; const person = staff.find(p => p.initials === initials); const item = schedule[key(date, initials)] || defaultItem(date);
  document.querySelector('#dialog-date').textContent = displayDate(date); document.querySelector('#dialog-person').textContent = `${person.name} · ${initials}`;
  document.querySelector('#activity-options').innerHTML = `<label><input type="radio" name="activity" value="" ${!item.activity?'checked':''}> Tom</label>` + Object.entries(activities).map(([id,[name]]) => `<label><input type="radio" name="activity" value="${id}" ${item.activity===id?'checked':''}> ${name}</label>`).join('');
  const morning = item.halfDay?.morning || item.activity || 'clinic', afternoon = item.halfDay?.afternoon || 'clinic';
  const selectOptions = Object.entries(activities).map(([id,[name]]) => `<option value="${id}">${name}</option>`).join('');
  document.querySelector('#morning-select').innerHTML = selectOptions; document.querySelector('#afternoon-select').innerHTML = selectOptions;
  document.querySelector('#morning-select').value = morning; document.querySelector('#afternoon-select').value = afternoon;
  document.querySelector('#split-day-checkbox').checked = Boolean(item.halfDay); document.querySelector('#split-options').hidden = !item.halfDay;
  const automaticHoliday = statutoryHolidayName(date);
  document.querySelector('#holiday-checkbox').checked = isHolidayDate(date); document.querySelector('#holiday-checkbox').disabled = Boolean(automaticHoliday); document.querySelector('#holiday-checkbox').title = automaticHoliday ? `${automaticHoliday} markeras automatiskt` : '';
  document.querySelector('#wants-call-checkbox').checked = item.wantsCall; document.querySelector('#unavailable-checkbox').checked = item.unavailable; document.querySelector('#activity-dialog').showModal();
}
document.querySelector('#save-activity').addEventListener('click', event => { event.preventDefault(); const activity = document.querySelector('input[name="activity"]:checked').value, unavailable = document.querySelector('#unavailable-checkbox').checked, split = document.querySelector('#split-day-checkbox').checked; if (!statutoryHolidayName(selected.date)) holidays[selected.date] = document.querySelector('#holiday-checkbox').checked; schedule[key(selected.date,selected.initials)] = {activity:split ? '' : activity, halfDay:split ? {morning:document.querySelector('#morning-select').value, afternoon:document.querySelector('#afternoon-select').value} : null, unavailable, wantsCall:document.querySelector('#wants-call-checkbox').checked && !unavailable}; document.querySelector('#activity-dialog').close(); persist(); render(); });
document.querySelector('#split-day-checkbox').addEventListener('change', event => { document.querySelector('#split-options').hidden = !event.target.checked; });
document.querySelector('#wants-call-checkbox').addEventListener('change', event => { if (event.target.checked) document.querySelector('#unavailable-checkbox').checked = false; });
document.querySelector('#unavailable-checkbox').addEventListener('change', event => { if (event.target.checked) document.querySelector('#wants-call-checkbox').checked = false; });
document.querySelector('#legend-toggle').addEventListener('click', () => { const panel=document.querySelector('#legend-panel'); panel.hidden=!panel.hidden; document.querySelector('#legend-toggle').textContent=panel.hidden?'Visa förklaring':'Dölj förklaring'; });
document.querySelector('#bulk-mode').addEventListener('click', () => { bulkActive = true; bulkSelection.clear(); updateBulkUI(); });
document.querySelector('#cancel-bulk').addEventListener('click', () => { bulkActive = false; bulkSelection.clear(); render(); });
document.querySelector('#apply-bulk').addEventListener('click', () => {
  const activity = document.querySelector('#bulk-activity').value;
  bulkSelection.forEach(cellKey => { schedule[cellKey] = { ...(schedule[cellKey] || { unavailable:false, wantsCall:false }), activity, halfDay:null }; });
  bulkActive = false; bulkSelection.clear(); persist(); render();
});
document.querySelector('#previous-month').addEventListener('click', () => { currentMonth--; if(currentMonth<0){currentMonth=11;currentYear--;} render(); });
document.querySelector('#next-month').addEventListener('click', () => { currentMonth++; if(currentMonth>11){currentMonth=0;currentYear++;} render(); });
document.querySelector('#clear-unavailability').addEventListener('click', () => { Object.values(schedule).forEach(item=>item.unavailable=false); persist(); render(); });
document.querySelector('#add-call').addEventListener('click', () => openCallDialog(iso(1)));
document.querySelector('#call-date').addEventListener('change', event => {
  const call = calls.find(item => item.date === event.target.value) || {};
  document.querySelector('#call-dialog-date-label').textContent = displayDate(event.target.value);
  fillCallSelect('#primary-select', event.target.value, call.primary);
  fillCallSelect('#backup-select', event.target.value, call.backup);
});
document.querySelector('#save-call').addEventListener('click', event => {
  event.preventDefault();
  const date=document.querySelector('#call-date').value, primary=document.querySelector('#primary-select').value, backup=document.querySelector('#backup-select').value;
  if (!date || (primary && primary === backup)) return;
  const entry = {date, primary, backup};
  calls = calls.filter(call => call.date !== date);
  if (primary || backup) calls.push(entry);
  document.querySelector('#call-dialog').close(); persist(); render();
});
render();
