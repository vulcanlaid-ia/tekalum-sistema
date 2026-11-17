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

// ---------- Candado de meses cerrados y balance de asientos, también en el servidor ----------
// El navegador (finanzas-pro2.js "guardián" y finanzas-pro3.js para nóminas) ya bloquea esto, pero esas reglas
// son JavaScript del navegador: una petición hecha directo a la API las salta. Aquí se repiten las mismas reglas
// (mismas fechas, mismas excepciones) para que valgan también si alguien llama a la API sin pasar por la pantalla.
const S_ = (s) => String(s ?? "");
const mesDe = (f) => S_(f).slice(0, 7);
async function leerCont(env) {
  const fila = await env.DB.prepare("SELECT data FROM docs WHERE col = 'config' AND id = 'contable'").first().catch(() => null);
  try { return fila ? JSON.parse(fila.data) : {}; } catch { return {}; }
}
const cerradoCon = (CONT, f) => !!f && !!(CONT.cierres && CONT.cierres[mesDe(f)]);
// mismas fechas relevantes que fechasDoc() del navegador (finanzas-pro2.js), para las colecciones portadas aquí
const fechasDocSrv = (col, d) => !d ? [] :
  col === "egresos" ? [d.f, d.pagado !== false && d.fPago, d.fAnticipo, ...((d.abonos || []).map((a) => a.f))] :
  col === "ingresos" ? [d.f, d.fCobro] :
  col === "maquinaria" ? [d.contab ? d.fAdq : "", d.baja?.f] :
  col === "cuentas" ? [d.fIni] :
  [d.f];
