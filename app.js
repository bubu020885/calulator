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
const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const TPL_DAYS = [
  { label: 'Mo', dow: 1, def: 'Off',    defF: 'Low' },
  { label: 'Di', dow: 2, def: 'Off',    defF: 'Low' },
  { label: 'Mi', dow: 3, def: 'Off',    defF: 'Low' },
  { label: 'Do', dow: 4, def: 'Off',    defF: 'Low' },
  { label: 'Fr', dow: 5, def: 'Low',    defF: 'Medium' },
  { label: 'Sa', dow: 6, def: 'Medium', defF: 'High' },
  { label: 'So', dow: 0, def: 'Medium', defF: 'High' }
];

/* helpers */
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
function fmtISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fmtDE(d){return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();}
function parseDate(s){if(!s)return null;var p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function occPct(v){var o=OCCUPANCY_OPTIONS.find(function(x){return x.value===v;});return o?o.percent:0;}

/* Easter */
function easter(y){var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da);}
function bbt(y){var n=new Date(y,10,23),w=n.getDay();if(w===3)return addDays(n,-7);if(w>3)return addDays(n,-(w-3));return addDays(n,-(w+4));}

function getHolidays(y,st){
  var e=easter(y),gf=addDays(e,-2),em=addDays(e,1),asc=addDays(e,39),pm=addDays(e,50),cc=addDays(e,60);
  var m={},a=function(d,n){var k=fmtISO(d);m[k]=m[k]?m[k]+', '+n:n;};
  a(new Date(y,0,1),'Neujahr');a(gf,'Karfreitag');a(em,'Ostermontag');
  a(new Date(y,4,1),'Tag der Arbeit');a(asc,'Christi Himmelfahrt');
  a(pm,'Pfingstmontag');a(new Date(y,9,3),'Tag der Dt. Einheit');
  a(new Date(y,11,25),'1. Weihnachtstag');a(new Date(y,11,26),'2. Weihnachtstag');
  if(['BW','BY','ST'].indexOf(st)>=0)a(new Date(y,0,6),'Hl. Drei Könige');
  if(st==='BE'&&y>=2019)a(new Date(y,2,8),'Int. Frauentag');
  if(st==='MV'&&y>=2023)a(new Date(y,2,8),'Int. Frauentag');
  if(['BW','BY','HE','NW','RP','SL'].indexOf(st)>=0)a(cc,'Fronleichnam');
  if(st==='SL')a(new Date(y,7,15),'Mariä Himmelfahrt');
  if(st==='TH'&&y>=2019)a(new Date(y,8,20),'Weltkindertag');
  if(['BB','HB','HH','MV','NI','SN','ST','SH','TH'].indexOf(st)>=0)a(new Date(y,9,31),'Reformationstag');
  if(['BW','BY','NW','RP','SL'].indexOf(st)>=0)a(new Date(y,10,1),'Allerheiligen');
  if(st==='SN')a(bbt(y),'Buß- und Bettag');
  return m;
}

/* school holidays */
async function fetchSchool(y,sc){
  var sub='DE-'+sc;
  var u1='https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&languageIsoCode=DE&validFrom='+y+'-01-01&validTo='+y+'-12-31&subdivisionCode='+sub;
  try{var r=await fetch(u1,{headers:{'Accept':'application/json'}});if(r.ok)return{src:'oh',data:await r.json()};}catch(e){}
  var u2='https://ferien-api.de/api/v1/holidays/'+sc+'/'+y;
  try{var r2=await fetch(u2);if(r2.ok)return{src:'fa',data:await r2.json()};}catch(e){}
  return null;
}
function buildSchoolMap(res){
  var map={};if(!res||!Array.isArray(res.data))return map;
  res.data.forEach(function(h){
    var nm='Schulferien',s,e;
    if(res.src==='oh'){
      if(Array.isArray(h.name)){var de=h.name.find(function(n){return n.language==='DE';});if(de&&de.text)nm=de.text;}
      s=parseDate(h.startDate);e=parseDate(h.endDate);if(!s||!e)return;
      for(var d=new Date(s);d<=e;d.setDate(d.getDate()+1)){var k=fmtISO(d);map[k]=map[k]?map[k]+', '+nm:nm;}
    }else{
      nm=(h.name||'').replace(/\d{4}.*$/,'').trim();nm=nm.charAt(0).toUpperCase()+nm.slice(1);
      s=new Date(h.start);e=new Date(h.end);s.setHours(0,0,0,0);e.setHours(0,0,0,0);
      for(var d2=new Date(s);d2<e;d2.setDate(d2.getDate()+1)){var k2=fmtISO(d2);map[k2]=map[k2]?map[k2]+', '+nm:nm;}
    }
  });
  return map;
}

