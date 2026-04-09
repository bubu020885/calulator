'use strict';

/* =========================================================================
   Besucher-Budget-Rechner
   ------------------------------------------------------------------------- */

const BUNDESLAENDER = {
  'BW': 'Baden-Württemberg',
  'BY': 'Bayern',
  'BE': 'Berlin',
  'BB': 'Brandenburg',
  'HB': 'Bremen',
  'HH': 'Hamburg',
  'HE': 'Hessen',
  'MV': 'Mecklenburg-Vorpommern',
  'NI': 'Niedersachsen',
  'NW': 'Nordrhein-Westfalen',
  'RP': 'Rheinland-Pfalz',
  'SL': 'Saarland',
  'SN': 'Sachsen',
  'ST': 'Sachsen-Anhalt',
  'SH': 'Schleswig-Holstein',
  'TH': 'Thüringen'
};

const OCCUPANCY_OPTIONS = [
  { value: 'Close',  label: 'Close',  percent: 0   },
  { value: 'Off',    label: 'Off',    percent: 0   },
  { value: 'Low',    label: 'Low',    percent: 25  },
  { value: 'Medium', label: 'Medium', percent: 50  },
  { value: 'High',   label: 'High',   percent: 75  },
  { value: 'Peak',   label: 'Peak',   percent: 100 }
];

const WEEKDAYS_DE = [
  'Sonntag', 'Montag', 'Dienstag', 'Mittwoch',
  'Donnerstag', 'Freitag', 'Samstag'
];

const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

