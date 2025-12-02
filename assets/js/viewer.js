// =======================
//  viewer.js – Monitor en tiempo real (WebSocket nativo)
// =======================

const API_BASE = (window.CONFIG && window.CONFIG.API) || `http://34.196.181.221:5500/api`;
const WS_URL   = (window.CONFIG && window.CONFIG.WS)  || `ws:34.196.181.221:5501/ws`;

const $ = s => document.querySelector(s);

const logMov   = $("#logMov");
const logDemo  = $("#logDemo");
const logObs   = $("#logObs");
const wsStatus = $("#wsStatus");
const MAX   = 50;  // máximo histórico en la lista
const TOP_N = 5;   // solo mostrar top 5 iniciales

// Mapeo de texto de obstáculos para el monitoreo
const OBST_TEXTO = {
  1: "Adelante",
  2: "Adelante-Izquierda",
  3: "Adelante-Derecha",
  4: "Adelante-Izquierda-Derecha",
  5: "Retrocede"
};

const pill = (t, cls) =>
  `<span class="badge ${cls} pill text-white" style="min-width:70px">${t}</span>`;

const now  = () =>
  new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"});

function pushLog(list, html, cls=""){
  if (!list) return;
  const li = document.createElement("li");
  li.className = `list-group-item d-flex align-items-center gap-2 ${cls}`;
  li.innerHTML = html + `<span class="text-muted ms-auto">${now()}</span>`;
  list.prepend(li);
  while (list.children.length > MAX) list.removeChild(list.lastChild);
}

async function bootstrapPull(){
  try{
    const [m, d, o] = await Promise.all([
      fetch(`${API_BASE}/movimientos/ultimos10/1`).then(r=>r.json()).catch(()=>({})),
      fetch(`${API_BASE}/secuencias/demo/ultimas20/1`).then(r=>r.json()).catch(()=>({})),
      fetch(`${API_BASE}/obstaculos/ultimos10/1`).then(r=>r.json()).catch(()=>({}))
    ]);

    // Movimientos – solo los últimos 5
    (m.data?.[0] || [])
      .slice(0, TOP_N)   // toma solo 5 más recientes
      .reverse()         // para que el más nuevo quede arriba/abajo según tu UX
      .forEach(x=>{
        const txt = x.status_texto || (`status ${x.status_clave ?? "?"}`);
        pushLog(logMov, `${pill("MOV","bg-primary")} <strong>${txt}</strong>`);
      });

    // Secuencias DEMO – solo las últimas 5
    (d.data?.[0] || [])
      .slice(0, TOP_N)
      .reverse()
      .forEach(x=>{
        const name = x.nombre || (`Secuencia #${x.secuencia_id ?? "?"}`);
        pushLog(logDemo, `${pill("DEMO","bg-info")} <strong>${name}</strong>`);
      });

    // Obstáculos – solo los últimos 5
    (o.data?.[0] || [])
      .slice(0, TOP_N)
      .reverse()
      .forEach(x=>{
        const clave = x.obstaculo_clave ?? x.obstaculo_id;
        const txt   = x.obstaculo_texto || OBST_TEXTO[clave] || `Obstáculo ${clave ?? "?"}`;
        const modo  = x.modo ? ` (${x.modo})` : "";
        pushLog(
          logObs,
          `${pill("OBS","bg-warning")} <strong>${txt}</strong>${modo}`
        );
      });

  }catch(e){
    console.error("Error en bootstrapPull", e);
  }
}

// --- WebSocket
let ws, heartbeat;

function connectWS(){
  ws = new WebSocket(WS_URL);
  setWs("Conectando…", "bg-warning");

  ws.onopen = () => {
    setWs("Conectado", "bg-success");
    // heart-beat opcional para mantener viva la conexión
    heartbeat = setInterval(() => {
      try { ws.send(JSON.stringify({type:"ping"})); } catch(_) {}
    }, 25000);
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
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

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

  // Ignora hello/ping
  if (tipo === "hello" || tipo === "pong") return;

  // --- Movimiento en tiempo real ---
  if (tipo === "movimiento:nuevo" || payload.movimiento_id || payload.status_clave){
    const txt = payload.status_texto || `status ${payload.status_clave ?? "?"}`;
    const modo = payload.modo ? ` (${payload.modo})` : "";
    pushLog(logMov, `${pill("MOV","bg-primary")} <strong>${txt}</strong>${modo}`);
    return;
  }

  // --- Secuencia DEMO creada / algo relacionado ---
  if (tipo === "secuencia:demo_creada" || payload.secuencia_id || payload.nombre){
    const name = payload.nombre || (`Secuencia #${payload.secuencia_id ?? "?"}`);
    pushLog(logDemo, `${pill("DEMO","bg-info")} <strong>${name}</strong>`);
    return;
  }

  // --- NUEVO: Obstáculo detectado en tiempo real ---
  if (tipo === "obstaculo:nuevo" || payload.obstaculo_clave != null){
    const clave = payload.obstaculo_clave;
    const txt   = OBST_TEXTO[clave] || `Obstáculo ${clave ?? "?"}`;
    const modo  = payload.modo ? ` (${payload.modo})` : "";
    pushLog(
      logObs,
      `${pill("OBS","bg-warning")} <strong>${txt}</strong>${modo}`
    );
    return;
  }

  // Cualquier otro evento: lo mostramos en movimientos como genérico
  pushLog(
    logMov,
    `${pill("WS","bg-secondary")} <code class="small">${escapeHTML(JSON.stringify(payload))}</code>`
  );
}

function escapeHTML(s){
  return String(s).replace(
    /[&<>"']/g,
    m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])
  );
}

// --- Init ---
window.addEventListener("DOMContentLoaded", () => {
  bootstrapPull();
  connectWS();
});