/* upgrade */
function upgrade(cur,steps){
  if(cur==='Close')return'Close';
  var i=UPGRADE_ORDER.indexOf(cur);if(i<0)return cur;
  return UPGRADE_ORDER[Math.min(UPGRADE_ORDER.length-1,i+steps)];
}

/* compute occupancy: uses ferien template if school holiday, else normal template */
function computeOcc(row,tpl,tplF,sS,sE){
  if(sS&&row.date<sS)return'Off';
  if(sE&&row.date>sE)return'Off';
  var dow=row.date.getDay(),ti=dow===0?6:dow-1;
  var isSchool=!!row.schoolHolidayName;
  var level=isSchool?tplF[ti]:tpl[ti];
  if(row.publicHolidayName)level=upgrade(level,2);
  return level;
}

/* state */
var S={year:null,sc:null,maxV:0,tpl:[],tplF:[],sS:null,sE:null,rows:[]};
function calcV(r){return Math.round(S.maxV*occPct(r.occ)/100);}

/* generate */
async function generate(){
  var info=document.getElementById('infoMsg');info.textContent='';info.className='info-msg';
  var y=parseInt(document.getElementById('year').value,10);
  var sc=document.getElementById('state').value;
  var mv=parseInt(document.getElementById('maxVisitors').value,10)||0;
  if(!sc){info.textContent='Bitte ein Bundesland wählen.';info.classList.add('error');return;}
  if(mv<=0){info.textContent='Bitte max. Besucherzahl > 0 angeben.';info.classList.add('error');return;}
  var tpl=[],tplF=[];
  for(var i=0;i<7;i++){tpl.push(document.getElementById('tpl-'+i).value);tplF.push(document.getElementById('tplF-'+i).value);}
  var sS=parseDate(document.getElementById('seasonStart').value);
  var sE=parseDate(document.getElementById('seasonEnd').value);
  var btn=document.getElementById('generateBtn');btn.disabled=true;btn.textContent='Lade…';
  try{
    var ph=getHolidays(y,sc);
    var sr=await fetchSchool(y,sc);
    var sm=buildSchoolMap(sr);
    if(!sr){info.textContent='Hinweis: Schulferien konnten nicht geladen werden.';info.classList.add('warning');}
    var rows=[];
    for(var d=new Date(y,0,1);d<new Date(y+1,0,1);d.setDate(d.getDate()+1)){
      var iso=fmtISO(d),dt=new Date(d);
      var row={date:dt,ph:ph[iso]||'',sh:sm[iso]||'',occ:'Off',notes:''};
      row.occ=computeOcc({date:dt,publicHolidayName:row.ph,schoolHolidayName:row.sh},tpl,tplF,sS,sE);
      rows.push(row);
    }
    S.year=y;S.sc=sc;S.maxV=mv;S.tpl=tpl;S.tplF=tplF;S.sS=sS;S.sE=sE;S.rows=rows;
    loadRows();saveGlobal();renderTable();renderSummary();
    document.getElementById('results').classList.remove('hidden');
    document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){console.error(e);info.textContent='Fehler: '+e.message;info.classList.add('error');}
  finally{btn.disabled=false;btn.innerHTML='OK &mdash; Tabelle erstellen';}
}

