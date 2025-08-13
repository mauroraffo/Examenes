// Core state
let RAW = []; // rows from CSV
let COLS = [];
let BY_FLOTA = new Map();
let CURRENT_FLOTA = null;
let CURRENT_EQUIPO = null;

let POS_COUNT = parseInt(localStorage.getItem('pos_count')||'12',10);
let GRID_PRESET = localStorage.getItem('grid_preset') || 'auto4';

// Grid presets

// Grid presets (exact layouts per Mauro)

// Grid presets (solicitud Mauro: exactos)
const GRID_PRESETS = {
  auto4:  { name: 'Auto compacto (4×N)', layout: null, cols: 4 },

  scoop:   { name: 'Scoop / Auto', layout: [
    [null,'P1','P2',null],
    [null,'P3','P4',null]
  ]},

  dumper:  { name: 'Dumper', layout: [
    [null,'P1','P2',null],
    ['P3','P4','P5','P6']
  ]},

  moto:    { name: 'Moto', layout: [
    [null,'P1','P2',null],
    [null,'P3','P4',null],
    [null,'P5','P6',null]
  ]},

  stacker: { name: 'Stacker', layout: [
    ['P1','P2','P3','P4'],
    [null,'P5','P6',null]
  ]},

  volq8x4: { name: 'Volquete 8x4', layout: [
    [null,'P1','P2',null],
    [null,'P3','P4',null],
    ['P5','P6','P7','P8'],
    ['P9','P10','P11','P12']
  ]},

  volq6x4: { name: 'Volquete 6x4', layout: [
    [null,'P1','P2',null],
    ['P3','P4','P5','P6'],
    ['P7','P8','P9','P10']
  ]},
};



// Drafts storage
function loadDraftsFromStorage() {
  try { return JSON.parse(localStorage.getItem('drafts')||'{}'); } catch { return {}; }
}
function saveDraftsToStorage(drafts) { localStorage.setItem('drafts', JSON.stringify(drafts)); }
let DRAFTS = loadDraftsFromStorage();

// Helpers
const $ = (q)=>document.querySelector(q);
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.style.display="block"; setTimeout(()=>t.style.display="none",2000); }
function parseDate(s){
  if(!s) return null;
  const d1 = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(d1){ return new Date(+d1[3], +d1[2]-1, +d1[1]); }
  const d2 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if(d2){ return new Date(+d2[1], +d2[2]-1, +d2[3]); }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function toP(val){
  const s = String(val??'').trim().toUpperCase();
  // Accept 1..12
  for(let i=1;i<=12;i++){
    if(s === String(i)) return 'P'+i;
  }
  const m = s.match(/P\s*(\d{1,2})/);
  if(m){
    const n = parseInt(m[1],10);
    if(n>=1 && n<=12) return 'P'+n;
  }
  const n = parseInt(s,10);
  if(n>=1 && n<=12) return 'P'+n;
  return null;
}
function ddmmyyyy(d){ const z=n=>String(n).padStart(2,'0'); return `${z(d.getDate())}/${z(d.getMonth()+1)}/${d.getFullYear()}`; }
function ddmmyyyy_compact(d){ const z=n=>String(n).padStart(2,'0'); return `${z(d.getDate())}${z(d.getMonth()+1)}${d.getFullYear()}`; }

// Columns mapping heuristics
function col(name){
  const ix = COLS.findIndex(c=>c.toLowerCase()===name.toLowerCase());
  return ix>=0 ? COLS[ix] : null;
}
function findColumn(regexes){
  for(const c of COLS){
    for(const r of regexes){
      if(r.test(c)) return c;
    }
  }
  return null;
}

let COL_POS, COL_EQUIPO, COL_FLOTA, COL_FECHA, COL_HORO, COL_MARCA, COL_TIPO, COL_SERIE, COL_HRTOT, COL_RIZQ, COL_RDER;
function mapColumns(){
  COL_POS = col('Posición') || col('Posicion') || findColumn([/posici/i]);
  COL_EQUIPO= col('Equipo');
  COL_FLOTA = col('Flota');
  COL_FECHA = col('Fecha Evento');
  COL_HORO  = col('Horómetro') || col('Horometro');
  COL_MARCA = col('Marca Neumático') || findColumn([/marca/i]);
  COL_TIPO  = col('Tipo Neumático')  || findColumn([/dise|pattern|tipo/i]);
  COL_SERIE = col('Serie') || findColumn([/serial/i]);
  COL_HRTOT = col('Horas Totales') || findColumn([/hora/i]);
  COL_RIZQ  = col('Rem. Izquierdo') || findColumn([/izq/i]);
  COL_RDER  = col('Rem. Derecho')   || findColumn([/der/i]);
}

// Load CSV
$("#csv").addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  Papa.parse(file, {
    header:true, skipEmptyLines:true, delimiter:';',
    complete: (res)=>{
      RAW = res.data;
      COLS = res.meta.fields;
      mapColumns();
      indexByFlotaEquipo();
      fillFlotas();
      $("#equipo").innerHTML='';
      $("#equiponame").textContent='—';
      $("#fechalast").textContent='—';
      $("#horolast").textContent='—';
      renderDraftsList();
    }
  });
});

