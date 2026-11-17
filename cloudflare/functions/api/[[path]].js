// API de la app en Cloudflare Pages Functions + base de datos D1.
// Guarda documentos JSON por colección (cotizaciones, bodega, maquinaria, proveedores, config).
//   GET    /api/all                  todas las colecciones (la app lo consulta cada 15 s)
//   GET    /api/docs/:col            una colección
//   PUT    /api/docs/:col/:id        crear o reemplazar un documento
//   PATCH  /api/docs/:col/:id        combinar campos en un documento existente
//   DELETE /api/docs/:col/:id        borrar un documento
// auditoria, caja y chatarra solo aceptan documentos nuevos: PUT sobre uno existente, PATCH y DELETE se rechazan (409/403).
// Acceso con usuario y contraseña: la variable secreta CUENTAS guarda
//   {"usuario":{"clave":"...","rol":"admin"|"usuario"|"proyector"}, ...}
// y cada petición trae las cabeceras x-usuario y x-clave. GET /api/sesion dice el rol de quien entró.
// (Si no hay CUENTAS se usa la clave única APP_CLAVE de antes.)

import iniciales from "../../datos-iniciales.mjs";
import Anthropic from "@anthropic-ai/sdk";

const COLECCIONES = ["nominas", "cotizaciones", "bodega", "maquinaria", "proveedores", "config", "personal", "ordenes", "retazos", "chatarra", "caja", "auditoria", "archivos", "archivos_img", "compras", "egresos", "inversion", "aprendizaje", "referencias", "conjuntos", "sistemas", "personalizadas", "ingresos", "cuentas", "traslados", "asientos", "terceros", "ventas", "notasdoc", "items", "publicas"];
// Registros que solo se pueden crear: no se modifican ni se borran (historial inalterable)
const SOLO_AGREGAR = ["auditoria", "caja", "chatarra"];
const ID_VALIDO = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
const MAX_BYTES = 1024 * 1024;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function leerCuerpo(request) {
  const texto = await request.text();
  if (texto.length > MAX_BYTES) throw new Error("El documento es demasiado grande");
  const data = JSON.parse(texto);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("El cuerpo debe ser un objeto JSON");
  return data;
}

// La primera vez que se abre la app carga los datos reales (equipos, proveedores, compras y sus fotos).
// Deja una marca en la colección _sistema para no volver a hacerlo; lo que se borre después no reaparece.
async function sembrar(env) {
  const ya = await env.DB.prepare("SELECT 1 AS ok FROM docs WHERE col = '_sistema' AND id = 'sembrado'").first();
  if (ya) return;
  const ahora = new Date().toISOString();
  const ins = env.DB.prepare("INSERT OR IGNORE INTO docs (col, id, data, updated, por) VALUES (?1, ?2, ?3, ?4, NULL)");
  const lote = [];
  for (const [col, docs] of Object.entries(iniciales))
    for (const { id, ...data } of docs) lote.push(ins.bind(col, id, JSON.stringify(data), ahora));
  lote.push(ins.bind("_sistema", "sembrado", "{}", ahora));
  await env.DB.batch(lote);
}