/* render table */
function renderTable(){
  var tb=document.querySelector('#dayTable tbody');tb.innerHTML='';
  var ms=Array(12).fill(0);S.rows.forEach(function(r){ms[r.date.getMonth()]+=calcV(r);});
  var cm=-1;
  S.rows.forEach(function(row,idx){
    if(row.date.getMonth()!==cm){
      cm=row.date.getMonth();
      var mtr=document.createElement('tr');mtr.className='month-header';
      var mtd=document.createElement('td');mtd.colSpan=6;
      mtd.innerHTML=MONTHS_DE[cm]+' '+S.year+'<span class="month-subtotal">Monatsbudget: '+ms[cm].toLocaleString('de-DE')+'</span>';
      mtr.appendChild(mtd);tb.appendChild(mtr);
    }
    var tr=document.createElement('tr');tr.dataset.index=idx;
    var dow=row.date.getDay();
    var offS=(S.sS&&row.date<S.sS)||(S.sE&&row.date>S.sE);
    if(offS)tr.classList.add('off-season');
    else if(row.ph)tr.classList.add('holiday');
    else if(row.sh)tr.classList.add('school-holiday');
    if(dow===0||dow===6)tr.classList.add('weekend');

    var td=document.createElement('td');td.textContent=fmtDE(row.date);tr.appendChild(td);
    td=document.createElement('td');td.textContent=WEEKDAYS_DE[dow];tr.appendChild(td);

    td=document.createElement('td');td.className='holiday-cell';
    var parts=[];
    if(row.ph)parts.push('<span class="ph">'+row.ph+'</span>');
    if(row.sh)parts.push('<span class="sh">Ferien: '+row.sh+'</span>');
    td.innerHTML=parts.join('<br>');tr.appendChild(td);

    var tdO=document.createElement('td');
    var sel=document.createElement('select');sel.className='occupancy-select';sel.dataset.occ=row.occ;
    OCCUPANCY_OPTIONS.forEach(function(o){var op=document.createElement('option');op.value=o.value;op.textContent=o.label+' ('+o.percent+'%)';sel.appendChild(op);});
    sel.value=row.occ;
    var tdV=document.createElement('td');tdV.className='visitors-cell';tdV.textContent=calcV(row).toLocaleString('de-DE');
    sel.addEventListener('change',function(e){row.occ=e.target.value;sel.dataset.occ=row.occ;tdV.textContent=calcV(row).toLocaleString('de-DE');saveRows();renderSummary();updMH();});
    tdO.appendChild(sel);tr.appendChild(tdO);
    tr.appendChild(tdV);

    td=document.createElement('td');
    var ni=document.createElement('input');ni.type='text';ni.className='note-input';ni.value=row.notes;ni.placeholder='z. B. Event…';
    ni.addEventListener('input',function(e){row.notes=e.target.value;saveRows();});
    td.appendChild(ni);tr.appendChild(td);
    tb.appendChild(tr);
  });
}

function updVC(){
  document.querySelectorAll('#dayTable tbody tr[data-index]').forEach(function(tr){
    var i=parseInt(tr.dataset.index,10),c=tr.querySelector('.visitors-cell');
    if(c)c.textContent=calcV(S.rows[i]).toLocaleString('de-DE');
  });
  updMH();
}
function updMH(){
  var ms=Array(12).fill(0);S.rows.forEach(function(r){ms[r.date.getMonth()]+=calcV(r);});
  document.querySelectorAll('#dayTable tbody tr.month-header td').forEach(function(td,i){
    td.innerHTML=MONTHS_DE[i]+' '+S.year+'<span class="month-subtotal">Monatsbudget: '+ms[i].toLocaleString('de-DE')+'</span>';
  });
}