/* =========================================================================
   Date helpers
   ------------------------------------------------------------------------- */

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateDE(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

/* =========================================================================
   German public holidays (Meeus/Jones/Butcher Easter + state specifics)
   ------------------------------------------------------------------------- */

function calculateEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Buß- und Bettag = Wednesday before Nov 23 (only Sachsen). */
function calculateBussUndBettag(year) {
  const nov23 = new Date(year, 10, 23);
  const dow = nov23.getDay(); // 0=Sun..6=Sat
  if (dow === 3) return addDays(nov23, -7);
  if (dow > 3)   return addDays(nov23, -(dow - 3));
  return addDays(nov23, -(dow + 4));
}

function getPublicHolidays(year, state) {
  const easter          = calculateEaster(year);
  const goodFriday      = addDays(easter, -2);
  const easterMonday    = addDays(easter, 1);
  const ascension       = addDays(easter, 39);
  const pentecostMonday = addDays(easter, 50);
  const corpusChristi   = addDays(easter, 60);

  const map = {};
  const add = (date, name) => {
    const key = formatDateISO(date);
    map[key] = map[key] ? `${map[key]}, ${name}` : name;
  };

  // Bundesweit
  add(new Date(year,  0,  1), 'Neujahr');
  add(goodFriday,             'Karfreitag');
  add(easterMonday,           'Ostermontag');
  add(new Date(year,  4,  1), 'Tag der Arbeit');
  add(ascension,              'Christi Himmelfahrt');
  add(pentecostMonday,        'Pfingstmontag');
  add(new Date(year,  9,  3), 'Tag der Deutschen Einheit');
  add(new Date(year, 11, 25), '1. Weihnachtstag');
  add(new Date(year, 11, 26), '2. Weihnachtstag');

  // Heilige Drei Könige
  if (['BW', 'BY', 'ST'].includes(state)) {
    add(new Date(year, 0, 6), 'Heilige Drei Könige');
  }

  // Internationaler Frauentag
  if (state === 'BE' && year >= 2019) {
    add(new Date(year, 2, 8), 'Internationaler Frauentag');
  }
  if (state === 'MV' && year >= 2023) {
    add(new Date(year, 2, 8), 'Internationaler Frauentag');
  }

  // Fronleichnam
  if (['BW', 'BY', 'HE', 'NW', 'RP', 'SL'].includes(state)) {
    add(corpusChristi, 'Fronleichnam');
  }

  // Mariä Himmelfahrt (Saarland als Landesfeiertag)
  if (state === 'SL') {
    add(new Date(year, 7, 15), 'Mariä Himmelfahrt');
  }

  // Weltkindertag (Thüringen seit 2019)
  if (state === 'TH' && year >= 2019) {
    add(new Date(year, 8, 20), 'Weltkindertag');
  }

  // Reformationstag
  const refStates = ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'];
  if (refStates.includes(state)) {
    add(new Date(year, 9, 31), 'Reformationstag');
  }

  // Allerheiligen
  if (['BW', 'BY', 'NW', 'RP', 'SL'].includes(state)) {
    add(new Date(year, 10, 1), 'Allerheiligen');
  }

  // Buß- und Bettag (Sachsen)
  if (state === 'SN') {
    add(calculateBussUndBettag(year), 'Buß- und Bettag');
  }

  return map;
}

/* =========================================================================
   School holidays (via ferien-api.de) with graceful fallback
   ------------------------------------------------------------------------- */

async function fetchSchoolHolidays(year, state) {
  const url = `https://ferien-api.de/api/v1/holidays/${state}/${year}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Schulferien konnten nicht geladen werden:', err);
    return null;
  }
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildSchoolHolidayMap(list) {
  const map = {};
  if (!Array.isArray(list)) return map;

  for (const h of list) {
    const start = new Date(h.start);
    const end   = new Date(h.end); // API: end is exclusive (a timestamp at 00:00)
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const name = capitalize((h.name || '').replace(/\d{4}-.*$/, '').trim());

    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const key = formatDateISO(d);
      map[key] = map[key] ? `${map[key]}, ${name}` : name;
    }
  }
  return map;
}

/* =========================================================================
   State / rendering
   ------------------------------------------------------------------------- */

const state = {
  year: null,
  stateCode: null,
  maxVisitors: 0,
  rows: [] // { date, publicHolidayName, schoolHolidayName, occupancy, notes }
};

function getOccupancyPercent(value) {
  const opt = OCCUPANCY_OPTIONS.find(o => o.value === value);
  return opt ? opt.percent : 0;
}

function calculateVisitors(row, maxVisitors) {
  return Math.round(maxVisitors * getOccupancyPercent(row.occupancy) / 100);
}

function defaultOccupancy(row) {
  const dow = row.date.getDay();
  const isHoliday = !!row.publicHolidayName;
  const isSchool  = !!row.schoolHolidayName;

  // Christmas / New Year's Day typically closed
  const m = row.date.getMonth();
  const d = row.date.getDate();
  if ((m === 11 && (d === 24 || d === 25 || d === 26 || d === 31)) || (m === 0 && d === 1)) {
    return 'Close';
  }

  if (isHoliday) {
    return (dow === 0 || dow === 6) ? 'Peak' : 'High';
  }
  if (isSchool) {
    if (dow === 0 || dow === 6) return 'Peak';
    if (dow === 5) return 'High';
    return 'Medium';
  }
  if (dow === 0 || dow === 6) return 'Medium'; // weekend
  if (dow === 5) return 'Low';                 // Friday
  return 'Off';
}

async function generateTable(year, stateCode, maxVisitors) {
  const infoEl = document.getElementById('infoMsg');
  infoEl.textContent = '';
  infoEl.className = 'info-msg';

  const publicHolidays = getPublicHolidays(year, stateCode);

  const schoolRaw = await fetchSchoolHolidays(year, stateCode.toLowerCase());
  const schoolMap = buildSchoolHolidayMap(schoolRaw);

  if (!schoolRaw) {
    infoEl.textContent =
      'Hinweis: Die Schulferien konnten nicht online geladen werden. ' +
      'Feiertage werden trotzdem korrekt angezeigt.';
    infoEl.classList.add('warning');
  }

  const rows = [];
  const startDate = new Date(year, 0, 1);
  const endDate   = new Date(year + 1, 0, 1);

  for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
    const iso  = formatDateISO(d);
    const date = new Date(d);
    const row = {
      date,
      publicHolidayName: publicHolidays[iso] || '',
      schoolHolidayName: schoolMap[iso] || '',
      occupancy: 'Off',
      notes: ''
    };
    row.occupancy = defaultOccupancy(row);
    rows.push(row);
  }

  state.year        = year;
  state.stateCode   = stateCode;
  state.maxVisitors = maxVisitors;
  state.rows        = rows;

  loadFromStorage();
  renderTable();
  renderSummary();

  document.getElementById('results').classList.remove('hidden');
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTable() {
  const tbody = document.querySelector('#dayTable tbody');
  tbody.innerHTML = '';

  const monthSums = Array(12).fill(0);
  for (const r of state.rows) {
    monthSums[r.date.getMonth()] += calculateVisitors(r, state.maxVisitors);
  }

  let currentMonth = -1;

  state.rows.forEach((row, idx) => {
    if (row.date.getMonth() !== currentMonth) {
      currentMonth = row.date.getMonth();
      const monthRow = document.createElement('tr');
      monthRow.className = 'month-header';
      const td = document.createElement('td');
      td.colSpan = 6;
      td.innerHTML =
        `${MONTHS_DE[currentMonth]} ${state.year}` +
        `<span class="month-subtotal">Monatsbudget: ${monthSums[currentMonth].toLocaleString('de-DE')}</span>`;
      monthRow.appendChild(td);
      tbody.appendChild(monthRow);
    }

    const tr = document.createElement('tr');
    tr.dataset.index = idx;
    const dow = row.date.getDay();
    if (dow === 0 || dow === 6) tr.classList.add('weekend');
    if (row.publicHolidayName)  tr.classList.add('holiday');
    if (row.schoolHolidayName)  tr.classList.add('school-holiday');

    // Datum
    const tdDate = document.createElement('td');
    tdDate.textContent = formatDateDE(row.date);
    tr.appendChild(tdDate);

    // Wochentag
    const tdDow = document.createElement('td');
    tdDow.textContent = WEEKDAYS_DE[dow];
    tr.appendChild(tdDow);

    // Feiertag / Ferien
    const tdHol = document.createElement('td');
    tdHol.className = 'holiday-cell';
    const parts = [];
    if (row.publicHolidayName) parts.push(`<span class="ph">${row.publicHolidayName}</span>`);
    if (row.schoolHolidayName) parts.push(`<span class="sh">Ferien: ${row.schoolHolidayName}</span>`);
    tdHol.innerHTML = parts.join('<br>');
    tr.appendChild(tdHol);

    // Auslastung-Dropdown
    const tdOcc = document.createElement('td');
    const select = document.createElement('select');
    select.className = 'occupancy-select';
    select.dataset.occ = row.occupancy;
    for (const opt of OCCUPANCY_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = `${opt.label} (${opt.percent}%)`;
      select.appendChild(o);
    }
    select.value = row.occupancy;
    select.addEventListener('change', (e) => {
      row.occupancy = e.target.value;
      select.dataset.occ = row.occupancy;
      tdVisitors.textContent =
        calculateVisitors(row, state.maxVisitors).toLocaleString('de-DE');
      saveToStorage();
      renderSummary();
      updateMonthHeaders();
    });
    tdOcc.appendChild(select);
    tr.appendChild(tdOcc);

    // Besucher
    const tdVisitors = document.createElement('td');
    tdVisitors.className = 'visitors-cell';
    tdVisitors.textContent =
      calculateVisitors(row, state.maxVisitors).toLocaleString('de-DE');
    tr.appendChild(tdVisitors);

    // Notizen
    const tdNotes = document.createElement('td');
    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'note-input';
    noteInput.value = row.notes;
    noteInput.placeholder = 'z. B. Event, Schulklasse…';
    noteInput.addEventListener('input', (e) => {
      row.notes = e.target.value;
      saveToStorage();
    });
    tdNotes.appendChild(noteInput);
    tr.appendChild(tdNotes);

    tbody.appendChild(tr);
  });
}

function updateVisitorCells() {
  const rows = document.querySelectorAll('#dayTable tbody tr[data-index]');
  rows.forEach(tr => {
    const idx = parseInt(tr.dataset.index, 10);
    const cell = tr.querySelector('.visitors-cell');
    if (cell) {
      cell.textContent =
        calculateVisitors(state.rows[idx], state.maxVisitors).toLocaleString('de-DE');
    }
  });
  updateMonthHeaders();
}

function updateMonthHeaders() {
  const monthSums = Array(12).fill(0);
  for (const r of state.rows) {
    monthSums[r.date.getMonth()] += calculateVisitors(r, state.maxVisitors);
  }
  const headers = document.querySelectorAll('#dayTable tbody tr.month-header td');
  headers.forEach((td, i) => {
    td.innerHTML =
      `${MONTHS_DE[i]} ${state.year}` +
      `<span class="month-subtotal">Monatsbudget: ${monthSums[i].toLocaleString('de-DE')}</span>`;
  });
}

function renderSummary() {
  // Year total
  const yearTotal = state.rows.reduce(
    (s, r) => s + calculateVisitors(r, state.maxVisitors), 0
  );
  document.getElementById('yearTotal').textContent =
    yearTotal.toLocaleString('de-DE');

  const openDays = state.rows.filter(r => getOccupancyPercent(r.occupancy) > 0).length;
  document.getElementById('avgPerDay').textContent =
    (openDays > 0 ? Math.round(yearTotal / openDays) : 0).toLocaleString('de-DE');
  document.getElementById('avgPerMonth').textContent =
    Math.round(yearTotal / 12).toLocaleString('de-DE');

  // Monthly grid
  const monthly = Array(12).fill(0);
  for (const r of state.rows) {
    monthly[r.date.getMonth()] += calculateVisitors(r, state.maxVisitors);
  }
  const monthlyGrid = document.getElementById('monthlyGrid');
  monthlyGrid.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const div = document.createElement('div');
    div.className = 'monthly-item';
    div.innerHTML =
      `<div class="month-name">${MONTHS_DE[i]}</div>` +
      `<div class="month-value">${monthly[i].toLocaleString('de-DE')}</div>`;
    monthlyGrid.appendChild(div);
  }

  // Occupancy counts
  const counts = {};
  OCCUPANCY_OPTIONS.forEach(o => counts[o.value] = 0);
  for (const r of state.rows) counts[r.occupancy] = (counts[r.occupancy] || 0) + 1;

  const countsGrid = document.getElementById('countsGrid');
  countsGrid.innerHTML = '';
  for (const opt of OCCUPANCY_OPTIONS) {
    const div = document.createElement('div');
    div.className = `count-item count-${opt.value.toLowerCase()}`;
    div.innerHTML =
      `<div class="count-label">${opt.label} &middot; ${opt.percent}%</div>` +
      `<div class="count-value">${counts[opt.value]}</div>`;
    countsGrid.appendChild(div);
  }
}

/* =========================================================================
   Local storage persistence
   ------------------------------------------------------------------------- */

function storageKey() {
  return `visitor-budget:${state.year}:${state.stateCode}`;
}

function saveToStorage() {
  if (!state.year || !state.stateCode) return;
  try {
    const payload = {
      maxVisitors: state.maxVisitors,
      rows: state.rows.map(r => ({ occupancy: r.occupancy, notes: r.notes }))
    };
    localStorage.setItem(storageKey(), JSON.stringify(payload));
  } catch (e) {
    console.warn('Speichern fehlgeschlagen:', e);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && Array.isArray(saved.rows) && saved.rows.length === state.rows.length) {
      saved.rows.forEach((s, i) => {
        if (s.occupancy) state.rows[i].occupancy = s.occupancy;
        if (typeof s.notes === 'string') state.rows[i].notes = s.notes;
      });
    }
    if (typeof saved.maxVisitors === 'number' && saved.maxVisitors > 0) {
      state.maxVisitors = saved.maxVisitors;
      document.getElementById('maxVisitors').value = saved.maxVisitors;
    }
  } catch (e) {
    console.warn('Laden fehlgeschlagen:', e);
  }
}

function resetCurrent() {
  if (!state.year) return;
  if (!confirm('Wirklich alle Änderungen (Auslastungen & Notizen) für dieses Jahr zurücksetzen?')) return;
  localStorage.removeItem(storageKey());
  state.rows.forEach(r => {
    r.occupancy = defaultOccupancy(r);
    r.notes = '';
  });
  renderTable();
  renderSummary();
}

/* =========================================================================
   Excel export (SheetJS)
   ------------------------------------------------------------------------- */

function exportToExcel() {
  if (!state.rows.length) return;

  const wb = XLSX.utils.book_new();

  // Sheet 1: Tagesdaten
  const header = [
    'Datum', 'Wochentag', 'Feiertag', 'Schulferien',
    'Auslastung', 'Auslastung %', 'Besucher', 'Notizen'
  ];
  const rows = state.rows.map(r => [
    formatDateDE(r.date),
    WEEKDAYS_DE[r.date.getDay()],
    r.publicHolidayName,
    r.schoolHolidayName,
    r.occupancy,
    getOccupancyPercent(r.occupancy),
    calculateVisitors(r, state.maxVisitors),
    r.notes
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 26 }, { wch: 26 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Tagesdaten');

  // Sheet 2: Zusammenfassung
  const yearTotal = state.rows.reduce(
    (s, r) => s + calculateVisitors(r, state.maxVisitors), 0
  );

  const summary = [];
  summary.push(['Kennzahl', 'Wert']);
  summary.push(['Kalenderjahr', state.year]);
  summary.push(['Bundesland', BUNDESLAENDER[state.stateCode]]);
  summary.push(['Max. Besucher / Tag', state.maxVisitors]);
  summary.push(['Jahresbudget Besucher', yearTotal]);
  summary.push([]);
  summary.push(['Monat', 'Besucher']);
  for (let i = 0; i < 12; i++) {
    const s = state.rows
      .filter(r => r.date.getMonth() === i)
      .reduce((sum, r) => sum + calculateVisitors(r, state.maxVisitors), 0);
    summary.push([MONTHS_DE[i], s]);
  }
  summary.push(['Gesamt', yearTotal]);
  summary.push([]);
  summary.push(['Auslastung', 'Prozent', 'Anzahl Tage']);
  for (const opt of OCCUPANCY_OPTIONS) {
    const count = state.rows.filter(r => r.occupancy === opt.value).length;
    summary.push([opt.label, `${opt.percent}%`, count]);
  }
  const ws2 = XLSX.utils.aoa_to_sheet(summary);
  ws2['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Zusammenfassung');

  const filename = `Besucher-Budget_${state.year}_${state.stateCode}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/* =========================================================================
   PDF export (jsPDF + autoTable)
   ------------------------------------------------------------------------- */

function exportToPdf() {
  if (!state.rows.length) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const yearTotal = state.rows.reduce(
    (s, r) => s + calculateVisitors(r, state.maxVisitors), 0
  );

  doc.setFontSize(16);
  doc.setTextColor(63, 81, 181);
  doc.text(
    `Besucher-Budget ${state.year} – ${BUNDESLAENDER[state.stateCode]}`,
    14, 15
  );
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(
    `Jahresbudget: ${yearTotal.toLocaleString('de-DE')} Besucher   |   ` +
    `Max. pro Tag: ${state.maxVisitors.toLocaleString('de-DE')}`,
    14, 22
  );

  const body = state.rows.map(r => {
    const hol = [];
    if (r.publicHolidayName) hol.push(r.publicHolidayName);
    if (r.schoolHolidayName) hol.push(`Ferien: ${r.schoolHolidayName}`);
    return [
      formatDateDE(r.date),
      WEEKDAYS_DE[r.date.getDay()],
      hol.join('; '),
      `${r.occupancy} (${getOccupancyPercent(r.occupancy)}%)`,
      calculateVisitors(r, state.maxVisitors).toLocaleString('de-DE'),
      r.notes
    ];
  });

  doc.autoTable({
    head: [['Datum', 'Wochentag', 'Feiertag / Ferien', 'Auslastung', 'Besucher', 'Notizen']],
    body,
    startY: 27,
    styles: { fontSize: 7, cellPadding: 1.2, overflow: 'linebreak' },
    headStyles: { fillColor: [63, 81, 181], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 246, 250] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 22 },
      2: { cellWidth: 70 },
      3: { cellWidth: 28 },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 'auto' }
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const row = state.rows[data.row.index];
      if (!row) return;
      if (row.publicHolidayName) {
        data.cell.styles.fillColor = [254, 226, 226];
      } else if (row.schoolHolidayName) {
        data.cell.styles.fillColor = [254, 243, 199];
      } else if (row.date.getDay() === 0 || row.date.getDay() === 6) {
        data.cell.styles.fillColor = [255, 247, 237];
      }
    }
  });

  // --- Summary page ---
  doc.addPage();
  doc.setFontSize(16);
  doc.setTextColor(63, 81, 181);
  doc.text('Zusammenfassung', 14, 15);

  const monthlyRows = [];
  for (let i = 0; i < 12; i++) {
    const s = state.rows
      .filter(r => r.date.getMonth() === i)
      .reduce((sum, r) => sum + calculateVisitors(r, state.maxVisitors), 0);
    monthlyRows.push([MONTHS_DE[i], s.toLocaleString('de-DE')]);
  }
  monthlyRows.push(['Gesamt', yearTotal.toLocaleString('de-DE')]);

  doc.autoTable({
    head: [['Monat', 'Besucher']],
    body: monthlyRows,
    startY: 22,
    tableWidth: 90,
    margin: { left: 14 },
    styles: { fontSize: 10 },
    headStyles: { fillColor: [63, 81, 181], textColor: 255 },
    columnStyles: { 1: { halign: 'right' } }
  });

  const countRows = [];
  for (const opt of OCCUPANCY_OPTIONS) {
    const count = state.rows.filter(r => r.occupancy === opt.value).length;
    countRows.push([opt.label, `${opt.percent}%`, count]);
  }
  doc.autoTable({
    head: [['Auslastung', 'Prozent', 'Anzahl Tage']],
    body: countRows,
    startY: 22,
    margin: { left: 120 },
    tableWidth: 100,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [63, 81, 181], textColor: 255 },
    columnStyles: { 2: { halign: 'right' } }
  });

  const filename = `Besucher-Budget_${state.year}_${state.stateCode}.pdf`;
  doc.save(filename);
}

