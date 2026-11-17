// Regresiones de integridad: manejador real y SQLite con transacciones como D1.batch.
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sq = new DatabaseSync(':memory:');
sq.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
sq.exec("INSERT INTO docs (col,id,data,updated) VALUES ('_sistema','sembrado','{}','x')");
let inyectarFallo = false, cola = Promise.resolve();
const ord = (sql, args) => [...sql.matchAll(/\?(\d+)/g)].map(m => args[+m[1] - 1] ?? null);
const stmt = (sql, args = []) => ({sql,args,bind:(...a)=>stmt(sql,a),
 async run(){if(inyectarFallo && sql.startsWith('INSERT INTO docs') && args[1] === 'romper')throw new Error('Fallo de almacenamiento simulado'); const r=sq.prepare(sql.replace(/\?\d+/g,'?')).run(...ord(sql,args));return {meta:{changes:r.changes}}},
 async first(){return sq.prepare(sql.replace(/\?\d+/g,'?')).get(...ord(sql,args)) ?? null},
 async all(){return {results:sq.prepare(sql.replace(/\?\d+/g,'?')).all(...ord(sql,args))}}
});
const DB={prepare:sql=>stmt(sql),batch(L){const trabajo=cola.then(async()=>{sq.exec('BEGIN');try{const r=[];for(const s of L)r.push(await s.run());sq.exec('COMMIT');return r}catch(e){sq.exec('ROLLBACK');throw e}});cola=trabajo.catch(()=>{});return trabajo}};
const cuentas={admin:{clave:'local-a',rol:'admin'},contador:{clave:'local-c',rol:'contador'},auxiliar:{clave:'local-x',rol:'auxiliar'},taller:{clave:'local-t',rol:'usuario'}};
const env={DB,CUENTAS:JSON.stringify(cuentas)};
const {onRequest}=await import('./functions/api/[[path]].js');
const seed=(col,id,d)=>sq.prepare('INSERT OR REPLACE INTO docs (col,id,data,updated) VALUES (?,?,?,?)').run(col,id,JSON.stringify(d),'x');
const leer=(col,id)=>{const r=sq.prepare('SELECT data FROM docs WHERE col=? AND id=?').get(col,id);return r?JSON.parse(r.data):null};
async function req(rol,method,path,data,extras={}){const r=await onRequest({request:new Request('https://local.invalid/api/'+path,{method,headers:{'x-usuario':rol,'x-clave':cuentas[rol]?.clave||'','content-type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})}),env:{...env,...extras},params:{path:path.split('/')}});return {status:r.status,body:await r.json()}}
const patch=(col,id,data)=>req('contador','PATCH',`docs/${col}/${id}`,data);
const lote=(ops,clave=crypto.randomUUID(),rol='contador')=>req(rol,'POST','lote',{operaciones:ops,clave});
const op=(col,id,data,previo)=>({col,id,data,...(previo===undefined?{}:{previo})});
let pasaron=0;
async function caso(nombre,fn){await fn();pasaron++;console.log('OK',nombre)}
seed('config','contable',{inicio:'2026-10-01',cierres:{'2026-10':{f:'2026-11-01'}},mapa:{},numAsig:{}});
seed('cuentas','b1',{saldoIni:1000,fIni:'2026-10-01'});
seed('maquinaria','m1',{contab:'inicial',valor:1000,fAdq:'2026-10-01',vidaAnios:10});
seed('bodega','mat1',{cantidad:10,mov:[{t:'entrada',f:'2026-10-01',c:10,cu:100}]});
seed('egresos','e1',{f:'2026-09-01',valor:1000,pagado:false,abonos:[{id:'a1',f:'2026-10-10',valor:200,cuenta:'b1'}]});
await caso('sin secretos no hay acceso',async()=>assert.equal((await req('contador','GET','sesion',undefined,{CUENTAS:undefined,APP_CLAVE:undefined})).status,401));
for(const [nombre,col,id,d] of [
 ['saldo inicial','cuentas','b1',{saldoIni:9999}],['fecha inicial','cuentas','b1',{fIni:'2026-11-01'}],
 ['costo activo','maquinaria','m1',{valor:9999}],['vida útil','maquinaria','m1',{vidaAnios:1}],
 ['entrada bodega','bodega','mat1',{mov:[{t:'entrada',f:'2026-10-01',c:10,cu:999}]}],
 ['saldo inicial implícito','bodega','mat1',{cantidad:100}],
 ['abono cerrado','egresos','e1',{abonos:[{id:'a1',f:'2026-10-10',valor:900,cuenta:'b1'}]}],
 ['borrar abono cerrado','egresos','e1',{abonos:[]}]
])await caso('bloquea '+nombre,async()=>assert.equal((await patch(col,id,d)).status,403));
await caso('añadir abono abierto conserva el anterior',async()=>{const e=leer('egresos','e1');assert.equal((await patch('egresos','e1',{abonos:[...e.abonos,{id:'a2',f:'2026-11-10',valor:100,cuenta:'b1'}]})).status,200)});
await caso('entrada nueva de bodega en mes abierto',async()=>{const d=leer('bodega','mat1');assert.equal((await patch('bodega','mat1',{cantidad:12,mov:[...d.mov,{t:'entrada',f:'2026-11-02',c:2,cu:100}]})).status,200)});
for(const [nombre,lineas] of [
 ['sin cuenta',[{cta:'1105',d:100},{cta:'',c:100}]],['cuenta inválida',[{cta:'1105',d:100},{cta:'abc',c:100}]],
 ['negativos',[{cta:'1105',d:100},{cta:'1110',c:110},{cta:'1110',c:-10}]],
 ['doble lado',[{cta:'1105',d:100,c:50},{cta:'1110',c:50}]],
 ['redondeo',[{cta:'1105',d:1.2},{cta:'1110',c:.6},{cta:'1110',c:.6}]],
 ['infinito',[{cta:'1105',d:'Infinity'},{cta:'1110',c:'Infinity'}]]
])await caso('rechaza asiento '+nombre,async()=>assert.equal((await lote([op('asientos',crypto.randomUUID(),{f:'2026-11-01',lineas})])).status,403));
await caso('asiento válido y numerado por servidor',async()=>{const r=await lote([op('asientos','valido',{f:'2026-11-01',num:999,lineas:[{cta:'1105',d:100},{cta:'1110',c:100}]})]);assert.equal(r.status,200);assert.equal(r.body.documentos[0].data.num,1)});
await caso('taller no inventa compras',async()=>assert.equal((await lote([op('egresos','falso',{f:'2026-11-01',valor:100,tercero:'P',compraId:'inexistente'})],crypto.randomUUID(),'taller')).status,403));
seed('compras','co1',{fecha:'2026-11-01',total:100,proveedor:'P'});
await caso('taller no cambia proveedor de compra',async()=>assert.equal((await lote([op('egresos','proveedor-falso',{f:'2026-11-01',valor:100,tercero:'Otro',compraId:'co1'})],crypto.randomUUID(),'taller')).status,403));
await caso('lote no causa más que el total',async()=>{const ops=['sobre1','sobre2'].map(id=>op('egresos',id,{f:'2026-11-01',valor:60,tercero:'P',compraId:'co1'}));assert.equal((await lote(ops,crypto.randomUUID(),'taller')).status,403);assert.equal(leer('egresos','sobre1'),null)});
await caso('causación agrupada válida',async()=>{const ops=[op('egresos','parte1',{f:'2026-11-01',valor:60,tercero:'P',compraId:'co1'}),op('egresos','parte2',{f:'2026-11-01',valor:40,tercero:'P',compraId:'co1'}),op('compras','co1',{...leer('compras','co1'),destino:'materiales'})];assert.equal((await lote(ops,crypto.randomUUID(),'taller')).status,200)});
await caso('un permiso inválido revierte todo el lote',async()=>{const r=await lote([op('ingresos','no-queda',{f:'2026-11-01',valor:100}),op('asientos','no-permiso',{f:'2026-11-01',lineas:[]})],crypto.randomUUID(),'auxiliar');assert.equal(r.status,403);assert.equal(leer('ingresos','no-queda'),null)});
await caso('fallo de almacenamiento revierte documentos, números y bitácora',async()=>{const antes=sq.prepare('SELECT count(*) AS n FROM bitacora').get().n;inyectarFallo=true;const r=await lote([op('asientos','no-queda-num',{f:'2026-11-01',lineas:[{cta:'1105',d:10},{cta:'1110',c:10}]}),op('ingresos','romper',{f:'2026-11-01',valor:10})]);inyectarFallo=false;assert.equal(r.status,400);assert.equal(leer('asientos','no-queda-num'),null);assert.equal(sq.prepare('SELECT count(*) AS n FROM bitacora').get().n,antes);assert.equal(sq.prepare("SELECT valor FROM numeradores WHERE id='NC-'").get().valor,1)});
await caso('reintento idéntico no duplica y devuelve el mismo resultado',async()=>{const key=crypto.randomUUID(),ops=[op('ventas','v-retry',{estado:'contabilizada',f:'2026-11-01',tipoDoc:'CB',num:'CC-9999'})];const a=await lote(ops,key),b=await lote(ops,key);assert.equal(a.status,200);assert.deepEqual(a.body,b.body);assert.equal(leer('ventas','v-retry').num,'CC-0001');assert.equal(sq.prepare("SELECT count(*) AS n FROM bitacora WHERE doc='v-retry'").get().n,1)});
await caso('misma clave con otros datos se rechaza',async()=>{const key=crypto.randomUUID();await lote([op('ingresos','idempotente',{f:'2026-11-01',valor:10})],key);assert.equal((await lote([op('ingresos','idempotente',{f:'2026-11-01',valor:20})],key)).status,409)});
await caso('dos ventas simultáneas reciben números diferentes',async()=>{const r=await Promise.all(['v-a','v-b'].map(id=>lote([op('ventas',id,{estado:'contabilizada',tipoDoc:'CB',f:'2026-11-01',num:'CC-0001'})])));assert.ok(r.every(x=>x.status===200),JSON.stringify(r));assert.notEqual(leer('ventas','v-a').num,leer('ventas','v-b').num)});
await caso('edición con copia antigua se rechaza',async()=>{const previo=leer('ventas','v-a');await patch('ventas','v-a',{cliente:'Nuevo'});const r=await lote([op('ventas','v-a',{...previo,cliente:'Antiguo'},previo)]);assert.equal(r.status,409);assert.equal(leer('ventas','v-a').cliente,'Nuevo')});
await caso('numeración de comprobantes derivados conserva lo asignado',async()=>{const c=leer('config','contable');const r=await lote([op('config','contable',{...c,numAsig:{'RC·ingresos·i1':1,'RC·ingresos·i2':1}})]);assert.equal(r.status,200);const n=leer('config','contable').numAsig;assert.notEqual(n['RC·ingresos·i1'],n['RC·ingresos·i2']);const z=await lote([op('config','contable',{...leer('config','contable'),numAsig:{'RC·ingresos·i1':999}})]);assert.equal(z.status,200);assert.equal(leer('config','contable').numAsig['RC·ingresos·i1'],n['RC·ingresos·i1'])});
await caso('compra y causación nuevas se guardan juntas',async()=>{const ops=[op('compras','co-nueva',{fecha:'2026-11-10',total:100,proveedor:'P'}),op('egresos','eg-nuevo',{f:'2026-11-10',valor:100,tercero:'P',compraId:'co-nueva',pagado:false})];assert.equal((await lote(ops,crypto.randomUUID(),'taller')).status,200)});
await caso('no borrar bodega con saldo inicial histórico',async()=>{seed('bodega','inicial-sin-mov',{cantidad:5,mov:[]});assert.equal((await req('contador','DELETE','docs/bodega/inicial-sin-mov')).status,403)});
await caso('una fecha inválida no elude el cierre',async()=>assert.equal((await lote([op('ingresos','fecha-invalida',{f:'2026-99-99',valor:10})])).status,403));
await caso('pago de nómina cerrado no se reescribe',async()=>{seed('nominas','n-historica',{tipo:'nomina',estado:'contabilizada',f:'2026-09-30',pagos:[{id:'np1',f:'2026-10-10',valor:100}]});assert.equal((await patch('nominas','n-historica',{pagos:[{id:'np1',f:'2026-10-10',valor:900}]})).status,403)});
console.log(`Integridad: ${pasaron} casos pasaron.`);