function indexByFlotaEquipo(){
  BY_FLOTA.clear();
  for(const row of RAW){
    const fl = COL_FLOTA ? (row[COL_FLOTA]||'') : '(Todas)';
    const eq = row[COL_EQUIPO];
    if(!eq) continue;
    if(!BY_FLOTA.has(fl)) BY_FLOTA.set(fl, new Map());
    const m = BY_FLOTA.get(fl);
    if(!m.has(eq)) m.set(eq, []);
    m.get(eq).push(row);
  }
}

function fillFlotas(){
  const sel = $("#flota");
  sel.innerHTML='';
  const optAll = document.createElement('option'); optAll.value='(Todas)'; optAll.textContent='(Todas)';
  sel.appendChild(optAll);
  for(const fl of Array.from(BY_FLOTA.keys()).sort()){
    const o=document.createElement('option'); o.value=fl; o.textContent=fl; sel.appendChild(o);
  }
  sel.value='(Todas)';
  CURRENT_FLOTA='(Todas)';
  sel.addEventListener('change', ()=>{ CURRENT_FLOTA=sel.value; fillEquipos(); });
  $("#buscaEquipo").addEventListener('input', ()=> fillEquipos());

  // init grid controls
  const posCount = $("#posCount");
  const gridPreset = $("#gridPreset");
  posCount.value = String(POS_COUNT);
  gridPreset.value = GRID_PRESET;
  posCount.addEventListener('change', ()=>{
    POS_COUNT = parseInt(posCount.value,10);
    localStorage.setItem('pos_count', String(POS_COUNT));
    if(CURRENT_EQUIPO) renderEquipo(CURRENT_EQUIPO);
    buildForm(CURRENT_EQUIPO, lastByPosition((BY_FLOTA.get(CURRENT_FLOTA)||new Map()).get(CURRENT_EQUIPO)||[]));
  });
  gridPreset.addEventListener('change', ()=>{
    GRID_PRESET = gridPreset.value;
    localStorage.setItem('grid_preset', GRID_PRESET);

    // Infer max P from layout and set POS_COUNT so formulario y vista coinciden
    const preset = GRID_PRESETS[GRID_PRESET];
    if (preset && preset.layout) {
      let maxP = 0;
      for (const row of preset.layout) {
        for (const c of row) {
          if (c && /^P(\d{1,2})$/.test(c)) {
            const n = parseInt(c.slice(1), 10);
            if (n > maxP) maxP = n;
          }
        }
      }
      if (maxP > 0) {
        POS_COUNT = maxP;
        localStorage.setItem('pos_count', String(POS_COUNT));
        posCount.value = String(POS_COUNT);
      }
    }
    if(CURRENT_EQUIPO) renderEquipo(CURRENT_EQUIPO);
    buildForm(CURRENT_EQUIPO, lastByPosition((BY_FLOTA.get(CURRENT_FLOTA)||new Map()).get(CURRENT_EQUIPO)||[]));
  });
}

function fillEquipos(){
  const list = $("#equipo");
  list.innerHTML='';
  const search = $("#buscaEquipo").value.toLowerCase();
  const map = BY_FLOTA.get(CURRENT_FLOTA) || new Map();
  const equipos = Array.from(map.keys()).sort((a,b)=>{
    const na = parseInt(String(a).match(/(\d+)/)?.[1]||'0',10);
    const nb = parseInt(String(b).match(/(\d+)/)?.[1]||'0',10);
    return na-nb || String(a).localeCompare(String(b));
  });
  for(const eq of equipos){
    if(search && !String(eq).toLowerCase().includes(search)) continue;
    const o=document.createElement('option'); o.value=eq; o.textContent=eq;
    list.appendChild(o);
  }
  list.addEventListener('change', ()=>{
    CURRENT_EQUIPO = list.value;
    renderEquipo(CURRENT_EQUIPO);
    restoreDraftIfAny();
  });
}

function positionsList(){
  return Array.from({length: POS_COUNT}, (_,i)=> 'P'+(i+1));
}

