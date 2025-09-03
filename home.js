// home.js - manejo del Home (cargar CSV en IndexedDB)

const $H = (q)=>document.querySelector(q);
function toastHome(msg){ const t=$H('#toast'); if(!t) return; t.textContent=msg; t.style.display='block'; setTimeout(()=>t.style.display='none',2000); }

async function refreshStatus(){
  try{
    const ds = await datasetStore.load();
    const st = $H('#dsStatus');
    if(!st) return;
    if(ds && ds.rows){ st.textContent = `Dataset cargado: ${ds.rows.length} filas`; }
    else { st.textContent = 'Sin dataset cargado'; }
  }catch{ /* no-op */ }
}

document.addEventListener('DOMContentLoaded', ()=>{
  const file = $H('#csvHome');
  if(file){
    file.addEventListener('change', async (e)=>{
      const f = e.target.files[0]; if(!f) return;
      try{
        const parsed = await parseCSVAuto(f);
        await datasetStore.save(parsed);
        toastHome('CSV guardado en el dispositivo');
        refreshStatus();
      }catch(err){ console.error(err); alert('No se pudo cargar el CSV'); }
    });
  }
  $H('#btnClearDS')?.addEventListener('click', async ()=>{
    if(!confirm('¿Borrar dataset local?')) return;
    await datasetStore.clear();
    toastHome('Dataset borrado');
    refreshStatus();
  });
  // Proteger navegación si no hay dataset
  document.querySelectorAll('[data-need-ds="1"]').forEach(el=>{
    el.addEventListener('click', async (ev)=>{
      const ds = await datasetStore.load();
      if(!(ds && ds.rows && ds.cols)){
        ev.preventDefault(); alert('Primero carga el CSV en Inicio.');
      }
    });
  });
  refreshStatus();
});

