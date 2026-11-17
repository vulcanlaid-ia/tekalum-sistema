// TEKALUM: se puede instalar (ícono en el escritorio) y abrir SIN internet y CON internet lenta.
// - La página se abre al instante desde la copia guardada en este equipo y se actualiza en segundo plano (ETag: si no
//   cambió, la consulta pesa unos bytes). Si hay una versión nueva, la pantalla avisa y se actualiza con un botón.
// - Los datos NO pasan por aquí: los guarda y los sube el adaptador (IndexedDB), y los pedidos a /api nunca se cachean.
const V = "tekalum-v4";
const guardarPagina = async () => { const r = await fetch("/"); if (r.ok) await (await caches.open(V)).put("/shell", r); };
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
  await self.clients.claim();
  if (!(await (await caches.open(V)).match("/shell"))) await guardarPagina().catch(() => {});   // solo si todavía no hay copia
})()));
self.addEventListener("message", (e) => { if (e.data === "guardar-pagina") e.waitUntil(guardarPagina().catch(() => {})); });
const sinConexion = () => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#1f2326;color:#fff;font:16px system-ui,sans-serif;text-align:center;padding:16px">
<div><h2>Sin conexión a internet</h2><p>Abre el sistema una vez con internet para que quede guardado en este equipo; después podrás usarlo sin conexión.</p>
<button onclick="location.reload()" style="font:inherit;padding:10px 18px;border:0;border-radius:8px;background:#0d6b73;color:#fff">Reintentar</button></div></body>`,
  { headers: { "content-type": "text/html; charset=utf-8" } });
// pregunta en segundo plano si hay una página más nueva; si la hay, la guarda y avisa a las ventanas abiertas
async function actualizar(guardado) {
  try {
    const res = await fetch("/", { cache: "no-cache" });
    if (!res.ok) return;
    const c = await caches.open(V), nuevo = res.headers.get("etag"), viejo = guardado && guardado.headers.get("etag");
    if (guardado && nuevo && nuevo === viejo) return;                       // igual: no se hace nada
    await c.put("/shell", res.clone());
    if (guardado) for (const w of await self.clients.matchAll({ type: "window" })) w.postMessage({ tipo: "nueva-version" });
  } catch { /* sin conexión: se queda la copia */ }
}
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname.startsWith("/c/")) return;
  if (r.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(V), guardado = await c.match("/shell");
      if (guardado) { e.waitUntil(actualizar(guardado)); return guardado; }          // abre ya, con lo que hay guardado
      try {
        const res = await fetch(r);
        if (res.ok) e.waitUntil(c.put("/shell", res.clone()));                       // se guarda sin hacer esperar a la página
        return res;
      } catch { return sinConexion(); }
    })());
    return;
  }
  // íconos y manifiesto: copia en el equipo, se renueva cuando hay conexión
  e.respondWith((async () => {
    const c = await caches.open(V), guardado = await c.match(r);
    const red = fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => guardado);
    return guardado || red;
  })());
});
