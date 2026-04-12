'use strict';

const BUNDESLAENDER = {
  'BW': 'Baden-Württemberg', 'BY': 'Bayern', 'BE': 'Berlin',
  'BB': 'Brandenburg', 'HB': 'Bremen', 'HH': 'Hamburg',
  'HE': 'Hessen', 'MV': 'Mecklenburg-Vorpommern', 'NI': 'Niedersachsen',
  'NW': 'Nordrhein-Westfalen', 'RP': 'Rheinland-Pfalz', 'SL': 'Saarland',
  'SN': 'Sachsen', 'ST': 'Sachsen-Anhalt', 'SH': 'Schleswig-Holstein',
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

const UPGRADE_ORDER = ['Off', 'Low', 'Medium', 'High', 'Peak'];

const WEEKDAYS_DE = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const WEEKDAYS_SHORT = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const TPL_DAYS = [
  { label: 'Mo', dow: 1, default: 'Off' },
  { label: 'Di', dow: 2, default: 'Off' },
  { label: 'Mi', dow: 3, default: 'Off' },
  { label: 'Do', dow: 4, default: 'Off' },
  { label: 'Fr', dow: 5, default: 'Low' },
  { label: 'Sa', dow: 6, default: 'Medium' },
  { label: 'So', dow: 0, default: 'Medium' }
];

function addDays(date, days) {
  const d = new Date(date); d.setDate(d.getDate() + days); return d;
}
function formatDateISO(date) {
  return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
}
function formatDateDE(date) {
  return String(date.getDate()).padStart(2,'0') + '.' + String(date.getMonth()+1).padStart(2,'0') + '.' + date.getFullYear();
}
function parseDateInput(s) {
  if (!s) return null;
  const p = s.split('-').map(Number);
  return new Date(p[0], p[1]-1, p[2]);
}

/* === Easter (Meeus/Jones/Butcher) === */
function calculateEaster(year) {
  const a=year%19, b=Math.floor(year/100), c=year%100, d=Math.floor(b/4), e=b%4;
  const f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30, i=Math.floor(c/4), k=c%4;
  const l=(32+2*e+2*i-h-k)%7, m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31), day=((h+l-7*m+114)%31)+1;
  return new Date(year, month-1, day);
}

function calculateBussUndBettag(year) {
  const nov23 = new Date(year,10,23), dow = nov23.getDay();
  if (dow===3) return addDays(nov23,-7);
  if (dow>3) return addDays(nov23,-(dow-3));
  return addDays(nov23,-(dow+4));
}

function getPublicHolidays(year, st) {
  const easter=calculateEaster(year), gf=addDays(easter,-2), em=addDays(easter,1);
  const asc=addDays(easter,39), pm=addDays(easter,50), cc=addDays(easter,60);
  const map={};
  const add=(d,n)=>{const k=formatDateISO(d);map[k]=map[k]?map[k]+', '+n:n;};
  add(new Date(year,0,1),'Neujahr'); add(gf,'Karfreitag'); add(em,'Ostermontag');
  add(new Date(year,4,1),'Tag der Arbeit'); add(asc,'Christi Himmelfahrt');
  add(pm,'Pfingstmontag'); add(new Date(year,9,3),'Tag der Deutschen Einheit');
  add(new Date(year,11,25),'1. Weihnachtstag'); add(new Date(year,11,26),'2. Weihnachtstag');
  if (['BW','BY','ST'].includes(st)) add(new Date(year,0,6),'Heilige Drei Könige');
  if (st==='BE'&&year>=2019) add(new Date(year,2,8),'Internationaler Frauentag');
  if (st==='MV'&&year>=2023) add(new Date(year,2,8),'Internationaler Frauentag');
  if (['BW','BY','HE','NW','RP','SL'].includes(st)) add(cc,'Fronleichnam');
  if (st==='SL') add(new Date(year,7,15),'Mariä Himmelfahrt');
  if (st==='TH'&&year>=2019) add(new Date(year,8,20),'Weltkindertag');
  if (['BB','HB','HH','MV','NI','SN','ST','SH','TH'].includes(st)) add(new Date(year,9,31),'Reformationstag');
  if (['BW','BY','NW','RP','SL'].includes(st)) add(new Date(year,10,1),'Allerheiligen');
  if (st==='SN') add(calculateBussUndBettag(year),'Buß- und Bettag');
  return map;
}

