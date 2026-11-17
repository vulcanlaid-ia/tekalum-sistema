// Prueba de los permisos por rol contra el manejador real de la API, con SQLite en memoria (imita D1).
// Uso: node prueba-permisos.mjs
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

const sq = new DatabaseSync(":memory:");
sq.exec(fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
sq.exec("INSERT INTO docs (col,id,data,updated) VALUES ('_sistema','sembrado','{}','x')");
const ord = (sql, a) => [...sql.matchAll(/\?(\d+)/g)].map((m) => { const v = a[+m[1] - 1]; return v === undefined ? null : v; });
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  run: async () => { const r = sq.prepare(sql.replace(/\?(\d+)/g, "?")).run(...ord(sql, args)); return { meta: { changes: r.changes } }; },
  first: async () => sq.prepare(sql.replace(/\?(\d+)/g, "?")).get(...ord(sql, args)) ?? null,
  all: async () => ({ results: sq.prepare(sql.replace(/\?(\d+)/g, "?")).all(...ord(sql, args)) }),
});
const DB = { prepare: (sql) => stmt(sql), batch: async (L) => { for (const s of L) await s.run(); } };
const CUENTAS = {
  jefe: { clave: "j", rol: "admin" }, osw: { clave: "o", rol: "contador", nombre: "Oswaldo" },
  car: { clave: "c", rol: "auxiliar", nombre: "Carolina" }, cris: { clave: "x", rol: "usuario", nombre: "Cristian" },
  ger: { clave: "g", rol: "proyector", nombre: "Gerardo" },
};
const env = { DB, CUENTAS: JSON.stringify(CUENTAS) };
const { onRequest } = await import("./functions/api/[[path]].js");

