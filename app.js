// Test Transportista — web estática. Datos en data/datos.js (window.DATOS), generado por preparar_web.py
// preguntas: [tema, enunciado, [A,B,C,D], correcta(0-3), norma, codigo]
// explicaciones: { codigo: { p, c, e, a? } }
// temario: [{ id: "1E03", tema, titulo, md, preguntas }]
// Progreso: con sesión iniciada, cada respuesta se guarda en Supabase (tabla respuestas, ver supabase.sql).

const TEMAS = ["Derecho civil", "Derecho mercantil", "Derecho social", "Derecho fiscal",
  "Gestión comercial y financiera", "Acceso al mercado", "Normas y formalidades técnicas", "Seguridad vial"];
const LETRAS = "ABCD";
const TAMANOS = [10, 25, 50, 100];

let PREG = [], EXPL = {}, TEMARIO = [], test = null, tamano = 25, soloFallos = false;
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
// PROG: codigo -> { a: aciertos, f: fallos, p: pendiente (fallada la última vez) }
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
      data.forEach(r => PROG.set(r.codigo, { a: r.aciertos, f: r.fallos, p: r.pendiente }));
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
  const r = PROG.get(codigo) || { a: 0, f: 0, p: false };
  ok ? r.a++ : r.f++; r.p = !ok;
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
  if (conectado) {
    const vals = [...PROG.values()], a = vals.reduce((s, r) => s + r.a, 0), f = vals.reduce((s, r) => s + r.f, 0);
    const pend = pendientes().length;
    pintar(`
      <section class="hero"><div class="eyebrow">Progreso</div><h1>Tu progreso</h1>
        <p class="sub">Este dispositivo está vinculado: tus respuestas se guardan y las verás en todos tus dispositivos.</p></section>
      <div class="card">
        <div class="kpis kpis-4">
          <div class="kpi"><b>${miles(PROG.size)}</b><span>preguntas vistas</span></div>
          <div class="kpi"><b style="color:var(--ok)">${miles(a)}</b><span>aciertos</span></div>
          <div class="kpi"><b style="color:var(--ko)">${miles(f)}</b><span>fallos</span></div>
          <div class="kpi"><b>${miles(pend)}</b><span>por repasar</span></div>
        </div>
        <div class="acciones">
          ${pend ? `<a class="btn primario" href="#fallos">${I.diana}Mis fallos</a>` : ""}
          <button class="btn fantasma" id="desvincular">Desvincular este dispositivo</button>
        </div>
      </div>`);
    document.getElementById("desvincular").onclick = () => {
      if (confirm("¿Desvincular este dispositivo? Tus fallos siguen guardados; para volver a vincularlo abre otra vez tu enlace personal.")) desvincular();
    };
    return;
  }
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
  if (!conectado) { location.hash = "cuenta"; return; }
  const pend = pendientes().sort((x, y) => PROG.get(y[5]).f - PROG.get(x[5]).f);
  pintar(`
    <section class="hero"><div class="eyebrow">Mis fallos</div><h1>Preguntas por repasar</h1>
      <p class="sub">Las que fallaste la última vez que te salieron. Cuando aciertes una, sale de esta lista.</p></section>
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
      qs.slice(0, 200).map(q => fichaPregunta(q, undefined, PROG.get(q[5]).f)).join("") +
      (qs.length > 200 ? `<p class="vacio">Mostrando las 200 más falladas.</p>` : "");
  };
  sel.onchange = lista; lista();
  document.getElementById("fa-test").onclick = () => empezar(+sel.value, tamano, true);
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
  if (vista === "cuenta") return vistaCuenta();
  if (vista === "fallos") return vistaFallos();
  if (vista === "temario") return arg === undefined ? vistaTemario() : vistaTemaTemario(+arg);
  vistaInicio();
}

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
      ${conectado ? `<label class="interruptor"><input type="checkbox" id="f-fallos" ${soloFallos ? "checked" : ""}>
        <span class="pista"></span>Sólo preguntas que he fallado <span class="norma" style="margin:0">(${miles(pend.length)})</span></label>` : ""}
      <div class="acciones"><button class="btn primario" id="empezar">${I.play}Empezar test</button></div>
    </div>
    ${conectado ? `<div class="card fila-fallos">
        <span class="fallos-ico">${I.diana}</span>
        <div><h2 style="margin:0">Mis fallos</h2>
          <div class="norma" style="margin:2px 0 0">${!progresoCargado ? "Cargando tu progreso…" : pend.length
            ? `${miles(pend.length)} pregunta${pend.length === 1 ? "" : "s"} por repasar` : "Ninguna pendiente. ¡Bien!"}</div></div>
        ${pend.length ? `<a class="btn" href="#fallos">Ver y practicar</a>` : ""}
      </div>` : sb ? `<div class="card fila-fallos">
        <span class="fallos-ico">${I.diana}</span>
        <div><h2 style="margin:0">Guarda tus fallos</h2>
          <div class="norma" style="margin:2px 0 0">Abre tu enlace personal en este dispositivo para guardar las preguntas que falles.</div></div>
        <a class="btn" href="#cuenta">Vincular</a>
      </div>` : ""}
    <h2 style="margin-top:28px">Temas</h2>
    <div class="temas-grid">${TEMAS.map((_, i) => tarjetaTema(i)).join("")}</div>`);
  app.querySelectorAll(".segmento button").forEach(b => b.onclick = () => {
    tamano = +b.dataset.n;
    app.querySelectorAll(".segmento button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); });
  });
  const chk = document.getElementById("f-fallos");
  if (chk) chk.onchange = () => soloFallos = chk.checked;
  document.getElementById("empezar").onclick = () => empezar(+document.getElementById("f-tema").value, tamano, !!chk?.checked);
  app.querySelectorAll("[data-tema]").forEach(b => b.onclick = () => empezar(+b.dataset.tema, tamano));
}

