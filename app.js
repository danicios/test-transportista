// Test Transportista — web estática. Datos en data/datos.js (window.DATOS), generado por preparar_web.py
// preguntas: [tema, enunciado, [A,B,C,D], correcta(0-3), norma, codigo]
// explicaciones: { codigo: { p, c, e, a? } }
// temario: [{ id: "1E03", tema, titulo, md, preguntas }]
// Progreso: con sesión iniciada, cada respuesta se guarda en Supabase (tabla respuestas, ver supabase.sql).

const TEMAS = ["Derecho civil", "Derecho mercantil", "Derecho social", "Derecho fiscal",
  "Gestión comercial y financiera", "Acceso al mercado", "Normas y formalidades técnicas", "Seguridad vial"];
const LETRAS = "ABCD";
const TAMANOS = [10, 25, 50, 100];

let PREG = [], EXPL = {}, TEMARIO = [], test = null, tamano = 25, modoTest = "todas";  // modoTest: "todas" | "nuevas" | "fallos"
const app = document.getElementById("app");

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const barajar = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sinTildes = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const miles = n => n.toLocaleString("es-ES", { useGrouping: true });

// Iconos (trazo, heredan color)
const ico = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  ok: ico('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  ko: ico('<path d="M6 6l12 12M18 6L6 18"/>'),
  chev: ico('<path d="M9 6l6 6-6 6"/>').replace("<svg", '<svg class="chev"'),
  atras: ico('<path d="M15 6l-6 6 6 6"/>'),
  lupa: ico('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'),
  libro: ico('<path d="M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5zM20 5.5A1.5 1.5 0 0018.5 4H13v16h5.5a1.5 1.5 0 001.5-1.5z"/>'),
  play: ico('<path d="M8 5.5v13l10-6.5z"/>'),
  aviso: ico('<path d="M12 4l9 16H3zM12 10v4M12 17.5v.01"/>'),
  diana: ico('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".5"/>'),
};

/* ---------- Progreso (Supabase, un solo usuario con enlace privado) ---------- */
// Sin usuario ni contraseña: una clave privada que llega en el enlace personal (#clave=...) y se guarda en el
// navegador. En Supabase sólo hay funciones que exigen esa clave (ver supabase.sql).
// PROG: codigo -> { a: aciertos, f: fallos, p: pendiente (por repasar), r: aciertos seguidos desde el último fallo }
// Una pregunta fallada sale de "por repasar" al acertarla 2 veces seguidas (igual que la función registrar de supabase.sql).
const ACIERTOS_PARA_SALIR = 2;
let sb = null, conectado = false, PROG = new Map(), progresoCargado = false, subiendo = false;
const CLAVE = "tt-clave", COLA = "tt-cola";  // clave privada y respuestas aún no subidas (p. ej. sin conexión)
const leerLS = (k, def) => { try { return localStorage.getItem(k) ?? def; } catch { return def; } };
const escribirLS = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
const leerCola = () => { try { return JSON.parse(leerLS(COLA, "[]")); } catch { return []; } };
const guardarCola = c => escribirLS(COLA, JSON.stringify(c));
const clave = () => leerLS(CLAVE, "");
const pendientes = () => PREG.filter(q => PROG.get(q[5])?.p);

function iniciarCuenta() {
  // ¿Se ha abierto el enlace personal? (#clave=...) → se guarda y se quita de la barra de direcciones
  const m = location.hash.match(/^#clave=([\w-]+)/);
  if (m) { escribirLS(CLAVE, m[1]); history.replaceState(null, "", location.pathname + location.search + "#inicio"); }
  const cfg = window.CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.startsWith("TU_")) return;
  sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, { auth: { persistSession: false } });
  window.addEventListener("online", subirCola);
  if (clave()) { conectado = true; marcarCuenta(); cargarProgreso(m ? "Dispositivo vinculado: tus fallos se guardarán." : ""); }
}

async function cargarProgreso(aviso) {
  PROG.clear(); progresoCargado = false;
  try {
    for (let desde = 0; ; desde += 1000) {  // Supabase devuelve como mucho 1000 filas por consulta
      const { data, error } = await sb.rpc("mi_progreso", { p_clave: clave() }).range(desde, desde + 999);
      if (error) {
        if (/Clave incorrecta/.test(error.message)) { desvincular(); return toast("El enlace no es válido. Vuelve a abrir tu enlace personal."); }
        toast("No se pudo cargar tu progreso: " + error.message); break;
      }
      data.forEach(r => PROG.set(r.codigo, { a: r.aciertos, f: r.fallos, p: r.pendiente, r: r.racha ?? 0 }));
      if (data.length < 1000) break;
    }
  } catch { toast("Sin conexión: tus respuestas se guardarán cuando vuelva internet."); }
  leerCola().forEach(r => aplicar(r.codigo, r.ok));  // respuestas hechas sin conexión que aún no se subieron
  progresoCargado = true; marcarCuenta(); refrescar();
  if (aviso) toast(aviso);
  subirCola();
}

function desvincular() { escribirLS(CLAVE, null); conectado = false; PROG.clear(); progresoCargado = false; marcarCuenta(); refrescar(); }

function aplicar(codigo, ok) {
  const r = PROG.get(codigo) || { a: 0, f: 0, p: false, r: 0 };
  if (ok) { r.a++; r.r = (r.r || 0) + 1; r.p = r.p && r.r < ACIERTOS_PARA_SALIR; }
  else { r.f++; r.r = 0; r.p = true; }
  PROG.set(codigo, r);
}

function registrar(codigo, ok) {
  if (!conectado) return;
  aplicar(codigo, ok);
  guardarCola([...leerCola(), { codigo, ok }]);
  subirCola();
}

async function subirCola() {
  if (!conectado || subiendo) return;
  subiendo = true;
  try {
    let cola = leerCola();
    while (cola.length) {
      const { error } = await sb.rpc("registrar", { p_clave: clave(), p_codigo: cola[0].codigo, p_ok: cola[0].ok });
      if (error) { if (navigator.onLine) toast("No se pudo guardar una respuesta: " + error.message); break; }
      cola = leerCola().slice(1); guardarCola(cola);
    }
  } catch { /* sin conexión: se reintenta al volver la red */ }
  subiendo = false;
}