// mismos campos que se pueden tocar aun con la fecha base en un mes cerrado (permitidos, en finanzas-pro2.js)
const PERMITIDOS_CERRADO = {
  egresos: ["pagado", "fPago", "fPagoReg", "cuenta", "pagoId", "abonos", "anticipo", "fAnticipo"],
  ingresos: ["cobrado", "fCobro", "cuenta"],
  maquinaria: ["baja", "notas", "estado", "foto", "marca", "ubicacion"],
};
const COLS_CIERRE = ["ingresos", "egresos", "traslados", "inversion", "asientos", "ventas", "notasdoc", "maquinaria", "cuentas"];
// mismos campos "volátiles" que no cuentan como cambio real (VOLATILES en finanzas-pro2.js)
const VOLATILES_SRV = new Set(["_editadoPor", "_editadoNombre", "_editadoF", "_creadoPor", "_creadoNombre", "_creadoF", "editado", "editadoPor", "vistas", "vistaCliente", "ultimaVista", "token", "enviada", "fe", "eventos"]);
function limpioSrv(o) {
  const r = {};
  for (const [k, v] of Object.entries(o || {})) if (!VOLATILES_SRV.has(k) && k !== "id") r[k] = v;
  return r;
}
// el documento sin los sellos que pone el servidor (quién lo creó y quién lo editó): para saber si un reenvío es idéntico
const SELLOS = new Set(["_creadoPor", "_creadoNombre", "_creadoF", "_editadoPor", "_editadoNombre", "_editadoF"]);
const sinSellos = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !SELLOS.has(k)));
// comparación de dos documentos que no dependa del orden en que quedaron las llaves (JSON.stringify sí lo distingue,
// y sellar() agrega _editadoPor/_editadoNombre/_editadoF al final del documento nuevo, en un orden que no tenía el viejo)
function canon(o) {
  if (Array.isArray(o)) return "[" + o.map(canon).join(",") + "]";
  if (o && typeof o === "object") {
    const claves = Object.keys(o).filter((k) => o[k] !== undefined).sort();
    return "{" + claves.map((k) => JSON.stringify(k) + ":" + canon(o[k])).join(",") + "}";
  }
  return JSON.stringify(o);
}
// un asiento manual (comprobante contable) debe tener al menos 2 líneas y cuadrar débito con crédito, redondeando cada línea
// (igual que asientosTodos() en cotizador.html: si se compara la suma sin redondear, un asiento puede "cuadrar" y quedar
// descuadrado en el libro mayor al redondear línea por línea)
function balanceValido(data) {
  if (!data || data.estado === "borrador") return true;
  const L = (data.lineas || []).filter((l) => Math.round(l?.d || 0) || Math.round(l?.c || 0));
  if (L.length < 2) return false;
  const D = L.reduce((s, l) => s + Math.round(l.d || 0), 0), C = L.reduce((s, l) => s + Math.round(l.c || 0), 0);
  return D === C && D > 0;
}
// data === null  →  es un borrado. previo es el documento tal como estaba guardado (o null si es nuevo).
async function revisarCierreServidor(env, col, data, previo) {
  if (col === "asientos" && data && !balanceValido(data))
    return "El asiento debe tener al menos dos líneas y cuadrar débitos con créditos (o guardarlo como borrador).";
  if (col === "nominas") return revisarNominaServidor(await leerCont(env), data, previo);
  if (!COLS_CIERRE.includes(col)) return null;
  const CONT = await leerCont(env);
  const cerrado = (f) => cerradoCon(CONT, f);
  if (!previo && data) {
    const f = fechasDocSrv(col, data).find((x) => x && cerrado(x));
    if (f) return "Ese mes está cerrado en Contabilidad: no se pueden registrar movimientos nuevos ahí. Pide que lo reabran.";
    return null;
  }
  if (previo && !data) {
    const f = fechasDocSrv(col, previo).find((x) => x && cerrado(x));
    if (f) return "Ese mes está cerrado en Contabilidad: no se puede borrar.";
    return null;
  }
  if (!previo || !data) return null;
  const fOld = fechasDocSrv(col, previo).filter(Boolean), fNew = fechasDocSrv(col, data).filter(Boolean);
  const fBase = [previo.f];
  if (fBase.some(cerrado)) {
    const a = limpioSrv(previo), b = limpioSrv(data);
    const cambios = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null));
    const permitidos = PERMITIDOS_CERRADO[col] || [];
    const malos = cambios.filter((k) => !permitidos.includes(k));
    if (malos.length) return "Ese mes está cerrado en Contabilidad: no se puede cambiar (" + malos.slice(0, 3).join(", ") + "). Pide que lo reabran.";
  }
  const nuevas = fNew.filter((f) => !fOld.includes(f));
  if (nuevas.some(cerrado)) return "No se puede registrar un pago o movimiento con fecha de un mes cerrado.";
  return null;
}
// mismo candado de finanzas-pro3.js para la colección "nominas"
function revisarNominaServidor(CONT, data, previo) {
  const cerr = (f) => cerradoCon(CONT, f);
  if (data === null) {
    if (previo && previo.estado !== "borrador" && previo.tipo === "nomina") return "Una nómina contabilizada no se borra: se anula.";
    if (previo && previo.tipo !== "nomina" && cerr(previo.f)) return "Ese mes está cerrado: no se puede borrar.";
    return null;
  }
  if (previo && previo.estado === "contabilizada" && cerr(previo.f)) {
    // comparación sin depender del orden de las llaves: sellar() agrega _editadoPor/_editadoNombre/_editadoF
    // en el documento nuevo en un orden distinto al que tenía el documento viejo, y JSON.stringify sí distingue ese orden
    const a = canon({ ...previo, pagos: undefined, _editadoF: undefined, _editadoPor: undefined, _editadoNombre: undefined });
    const b = canon({ ...data, pagos: undefined, _editadoF: undefined, _editadoPor: undefined, _editadoNombre: undefined });
    if (a !== b) return "Ese mes está cerrado en Contabilidad: esta nómina no se puede cambiar.";
  }
  const nuevosPagos = (data.pagos || []).filter((p) => !(previo?.pagos || []).some((o) => o.id === p.id));
  if (nuevosPagos.some((p) => cerr(p.f))) return "No se puede registrar un pago con fecha de un mes cerrado.";
  if ((!previo || previo.estado !== "contabilizada") && data.estado !== "borrador" && cerr(data.f))
    return "Ese mes está cerrado en Contabilidad. Pide que lo reabran.";
  return null;
}