/* === School holidays: try OpenHolidays API, fallback ferien-api.de === */
async function fetchSchoolHolidays(year, stateCode) {
  const sub = 'DE-' + stateCode;
  const url1 = 'https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&languageIsoCode=DE&validFrom='+year+'-01-01&validTo='+year+'-12-31&subdivisionCode='+sub;
  try {
    const r = await fetch(url1, {headers:{'Accept':'application/json'}});
    if (r.ok) { return {source:'openholidays', data: await r.json()}; }
  } catch(e) { console.warn('OpenHolidays failed:', e); }
  const url2 = 'https://ferien-api.de/api/v1/holidays/'+stateCode+'/'+year;
  try {
    const r = await fetch(url2);
    if (r.ok) { return {source:'ferien', data: await r.json()}; }
  } catch(e) { console.warn('ferien-api failed:', e); }
  return null;
}

function buildSchoolHolidayMap(result) {
  const map = {};
  if (!result || !Array.isArray(result.data)) return map;
  for (const h of result.data) {
    let name = 'Schulferien';
    if (result.source === 'openholidays') {
      if (Array.isArray(h.name)) { const de=h.name.find(n=>n.language==='DE'); if(de&&de.text) name=de.text; }
      const s=parseDateInput(h.startDate), e=parseDateInput(h.endDate);
      if(!s||!e) continue;
      for(let d=new Date(s);d<=e;d.setDate(d.getDate()+1)){const k=formatDateISO(d);map[k]=map[k]?map[k]+', '+name:name;}
    } else {
      name = (h.name||'').replace(/\d{4}.*$/,'').trim();
      name = name.charAt(0).toUpperCase()+name.slice(1);
      const s=new Date(h.start), e=new Date(h.end); s.setHours(0,0,0,0); e.setHours(0,0,0,0);
      for(let d=new Date(s);d<e;d.setDate(d.getDate()+1)){const k=formatDateISO(d);map[k]=map[k]?map[k]+', '+name:name;}
    }
  }
  return map;
}

/* === Occupancy upgrade logic === */
function upgradeLevel(current, steps) {
  if (current === 'Close') return 'Close';
  const idx = UPGRADE_ORDER.indexOf(current);
  if (idx < 0) return current;
  return UPGRADE_ORDER[Math.min(UPGRADE_ORDER.length-1, idx+steps)];
}

function computeOccupancy(row, templateWeek, seasonStart, seasonEnd) {
  if (seasonStart && row.date < seasonStart) return 'Off';
  if (seasonEnd && row.date > seasonEnd) return 'Off';
  const dow = row.date.getDay();
  const tplIdx = dow === 0 ? 6 : dow - 1;
  let level = templateWeek[tplIdx];
  if (row.publicHolidayName) level = upgradeLevel(level, 2);
  else if (row.schoolHolidayName) level = upgradeLevel(level, 1);
  return level;
}

/* === App state === */
const state = { year:null, stateCode:null, maxVisitors:0, templateWeek:[], seasonStart:null, seasonEnd:null, rows:[] };

function getOccupancyPercent(v) { const o=OCCUPANCY_OPTIONS.find(x=>x.value===v); return o?o.percent:0; }
function calcVis(row) { return Math.round(state.maxVisitors * getOccupancyPercent(row.occupancy) / 100); }

