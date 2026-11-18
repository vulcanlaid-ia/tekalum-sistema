# Cotizaciones aprobadas, venta y abonos

## Uso

Al aprobar una cotización se crea la orden de trabajo y aparece la pregunta para
convertirla a documento de venta. También hay un botón en el detalle de una
cotización aprobada para hacerlo más tarde.

El formulario propone un anticipo **acordado** del 60 %. El campo de dinero
**recibido ahora** empieza en cero: aprobar nunca inventa un cobro. Se puede
registrar el anticipo completo, una parte, otro porcentaje pactado o ningún
abono. Si no se alcanza el anticipo acordado se exige confirmar que se permite
iniciar la obra sin completarlo.

Los abonos ya registrados se toman en cuenta y no deben volver a introducirse.
El contador, auxiliar y administrador pueden confirmar dinero recibido; el rol
del taller puede crear el documento sin cobro y dejar que Finanzas registre el
pago. Gerencia mantiene sus permisos de consulta financiera.

## Ejemplo: trabajo de $1.000.000, abono de $200.000

- Documento interno por $1.000.000, vinculado a la cotización y visible en Ventas.
- Entrada de caja o banco de $200.000, sin registrar un cobro por $1.000.000.
- Cuenta por cobrar pendiente de $800.000.
- Anticipo pactado de $600.000; faltan $400.000 para completarlo.
- El saldo se cobra después desde Finanzas, sobre la misma obra y documento.

El panel de Ventas diferencia **Facturado** y **Cobrado**. El detalle de la
cotización muestra total, cobrado y pendiente. La cartera utiliza el porcentaje
pactado y no supone siempre el 60 %.

## Política contable implementada para este flujo

El documento creado es **interno, tipo CB, no electrónico**; no transmite ni
pretende reemplazar una factura electrónica validada por DIAN.

La facturación y la entrada de efectivo son hechos distintos. Para no tratar
como ingreso realizado un trabajo aún no entregado, este flujo registra la
facturación contra 270505 (trabajos facturados pendientes de entregar). El cobro
reduce la cuenta por cobrar y aumenta únicamente la caja/banco elegido. Al
marcar la obra como instalada, el ingreso diferido pasa a la cuenta de venta.
El modelo considera una única entrega completa; no implementa reconocimiento
por avance ni entregas parciales.

El contador debe confirmar esta política, la exigibilidad de la cuenta por cobrar
y su clasificación para los contratos del negocio antes de producción. Una
promesa comercial de anticipo no es dinero recibido ni sustituye esa revisión.
Las ventas históricas conservan su comportamiento; se marca el nuevo flujo con
`reconocimiento: entrega`.

Las notas crédito/débito previas o del día de entrega ajustan el saldo diferido;
las posteriores ajustan ingresos. Los pagos anteriores a la facturación se cruzan
con la venta sin volver a ingresar dinero. No se crea una segunda venta automática
al entregar la misma obra.

Como el cotizador actual no discrimina IVA en las ventas, si la empresa cambia
su configuración a responsable de IVA, la conversión se detiene y solicita al
contador preparar la factura con impuestos desde Finanzas. No se inventa una
base tributaria ni se aumenta silenciosamente el precio aprobado.

## Integridad y pruebas

- La conversión vincula cotización, documento y abono; los movimientos de
  inventario siguen realizándose en el flujo de bodega y producción.
- La conversión guarda cotización, venta y abono en un lote atómico D1.
- Un segundo clic o dos conversiones concurrentes no duplican venta ni abono.
- Los datos monetarios proceden de la cotización congelada en servidor, no de
  un precio enviado por el navegador.
- Se comprueban permisos, fechas, cierres, cuenta activa y abonos previos.
- El total y cliente de la cotización convertida no se alteran silenciosamente;
  los ajustes deben tratarse con el contador.
- Se protegen las fechas de entrega de períodos cerrados.

Ejecutar `npm test` dentro de `cloudflare`: se añaden 20 casos de conversión a
las pruebas existentes. También se verificaron en Chromium el formulario que
aparece tras aprobar, el abono parcial, saldo final, entrega, nota crédito y
conversión sin pago: los asientos resultantes cuadraron y el banco solo aumentó
por lo cobrado. Todas las pruebas usaron datos ficticios, sin escribir en producción.

## Publicación

Este cambio continúa la propuesta de integridad contable y necesita sus funciones
`/api/lote`, numeración del servidor y adaptador actualizado. Publicar frontend y
funciones juntos, probar primero con una base D1 separada y revisar con el contador.
DIAN sigue pendiente. La propuesta en GitHub no actualiza por sí sola Cloudflare.
