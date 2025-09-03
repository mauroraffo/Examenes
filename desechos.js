// desechos.js - lista y filtros de neumáticos en destino final "Desecho"

(async function(){
  const ds = await datasetStore.load();
  if(!(ds && ds.rows && ds.cols)){
    alert('Primero carga el CSV en Inicio.');
    location.href='index.html'; return;
  }

  const rows = ds.rows; const cols = ds.cols;

  // Header map y alias
  const HMAP = new Map(cols.map(c=>[normalizeHeader(c), c]));
  const alias = (...names)=>{ for(const n of names){ const h=HMAP.get(n); if(h) return h; } return null; };

  const COL_SERIE = alias('serie neumatico','serie','tire serial #','serial','serial#');
  const COL_TIPO  = alias('tipo neumatico','diseno','diseño','pattern','tipo','design');
  const COL_FECHA = alias('fecha ultimo evento','fecha evento','fecha','movement…ts date','movement ts date','movement s date','movement date');
  const COL_DIM   = alias('dimension','dimensión','medida','size');
  const COL_DEST  = alias('tire destination','destino','destino final','desecho','scrap','disposal');
  const COL_HRTOT = alias('horas totales','hours total','vehicle hours','horometro','horómetro');
  const COL_HDEL  = alias('horas delanteras','horas delan','h del','front hours');
  const COL_POS   = alias('posicion','pos','tire position','tireposition','pos ttc');
  const COL_CT    = alias('ct desecho','ct_desecho','internal damage code (ct1)','ct examen','ct');

  function excelSerialToDate(n){
    const serial = parseFloat(n);
    if(!isFinite(serial)) return null;
    // Excel epoch: 1899-12-30 (handles the 1900 leap-year bug)
    const ms = Math.round((serial - 25569) * 86400000);
    return new Date(ms);
  }

  function parseDateFlex(s){
    if(!s) return null; const str = String(s).trim();
    // Excel serial number (e.g., 45854 or 45854.5)
    if(/^\d{4,6}(\.\d+)?$/.test(str)){
      const d = excelSerialToDate(str);
      if(d && !isNaN(d)) return d;
    }
    const d1=str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if(d1){ const y=+d1[3]; return new Date(y<100?2000+y:y,+d1[2]-1,+d1[1]); }
    const d2=str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);      if(d2){ return new Date(+d2[1],+d2[2]-1,+d2[3]); }
    const d3=str.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);      if(d3){ const y=+d3[3]; return new Date(y<100?2000+y:y,+d3[2]-1,+d3[1]); }
    const d4=str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);  if(d4){ const y=+d4[3]; return new Date(y<100?2000+y:y,+d4[2]-1,+d4[1]); }
    const d = new Date(str); return isNaN(d)? null : d;
  }
  const ddmmyyyy = (d)=>{ const z=n=>String(n).padStart(2,'0'); return `${z(d.getDate())}/${z(d.getMonth()+1)}/${d.getFullYear()}`; };

  // Filtrar a destino Desecho y quedarnos con el último por serie
  const isDesecho = (val)=> /desech|scrap|baja|descarte|disposal/i.test(String(val||''));
  const bySerie = new Map();
  for(const r of rows){
    if(COL_DEST && !isDesecho(r[COL_DEST])) continue;
    const serie = String(r[COL_SERIE]||'').trim(); if(!serie) continue;
    const d = parseDateFlex(r[COL_FECHA]) || new Date(0);
    const prev = bySerie.get(serie);
    if(!prev || d > (parseDateFlex(prev[COL_FECHA])||new Date(0))) bySerie.set(serie, r);
  }
  const items = Array.from(bySerie.values());

  // Poblar filtros
  const selDim = document.getElementById('fDimension');
  const chipsYears = document.getElementById('yearsChips');
  const inpSearch = document.getElementById('fSearch');
  const dims = Array.from(new Set(items.map(r=> String(r[COL_DIM]||'').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  selDim.innerHTML = `<option value="(Todas)">(Todas)</option>` + dims.map(d=>`<option>${d}</option>`).join('');
  const years = Array.from(new Set(items.map(r=> (parseDateFlex(r[COL_FECHA])||new Date(0)).getFullYear()).filter(y=>y>1970))).sort((a,b)=>b-a);
  chipsYears.innerHTML = years.map(y=>`<span class="chip" data-y="${y}">${y}</span>`).join('');
  function currentYearSet(){
    const set = new Set();
    chipsYears.querySelectorAll('.chip.active').forEach(ch=> set.add(parseInt(ch.getAttribute('data-y'),10)));
    return set;
  }
  chipsYears.querySelectorAll('.chip').forEach(ch=> ch.addEventListener('click', ()=>{ ch.classList.toggle('active'); renderList(); }));

  function renderList(){
    const dim = selDim.value;
    const yset = currentYearSet();
    const body = document.getElementById('listBody');
    const q = (inpSearch?.value||'').trim().toLowerCase();
    const arr = items.filter(r=>{
      if(dim && dim!=='(Todas)' && String(r[COL_DIM]||'').trim()!==dim) return false;
      const d = parseDateFlex(r[COL_FECHA]);
      if(yset.size){ const y=d? d.getFullYear():0; if(!yset.has(y)) return false; }
      if(q){ const serie = String(r[COL_SERIE]||'').toLowerCase(); if(!serie.includes(q)) return false; }
      return true;
    }).sort((a,b)=>{
      const da = parseDateFlex(a[COL_FECHA])||new Date(0);
      const db = parseDateFlex(b[COL_FECHA])||new Date(0);
      return db - da;
    });
    body.innerHTML = arr.map(r=>{
      const serie = r[COL_SERIE]||''; const tipo=r[COL_TIPO]||''; const fd = parseDateFlex(r[COL_FECHA]);
      const fecha = fd? ddmmyyyy(fd):'';
      return `<div class="trow" data-serie="${serie.replace(/"/g,'')}">
        <div class="cell">${serie}</div>
        <div class="cell">${tipo}</div>
        <div class="cell">${fecha}</div>
      </div>`;
    }).join('');

    body.querySelectorAll('.trow').forEach(row=> row.addEventListener('click', ()=>{
      const serie = row.getAttribute('data-serie');
      const r = bySerie.get(serie);
      const hdel = COL_HDEL? (r[COL_HDEL]||'-') : '-';
      const htot = COL_HRTOT? (r[COL_HRTOT]||'-') : '-';
      const ct   = COL_CT? (r[COL_CT]||'-') : '-';
      const pos  = COL_POS? (r[COL_POS]||'-') : '-';
      document.getElementById('stHDel').textContent = hdel||'-';
      document.getElementById('stHTot').textContent = htot||'-';
      document.getElementById('stCT').textContent   = ct||'-';
      document.getElementById('stPos').textContent  = pos||'-';
    }));
  }

  selDim.addEventListener('change', renderList);
  if(inpSearch) inpSearch.addEventListener('input', renderList);
  renderList();
})();