const sembrar = (col, id, data) => sq.prepare("INSERT OR REPLACE INTO docs (col,id,data,updated) VALUES (?,?,?,?)").run(col, id, JSON.stringify(data), "x");
const leer = (col, id) => { const f = sq.prepare("SELECT data FROM docs WHERE col=? AND id=?").get(col, id); return f ? JSON.parse(f.data) : null; };
const pedir = async (u, metodo, ruta, body) => {
  const p = ruta.replace(/^\/api\//, "").split("/").map(decodeURIComponent);
  const r = await onRequest({ request: Object.assign(new Request("http://x" + ruta, { method: metodo, headers: { "x-usuario": u, "x-clave": CUENTAS[u].clave, "x-sid": "s", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }), { cf: {} }), env, params: { path: p } });
  return { s: r.status, b: await r.json() };
};
let ok = 0; const fallos = [];
const esperar = (nombre, r, estado) => { const bien = estado === "ok" ? r.s === 200 : r.s === 403; if (bien) ok++; else fallos.push(`${nombre} → esperaba ${estado === "ok" ? 200 : 403}, dio ${r.s} ${JSON.stringify(r.b).slice(0, 140)}`); };
const PUT = (u, col, id, d) => pedir(u, "PUT", `/api/docs/${col}/${id}`, d);
const DEL = (u, col, id) => pedir(u, "DELETE", `/api/docs/${col}/${id}`);
const PATCH = (u, col, id, d) => pedir(u, "PATCH", `/api/docs/${col}/${id}`, d);

// ---- datos de partida ----
sembrar("config", "contable", { cierres: { "2026-09": { f: "2026-09-30" } }, conc: { "b1|2026-10": { ok: { a: true } }, "b1|2026-09": { ok: {}, cerrada: { f: "2026-09-30", por: "Oswaldo" } } }, reglasProv: {}, numAsig: {}, mapa: {} });
sembrar("config", "precios", { operacion: {} });
sembrar("config", "usuarios", { nombres: {} });
sembrar("egresos", "eg-pagado", { f: "2026-11-02", cat: "servicios", valor: 100000, tercero: "Luz", pagado: true, cuenta: "c1", fPago: "2026-11-02" });
sembrar("egresos", "eg-credito", { f: "2026-11-03", cat: "materiales", valor: 500000, tercero: "Prov", pagado: false, compraId: "co-causada" });
sembrar("ingresos", "ing-pagado", { f: "2026-11-02", tipo: "contado", valor: 80000, cliente: "Ana", cobrado: true, cuenta: "c1" });
sembrar("ingresos", "ing-credito", { f: "2026-11-02", tipo: "servicio", valor: 90000, cliente: "Bea", cobrado: false });
sembrar("ventas", "v-borr", { f: "2026-11-04", estado: "borrador", cliente: "Ana", lineas: [] });
sembrar("ventas", "v-cont", { f: "2026-11-04", estado: "contabilizada", cliente: "Ana", num: "CC-0001", lineas: [] });
sembrar("compras", "co-causada", { fecha: "2026-11-03", proveedor: "Prov", total: 500000, documento: "F1" });
sembrar("compras", "co-libre", { fecha: "2026-11-03", proveedor: "Prov2", total: 100000, documento: "F2" });
sembrar("maquinaria", "maq-contab", { nombre: "Cortadora", contab: "compra", valor: 2000000, fAdq: "2026-10-01", foto: "" });
sembrar("maquinaria", "maq-libre", { nombre: "Taladro", valor: 300000 });
sembrar("personal", "p1", { nombre: "Carlos", rol: "Armador", salario: 1750905, doc: "100", eps: "X", activo: true, autoriza: false });
sembrar("nominas", "n1", { tipo: "nomina", f: "2026-11-15", estado: "contabilizada", lineas: [], pagos: [] });
sembrar("cotizaciones", "q1", { numero: "COT-1", cliente: { nombre: "Z" } });

// =================== sesión y lectura ===================
{
  const s = await pedir("car", "GET", "/api/sesion");
  esperar("sesión de la auxiliar trae su tabla de acceso", { s: s.s === 200 && s.b.acceso?.ingresos === "c*" && s.b.acceso?.asientos === "r" ? 200 : 0, b: s.b }, "ok");
  const c = await pedir("cris", "GET", "/api/all");
  esperar("Cristian no ve las nóminas", { s: c.s === 200 && !c.b.nominas ? 200 : 0, b: Object.keys(c.b) }, "ok");
  const pc = c.b.personal?.[0]?.data || {};
  esperar("Cristian ve al empleado pero sin salario ni documento", { s: pc.nombre === "Carlos" && pc.salario === undefined && pc.doc === undefined && pc.eps === undefined ? 200 : 0, b: pc }, "ok");
  esperar("Cristian no puede leer la colección nóminas directo", { s: (await pedir("cris", "GET", "/api/docs/nominas")).b.length === 0 ? 200 : 0, b: 0 }, "ok");
  const g = await pedir("ger", "GET", "/api/all");
  esperar("Gerardo sí ve las nóminas y el salario", { s: g.b.nominas?.length === 1 && g.b.personal?.[0]?.data?.salario === 1750905 ? 200 : 0, b: 0 }, "ok");
  const a = await pedir("car", "GET", "/api/all");
  esperar("la auxiliar ve nóminas (las necesita para el saldo del banco)", { s: a.b.nominas?.length === 1 ? 200 : 0, b: 0 }, "ok");
}

// =================== CONTADOR (Oswaldo) ===================
esperar("contador: registrar un ingreso", await PUT("osw", "ingresos", "i-osw", { f: "2026-11-10", tipo: "contado", valor: 1000, cliente: "X", cobrado: true }), "ok");
esperar("contador: corregir el valor de un ingreso", await PUT("osw", "ingresos", "i-osw", { f: "2026-11-10", tipo: "contado", valor: 1200, cliente: "X", cobrado: true }), "ok");
await PUT("osw", "egresos", "e-osw", { f: "2026-11-10", cat: "servicios", valor: 100, tercero: "T", pagado: true, cuenta: "c1", fPago: "2026-11-10" });
esperar("contador: borrar un egreso del mes abierto", await DEL("osw", "egresos", "e-osw"), "ok");
esperar("contador: hacer un asiento", await PUT("osw", "asientos", "a1", { f: "2026-11-10", estado: "contabilizado", lineas: [{ cta: "5195", d: 100, c: 0 }, { cta: "1105", d: 0, c: 100 }] }), "ok");
esperar("contador: crear una nota crédito", await PUT("osw", "notasdoc", "n-osw", { f: "2026-11-10", tipo: "NCV", estado: "contabilizada" }), "ok");
esperar("contador: liquidar nómina", await PUT("osw", "nominas", "n2", { tipo: "nomina", f: "2026-11-30", estado: "borrador", lineas: [] }), "ok");
esperar("contador: crear una cuenta bancaria", await PUT("osw", "cuentas", "cu1", { nombre: "Banco" }), "ok");
esperar("contador: registrar un empleado con salario", await PUT("osw", "personal", "p2", { nombre: "Dora", salario: 2000000 }), "ok");
esperar("contador: cerrar un mes", await PUT("osw", "config", "contable", { ...leer("config", "contable"), cierres: { "2026-09": { f: "x" }, "2026-10": { f: "2026-10-31" } } }), "ok");
esperar("contador: reabrir un mes", await PUT("osw", "config", "contable", { ...leer("config", "contable"), cierres: { "2026-09": { f: "x" } } }), "ok");
esperar("contador: cambiar el mapa de cuentas", await PUT("osw", "config", "contable", { ...leer("config", "contable"), mapa: { x: "1" } }), "ok");
esperar("contador: cerrar una conciliación", await PUT("osw", "config", "contable", { ...leer("config", "contable"), conc: { ...leer("config", "contable").conc, "b1|2026-11": { ok: {}, cerrada: { f: "x", por: "O" } } } }), "ok");
esperar("contador: cambiar costos del taller (precios)", await PUT("osw", "config", "precios", { operacion: { a: 1 } }), "ok");
esperar("contador: movimiento de bodega (devolución a proveedor)", await PUT("osw", "bodega", "b-osw", { cantidad: 1, mov: [] }), "ok");
esperar("contador NO edita cotizaciones", await PUT("osw", "cotizaciones", "q1", { numero: "COT-1", cliente: { nombre: "Cambiado" } }), "no");
esperar("contador NO cambia los usuarios", await PUT("osw", "config", "usuarios", { nombres: { osw: "x" } }), "no");
esperar("contador: un mes cerrado sigue cerrado (hay que reabrirlo)", await PUT("osw", "ingresos", "i-cerrado", { f: "2026-09-10", tipo: "contado", valor: 5, cobrado: true }), "no");

// =================== AUXILIAR (Carolina, Lina) ===================
// lo que sí hace
esperar("auxiliar: registrar un ingreso", await PUT("car", "ingresos", "i-car", { f: "2026-11-10", tipo: "contado", valor: 1000, cliente: "X", cobrado: true }), "ok");
esperar("auxiliar: registrar un egreso", await PUT("car", "egresos", "e-car", { f: "2026-11-10", cat: "servicios", valor: 500, tercero: "T", pagado: false }), "ok");
esperar("auxiliar: registrar un traslado", await PUT("car", "traslados", "t-car", { f: "2026-11-10", de: "a", a: "b", valor: 10 }), "ok");
esperar("auxiliar: registrar un aporte de socio", await PUT("car", "inversion", "iv-car", { f: "2026-11-10", socio: "S", valor: 10, cat: "capital", tipoAporte: "dinero" }), "ok");
esperar("auxiliar: crear una venta (borrador)", await PUT("car", "ventas", "v-car", { f: "2026-11-10", estado: "borrador", cliente: "X", lineas: [] }), "ok");
esperar("auxiliar: contabilizar su borrador", await PUT("car", "ventas", "v-car", { f: "2026-11-10", estado: "contabilizada", cliente: "X", lineas: [], num: "CC-0002" }), "ok");
esperar("auxiliar: borrar un borrador de venta", await DEL("car", "ventas", "v-borr"), "ok");
esperar("auxiliar: crear un tercero", await PUT("car", "terceros", "ter1", { nombre: "Nuevo" }), "ok");
esperar("auxiliar: completar datos de un tercero", await PUT("car", "terceros", "ter1", { nombre: "Nuevo", tel: "300" }), "ok");
esperar("auxiliar: crear un ítem del catálogo", await PUT("car", "items", "it1", { nombre: "Ventana" }), "ok");
esperar("auxiliar: registrar una factura de compra", await PUT("car", "compras", "co-nueva", { fecha: "2026-11-10", proveedor: "P", total: 10 }), "ok");
esperar("auxiliar: corregir una factura sin causar", await PUT("car", "compras", "co-libre", { fecha: "2026-11-03", proveedor: "Prov2", total: 120000, documento: "F2" }), "ok");
esperar("auxiliar: clasificar una factura ya causada", await PUT("car", "compras", "co-causada", { fecha: "2026-11-03", proveedor: "Prov", total: 500000, documento: "F1", destino: "bodega", causaModo: "lineas" }), "ok");
esperar("auxiliar: pagar lo que estaba por pagar", await PATCH("car", "egresos", "eg-credito", { pagado: true, cuenta: "c1", fPago: "2026-11-10", fPagoReg: "2026-11-10T10:00:00Z" }), "ok");
esperar("auxiliar: abonar a un egreso", await PATCH("car", "egresos", "e-car", { abonos: [{ id: "a1", f: "2026-11-11", valor: 100, cuenta: "c1" }] }), "ok");
esperar("auxiliar: segundo abono (se agrega, no se cambia)", await PATCH("car", "egresos", "e-car", { abonos: [{ id: "a1", f: "2026-11-11", valor: 100, cuenta: "c1" }, { id: "a2", f: "2026-11-12", valor: 50, cuenta: "c1" }] }), "ok");
esperar("auxiliar: cobrar lo que estaba a crédito", await PATCH("car", "ingresos", "ing-credito", { cobrado: true, causado: true, cuenta: "c1", fCobro: "2026-11-12" }), "ok");
esperar("auxiliar: enviar una venta al cliente (guarda el enlace)", await PATCH("car", "ventas", "v-cont", { token: "abc", enviada: "2026-11-12" }), "ok");
esperar("auxiliar: conciliar el banco (marcar movimientos)", await PUT("car", "config", "contable", { ...leer("config", "contable"), conc: { ...leer("config", "contable").conc, "b1|2026-10": { ok: { a: true, b: true } } } }), "ok");
esperar("auxiliar: el sistema guarda su numeración", await PUT("car", "config", "contable", { ...leer("config", "contable"), numAsig: { "RC·ingresos·i-car": 1 } }), "ok");
esperar("auxiliar: el sistema aprende la regla del proveedor", await PUT("car", "config", "contable", { ...leer("config", "contable"), reglasProv: { p: { destino: "bodega" } } }), "ok");
esperar("auxiliar: registrar en lote movimientos del banco (nuevos)", await PUT("car", "egresos", "e-banco", { f: "2026-11-12", cat: "bancarios", valor: 4000, tercero: "Banco", pagado: true, cuenta: "c1", fPago: "2026-11-12" }), "ok");
esperar("auxiliar: subir la foto de una factura", await PUT("car", "archivos", "ar1", { tipo: "factura" }), "ok");
esperar("auxiliar: crear la ficha de un equipo", await PUT("car", "maquinaria", "maq-nuevo", { nombre: "Equipo", contab: "compra", valor: 100 }), "ok");
// lo que NO hace (para que no tergiverse ni "cuadre" números)
esperar("auxiliar NO cambia el valor de un ingreso ya guardado", await PUT("car", "ingresos", "ing-pagado", { f: "2026-11-02", tipo: "contado", valor: 8, cliente: "Ana", cobrado: true, cuenta: "c1" }), "no");
esperar("auxiliar NO borra un ingreso", await DEL("car", "ingresos", "ing-pagado"), "no");
esperar("auxiliar NO cambia el valor de un egreso", await PUT("car", "egresos", "eg-pagado", { f: "2026-11-02", cat: "servicios", valor: 1, tercero: "Luz", pagado: true, cuenta: "c1", fPago: "2026-11-02" }), "no");
esperar("auxiliar NO borra un egreso", await DEL("car", "egresos", "eg-pagado"), "no");
esperar("auxiliar NO deshace un pago ya hecho", await PATCH("car", "egresos", "eg-pagado", { pagado: false }), "no");
esperar("auxiliar NO cambia la cuenta de un pago ya hecho", await PATCH("car", "egresos", "eg-pagado", { cuenta: "c2" }), "no");
esperar("auxiliar NO reescribe un abono anterior", await PATCH("car", "egresos", "e-car", { abonos: [{ id: "a1", f: "2026-11-11", valor: 1, cuenta: "c1" }, { id: "a2", f: "2026-11-12", valor: 50, cuenta: "c1" }] }), "no");
esperar("auxiliar NO quita un abono", await PATCH("car", "egresos", "e-car", { abonos: [] }), "no");
esperar("auxiliar NO cambia un ingreso ya cobrado", await PATCH("car", "ingresos", "ing-pagado", { cobrado: false }), "no");
esperar("auxiliar NO cambia el valor de un traslado", await PUT("car", "traslados", "t-car", { f: "2026-11-10", de: "a", a: "b", valor: 99 }), "no");
esperar("auxiliar NO borra un traslado", await DEL("car", "traslados", "t-car"), "no");
esperar("auxiliar NO edita un aporte", await PUT("car", "inversion", "iv-car", { f: "2026-11-10", socio: "S", valor: 99, cat: "capital", tipoAporte: "dinero" }), "no");
esperar("auxiliar NO cambia una venta contabilizada", await PUT("car", "ventas", "v-cont", { f: "2026-11-04", estado: "contabilizada", cliente: "Ana", num: "CC-0001", lineas: [{ desc: "x" }] }), "no");
esperar("auxiliar NO anula una venta contabilizada", await PATCH("car", "ventas", "v-cont", { estado: "anulada" }), "no");
esperar("auxiliar NO borra una venta contabilizada", await DEL("car", "ventas", "v-cont"), "no");
esperar("auxiliar NO hace notas crédito ni débito", await PUT("car", "notasdoc", "n-car", { f: "2026-11-10", tipo: "NCV", estado: "contabilizada" }), "no");
esperar("auxiliar NO hace asientos contables", await PUT("car", "asientos", "a-car", { f: "2026-11-10", estado: "contabilizado", lineas: [{ cta: "5195", d: 100, c: 0 }, { cta: "1105", d: 0, c: 100 }] }), "no");
esperar("auxiliar NO crea cuentas bancarias", await PUT("car", "cuentas", "cu-car", { nombre: "B" }), "no");
esperar("auxiliar NO toca la nómina", await PUT("car", "nominas", "n-car", { tipo: "nomina", f: "2026-11-30", estado: "borrador" }), "no");
esperar("auxiliar NO toca los empleados", await PUT("car", "personal", "p-car", { nombre: "X", salario: 1 }), "no");
esperar("auxiliar NO cambia el valor de una factura ya causada", await PUT("car", "compras", "co-causada", { fecha: "2026-11-03", proveedor: "Prov", total: 1, documento: "F1" }), "no");
esperar("auxiliar NO borra una factura ya causada", await DEL("car", "compras", "co-causada"), "no");
esperar("auxiliar NO cierra un mes", await PUT("car", "config", "contable", { ...leer("config", "contable"), cierres: { "2026-09": { f: "x" }, "2026-10": { f: "y" } } }), "no");
esperar("auxiliar NO reabre un mes", await PUT("car", "config", "contable", { ...leer("config", "contable"), cierres: {} }), "no");
esperar("auxiliar NO cambia el mapa de cuentas", await PUT("car", "config", "contable", { ...leer("config", "contable"), mapa: { y: "2" } }), "no");
esperar("auxiliar NO cierra una conciliación", await PUT("car", "config", "contable", { ...leer("config", "contable"), conc: { ...leer("config", "contable").conc, "b1|2026-10": { ok: {}, cerrada: { f: "x", por: "C" } } } }), "no");
esperar("auxiliar NO reabre una conciliación cerrada", await PUT("car", "config", "contable", { ...leer("config", "contable"), conc: { ...leer("config", "contable").conc, "b1|2026-09": { ok: {} } } }), "no");
esperar("auxiliar NO cambia los precios del taller", await PUT("car", "config", "precios", { operacion: { z: 1 } }), "no");
esperar("auxiliar NO cambia cotizaciones", await PUT("car", "cotizaciones", "q1", { numero: "COT-1", cliente: { nombre: "Cambiado" } }), "no");
esperar("auxiliar NO cambia los usuarios", await PUT("car", "config", "usuarios", { nombres: { car: "Otra" } }), "no");
esperar("auxiliar NO cambia el valor ni la fecha de un equipo en la contabilidad", await PUT("car", "maquinaria", "maq-contab", { nombre: "Cortadora", contab: "compra", valor: 1, fAdq: "2026-10-01", foto: "" }), "no");

// =================== USUARIO (Cristian: solo la gestión) ===================
for (const [col, id, d] of [["cotizaciones", "q-c", { numero: "COT-2" }], ["bodega", "b-c", { cantidad: 1 }], ["proveedores", "pr-c", { nombre: "P" }], ["ordenes", "o-c", { numero: "OT-1" }], ["retazos", "r-c", { k: "x" }], ["archivos", "ar-c", { t: 1 }], ["publicas", "pu-c", { t: 1 }], ["aprendizaje", "ap-c", { t: 1 }], ["caja", "ca-c", { concepto: "Café", valor: 5000 }], ["chatarra", "ch-c", { kg: 5 }]])
  esperar(`Cristian: guarda en ${col}`, await PUT("cris", col, id, d), "ok");
esperar("Cristian: edita una cotización", await PUT("cris", "cotizaciones", "q1", { numero: "COT-1", cliente: { nombre: "Z2" } }), "ok");
esperar("Cristian: borra un proveedor", await DEL("cris", "proveedores", "pr-c"), "ok");
esperar("Cristian: cambia los precios y costos del taller", await PUT("cris", "config", "precios", { operacion: { b: 1 } }), "ok");
esperar("Cristian: vende chatarra (ingreso de chatarra)", await PUT("cris", "ingresos", "i-chat", { f: "2026-11-10", tipo: "chatarra", valor: 50000, cliente: "Chatarrería", cobrado: true }), "ok");
esperar("Cristian: registra una compra a bodega", await PUT("cris", "compras", "co-cris", { fecha: "2026-11-10", proveedor: "P", total: 10 }), "ok");
esperar("Cristian: la contabiliza (egreso ligado a su compra)", await PUT("cris", "egresos", "e-cris", { f: "2026-11-10", cat: "materiales", valor: 10, tercero: "P", pagado: false, compraId: "co-cris" }), "ok");
esperar("Cristian: el sistema aprende la regla del proveedor", await PUT("cris", "config", "contable", { ...leer("config", "contable"), reglasProv: { q: { destino: "bodega" } } }), "ok");
esperar("Cristian: registra una herramienta (sin contabilidad)", await PUT("cris", "maquinaria", "m-cris", { nombre: "Taladro 2", valor: 100 }), "ok");
esperar("Cristian: cambia la foto de un equipo contabilizado", await PATCH("cris", "maquinaria", "maq-contab", { foto: "f1" }), "ok");
esperar("Cristian NO registra un ingreso que no es chatarra", await PUT("cris", "ingresos", "i-no", { f: "2026-11-10", tipo: "contado", valor: 1, cliente: "X", cobrado: true }), "no");
esperar("Cristian NO registra un egreso suelto", await PUT("cris", "egresos", "e-no", { f: "2026-11-10", cat: "servicios", valor: 1, tercero: "T", pagado: true }), "no");
esperar("Cristian NO cambia un egreso", await PATCH("cris", "egresos", "eg-credito", { pagado: true }), "no");
esperar("Cristian NO borra un ingreso", await DEL("cris", "ingresos", "ing-pagado"), "no");
esperar("Cristian NO hace ventas", await PUT("cris", "ventas", "v-c", { f: "2026-11-10", estado: "borrador" }), "no");
esperar("Cristian NO hace asientos", await PUT("cris", "asientos", "a-c", { f: "2026-11-10", estado: "borrador" }), "no");
esperar("Cristian NO crea terceros", await PUT("cris", "terceros", "t-c", { nombre: "T" }), "no");
esperar("Cristian NO toca la nómina", await PUT("cris", "nominas", "n-c", { tipo: "nomina" }), "no");
esperar("Cristian NO toca a los empleados", await PUT("cris", "personal", "p1", { nombre: "Carlos", salario: 1 }), "no");
esperar("Cristian NO cierra meses", await PUT("cris", "config", "contable", { ...leer("config", "contable"), cierres: {} }), "no");
esperar("Cristian NO cambia el modo de causar", await PUT("cris", "config", "contable", { ...leer("config", "contable"), causaModo: "uno" }), "no");
esperar("Cristian NO cambia usuarios", await PUT("cris", "config", "usuarios", { nombres: {} }), "no");
esperar("Cristian NO pone un equipo en la contabilidad", await PUT("cris", "maquinaria", "m-cris2", { nombre: "X", contab: "compra", valor: 100 }), "no");
esperar("Cristian NO cambia el valor de un equipo contabilizado", await PATCH("cris", "maquinaria", "maq-contab", { valor: 1 }), "no");
esperar("Cristian NO borra un equipo contabilizado", await DEL("cris", "maquinaria", "maq-contab"), "no");
esperar("Cristian NO cambia el valor de una factura ya causada", await PATCH("cris", "compras", "co-causada", { total: 1 }), "no");

// =================== PROYECTOR (Gerardo: gestión completa, Finanzas solo consulta) ===================
esperar("Gerardo: guarda una cotización", await PUT("ger", "cotizaciones", "q-g", { numero: "COT-3" }), "ok");
esperar("Gerardo: cambia los precios", await PUT("ger", "config", "precios", { operacion: { g: 1 } }), "ok");
esperar("Gerardo: guarda en bodega", await PUT("ger", "bodega", "b-g", { cantidad: 1 }), "ok");
esperar("Gerardo NO registra un ingreso", await PUT("ger", "ingresos", "i-g", { f: "2026-11-10", tipo: "contado", valor: 1, cobrado: true }), "no");
esperar("Gerardo NO registra un egreso", await PUT("ger", "egresos", "e-g", { f: "2026-11-10", cat: "servicios", valor: 1, pagado: true }), "no");
esperar("Gerardo NO hace una venta", await PUT("ger", "ventas", "v-g", { f: "2026-11-10", estado: "borrador" }), "no");
esperar("Gerardo NO toca la nómina", await PUT("ger", "nominas", "n-g", { tipo: "nomina" }), "no");
esperar("Gerardo NO hace asientos", await PUT("ger", "asientos", "a-g", { f: "2026-11-10", estado: "borrador" }), "no");
esperar("Gerardo NO cierra meses", await PUT("ger", "config", "contable", { ...leer("config", "contable"), cierres: {} }), "no");
esperar("Gerardo: el sistema aprende la regla del proveedor (compras a bodega)", await PUT("ger", "config", "contable", { ...leer("config", "contable"), reglasProv: { z: 1 } }), "ok");
esperar("Gerardo NO cambia el modo de causar", await PUT("ger", "config", "contable", { ...leer("config", "contable"), causaModo: "uno" }), "no");
esperar("Gerardo: el sistema guarda la numeración", await PUT("ger", "config", "contable", { ...leer("config", "contable"), numAsig: { x: 2 } }), "ok");

// =================== ADMINISTRADOR ===================
esperar("admin: cambia los usuarios", await PUT("jefe", "config", "usuarios", { nombres: { osw: "Oswaldo Vallejos" } }), "ok");
esperar("admin: edita lo que sea", await PUT("jefe", "ingresos", "ing-pagado", { f: "2026-11-02", tipo: "contado", valor: 7, cliente: "Ana", cobrado: true, cuenta: "c1" }), "ok");
esperar("admin: ve todo", { s: Object.keys((await pedir("jefe", "GET", "/api/all")).b).includes("nominas") ? 200 : 0, b: 0 }, "ok");

console.log(`OK: ${ok}   FALLOS: ${fallos.length}`);
for (const f of fallos) console.log("  ✗", f);