// ---------- Permisos por rol (lo que cada persona puede hacer, aplicado aquí y no solo en la pantalla) ----------
// Roles (se asignan en el secreto CUENTAS de Cloudflare):
//   admin     → todo.
//   contador  → Finanzas completa, incluido cerrar y reabrir meses y años. Es el único que corrige lo ya registrado.
//   auxiliar  → Finanzas, pero solo registra: ingresos, egresos, traslados, ventas, compras, conciliar el banco.
//               No cambia ni borra lo ya guardado (para que nadie "cuadre" números), no cierra, no hace notas ni asientos.
//   usuario   → sistema de gestión (cotizador, bodega, proveedores, órdenes). Sin acceso a Finanzas; no ve nóminas.
//   proyector → como "usuario" en la gestión, y Finanzas en solo consulta (incluida la nómina).
// Niveles por colección:  rw = crear, cambiar y borrar · cu = crear y cambiar · c = solo crear · r = solo leer · - = ni verla.
// Un "*" al final significa que además aplican condiciones propias (ver condicion()).
const ROL_TXT = { admin: "Administrador", contador: "Contador", auxiliar: "Auxiliar contable", usuario: "Gestión", proyector: "Gerencia" };
const G_GESTION = ["cotizaciones", "ordenes", "retazos", "proveedores", "bodega", "aprendizaje", "referencias", "conjuntos", "sistemas", "personalizadas"];
const G_FIN = ["ingresos", "egresos", "traslados", "inversion", "ventas", "notasdoc", "asientos", "cuentas", "nominas", "personal", "terceros", "items", "compras", "maquinaria"];
const G_LIBRES = ["archivos", "archivos_img", "publicas"];
const G_AGREGAR = ["auditoria", "caja", "chatarra"];
const lote = (cols, nv) => Object.fromEntries(cols.map((c) => [c, nv]));
const BASE_GESTION = { ...lote(G_GESTION, "rw"), ...lote(G_FIN, "r"), ingresos: "c*", egresos: "c*", compras: "rw*", maquinaria: "rw*", ...lote(G_LIBRES, "rw"), ...lote(G_AGREGAR, "c") };
const NIVELES = {
  contador: { ...lote(G_GESTION, "r"), bodega: "rw", ...lote(G_FIN, "rw"), ...lote(G_LIBRES, "rw"), ...lote(G_AGREGAR, "c") },
  auxiliar: {
    ...lote(G_GESTION, "r"), ...lote(G_FIN, "r"),
    ingresos: "c*", egresos: "c*", traslados: "c", inversion: "c", ventas: "cu*", terceros: "cu", items: "c", compras: "rw*", maquinaria: "rw*",
    ...lote(G_LIBRES, "rw"), ...lote(G_AGREGAR, "c"),
  },
  usuario: { ...BASE_GESTION, nominas: "-" },
  proyector: { ...BASE_GESTION },
};
const nivelDe = (rol, col) => (rol === "admin" ? "rw" : NIVELES[rol]?.[col] ?? "r");
const tablaAcceso = (rol) => Object.fromEntries(COLECCIONES.map((c) => [c, nivelDe(rol, c)]));
const FIN_SET = new Set(G_FIN);
// de "personal" (que ahora trae salario, documento, EPS…) el rol de gestión solo ve lo que necesita para asignar órdenes
const PERSONAL_PUBLICO = ["nombre", "rol", "area", "telefono", "autoriza", "activo", "_creadoPor", "_creadoNombre", "_creadoF", "_editadoPor", "_editadoNombre", "_editadoF"];
function filtrarLectura(rol, col, filas) {
  if (rol === "admin") return filas;
  const nv = nivelDe(rol, col);
  if (nv === "-") return [];
  if (col === "personal" && rol === "usuario")
    return filas.map((f) => ({ id: f.id, data: Object.fromEntries(Object.entries(f.data || {}).filter(([k]) => PERSONAL_PUBLICO.includes(k))) }));
  return filas;
}

