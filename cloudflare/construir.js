// Arma public/index.html a partir de ../cotizador.html (la misma app de claude.ai) + adaptador.js.
// Úsalo cada vez que cambie cotizador.html:   node construir.js
const fs = require("fs");
const path = require("path");

// los módulos de Finanzas (finanzas-pro*.js) van dentro del mismo HTML
const app = fs.readFileSync(path.join(__dirname, "..", "cotizador.html"), "utf8").replace(/<script src="(finanzas-pro\d*\.js)"><\/script>/g, (m, f) =>
  "<script>\n" + fs.readFileSync(path.join(__dirname, "..", f), "utf8").replace(/<\/script/gi, "<\\/script") + "\n</script>");
if (/src="finanzas-pro/.test(app)) throw new Error("No se pudieron incluir los módulos de Finanzas");
const adaptador = fs.readFileSync(path.join(__dirname, "adaptador.js"), "utf8");

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>TEKALUM</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="/tekalum-32.png">
<link rel="apple-touch-icon" href="/tekalum-192.png">
<meta name="theme-color" content="#0c1a33">
<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
<script>
${adaptador}
</script>
</head>
<body>
<div id="vye-carga" style="position:fixed;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#fff;color:#0c1a33;font:600 16px system-ui,sans-serif"><div style="width:34px;height:34px;border:4px solid #dbe3f0;border-top-color:#1d4ed8;border-radius:50%;animation:vyegira .9s linear infinite"></div><div>Cargando TEKALUM…</div></div><style>@keyframes vyegira{to{transform:rotate(360deg)}}</style>
${app}
</body>
</html>
`;

fs.mkdirSync(path.join(__dirname, "public"), { recursive: true });
// En el sistema real, aquí se copian los datos reales que la función /api carga la primera vez
// (equipos, proveedores, compras). En este repositorio de auditoría ese archivo no está —tiene datos
// reales de la empresa—, así que se usa el vacío que sí está en el repo.
fs.copyFileSync(path.join(__dirname, "datos-iniciales-vacio.mjs"), path.join(__dirname, "datos-iniciales.mjs"));
fs.writeFileSync(path.join(__dirname, "public", "index.html"), html);
// app instalable: manifiesto, íconos y service worker (carpeta app/)
for (const f of fs.readdirSync(path.join(__dirname, "app")))
  if (f !== "icono-fuente.html") fs.copyFileSync(path.join(__dirname, "app", f), path.join(__dirname, "public", f));
console.log("Listo: public/index.html (" + Math.round(html.length / 1024) + " KB)");
