# Publicar la app en Cloudflare (gratis)

La página se aloja en **Cloudflare Pages**, los datos se guardan en **Cloudflare D1** y una **clave del taller** protege el acceso.

## Antes de empezar
- Cuenta en https://dash.cloudflare.com/sign-up (gratis).
- Node.js instalado (ya lo tienes).
- Abre la terminal de VS Code (menú *Terminal → Nuevo terminal*) y entra a esta carpeta:

```
cd "C:\Users\hp\OneDrive\Desktop\VIDRIOS Y ESTRUCTURAS\cloudflare"
```

## 1. Conectar la terminal con tu cuenta
```
npx wrangler login
```
Si pregunta si quieres instalar `wrangler`, escribe `y`. Se abre el navegador: pulsa **Allow**.

## 2. Crear la base de datos
```
npx wrangler d1 create vidrios-db
```
La respuesta trae una línea `database_id = "xxxxxxxx-xxxx-..."`.
Abre `wrangler.toml` y reemplaza `PEGA-AQUI-EL-DATABASE-ID` por ese valor. Guarda el archivo.
(Si wrangler te pregunta si quiere agregarlo él mismo al archivo, responde que sí y revisa que quedó bien.)

## 3. Crear la tabla
```
npx wrangler d1 execute vidrios-db --remote --file=schema.sql
```

No hay que cargar nada más: la primera vez que alguien abre la app se cargan solos los **datos reales** (equipos del Excel, proveedores con su contacto, las primeras compras a bodega y las fotos de sus facturas). Vienen del archivo `datos-iniciales.mjs`, que `node construir.js` actualiza.

## 4. Crear el proyecto de la página
```
npx wrangler pages project create vidriosyestructuras --production-branch main
```

## 5. Poner la clave del taller
```
npx wrangler pages secret put APP_CLAVE --project-name vidriosyestructuras
```
Escribe la clave que usarán los hermanos y pulsa Enter. No se ve mientras la escribes.

## 6. Publicar
```
npx wrangler pages deploy
```
Al final aparece la dirección, algo como `https://vidriosyestructuras.pages.dev`.

## 7. Entrar
Abre la dirección. La app pide **tu nombre** (aparece como autor de las cotizaciones) y la **clave del taller**.

---

## Cuando cambie la app
Si `cotizador.html` cambia:
```
node construir.js
npx wrangler pages deploy
```

## Si algo falla
| Mensaje | Qué hacer |
|---|---|
| "Falta conectar la base de datos D1" | Revisa el `database_id` en `wrangler.toml` y vuelve a publicar (paso 6). |
| Vuelve a pedir la clave | La clave no coincide. Para cambiarla repite el paso 5 y luego el 6. |
| `Project not found` | Haz el paso 4 antes del 5. |
| La dirección tiene otro nombre | El nombre ya existía en Cloudflare y te asignaron uno parecido. Es normal. |

## Costos
Con el plan gratuito de Cloudflare: alojamiento, base de datos (5 GB) y hasta 100.000 consultas al día. Para un taller, **$0 al mes**.
Un dominio propio (por ejemplo `vidriosyestructuras.com`) es opcional, unos US$10 al año, y se conecta en *Pages → proyecto → Custom domains*.
