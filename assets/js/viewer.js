// =======================
//  viewer.js – Monitor en tiempo real (WebSocket nativo)
// =======================

const API_BASE = (window.CONFIG && window.CONFIG.API) || `http://${location.hostname}:5500/api`;
const WS_URL   = (window.CONFIG && window.CONFIG.WS)  || `ws://${location.hostname}:5501/ws`;

const $ = s => document.querySelector(s);
const logMov   = $("#logMov");
const logDemo  = $("#logDemo");
const wsStatus = $("#wsStatus");
const MAX = 50;

const pill = (t, cls) => `<span class="badge ${cls} pill text-white" style="min-width:70px">${t}</span>`;
const now  = () => new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"});

function pushLog(list, html, cls=""){
  const li = document.createElement("li");
  li.className = `list-group-item d-flex align-items-center gap-2 ${cls}`;
  li.innerHTML = html + `<span class="text-muted ms-auto">${now()}</span>`;
  list.prepend(li);
  while (list.children.length > MAX) list.removeChild(list.lastChild);
}

// --- Bootstrap inicial (pull) para no ver vacío
async function bootstrapPull(){
  try{
    const [m, d] = await Promise.all([
      fetch(`${API_BASE}/movimientos/ultimos10/1`).then(r=>r.json()).catch(()=>({})),
      fetch(`${API_BASE}/secuencias/demo/ultimas20/1`).then(r=>r.json()).catch(()=>({}))
    ]);

    (m.data?.[0] || []).reverse().forEach(x=>{
      const txt = x.status_texto || (`status ${x.status_clave ?? "?"}`);
      pushLog(logMov, `${pill("MOV","bg-primary")} <strong>${txt}</strong>`);
    });

    (d.data?.[0] || []).reverse().forEach(x=>{
      const name = x.nombre || (`Secuencia #${x.secuencia_id ?? "?"}`);
      pushLog(logDemo, `${pill("DEMO","bg-info")} <strong>${name}</strong>`);
    });
  }catch(_){}
}

// --- WebSocket
let ws, heartbeat;
function connectWS(){
  ws = new WebSocket(WS_URL);
  setWs("Conectando…", "bg-warning");

  ws.onopen = () => {
    setWs("Conectado", "bg-success");
    // heart-beat opcional para mantener viva la conexión
    heartbeat = setInterval(() => { try{ ws.send(JSON.stringify({type:"ping"})); } catch(_){} }, 25000);
  };

  ws.onclose = () => {
    setWs("Desconectado", "bg-secondary");
    clearInterval(heartbeat);
    setTimeout(connectWS, 2500); // reconexión simple
  };

  ws.onerror = (e) => {
    setWs("Error", "bg-danger");
    console.error("[WS] error", e);
  };

  ws.onmessage = (ev) => {
    // Los push del back son JSON; “hello” al conectar y luego broadcasts.
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

    // Por si el back alguna vez manda arreglos
    const items = Array.isArray(msg) ? msg : [msg];
    items.forEach(handlePayload);
  };
}

function setWs(text, cls){
  wsStatus.textContent = text;
  wsStatus.className = `badge ${cls}`;
}

function handlePayload(payload){
  const tipo = payload.type || payload.tipo || "";

  // Ignora hello (puedes mostrarlo si quieres)
  if (tipo === "hello") return;

  // Movimiento
  if (tipo === "movimiento:nuevo" || payload.movimiento_id || payload.status_clave){
    const txt = payload.status_texto || `status ${payload.status_clave ?? "?"}`;
    pushLog(logMov, `${pill("MOV","bg-primary")} <strong>${txt}</strong>`);
    return;
  }

  // Secuencia DEMO creada / reproducida
  if (tipo === "secuencia:demo_creada" || payload.secuencia_id || payload.nombre){
    const name = payload.nombre || (`Secuencia #${payload.secuencia_id ?? "?"}`);
    pushLog(logDemo, `${pill("DEMO","bg-info")} <strong>${name}</strong>`);
    return;
  }

  // Cualquier otro evento: lo mostramos en MOV como genérico
  pushLog(logMov, `${pill("WS","bg-secondary")} <code class="small">${escapeHTML(JSON.stringify(payload))}</code>`);
}

function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// --- Init
window.addEventListener("DOMContentLoaded", () => {
  bootstrapPull();
  connectWS();
});
