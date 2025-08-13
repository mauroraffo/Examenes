// Utilidades DOM
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.style.display='block'; setTimeout(()=>t.style.display='none',1600); }

// Estado
let RAW=[]; let COLS=[]; let INDEX={}; let CURRENT_EQUIPO=null;

// Borradores persistentes (localStorage)
function loadDrafts(){ try{return JSON.parse(localStorage.getItem('drafts')||'{}')}catch{return{}} }
function saveDrafts(x){ localStorage.setItem('drafts', JSON.stringify(x||{})); }
let DRAFTS = loadDrafts();

/* =========================
   Detección TOLERANTE de columnas
   - Quita acentos y símbolos en encabezados
   - Busca por palabras clave equivalentes
========================= */
// Normalizar encabezados: sin acentos, minúsculas y sin símbolos
const norm = s => String(s||'')
  .trim()
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')  // quita acentos
  .replace(/[^a-z0-9 ]+/g,' ')                     // solo letras/números/espacios
  .replace(/\s+/g,' ')
  .trim();

let COLS_RAW = [];   // originales
let COLS_NORM = [];  // normalizados

function findByKeywords(keywords){
  for (const k of keywords){
    // match exacto o incluido
    let i = COLS_NORM.findIndex(c => c === k || c.includes(k));
    if (i >= 0) return COLS_RAW[i];
  }
  return null;
}

let COL_POS, COL_EQUIPO, COL_FLOTA, COL_FECHA, COL_HORO, COL_MARCA, COL_TIPO, COL_SERIE, COL_HRTOT, COL_RIZQ, COL_RDER;
function mapColumns(){
  COL_POS    = findByKeywords(['posicionbf','posicion bf','posicion','pos']);
  COL_EQUIPO = findByKeywords(['equipo','unidad','vehiculo','vehiculo id']);
  COL_FLOTA  = findByKeywords(['flota','nombre cliente','cliente','fleet']);
  COL_FECHA  = findByKeywords(['fecha evento','fecha','fechaevento']);
  COL_HORO   = findByKeywords(['horometro','horometro del equipo','horo']);
  COL_MARCA  = findByKeywords(['marca neumatico','marca','brand']);
  COL_TIPO   = findByKeywords(['diseno neumatico','diseno','disenio','tipo neumatico','pattern','tipo']);
  COL_SERIE  = findByKeywords(['serie','nro serie','serial','numero de serie']);
  COL_HRTOT  = findByKeywords(['horas totales','horas total','hr total','horas']);
  COL_RIZQ   = findByKeywords(['rem izquierdo','rem izq','remanente izquierdo','izquierdo']);
  COL_RDER   = findByKeywords(['rem derecho','rem der','remanente derecho','derecho']);
}

// CSV autodetección ; , tab
function parseCSVFile(file){
  const tryDelim = (text, delim)=>{
    const lines = text.split(/\r?\n/).filter(Boolean);
    const cols  = (lines[0]||'').split(delim).map(s=>s.trim());
    return {lines, cols, delim};
  };
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    let r = tryDelim(text, ';');
    if(r.cols.length<=1) r = tryDelim(text, ',');
    if(r.cols.length<=1) r = tryDelim(text, '\t');

    // ← guardamos encabezados normalizados
    COLS_RAW  = r.cols.map(c => c.trim());
    COLS_NORM = COLS_RAW.map(norm);
    COLS      = COLS_RAW.slice();

    const rows = r.lines.slice(1).map(line=>{
      const vals = line.split(r.delim);
      const obj = {};
      COLS.forEach((k,i)=> obj[k]= (vals[i]??'').trim());
      return obj;
    }).filter(x=> Object.values(x).some(v=> String(v).length));

    RAW = rows; mapColumns(); indexByFlotaEquipo(); fillFlotas(); fillEquipos();
    $('#diag').innerHTML = `CSV cargado: <b>${RAW.length}</b> filas, <b>${COLS.length}</b> columnas<br>`+
      `Equipo: ${COL_EQUIPO||'-'} | Flota: ${COL_FLOTA||'-'} | Posición: ${COL_POS||'-'} | Fecha: ${COL_FECHA||'-'}`;
    $('#diag').className = 'diag '+ (COL_EQUIPO&&COL_FLOTA&&COL_POS&&COL_FECHA?'ok':'err');
    toast('CSV cargado');
  };
  reader.readAsText(file);
}

function indexByFlotaEquipo(){ INDEX={};
  for(const row of RAW){
    const fl = row[COL_FLOTA]||'—';
    const eq = row[COL_EQUIPO]||'—';
    (INDEX[fl] ||= {});
    (INDEX[fl][eq] ||= []).push(row);
  }
}

function fillFlotas(){ const sel=$('#flota'); sel.innerHTML='';
  const opt=document.createElement('option'); opt.value='__ALL__'; opt.textContent='(Todas)'; sel.appendChild(opt);
  Object.keys(INDEX).sort().forEach(f=>{ const o=document.createElement('option'); o.value=f; o.textContent=f; sel.appendChild(o); });
  sel.onchange = fillEquipos;
}
function fillEquipos(){ const list=$('#equipo'); list.innerHTML='';
  const fl = $('#flota').value; const term = ($('#equSearch').value||'').toLowerCase();
  const pools = fl==='__ALL__'? Object.values(INDEX).reduce((a,b)=>Object.assign(a,b),{}) : (INDEX[fl]||{});
  Object.keys(pools).sort().forEach(eq=>{
    if(term && !eq.toLowerCase().includes(term)) return;
    const o=document.createElement('option'); o.value=eq; o.textContent=eq; list.appendChild(o);
  });
  list.onchange = ()=>{ CURRENT_EQUIPO=list.value; renderEquipo(CURRENT_EQUIPO); restoreDraftIfAny(); };
  if(list.options.length>0){ list.selectedIndex=0; CURRENT_EQUIPO=list.value; renderEquipo(CURRENT_EQUIPO); restoreDraftIfAny(); }
}
$('#equSearch').addEventListener('input', fillEquipos);

