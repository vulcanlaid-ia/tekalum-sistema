# TEKALUM — Sistema de gestión y Finanzas

Sistema de cotización, producción y contabilidad para un taller de vidrios y
estructuras de aluminio (Pasto, Colombia). Corre como una sola página web
(sin build pesado) desplegada en Cloudflare Pages, con datos en Cloudflare D1.

Este repositorio es **solo para revisión de código**. No contiene datos
reales de clientes, proveedores, facturas ni claves. Donde el sistema real
carga datos reales al primer arranque, aquí ese archivo se reemplazó por uno
vacío (`cloudflare/datos-iniciales-vacio.mjs`).

## Estructura

| Archivo / carpeta | Qué es |
|---|---|
| `cotizador.html` | La aplicación completa: cotizador, producción, bodega, y el "shell" de Finanzas (menús, render principal, asientos base, numeración). Es grande (~1.1 MB) porque es una sola página sin empaquetador. |
| `finanzas-pro.js` | Finanzas — ventas, notas crédito/débito, impuestos, configuración, facturación electrónica (apagada hasta terminar el trámite con la DIAN). |
| `finanzas-pro2.js` | Finanzas — causación línea por línea, reglas de proveedor, catálogo de productos, activos fijos, conciliación bancaria, centros de costo, exógena, auditoría de numeración. |
| `finanzas-pro3.js` | **Nómina** — empleados, liquidación quincenal/mensual, novedades, PILA, prestaciones sociales, liquidación de contrato, nómina electrónica (apagada). |
| `cloudflare/` | Despliegue: funciones de servidor (`functions/api`, `functions/c`), build (`construir.js`), esquema de base de datos (`schema.sql`), configuración (`wrangler.toml`), guía de despliegue (`GUIA.md`). |
| `cloudflare/app/simulacion.json` | Un mes completo de datos **inventados** (empresa ficticia, NIT 1000000000) para probar la contabilidad sin tocar datos reales. |

## Cómo está organizado el código

- Es JavaScript plano (sin framework, sin TypeScript, sin build de npm para el
  frontend). `cotizador.html` tiene el HTML, los estilos y la mayoría de la
  lógica del taller en `<script>` inline.
- `construir.js` arma `cloudflare/public/index.html` insertando los tres
  `finanzas-pro*.js` dentro de `cotizador.html` y agregando `adaptador.js`
  (una capa que conecta la app con el servidor: sesión, API, service worker).
- Persistencia: todo documento (ingresos, egresos, ventas, nómina, etc.) pasa
  por `guardarDoc(coleccion, id, datos)` / `borrarDoc(coleccion, id)`, que
  `cloudflare/functions/api/[[path]].js` guarda en D1.
- Contabilidad: `asientosTodos(conCierre)` reconstruye **todos** los asientos
  contables a partir de los documentos guardados (no se guardan asientos
  sueltos). Cada módulo (`finanzas-pro*.js`) agrega sus propias reglas a un
  arreglo `ASIENTO_HOOKS`.
- Un "guardián" (en `finanzas-pro2.js` y `finanzas-pro3.js`) envuelve
  `guardarDoc`/`borrarDoc` para bloquear ediciones indebidas: meses cerrados,
  facturas ya causadas, ventas con pagos, nóminas contabilizadas, etc.

## Cómo probarlo en vivo (modo simulación)

El sistema real está en producción con datos reales de la empresa y no debe
tocarse. Para probar el sistema **funcionando**, con datos inventados y sin
guardar nada, existe un modo de simulación:

**https://vidriosyestructuras.pages.dev/?app=finanzas&sim=1**

- Carga `cloudflare/app/simulacion.json` (un mes completo ya facturado,
  con compras, ventas, nómina, pagos, notas, activos).
- Cualquier cambio que hagas en esa URL **no se guarda en ningún servidor**:
  vive solo en la pestaña del navegador.
- Aparece una franja naranja arriba que dice "SIMULACIÓN".

## Qué pedirle a la auditoría

1. **Correctitud contable**: cada asiento generado por `ASIENTO_HOOKS` debe
   cuadrar (suma de débitos = suma de créditos) y usar cuentas del PUC
   coherentes con el hecho económico.
2. **Candados y validaciones**: revisar el "guardián" — ¿hay alguna forma de
   editar o borrar un documento de un mes cerrado, una factura causada o una
   nómina contabilizada sin pasar por él?
3. **Cálculo de nómina** (`finanzas-pro3.js`): liquidación de sueldo,
   auxilio de transporte, horas extra/recargos, aportes de empleado y
   empleador, provisiones de prestaciones, IBC con el piso del salario
   mínimo.
4. **Seguridad del servidor** (`cloudflare/functions/api/[[path]].js`):
   autenticación, control de acceso por rol, inyección en las consultas a D1.
5. **Casos borde**: anticipos mayores a la venta, pagos mayores al saldo,
   notas crédito sobre facturas ya pagadas, devoluciones a proveedor,
   kárdex con salidas mayores al inventario.

Para cada hallazgo, pide que indique **archivo y función (o línea)**, los
datos de entrada que lo producen, y qué esperaría en vez de eso. Con eso se
puede verificar y corregir cada uno.

## Lo que falta / está apagado a propósito

- **Facturación y nómina electrónica**: el modelo de datos y la pantalla están
  listos (número de resolución, catálogo de impuestos, cola `estado:"pendiente"`
  por documento), pero **la transmisión al proveedor tecnológico de la DIAN no
  está construida todavía** — no es solo un interruptor apagado, es un paso que
  falta programar en cuanto haya un proveedor tecnológico elegido.