/* === Generate table === */
async function generateTable() {
  const infoEl = document.getElementById('infoMsg');
  infoEl.textContent=''; infoEl.className='info-msg';

  const year = parseInt(document.getElementById('year').value,10);
  const stateCode = document.getElementById('state').value;
  const maxV = parseInt(document.getElementById('maxVisitors').value,10)||0;
  if (!stateCode) { infoEl.textContent='Bitte ein Bundesland auswählen.'; infoEl.classList.add('error'); return; }
  if (maxV<=0) { infoEl.textContent='Bitte eine maximale Besucherzahl > 0 angeben.'; infoEl.classList.add('error'); return; }

  const tpl = [];
  for (let i=0;i<7;i++) { tpl.push(document.getElementById('tpl-'+i).value); }
  const sStart = parseDateInput(document.getElementById('seasonStart').value);
  const sEnd = parseDateInput(document.getElementById('seasonEnd').value);

  const btn=document.getElementById('generateBtn'); btn.disabled=true; btn.textContent='Lade…';

  try {
    const pubHol = getPublicHolidays(year, stateCode);
    const schoolResult = await fetchSchoolHolidays(year, stateCode);
    const schoolMap = buildSchoolHolidayMap(schoolResult);
    if (!schoolResult) { infoEl.textContent='Hinweis: Schulferien konnten nicht geladen werden. Feiertage werden trotzdem angezeigt.'; infoEl.classList.add('warning'); }

    const rows = [];
    for (let d=new Date(year,0,1); d<new Date(year+1,0,1); d.setDate(d.getDate()+1)) {
      const iso=formatDateISO(d), date=new Date(d);
      const row = { date, publicHolidayName:pubHol[iso]||'', schoolHolidayName:schoolMap[iso]||'', occupancy:'Off', notes:'' };
      row.occupancy = computeOccupancy(row, tpl, sStart, sEnd);
      rows.push(row);
    }

    state.year=year; state.stateCode=stateCode; state.maxVisitors=maxV;
    state.templateWeek=tpl; state.seasonStart=sStart; state.seasonEnd=sEnd; state.rows=rows;

    loadRowStorage();
    saveGlobalConfig();
    renderTable();
    renderSummary();
    document.getElementById('results').classList.remove('hidden');
    document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});
  } catch(e) { console.error(e); infoEl.textContent='Fehler: '+e.message; infoEl.classList.add('error'); }
  finally { btn.disabled=false; btn.innerHTML='OK &mdash; Tabelle erstellen'; }
}

/* === Render table === */
function renderTable() {
  const tbody=document.querySelector('#dayTable tbody'); tbody.innerHTML='';
  const mSums=Array(12).fill(0);
  for(const r of state.rows) mSums[r.date.getMonth()]+=calcVis(r);
  let curMonth=-1;

  state.rows.forEach((row,idx)=>{
    if(row.date.getMonth()!==curMonth){
      curMonth=row.date.getMonth();
      const mtr=document.createElement('tr'); mtr.className='month-header';
      const td=document.createElement('td'); td.colSpan=6;
      td.innerHTML=MONTHS_DE[curMonth]+' '+state.year+'<span class="month-subtotal">Monatsbudget: '+mSums[curMonth].toLocaleString('de-DE')+'</span>';
      mtr.appendChild(td); tbody.appendChild(mtr);
    }
    const tr=document.createElement('tr'); tr.dataset.index=idx;
    const dow=row.date.getDay();
    const isOffSeason = (state.seasonStart && row.date < state.seasonStart) || (state.seasonEnd && row.date > state.seasonEnd);
    if(isOffSeason) tr.classList.add('off-season');
    else if(row.publicHolidayName) tr.classList.add('holiday');
    else if(row.schoolHolidayName) tr.classList.add('school-holiday');
    if(dow===0||dow===6) tr.classList.add('weekend');

    let td;
    td=document.createElement('td'); td.textContent=formatDateDE(row.date); tr.appendChild(td);
    td=document.createElement('td'); td.textContent=WEEKDAYS_DE[dow]; tr.appendChild(td);

    td=document.createElement('td'); td.className='holiday-cell';
    const parts=[];
    if(row.publicHolidayName) parts.push('<span class="ph">'+row.publicHolidayName+'</span>');
    if(row.schoolHolidayName) parts.push('<span class="sh">Ferien: '+row.schoolHolidayName+'</span>');
    td.innerHTML=parts.join('<br>'); tr.appendChild(td);

    const tdOcc=document.createElement('td');
    const sel=document.createElement('select'); sel.className='occupancy-select'; sel.dataset.occ=row.occupancy;
    for(const o of OCCUPANCY_OPTIONS){const op=document.createElement('option');op.value=o.value;op.textContent=o.label+' ('+o.percent+'%)';sel.appendChild(op);}
    sel.value=row.occupancy;
    const tdVis=document.createElement('td'); tdVis.className='visitors-cell'; tdVis.textContent=calcVis(row).toLocaleString('de-DE');
    sel.addEventListener('change',e=>{row.occupancy=e.target.value;sel.dataset.occ=row.occupancy;tdVis.textContent=calcVis(row).toLocaleString('de-DE');saveRowStorage();renderSummary();updateMonthHeaders();});
    tdOcc.appendChild(sel); tr.appendChild(tdOcc);
    tr.appendChild(tdVis);

    td=document.createElement('td');
    const ni=document.createElement('input');ni.type='text';ni.className='note-input';ni.value=row.notes;ni.placeholder='z. B. Event…';
    ni.addEventListener('input',e=>{row.notes=e.target.value;saveRowStorage();});
    td.appendChild(ni); tr.appendChild(td);
    tbody.appendChild(tr);
  });
}