const msgFijo = (rol) => `Tu rol (${ROL_TXT[rol]}) puede registrar movimientos nuevos, pero no cambiarlos ni borrarlos, para que lo registrado no se altere. Si hay un error, avisa al contador para que lo corrija con una nota o un ajuste.`;
const msgFin = (rol) => `Tu rol (${ROL_TXT[rol]}) no puede registrar ni cambiar movimientos de Finanzas.`;
const msgContab = "Este equipo ya está en la contabilidad como activo fijo: su valor, fecha, vida útil o baja los cambia el contador.";
function msgLectura(rol, col) {
  if (FIN_SET.has(col) && (rol === "usuario" || rol === "proyector")) return `Tu rol (${ROL_TXT[rol]}) solo puede consultar Finanzas: no puede registrar ni cambiar nada ahí.`;
  if (rol === "auxiliar" && ["notasdoc", "asientos", "cuentas", "nominas", "personal"].includes(col)) return `Tu rol (${ROL_TXT[rol]}) no hace este movimiento: lo hace el contador (notas, asientos, cuentas, nómina y empleados).`;
  if (G_GESTION.includes(col)) return `Tu rol (${ROL_TXT[rol]}) solo puede consultar el sistema de gestión (cotizaciones, bodega, proveedores): no puede cambiarlo.`;
  return `Tu rol (${ROL_TXT[rol]}) solo puede consultar esta información, no cambiarla.`;
}
// qué claves cambiaron entre dos versiones de un documento (sin contar los sellos de autor y demás campos que no son contables)
function cambiosDe(previo, data) {
  const a = limpioSrv(previo), b = limpioSrv(data);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => canon(a[k] ?? null) !== canon(b[k] ?? null));
}
async function tieneEgresos(env, compraId) {
  const f = await env.DB.prepare("SELECT 1 AS ok FROM docs WHERE col = 'egresos' AND json_extract(data, '$.compraId') = ?1 LIMIT 1").bind(compraId).first();
  return !!f;
}
const CAMPOS_COBRO = ["cobrado", "causado", "fCobro", "cuenta"];
const CAMPOS_PAGO = ["pagado", "fPago", "fPagoReg", "cuenta", "pagoId", "abonos", "anticipo", "fAnticipo"];
const CAMPOS_CAUSA = ["destino", "cat", "venc", "causaModo", "causadaPor", "ctaLineas", "sinConta", "aporteId", "aporteSocio"];
const CAMPOS_ACTIVO = ["contab", "valor", "fAdq", "vidaAnios", "grupo", "clase", "cantidad", "baja"];
// reglas propias de cada colección para los roles que no tienen acceso total
async function condicion(env, rol, col, id, previo, data, borrar) {
  const nuevo = !previo && !borrar, aux = rol === "auxiliar";
  const cam = previo && data && !borrar ? cambiosDe(previo, data) : [];
  switch (col) {
    case "ingresos":
      if (nuevo) return aux || data.tipo === "chatarra" ? null : msgFin(rol);   // gestión solo registra la venta de chatarra
      if (!aux) return msgFin(rol);
      if (borrar) return msgFijo(rol);
      if (!cam.length) return null;
      // cobrar algo que estaba a crédito
      return previo.cobrado === false && data.cobrado === true && cam.every((k) => CAMPOS_COBRO.includes(k)) ? null : msgFijo(rol);
    case "egresos":
      if (nuevo) return aux || data.compraId ? null : msgFin(rol);   // gestión solo contabiliza sus compras a bodega
      if (!aux) return msgFin(rol);
      if (borrar) return msgFijo(rol);
      if (!cam.length) return null;
      // registrar un pago o un abono de algo que estaba por pagar, sin tocar el valor ni cambiar un pago ya hecho
      if (!cam.every((k) => CAMPOS_PAGO.includes(k))) return msgFijo(rol);
      if (cam.includes("pagado") && !(previo.pagado === false && data.pagado === true)) return msgFijo(rol);
      if (previo.pagado !== false && cam.some((k) => ["pagado", "fPago", "fPagoReg", "cuenta", "pagoId"].includes(k))) return msgFijo(rol);
      if (cam.includes("abonos")) {
        const A = previo.abonos || [], B = data.abonos || [];
        if (B.length < A.length || A.some((x, i) => canon(x) !== canon(B[i]))) return msgFijo(rol);
      }
      if (cam.some((k) => k === "anticipo" || k === "fAnticipo") && +previo.anticipo) return msgFijo(rol);
      return null;
    case "ventas":
      if (nuevo) return aux ? null : msgFin(rol);
      if (!aux) return msgFin(rol);
      if (borrar) return previo.estado === "borrador" ? null : msgFijo(rol);
      if (previo.estado === "borrador") return data.estado === "anulada" ? msgFijo(rol) : null;   // un borrador se puede completar y contabilizar
      return cam.length ? msgFijo(rol) : null;                                                    // lo contabilizado no se toca (anular es del contador)
    case "compras": {
      if (nuevo) return null;
      if (!(await tieneEgresos(env, id))) return null;                // aún sin causar: se puede corregir (por ejemplo, lo que leyó la IA)
      if (borrar) return "Esta factura ya está causada en Finanzas: no se puede borrar. Pide al contador que la corrija con una nota.";
      return cam.every((k) => CAMPOS_CAUSA.includes(k)) ? null : "Esta factura ya está causada en Finanzas: no se puede cambiar su valor, fecha ni proveedor. Corrígela con una nota crédito o débito (pídela al contador).";
    }
    case "maquinaria":
      if (nuevo) return aux || !data.contab ? null : msgContab;        // la gestión registra equipos; entrar a la contabilidad es del contador
      if (borrar) return aux ? msgFijo(rol) : previo.contab ? msgContab : null;
      if (previo.contab) return cam.some((k) => CAMPOS_ACTIVO.includes(k)) ? msgContab : null;
      return !aux && data.contab ? msgContab : null;
    default:
      return null;
  }
}
// configuración: precios (gestión), contable (Finanzas) y usuarios (solo admin)
const CONT_PERMITIDO = { auxiliar: ["numAsig", "reglasProv", "causaModo", "conc"], usuario: ["numAsig", "reglasProv"], proyector: ["numAsig", "reglasProv"] };
function permisoContable(rol, data, previo) {
  if (rol === "contador") return null;
  const a = previo || {}, b = data || {}, ok = CONT_PERMITIDO[rol] || [];
  const cambiadas = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => canon(a[k] ?? null) !== canon(b[k] ?? null));
  const malas = cambiadas.filter((k) => !ok.includes(k));
  if (malas.some((k) => k === "cierres" || k === "cierresAnio")) return "Solo el contador cierra o reabre los meses y los años.";
  if (malas.length) return `Tu rol (${ROL_TXT[rol]}) no cambia la configuración contable (${malas.slice(0, 3).join(", ")}). Si no tocaste nada, recarga la página: tu copia puede estar desactualizada.`;
  if (cambiadas.includes("conc")) {
    const A = a.conc || {}, B = b.conc || {};
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const x = A[k] || {}, y = B[k] || {};
      if (canon(x) === canon(y)) continue;
      if (x.cerrada || canon(x.cerrada ?? null) !== canon(y.cerrada ?? null) || canon(x.historial ?? null) !== canon(y.historial ?? null))
        return "Solo el contador cierra o reabre una conciliación bancaria.";
    }
  }
  return null;
}
function permisoConfig(rol, id, data, previo, borrar) {
  if (borrar) return "Solo el administrador puede borrar la configuración.";
  if (id === "precios") return rol === "contador" || rol === "usuario" || rol === "proyector" ? null : `Tu rol (${ROL_TXT[rol]}) no cambia los precios y costos del taller.`;
  if (id === "contable") return permisoContable(rol, data, previo);
  return "Solo el administrador cambia esta configuración (usuarios y nombres).";
}
// devuelve el mensaje de por qué NO se permite, o null si se permite. previo = documento guardado (null si es nuevo); data = null si es un borrado
async function revisarPermiso(env, sesion, col, id, data, previo, borrar) {
  const rol = sesion.rol;
  if (rol === "admin") return null;
  if (col === "config") return permisoConfig(rol, id, data, previo, borrar);
  const nv = nivelDe(rol, col), base = nv.replace("*", "");
  if (nv.endsWith("*")) return condicion(env, rol, col, id, previo, data, borrar);
  if (base === "rw") return null;
  if (base === "r" || base === "-") return msgLectura(rol, col);
  if (base === "cu") return borrar ? msgFijo(rol) : null;
  if (base === "c") return previo || borrar ? msgFijo(rol) : null;
  return null;
}
const ID_VALIDO = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
const MAX_BYTES = 1024 * 1024;

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