- Varias empresas (multi-tenant) y NIIF: no implementado.
- Varios porcentajes de ley (ARL, exoneración de parafiscales, tarifas de
  ReteICA por ciudad) están con valores de referencia 2026 y pendientes de
  confirmar con el contador.
- Numeración de comprobantes y operaciones con varios documentos (por ejemplo,
  causar una factura de compra en varios gastos) no son atómicas: si la
  conexión se cae a la mitad, puede quedar una operación a medio registrar, o
  dos usuarios conectados al mismo tiempo podrían calcular el mismo número de
  comprobante. Con el tamaño actual del equipo (2 a 4 personas) el riesgo es
  bajo, pero no está resuelto a nivel de diseño.
- Permisos por rol: ya están definidos y aplicados en el servidor (ver
  [ROLES.md](ROLES.md)): contador, auxiliar contable, gestión del taller y
  gerencia. Lo que queda por decidir es el detalle fino de cada caso a medida
  que se use (por ejemplo, si el auxiliar debe poder anular sus propios
  registros del mismo día).

## Auditoría de otra IA (17 nov 2026) — qué se confirmó y qué se corrigió

Una segunda IA auditó este repositorio y hay un resumen con la verificación de
cada hallazgo (cuáles eran reales, cuáles no, y qué se corrigió) en
`AUDITORIA-2026-11-17.md`. En resumen, se confirmaron y corrigieron dos fallos
reales:

1. El comprobante contable manual validaba la suma de los débitos y créditos
   **sin redondear**, pero el libro mayor redondea cada línea por separado —
   un asiento con centavos podía "cuadrar" al guardarse y quedar descuadrado
   después. Corregido en `cotizador.html` (función `nota-guardar`).
2. Los candados de meses cerrados, el balance de un asiento y los permisos por
   rol solo se verificaban en el navegador (`finanzas-pro2.js`/`finanzas-pro3.js`): una
   petición hecha directo a la API los podía saltar, sin importar el rol de la
   cuenta. Se agregó la misma verificación en el servidor
   (`cloudflare/functions/api/[[path]].js`), probada contra el manejador real
   con una base de datos simulada.

No se encontró ninguna razón técnica para cambiar de sistema o migrar a otro
ERP: todo lo confirmado se corrige dentro del código actual.

## Cómo correr las pruebas del servidor

Necesita Node 22 o más nuevo (usa `node:sqlite`).

```
cd cloudflare
npm install
node construir.js            # deja listo el archivo de datos iniciales vacío
node prueba-permisos.mjs     # cada rol contra cada tipo de operación (128 casos)
node prueba-servidor.mjs     # sesiones, bitácora, terceros, colecciones de solo agregar
```

## Modo sin internet y consumo de datos

**Sincronización liviana.** La pantalla ya no descarga todos los datos cada 15
segundos. Pregunta `GET /api/version` (unos 250 bytes: cuántos documentos hay y la
fecha del último cambio) y solo si cambió pide `GET /api/cambios?desde=…`, que trae
únicamente los documentos tocados. Si alguien borró algo (la cuenta no cuadra) baja
todo una vez. Si nadie toca el sistema en 3 minutos, pregunta cada minuto en vez de
cada 15 segundos. Antes: unos 45 MB por hora por pestaña abierta con los datos de
hoy (193 KB comprimidos × 240). Ahora: menos de 0,2 MB por hora sin cambios.

**Sin internet.** Todo vive en `cloudflare/adaptador.js` y `cloudflare/app/sw.js`:

- El *service worker* guarda la última copia de la página para poder abrirla sin
  conexión (siempre pide primero a internet, para que se vea la versión nueva).
- La última copia de los datos queda en el equipo (IndexedDB, por usuario) y se
  borra al pulsar "Salir".
- Lo que se registra sin internet entra en una cola (IndexedDB), se ve en pantalla
  al instante y se sube en el mismo orden cuando vuelve la conexión. Un cambio sobre
  un registro que aún no ha subido se funde con él (no es "editar lo ya guardado").
- Al subir, el servidor aplica sus reglas de siempre (permisos del rol, meses
  cerrados). Lo que rechaza **no se pierde**: queda en un panel con el motivo para
  decidir. Un reenvío idéntico de algo ya guardado no cuenta como edición.
- Los cambios de configuración (cierres, mapa de cuentas, precios) y los enlaces
  para clientes necesitan internet.
- Los números de comprobante definitivos se asignan al sincronizar.

Pruebas: `cloudflare/prueba-sinconexion.mjs` (Chrome + el manejador real de la API;
`node construir.js` primero) y los casos de versión y cambios en `prueba-permisos.mjs`.

**Internet lenta.** El sistema abre al instante con lo guardado en el equipo: la página
(service worker, `cloudflare/app/sw.js`: se muestra la copia y se revisa en segundo plano
con ETag; si hay una versión nueva avisa con un botón "Actualizar"), la última copia de los
datos (se pone al día con la consulta de cambios) y el rol de la persona. Ninguna llamada
queda esperando para siempre: si una conexión se atasca, se trata como "sin internet" y lo
registrado queda en la cola. En el primer arranque de un equipo nuevo se ve un aviso
"Cargando TEKALUM…" en vez de una pantalla en blanco. La prueba
`prueba-sinconexion.mjs` simula una página de 7 s y datos de 9 s y comprueba que abre en
menos de 4 s.