function renderEquipo(eq){
  $('#equiponame').textContent = eq||'—';
  if(!eq) return;
  const fl = $('#flota').value; const pool = (fl==='__ALL__'? Object.values(INDEX).reduce((a,b)=>Object.assign(a,b),{}) : INDEX[fl]||{});
  const rows = (pool[eq]||[]).slice();
  rows.sort((a,b)=> new Date(b[COL_FECHA]) - new Date(a[COL_FECHA]));
  const lastByPos={};
  for(const r of rows){ const p=r[COL_POS]; if(p && !lastByPos[p]) lastByPos[p]=r; }
  const mapPos = {P1:'p1',P2:'p2',P3:'p3',P4:'p4'};
  for(const pos of ['P1','P2','P3','P4']){
    const key = mapPos[pos]; const r = lastByPos[pos];
    const body = document.getElementById(`${key}c`); const foot=document.getElementById(`${key}f`);
    if(!r){ body.innerHTML='<div class="muted">Sin neumático asignado.</div>'; foot.textContent=''; continue; }
    body.innerHTML = `
      <div><b>Marca:</b> ${r[COL_MARCA]||'-'}</div>
      <div><b>Diseño:</b> ${r[COL_TIPO]||'-'}</div>
      <div><b>Serie:</b> ${r[COL_SERIE]||'-'}</div>
      <div><b>Horas totales:</b> ${r[COL_HRTOT]||'-'}</div>
      <div><b>Rem. Izq / Der:</b> ${r[COL_RIZQ]||'-'} / ${r[COL_RDER]||'-'}</div>`;
    foot.textContent = 'Último evento: '+ (r[COL_FECHA]||'-');
  }
  document.getElementById('fechalast').textContent = rows[0]?.[COL_FECHA] || '—';
  document.getElementById('horolast').textContent  = rows[0]?.[COL_HORO]  || '—';
}

// Borradores por equipo (renombrados a “exámenes” en UI)
function draftKey(eq){ return `draft:${eq}` }
function collectDraft(eq){
  return {
    eq, fecha: $('#ex_fecha').value||'', horo: $('#ex_horo').value||'',
    p1:{serie:$('#p1_serie').value, rizq:$('#p1_rizq').value, rder:$('#p1_rder').value, ct:$('#p1_ct').value, psi:$('#p1_psi').value},
    p2:{serie:$('#p2_serie').value, rizq:$('#p2_rizq').value, rder:$('#p2_rder').value, ct:$('#p2_ct').value, psi:$('#p2_psi').value},
    p3:{serie:$('#p3_serie').value, rizq:$('#p3_rizq').value, rder:$('#p3_rder').value, ct:$('#p3_ct').value, psi:$('#p3_psi').value},
    p4:{serie:$('#p4_serie').value, rizq:$('#p4_rizq').value, rder:$('#p4_rder').value, ct:$('#p4_ct').value, psi:$('#p4_psi').value}
  };
}
function applyDraft(d){ if(!d) return; $('#ex_fecha').value=d.fecha||''; $('#ex_horo').value=d.horo||'';
  for(const k of ['p1','p2','p3','p4']){ const x=d[k]||{}; $(`#${k}_serie`).value=x.serie||''; $(`#${k}_rizq`).value=x.rizq||''; $(`#${k}_rder`).value=x.rder||''; $(`#${k}_ct`).value=x.ct||''; $(`#${k}_psi`).value=x.psi||''; }
}
function saveDraft(){ if(!CURRENT_EQUIPO){ toast('Selecciona un equipo'); return; }
  DRAFTS[ draftKey(CURRENT_EQUIPO) ] = collectDraft(CURRENT_EQUIPO); saveDrafts(DRAFTS); renderDraftsList(); toast('Exámenes guardados'); }
function deleteDraft(){ if(!CURRENT_EQUIPO) return; delete DRAFTS[draftKey(CURRENT_EQUIPO)]; saveDrafts(DRAFTS); renderDraftsList(); toast('Examen eliminado'); }
function restoreDraftIfAny(){ const d=DRAFTS[draftKey(CURRENT_EQUIPO)]; if(d){ applyDraft(d); }}
function renderDraftsList(){ const box=$('#draftList'); const keys=Object.keys(DRAFTS).sort(); if(!keys.length){box.textContent='Sin borradores.';return;}
  box.innerHTML=''; keys.forEach(k=>{ const a=document.createElement('a'); a.href='#'; a.textContent=k.replace('draft:',''); a.style.display='block'; a.onclick=(e)=>{e.preventDefault(); CURRENT_EQUIPO=k.replace('draft:',''); applyDraft(DRAFTS[k]); toast('Examen cargado'); }; box.appendChild(a); });
}

// Eventos UI
document.getElementById('csv').addEventListener('change', e=>{ const f=e.target.files?.[0]; if(!f){toast('Sin archivo');return;} parseCSVFile(f); });
document.getElementById('btnSave').onclick = saveDraft;
document.getElementById('btnDelete').onclick = deleteDraft;
document.getElementById('btnExport').onclick = ()=> toast('Export a Excel + ZIP (pendiente)');
