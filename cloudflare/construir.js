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
${app}
</body>
</html>
`;

fs.mkdirSync(path.join(__dirname, "public"), { recursive: true });
// datos reales que la función /api carga la primera vez (los mismos de la versión de Netlify)
fs.copyFileSync(path.join(__dirname, "..", "netlify", "servidor", "datos-iniciales.mjs"), path.join(__dirname, "datos-iniciales.mjs"));
fs.writeFileSync(path.join(__dirname, "public", "index.html"), html);
// app instalable: manifiesto, íconos y service worker (carpeta app/)
for (const f of fs.readdirSync(path.join(__dirname, "app")))
  if (f !== "icono-fuente.html") fs.copyFileSync(path.join(__dirname, "app", f), path.join(__dirname, "public", f));
console.log("Listo: public/index.html (" + Math.round(html.length / 1024) + " KB)");