// Repinta la vista actual salvo en mitad de un test
function refrescar() { if (location.hash !== "#test") router(); }
function marcarCuenta() { document.querySelector(".nav-cuenta")?.classList.toggle("conectado", conectado); }

let toastT;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("ver");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("ver"), 3500);
}

function vistaCuenta() {
  if (!sb) return pintar(`
    <section class="hero"><div class="eyebrow">Progreso</div><h1>Guardar tus fallos</h1>
      <p class="sub">${window.supabase ? "La conexión con Supabase aún no está configurada (web/config.js)."
        : "No hay conexión a internet: puedes hacer tests, pero no se guardarán tus fallos."}</p></section>`);
  if (conectado) return vistaProgreso();
  pintar(`
    <section class="hero"><div class="eyebrow">Progreso</div><h1>Vincula este dispositivo</h1>
      <p class="sub">Abre tu <b>enlace personal</b> en este dispositivo (una sola vez) y tus fallos se guardarán aquí y en los demás.
        También puedes pegar tu clave privada:</p></section>
    <div class="card">
      <form id="f-clave" class="form-cuenta">
        <label class="campo">Clave privada<input type="password" id="c-clave" autocomplete="off" required></label>
        <div class="acciones"><button class="btn primario" type="submit">Vincular</button></div>
      </form>
    </div>`);
  document.getElementById("f-clave").onsubmit = e => {
    e.preventDefault();
    escribirLS(CLAVE, document.getElementById("c-clave").value.trim().replace(/^.*#clave=/, ""));
    conectado = true; marcarCuenta(); location.hash = "inicio";
    cargarProgreso("Dispositivo vinculado: tus fallos se guardarán.");
  };
}

function vistaFallos() {
  if (!conectado) { location.hash = "progreso"; return; }
  const pend = pendientes().sort((x, y) => PROG.get(y[5]).f - PROG.get(x[5]).f);
  pintar(`
    <section class="hero"><div class="eyebrow">Mis fallos</div><h1>Preguntas por repasar</h1>
      <p class="sub">Las que has fallado. Para que una salga de esta lista tienes que acertarla ${ACIERTOS_PARA_SALIR} veces seguidas.</p></section>
    ${!progresoCargado ? `<p class="vacio">Cargando tu progreso…</p>` : !pend.length
      ? `<div class="card"><p class="vacio">No tienes fallos pendientes. ¡Bien hecho!</p></div>` : `
    <div class="card">
      <div class="form">
        <label class="campo">Tema
          <select id="fa-tema"><option value="-1">Todos los temas (${pend.length})</option>
            ${TEMAS.map((t, i) => { const n = pend.filter(q => q[0] === i).length;
              return n ? `<option value="${i}">${i + 1}. ${t} (${n})</option>` : ""; }).join("")}</select></label>
        <button class="btn primario" id="fa-test">${I.play}Test de fallos</button>
      </div>
    </div>
    <div class="card" id="fa-lista"></div>`}`);
  if (!pend.length) return;
  const sel = document.getElementById("fa-tema");
  const lista = () => {
    const tm = +sel.value, qs = pend.filter(q => tm < 0 || q[0] === tm);
    document.getElementById("fa-lista").innerHTML = `<h2>${qs.length} pregunta${qs.length === 1 ? "" : "s"}</h2>` +
      qs.slice(0, 200).map(q => fichaPregunta(q, undefined, PROG.get(q[5]))).join("") +
      (qs.length > 200 ? `<p class="vacio">Mostrando las 200 más falladas.</p>` : "");
  };
  sel.onchange = lista; lista();
  document.getElementById("fa-test").onclick = () => empezar(+sel.value, tamano, "fallos");
}

function cargar() {
  // data/datos.js (generado por preparar_web.py) define window.DATOS; así la web abre con doble clic, sin servidor
  if (!window.DATOS) {
    app.innerHTML = `<div class="card"><h2>No se encontraron los datos</h2>
      <p>Falta <code>data/datos.js</code>. Ejecuta <code>python preparar_web.py</code> en la carpeta del proyecto.</p></div>`;
    return;
  }
  PREG = DATOS.preguntas; EXPL = DATOS.explicaciones; TEMARIO = DATOS.temario || [];
  iniciarCuenta();
  window.addEventListener("hashchange", router);
  router();
}

// Pinta una vista con una entrada suave (sólo al navegar, no en acciones repetitivas)
function pintar(html) {
  app.classList.remove("entrar", "teclado");
  tooltipProg?.classList.remove("ver");
  app.innerHTML = html;
  void app.offsetWidth;  // reinicia la animación
  app.classList.add("entrar");
  window.scrollTo(0, 0);
}

function router() {
  const [vista, arg] = (location.hash.slice(1) || "inicio").split("/");
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("activo", a.dataset.nav === vista));
  if (vista === "test" && test) return pintarPregunta(true);
  if (vista === "buscar") return vistaBuscar();
  if (vista === "progreso" || vista === "cuenta") return vistaCuenta();
  if (vista === "fallos") return vistaFallos();
  if (vista === "temario") return arg === undefined ? vistaTemario() : vistaTemaTemario(+arg);
  vistaInicio();
}

/* ---------- Progreso: gráficas por día y por tema ---------- */
// HIST: filas de mi_historial { dia: "AAAA-MM-DD", tema: "1A".."1H", aciertos, fallos } (agregadas en Supabase)
let HIST = null, rangoProg = 30, tooltipProg = null;
const RANGOS = [[7, "7 días"], [30, "30 días"], [0, "Todo"]];
const fechaISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fechaCorta = iso => new Date(iso + "T12:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });

async function cargarHistorial() {
  await subirCola();  // que entren las últimas respuestas antes de leer
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.rpc("mi_historial", { p_clave: clave() }).range(desde, desde + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

function vistaProgreso() {
  const vals = [...PROG.values()], a = vals.reduce((s, r) => s + r.a, 0), f = vals.reduce((s, r) => s + r.f, 0);
  const pend = pendientes().length;
  pintar(`
    <section class="hero"><div class="eyebrow">Progreso</div><h1>Tu evolución</h1>
      <p class="sub">Cómo te va día a día y en qué temas fallas más.</p></section>
    <div class="card">
      <div class="kpis kpis-4">
        <div class="kpi"><b>${miles(PROG.size)}</b><span>preguntas vistas</span></div>
        <div class="kpi"><b style="color:var(--ok)">${miles(a)}</b><span>aciertos</span></div>
        <div class="kpi"><b style="color:var(--ko)">${miles(f)}</b><span>fallos</span></div>
        <div class="kpi"><b>${miles(pend)}</b><span>por repasar</span></div>
      </div>
    </div>
    <div class="card">
      <div class="prog-cab"><h2 style="margin:0">Por día</h2>
        <div class="segmento" role="radiogroup">${RANGOS.map(([n, t]) =>
          `<button role="radio" aria-checked="${n === rangoProg}" class="${n === rangoProg ? "on" : ""}" data-rango="${n}">${t}</button>`).join("")}</div></div>
      <div class="graf-titulo">% de acierto</div>
      <div class="grafico" id="g-acierto"><p class="vacio">Cargando…</p></div>
      <div class="graf-titulo">Respuestas <span class="ley"><i style="background:var(--ok)"></i>Aciertos <i style="background:var(--ko)"></i>Fallos</span></div>
      <div class="grafico" id="g-volumen"></div>
    </div>
    <div class="card"><h2>Por tema <span class="norma" style="font-weight:400" id="prog-rango"></span></h2><div id="prog-temas"></div></div>
    <div class="acciones" style="justify-content:center">
      ${pend ? `<a class="btn" href="#fallos">${I.diana}Mis fallos</a>` : ""}
      <button class="btn fantasma" id="desvincular">Desvincular este dispositivo</button>
    </div>`);
  document.getElementById("desvincular").onclick = () => {
    if (confirm("¿Desvincular este dispositivo? Tus fallos siguen guardados; para volver a vincularlo abre otra vez tu enlace personal.")) desvincular();
  };
  app.querySelectorAll("[data-rango]").forEach(b => b.onclick = () => {
    rangoProg = +b.dataset.rango;
    app.querySelectorAll("[data-rango]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); });
    pintarGraficas();
  });
  if (HIST) pintarGraficas();
  cargarHistorial().then(h => { HIST = h; if (document.getElementById("g-acierto")) pintarGraficas(); })
    .catch(e => { const g = document.getElementById("g-acierto"); if (g && !HIST) g.innerHTML = `<p class="vacio">No se pudo cargar el historial (${esc(e.message || e)}).</p>`; });
}

// Días del periodo elegido, con aciertos/fallos totales y por tema
function datosPeriodo() {
  const hoy = new Date(), porDia = new Map();
  HIST.forEach(r => {
    const d = porDia.get(r.dia) || { a: 0, f: 0 };
    d.a += +r.aciertos; d.f += +r.fallos; porDia.set(r.dia, d);
  });
  let inicio = new Date(hoy); inicio.setDate(hoy.getDate() - ((rangoProg || 1) - 1));
  if (!rangoProg) { const primero = HIST.map(r => r.dia).sort()[0]; inicio = primero ? new Date(primero + "T12:00") : hoy; }
  const dias = [];
  for (const d = new Date(inicio); fechaISO(d) <= fechaISO(hoy); d.setDate(d.getDate() + 1)) {
    const iso = fechaISO(d); dias.push({ iso, ...(porDia.get(iso) || { a: 0, f: 0 }) });
  }
  const desde = dias[0]?.iso || fechaISO(hoy);
  const temas = TEMAS.map((nombre, i) => ({ i, nombre, a: 0, f: 0 }));
  HIST.filter(r => r.dia >= desde).forEach(r => {
    const t = temas["ABCDEFGH".indexOf(r.tema[1])]; if (t) { t.a += +r.aciertos; t.f += +r.fallos; }
  });
  return { dias, temas };
}

function pintarGraficas() {
  const gA = document.getElementById("g-acierto"), gV = document.getElementById("g-volumen");
  if (!gA || !HIST) return;
  const { dias, temas } = datosPeriodo();
  document.getElementById("prog-rango").textContent = rangoProg ? `· últimos ${rangoProg} días` : "· desde el principio";
  if (!dias.some(d => d.a + d.f)) {
    gA.innerHTML = `<p class="vacio">Aún no hay respuestas en este periodo.</p>`; gV.innerHTML = "";
  } else {
    gA.innerHTML = graficoLinea(dias, gA.clientWidth);
    gV.innerHTML = graficoBarras(dias, gV.clientWidth);
    [gA, gV].forEach(g => activarTooltip(g, dias));
  }
  pintarTemasProgreso(temas);
}

// Geometría común: margen izquierdo para el eje, una columna por día
function ejeX(n, W) { const l = 34, r = 8, paso = (W - l - r) / n; return { l, r, paso, x: i => l + (i + .5) * paso }; }
function etiquetasX(dias, ex, H) {
  const idx = dias.length <= 7 ? dias.map((_, i) => i) : [0, Math.floor((dias.length - 1) / 2), dias.length - 1];
  return [...new Set(idx)].map(i => `<text x="${ex.x(i)}" y="${H - 6}" class="g-eje" text-anchor="middle">${fechaCorta(dias[i].iso)}</text>`).join("");
}

function graficoLinea(dias, W) {
  const H = 170, t = 10, b = 24, ex = ejeX(dias.length, W), y = v => t + (1 - v / 100) * (H - t - b);
  const grid = [0, 50, 100].map(v => `<line x1="${ex.l}" x2="${W - ex.r}" y1="${y(v)}" y2="${y(v)}" class="g-grid"/>
    <text x="${ex.l - 6}" y="${y(v) + 4}" class="g-eje" text-anchor="end">${v}%</text>`).join("");
  const pts = dias.map((d, i) => d.a + d.f ? [ex.x(i), y(d.a / (d.a + d.f) * 100)] : null).filter(Boolean);
  const linea = pts.length > 1 ? `<polyline points="${pts.map(p => p.join(",")).join(" ")}" class="g-linea"/>` : "";
  const puntos = pts.map(([px, py]) => `<circle cx="${px}" cy="${py}" r="4" class="g-punto"/>`).join("");
  return `<svg width="${W}" height="${H}" role="img" aria-label="Porcentaje de acierto por día">${grid}${linea}${puntos}
    ${etiquetasX(dias, ex, H)}<line class="g-cruz" y1="${t}" y2="${H - b}" x1="0" x2="0"/></svg>`;
}

function graficoBarras(dias, W) {
  const H = 150, t = 10, b = 24, ex = ejeX(dias.length, W);
  const max = Math.max(...dias.map(d => d.a + d.f)), tope = Math.max(4, Math.ceil(max / 4) * 4);
  const y = v => t + (1 - v / tope) * (H - t - b), ancho = Math.max(2, Math.min(26, ex.paso * .62));
  const grid = [0, tope / 2, tope].map(v => `<line x1="${ex.l}" x2="${W - ex.r}" y1="${y(v)}" y2="${y(v)}" class="g-grid"/>
    <text x="${ex.l - 6}" y="${y(v) + 4}" class="g-eje" text-anchor="end">${v}</text>`).join("");
  const barras = dias.map((d, i) => {
    if (!(d.a + d.f)) return "";
    const x0 = ex.x(i) - ancho / 2, hA = y(0) - y(d.a), hF = y(0) - y(d.f), sep = d.a && d.f ? 2 : 0;
    return `${d.a ? `<rect x="${x0}" y="${y(d.a)}" width="${ancho}" height="${hA}" rx="2" fill="var(--ok)"/>` : ""}
      ${d.f ? `<rect x="${x0}" y="${y(d.a) - hF - sep}" width="${ancho}" height="${Math.max(hF, 1)}" rx="2" fill="var(--ko)"/>` : ""}`;
  }).join("");
  return `<svg width="${W}" height="${H}" role="img" aria-label="Aciertos y fallos por día">${grid}${barras}
    ${etiquetasX(dias, ex, H)}<line class="g-cruz" y1="${t}" y2="${H - b}" x1="0" x2="0"/></svg>`;
}

// Tooltip compartido: al pasar por un día muestra fecha, % de acierto, aciertos y fallos
function activarTooltip(g, dias) {
  const svg = g.querySelector("svg"), cruz = svg.querySelector(".g-cruz"), ex = ejeX(dias.length, svg.width.baseVal.value);
  if (!tooltipProg) { tooltipProg = document.createElement("div"); tooltipProg.className = "g-tooltip"; document.body.appendChild(tooltipProg); }
  const ocultar = () => { tooltipProg.classList.remove("ver"); cruz.style.opacity = 0; };
  const mover = e => {
    const r = svg.getBoundingClientRect(), i = Math.floor((e.clientX - r.left - ex.l) / ex.paso);
    if (i < 0 || i >= dias.length) return ocultar();
    const d = dias[i], tot = d.a + d.f;
    cruz.setAttribute("x1", ex.x(i)); cruz.setAttribute("x2", ex.x(i)); cruz.style.opacity = 1;
    tooltipProg.innerHTML = `<b>${fechaCorta(d.iso)}</b>${tot ? `${Math.round(d.a / tot * 100)}% de acierto<br>
      <span class="t-ok">✓ ${d.a}</span> · <span class="t-ko">✗ ${d.f}</span>` : "Sin respuestas"}`;
    tooltipProg.style.left = Math.min(Math.max(r.left + ex.x(i), 80), innerWidth - 80) + "px";
    tooltipProg.style.top = (r.top + scrollY - 8) + "px";
    tooltipProg.classList.add("ver");
  };
  svg.addEventListener("pointermove", mover);
  svg.addEventListener("pointerdown", mover);
  svg.addEventListener("pointerleave", ocultar);
}

function pintarTemasProgreso(temas) {
  const con = temas.filter(t => t.a + t.f).sort((x, y) => x.a / (x.a + x.f) - y.a / (y.a + y.f));
  const sin = temas.filter(t => !(t.a + t.f));
  document.getElementById("prog-temas").innerHTML = (con.map(t => {
    const tot = t.a + t.f, pct = Math.round(t.a / tot * 100);
    return `<div class="pt-fila">
        <div class="pt-cab"><span class="num-tema">${t.i + 1}</span><span class="pt-nombre">${t.nombre}</span>
          <span class="pt-pct">${pct}% acierto</span></div>
        <div class="barra-avance"><i style="width:${pct}%;background:var(--ok)"></i><i style="width:${100 - pct}%;background:var(--ko)"></i></div>
        <div class="tema-meta">${miles(t.f)} fallo${t.f === 1 ? "" : "s"} de ${miles(tot)} respuestas</div>
      </div>`;
  }).join("") || `<p class="vacio">Aún no hay respuestas en este periodo.</p>`) +
    (sin.length && con.length ? `<p class="norma">Sin respuestas en este periodo: ${sin.map(t => t.nombre).join(", ")}.</p>` : "");
}

let redimT;
window.addEventListener("resize", () => {
  clearTimeout(redimT);
  redimT = setTimeout(() => { if (/^#(progreso|cuenta)/.test(location.hash)) pintarGraficas(); }, 150);
});

/* ---------- Inicio ---------- */
function tarjetaTema(i, modo) {
  const n = PREG.filter(q => q[0] === i).length, eps = TEMARIO.filter(e => e.tema === i).length;
  const estudiar = eps ? `<a class="btn mini" href="#temario/${i}">${I.libro}Temario</a>` : "";
  const acciones = modo === "temario"
    ? (eps ? `<a class="btn mini primario" href="#temario/${i}">${I.libro}Estudiar</a>` : "")
    : `<button class="btn mini" data-tema="${i}">${I.play}Practicar</button>${estudiar}`;
  return `<div class="tema">
      <div class="tema-cab"><span class="num-tema">${i + 1}</span>
        <div><div class="tema-nombre">${TEMAS[i]}</div>
          <div class="tema-meta">${miles(n)} preguntas${eps ? ` · ${eps} epígrafes` : ""}</div></div></div>
      ${avanceTema(i, n)}
      ${modo === "temario" && !eps ? `<div><span class="insignia gris">Pendiente</span></div>` : ""}
      <div class="acciones">${acciones}</div></div>`;
}

function vistaInicio() {
  const cuenta = TEMAS.map((_, i) => PREG.filter(q => q[0] === i).length), pend = pendientes();
  pintar(`
    <section class="hero">
      <div class="eyebrow">Examen de competencia profesional</div>
      <h1>Prepara el examen de transportista</h1>
      <p class="sub">Preguntas oficiales con la respuesta explicada y un ejemplo práctico. Practica por temas y repasa el temario.</p>
      <div class="stats">
        <span class="chip"><b>${miles(PREG.length)}</b> preguntas</span>
        <span class="chip"><b>${TEMAS.length}</b> temas</span>
        <span class="chip"><b>${TEMARIO.length}</b> epígrafes de temario</span>
      </div>
    </section>
    <div class="card">
      <h2>Nuevo test</h2>
      <div class="form">
        <label class="campo">Tema
          <select id="f-tema"><option value="-1">Todos los temas</option>
            ${TEMAS.map((t, i) => `<option value="${i}">${i + 1}. ${t} (${miles(cuenta[i])})</option>`).join("")}</select></label>
        <div class="campo">Preguntas
          <div class="segmento" role="radiogroup">${TAMANOS.map(n =>
            `<button role="radio" aria-checked="${n === tamano}" class="${n === tamano ? "on" : ""}" data-n="${n}">${n}</button>`).join("")}</div></div>
      </div>
      ${conectado ? `<div class="campo" style="margin-top:14px">Qué preguntas
        <div class="segmento" id="f-modo" role="radiogroup">${[["todas", "Todas", ""], ["nuevas", "No vistas", PREG.length - PROG.size],
          ["fallos", "Falladas", pend.length]].map(([m, txt, n]) => `<button role="radio" aria-checked="${m === modoTest}"
            class="${m === modoTest ? "on" : ""}" data-modo="${m}">${txt}${n !== "" ? ` <span class="seg-n">${miles(n)}</span>` : ""}</button>`).join("")}</div></div>` : ""}
      <div class="acciones"><button class="btn primario" id="empezar">${I.play}Empezar test</button></div>
    </div>
    ${conectado ? graficoAvance(pend.length) : sb ? `<div class="card fila-fallos">
        <span class="fallos-ico">${I.diana}</span>
        <div><h2 style="margin:0">Guarda tus fallos</h2>
          <div class="norma" style="margin:2px 0 0">Abre tu enlace personal en este dispositivo para guardar las preguntas que falles.</div></div>
        <a class="btn" href="#progreso">Vincular</a>
      </div>` : ""}
    <h2 style="margin-top:28px">Temas</h2>
    <div class="temas-grid">${TEMAS.map((_, i) => tarjetaTema(i)).join("")}</div>`);
  // segmentos: número de preguntas y (con progreso) qué preguntas
  const segmento = (sel, alElegir) => app.querySelectorAll(sel).forEach(b => b.onclick = () => {
    alElegir(b);
    b.parentNode.querySelectorAll("button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); });
  });
  segmento("[data-n]", b => tamano = +b.dataset.n);
  segmento("[data-modo]", b => modoTest = b.dataset.modo);
  const modo = () => conectado ? modoTest : "todas";
  document.getElementById("empezar").onclick = () => empezar(+document.getElementById("f-tema").value, tamano, modo());
  app.querySelectorAll("[data-tema]").forEach(b => b.onclick = () => empezar(+b.dataset.tema, tamano, modo()));
}

// Barra de avance de un tema: acertadas / por repasar / sin responder + % respondido y % de acierto
function avanceTema(i, n) {
  if (!conectado || !progresoCargado) return "";
  const qs = PREG.filter(q => q[0] === i), vistas = qs.filter(q => PROG.has(q[5])).length;
  const mal = qs.filter(q => PROG.get(q[5])?.p).length, bien = vistas - mal;
  const pc = x => x / n * 100, acierto = vistas ? Math.round(bien / vistas * 100) : 0;
  return `<div class="tema-avance" title="Acertadas ${bien} · Por repasar ${mal} · Sin responder ${n - vistas}">
      <div class="barra-avance"><i style="width:${pc(bien)}%;background:var(--ok)"></i><i style="width:${pc(mal)}%;background:var(--ko)"></i></div>
      <div class="tema-meta">${vistas ? `<b>${Math.round(pc(vistas))}%</b> respondido · <b>${acierto}%</b> acierto` : "Sin empezar"}</div>
    </div>`;
}

// Tarjeta "Tu avance": anillo con acertadas / por repasar / sin responder + leyenda con cifras
function graficoAvance(nPend) {
  if (!progresoCargado) return `<div class="card"><h2 style="margin:0">Tu avance</h2><p class="norma">Cargando tu progreso…</p></div>`;
  const total = PREG.length, vistas = PREG.filter(q => PROG.has(q[5])).length, sin = total - vistas, bien = vistas - nPend;
  const segs = [
    { n: bien, color: "var(--ok)", txt: "Acertadas" },
    { n: nPend, color: "var(--ko)", txt: "Por repasar" },
    { n: sin, color: "var(--line-strong)", txt: "Sin responder" },
  ];
  // anillo SVG: cada porción es un arco (stroke-dasharray) con 2px de separación entre porciones
  const R = 42, C = 2 * Math.PI * R, hueco = segs.filter(s => s.n).length > 1 ? 2 : 0;
  let acum = 0;
  const arcos = segs.map(s => {
    const largo = s.n / total * C, d = Math.max(largo - hueco, 0);
    const arco = s.n ? `<circle r="${R}" cx="50" cy="50" fill="none" stroke="${s.color}" stroke-width="12"
      stroke-dasharray="${d} ${C - d}" stroke-dashoffset="${-acum}"><title>${s.txt}: ${miles(s.n)} (${Math.round(s.n / total * 100)}%)</title></circle>` : "";
    acum += largo; return arco;
  }).join("");
  const pct = Math.round(vistas / total * 100);
  return `<div class="card avance">
      <svg class="donut" viewBox="0 0 100 100" role="img" aria-label="Respondidas ${miles(vistas)} de ${miles(total)}">
        <g transform="rotate(-90 50 50)">${arcos}</g>
        <text x="50" y="49" class="donut-num">${pct}%</text><text x="50" y="62" class="donut-txt">respondidas</text>
      </svg>
      <div class="avance-info">
        <h2 style="margin:0 0 10px">Tu avance</h2>
        <ul class="leyenda">${segs.map(s => `<li><i style="background:${s.color}"></i>${s.txt}<b>${miles(s.n)}</b></li>`).join("")}</ul>
        <div class="acciones" style="margin-top:14px">
          ${nPend ? `<a class="btn" href="#fallos">${I.diana}Repasar fallos (${miles(nPend)})</a>` : ""}
        </div>
      </div>
    </div>`;
}

// tema: -1 = todos, 0-7 = un tema, o un código de epígrafe ("1E03") para preguntas de ese epígrafe
// modo: "todas", "nuevas" (nunca respondidas) o "fallos" (por repasar)
function empezar(tema, num, modo = "todas") {
  const pool = barajar(PREG.filter(q => (typeof tema === "string" ? q[5].startsWith(tema) : tema < 0 || q[0] === tema)
    && (modo === "fallos" ? PROG.get(q[5])?.p : modo === "nuevas" ? !PROG.has(q[5]) : true)));
  if (!pool.length) return toast(modo === "fallos" ? "No tienes fallos pendientes en ese tema."
    : modo === "nuevas" ? "¡Ya has respondido todas las preguntas de ese tema!" : "No hay preguntas.");
  test = { tema, num, modo, preguntas: pool.slice(0, num), i: 0, respuestas: [] };
  if (location.hash === "#test") pintarPregunta(true);
  else location.hash = "test";  // el router la pinta
}

/* ---------- Test ---------- */
function nombreTest() {
  const t = typeof test.tema === "string" ? `Epígrafe ${test.tema.slice(2)}` : test.tema < 0 ? "Todos los temas" : TEMAS[test.tema];
  return test.modo === "fallos" ? `Mis fallos · ${t}` : test.modo === "nuevas" ? `No vistas · ${t}` : t;
}

// conAnimacion: true al entrar en el test; "clic" al pasar con el ratón (sólo avanza la barra); false con teclado (nada animado)
function pintarPregunta(conAnimacion) {
  if (test.i >= test.preguntas.length) return pintarResumen();
  const q = test.preguntas[test.i], n = test.preguntas.length;
  const aciertos = test.respuestas.filter(r => r.ok).length, fallos = test.respuestas.length - aciertos;
  const html = `
    <div class="test-cab">
      <span class="contador"><b>${test.i + 1}</b> / ${n} · ${esc(nombreTest())}</span>
      <div class="marcador"><span class="m-ok">${I.ok}${aciertos}</span><span class="m-ko">${I.ko}${fallos}</span></div>
    </div>
    <div class="progreso"><i style="transform:scaleX(${(conAnimacion === "clic" ? test.i - 1 : test.i) / n})"></i></div>
    <div class="card">
      <div class="pregunta-meta"><span class="etiqueta">${TEMAS[q[0]]}</span><span class="codigo">${esc(q[5])}</span>
        <button class="btn primario mini sig-arriba" id="sig-arriba" hidden></button></div>
      <div class="enunciado">${esc(q[1])}</div>
      <div class="opciones">${q[2].map((o, k) => `<button class="opcion" data-k="${k}">
        <span class="letra">${LETRAS[k]}</span><span>${esc(o)}</span></button>`).join("")}</div>
      <div id="tras"></div>
    </div>
    <div class="acciones" style="justify-content:center"><button class="btn fantasma mini" id="salir">Terminar test</button></div>`;
  if (conAnimacion === true) pintar(html);
  else { app.classList.remove("entrar"); app.innerHTML = html; window.scrollTo(0, 0); }
  // la barra avanza desde la posición anterior
  requestAnimationFrame(() => { const b = app.querySelector(".progreso i"); if (b) b.style.transform = `scaleX(${test.i / n})`; });
  app.querySelectorAll(".opcion").forEach(b => b.onclick = () => responder(+b.dataset.k, false));
  document.getElementById("salir").onclick = () => { test.preguntas = test.preguntas.slice(0, test.respuestas.length); pintarResumen(); };
  if (test.respuestas[test.i]) mostrarCorreccion();  // si se repinta una pregunta ya respondida
}

function responder(k, porTeclado) {
  if (test.respuestas.length > test.i) return;  // ya respondida
  const q = test.preguntas[test.i];
  test.respuestas.push({ q, elegida: k, ok: k === q[3] });
  registrar(q[5], k === q[3]);  // se guarda en Supabase (si el dispositivo está vinculado)
  app.classList.toggle("teclado", porTeclado);  // con teclado: sin animaciones
  mostrarCorreccion();
}

function mostrarCorreccion() {
  const { q, elegida: k, ok } = test.respuestas[test.i];
  app.querySelectorAll(".opcion").forEach((b, j) => {
    b.disabled = true;
    if (j === q[3]) b.classList.add("correcta");
    else if (j === k) b.classList.add("elegida-mal");
  });
  const aciertos = test.respuestas.filter(r => r.ok).length;
  app.querySelector(".m-ok").innerHTML = I.ok + aciertos;
  app.querySelector(".m-ko").innerHTML = I.ko + (test.respuestas.length - aciertos);
  const ultima = test.i + 1 >= test.preguntas.length;
  document.getElementById("tras").innerHTML = `<div class="tras">
    <div class="resultado ${ok ? "ok" : "ko"}">${ok ? `${I.ok}¡Correcto!` : `${I.ko}Incorrecto · la correcta es la ${LETRAS[q[3]]}`}
      ${ok && PROG.get(q[5])?.p ? `<span class="racha">${PROG.get(q[5]).r} de ${ACIERTOS_PARA_SALIR} para quitarla de tus fallos</span>` : ""}</div>
    ${ok  // si aciertas, la explicación queda plegada por si quieres verla
      ? `<details class="ver-expl"><summary>${I.chev}Ver explicación</summary><div class="cuerpo">${explicacion(q)}</div></details>`
      : explicacion(q)}
    <div class="siguiente-fila"><span class="atajo">Pulsa <kbd>Enter</kbd> para continuar</span>
      <button class="btn primario" id="sig">${ultima ? "Ver resultado" : "Siguiente"}</button></div></div>`;
  document.getElementById("sig").onclick = () => siguiente(false);
  // segundo botón, arriba a la derecha, para no tener que bajar hasta el final de la explicación
  const arriba = document.getElementById("sig-arriba");
  arriba.textContent = ultima ? "Ver resultado" : "Siguiente";
  arriba.hidden = false;
  arriba.onclick = () => siguiente(false);
  document.getElementById("sig").focus({ preventScroll: true });
}

function siguiente(porTeclado) { test.i++; pintarPregunta(porTeclado ? false : "clic"); }

function explicacion(q) {
  const x = EXPL[q[5]];
  if (!x) return `<p class="norma">Sin explicación disponible. Norma: ${esc(q[4])}</p>`;
  return `<div class="expl">
      <p><b>QUÉ SE PREGUNTA</b>${esc(x.p || "")}</p>
      <p><b>POR QUÉ ES LA CORRECTA</b>${esc(x.c || "")}</p>
      <p><b>EJEMPLO</b>${esc(x.e || "")}</p></div>
    ${x.a ? `<div class="aviso">${I.aviso.replace("<svg", '<svg width="18" height="18" style="flex:none;margin-top:2px"')}<span>${esc(x.a)}</span></div>` : ""}
    <div class="norma">Norma: ${esc(q[4])}</div>`;
}

function pintarResumen() {
  const r = test.respuestas, ok = r.filter(x => x.ok).length, mal = r.filter(x => !x.ok);
  const pct = r.length ? Math.round(ok / r.length * 100) : 0;
  const color = pct >= 80 ? "var(--ok)" : pct >= 50 ? "var(--accent)" : "var(--ko)";
  const frase = !r.length ? "No has respondido ninguna pregunta." : pct >= 80 ? "¡Muy bien! Vas preparado." :
    pct >= 50 ? "Buen camino. Repasa las falladas." : "Toca repasar el temario.";
  pintar(`
    <a class="volver" href="#inicio">${I.atras.replace("<svg", '<svg width="16" height="16"')}Inicio</a>
    <h1>Resultado</h1>
    <p class="sub">${esc(nombreTest())} · ${frase}${conectado && mal.length ? " Tus fallos quedan guardados en «Mis fallos»." : ""}</p>
    <div class="card resumen">
      <div class="anillo" style="--p:${pct};--color:${color}"><div><div><b>${pct}%</b><span>acierto</span></div></div></div>
      <div>
        <div class="kpis">
          <div class="kpi"><b style="color:var(--ok)">${ok}</b><span>correctas</span></div>
          <div class="kpi"><b style="color:var(--ko)">${mal.length}</b><span>falladas</span></div>
          <div class="kpi"><b>${r.length}</b><span>respondidas</span></div>
        </div>
        <div class="acciones">
          <button class="btn primario" id="otra">${I.play}Otro test igual</button>
          ${mal.length ? `<button class="btn" id="repetir">Repetir las falladas (${mal.length})</button>` : ""}
        </div>
      </div>
    </div>
    ${mal.length ? `<div class="card"><h2>Preguntas falladas</h2>${mal.map(x => fichaPregunta(x.q, x.elegida)).join("")}</div>` : ""}`);
  document.getElementById("otra").onclick = () => empezar(test.tema, test.num, test.modo);
  if (mal.length) document.getElementById("repetir").onclick = () => {
    test = { tema: test.tema, num: test.num, modo: test.modo, preguntas: barajar(mal.map(x => x.q)), i: 0, respuestas: [] };
    pintarPregunta(true);
  };
}

// Pregunta desplegable con la correcta (y la elegida, si se pasa) + explicación; veces = registro de PROG (fallos y racha)
function fichaPregunta(q, elegida, veces) {
  const marca = elegida !== undefined ? `<span class="veces">Marcaste ${LETRAS[elegida]}</span>`
    : veces ? `<span class="veces">Fallada ${veces.f}×${veces.r ? ` · ${veces.r}/${ACIERTOS_PARA_SALIR} ✓` : ""}</span>` : `<span class="codigo">${esc(q[5])}</span>`;
  return `<details class="fallo"><summary>
      ${marca}
      <span class="texto">${esc(q[1])}</span>${I.chev}</summary>
    <div class="cuerpo"><div class="opciones" style="margin-bottom:12px">
      ${q[2].map((o, k) => `<div class="opcion ${k === q[3] ? "correcta" : k === elegida ? "elegida-mal" : ""}">
        <span class="letra">${LETRAS[k]}</span><span>${esc(o)}</span></div>`).join("")}</div>
      ${explicacion(q)}</div></details>`;
}

/* ---------- Temario ---------- */
function vistaTemario() {
  pintar(`
    <section class="hero">
      <div class="eyebrow">Temario</div>
      <h1>Lo que tienes que saber</h1>
      <p class="sub">Resumen en formato chuleta de todo lo que se pregunta, organizado por temas y epígrafes. Lee un epígrafe y haz su test.</p>
    </section>
    <div class="temas-grid">${TEMAS.map((_, i) => tarjetaTema(i, "temario")).join("")}</div>`);
}

// Cuántas preguntas del epígrafe has respondido (si hay progreso); así se ve qué epígrafes ya has trabajado
function metaEpigrafe(e) {
  if (!conectado || !progresoCargado) return `<span class="ep-meta">${e.preguntas} preg.</span>`;
  const qs = PREG.filter(q => q[5].startsWith(e.id)), vistas = qs.filter(q => PROG.has(q[5])).length;
  const pct = qs.length ? vistas / qs.length * 100 : 0;
  return `<span class="ep-meta ep-prog${vistas ? " empezado" : ""}${vistas === qs.length ? " completo" : ""}"
      title="${vistas} de ${qs.length} preguntas respondidas">
      <span class="ep-barra"><i style="width:${pct}%"></i></span>${vistas === qs.length ? `${I.ok}` : ""}${vistas}/${qs.length}</span>`;
}

function vistaTemaTemario(tema) {
  const eps = TEMARIO.filter(e => e.tema === tema);
  pintar(`
    <a class="volver" href="#temario">${I.atras.replace("<svg", '<svg width="16" height="16"')}Temario</a>
    <div class="eyebrow">Tema ${tema + 1}</div>
    <h1>${TEMAS[tema] || "Tema"}</h1>
    <p class="sub">${eps.length} epígrafes · ${miles(eps.reduce((s, e) => s + e.preguntas, 0))} preguntas cubiertas</p>
    <div class="acciones" style="margin:0 0 20px">
      <button class="btn primario" data-test="${tema}">${I.play}Test del tema (${tamano})</button>
      <button class="btn" id="abrir-todo">Desplegar todo</button>
    </div>
    ${eps.map(e => `
      <details class="epigrafe"><summary><span class="ep-num">${e.id.slice(2)}</span>
          <span class="ep-tit">${esc(e.titulo)}</span>${metaEpigrafe(e)}${I.chev}</summary>
        <div class="apuntes-caja"><div class="apuntes">${markdown(e.md)}</div>
          <div class="acciones"><button class="btn mini" data-test="${e.id}">${I.play}Test de este epígrafe (10)</button></div></div>
      </details>`).join("") || `<p class="vacio">Este tema aún no tiene temario.</p>`}`);
  app.querySelectorAll("[data-test]").forEach(b => b.onclick = () => {
    const t = b.dataset.test;
    /^\d$/.test(t) ? empezar(+t, tamano) : empezar(t, 10);
  });
  const abrir = document.getElementById("abrir-todo");
  abrir.onclick = () => {
    const todos = [...app.querySelectorAll("details.epigrafe")], abiertos = todos.every(d => d.open);
    todos.forEach(d => d.open = !abiertos);
    abrir.textContent = abiertos ? "Desplegar todo" : "Plegar todo";
  };
}

// Markdown mínimo: ## / ### títulos, "- " viñetas (con sangría = subviñeta), **negrita**
function markdown(md) {
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  let html = "", lista = false;
  for (const linea of md.split("\n")) {
    const m = linea.match(/^(\s*)[-*] (.*)$/);
    if (m) {
      if (!lista) { html += "<ul>"; lista = true; }
      html += `<li${m[1].length >= 2 ? ' class="sub"' : ""}>${fmt(m[2])}</li>`;
      continue;
    }
    if (lista) { html += "</ul>"; lista = false; }
    if (linea.startsWith("### ")) html += `<h4>${fmt(linea.slice(4))}</h4>`;
    else if (linea.startsWith("## ")) html += `<h3>${fmt(linea.slice(3))}</h3>`;
    else if (linea.trim()) html += `<p>${fmt(linea)}</p>`;
  }
  return html + (lista ? "</ul>" : "");
}

/* ---------- Buscar ---------- */
function vistaBuscar() {
  pintar(`
    <section class="hero">
      <div class="eyebrow">Buscar</div>
      <h1>Encuentra cualquier pregunta</h1>
      <p class="sub">Por palabras del enunciado o de las respuestas, o por código (p. ej. 1A01001). No importan las tildes.</p>
    </section>
    <div class="card">
      <div class="form buscar">
        <label class="campo">Texto<span class="buscador">${I.lupa}<input type="search" id="b-txt" placeholder="p. ej. tacógrafo" autofocus></span></label>
        <label class="campo">Tema<select id="b-tema"><option value="-1">Todos</option>
          ${TEMAS.map((t, i) => `<option value="${i}">${i + 1}. ${t}</option>`).join("")}</select></label>
      </div>
    </div>
    <div class="card" id="b-res"></div>`);
  const txt = document.getElementById("b-txt"), tema = document.getElementById("b-tema");
  const filtrar = () => {
    const t = sinTildes(txt.value.trim()), tm = +tema.value;
    const res = PREG.filter(q => (tm < 0 || q[0] === tm) &&
      (!t || q[5].toLowerCase() === t || sinTildes(q[1] + " " + q[2].join(" ")).includes(t)));
    document.getElementById("b-res").innerHTML = !t && tm < 0
      ? `<p class="vacio">Escribe algo o elige un tema.</p>`
      : `<h2>${miles(res.length)} resultado${res.length === 1 ? "" : "s"}</h2>` +
        (res.slice(0, 100).map(q => fichaPregunta(q)).join("") || `<p class="vacio">Nada encontrado.</p>`) +
        (res.length > 100 ? `<p class="vacio">Mostrando las 100 primeras. Afina la búsqueda.</p>` : "");
  };
  let t0; txt.oninput = () => { clearTimeout(t0); t0 = setTimeout(filtrar, 200); };
  tema.onchange = filtrar; filtrar();
}

/* ---------- Teclado: A-D / 1-4 para responder, Enter para seguir (sin animaciones) ---------- */
document.addEventListener("keydown", e => {
  if (location.hash !== "#test" || !test || e.target.tagName === "INPUT" || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = "abcd1234".indexOf(e.key.toLowerCase());
  if (k >= 0 && test.respuestas.length === test.i) responder(k % 4, true);
  else if (e.key === "Enter" && document.getElementById("sig")) { e.preventDefault(); siguiente(true); }
});

cargar();
