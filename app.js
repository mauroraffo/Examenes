// Klinge Lite v2 — Solo modal, sin borradores por posición
// Estado principal
let RAW = [];
let COLS = [];
let BY_FLOTA = new Map();
let CURRENT_FLOTA = '(Todas)';
let CURRENT_EQUIPO = null;

let POS_COUNT = parseInt(localStorage.getItem('pos_count')||'12',10);
let GRID_PRESET = localStorage.getItem('grid_preset') || 'Scoop / Auto';

// Presets de grilla (solo visual)
const GRID_PRESETS = {
  'Scoop / Auto': { layout: [['P1','P2'],['P3','P4']] },
  'Dumper': { layout: [[null,'P1','P2',null],['P3','P4','P5','P6']] },
  'Moto': { layout: [['P1','P2'],['P3','P4'],['P5','P6']] },
  'Stacker': { layout: [['P1','P2','P3','P4'],[null,'P5','P6',null]] },
  'Volquete 8x4': { layout: [[null,'P1','P2',null],[null,'P3','P4',null],['P5','P6','P7','P8'],['P9','P10','P11','P12']] },
  'Volquete 6x4': { layout: [[null,'P1','P2',null],['P3','P4','P5','P6'],['P7','P8','P9','P10']] }
};

// Toaster
const $ = (q)=>document.querySelector(q);
function toast(msg){ const t=$('#toast'); if(!t) return; t.textContent=msg; t.style.display='block'; setTimeout(()=>t.style.display='none',2000); }

