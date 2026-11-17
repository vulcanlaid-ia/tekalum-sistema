> Este documento describe la revisión anterior. Para los cambios posteriores y su alcance, consulta [CORRECCIONES-INTEGRIDAD.md](CORRECCIONES-INTEGRIDAD.md).

# Auditoría externa del 17 nov 2026 — verificación y correcciones

Otra IA auditó la versión [`84f549e`](https://github.com/vulcanlaid-ia/tekalum-sistema/tree/84f549ecd522a3cc092a7da674343431a12c253d)
de este repositorio y reportó 6 hallazgos más una recomendación de negocio.
Cada hallazgo se verificó leyendo el código real (no se dio por cierto solo
porque otra IA lo dijera) y, cuando era real, se corrigió y se probó.

| # | Hallazgo reportado | Verificación | Resultado |
|---|---|---|---|
| 1 | Sin control de rol en la API para operaciones generales de documentos | **Confirmado.** La API solo exige `rol==="admin"` en dos rutas (`/api/enlinea`, `/api/actividad`). Cualquier cuenta autenticada puede crear/editar/borrar cualquier documento. | **Corregido el mismo día**: se definieron los roles (contador, auxiliar contable, gestión, gerencia) y se aplican en el servidor. Ver [ROLES.md](ROLES.md). |
| 2 | Los candados de mes cerrado solo viven en el navegador | **Confirmado.** El "guardián" (`finanzas-pro2.js`, `finanzas-pro3.js`) es JavaScript del cliente; la API no sabía qué mes estaba cerrado. | **Corregido.** Ver abajo. |
| 3 | El servidor acepta asientos contables descuadrados | **Confirmado, con la causa exacta.** El comprobante manual comparaba la *suma sin redondear* de débitos y créditos, pero el libro mayor (`asientosTodos()`) redondea *cada línea por separado*. Con débito 1,20 y créditos 0,60+0,60 la suma cuadra (1,20=1,20) pero al redondear cada línea separado da 1 contra 2. | **Corregido** en `cotizador.html` y reforzado en el servidor. |
| 4 | El envío a la DIAN no es un flujo completo | **Confirmado, y más preciso que como yo lo había descrito.** El botón "Emitir" solo guarda `estado:"pendiente"` en el documento; no existe ningún código que tome esa cola y la transmita a un proveedor tecnológico. | Documentado en el README; no es una corrección de código, es una funcionalidad que falta construir cuando haya proveedor tecnológico elegido. |
| 5 | Operaciones con varios documentos sin transacción (ej. causar una compra en varios gastos) | **Confirmado.** Son llamadas HTTP independientes y seguidas; una falla a mitad de camino puede dejar el estado a medias. | No corregido: requiere repensar esas operaciones (agruparlas en una sola escritura o agregar reintentos idempotentes). Documentado como riesgo conocido. |
| 6 | Numeración de comprobantes sin reserva atómica en el servidor | **Confirmado.** Los números se calculan en el navegador a partir del estado conocido y se guardan en la configuración. Con 2 usuarios escribiendo al mismo tiempo, podrían calcular el mismo número antes de que el primero se sincronice. | No corregido: es un cambio de diseño (pasar la numeración al servidor) que se evaluará aparte; con 2-4 usuarios del taller el riesgo real es bajo. |
| — | Recomendación de migrar a Odoo Community o integrarlo con TEKALUM | Es una opinión de negocio, no un hallazgo técnico. Ningún hallazgo de la tabla obliga a cambiar de sistema: los seis son corregibles (o ya se corrigieron) en el código actual. Migrar significaría reconstruir el cotizador, los cortes de material, la matriz de producción y los bonos de taller, que no vienen de fábrica en ningún ERP genérico. | **No se sigue.** |

## Qué se corrigió y cómo se probó

### 1. Redondeo de asientos manuales (#3)

`cotizador.html`, función `nota-guardar`: ahora la validación suma cada línea
**ya redondeada** (igual que `asientosTodos()`), en vez de redondear solo la
suma final. Un asiento que cuadra al guardarse cuadra también en el libro
mayor.

### 2. Candados en el servidor, no solo en el navegador (#2 y parte de #3)

`cloudflare/functions/api/[[path]].js` ahora repite, del lado del servidor,
las mismas reglas que ya existían en el navegador:

- **Meses cerrados**: no se pueden crear, editar ni borrar movimientos de
  `ingresos`, `egresos`, `traslados`, `inversion`, `asientos`, `ventas`,
  `notasdoc`, `maquinaria` ni `cuentas` con fecha de un mes cerrado — salvo
  las mismas excepciones que ya tenía el navegador (por ejemplo, sí se puede
  registrar *hoy* el pago de una factura antigua).
- **Nómina**: una nómina contabilizada de un mes cerrado no se puede cambiar
  (salvo registrar un pago con fecha de hoy) ni se puede borrar — solo
  anular.
- **Balance de asientos**: un comprobante contable que no sea borrador debe
  tener al menos 2 líneas y cuadrar débito con crédito, *redondeando cada
  línea*, igual que el libro mayor.

Esto es una segunda capa (en inglés, *defense in depth*): el navegador sigue
teniendo sus propios candados con mensajes más claros para quien usa la app;
el servidor ahora rechaza lo mismo aunque alguien llame a la API directamente,
sin importar con qué rol haya entrado.

### Cómo se probó

- `cloudflare/prueba-servidor.mjs` (ya existía): sigue pasando igual que
  antes — sesiones, bitácora, terceros, `config`, colecciones de "solo
  agregar" (`caja`).
- Una prueba nueva invocó el **manejador real** de la API
  (`cloudflare/functions/api/[[path]].js`) con una base de datos simulada en
  memoria, reproduciendo exactamente los casos del reporte: una cuenta
  `auxiliar` editando/borrando un egreso de un mes cerrado, el asiento con el
  redondeo exacto del ejemplo, una nómina contabilizada de un mes cerrado, y
  los casos legítimos que debían seguir funcionando (pagar hoy una factura
  vieja, un asiento bien cuadrado, un borrador sin cuadrar). 12 de 12
  pasaron.
- Las pruebas end-to-end existentes del taller y de Finanzas (simulación de
  un mes completo, 26 casos de Fable, nómina) se volvieron a correr: sin
  descuadres y sin regresiones.

## Pendiente (decisiones, no bugs puntuales)

- ~~**Modelo de permisos por rol** (#1)~~: resuelto, ver [ROLES.md](ROLES.md).
  Probado con `cloudflare/prueba-permisos.mjs` (128 casos, un rol contra cada
  tipo de operación).
- **Transacciones multi-documento y numeración atómica** (#5 y #6): quedan
  como riesgo conocido, aceptable con el tamaño de equipo actual, pendientes
  de una revisión de diseño más a fondo si el número de usuarios crece.
- **Integración DIAN** (#4): depende del trámite de habilitación y de elegir
  proveedor tecnológico.