function renderSummary(){
  var yt=0;S.rows.forEach(function(r){yt+=calcV(r);});
  document.getElementById('yearTotal').textContent=yt.toLocaleString('de-DE');
  var open=S.rows.filter(function(r){return occPct(r.occ)>0;}).length;
  document.getElementById('avgPerDay').textContent=(open>0?Math.round(yt/open):0).toLocaleString('de-DE');
  document.getElementById('avgPerMonth').textContent=Math.round(yt/12).toLocaleString('de-DE');

  /* season days */
  var sDays=0;
  if(S.sS||S.sE){
    S.rows.forEach(function(r){
      var after=!S.sS||r.date>=S.sS;
      var before=!S.sE||r.date<=S.sE;
      if(after&&before)sDays++;
    });
  }else{sDays=S.rows.length;}
  document.getElementById('seasonDays').textContent=sDays.toLocaleString('de-DE');

  /* monthly */
  var monthly=Array(12).fill(0);
  S.rows.forEach(function(r){monthly[r.date.getMonth()]+=calcV(r);});
  var mg=document.getElementById('monthlyGrid');mg.innerHTML='';
  for(var i=0;i<12;i++){var d=document.createElement('div');d.className='monthly-item';d.innerHTML='<div class="month-name">'+MONTHS_DE[i]+'</div><div class="month-value">'+monthly[i].toLocaleString('de-DE')+'</div>';mg.appendChild(d);}

  /* counts: Row1=Off+Season, Row2=Low/Med/High/Peak, Row3=Close */
  var counts={};OCCUPANCY_OPTIONS.forEach(function(o){counts[o.value]=0;});
  S.rows.forEach(function(r){counts[r.occ]=(counts[r.occ]||0)+1;});
  var cg=document.getElementById('countsGrid');cg.innerHTML='';

  function mkItem(val,lbl,pct,cls){
    var d=document.createElement('div');d.className='count-item '+cls;
    d.innerHTML='<div class="count-label">'+lbl+' &middot; '+pct+'%</div><div class="count-value">'+counts[val]+'</div>';
    return d;
  }
  function mkSeasonItem(){
    var d=document.createElement('div');d.className='count-item count-season';
    d.innerHTML='<div class="count-label">Saisontage</div><div class="count-value">'+sDays+'</div>';
    return d;
  }

  var row1=document.createElement('div');row1.className='counts-row';
  row1.appendChild(mkItem('Off','Off',0,'count-off'));
  row1.appendChild(mkSeasonItem());
  cg.appendChild(row1);

  var row2=document.createElement('div');row2.className='counts-row';
  row2.appendChild(mkItem('Low','Low',25,'count-low'));
  row2.appendChild(mkItem('Medium','Medium',50,'count-medium'));
  row2.appendChild(mkItem('High','High',75,'count-high'));
  row2.appendChild(mkItem('Peak','Peak',100,'count-peak'));
  cg.appendChild(row2);

  var row3=document.createElement('div');row3.className='counts-row';
  row3.appendChild(mkItem('Close','Close',0,'count-close'));
  cg.appendChild(row3);
}

/* reapply / reset */
function reapply(){
  if(!S.rows.length)return;
  if(!confirm('Musterwoche neu anwenden? Manuelle Änderungen gehen verloren (Notizen bleiben).'))return;
  var tpl=[],tplF=[];
  for(var i=0;i<7;i++){tpl.push(document.getElementById('tpl-'+i).value);tplF.push(document.getElementById('tplF-'+i).value);}
  var sS=parseDate(document.getElementById('seasonStart').value);
  var sE=parseDate(document.getElementById('seasonEnd').value);
  S.tpl=tpl;S.tplF=tplF;S.sS=sS;S.sE=sE;
  S.rows.forEach(function(r){r.occ=computeOcc({date:r.date,publicHolidayName:r.ph,schoolHolidayName:r.sh},tpl,tplF,sS,sE);});
  saveRows();saveGlobal();renderTable();renderSummary();
}
function resetAll(){
  if(!S.year)return;
  if(!confirm('Wirklich alles zurücksetzen?'))return;
  localStorage.removeItem(rKey());
  S.rows.forEach(function(r){r.occ=computeOcc({date:r.date,publicHolidayName:r.ph,schoolHolidayName:r.sh},S.tpl,S.tplF,S.sS,S.sE);r.notes='';});
  renderTable();renderSummary();
}

/* storage */
function rKey(){return'vb:r:'+S.year+':'+S.sc;}
function saveRows(){if(!S.year)return;try{localStorage.setItem(rKey(),JSON.stringify(S.rows.map(function(r){return{o:r.occ,n:r.notes};})));}catch(e){}}
function loadRows(){try{var raw=localStorage.getItem(rKey());if(!raw)return;var sv=JSON.parse(raw);if(Array.isArray(sv)&&sv.length===S.rows.length)sv.forEach(function(s,i){if(s.o)S.rows[i].occ=s.o;if(s.n)S.rows[i].notes=s.n;});}catch(e){}}
function saveGlobal(){try{localStorage.setItem('vb:cfg',JSON.stringify({mv:S.maxV,tpl:S.tpl,tplF:S.tplF}));}catch(e){}}
function loadGlobal(){try{var raw=localStorage.getItem('vb:cfg');if(!raw)return;var c=JSON.parse(raw);if(c.mv)document.getElementById('maxVisitors').value=c.mv;if(Array.isArray(c.tpl)&&c.tpl.length===7)c.tpl.forEach(function(v,i){var el=document.getElementById('tpl-'+i);if(el)el.value=v;});if(Array.isArray(c.tplF)&&c.tplF.length===7)c.tplF.forEach(function(v,i){var el=document.getElementById('tplF-'+i);if(el)el.value=v;});}catch(e){}}

