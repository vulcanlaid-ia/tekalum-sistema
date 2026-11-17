// TEKALUM: permite instalar la app (ícono en el escritorio) y abrirla SIN internet.
// - La página se pide siempre primero a internet (así se ve la versión nueva apenas se publica); la última copia
//   queda guardada en este equipo y se usa solo si no hay conexión.
// - Los datos NO pasan por aquí: los guarda y los sube el adaptador (IndexedDB), y los pedidos a /api nunca se cachean.
const V = "tekalum-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
  await self.clients.claim();
})()));
const sinConexion = () => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#1f2326;color:#fff;font:16px system-ui,sans-serif;text-align:center;padding:16px">
<div><h2>Sin conexión a internet</h2><p>Abre el sistema una vez con internet para que quede guardado en este equipo; después podrás usarlo sin conexión.</p>
<button onclick="location.reload()" style="font:inherit;padding:10px 18px;border:0;border-radius:8px;background:#0d6b73;color:#fff">Reintentar</button></div></body>`,
  { headers: { "content-type": "text/html; charset=utf-8" } });
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname.startsWith("/c/")) return;
  if (r.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(r);
        if (res.ok) { const c = await caches.open(V); await c.put("/shell", res.clone()); }
        return res;
      } catch {
        const c = await caches.open(V);
        return (await c.match("/shell")) || sinConexion();
      }
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