// ---------- Sincronización liviana: la pantalla no baja todo cada 15 s, solo pregunta si algo cambió ----------
// versión = cuántos documentos hay y cuál es la fecha del último cambio (sobre lo que este rol puede ver)
const SYNC_FUERA = ["archivos_img", "_sistema", "publicas"];
function filtroSync(rol) {
  const ocultas = [...SYNC_FUERA, ...COLECCIONES.filter((c) => nivelDe(rol, c) === "-")];
  return { sql: ocultas.map((_, i) => "?" + (i + 1)).join(","), args: ocultas };
}
async function versionDe(env, rol) {
  const f = filtroSync(rol);
  const r = await env.DB.prepare("SELECT count(*) AS n, max(updated) AS u FROM docs WHERE col NOT IN (" + f.sql + ")").bind(...f.args).first();
  return { n: r?.n || 0, u: r?.u || "" };
}
function agrupar(filas, rol) {
  const out = {};
  for (const r of filas) (out[r.col] ||= []).push({ id: r.id, data: JSON.parse(r.data) });
  for (const c of Object.keys(out)) { out[c] = filtrarLectura(rol, c, out[c]); if (!out[c].length) delete out[c]; }
  return out;
}

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
    if (ruta === "sesion" && metodo === "GET") return json({ usuario: sesion.usuario, rol: sesion.rol, nombre: sesion.nombre, acceso: tablaAcceso(sesion.rol) });
    if (ruta === "ping" && metodo === "POST") return await ping(request, env, sesion);
    if (ruta === "actividad" && metodo === "GET") return await actividad(request, env, sesion);
    if (ruta === "enlinea" && metodo === "GET") return await enLinea(env, sesion);

    if (ruta === "ia") return await ia(request, env, metodo);

    if (ruta === "version" && metodo === "GET") return json(await versionDe(env, sesion.rol));
    if (ruta === "cambios" && metodo === "GET") {
      // solo los documentos tocados desde la fecha dada (se repiten los del mismo instante por si hubo dos cambios juntos)
      const desde = new URL(request.url).searchParams.get("desde") || "";
      const ver = await versionDe(env, sesion.rol), f = filtroSync(sesion.rol);
      const { results } = await env.DB.prepare("SELECT col, id, data FROM docs WHERE col NOT IN (" + f.sql + ") AND updated >= ?" + (f.args.length + 1)).bind(...f.args, desde).all();
      const por = agrupar(results, sesion.rol), docs = [];
      for (const [col, L] of Object.entries(por)) for (const d of L) docs.push({ col, id: d.id, data: d.data });
      return json({ ver, docs });
    }
    if (ruta === "all" && metodo === "GET") {
      // las imágenes completas (archivos_img) se piden una por una al abrirlas
      await sembrar(env);
      const verAll = await versionDe(env, sesion.rol); // se mide ANTES de leer: si algo cambia en medio, la próxima consulta lo trae
      const { results } = await env.DB.prepare("SELECT col, id, data FROM docs WHERE col <> 'archivos_img' AND col <> '_sistema' AND col <> 'publicas'").all();
      const out = {};
      for (const r of results) (out[r.col] ||= []).push({ id: r.id, data: JSON.parse(r.data) });
      for (const c of Object.keys(out)) { out[c] = filtrarLectura(sesion.rol, c, out[c]); if (!out[c].length && nivelDe(sesion.rol, c) === "-") delete out[c]; }
      return json(out, 200, { "x-ver": JSON.stringify(verAll) });
    }

    if (ruta !== "docs" || !COLECCIONES.includes(col)) return json({ error: "Ruta no encontrada" }, 404);

    if (!id && metodo === "GET") {
      const { results } = await env.DB.prepare("SELECT id, data FROM docs WHERE col = ?1").bind(col).all();
      return json(filtrarLectura(sesion.rol, col, results.map((r) => ({ id: r.id, data: JSON.parse(r.data) }))));
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
      // si ya está guardado exactamente así (un reenvío al volver el internet), no se vuelve a escribir ni a anotar
      if (previo && col !== "archivos_img" && !SOLO_AGREGAR.includes(col) && canon(sinSellos(previo)) === canon(sinSellos(data))) return json({ ok: true, data }); // se devuelve lo que mandó, no lo guardado
      const errPerm = await revisarPermiso(env, sesion, col, id, data, previo, false);
      if (errPerm) return json({ error: errPerm }, 403);
      const errCierre = await revisarCierreServidor(env, col, data, previo);
      if (errCierre) return json({ error: errCierre }, 403);
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
      const errPerm = await revisarPermiso(env, sesion, col, id, data, previo, false);
      if (errPerm) return json({ error: errPerm }, 403);
      const errCierre = await revisarCierreServidor(env, col, data, previo);
      if (errCierre) return json({ error: errCierre }, 403);
      await guardar(data);
      await anotar(env, request, sesion, "editó", col, id, resumenDe(col, data));
      return json({ ok: true, data });
    }
    if (metodo === "DELETE") {
      const fila = await env.DB.prepare("SELECT data FROM docs WHERE col = ?1 AND id = ?2").bind(col, id).first();
      const previo = fila ? JSON.parse(fila.data) : null;
      if (previo) {
        const errPerm = await revisarPermiso(env, sesion, col, id, null, previo, true);
        if (errPerm) return json({ error: errPerm }, 403);
        const errCierre = await revisarCierreServidor(env, col, null, previo);
        if (errCierre) return json({ error: errCierre }, 403);
      }
      if (fila) await anotar(env, request, sesion, "borró", col, id, col === "archivos_img" ? "Imagen" : resumenDe(col, previo));
      await env.DB.prepare("DELETE FROM docs WHERE col = ?1 AND id = ?2").bind(col, id).run();
      return json({ ok: true });
    }
    if (metodo === "GET") {
      const fila = await env.DB.prepare("SELECT data FROM docs WHERE col = ?1 AND id = ?2").bind(col, id).first();
      const visible = fila ? filtrarLectura(sesion.rol, col, [{ id, data: JSON.parse(fila.data) }])[0] : null;
      return visible ? json(visible) : json({ error: "No existe" }, 404);
    }
    return json({ error: "Método no permitido" }, 405);
  } catch (e) {
    return json({ error: e.message || "Error del servidor" }, 400);
  }
}