// tema: -1 = todos, 0-7 = un tema, o un código de epígrafe ("1E03") para preguntas de ese epígrafe
// fallos: sólo preguntas pendientes (falladas la última vez)
function empezar(tema, num, fallos = false) {
  const pool = barajar(PREG.filter(q => (typeof tema === "string" ? q[5].startsWith(tema) : tema < 0 || q[0] === tema)
    && (!fallos || PROG.get(q[5])?.p)));
  if (!pool.length) return toast(fallos ? "No tienes fallos pendientes en ese tema." : "No hay preguntas.");
  test = { tema, num, fallos, preguntas: pool.slice(0, num), i: 0, respuestas: [] };
  if (location.hash === "#test") pintarPregunta(true);
  else location.hash = "test";  // el router la pinta
}

/* ---------- Test ---------- */
function nombreTest() {
  const t = typeof test.tema === "string" ? `Epígrafe ${test.tema.slice(2)}` : test.tema < 0 ? "Todos los temas" : TEMAS[test.tema];
  return test.fallos ? `Mis fallos · ${t}` : t;
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
    <div class="resultado ${ok ? "ok" : "ko"}">${ok ? `${I.ok}¡Correcto!` : `${I.ko}Incorrecto · la correcta es la ${LETRAS[q[3]]}`}</div>
    ${explicacion(q)}
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
  document.getElementById("otra").onclick = () => empezar(test.tema, test.num, test.fallos);
  if (mal.length) document.getElementById("repetir").onclick = () => {
    test = { tema: test.tema, num: test.num, fallos: test.fallos, preguntas: barajar(mal.map(x => x.q)), i: 0, respuestas: [] };
    pintarPregunta(true);
  };
}

// Pregunta desplegable con la correcta (y la elegida, si se pasa) + explicación; veces = nº de veces fallada
function fichaPregunta(q, elegida, veces) {
  const marca = elegida !== undefined ? `<span class="veces">Marcaste ${LETRAS[elegida]}</span>`
    : veces ? `<span class="veces">Fallada ${veces}×</span>` : `<span class="codigo">${esc(q[5])}</span>`;
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
          <span class="ep-tit">${esc(e.titulo)}</span><span class="ep-meta">${e.preguntas} preg.</span>${I.chev}</summary>
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