function updateVisitorCells(){
  document.querySelectorAll('#dayTable tbody tr[data-index]').forEach(tr=>{
    const i=parseInt(tr.dataset.index,10),c=tr.querySelector('.visitors-cell');
    if(c) c.textContent=calcVis(state.rows[i]).toLocaleString('de-DE');
  });
  updateMonthHeaders();
}

function updateMonthHeaders(){
  const ms=Array(12).fill(0);
  for(const r of state.rows) ms[r.date.getMonth()]+=calcVis(r);
  document.querySelectorAll('#dayTable tbody tr.month-header td').forEach((td,i)=>{
    td.innerHTML=MONTHS_DE[i]+' '+state.year+'<span class="month-subtotal">Monatsbudget: '+ms[i].toLocaleString('de-DE')+'</span>';
  });
}

function renderSummary(){
  const yt=state.rows.reduce((s,r)=>s+calcVis(r),0);
  document.getElementById('yearTotal').textContent=yt.toLocaleString('de-DE');
  const open=state.rows.filter(r=>getOccupancyPercent(r.occupancy)>0).length;
  document.getElementById('avgPerDay').textContent=(open>0?Math.round(yt/open):0).toLocaleString('de-DE');
  document.getElementById('avgPerMonth').textContent=Math.round(yt/12).toLocaleString('de-DE');

  const monthly=Array(12).fill(0);
  for(const r of state.rows) monthly[r.date.getMonth()]+=calcVis(r);
  const mg=document.getElementById('monthlyGrid'); mg.innerHTML='';
  for(let i=0;i<12;i++){const d=document.createElement('div');d.className='monthly-item';d.innerHTML='<div class="month-name">'+MONTHS_DE[i]+'</div><div class="month-value">'+monthly[i].toLocaleString('de-DE')+'</div>';mg.appendChild(d);}

  const counts={}; OCCUPANCY_OPTIONS.forEach(o=>counts[o.value]=0);
  for(const r of state.rows) counts[r.occupancy]=(counts[r.occupancy]||0)+1;
  const cg=document.getElementById('countsGrid'); cg.innerHTML='';
  for(const o of OCCUPANCY_OPTIONS){const d=document.createElement('div');d.className='count-item count-'+o.value.toLowerCase();d.innerHTML='<div class="count-label">'+o.label+' &middot; '+o.percent+'%</div><div class="count-value">'+counts[o.value]+'</div>';cg.appendChild(d);}
}

/* === Reapply template === */
function reapplyTemplate(){
  if(!state.rows.length) return;
  if(!confirm('Musterwoche neu anwenden? Alle manuellen Auslastungs-Änderungen gehen verloren (Notizen bleiben erhalten).')) return;
  const tpl=[]; for(let i=0;i<7;i++) tpl.push(document.getElementById('tpl-'+i).value);
  const sS=parseDateInput(document.getElementById('seasonStart').value);
  const sE=parseDateInput(document.getElementById('seasonEnd').value);
  state.templateWeek=tpl; state.seasonStart=sS; state.seasonEnd=sE;
  for(const r of state.rows) r.occupancy=computeOccupancy(r,tpl,sS,sE);
  saveRowStorage(); saveGlobalConfig(); renderTable(); renderSummary();
}

function resetCurrent(){
  if(!state.year) return;
  if(!confirm('Wirklich alles zurücksetzen (Auslastungen & Notizen)?')) return;
  localStorage.removeItem(rowStorageKey());
  for(const r of state.rows){r.occupancy=computeOccupancy(r,state.templateWeek,state.seasonStart,state.seasonEnd);r.notes='';}
  renderTable(); renderSummary();
}

/* === Storage === */
function rowStorageKey(){ return 'vb:rows:'+state.year+':'+state.stateCode; }

