# Roles y permisos

Cada cuenta de acceso tiene un rol (se asigna en el secreto `CUENTAS` de
Cloudflare). **El servidor es quien decide** qué puede hacer cada rol
(`cloudflare/functions/api/[[path]].js`, sección "Permisos por rol"): aunque
alguien intente saltarse la pantalla y llame directo a la API, el permiso se
aplica igual. La pantalla solo oculta lo que no corresponde para no confundir.

## Quién es quién

| Rol | Para quién | Resumen |
|---|---|---|
| `admin` | Dueños del sistema | Todo, incluida la gestión de usuarios y la actividad de cada persona. |
| `contador` | El contador | Finanzas completa. **Es el único que cierra y reabre meses y años**, hace notas crédito/débito y asientos, liquida la nómina, crea cuentas bancarias y corrige lo ya registrado. En la gestión solo consulta (y maneja la bodega por las devoluciones a proveedores). |
| `auxiliar` | Auxiliares contables | Finanzas, pero **solo registra**: ingresos, egresos, traslados, aportes, ventas, facturas de compra; paga y cobra lo pendiente; concilia el banco. **No cambia ni borra lo ya guardado** (para que nadie "cuadre" números), no cierra meses, no hace notas ni asientos, no toca la nómina ni la configuración. Si se equivoca, avisa al contador. |
| `usuario` | Taller (sistema de gestión) | Cotizador, producción, bodega, proveedores y compras a bodega. **Sin acceso a Finanzas**: no ve la nómina ni los salarios. Solo la venta de chatarra y la contabilización de sus compras a bodega caen solas en Finanzas. |
| `proyector` | Gerencia | Igual que `usuario` en el taller, y además **consulta toda Finanzas** (incluida la nómina) sin poder registrar ni cambiar nada. |

## Niveles por colección

`rw` crear, cambiar y borrar · `cu` crear y cambiar · `c` solo crear ·
`r` solo leer · `-` ni verla · `*` además aplican condiciones propias.

| Colección | contador | auxiliar | usuario | proyector |
|---|---|---|---|---|
| ingresos | rw | c* | c* (solo chatarra) | c* (solo chatarra) |
| egresos | rw | c* | c* (solo ligados a una compra) | c* (ídem) |
| traslados, inversion | rw | c | r | r |
| ventas | rw | cu* | r | r |
| notasdoc, asientos, cuentas | rw | r | r | r |
| nominas | rw | r | **-** | r |
| personal (empleados) | rw | r | r (sin salario ni datos personales) | r |
| terceros | rw | cu | r | r |
| items | rw | c | r | r |
| compras | rw | rw* | rw* | rw* |
| maquinaria | rw | rw* | rw* | rw* |
| cotizaciones, órdenes, proveedores, retazos, sistemas… | r | r | rw | rw |
| bodega | rw | r | rw | rw |
| archivos, publicas | rw | rw | rw | rw |
| auditoria, caja, chatarra (solo agregar) | c | c | c | c |
| `config/contable` | todo | solo numeración, reglas de proveedor, modo de causación y marcar la conciliación (no cerrarla) | solo numeración y reglas de proveedor | ídem |
| `config/precios` | rw | no | rw | rw |
| `config/usuarios` | no | no | no | no (solo `admin`) |

### Condiciones (`*`)

- **Ingresos / egresos del `auxiliar`**: se pueden crear; de lo ya guardado solo
  se permite *registrar el cobro o el pago* de algo que estaba pendiente
  (primera vez, sin cambiar el valor), o agregar un abono nuevo (los abonos
  anteriores no se tocan).
- **Ventas del `auxiliar`**: un borrador se completa y se contabiliza; una vez
  contabilizada solo se le pueden agregar datos de envío al cliente. Anular es
  del contador (con una nota crédito).
- **Compras**: se pueden corregir mientras no estén causadas en Finanzas; una vez
  causadas solo se permite clasificarlas (destino, vencimiento, modo de
  causación); no su valor, fecha ni proveedor.
- **Maquinaria**: la gestión registra equipos; entrar a la contabilidad como
  activo fijo, o cambiar su valor, fecha, vida útil o baja, es del contador.
- **Ingresos / egresos del taller (`usuario`, `proyector`)**: solo la venta de
  chatarra y la contabilización automática de sus compras a bodega.

### Se mantiene para todos los roles

El candado de meses cerrados (`CONT.cierres`) aplica a todos, también al
contador: para corregir algo de un mes cerrado, el contador **reabre el mes**
(queda en la bitácora), corrige y lo vuelve a cerrar.

## Cómo ver el sistema como otro rol

Sin tocar nada real, en el modo simulación:

- `…/?app=finanzas&sim=1&rol=auxiliar` — Finanzas como auxiliar contable
- `…/?app=finanzas&sim=1&rol=proyector` — Finanzas como gerencia (solo consulta)
- `…/?app=finanzas&sim=1&rol=usuario` — Finanzas como gestión (sin acceso)
- `…/?sim=1&rol=usuario` — el sistema de gestión como el taller

## Pruebas

`cloudflare/prueba-permisos.mjs` recorre cada rol contra cada tipo de
operación usando el manejador real de la API con SQLite en memoria
(`node cloudflare/prueba-permisos.mjs`).