function lastByPosition(rows){
  // returns map P1..P{POS_COUNT} -> last row
  const byPos = {};
  for(const p of positionsList()){ byPos[p]=null; }
  for(const r of rows){
    const p = toP(r[COL_POS]);
    if(!p || !(p in byPos)) continue;
    const d = parseDate(r[COL_FECHA]) || new Date(0);
    if(!byPos[p] || (d > (parseDate(byPos[p][COL_FECHA])||new Date(0)))){
      byPos[p]=r;
    }
  }
  return byPos;
}

function renderEquipo(eq){
  $("#equiponame").textContent = eq || '—';
  const rows = (BY_FLOTA.get(CURRENT_FLOTA)||new Map()).get(eq)||[];
  const last = lastByPosition(rows);
  // Equipo last event
  let lastRow = null;
  for(const r of rows){
    if(!lastRow || (parseDate(r[COL_FECHA]) > parseDate(lastRow[COL_FECHA]))) lastRow = r;
  }
  $("#fechalast").textContent = lastRow ? (parseDate(lastRow[COL_FECHA]) ? ddmmyyyy(parseDate(lastRow[COL_FECHA])) : '—') : '—';
  $("#horolast").textContent  = lastRow ? (lastRow[COL_HORO]||'—') : '—';

  renderPositionsGrid(last);
  buildForm(eq, last);
}

function renderPositionsGrid(last){
  const container = $("#posGrid");
  container.innerHTML = '';

  const preset = GRID_PRESETS[GRID_PRESET] || GRID_PRESETS.auto4;

  if(preset.layout){
    // Render given layout but hide positions beyond POS_COUNT
    const layout = preset.layout;
    for(const row of layout){
      const cols = row.length;
      const rowDiv = document.createElement('div');
      rowDiv.className = 'rowgrid';
      rowDiv.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

      row.forEach(cell=>{
        const card = document.createElement('div');
        card.className = 'card pos';
        if(!cell){
          card.innerHTML = '<div class="muted">—</div>';
        }else{
          const n = parseInt(cell.replace('P',''),10);
          if(n<=POS_COUNT){
            card.innerHTML = `<div class="title">${cell}</div><div id="${cell}_c"></div>`;
          }else{
            card.innerHTML = '<div class="muted">—</div>';
          }
        }
        rowDiv.appendChild(card);
      });
      container.appendChild(rowDiv);
    }
  }else{
    // Auto grid: 4 columns by default
    const cols = GRID_PRESETS.auto4.cols||4;
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    for(const p of positionsList()){
      const card = document.createElement('div');
      card.className = 'card pos';
      card.innerHTML = `<div class="title">${p}</div><div id="${p}_c"></div>`;
      container.appendChild(card);
    }
  }

  // Fill each position content
  for(const p of positionsList()){
    renderPos(`${p}_c`, last[p]);
  }
}

function renderPos(elemId, r){
  const el = document.getElementById(elemId);
  if(!el){ return; }
  if(!r){ el.innerHTML = '<div class="muted">Sin neumático asignado.</div>'; return; }
  const fecha = parseDate(r[COL_FECHA]);
  el.innerHTML = `
    <div><b>Marca:</b> ${r[COL_MARCA]||'-'} <br/>
    <b>Diseño:</b> ${r[COL_TIPO]||'-'}</div>
    <div><b>Serie:</b> ${r[COL_SERIE]||'-'}</div>
    <div><b>Horas totales:</b> ${r[COL_HRTOT]||'-'}</div>
    <div><b>Rem. Izq / Der:</b> ${r[COL_RIZQ]||'-'} / ${r[COL_RDER]||'-'}</div>
    <div class="muted">Último evento: ${fecha? ddmmyyyy(fecha):'-'}</div>
  `;
}