/* export helpers */
function loadScript(url){
  return new Promise(function(res,rej){
    var s=document.createElement('script');s.src=url;s.async=true;
    s.onload=function(){res();};
    s.onerror=function(){rej(new Error('Script konnte nicht geladen werden: '+url));};
    document.head.appendChild(s);
  });
}
async function loadFirstAvailable(urls){
  var last=null;
  for(var i=0;i<urls.length;i++){
    try{await loadScript(urls[i]);return;}catch(e){last=e;}
  }
  throw last||new Error('Keine Quelle erreichbar');
}
async function ensureXLSX(){
  if(window.XLSX)return;
  await loadFirstAvailable([
    'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
  ]);
  if(!window.XLSX)throw new Error('XLSX-Bibliothek nicht verfügbar. Bitte Internetverbindung prüfen.');
}
async function ensurePDF(){
  if(!window.jspdf||!window.jspdf.jsPDF){
    await loadFirstAvailable([
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js'
    ]);
  }
  if(!window.jspdf||!window.jspdf.jsPDF)throw new Error('jsPDF-Bibliothek nicht verfügbar. Bitte Internetverbindung prüfen.');
  /* autotable attaches to jsPDF prototype; detect by probing prototype */
  var proto=window.jspdf.jsPDF.API||window.jspdf.jsPDF.prototype;
  if(!proto||typeof proto.autoTable!=='function'){
    await loadFirstAvailable([
      'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.js',
      'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
    ]);
    proto=window.jspdf.jsPDF.API||window.jspdf.jsPDF.prototype;
    if(!proto||typeof proto.autoTable!=='function')throw new Error('jsPDF-AutoTable nicht verfügbar.');
  }
}

async function withLoading(btn,label,fn){
  var orig=btn.innerHTML;btn.disabled=true;
  btn.innerHTML='<span class="spinner"></span>'+label;
  try{await fn();}
  catch(e){console.error(e);alert('Export fehlgeschlagen: '+(e&&e.message?e.message:e));}
  finally{btn.disabled=false;btn.innerHTML=orig;}
}

async function saveBlob(blob,filename,desc,mime,ext){
  if(window.showSaveFilePicker){
    try{
      var accept={};accept[mime]=ext;
      var opts={suggestedName:filename,types:[{description:desc,accept:accept}]};
      var handle=await window.showSaveFilePicker(opts);
      var w=await handle.createWritable();await w.write(blob);await w.close();return true;
    }catch(e){if(e&&e.name==='AbortError')return false;}
  }
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url);},1000);
  return true;
}

/* excel: single sheet with full day table */
async function toExcel(){
  if(!S.rows.length)return;
  await ensureXLSX();
  var wb=XLSX.utils.book_new();
  var hdr=['Datum','Wochentag','Feiertag','Schulferien','Auslastung','Auslastung %','Besucher','Notizen'];
  var data=S.rows.map(function(r){return[fmtDE(r.date),WEEKDAYS_DE[r.date.getDay()],r.ph,r.sh,r.occ,occPct(r.occ),calcV(r),r.notes];});
  var ws=XLSX.utils.aoa_to_sheet([hdr].concat(data));
  ws['!cols']=[{wch:12},{wch:12},{wch:26},{wch:26},{wch:10},{wch:12},{wch:12},{wch:30}];
  XLSX.utils.book_append_sheet(wb,ws,'Tagesdaten');
  var buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  var blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  await saveBlob(blob,'Besucher-Budget_'+S.year+'_'+S.sc+'.xlsx','Excel-Datei','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',['.xlsx']);
}

