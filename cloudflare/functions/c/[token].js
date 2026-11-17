// Página pública de una cotización: /c/<token>
// El cliente ve la copia que se le envió (sin usuario ni contraseña), puede imprimirla y responder.
// Cada visita queda anotada en la cotización (vistaCliente, vistas) y en la bitácora.
const html = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const e = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function anotar(env, request, accion, p, resumen) {
  try {
    const c = request.cf || {};
    await env.DB.prepare("INSERT INTO bitacora (f, usuario, nombre, accion, col, doc, resumen, ip, lugar, sid) VALUES (?1, 'cliente', ?2, ?3, 'cotizaciones', ?4, ?5, ?6, ?7, '')")
      .bind(new Date().toISOString(), p.cliente || "Cliente", accion, p.cotId, resumen, request.headers.get("cf-connecting-ip") || "", [c.city, c.region, c.country].filter(Boolean).join(", ")).run();
  } catch {}
}
async function tocarCot(env, id, cambio) {
  const fila = await env.DB.prepare("SELECT data FROM docs WHERE col = 'cotizaciones' AND id = ?1").bind(id).first();
  if (!fila) return;
  const d = JSON.parse(fila.data);
  cambio(d);
  await env.DB.prepare("UPDATE docs SET data = ?2, updated = ?3, por = 'cliente' WHERE col = 'cotizaciones' AND id = ?1")
    .bind(id, JSON.stringify(d), new Date().toISOString()).run();
}

