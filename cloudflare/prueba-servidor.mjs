// Prueba del servidor con una base SQLite en memoria (imita D1). Uso: node prueba-servidor.mjs
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
const sq = new DatabaseSync(":memory:");
sq.exec(fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
sq.exec("INSERT INTO docs (col,id,data,updated) VALUES ('_sistema','sembrado','{}','x')");
const stmt = (sql, args = []) => ({
  sql, args,
  bind: (...a) => stmt(sql, a),
  run: async () => { const r = sq.prepare(sql.replace(/\?(\d+)/g, "?")).run(...ord(sql, args)); return { meta: { changes: r.changes } }; },
  first: async () => sq.prepare(sql.replace(/\?(\d+)/g, "?")).get(...ord(sql, args)) ?? null,
  all: async () => ({ results: sq.prepare(sql.replace(/\?(\d+)/g, "?")).all(...ord(sql, args)) }),
});
// ?1 ?2 numerados: se convierten a posicionales en el orden en que aparecen
const ord = (sql, a) => [...sql.matchAll(/\?(\d+)/g)].map((m) => { const v = a[+m[1] - 1]; return v === undefined ? null : v; });
const DB = { prepare: (sql) => stmt(sql), batch: async (L) => { for (const s of L) await s.run(); } };
const env = { DB, CUENTAS: JSON.stringify({ admin1: { clave: "a", rol: "admin" }, contador1: { clave: "o", rol: "contador", nombre: "Oswaldo" }, usuario1: { clave: "u", rol: "usuario" } }), CUENTAS_EXTRA: JSON.stringify({ usuario1: { baja: true } }) };
const { onRequest } = await import("./functions/api/[[path]].js");
const pedir = async (u, c, metodo, ruta, body) => {
  const p = ruta.replace(/^\/api\//, "").split("/").map(decodeURIComponent);
  const r = await onRequest({ request: Object.assign(new Request("http://x" + ruta, { method: metodo, headers: { "x-usuario": u, "x-clave": c, "x-sid": "prueba123", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }), { cf: { city: "Pasto", region: "Nariño", country: "CO", latitude: "1.2", longitude: "-77.3" } }), env, params: { path: p } });
  return [r.status, await r.json()];
};
const O = (m, r, b) => pedir("contador1", "o", m, r, b);
console.log("usuario1 de baja", JSON.stringify(await pedir("usuario1", "u", "GET", "/api/sesion")));
console.log("sesion", JSON.stringify(await O("GET", "/api/sesion")));
console.log("clave mala", JSON.stringify(await pedir("contador1", "x", "GET", "/api/sesion")));
console.log("ping", JSON.stringify(await O("POST", "/api/ping", { sid: "prueba123", disp: "Computador · Windows", pantalla: "Panel", lat: 1.214, lon: -77.281, prec: 20 })));
console.log("ping 2", JSON.stringify(await O("POST", "/api/ping", { sid: "prueba123", disp: "Computador · Windows", pantalla: "Egresos" })));
console.log("crear", JSON.stringify(await O("PUT", "/api/docs/terceros/zz1", { nombre: "Tercero de prueba", valor: 1000 })));
console.log("editar (intenta falsear el autor)", JSON.stringify(await O("PUT", "/api/docs/terceros/zz1", { nombre: "Tercero de prueba 2", valor: 2000, _creadoPor: "otro", _creadoNombre: "Otro" })));
console.log("patch", JSON.stringify(await O("PATCH", "/api/docs/terceros/zz1", { valor: 3000 })));
console.log("config de usuarios (solo admin; el contador recibe 403)", JSON.stringify(await O("PUT", "/api/docs/config/usuarios", { nombres: {} })));
console.log("config sin sello", JSON.stringify(await pedir("admin1", "a", "PUT", "/api/docs/config/usuarios", { nombres: { contador1: "Oswaldo Vallejos" } })));
console.log("nombre nuevo", JSON.stringify(await O("GET", "/api/sesion")));
console.log("contador no ve actividad", JSON.stringify(await O("GET", "/api/actividad")));
console.log("borrar", JSON.stringify(await O("DELETE", "/api/docs/terceros/zz1")));
console.log("caja solo agregar", JSON.stringify(await O("PUT", "/api/docs/caja/k1", { concepto: "Café", valor: 5000 })), JSON.stringify(await O("PUT", "/api/docs/caja/k1", { concepto: "Café", valor: 9 })));
const [st, a] = await pedir("admin1", "a", "GET", "/api/actividad");
console.log("actividad admin", st, JSON.stringify(a.usuarios), "\nsesiones", JSON.stringify(a.sesiones.map((s) => [s.usuario, s.nombre, s.lugar, s.lat, s.lon, s.gps, s.pantalla])));
console.log("bitácora", JSON.stringify(a.bitacora.map((b) => [b.nombre, b.accion, b.col, b.resumen, b.lugar])));
console.log("en línea admin", JSON.stringify(await pedir("admin1", "a", "GET", "/api/enlinea")));
console.log("en línea contador", JSON.stringify(await O("GET", "/api/enlinea")));
const all = await pedir("admin1", "a", "GET", "/api/all");
console.log("all ok", all[0], Object.keys(all[1]));