/* pdf: summary header on page 1, then day table */
async function toPdf(){
  if(!S.rows.length)return;
  await ensurePDF();
  var jsPDF=window.jspdf.jsPDF;var doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  var yt=0;S.rows.forEach(function(r){yt+=calcV(r);});
  var open=S.rows.filter(function(r){return occPct(r.occ)>0;}).length;
  var avgD=open>0?Math.round(yt/open):0;
  var avgM=Math.round(yt/12);
  var sDays=0;
  if(S.sS||S.sE){S.rows.forEach(function(r){var a=!S.sS||r.date>=S.sS,b=!S.sE||r.date<=S.sE;if(a&&b)sDays++;});}
  else{sDays=S.rows.length;}

  /* header */
  doc.setFontSize(16);doc.setTextColor(63,81,181);
  doc.text('Besucher-Budget '+S.year+' - '+BUNDESLAENDER[S.sc],14,14);
  doc.setFontSize(9);doc.setTextColor(80,80,80);
  doc.text('Max. Besucher/Tag: '+S.maxV.toLocaleString('de-DE')
    +'   |   Saison: '+(S.sS?fmtDE(S.sS):'ganzjährig')+' – '+(S.sE?fmtDE(S.sE):'ganzjährig')
    +'   |   Saisontage: '+sDays.toLocaleString('de-DE'),14,20);

  /* KPI strip */
  var kpis=[
    ['Jahresbudget',yt.toLocaleString('de-DE')],
    ['Ø pro Tag (offen)',avgD.toLocaleString('de-DE')],
    ['Ø pro Monat',avgM.toLocaleString('de-DE')],
    ['Saisontage',sDays.toLocaleString('de-DE')]
  ];
  doc.autoTable({
    body:kpis.map(function(k){return [k[0],k[1]];}),
    startY:24,margin:{left:14,right:14},
    styles:{fontSize:10,cellPadding:2},
    columnStyles:{0:{fontStyle:'bold',fillColor:[232,234,246],textColor:[48,63,159],cellWidth:60},1:{halign:'right',fontStyle:'bold'}},
    theme:'grid'
  });
  var y1=doc.lastAutoTable.finalY+4;

  /* monthly + counts side by side */
  var mr=[];for(var i=0;i<12;i++){var s=0;S.rows.forEach(function(r){if(r.date.getMonth()===i)s+=calcV(r);});mr.push([MONTHS_DE[i],s.toLocaleString('de-DE')]);}
  mr.push([{content:'Gesamt',styles:{fontStyle:'bold',fillColor:[232,234,246]}},{content:yt.toLocaleString('de-DE'),styles:{fontStyle:'bold',halign:'right',fillColor:[232,234,246]}}]);
  doc.autoTable({
    head:[['Monat','Besucher']],body:mr,
    startY:y1,margin:{left:14},tableWidth:120,
    styles:{fontSize:8,cellPadding:1.5},
    headStyles:{fillColor:[63,81,181],textColor:255},
    columnStyles:{1:{halign:'right'}}
  });

  var cr=[];OCCUPANCY_OPTIONS.forEach(function(o){var c=0;S.rows.forEach(function(r){if(r.occ===o.value)c++;});cr.push([o.label,o.percent+'%',c.toLocaleString('de-DE')]);});
  doc.autoTable({
    head:[['Auslastung','%','Tage']],body:cr,
    startY:y1,margin:{left:140},tableWidth:140,
    styles:{fontSize:8,cellPadding:1.5},
    headStyles:{fillColor:[63,81,181],textColor:255},
    columnStyles:{1:{halign:'right'},2:{halign:'right'}}
  });

  var y2=Math.max(doc.lastAutoTable.finalY,y1)+6;

  /* day table: one month per page, starting from page 2 */
  /* precompute monthly totals for month-header rows */
  var monthlyTotals=Array(12).fill(0);
  S.rows.forEach(function(r){monthlyTotals[r.date.getMonth()]+=calcV(r);});

  /* group row indices by month */
  var idxByMonth=[];
  for(var mm=0;mm<12;mm++)idxByMonth.push([]);
  S.rows.forEach(function(r,idx){idxByMonth[r.date.getMonth()].push(idx);});

  var headCols=[['Datum','Wochentag','Feiertag/Ferien','Auslastung','Besucher','Notizen']];
  var colStyles={0:{cellWidth:22},1:{cellWidth:22},2:{cellWidth:70},3:{cellWidth:28},4:{cellWidth:22,halign:'right'},5:{cellWidth:'auto'}};

  function makeParser(meta){
    return function(data){
      if(data.section!=='body')return;
      var m=meta[data.row.index];
      if(m===null||m===undefined)return;
      var r=S.rows[m];if(!r)return;
      if(r.ph)data.cell.styles.fillColor=[254,226,226];
      else if(r.sh)data.cell.styles.fillColor=[254,243,199];
      else if(r.date.getDay()===0||r.date.getDay()===6)data.cell.styles.fillColor=[255,247,237];
    };
  }

  for(var mi=0;mi<12;mi++){
    var idxs=idxByMonth[mi];if(!idxs.length)continue;
    doc.addPage();

    var body=[];var rowMeta=[];
    body.push([{
      content:MONTHS_DE[mi]+' '+S.year+'  —  Monatsbudget: '+monthlyTotals[mi].toLocaleString('de-DE')+' Besucher',
      colSpan:6,
      styles:{fillColor:[48,63,159],textColor:255,fontStyle:'bold',fontSize:10,halign:'left',cellPadding:{top:3,bottom:3,left:4,right:4}}
    }]);
    rowMeta.push(null);
    idxs.forEach(function(idx){
      var r=S.rows[idx];
      var h=[];if(r.ph)h.push(r.ph);if(r.sh)h.push('Ferien: '+r.sh);
      body.push([fmtDE(r.date),WEEKDAYS_DE[r.date.getDay()],h.join('; '),r.occ+' ('+occPct(r.occ)+'%)',calcV(r).toLocaleString('de-DE'),r.notes]);
      rowMeta.push(idx);
    });

    doc.autoTable({
      head:headCols,body:body,startY:14,
      styles:{fontSize:8,cellPadding:1.4,overflow:'linebreak'},
      headStyles:{fillColor:[63,81,181],textColor:255,fontStyle:'bold'},
      alternateRowStyles:{fillColor:[244,246,250]},
      columnStyles:colStyles,
      didParseCell:makeParser(rowMeta)
    });
  }

  var blob=doc.output('blob');
  await saveBlob(blob,'Besucher-Budget_'+S.year+'_'+S.sc+'.pdf','PDF-Datei','application/pdf',['.pdf']);
}