export async function onRequest({ request, env, params }) {
  const token = String(params.token || "");
  if (!/^[a-z0-9]{12,40}$/.test(token) || !env.DB) return html("<h1>Enlace no válido</h1>", 404);
  const fila = await env.DB.prepare("SELECT data FROM docs WHERE col = 'publicas' AND id = ?1").bind(token).first();
  if (!fila) return html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cotización no disponible</title><body style="font:16px system-ui;padding:40px;text-align:center"><h1>Esta cotización ya no está disponible</h1><p>Pide a TEKALUM un enlace nuevo.</p>`, 404);
  const p = JSON.parse(fila.data), ahora = new Date().toISOString();
  if (p.tipo === "documento") return paginaDocumento(request, env, p, ahora);

  if (request.method === "POST") {
    let b = {};
    try { b = await request.json(); } catch {}
    const r = ["aprobada", "preguntas", "rechazada"].includes(b.r) ? b.r : null;
    if (!r) return json({ error: "Respuesta no válida" }, 400);
    const nota = String(b.nota || "").slice(0, 500);
    await tocarCot(env, p.cotId, (d) => { d.respuestaCliente = { r, f: ahora, nota }; });
    await anotar(env, request, r === "aprobada" ? "aceptó" : r === "rechazada" ? "rechazó" : "preguntó", p, `${p.numero} · ${r === "aprobada" ? "el cliente aceptó la cotización" : r === "rechazada" ? "el cliente no la aceptó" : "el cliente tiene preguntas"}${nota ? " · " + nota : ""}`);
    return json({ ok: true });
  }

  // visita: se anota (la primera fecha y el número de veces)
  // las vistas previas de WhatsApp, Facebook, Telegram, etc. no cuentan como visita del cliente
  const robot = /bot|crawl|spider|whatsapp|facebookexternalhit|preview|telegram|slack|discord|skype|linkedin|headless/i.test(request.headers.get("user-agent") || "");
  if (request.method === "GET" && !robot) {
    await tocarCot(env, p.cotId, (d) => { d.vistaCliente ||= ahora; d.ultimaVista = ahora; d.vistas = (+d.vistas || 0) + 1; });
    await anotar(env, request, "vio", p, `${p.numero} · el cliente abrió la cotización`);
  }
  const wa = String(p.empresa?.whatsapp || "").replace(/\D/g, "");
  const waUrl = wa ? `https://wa.me/57${wa}?text=${encodeURIComponent(`Hola, tengo una pregunta sobre la cotización ${p.numero}.`)}` : "";
  return html(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Cotización ${e(p.numero)} · ${e(p.empresa?.nombre || "TEKALUM")}</title><link rel="icon" href="/tekalum-32.png">
<style>${p.css || ""}</style>
<style>html,body{background:#eef1f5!important;margin:0}body{display:block!important}.pub-bar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;padding:10px 16px;background:#0c1a33;color:#fff;font:14px system-ui,sans-serif}
.pub-bar b{font-size:15px}.pub-acc{display:flex;gap:8px;flex-wrap:wrap}.pub-btn{all:unset;cursor:pointer;padding:9px 14px;border-radius:8px;background:#fff;color:#0c1a33;font-weight:600;font-size:14px}.pub-btn.ok{background:#1f9d55;color:#fff}.pub-btn:focus-visible{outline:2px solid #ffd54a}
.pub-main{max-width:880px;margin:18px auto;padding:0 12px}.pub-msg{max-width:880px;margin:12px auto 0;padding:12px 16px;border-radius:10px;background:#e7f6ef;color:#14532d;font:15px system-ui;display:none}
@media print{.pub-bar,.pub-msg{display:none!important}html,body{background:#fff!important}.pub-main{margin:0;max-width:none}}</style></head>
<body><div class="pub-bar"><div><b>${e(p.empresa?.nombre || "TEKALUM")}</b> · Cotización ${e(p.numero)}</div>
<div class="pub-acc"><button class="pub-btn ok" id="ok">Acepto la cotización</button>${waUrl ? `<a class="pub-btn" href="${e(waUrl)}" target="_blank" rel="noopener" id="wa">Tengo preguntas (WhatsApp)</a>` : ""}<button class="pub-btn" onclick="print()">Imprimir o guardar PDF</button></div></div>
<div class="pub-msg" id="msg" role="status"></div>
<main class="pub-main">${p.html || ""}</main>
<script>
const enviar=async(r)=>{try{const x=await fetch(location.pathname,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({r})});if(!x.ok)throw 0;return true}catch{return false}};
document.getElementById("ok").onclick=async()=>{if(!confirm("¿Confirmas que aceptas esta cotización? TEKALUM te contactará para el anticipo y la fecha de inicio."))return;const m=document.getElementById("msg");const ok=await enviar("aprobada");m.style.display="block";m.textContent=ok?"¡Gracias! Recibimos tu aceptación. TEKALUM te contactará muy pronto.":"No se pudo enviar. Escríbenos por WhatsApp, por favor.";};
const wa=document.getElementById("wa");if(wa)wa.addEventListener("click",()=>{enviar("preguntas")});
</script></body></html>`);
}

// Documento de venta (cuenta de cobro o factura) compartido con el cliente: solo se ve e imprime
async function paginaDocumento(request, env, p, ahora) {
  const robot = /bot|crawl|spider|whatsapp|facebookexternalhit|preview|telegram|slack|discord|skype|linkedin|headless/i.test(request.headers.get("user-agent") || "");
  if (request.method === "GET" && !robot && p.ventaId) {
    try {
      const fila = await env.DB.prepare("SELECT data FROM docs WHERE col = 'ventas' AND id = ?1").bind(p.ventaId).first();
      if (fila) {
        const d = JSON.parse(fila.data); d.vistaCliente ||= ahora; d.vistas = (+d.vistas || 0) + 1;
        await env.DB.prepare("UPDATE docs SET data = ?2, updated = ?3, por = 'cliente' WHERE col = 'ventas' AND id = ?1").bind(p.ventaId, JSON.stringify(d), ahora).run();
      }
      const c = request.cf || {};
      await env.DB.prepare("INSERT INTO bitacora (f, usuario, nombre, accion, col, doc, resumen, ip, lugar, sid) VALUES (?1, 'cliente', ?2, 'vio', 'ventas', ?3, ?4, ?5, ?6, '')")
        .bind(ahora, p.cliente || "Cliente", p.ventaId, (p.numero || "") + " · el cliente abrió el documento", request.headers.get("cf-connecting-ip") || "", [c.city, c.region, c.country].filter(Boolean).join(", ")).run();
    } catch {}
  }
  const wa = String(p.empresa?.whatsapp || "").replace(/\D/g, "");
  const waUrl = wa ? `https://wa.me/57${wa}?text=${encodeURIComponent(`Hola, tengo una pregunta sobre el documento ${p.numero}.`)}` : "";
  const cuerpo = String(p.html || "").replace(/<script[\s\S]*?<\/script>/gi, "");
  return html(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${e(p.numero)} · ${e(p.empresa?.nombre || "TEKALUM")}</title><link rel="icon" href="/tekalum-32.png">
<style>html,body{background:#eef1f5;margin:0}.pub-bar{position:sticky;top:0;display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;padding:10px 16px;background:#0c1a33;color:#fff;font:14px system-ui}.pub-btn{all:unset;cursor:pointer;padding:8px 14px;border-radius:8px;background:#fff;color:#0c1a33;font-weight:600}.hoja{max-width:820px;margin:18px auto;background:#fff;border-radius:10px;padding:8px 18px;box-shadow:0 4px 18px rgba(0,0,0,.08)}@media print{.pub-bar{display:none}.hoja{box-shadow:none;margin:0}}</style></head>
<body><div class="pub-bar"><div><b>${e(p.empresa?.nombre || "TEKALUM")}</b> · ${e(p.numero)}</div><div style="display:flex;gap:8px">${waUrl ? `<a class="pub-btn" href="${e(waUrl)}" target="_blank" rel="noopener">Preguntar por WhatsApp</a>` : ""}<button class="pub-btn" onclick="print()">Imprimir o guardar PDF</button></div></div>
<div class="hoja">${cuerpo}</div></body></html>`);
}
