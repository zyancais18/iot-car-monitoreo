// =======================
// viewer.js — Monitor (polling SIO opcional) SIN botón
// =======================

const API_BASE   = (window.CONFIG && window.CONFIG.API) || `${location.origin.replace(/\/$/,'')}/api`;
const DEVICE_ID  = (window.CONFIG && window.CONFIG.DEVICE_ID) || 1;
const SIO_BASE       = (window.CONFIG && window.CONFIG.SIO) || window.location.origin;
const SIO_NAMESPACE  = (window.CONFIG && window.CONFIG.SIO_NAMESPACE) || "/ws";
const SIO_EVENT_NAME = (window.CONFIG && window.CONFIG.SIO_EVENT) || "broadcast";

const $ = (s) => document.querySelector(s);
const logMov  = $("#logMov");
const logObs  = $("#logObs");
const logDemo = $("#logDemo");
const MAX = 50;

const pill = (t, cls) => `<span class="badge ${cls} pill text-white" style="min-width:84px">${t}</span>`;
const now  = () => new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"});

function pushLog(list, html, cls=""){
  const li = document.createElement("li");
  li.className = `list-group-item d-flex align-items-center gap-2 ${cls}`;
  li.innerHTML = html + `<span class="text-muted ms-auto">${now()}</span>`;
  list.prepend(li);
  while (list.children.length > MAX) list.removeChild(list.lastChild);
}

async function apiGet(path){
  const res = await fetch(`${API_BASE}${path}`);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// --- Carga inicial (para que no quede vacío antes del 1er refresh) ---
async function bootstrapPull(){
  try{
    const [m, o, d] = await Promise.all([
      apiGet(`/movimientos/ultimos10/${DEVICE_ID}`).catch(()=>({})),
      apiGet(`/obstaculo/ultimos10/${DEVICE_ID}`).catch(()=>({})),
      apiGet(`/secuencias/demo/ultimas20/${DEVICE_ID}`).catch(()=>({}))
    ]);

    (m.data?.[0]||[]).reverse().forEach(x=>{
      const txt = x.status_texto || `status ${x.status_clave}`;
      pushLog(logMov, `${pill("MOV","bg-primary")} <strong>${txt}</strong>`);
    });

    (o.data?.[0]||[]).reverse().forEach(x=>{
      const txt = x.obstaculo_texto || x.status_texto || `obs ${x.obstaculo_clave ?? x.status_clave ?? "?"}`;
      pushLog(logObs, `${pill("OBS","bg-danger")} <strong>${txt}</strong>`);
    });

    (d.data?.[0]||[]).reverse().forEach(x=>{
      const nombre = x.nombre || `Secuencia #${x.secuencia_id ?? "?"}`;
      pushLog(logDemo, `${pill("DEMO","bg-info")} <strong>${nombre}</strong>`);
    });
  }catch(e){
    console.warn("[bootstrapPull]", e.message);
  }
}

// --- Socket.IO opcional (no necesario con auto-refresh, lo dejamos por compatibilidad) ---
let sio = null;
function connectSIO(){
  sio = io(`${SIO_BASE}${SIO_NAMESPACE}`, {
    transports: ["polling"],
    withCredentials: false
  });
  sio.on("connect", ()=> console.log("[SIO] conectado:", sio.id));
  sio.on("disconnect", (reason)=> console.log("[SIO] desconectado:", reason));
  sio.on(SIO_EVENT_NAME, (payload)=>{
    try{
      const arr = Array.isArray(payload) ? payload : [payload];
      arr.forEach((msg)=>routePush(msg));
    }catch(e){ console.warn("[push parse]", e.message); }
  });
}

function routePush(p){
  const tipo = (p.type || p.tipo || "").toLowerCase();
  if (tipo.startsWith("movimiento") || p.movimiento_id || p.status_clave){
    const txt = p.status_texto || `status ${p.status_clave ?? "?"}`;
    pushLog(logMov, `${pill("MOV","bg-primary")} <strong>${txt}</strong>`);
    return;
  }
  if (tipo.includes("obstaculo") || p.obstaculo_id || p.obstaculo_clave || tipo.includes("evasion")){
    const txt = p.obstaculo_texto || p.status_texto || `obs ${p.obstaculo_clave ?? p.status_clave ?? "?"}`;
    pushLog(logObs, `${pill("OBS","bg-danger")} <strong>${txt}</strong>`);
    return;
  }
  if (tipo.includes("secuencia:demo") || p.secuencia_id || p.nombre){
    const nombre = p.nombre || `Secuencia #${p.secuencia_id ?? "?"}`;
    pushLog(logDemo, `${pill("DEMO","bg-info")} <strong>${nombre}</strong>`);
    return;
  }
}

// --- INIT ---
window.addEventListener("DOMContentLoaded", ()=>{
  bootstrapPull();
  // Si no quieres usar SIO con auto-refresh, comenta la siguiente línea:
  // connectSIO();
});