// compara sin revelar por el tiempo de respuesta cuántos caracteres coinciden
async function igual(a, b) {
  const h = async (t) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)));
  const [x, y] = await Promise.all([h(a), h(b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

// Lectura con IA (facturas y dibujos para cotizar). Necesita la variable secreta ANTHROPIC_API_KEY.
//   GET  /api/ia   {disponible}
//   POST /api/ia   {prompt, imagenes:[{tipo, datos(base64)}], esquema?}  →  {texto}
// al pegar la clave en la terminal se pueden colar caracteres invisibles (Ctrl+Z, espacios, saltos de línea)
// y si quedó pegada dos veces seguidas, se usa una sola copia
const limpiarClave = (k) => {
  const c = String(k || "").replace(/[^!-~]/g, ""), m = c.length / 2;
  return c.length % 2 === 0 && c.slice(0, m) === c.slice(m) ? c.slice(0, m) : c;
};
const MAX_IA_BYTES = 12 * 1024 * 1024;
async function ia(request, env, metodo) {
  if (metodo === "GET") return json({ disponible: !!env.ANTHROPIC_API_KEY });
  if (metodo !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!env.ANTHROPIC_API_KEY) return json({ error: "La IA no está activada en el servidor" }, 501);
  const texto = await request.text();
  if (texto.length > MAX_IA_BYTES) return json({ error: "Las imágenes son demasiado grandes" }, 413);
  const { prompt, imagenes = [], esquema } = JSON.parse(texto);
  if (typeof prompt !== "string" || !prompt) return json({ error: "Falta el texto de la petición" }, 400);
  const content = [];
  for (const im of [].concat(imagenes).slice(0, 6))
    if (/^image\/(jpeg|png|webp|gif)$/.test(im?.tipo || "") && typeof im.datos === "string")
      content.push({ type: "image", source: { type: "base64", media_type: im.tipo, data: im.datos } });
  content.push({ type: "text", text: prompt.slice(0, 240000) });
  const client = new Anthropic({ apiKey: limpiarClave(env.ANTHROPIC_API_KEY) });
  try {
    const r = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", ...(esquema ? { format: { type: "json_schema", schema: esquema } } : {}) },
      messages: [{ role: "user", content }],
    });
    if (r.stop_reason === "refusal") return json({ error: "La IA no quiso procesar esta imagen" }, 422);
    const salida = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return json({ texto: salida, cortado: r.stop_reason === "max_tokens" });
  } catch (e) {
    const s = e instanceof Anthropic.APIError ? e.status : 0;
    return json({ error: e.message || "Error de la IA" }, s === 429 ? 429 : 502);
  }
}

// roles de las cuentas: admin (acceso total), usuario (socio y empleados), proyector (proyecciones del negocio)
const ROLES = ["admin", "usuario", "proyector", "contador", "auxiliar"];

async function validar(request, env) {
  const clave = request.headers.get("x-clave") || "";
  if (env.CUENTAS) {
    let cuentas;
    try { cuentas = JSON.parse(env.CUENTAS); } catch { return null; }
    // CUENTAS_EXTRA: cuentas agregadas después, sin tocar las de CUENTAS; {"usuario":{"baja":true}} cierra una cuenta
    if (env.CUENTAS_EXTRA) { try { const x = JSON.parse(env.CUENTAS_EXTRA); for (const k of Object.keys(x)) { if (x[k]?.baja) delete cuentas[k]; else if (!Object.hasOwn(cuentas, k)) cuentas[k] = x[k]; } } catch {} }
    const usuario = (request.headers.get("x-usuario") || "").trim().toLowerCase();
    const c = Object.hasOwn(cuentas, usuario) ? cuentas[usuario] : null;
    if (!c || !(await igual(clave, String(c.clave)))) return null;
    return { usuario, rol: ROLES.includes(c.rol) ? c.rol : "usuario", nombreCuenta: c.nombre || "", cuentas };
  }
  if (env.APP_CLAVE) return (await igual(clave, env.APP_CLAVE)) ? { usuario: null, rol: "admin" } : null;
  return { usuario: null, rol: "admin" };
}

// ---------- Rastreo: bitácora inalterable de lo que hace cada usuario y sesiones en línea ----------
let tablasListas = false;
async function tablas(env) {
  if (tablasListas) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS bitacora (n INTEGER PRIMARY KEY AUTOINCREMENT, f TEXT NOT NULL, usuario TEXT, nombre TEXT, accion TEXT, col TEXT, doc TEXT, resumen TEXT, ip TEXT, lugar TEXT, sid TEXT)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS bitacora_f ON bitacora (f)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS sesiones (sid TEXT PRIMARY KEY, usuario TEXT, nombre TEXT, desde TEXT, hasta TEXT, ip TEXT, lugar TEXT, lat REAL, lon REAL, prec REAL, gps INTEGER, disp TEXT, pantalla TEXT)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS sesiones_hasta ON sesiones (hasta)"),
  ]);
  tablasListas = true;
}
// nombre visible de cada usuario: el que ponga el administrador (config/usuarios) o el de la cuenta
async function nombresUsuarios(env) {
  const fila = await env.DB.prepare("SELECT data FROM docs WHERE col = 'config' AND id = 'usuarios'").first().catch(() => null);
  try { return (fila && JSON.parse(fila.data).nombres) || {}; } catch { return {}; }
}
const capital = (u) => String(u || "").replace(/\d+$/, "").replace(/^./, (x) => x.toUpperCase());
const lugarDe = (request) => { const c = request.cf || {}; return [c.city, c.region, c.country].filter(Boolean).join(", "); };
const ipDe = (request) => request.headers.get("cf-connecting-ip") || "";
// texto corto que identifica el documento en la bitácora
function resumenDe(col, d) {
  if (!d || typeof d !== "object") return "";
  const cli = typeof d.cliente === "object" ? d.cliente?.nombre : d.cliente;
  const partes = [d.numero, d.num && "N.º " + d.num, d.nombre, d.concepto, cli, d.tercero, d.proveedor, d.socio];
  const v = +d.valor || +d.total || 0;
  if (v) partes.push("$ " + Math.round(v).toLocaleString("es-CO"));
  return [...new Set(partes.filter((x) => x && typeof x === "string" || typeof x === "number").map(String))].join(" · ").slice(0, 200);
}
async function anotar(env, request, sesion, accion, col, doc, resumen) {
  if (col === "config") resumen = ({ precios: "Precios y materiales", contable: "Configuración contable", usuarios: "Nombres de los usuarios" })[doc] || "Configuración · " + doc;
  const f = new Date().toISOString(), sid = request.headers.get("x-sid") || "";
  // cambios seguidos del mismo documento (por ejemplo, ir editando una cotización) se juntan en una sola línea
  if (accion === "editó") {
    const r = await env.DB.prepare("UPDATE bitacora SET f = ?1, resumen = ?2 WHERE n = (SELECT n FROM bitacora WHERE usuario IS ?3 AND col = ?4 AND doc = ?5 AND accion = 'editó' AND f > ?6 ORDER BY n DESC LIMIT 1)")
      .bind(f, resumen, sesion.usuario, col, doc, new Date(Date.now() - 10 * 60e3).toISOString()).run();
    if (r.meta?.changes) return;
  }
  await env.DB.prepare("INSERT INTO bitacora (f, usuario, nombre, accion, col, doc, resumen, ip, lugar, sid) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)")
    .bind(f, sesion.usuario, sesion.nombre, accion, col, doc, resumen, ipDe(request), lugarDe(request), sid).run();
}
// sello de quién creó y quién editó, dentro del mismo documento
function sellar(data, previo, sesion) {
  const f = new Date().toISOString();
  if (previo && previo._creadoF) { data._creadoPor = previo._creadoPor; data._creadoNombre = previo._creadoNombre; data._creadoF = previo._creadoF; }
  else if (previo) { delete data._creadoPor; delete data._creadoNombre; delete data._creadoF; }
  else { data._creadoPor = sesion.usuario; data._creadoNombre = sesion.nombre; data._creadoF = f; }
  if (previo) { data._editadoPor = sesion.usuario; data._editadoNombre = sesion.nombre; data._editadoF = f; }
  else { delete data._editadoPor; delete data._editadoNombre; delete data._editadoF; }
  return data;
}
async function ping(request, env, sesion) {
  const b = await leerCuerpo(request).catch(() => ({}));
  const sid = String(b.sid || "").slice(0, 60);
  if (!/^[A-Za-z0-9_-]{6,60}$/.test(sid)) return json({ error: "sid" }, 400);
  const ahora = new Date().toISOString(), num = (x) => (Number.isFinite(+x) && x !== null && x !== "" ? +x : null);
  const cf = request.cf || {}, gps = num(b.lat) !== null && num(b.lon) !== null;
  const lat = gps ? num(b.lat) : num(cf.latitude), lon = gps ? num(b.lon) : num(cf.longitude);
  const disp = String(b.disp || "").slice(0, 80), pantalla = String(b.pantalla || "").slice(0, 60);
  const previa = await env.DB.prepare("SELECT hasta FROM sesiones WHERE sid = ?1").bind(sid).first();
  // si estuvo más de 5 minutos sin señal, empieza una sesión nueva
  if (previa && Date.parse(previa.hasta) > Date.now() - 5 * 60e3) {
    await env.DB.prepare("UPDATE sesiones SET hasta = ?2, nombre = ?3, ip = ?4, lugar = ?5, pantalla = ?6" + (gps ? ", lat = ?7, lon = ?8, prec = ?9, gps = 1" : "") + " WHERE sid = ?1")
      .bind(...[sid, ahora, sesion.nombre, ipDe(request), lugarDe(request), pantalla].concat(gps ? [lat, lon, num(b.prec)] : [])).run();
  } else {
    const nuevo = previa ? sid + "-" + Date.now().toString(36) : sid;
    if (previa) await env.DB.prepare("UPDATE sesiones SET sid = ?2 WHERE sid = ?1").bind(sid, nuevo).run();
    await env.DB.prepare("INSERT INTO sesiones (sid, usuario, nombre, desde, hasta, ip, lugar, lat, lon, prec, gps, disp, pantalla) VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)")
      .bind(sid, sesion.usuario, sesion.nombre, ahora, ipDe(request), lugarDe(request), lat, lon, gps ? num(b.prec) : null, gps ? 1 : 0, disp, pantalla).run();
    await anotar(env, request, sesion, "entró", "sesion", sid, [disp, lugarDe(request)].filter(Boolean).join(" · "));
  }
  return json({ ok: true });
}
// quién está conectado ahora (para el indicador de la barra de arriba)
async function enLinea(env, sesion) {
  if (sesion.rol !== "admin") return json({ error: "Solo el administrador" }, 403);
  const { results } = await env.DB.prepare("SELECT usuario, nombre, desde, hasta, disp, pantalla, lugar, gps FROM sesiones WHERE hasta >= ?1 ORDER BY desde").bind(new Date(Date.now() - 75e3).toISOString()).all();
  const nombres = await nombresUsuarios(env);
  return json({ ahora: new Date().toISOString(), sesiones: results.map((s) => ({ ...s, nombre: nombres[s.usuario] || s.nombre })) });
}
async function actividad(request, env, sesion) {
  if (sesion.rol !== "admin") return json({ error: "Solo el administrador puede ver la actividad de los usuarios" }, 403);
  const u = new URL(request.url), dias = Math.min(90, Math.max(1, +u.searchParams.get("dias") || 7));
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const [ses, bit] = await Promise.all([
    env.DB.prepare("SELECT * FROM sesiones WHERE hasta >= ?1 ORDER BY hasta DESC LIMIT 500").bind(desde).all(),
    env.DB.prepare("SELECT * FROM bitacora WHERE f >= ?1 ORDER BY n DESC LIMIT 2000").bind(desde).all(),
  ]);
  const nombres = await nombresUsuarios(env);
  const usuarios = sesion.cuentas ? Object.entries(sesion.cuentas).map(([k, c]) => ({ usuario: k, rol: ROLES.includes(c.rol) ? c.rol : "usuario", nombre: nombres[k] || c.nombre || capital(k) })) : [];
  return json({ ahora: new Date().toISOString(), usuarios, sesiones: ses.results, bitacora: bit.results });
}