function buildForm(eq, last){
  const cont = $("#formPos");
  cont.innerHTML = '';
  const fechaISO = ($("#fechaExam").value || new Date().toISOString().slice(0,10));
  const draftKey = `${eq}|${fechaISO}`;

  // Default horo
  if(!$("#horoExam").value){ $("#horoExam").value = $("#horolast").textContent==='—' ? '' : $("#horolast").textContent; }

  for(const p of positionsList()){
    const r = last[p];
    const d = (DRAFTS[draftKey]?.rows?.[p]) || {};
    const serie = d.serie ?? (r?.[COL_SERIE]||'');
    const rizq  = d.rizq  ?? (r?.[COL_RIZQ]||'');
    const rder  = d.rder  ?? (r?.[COL_RDER]||'');
    const ct    = d.ct    ?? '';
    const psi   = d.psi   ?? '';

    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <div class="title">${p}</div>
      <label>Serie (${p})</label><input type="text" id="serie_${p}" value="${serie}"/>
      <label>Rem. Izq (${p})</label><input type="text" id="rizq_${p}" value="${rizq}"/>
      <label>Rem. Der (${p})</label><input type="text" id="rder_${p}" value="${rder}"/>
      <label>CT examen (${p})</label><input type="text" id="ct_${p}" value="${ct}"/>
      <label>Presión PSI (${p})</label><input type="text" id="psi_${p}" value="${psi}"/>
      <label>Fotos (${p})</label><input type="file" id="fotos_${p}" accept="image/*" multiple capture="environment"/>
      <div class="muted" id="infof_${p}"></div>
    `;
    cont.appendChild(div);
  }

  // show current photos count
  for(const p of positionsList()){
    const info = document.getElementById(`infof_${p}`);
    const n = DRAFTS[draftKey]?.fotos?.[p]?.length || 0;
    if(n>0) info.textContent = `Fotos guardadas: ${n}`;
  }
}

// Save draft
$("#btnSave").addEventListener('click', ()=>{
  if(!CURRENT_EQUIPO){ toast('Elige un equipo'); return; }
  const fechaISO = ($("#fechaExam").value || new Date().toISOString().slice(0,10));
  const key = `${CURRENT_EQUIPO}|${fechaISO}`;

  const rows = {};
  for(const p of positionsList()){
    rows[p] = {
      serie: $("#serie_"+p).value.trim(),
      rizq:  $("#rizq_"+p).value.trim(),
      rder:  $("#rder_"+p).value.trim(),
      ct:    $("#ct_"+p).value.trim(),
      psi:   $("#psi_"+p).value.trim()
    };
  }
  const fotos = DRAFTS[key]?.fotos || {};
  // read new photos inputs and append
  for(const p of positionsList()){
    const input = document.getElementById("fotos_"+p);
    if(input && input.files && input.files.length){
      fotos[p] = fotos[p] || [];
      for(const f of input.files){ fotos[p].push({name:f.name, file:f}); }
      document.getElementById('infof_'+p).textContent = `Fotos guardadas: ${fotos[p].length}`;
      input.value = ''; // clear
    }
  }
  DRAFTS[key] = {
    horometro: $("#horoExam").value.trim(),
    rows, fotos,
    flota: CURRENT_FLOTA
  };
  saveDraftsToStorage(DRAFTS);
  renderDraftsList();
  toast('Borrador guardado');
});

function renderDraftsList(){
  const box = $("#draftList");
  if(!Object.keys(DRAFTS).length){ box.textContent = "Sin borradores."; return; }
  const items = Object.entries(DRAFTS).sort(([a],[b])=>a.localeCompare(b));
  box.innerHTML = items.map(([k,v])=>{
    const [eq,fecha]=k.split('|');
    const d=new Date(fecha);
    const label = `${eq} — ${ddmmyyyy(d)}`;
    return `<div><a href="#" data-k="${k}" class="openDraft">${label}</a></div>`;
  }).join('');
  box.querySelectorAll('.openDraft').forEach(a=> a.addEventListener('click', (ev)=>{
    ev.preventDefault();
    const k = ev.target.dataset.k;
    const [eq,fecha]=k.split('|');
    CURRENT_EQUIPO = eq;
    // select equipo in list
    const list = $("#equipo");
    for(const opt of list.options){ if(opt.value===eq){ list.value=eq; break; } }
    renderEquipo(eq);
    $("#fechaExam").value = fecha;
    restoreDraftIfAny();
    toast('Borrador abierto');
  }));
}

function restoreDraftIfAny(){
  const fechaISO = ($("#fechaExam").value || new Date().toISOString().slice(0,10));
  const key = `${CURRENT_EQUIPO}|${fechaISO}`;
  const d = DRAFTS[key];
  if(!d) { buildForm(CURRENT_EQUIPO, lastByPosition((BY_FLOTA.get(CURRENT_FLOTA)||new Map()).get(CURRENT_EQUIPO)||[])); return; }
  $("#horoExam").value = d.horometro || '';
  // fill fields
  for(const p of positionsList()){
    const r = d.rows?.[p] || {};
    const serie = $("#serie_"+p); if(serie) serie.value = r.serie || '';
    const rizq  = $("#rizq_"+p);  if(rizq)  rizq.value  = r.rizq || '';
    const rder  = $("#rder_"+p);  if(rder)  rder.value  = r.rder || '';
    const ct    = $("#ct_"+p);    if(ct)    ct.value    = r.ct || '';
    const psi   = $("#psi_"+p);   if(psi)   psi.value   = r.psi || '';
    const cnt = d.fotos?.[p]?.length || 0;
    const infoEl = document.getElementById('infof_'+p);
    if(infoEl) infoEl.textContent = cnt? `Fotos guardadas: ${cnt}` : '';
  }
}

$("#btnDelete").addEventListener('click', ()=>{
  if(!CURRENT_EQUIPO){ toast('Elige un equipo'); return; }
  const fechaISO = ($("#fechaExam").value || new Date().toISOString().slice(0,10));
  const key = `${CURRENT_EQUIPO}|${fechaISO}`;
  if(DRAFTS[key]){
    delete DRAFTS[key];
    saveDraftsToStorage(DRAFTS);
    renderDraftsList();
    toast('Borrador eliminado');
    // rebuild form with defaults
    buildForm(CURRENT_EQUIPO, lastByPosition((BY_FLOTA.get(CURRENT_FLOTA)||new Map()).get(CURRENT_EQUIPO)||[]));
  }
});

// Export ALL -> one Excel + ZIP
$("#btnExport").addEventListener('click', async ()=>{
  if(!Object.keys(DRAFTS).length){ toast('No hay borradores'); return; }
  // Build worksheet
  const cols = [
    'Account BibForce Id','Vehicle’s registration #','Pos TTC','Movement’s date','Axle #',
    'Tire Position','Vehicle Mileage','Vehicle Hours','Tire Serial #',
    'Internal RTD','Central RTD','External RTD','Tire Destination',
    'Internal Damage Code (CT1)','Presión ','Temperatura ','CT Examen ','Observaciones'
  ];
  // Dynamic mapping: odd = Left, even = Right
  const posMap = {};
  for(let i=1;i<=12;i++){
    const axle = Math.ceil(i/2);
    const side = (i%2===1) ? 'L' : 'R';
    posMap['P'+i] = { pos: `${axle}${side}`, axle };
  }
  const rowsOut = [];
  const zip = new JSZip();
  const fotosRoot = zip.folder('fotos');
  for(const [key, d] of Object.entries(DRAFTS)){
    const [eq, fechaISO] = key.split('|');
    const fecha = new Date(fechaISO);
    const fechaTxt = ddmmyyyy_compact(fecha);
    const sub = fotosRoot.folder(`${eq}_${fechaTxt}`);
    for(const p of positionsList()){
      const vals = d.rows?.[p] || {};
      const fotos = d.fotos?.[p] || [];
      const names = [];
      let i=1;
      for(const f of fotos){
        const ext = (f.name.split('.').pop()||'jpg').toLowerCase();
        const fname = `${eq}_${p}_${fechaTxt}_${i}.${ext}`;
        names.push(fname); i++;
        const arrayBuffer = await f.file.arrayBuffer();
        sub.file(fname, arrayBuffer);
      }
      rowsOut.push({
        'Account BibForce Id': null,
        'Vehicle’s registration #': eq,
        'Pos TTC': null,
        'Movement’s date': fechaISO,
        'Axle #': (posMap[p]||{}).axle || null,
        'Tire Position': (posMap[p]||{}).pos || p,
        'Vehicle Mileage': null,
        'Vehicle Hours': d.horometro || '',
        'Tire Serial #': vals.serie || '',
        'Internal RTD': vals.rizq || '',
        'Central RTD': null,
        'External RTD': vals.rder || '',
        'Tire Destination': 'Examen',
        'Internal Damage Code (CT1)': null,
        'Presión ': vals.psi || '',
        'Temperatura ': null,
        'CT Examen ': vals.ct || '',
        'Observaciones': names.length? names.join('; ') : null
      });
    }
  }
  const ws = XLSX.utils.json_to_sheet(rowsOut, {header: cols});
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
  zip.file('Examenes_MASTER.xlsx', wbout);

  const content = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = 'export_examenes.zip';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Exportado');
});

// Export/Import drafts as JSON
$("#btnSaveDrafts").addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(DRAFTS)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'borradores.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
$("#loadDrafts").addEventListener('change', (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const fr = new FileReader();
  fr.onload = ()=>{
    try{
      const obj = JSON.parse(fr.result);
      DRAFTS = obj; saveDraftsToStorage(DRAFTS); renderDraftsList(); toast('Borradores importados');
    }catch(e){ alert('JSON inválido'); }
  };
  fr.readAsText(file);
});

// PWA install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt = e; });
$("#btnInstall").addEventListener('click', async ()=>{
  if(deferredPrompt){ deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; }
});
