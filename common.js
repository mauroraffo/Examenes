// common.js - utilidades compartidas (IndexedDB + CSV autodetect)

// IndexedDB: almacén de dataset
const datasetStore = (function(){
  const DB_NAME = 'klinge-db';
  const DB_VERSION = 1;
  const STORE = 'dataset';

  function open() {
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = ()=>{
        const db = req.result;
        if(!db.objectStoreNames.contains(STORE)){
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function save(data){
    const db = await open();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ id:'current', savedAt: Date.now(), ...data });
      tx.oncomplete = ()=> resolve(true);
      tx.onerror = ()=> reject(tx.error);
    });
  }

  async function load(){
    const db = await open();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get('current');
      req.onsuccess = ()=> resolve(req.result||null);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function clear(){
    const db = await open();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete('current');
      tx.oncomplete = ()=> resolve(true);
      tx.onerror = ()=> reject(tx.error);
    });
  }

  return { open, save, load, clear };
})();

// Helpers de normalización de headers
function normalizeHeader(h){
  if(!h) return '';
  return String(h)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[\s_]+/g,' ')
    .replace(/\s*#\s*/g,'#')
    .trim();
}

// Parse CSV con auto-detección de delimitador
async function parseCSVAuto(file){
  const parseOnce = (delimiter)=> new Promise((resolve)=>{
    Papa.parse(file, { header:true, skipEmptyLines:true, delimiter: delimiter||undefined, complete: (res)=> resolve(res) });
  });
  let res = await parseOnce();
  let fields = res?.meta?.fields||[];
  if(fields.length<2){ res = await parseOnce(';'); fields = res?.meta?.fields||[]; }
  if(fields.length<2){ res = await parseOnce(','); fields = res?.meta?.fields||[]; }
  return { rows: res.data||[], cols: fields, meta: res.meta||{} };
}

// === Tema (presets) compartido en todas las páginas ===
const THEME_KEY = 'theme_preset';
const THEME_CLASS = { dark:'theme-dark', light:'theme-light', gray:'theme-gray', sand:'theme-sand', green:'theme-green' };
function applyTheme(preset){
  const body=document.body; Object.values(THEME_CLASS).forEach(cls=> body.classList.remove(cls));
  body.classList.add(THEME_CLASS[preset] || THEME_CLASS.dark);
  try{ localStorage.setItem(THEME_KEY, preset); }catch{}
}
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    // aplicar tema guardado
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(saved);
    // enlazar UI si existe
    const sel = document.getElementById('themePreset'); if(sel){ sel.value = saved; sel.onchange=()=> applyTheme(sel.value); }
    const btn = document.getElementById('themeBtn'); const panel = document.getElementById('themePanel');
    if(btn && panel){ btn.addEventListener('click', (e)=>{ e.preventDefault(); panel.style.display = panel.style.display==='block' ? 'none' : 'block'; }); }
    document.addEventListener('click', (ev)=>{ const p=document.getElementById('themePanel'); const b=document.getElementById('themeBtn'); if(!p||!b) return; if(p.contains(ev.target) || b.contains(ev.target)) return; p.style.display='none'; });
  });
})();
