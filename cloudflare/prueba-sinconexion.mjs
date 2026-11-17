// Prueba de punta a punta del modo sin internet: servidor real (manejador de la API + SQLite) + Chrome.
// El "sin internet" es real: el servidor se apaga (cierra las conexiones), así que fallan también la página y el service worker.
// Uso (desde esta carpeta):  node construir.js && node prueba-sinconexion.mjs
// Necesita Node 22+ y Google Chrome (o la variable CHROME con la ruta del ejecutable).
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "tekalum-")), PORT = 8793, BASE = "http://127.0.0.1:" + PORT;
const sq = new DatabaseSync(":memory:");
sq.exec(fs.readFileSync(RAIZ + "/schema.sql", "utf8"));
const ahora = () => new Date().toISOString();
const sembrar = (col, id, data) => sq.prepare("INSERT OR REPLACE INTO docs (col,id,data,updated) VALUES (?,?,?,?)").run(col, id, JSON.stringify(data), "2026-11-01T00:00:00.000Z");
sembrar("_sistema", "sembrado", {});
sembrar("config", "contable", { cierres: { "2026-09": { f: "2026-09-30" } }, numAsig: {}, reglasProv: {} });
sembrar("config", "precios", { operacion: {} });
sembrar("cuentas", "c1", { nombre: "Caja menor", tipo: "caja", saldoIni: 100000, fIni: "2026-10-01", activa: true });
sembrar("egresos", "eg-viejo", { f: "2026-10-20", cat: "servicios", valor: 50000, tercero: "Luz", pagado: true, cuenta: "c1", fPago: "2026-10-20", concepto: "Servicios" });
const ord = (sql, a) => [...sql.matchAll(/\?(\d+)/g)].map((m) => { const v = a[+m[1] - 1]; return v === undefined ? null : v; });
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  run: async () => { const r = sq.prepare(sql.replace(/\?(\d+)/g, "?")).run(...ord(sql, args)); return { meta: { changes: r.changes } }; },
  first: async () => sq.prepare(sql.replace(/\?(\d+)/g, "?")).get(...ord(sql, args)) ?? null,
  all: async () => ({ results: sq.prepare(sql.replace(/\?(\d+)/g, "?")).all(...ord(sql, args)) }),
});
const CUENTAS = { car: { clave: "c", rol: "auxiliar", nombre: "Auxiliar" }, osw: { clave: "o", rol: "contador", nombre: "Contador" } };
const env = { DB: { prepare: (s) => stmt(s), batch: async (L) => { for (const s of L) await s.run(); } }, CUENTAS: JSON.stringify(CUENTAS) };
const { onRequest } = await import(pathToFileURL(path.join(RAIZ, "functions/api/[[path]].js")).href);

