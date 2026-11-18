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

seed('config','contable',{inicio:'2026-01-01',cierres:{},trib:{iva:'no_responsable'},numAsig:{}});
seed('cuentas','banco',{nombre:'Banco de prueba',activa:true,saldoIni:0,fIni:'2026-01-01'});
const q=(id,extra={})=>seed('cotizaciones',id,{numero:'COT-'+id,estado:'aprobada',subtotal:1000000,descuento:0,cliente:{nombre:'Cliente ficticio'},f_aprobada:'2026-11-10T12:00:00Z',...extra});
const convertir=(id,extra={},rol='contador')=>req(rol,'POST','convertir-cotizacion',{cotId:id,fecha:'2026-11-15',recibido:200000,porcentaje:60,cuenta:'banco',autorizaInicio:true,clave:crypto.randomUUID(),...extra});
await caso('crea documento total y solo cobra el abono real',async()=>{q('parcial');const r=await convertir('parcial');assert.equal(r.status,200,JSON.stringify(r));const v=leer('ventas','cot-parcial'),i=leer('ingresos','abono-parcial');assert.equal(v.lineas[0].pu,1000000);assert.equal(i.valor,200000);assert.equal(v.reconocimiento,'entrega');assert.equal(v.condicionesPago.anticipoPactado,600000);assert.equal(v.condicionesPago.inicioSinCompletar,true);assert.equal(leer('cotizaciones','parcial').conversionVentaId,'cot-parcial')});
await caso('aprobar de nuevo no duplica venta ni ingreso',async()=>{const r=await convertir('parcial',{recibido:600000});assert.equal(r.status,200);assert.equal(r.body.existente,true);assert.equal(leer('ingresos','abono-parcial').valor,200000)});
await caso('permite iniciar sin abono sin inventar movimiento bancario',async()=>{q('cero');assert.equal((await convertir('cero',{recibido:0})).status,200);assert.equal(leer('ingresos','abono-cero'),null);assert.equal(leer('ventas','cot-cero').lineas[0].pu,1000000)});
await caso('60 por ciento no requiere excepción de inicio',async()=>{q('sesenta');assert.equal((await convertir('sesenta',{recibido:600000,autorizaInicio:false})).status,200);assert.equal(leer('ventas','cot-sesenta').condicionesPago.inicioSinCompletar,false)});
await caso('porcentaje pactado puede modificarse',async()=>{q('treinta');assert.equal((await convertir('treinta',{recibido:300000,porcentaje:30,autorizaInicio:false})).status,200);assert.equal(leer('ventas','cot-treinta').condicionesPago.anticipoPactado,300000)});
await caso('rechaza anticipo incompleto sin aceptación explícita',async()=>{q('sin-autorizar');assert.equal((await convertir('sin-autorizar',{autorizaInicio:false})).status,403);assert.equal(leer('ventas','cot-sin-autorizar'),null)});
await caso('descuenta abonos ya registrados y no los duplica',async()=>{q('previo');seed('ingresos','i-previo',{f:'2026-11-11',cotId:'previo',tipo:'anticipo',valor:400000,cobrado:true});assert.equal((await convertir('previo',{recibido:200000,autorizaInicio:false})).status,200);assert.equal(leer('ventas','cot-previo').condicionesPago.abonadoAlConvertir,600000)});
for(const [nombre,extra] of [['negativo',{recibido:-1}],['exceso',{recibido:1000001}],['sin banco',{cuenta:''}],['porcentaje inválido',{porcentaje:101}],['fecha inválida',{fecha:'2026-99-99'}]])await caso('rechaza '+nombre,async()=>{q(nombre.replaceAll(' ','-'));assert.notEqual((await convertir(nombre.replaceAll(' ','-'),extra)).status,200)});
await caso('no convierte cotización sin aprobar',async()=>{q('borrador',{estado:'borrador'});assert.equal((await convertir('borrador')).status,403)});
await caso('el taller puede convertir sin cobrar',async()=>{q('taller');assert.equal((await convertir('taller',{recibido:0},'taller')).status,200)});
await caso('el taller no puede confirmar dinero recibido',async()=>{q('taller-cobra');assert.equal((await convertir('taller-cobra',{},'taller')).status,403)});
await caso('no altera precio ya facturado',async()=>assert.equal((await req('taller','PATCH','docs/cotizaciones/parcial',{subtotal:1})).status,403));
await caso('dos conversiones simultáneas no duplican documentos',async()=>{q('concurrente');const rs=await Promise.all([convertir('concurrente'),convertir('concurrente')]);assert.ok(rs.some(r=>r.status===200));assert.equal(sq.prepare("SELECT count(*) AS n FROM docs WHERE col='ventas' AND json_extract(data,'$.cotId')='concurrente'").get().n,1);assert.equal(sq.prepare("SELECT count(*) AS n FROM docs WHERE col='ingresos' AND json_extract(data,'$.cotId')='concurrente'").get().n,1)});
await caso('un pago inválido no deja factura parcial',async()=>{q('cuenta-inactiva');seed('cuentas','inactiva',{activa:false});assert.equal((await convertir('cuenta-inactiva',{cuenta:'inactiva'})).status,403);assert.equal(leer('ventas','cot-cuenta-inactiva'),null)});
await caso('aprobación nocturna usa el día de Colombia',async()=>{q('noche',{f_aprobada:'2026-11-11T01:00:00Z'});assert.equal((await convertir('noche',{fecha:'2026-11-10',recibido:0})).status,200)});
await caso('cierre impide convertir documentos históricos',async()=>{q('cerrado');seed('config','contable',{inicio:'2026-01-01',cierres:{'2026-11':true}});assert.equal((await convertir('cerrado')).status,403);assert.equal(leer('ventas','cot-cerrado'),null)});
console.log(`Conversión de cotizaciones: ${pasaron} casos pasaron.`);