/* =========================================================================
   Init
   ------------------------------------------------------------------------- */

function init() {
  // Year dropdown
  const yearSelect = document.getElementById('year');
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 2; y <= currentYear + 5; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === currentYear) opt.selected = true;
    yearSelect.appendChild(opt);
  }

  // State dropdown
  const stateSelect = document.getElementById('state');
  for (const [code, name] of Object.entries(BUNDESLAENDER)) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    stateSelect.appendChild(opt);
  }

  // Generate button
  document.getElementById('generateBtn').addEventListener('click', async () => {
    const year = parseInt(document.getElementById('year').value, 10);
    const stateCode = document.getElementById('state').value;
    const maxVisitors = parseInt(document.getElementById('maxVisitors').value, 10) || 0;
    const infoEl = document.getElementById('infoMsg');

    if (!stateCode) {
      infoEl.textContent = 'Bitte ein Bundesland auswählen.';
      infoEl.className = 'info-msg error';
      return;
    }
    if (maxVisitors <= 0) {
      infoEl.textContent = 'Bitte eine maximale Besucherzahl > 0 angeben.';
      infoEl.className = 'info-msg error';
      return;
    }

    const btn = document.getElementById('generateBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Lade…';
    try {
      await generateTable(year, stateCode, maxVisitors);
    } catch (e) {
      console.error(e);
      infoEl.textContent = 'Fehler beim Generieren: ' + e.message;
      infoEl.className = 'info-msg error';
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });

  // Recalculate when max visitors changes after table is built
  document.getElementById('maxVisitors').addEventListener('input', (e) => {
    const newMax = parseInt(e.target.value, 10) || 0;
    if (state.rows.length > 0 && newMax > 0) {
      state.maxVisitors = newMax;
      saveToStorage();
      updateVisitorCells();
      renderSummary();
    }
  });

  // Export buttons
  document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
  document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);
  document.getElementById('resetBtn').addEventListener('click', resetCurrent);
}

document.addEventListener('DOMContentLoaded', init);