// ---- contadores de lo que pide el navegador ----
const golpes = {};const cuenta = (k) => (golpes[k] = (golpes[k] || 0) + 1);
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".json": "application/json" };
let caido = false; // servidor realmente apagado: ni la página, ni el service worker, ni la API responden (como cuando no hay internet)
const server = http.createServer(async (req, res) => {
  if (caido) { req.socket.destroy(); return; }
  try {
    const u = new URL(req.url, BASE);
    if (u.pathname.startsWith("/api/")) {
      const chunks = [];for await (const c of req) chunks.push(c);
      const cuerpo = chunks.length ? Buffer.concat(chunks).toString() : undefined;
      cuenta(u.pathname.replace(/^\/api\//, "").split("/").slice(0, 1)[0]);
      const r = await onRequest({ request: new Request(BASE + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : cuerpo }), env, params: { path: u.pathname.replace(/^\/api\//, "").split("/").map(decodeURIComponent) } });
      const b = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, Object.fromEntries(r.headers));res.end(b);return;
    }
    const f = u.pathname === "/" ? "index.html" : u.pathname.slice(1);
    const ruta = path.join(RAIZ, "public", f);
    if (!ruta.startsWith(path.join(RAIZ, "public")) || !fs.existsSync(ruta)) { res.writeHead(404);res.end("no");return; }
    cuenta("estatico:" + (f === "index.html" ? "index" : f));
    res.writeHead(200, { "content-type": TIPOS[path.extname(ruta)] || "application/octet-stream", "cache-control": "no-cache" });res.end(fs.readFileSync(ruta));
  } catch (e) { res.writeHead(500);res.end(String(e)); }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
// otra persona que sí tiene internet: llama al manejador directo (no pasa por el servidor "caído")
const llamarAPI = async (u, c, metodo, ruta, body) => { const p = ruta.split("?")[0].split("/").filter(Boolean); const r = await onRequest({ request: new Request(BASE + "/api" + ruta, { method: metodo, headers: { "x-usuario": u, "x-clave": c, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }), env, params: { path: p } }); return { s: r.status, b: await r.json() }; };
const enServidor = (col, id) => { const f = sq.prepare("SELECT data FROM docs WHERE col=? AND id=?").get(col, id); return f ? JSON.parse(f.data) : null; };

// ---- Chrome ----
fs.rmSync(dir + "/profsinred", { recursive: true, force: true });
const ch = spawn(process.env.CHROME || ["C:/Program Files/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((x) => fs.existsSync(x)), ["--headless=new", "--remote-debugging-port=9464", "--user-data-dir=" + dir + "/profsinred", "about:blank"]);
const w = (ms) => new Promise((r) => setTimeout(r, ms));await w(2500);
const t = await (await fetch("http://127.0.0.1:9464/json")).json();
const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl);await new Promise((r) => (ws.onopen = r));
let id = 0;const p = {}, err = [], reqs = {}, bytes = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data);
  if (p[m.id]) { p[m.id](m.result);delete p[m.id]; }
  if (m.method === "Runtime.exceptionThrown") err.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Network.requestWillBeSent") reqs[m.params.requestId] = m.params.request.url;
  if (m.method === "Network.loadingFinished") bytes.push([reqs[m.params.requestId] || "", m.params.encodedDataLength]); };
const c = (method, params = {}) => new Promise((r) => { p[++id] = r;ws.send(JSON.stringify({ id, method, params })); });
const ev = async (x) => { const r = await c("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true });if (r.exceptionDetails) err.push("eval: " + (r.exceptionDetails.exception?.description || "").slice(0, 300));return r.result?.value; };
await c("Runtime.enable");await c("Network.enable");await c("Page.enable");
await c("Emulation.setDeviceMetricsOverride", { width: 1360, height: 900, deviceScaleFactor: 1, mobile: false });
await c("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("vye-usuario","car");localStorage.setItem("vye-clave","c")}catch{}` });
const offline = async (v) => { caido = v; await c("Network.emulateNetworkConditions", { offline: v, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); };
const esperar = async (cond, seg = 30) => { for (let i = 0; i < seg * 4; i++) { if (await ev(cond)) return true; await w(250); } return false; };
const ok = [], mal = [];const chk = (n, cond, info) => (cond ? ok : mal).push(n + (info !== undefined ? " → " + JSON.stringify(info) : ""));
const LISTA = `typeof store!=="undefined"&&typeof modo!=="undefined"&&modo==="compartido"&&store.cuentas.length>0&&!!window.VYE_SESION&&!!window.VYE_COLA`;
const shot = async (n) => { const s = await c("Page.captureScreenshot", { format: "png" });fs.writeFileSync(dir + "/" + n + ".png", Buffer.from(s.data, "base64")); };

// =============== 1. Entrar y ver cuánto consulta cuando nadie cambia nada ===============
await c("Page.navigate", { url: BASE + "/" });
chk("la app abre y trae los datos", await esperar(LISTA, 60));
chk("la auxiliar entra con su rol", (await ev(`window.VYE_SESION?.rol`)) === "auxiliar");
await w(2500); // que el service worker termine de guardar la página
const listo0 = await ev(`window.VYE_LISTO()`);
chk("desde la primera visita la página queda guardada en el equipo", listo0.pagina, listo0);
for (const k of Object.keys(golpes)) delete golpes[k];bytes.length = 0;
await w(36000);
console.log("  en 36 s sin cambios, el navegador pidió:", JSON.stringify(golpes));
chk("sin cambios NO baja todos los datos de nuevo (solo pregunta la versión)", !golpes.all && (golpes.version || 0) >= 2, golpes);
const bv = bytes.filter(([u]) => u.includes("/api/version")).map(([, b]) => b);
console.log("  tamaño de cada consulta de versión (con cabeceras, sin comprimir):", bv.join(", "), "bytes");

// =============== 2. Lo que otra persona registra aparece solo, bajando solo lo nuevo ===============
const nuevoOsw = await llamarAPI("osw", "o", "PUT", "/docs/egresos/e-del-contador", { f: "2026-11-17", cat: "servicios", valor: 12000, tercero: "Agua", pagado: true, cuenta: "c1", fPago: "2026-11-17", concepto: "Pago hecho por el contador" });
chk("(otra persona) guarda un egreso en el servidor", nuevoOsw.s === 200);
for (const k of Object.keys(golpes)) delete golpes[k];
chk("el egreso de la otra persona aparece en la pantalla de la auxiliar sin recargar", await esperar(`store.egresos.some(e=>e.id==="e-del-contador")`, 25));
console.log("  para traerlo pidió:", JSON.stringify(golpes));
chk("lo trajo bajando solo lo nuevo (cambios), no todo (all)", (golpes.cambios || 0) >= 1 && !golpes.all, golpes);

// =============== 3. Registrar con internet ===============
await ev(`guardarDoc("egresos",null,{f:"2026-11-17",cat:"servicios",valor:30000,tercero:"Con internet",pagado:true,cuenta:"c1",fPago:"2026-11-17",concepto:"Registrado con internet"}).then(()=>1)`);
await w(800);
chk("con internet: queda guardado en el servidor al instante", !!sq.prepare("SELECT 1 FROM docs WHERE col='egresos' AND data LIKE '%Registrado con internet%'").get());
chk("con internet: no queda nada en espera", (await ev(`window.VYE_COLA.pendientes()`)) === 0);

// =============== 4. Se cae el internet ===============
await offline(true);await w(500);
const ids = [];
for (const [col, d] of [["egresos", { f: "2026-11-17", cat: "servicios", valor: 41000, tercero: "Sin internet 1", pagado: true, cuenta: "c1", fPago: "2026-11-17", concepto: "Egreso sin internet 1" }],
  ["egresos", { f: "2026-11-17", cat: "servicios", valor: 42000, tercero: "Sin internet 2", pagado: true, cuenta: "c1", fPago: "2026-11-17", concepto: "Egreso sin internet 2" }],
  ["ingresos", { f: "2026-11-17", tipo: "contado", valor: 77000, cliente: "Cliente sin internet", cobrado: true, cuenta: "c1", concepto: "Ingreso sin internet" }]])
  ids.push(await ev(`guardarDoc(${JSON.stringify(col)},null,${JSON.stringify(d)})`));
chk("sin internet: guardar NO da error (devuelve el id)", ids.every((x) => typeof x === "string" && x.length > 5), ids);
chk("sin internet: lo registrado se ve en pantalla", await ev(`store.egresos.filter(e=>/sin internet/i.test(e.concepto||"")).length===2&&store.ingresos.some(i=>i.concepto==="Ingreso sin internet")`));
chk("sin internet: quedan 3 en espera", (await ev(`window.VYE_COLA.pendientes()`)) === 3);
chk("sin internet: todavía no llegó nada al servidor", !sq.prepare("SELECT 1 FROM docs WHERE data LIKE '%sin internet%'").get());
const estado = await ev(`document.getElementById("vye-estado")?.textContent||""`);
console.log("  aviso en pantalla:", estado);
chk("sin internet: aparece el aviso con cuántos hay por subir", /Sin internet/.test(estado) && /3 por subir/.test(estado), estado);
// corregir algo que aún no ha subido: se funde con el registro, no es "editar lo ya guardado"
const id1 = ids[0];
await ev(`guardarDoc("egresos",${JSON.stringify(id1)},{f:"2026-11-17",cat:"servicios",valor:41500,tercero:"Sin internet 1",pagado:true,cuenta:"c1",fPago:"2026-11-17",concepto:"Egreso sin internet 1 (corregido)"})`);
chk("corregir lo que aún no sube: no crea otro registro en espera", (await ev(`window.VYE_COLA.pendientes()`)) === 3);
// dos cosas que el servidor va a rechazar al subir (la auxiliar no cambia lo ya guardado ni registra en un mes cerrado)
await ev(`guardarDoc("egresos","eg-viejo",{...store.egresos.find(e=>e.id==="eg-viejo"),valor:1})`);
const bloqueo = await ev(`guardarDoc("egresos",null,{f:"2026-09-20",cat:"servicios",valor:5,tercero:"Mes cerrado",pagado:true,cuenta:"c1",fPago:"2026-11-17",concepto:"En mes cerrado"}).then(()=>"SE GUARDÓ",e=>"bloqueado: "+(e.msg||e.message))`);
chk("sin internet: un mes que ya estaba cerrado se bloquea al instante (el candado también funciona sin internet)", /bloqueado: .*cerrado/i.test(bloqueo), bloqueo);
await ev(`guardarDoc("egresos",null,{f:"2026-10-25",cat:"servicios",valor:6000,tercero:"Octubre",pagado:true,cuenta:"c1",fPago:"2026-10-25",concepto:"Egreso de octubre sin internet"})`);
chk("sin internet: ahora hay 5 en espera", (await ev(`window.VYE_COLA.pendientes()`)) === 5);
// los cambios de configuración necesitan internet
await ev(`(async()=>{CONT.mapa={...(CONT.mapa||{}),x:"1"};await guardarCont("Cambio de configuración")})()`);
chk("sin internet: un cambio de configuración avisa que necesita conexión", /necesita conexión/.test(await ev(`document.querySelector("#toast")?.textContent||""`)));
await shot("sinred-1-offline");

// =============== 5. Recargar la página sin internet ===============
await c("Page.reload");
chk("sin internet: la página vuelve a abrir (la guarda el equipo)", await esperar(LISTA, 40));
chk("sin internet: ve los datos de antes (copia guardada) y lo registrado en espera", await ev(`store.egresos.some(e=>e.id==="eg-viejo")&&store.egresos.some(e=>e.id==="e-del-contador")&&store.egresos.filter(e=>/sin internet/i.test(e.concepto||"")).length===3`));
chk("sin internet: lo en espera sobrevivió al recargar (5)", (await ev(`window.VYE_COLA.pendientes()`)) === 5);
chk("sin internet tras recargar: sigue con su rol", (await ev(`window.VYE_SESION?.rol`)) === "auxiliar");
await shot("sinred-2-recargado");
// mientras tanto, otra persona registra algo y el contador CIERRA octubre (ella no lo sabe, no tiene internet)
{const cont = enServidor("config", "contable");await llamarAPI("osw", "o", "PUT", "/docs/config/contable", { ...cont, cierres: { ...cont.cierres, "2026-10": { f: "2026-10-31", por: "Contador" } } });}
await llamarAPI("osw", "o", "PUT", "/docs/egresos/e-contador-mientras", { f: "2026-11-17", cat: "servicios", valor: 9000, tercero: "Luz", pagado: true, cuenta: "c1", fPago: "2026-11-17", concepto: "El contador mientras tanto" });

// =============== 6. Vuelve el internet ===============
await offline(false);
chk("vuelve el internet: se sube lo pendiente solo", await esperar(`window.VYE_COLA.pendientes()===0`, 40));
const s1 = enServidor("egresos", id1);
chk("subió el egreso 1 con la corrección (un solo registro)", s1?.valor === 41500 && /corregido/.test(s1.concepto), s1 && [s1.valor, s1.concepto]);
chk("subió el egreso 2 y el ingreso", !!sq.prepare("SELECT 1 FROM docs WHERE col='egresos' AND data LIKE '%Egreso sin internet 2%'").get() && !!sq.prepare("SELECT 1 FROM docs WHERE col='ingresos' AND data LIKE '%Ingreso sin internet%'").get());
chk("el servidor los marcó con quién los registró (la auxiliar)", enServidor("egresos", id1)?._creadoPor === "car");
chk("el egreso del contador apareció en la pantalla de la auxiliar", await esperar(`store.egresos.some(e=>e.id==="e-contador-mientras")`, 25));
chk("lo que el servidor rechazó NO se perdió: quedan 2 con problema", (await ev(`window.VYE_COLA.fallidos()`)) === 2, await ev(`window.VYE_COLA.fallidos()`));
chk("no se cambió el egreso viejo (la auxiliar no edita lo ya guardado)", enServidor("egresos", "eg-viejo").valor === 50000);
chk("el egreso de octubre (que se cerró mientras ella no tenía internet) NO entró", !sq.prepare("SELECT 1 FROM docs WHERE data LIKE '%Egreso de octubre sin internet%'").get());
const aviso2 = await ev(`document.getElementById("vye-estado")?.textContent||""`);
console.log("  aviso al volver:", aviso2);
chk("aparece el aviso rojo con los que no se pudieron subir", /2 registros no se pudieron subir/.test(aviso2), aviso2);
await ev(`document.getElementById("vye-estado").click()`);await w(300);
const panel = await ev(`document.getElementById("vye-panel")?.innerText||""`);
console.log("  panel:", panel.replace(/\n+/g, " | ").slice(0, 420));
chk("el panel dice por qué el servidor los rechazó", /no cambiarlos ni borrarlos/i.test(panel) && /cerrado/i.test(panel), panel.slice(0, 200));
await shot("sinred-3-panel");
await ev(`window.confirm=()=>true;document.querySelectorAll('[data-vp="descartar"]').forEach(b=>b.click())`);await w(500);
chk("se pueden descartar los rechazados", (await ev(`window.VYE_COLA.fallidos()`)) === 0);
chk("sin pendientes ni problemas el aviso desaparece", await ev(`!document.getElementById("vye-estado")`));
const verdad = await ev(`JSON.stringify(store.egresos.map(e=>e.id).sort())`);
chk("la pantalla de la auxiliar y el servidor quedan iguales", verdad === JSON.stringify(sq.prepare("SELECT id FROM docs WHERE col='egresos'").all().map((r) => r.id).sort()), [verdad.length]);

// =============== 7. Consumo de datos ===============
const apiBytes = bytes.filter(([u]) => u.includes("/api/")).reduce((s, [, b]) => s + b, 0);
console.log("\nTráfico /api del navegador en toda la prueba:", Math.round(apiBytes / 1024), "KB");
console.log("Llamadas:", JSON.stringify(golpes));
console.log("\nOK:", ok.length, "  FALLOS:", mal.length);for (const m of mal) console.log("  ✗", m);
console.log("errores de página:", err.length ? err.slice(0, 6) : "ninguno");
ch.kill();server.close();process.exit(0);
