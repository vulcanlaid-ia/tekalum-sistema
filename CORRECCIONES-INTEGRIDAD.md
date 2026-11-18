# Correcciones de integridad — TEKALUM

Base: `64b6cdd84eae7d6294acdf1651fb517bcd74a09d`.
Los cambios se prepararon en una copia local. No se modificó la base de producción.

## Cambios

- El acceso se rechaza cuando no se han configurado CUENTAS ni APP_CLAVE.
- Los cierres se validan en servidor para saldos iniciales, activos, bodega,
  pagos, anticipos, abonos y pagos de nómina. Un cierre protege también las
  fechas anteriores que afectan sus saldos, incluidos los cierres anuales.
  Para corregir historia se deben reabrir los cierres posteriores afectados.
- Se conserva el saldo inicial implícito del kárdex al añadir movimientos
  actuales. No se permite reescribir ni borrar movimientos históricos cerrados.
- Los asientos publicados deben tener cuentas con formato numérico válido,
  importes finitos no negativos, un solo lado por línea y débitos/créditos
  iguales después de redondear cada línea. Los borradores no se contabilizan.
  Esto no sustituye la revisión del plan de cuentas y de la clasificación por el contador.
- La causación del taller verifica que la compra exista, que corresponda al
  proveedor y fecha, y que el conjunto de egresos no supere su total. También
  admite crear compra y causación en el mismo lote, validando ambos permisos.
- `/api/lote` valida permisos y cierres antes de escribir. D1.batch confirma
  juntos documentos, bitácora, numeradores y resultado de idempotencia. Si falla
  una sentencia, D1 revierte el lote completo.
- Una revisión global y comprobaciones de los documentos originales evitan
  carreras entre validación y escritura. El adaptador envía la versión leída;
  una edición desactualizada recibe 409, sin sobrescribir el trabajo ajeno.
- Las ventas, notas, asientos manuales y nóminas publicados reciben número
  del servidor dentro del mismo lote. Se conserva la numeración histórica y
  se toma como piso el máximo existente y el contador persistente. La numeración
  derivada `numAsig` se fusiona en servidor conservando asignaciones anteriores.
  No se renumeran automáticamente comprobantes históricos ya duplicados.
- El adaptador utiliza claves de idempotencia y un reintento automático con
  el mismo contenido si se pierde la respuesta. La caché se clona para que el
  cálculo de informes no modifique la versión usada para detectar conflictos.

## Operaciones agrupadas conectadas al lote

- Causación por líneas de facturas de compra.
- Registro de entrada de bodega y su compra/causación; facturas del local.
- Venta con su cobro de contado.
- Recibos de caja con varios documentos y con varios conceptos.
- Egresos con varios conceptos y pagos a proveedor con varias facturas.
- Pago de factura con abono o anticipo por exceso.

Cada compra de una selección masiva se procesa como una unidad; una selección
completa no es una transacción única. Otros flujos administrativos o de
producción que llamen varias veces a guardarDoc deben evaluarse individualmente
y utilizar `atomico(...)` si requieren confirmación conjunta. No se declara que
cada interacción de todo el sistema haya sido convertida a una sola transacción.

## Pruebas

Recomendado: Node 24, con `node:sqlite` disponible.

```sh
cd cloudflare
npm ci
npm test
```

Incluye construcción, 33 casos nuevos de integridad, 128 casos de permisos y
la prueba de sesiones/bitácora del servidor. Los dobles SQLite de D1 ahora
reproducen BEGIN/COMMIT/ROLLBACK, no una sucesión sin transacción.

Los casos nuevos cubren cierres, pagos históricos, asientos inválidos,
compras inexistentes, límites de causación, rollback por error de almacenamiento,
idempotencia, copia desactualizada y dos ventas concurrentes.

Además se verificó en Chromium local, con el manejador real y datos ficticios:
venta de contado, causación de compra, entrada a bodega con causación,
rollback del estado del navegador y respuesta de red perdida sin duplicación.
No se realizaron escrituras en producción ni pruebas contra una base D1 real.

## Incorporación

1. Revisar el parche contra la versión base indicada, especialmente si el
   repositorio ha recibido cambios posteriores. No sustituir cambios nuevos
   por una copia antigua del ZIP.
2. Conservar el mecanismo real de carga inicial: este repositorio público
   usa un archivo vacío. No incluir datos reales ni secretos en GitHub.
3. Ejecutar las pruebas y publicar primero en un entorno de prueba con D1 propio.
4. Publicar frontend y funciones juntos; el frontend actualizado usa `/api/lote`.
   Recargar las pestañas antiguas tras actualizar.
5. Las tablas auxiliares `escritura_estado`, `escritura_guard`, `numeradores` y
   `operaciones` se crean con CREATE TABLE IF NOT EXISTS al inicializar la API.
   No es necesario borrar ni recrear `docs`.
6. Confirmar con el contador un cierre mensual y los saldos antes de usarlo
   como único sistema contable.

## Pendiente externo

No se implementó transmisión DIAN ni nómina electrónica. Se necesita elegir
el proveedor y conocer su API, credenciales y ambiente de habilitación. No se
ha certificado cumplimiento tributario, laboral o NIIF mediante estas pruebas.

El reintento idempotente cubre la misma solicitud mientras el navegador conserva
su identificador. Si se cierra o recarga la pestaña tras una respuesta incierta,
se debe consultar lo guardado antes de volver a registrar el negocio.