function saveRowStorage(){
  if(!state.year) return;
  try{ localStorage.setItem(rowStorageKey(),JSON.stringify(state.rows.map(r=>({o:r.occupancy,n:r.notes})))); }catch(e){}
}
function loadRowStorage(){
  try{
    const raw=localStorage.getItem(rowStorageKey()); if(!raw) return;
    const saved=JSON.parse(raw);
    if(Array.isArray(saved)&&saved.length===state.rows.length) saved.forEach((s,i)=>{if(s.o)state.rows[i].occupancy=s.o;if(s.n)state.rows[i].notes=s.n;});
  }catch(e){}
}
function saveGlobalConfig(){
  try{ localStorage.setItem('vb:config',JSON.stringify({maxVisitors:state.maxVisitors,templateWeek:state.templateWeek})); }catch(e){}
}
function loadGlobalConfig(){
  try{
    const raw=localStorage.getItem('vb:config'); if(!raw) return;
    const c=JSON.parse(raw);
    if(c.maxVisitors) document.getElementById('maxVisitors').value=c.maxVisitors;
    if(Array.isArray(c.templateWeek)&&c.templateWeek.length===7) c.templateWeek.forEach((v,i)=>{const el=document.getElementById('tpl-'+i);if(el)el.value=v;});
  }catch(e){}
}

/* === Excel export === */
function exportToExcel(){
  if(!state.rows.length) return;
  const wb=XLSX.utils.book_new();
  const hdr=['Datum','Wochentag','Feiertag','Schulferien','Auslastung','Auslastung %','Besucher','Notizen'];
  const data=state.rows.map(r=>[formatDateDE(r.date),WEEKDAYS_DE[r.date.getDay()],r.publicHolidayName,r.schoolHolidayName,r.occupancy,getOccupancyPercent(r.occupancy),calcVis(r),r.notes]);
  const ws=XLSX.utils.aoa_to_sheet([hdr,...data]);
  ws['!cols']=[{wch:12},{wch:12},{wch:26},{wch:26},{wch:10},{wch:12},{wch:12},{wch:30}];
  XLSX.utils.book_append_sheet(wb,ws,'Tagesdaten');

  const yt=state.rows.reduce((s,r)=>s+calcVis(r),0);
  const sum=[['Kennzahl','Wert'],['Kalenderjahr',state.year],['Bundesland',BUNDESLAENDER[state.stateCode]],['Max. Besucher/Tag',state.maxVisitors],['Jahresbudget',yt],[]];
  sum.push(['Monat','Besucher']);
  for(let i=0;i<12;i++){const s=state.rows.filter(r=>r.date.getMonth()===i).reduce((a,r)=>a+calcVis(r),0);sum.push([MONTHS_DE[i],s]);}
  sum.push(['Gesamt',yt],[],['Auslastung','Prozent','Tage']);
  for(const o of OCCUPANCY_OPTIONS) sum.push([o.label,o.percent+'%',state.rows.filter(r=>r.occupancy===o.value).length]);
  const ws2=XLSX.utils.aoa_to_sheet(sum); ws2['!cols']=[{wch:24},{wch:14},{wch:14}];
  XLSX.utils.book_append_sheet(wb,ws2,'Zusammenfassung');
  XLSX.writeFile(wb,'Besucher-Budget_'+state.year+'_'+state.stateCode+'.xlsx');
}