// Utilidades de fecha/posición
function parseDate(s){
  if(!s) return null;
  const str = String(s).trim();
  const d1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); // dd/mm/yyyy
  if(d1){ const y=+d1[3]; return new Date(y<100?2000+y:y, +d1[2]-1, +d1[1]); }
  const d2 = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); // yyyy-mm-dd
  if(d2){ return new Date(+d2[1], +d2[2]-1, +d2[3]); }
  const d3 = str.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/); // dd-mm-yyyy
  if(d3){ const y=+d3[3]; return new Date(y<100?2000+y:y, +d3[2]-1, +d3[1]); }
  const d4 = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/); // dd.mm.yyyy
  if(d4){ const y=+d4[3]; return new Date(y<100?2000+y:y, +d4[2]-1, +d4[1]); }
  const d = new Date(str); return isNaN(d)? null : d;
}
function ddmmyyyy(d){ const z=n=>String(n).padStart(2,'0'); return `${z(d.getDate())}/${z(d.getMonth()+1)}/${d.getFullYear()}`; }
function ddmmyyyy_compact(d){ const z=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}${z(d.getMonth()+1)}${z(d.getDate())}`; }
function ddmmyy(d){ const z=n=>String(n).padStart(2,'0'); return `${z(d.getDate())}${z(d.getMonth()+1)}${String(d.getFullYear()).slice(-2)}`; }
function toP(val){
  const s = String(val??'').trim().toUpperCase();
  const m = s.match(/P\s*(\d{1,2})/); if(m){ const n=+m[1]; if(n>=1&&n<=12) return 'P'+n; }
  const n = parseInt(s,10); if(n>=1&&n<=12) return 'P'+n; return null;
}
function positionsList(){ return Array.from({length:POS_COUNT},(_,i)=>'P'+(i+1)); }

// Mapeo de columnas
function col(name){ const ix = COLS.findIndex(c=>c.toLowerCase()===name.toLowerCase()); return ix>=0? COLS[ix]:null; }
function findColumn(regexes){ for(const c of COLS){ for(const r of regexes){ if(r.test(c)) return c; } } return null; }
let COL_POS, COL_EQUIPO, COL_FLOTA, COL_FECHA, COL_HORO, COL_MARCA, COL_TIPO, COL_SERIE, COL_HRTOT, COL_RIZQ, COL_RDER;
function mapColumns(){
  COL_POS   = col('Posición')||col('Posicion');
  COL_EQUIPO= col('Equipo');
  COL_FLOTA = col('Flota');
  COL_FECHA = col('Fecha Evento')||col('Fecha');
  COL_HORO  = col('Horómetro')||col('Horometro');
  COL_MARCA = col('Marca Neumático')||findColumn([/marca/i]);
  COL_TIPO  = col('Tipo Neumático') ||findColumn([/dise|pattern|tipo/i]);
  COL_SERIE = col('Serie Neumático')||col('Serie');
  COL_HRTOT = col('Horas Totales')  ||findColumn([/hora/i]);
  COL_RIZQ  = col('Rem. Izquierdo') ||findColumn([/izq/i]);
  COL_RDER  = col('Rem. Derecho')   ||findColumn([/der/i]);
}

// --- Carga CSV (acepta ; o , y normaliza headers) ---
function normalizeHeader(h){
  if(!h) return '';
  return String(h)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // quita acentos
    .replace(/[\s_]+/g,' ') // espacios a uno
    .replace(/\s*#\s*/g,'#')
    .trim();
}
let HEADER_MAP = new Map(); // normalized -> original
function buildHeaderMap(fields){ HEADER_MAP.clear(); for(const f of (fields||[])){ HEADER_MAP.set(normalizeHeader(f), f); } }
function alias(...names){ for(const n of names){ const h=HEADER_MAP.get(n); if(h) return h; } return null; }

function mapColumnsAuto(){
  // alias por columna (normalizados)
  COL_POS   = alias('posicion','pos','tire position','tireposition','pos ttc','pos ttc') || col('Posicion');
  COL_EQUIPO= alias(
    'equipo','vehiculo','vehiculo#','vehiculo id','unidad','unidad#','codigo equipo','equipo id',
    'vehicle','vehicle registration','vehicle registration #','vehicletag','vehicle id','unit','unit id','patente','matricula'
  ) || col('Equipo');
  COL_FLOTA = alias('flota','fleet','flota id','nombre flota') || col('Flota');
  COL_FECHA = alias('fecha ultimo evento','fecha evento','fecha','movement ts date','movement date','date');
  COL_HORO  = alias('horometro','horometro equipo','horómetro','vehicle hours','horas','hm');
  COL_MARCA = alias('marca neumatico','marca neumatico','marca','brand');
  COL_TIPO  = alias('tipo neumatico','diseno','diseño','pattern','tipo','design');
  COL_SERIE = alias('serie neumatico','serie','tire serial #','serial','serial#');
  COL_HRTOT = alias('horas totales','total horas','hours total');
  COL_RIZQ  = alias('rem. izquierdo','rem izquierdo','r interna','internal rtd','rem izq','r izq');
  COL_RDER  = alias('rem. derecho','rem derecho','r externa','external rtd','rem der','r der');
}

const __csvHome = document.getElementById('csv');
if(__csvHome) __csvHome.addEventListener('change', (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const parseOnce = (delimiter)=> new Promise((resolve)=>{
    Papa.parse(file, { header:true, skipEmptyLines:true, delimiter: delimiter||undefined, complete: (res)=> resolve(res) });
  });
  (async ()=>{
    // intentar autodetección: primero sin delimiter (auto), si no trae headers válidos, probar ; y luego ,
    let res = await parseOnce();
    let fields = res?.meta?.fields||[];
    if(fields.length<2){ res = await parseOnce(';'); fields = res?.meta?.fields||[]; }
    if(fields.length<2){ res = await parseOnce(','); fields = res?.meta?.fields||[]; }

    RAW = res.data; COLS = fields; buildHeaderMap(COLS); mapColumnsAuto(); indexByFlotaEquipo(); fillFlotas(); $('#equipo').innerHTML='';
    $('#equiponame').textContent='-'; $('#fechalast').textContent='-'; $('#horolast').textContent='-';
    renderExamenesSesion(); toast('CSV cargado');
  })();
});

function indexByFlotaEquipo(){
  BY_FLOTA.clear();
  for(const row of RAW){
    const fl = COL_FLOTA ? (row[COL_FLOTA]||'(Todas)') : '(Todas)';
    const eq = row[COL_EQUIPO]; if(!eq) continue;
    if(!BY_FLOTA.has(fl)) BY_FLOTA.set(fl,new Map());
    const m = BY_FLOTA.get(fl); if(!m.has(eq)) m.set(eq,[]); m.get(eq).push(row);
  }
}

function fillFlotas(){
  const sel = $('#flota'); sel.innerHTML='';
  const optAll = document.createElement('option'); optAll.value='(Todas)'; optAll.textContent='(Todas)'; sel.appendChild(optAll);
  for(const fl of Array.from(BY_FLOTA.keys()).sort()){
    const o=document.createElement('option'); o.value=fl; o.textContent=fl; sel.appendChild(o);
  }
  sel.value='(Todas)'; CURRENT_FLOTA='(Todas)';
  sel.onchange=()=>{ CURRENT_FLOTA=sel.value; fillEquipos(); };
  $('#buscaEquipo').oninput=()=> fillEquipos();

  // controles de grilla
  const posCount=$('#posCount'), gridPreset=$('#gridPreset');
  if(posCount){ posCount.value=String(POS_COUNT); posCount.onchange=()=>{ POS_COUNT=parseInt(posCount.value,10); localStorage.setItem('pos_count',String(POS_COUNT)); if(CURRENT_EQUIPO) renderEquipo(CURRENT_EQUIPO); }; }
  if(gridPreset){ gridPreset.value=GRID_PRESET; gridPreset.onchange=()=>{ GRID_PRESET=gridPreset.value; localStorage.setItem('grid_preset',GRID_PRESET); if(CURRENT_EQUIPO) renderEquipo(CURRENT_EQUIPO); }; }
}

function fillEquipos(){
  const list=$('#equipo'); list.innerHTML='';
  const search = ($('#buscaEquipo').value||'').toLowerCase();
  const map = BY_FLOTA.get(CURRENT_FLOTA)||new Map();
  const equipos = Array.from(map.keys()).sort((a,b)=>{
    const na=parseInt(String(a).match(/(\d+)/)?.[1]||'0',10);
    const nb=parseInt(String(b).match(/(\d+)/)?.[1]||'0',10);
    return (na-nb)||String(a).localeCompare(String(b));
  });
  for(const eq of equipos){ if(search && !String(eq).toLowerCase().includes(search)) continue; const o=document.createElement('option'); o.value=eq; o.textContent=eq; list.appendChild(o); }
  list.onchange=()=>{ CURRENT_EQUIPO=list.value; renderEquipo(CURRENT_EQUIPO); };
}

function lastByPosition(rows){
  const byPos={}; for(const p of positionsList()) byPos[p]=null;
  for(const r of rows){ const p=toP(r[COL_POS]); if(!p||!(p in byPos)) continue; const d=parseDate(r[COL_FECHA])||new Date(0); if(!byPos[p] || d>(parseDate(byPos[p][COL_FECHA])||new Date(0))) byPos[p]=r; }
  return byPos;
}

function renderEquipo(eq){
  $('#equiponame').textContent=eq||'-';
  const rows=(BY_FLOTA.get(CURRENT_FLOTA)||new Map()).get(eq)||[];
  const last=lastByPosition(rows);
  let latestDate=null, maxHoro=null; for(const r of rows){ const d=parseDate(r[COL_FECHA]); if(d && (!latestDate||d>latestDate)) latestDate=d; const h=parseFloat(r[COL_HORO]); if(!isNaN(h) && (maxHoro===null||h>maxHoro)) maxHoro=h; }
  $('#fechalast').textContent = latestDate? ddmmyyyy(latestDate):'-';
  $('#horolast').textContent  = (maxHoro!==null)? maxHoro:'-';
  renderPositionsGrid(last);
}

function renderPositionsGrid(last){
  const container=$('#posGrid'); container.innerHTML='';
  const preset = GRID_PRESETS[GRID_PRESET];
  if(preset && preset.layout){
    for(const row of preset.layout){
      const rowDiv=document.createElement('div'); rowDiv.className='rowgrid'; rowDiv.style.gridTemplateColumns=`repeat(${row.length},1fr)`;
      row.forEach(cell=>{
        const card=document.createElement('div'); card.className='card pos';
        if(!cell){ card.innerHTML='<div class="muted">-</div>'; }
        else{ const n=parseInt(cell.replace('P',''),10); if(n<=POS_COUNT){ card.innerHTML=`<div class="title">${cell}</div><div id="${cell}_c"></div>`; } else { card.innerHTML='<div class="muted">-</div>'; } }
        rowDiv.appendChild(card);
      });
      container.appendChild(rowDiv);
    }
  } else {
    container.style.gridTemplateColumns='repeat(4,1fr)';
    for(const p of positionsList()){ const card=document.createElement('div'); card.className='card pos'; card.innerHTML=`<div class="title">${p}</div><div id="${p}_c"></div>`; container.appendChild(card); }
  }
  for(const p of positionsList()) renderPos(`${p}_c`, last[p]);
}

function renderPos(elemId, r){
  const el=document.getElementById(elemId); if(!el) return;
  if(!r){ el.innerHTML='<div class="muted">Sin neumático asignado.</div><button style="margin-top:8px;width:100%" onclick="abrirModal(\''+elemId.replace('_c','')+'\')">Ingresar examen</button>'; return; }
  const fecha=parseDate(r?.[COL_FECHA]);
  el.innerHTML = `
    <div><b>Marca:</b> ${r?.[COL_MARCA]||'-'} <br/><b>Diseño:</b> ${r?.[COL_TIPO]||'-'}</div>
    <div><b>Serie:</b> ${r?.[COL_SERIE]||'-'}</div>
    <div><b>Horas totales:</b> ${r?.[COL_HRTOT]||'-'}</div>
    <div><b>Rem. Izq / Der:</b> ${r?.[COL_RIZQ]||'-'} / ${r?.[COL_RDER]||'-'}</div>
    <div class="muted">Último evento: ${fecha? ddmmyyyy(fecha):'-'}</div>
    <button style="margin-top:8px;width:100%" onclick="abrirModal('${elemId.replace('_c','')}')">Ingresar examen</button>
  `;
}

// --- Modal / Exámenes en sesión ---
let HORO_POR_CAMION = {};
let EXAMENES_SESION = [];

function abrirModal(pos){
  if(!CURRENT_FLOTA || !CURRENT_EQUIPO){ toast('Selecciona flota y equipo'); return; }
  $('#modalFlota').value=CURRENT_FLOTA; $('#modalEquipo').value=CURRENT_EQUIPO; $('#modalPos').value=String(pos).replace('P','').replace('_c','');
  $('#modalRizq').value=''; $('#modalRder').value=''; $('#modalCT').value=''; $('#modalComentarios').value=''; $('#modalFotos').value='';
  $('#modalHoro').value = HORO_POR_CAMION[CURRENT_EQUIPO] || '';
  $('#examModal').classList.remove('hidden');
}
document.getElementById('modalCancel')?.addEventListener('click', ()=> document.getElementById('examModal').classList.add('hidden'));

document.getElementById('modalSave')?.addEventListener('click', ()=>{ modalSave(); });

function modalCancel(){ const el=document.getElementById('examModal'); if(el) el.classList.add('hidden'); }
function modalSave(){
  try{
    const examen = {
      flota: document.getElementById('modalFlota')?.value||'', equipo: document.getElementById('modalEquipo')?.value||'', horometro: document.getElementById('modalHoro')?.value||'',
      posicion: document.getElementById('modalPos')?.value||'', rizq: document.getElementById('modalRizq')?.value||'', rder: document.getElementById('modalRder')?.value||'', ct: document.getElementById('modalCT')?.value||'',
      comentarios: document.getElementById('modalComentarios')?.value||'', fotos: (function(){const f=document.getElementById('modalFotos'); return f&&f.files? Array.from(f.files):[];})(),
      fechaISO: (new Date()).toISOString().slice(0,10)
    };
    HORO_POR_CAMION[CURRENT_EQUIPO]=examen.horometro;
    EXAMENES_SESION.push(examen); saveExamenesSesion(); renderExamenesSesion(); toast('Examen guardado');
  }catch(e){ console.error(e); alert('No se pudo guardar el examen'); }
  modalCancel();
}

function saveExamenesSesion(){ localStorage.setItem('EXAMENES_SESION', JSON.stringify(EXAMENES_SESION)); }
function loadExamenesSesion(){ try{ const d=JSON.parse(localStorage.getItem('EXAMENES_SESION')||'[]'); if(Array.isArray(d)) EXAMENES_SESION=d; }catch{ EXAMENES_SESION=[]; } }
loadExamenesSesion();

function renderExamenesSesion(){
  const box=document.getElementById('draftList'); if(!box) return; if(!EXAMENES_SESION.length){ box.textContent='Sin exámenes.'; return; }
  const items=EXAMENES_SESION.map((ex,i)=>{
    const fecha=ex.fechaISO||'';
    return `<div class="row" style="justify-content:space-between;align-items:center;margin:6px 0;gap:8px">
      <div class="muted" style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${ex.flota||'-'} · <b>${ex.equipo||'-'}</b> · P${ex.posicion||'?'} · H:${ex.horometro||''} · ${fecha}
      </div>
      <a href="#" class="pill" onclick="return delExamIndex(${i});">Eliminar</a>
    </div>`;
  }).join('');
  box.innerHTML=items;
}
renderExamenesSesion();

function delExamIndex(i){ try{ i=parseInt(i,10); if(isNaN(i)) return false; if(i<0||i>=EXAMENES_SESION.length) return false; EXAMENES_SESION.splice(i,1); saveExamenesSesion(); renderExamenesSesion(); toast('Examen eliminado'); }catch(e){ console.error(e);} return false; }

// Exportar exámenes de sesión a ZIP (Excel + fotos)
async function exportarExamenesSesionZIP(){
  try{
    if(!EXAMENES_SESION.length){ toast('No hay exámenes guardados'); return; }
    if(typeof XLSX==='undefined'){ toast('No se cargó XLSX'); return; }
    if(typeof JSZip==='undefined'){ toast('No se cargó JSZip'); return; }
    const cols=['Flota','Equipo','Horometro','Posicion','CT Examen','Rem Izq','Rem Der','Comentarios','Fecha','Fotos'];
    const rows=[]; const zip=new JSZip(); const fotosRoot=zip.folder('fotos');
    async function fileToArrayBufferAny(f){
      if(!f) return null;
      try{
        if(typeof f.arrayBuffer==='function') return await f.arrayBuffer();
        if(f.file && typeof f.file.arrayBuffer==='function') return await f.file.arrayBuffer();
        // Fallback FileReader
        return await new Promise((resolve,reject)=>{ const fr=new FileReader(); fr.onload=()=>resolve(fr.result); fr.onerror=reject; fr.readAsArrayBuffer(f.file||f); });
      }catch{ return null; }
    }
    for(const ex of EXAMENES_SESION){
      // Obtener serie desde CSV para la posición actual
      const rowsEq = (BY_FLOTA.get(ex.flota)||new Map()).get(ex.equipo)||[];
      const lastMap = lastByPosition(rowsEq);
      const rowPos = lastMap['P'+(ex.posicion||'')] || null;
      const serieRaw = rowPos ? (rowPos[COL_SERIE]||'') : '';
      const serieSan = String(serieRaw||'').toUpperCase().replace(/[^A-Z0-9]/g,'') || 'SIN_SERIE';

      const fecha = ex.fechaISO ? new Date(ex.fechaISO) : new Date();
      const fechaTxt = ddmmyy(fecha); // ddmmyy

      const sub=fotosRoot.folder(`${ex.equipo||'equipo'}_P${ex.posicion||''}_${fechaTxt}`);
      const names=[]; let i=1;
      for(const f of (ex.fotos||[])){
        const baseName=(f&&f.name)? f.name : (typeof f==='string'? f : `foto_${i}.jpg`);
        const ext=(baseName.split('.').pop()||'jpg').toLowerCase();
        const baseOut = `${serieSan}_${fechaTxt}`;
        const fname = (ex.fotos.length>1) ? `${baseOut}_${i}.${ext}` : `${baseOut}.${ext}`;
        names.push(fname); i++;
        try{ const buf = await fileToArrayBufferAny(f); if(buf) sub.file(fname,buf); }catch{}
      }
      rows.push({ 'Flota':ex.flota||'', 'Equipo':ex.equipo||'', 'Horometro':ex.horometro||'', 'Posicion':ex.posicion||'', 'CT Examen':ex.ct||'', 'Rem Izq':ex.rizq||'', 'Rem Der':ex.rder||'', 'Comentarios':ex.comentarios||'', 'Fecha':ex.fechaISO||'', 'Fotos':names.join('; ') });
    }
    const ws=XLSX.utils.json_to_sheet(rows,{header:cols}); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Examenes'); const wbout=XLSX.write(wb,{bookType:'xlsx',type:'array'}); zip.file('Examenes_SESION.xlsx',wbout);
    const content=await zip.generateAsync({type:'blob'}); const a=document.createElement('a'); a.href=URL.createObjectURL(content); a.download='examenes_sesion.zip'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000); toast('ZIP exportado');
  }catch(err){ console.error('Export ZIP fail',err); alert('No se pudo generar el ZIP'); }
}

// Clicks export
document.addEventListener('click', (ev)=>{ const btn=ev.target && ev.target.closest ? ev.target.closest('#btnExportSesionZip') : null; if(btn){ ev.preventDefault(); exportarExamenesSesionZIP(); }});
document.addEventListener('click', (ev)=>{ const btn=ev.target && ev.target.closest ? ev.target.closest('#btnExportSesionZipSide') : null; if(btn){ ev.preventDefault(); exportarExamenesSesionZIP(); }});
try{ document.getElementById('btnExportSesionZip')?.addEventListener('click',(e)=>{ e.preventDefault(); exportarExamenesSesionZIP(); }); document.getElementById('btnExportSesionZipSide')?.addEventListener('click',(e)=>{ e.preventDefault(); exportarExamenesSesionZIP(); }); }catch{}

// Botón borrar todos (sesión)
document.addEventListener('click', (ev)=>{ const btn=ev.target && ev.target.closest ? ev.target.closest('#btnClearSesion') : null; if(btn){ ev.preventDefault(); if(!EXAMENES_SESION.length){ toast('No hay exámenes'); return; } if(!confirm('¿Borrar TODOS los exámenes guardados en esta sesión?')) return; EXAMENES_SESION=[]; saveExamenesSesion(); renderExamenesSesion(); toast('Exámenes borrados'); }});

// PWA install prompt
let deferredPrompt; window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt=e; });
document.getElementById('btnInstall')?.addEventListener('click', async ()=>{ if(deferredPrompt){ deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; }});