/* init */
function init(){
  var ySel=document.getElementById('year'),cy=new Date().getFullYear();
  for(var y=cy-2;y<=cy+5;y++){var o=document.createElement('option');o.value=y;o.textContent=y;if(y===cy)o.selected=true;ySel.appendChild(o);}
  var sSel=document.getElementById('state');
  Object.keys(BUNDESLAENDER).forEach(function(code){var o=document.createElement('option');o.value=code;o.textContent=BUNDESLAENDER[code];sSel.appendChild(o);});

  /* normal template */
  var tG=document.getElementById('templateGrid');
  TPL_DAYS.forEach(function(day,i){
    var w=document.createElement('div');w.className='tpl-day';
    var l=document.createElement('label');l.textContent=day.label;l.setAttribute('for','tpl-'+i);
    var s=document.createElement('select');s.id='tpl-'+i;
    OCCUPANCY_OPTIONS.forEach(function(o){var op=document.createElement('option');op.value=o.value;op.textContent=o.label+' ('+o.percent+'%)';s.appendChild(op);});
    s.value=day.def;w.appendChild(l);w.appendChild(s);tG.appendChild(w);
  });

  /* ferien template */
  var tGF=document.getElementById('templateGridFerien');
  TPL_DAYS.forEach(function(day,i){
    var w=document.createElement('div');w.className='tpl-day';
    var l=document.createElement('label');l.textContent=day.label;l.setAttribute('for','tplF-'+i);
    var s=document.createElement('select');s.id='tplF-'+i;
    OCCUPANCY_OPTIONS.forEach(function(o){var op=document.createElement('option');op.value=o.value;op.textContent=o.label+' ('+o.percent+'%)';s.appendChild(op);});
    s.value=day.defF;w.appendChild(l);w.appendChild(s);tGF.appendChild(w);
  });

  loadGlobal();
  document.getElementById('generateBtn').addEventListener('click',generate);
  document.getElementById('maxVisitors').addEventListener('input',function(e){
    var v=parseInt(e.target.value,10)||0;
    if(S.rows.length>0&&v>0){S.maxV=v;saveRows();updVC();renderSummary();}
  });
  document.getElementById('exportExcelBtn').addEventListener('click',function(e){withLoading(e.currentTarget,'Exportiere…',toExcel);});
  document.getElementById('exportPdfBtn').addEventListener('click',function(e){withLoading(e.currentTarget,'Exportiere…',toPdf);});
  document.getElementById('reapplyTemplateBtn').addEventListener('click',reapply);
  document.getElementById('resetBtn').addEventListener('click',resetAll);
}
document.addEventListener('DOMContentLoaded',init);