export async function onRequest({ request, env, params }) {
  if (!env.DB) return json({ error: "Falta conectar la base de datos D1 con el nombre DB (revisa wrangler.toml)" }, 500);

  const sesion = await validar(request, env);
  if (!sesion) return json({ error: "Usuario o contraseña incorrectos" }, 401);
  await tablas(env);
  if (sesion.usuario) sesion.nombre = (await nombresUsuarios(env))[sesion.usuario] || sesion.nombreCuenta || capital(sesion.usuario);
  else sesion.nombre = "Administrador";

  const partes = [].concat(params.path || []);
  const [ruta, col, id] = partes;
  const metodo = request.method;
  let nombre = "";
  try { nombre = decodeURIComponent(request.headers.get("x-nombre") || "").slice(0, 60); } catch {}
  const por = sesion.usuario ? sesion.usuario + " · " + sesion.nombre : nombre || null;

  try {
    if (ruta === "sesion" && metodo === "GET") return json({ usuario: sesion.usuario, rol: sesion.rol, nombre: sesion.nombre });
    if (ruta === "ping" && metodo === "POST") return await ping(request, env, sesion);
    if (ruta === "actividad" && metodo === "GET") return await actividad(request, env, sesion);
    if (ruta === "enlinea" && metodo === "GET") return await enLinea(env, sesion);

    if (ruta === "ia") return await ia(request, env, metodo);

    if (ruta === "all" && metodo === "GET") {
      // las imágenes completas (archivos_img) se piden una por una al abrirlas
      await sembrar(env);
      const { results } = await env.DB.prepare("SELECT col, id, data FROM docs WHERE col <> 'archivos_img' AND col <> '_sistema' AND col <> 'publicas'").all();
      const out = {};
      for (const r of results) (out[r.col] ||= []).push({ id: r.id, data: JSON.parse(r.data) });
      return json(out);
    }

    if (ruta !== "docs" || !COLECCIONES.includes(col)) return json({ error: "Ruta no encontrada" }, 404);

    if (!id && metodo === "GET") {
      const { results } = await env.DB.prepare("SELECT id, data FROM docs WHERE col = ?1").bind(col).all();
      return json(results.map((r) => ({ id: r.id, data: JSON.parse(r.data) })));
    }
    if (!id || !ID_VALIDO.test(id)) return json({ error: "Identificador no válido" }, 400);

    const guardar = (data) =>
      env.DB.prepare(
        "INSERT INTO docs (col, id, data, updated, por) VALUES (?1, ?2, ?3, ?4, ?5) " +
          "ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated = excluded.updated, por = excluded.por"
      )
        .bind(col, id, JSON.stringify(data), new Date().toISOString(), por)
        .run();

    const soloAgregar = SOLO_AGREGAR.includes(col);
    if (soloAgregar && (metodo === "PATCH" || metodo === "DELETE"))
      return json({ error: "Registro inalterable: no se puede modificar ni borrar" }, 403);

    const accionDe = (previo) => (previo ? "editó" : "creó");
    if (metodo === "PUT") {
      const data = await leerCuerpo(request);
      const fila0 = col === "archivos_img" ? null : await env.DB.prepare("SELECT data FROM docs WHERE col = ?1 AND id = ?2").bind(col, id).first();
      const previo = fila0 ? JSON.parse(fila0.data) : null;
      if (col !== "config") sellar(data, previo, sesion);
      const anotarPut = () => anotar(env, request, sesion, col === "archivos_img" ? "subió" : accionDe(previo), col, id, col === "archivos_img" ? "Imagen" : resumenDe(col, data));
      if (soloAgregar) {
        // INSERT sin ON CONFLICT: si el registro ya existe, la base lo rechaza
        const r = await env.DB.prepare("INSERT OR IGNORE INTO docs (col, id, data, updated, por) VALUES (?1, ?2, ?3, ?4, ?5)")
          .bind(col, id, JSON.stringify(data), new Date().toISOString(), por).run();
        if (!r.meta?.changes) return json({ error: "Registro inalterable: ya existe" }, 409);
        await anotarPut();
        return json({ ok: true, data });
      }
      await guardar(data);
      await anotarPut();
      return json({ ok: true, data });
    }
    if (metodo === "PATCH") {
      const cambios = await leerCuerpo(request);
      const fila = await env.DB.prepare("SELECT data FROM docs WHERE col = ?1 AND id = ?2").bind(col, id).first();
      if (!fila) return json({ error: "El documento no existe" }, 400);
      const previo = JSON.parse(fila.data), data = col === "config" ? { ...previo, ...cambios } : sellar({ ...previo, ...cambios }, previo, sesion);
      await guardar(data);
      await anotar(env, request, sesion, "editó", col, id, resumenDe(col, data));
      return json({ ok: true, data });
    }
    if (metodo === "DELETE") {
      const fila = await env.DB.prepare("SELECT data FROM docs WHERE col = ?1 AND id = ?2").bind(col, id).first();
      if (fila) await anotar(env, request, sesion, "borró", col, id, col === "archivos_img" ? "Imagen" : resumenDe(col, JSON.parse(fila.data)));
      await env.DB.prepare("DELETE FROM docs WHERE col = ?1 AND id = ?2").bind(col, id).run();
      return json({ ok: true });
    }
    if (metodo === "GET") {
      const fila = await env.DB.prepare("SELECT data FROM docs WHERE col = ?1 AND id = ?2").bind(col, id).first();
      return fila ? json({ id, data: JSON.parse(fila.data) }) : json({ error: "No existe" }, 404);
    }
    return json({ error: "Método no permitido" }, 405);
  } catch (e) {
    return json({ error: e.message || "Error del servidor" }, 400);
  }
}