/* === PDF export === */
function exportToPdf(){
  if(!state.rows.length) return;
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const yt=state.rows.reduce((s,r)=>s+calcVis(r),0);
  doc.setFontSize(16);doc.setTextColor(63,81,181);
  doc.text('Besucher-Budget '+state.year+' – '+BUNDESLAENDER[state.stateCode],14,15);
  doc.setFontSize(10);doc.setTextColor(40,40,40);
  doc.text('Jahresbudget: '+yt.toLocaleString('de-DE')+' Besucher   |   Max/Tag: '+state.maxVisitors.toLocaleString('de-DE'),14,22);

  const body=state.rows.map(r=>{
    const h=[];if(r.publicHolidayName)h.push(r.publicHolidayName);if(r.schoolHolidayName)h.push('Ferien: '+r.schoolHolidayName);
    return [formatDateDE(r.date),WEEKDAYS_DE[r.date.getDay()],h.join('; '),r.occupancy+' ('+getOccupancyPercent(r.occupancy)+'%)',calcVis(r).toLocaleString('de-DE'),r.notes];
  });
  doc.autoTable({head:[['Datum','Wochentag','Feiertag/Ferien','Auslastung','Besucher','Notizen']],body,startY:27,
    styles:{fontSize:7,cellPadding:1.2,overflow:'linebreak'},headStyles:{fillColor:[63,81,181],textColor:255,fontStyle:'bold'},
    alternateRowStyles:{fillColor:[244,246,250]},
    columnStyles:{0:{cellWidth:22},1:{cellWidth:22},2:{cellWidth:70},3:{cellWidth:28},4:{cellWidth:22,halign:'right'},5:{cellWidth:'auto'}},
    didParseCell:function(data){if(data.section!=='body')return;const r=state.rows[data.row.index];if(!r)return;
      if(r.publicHolidayName)data.cell.styles.fillColor=[254,226,226];
      else if(r.schoolHolidayName)data.cell.styles.fillColor=[254,243,199];
      else if(r.date.getDay()===0||r.date.getDay()===6)data.cell.styles.fillColor=[255,247,237];}
  });

  doc.addPage();doc.setFontSize(16);doc.setTextColor(63,81,181);doc.text('Zusammenfassung',14,15);
  const mr=[];for(let i=0;i<12;i++){const s=state.rows.filter(r=>r.date.getMonth()===i).reduce((a,r)=>a+calcVis(r),0);mr.push([MONTHS_DE[i],s.toLocaleString('de-DE')]);}
  mr.push(['Gesamt',yt.toLocaleString('de-DE')]);
  doc.autoTable({head:[['Monat','Besucher']],body:mr,startY:22,tableWidth:90,margin:{left:14},styles:{fontSize:10},headStyles:{fillColor:[63,81,181],textColor:255},columnStyles:{1:{halign:'right'}}});

  const cr=[];for(const o of OCCUPANCY_OPTIONS)cr.push([o.label,o.percent+'%',state.rows.filter(r=>r.occupancy===o.value).length]);
  doc.autoTable({head:[['Auslastung','Prozent','Tage']],body:cr,startY:22,margin:{left:120},tableWidth:100,styles:{fontSize:10},headStyles:{fillColor:[63,81,181],textColor:255},columnStyles:{2:{halign:'right'}}});
  doc.save('Besucher-Budget_'+state.year+'_'+state.stateCode+'.pdf');
}

/* === Init === */
function init(){
  const ySel=document.getElementById('year'), cy=new Date().getFullYear();
  for(let y=cy-2;y<=cy+5;y++){const o=document.createElement('option');o.value=y;o.textContent=y;if(y===cy)o.selected=true;ySel.appendChild(o);}

  const sSel=document.getElementById('state');
  for(const[code,name]of Object.entries(BUNDESLAENDER)){const o=document.createElement('option');o.value=code;o.textContent=name;sSel.appendChild(o);}

  const tGrid=document.getElementById('templateGrid');
  TPL_DAYS.forEach((day,i)=>{
    const wrap=document.createElement('div');wrap.className='tpl-day';
    const lbl=document.createElement('label');lbl.textContent=day.label;lbl.setAttribute('for','tpl-'+i);
    const sel=document.createElement('select');sel.id='tpl-'+i;
    for(const o of OCCUPANCY_OPTIONS){const op=document.createElement('option');op.value=o.value;op.textContent=o.label+' ('+o.percent+'%)';sel.appendChild(op);}
    sel.value=day.default;
    wrap.appendChild(lbl);wrap.appendChild(sel);tGrid.appendChild(wrap);
  });

  loadGlobalConfig();

  document.getElementById('generateBtn').addEventListener('click', generateTable);
  document.getElementById('maxVisitors').addEventListener('input',e=>{
    const v=parseInt(e.target.value,10)||0;
    if(state.rows.length>0&&v>0){state.maxVisitors=v;saveRowStorage();updateVisitorCells();renderSummary();}
  });
  document.getElementById('exportExcelBtn').addEventListener('click',exportToExcel);
  document.getElementById('exportPdfBtn').addEventListener('click',exportToPdf);
  document.getElementById('reapplyTemplateBtn').addEventListener('click',reapplyTemplate);
  document.getElementById('resetBtn').addEventListener('click',resetCurrent);
}

document.addEventListener('DOMContentLoaded',init);
