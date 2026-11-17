/* Cotización aprobada → documento interno, cobro real y cartera.
   No transmite documentos electrónicos ni registra como cobrado el saldo pendiente. */
(function(){
'use strict';
const estados=['aprobada','produccion','instalada'];
const pagos=q=>store.ingresos.filter(i=>i.cotId===q.id&&i.cobrado!==false&&ING_VENTA.includes(i.tipo));
const abonado=q=>pagos(q).reduce((s,i)=>s+(+i.valor||0)+(+i.rete||0)+(+i.reteica||0),0);
const documento=q=>store.ventas.find(v=>v.cotId===q.id&&v.estado!=='anulada');
const puedeCobrar=()=>['admin','contador','auxiliar'].includes(rolActual());
const puedeConvertir=()=>['admin','contador','auxiliar','usuario'].includes(rolActual());
function fechaEntrega(v){const q=quotes.find(x=>x.id===v.cotId);if(!q?.f_instalada)return '';const sello=String(q.f_instalada);let f=sello.slice(0,10);if(sello.includes('T')){const P=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(sello)).map(p=>[p.type,p.value]));f=P.year+'-'+P.month+'-'+P.day}return f<v.f?v.f:f}
Object.assign(PUC_BASE,{'2705':'Ingresos diferidos de trabajos facturados pendientes de entrega','270505':'Trabajos facturados pendientes de entregar'});
TIPOS_COMP.ER='Ingreso por entrega de obra';
ASIENTO_HOOKS.unshift(add=>{for(const v of store.ventas){if(v.estado!=='contabilizada'||v.reconocimiento!=='entrega')continue;const f=fechaEntrega(v);if(!f)continue;
 let base=FPRO.calcVenta(v).base;
 for(const n of store.notasdoc.filter(n=>n.ref===v.id&&n.estado==='contabilizada'&&n.f<=f))base+=(n.tipo==='NCV'?-1:n.tipo==='NDV'?1:0)*FPRO.calcNota(n).base;
 if(base>0)add('ER',f,'Entrega de obra · '+v.num,v.cliente,[{cta:'270505',d:base},{cta:v.lineas[0]?.cta||mapa('venta'),c:base,cc:v.cc||'PROD'}],{col:'ventas',id:v.id+'|entrega'},{cot:v.cotId});
}});
async function convertir(datos){
 if(modo==='compartido')return db.convertirCotizacion(datos);
 const q=quotes.find(q=>q.id===datos.cotId);if(!q||!estados.includes(q.estado))throw {msg:'Primero aprueba la cotización'};
 const ya=documento(q);if(ya)return {ok:true,existente:true,documentos:[{col:'ventas',id:ya.id,data:ya}]};
 const total=Math.round(totalDe(q)),previo=abonado(q),recibido=+datos.recibido,pct=+datos.porcentaje;
 if(!Number.isSafeInteger(recibido)||recibido<0||previo+recibido>total)throw {msg:'Revisa el abono: no puede superar el saldo'};
 if(recibido&&!puedeCobrar())throw {msg:'El contador o auxiliar confirma el dinero recibido'};
 if(recibido&&!store.cuentas.some(c=>c.id===datos.cuenta&&c.activa!==false))throw {msg:'Elige una caja o banco activo'};
 if(mesCerrado(datos.fecha))throw {msg:'La fecha pertenece a un mes cerrado'};
 const pactado=Math.round(total*pct/100);if(previo+recibido<pactado&&!datos.autorizaInicio)throw {msg:'Confirma que se permite iniciar sin el anticipo completo'};
 return atomico(async()=>{const id='cot-'+q.id,condiciones={porcentajeInicial:pct,anticipoPactado:pactado,abonadoAlConvertir:previo+recibido,inicioSinCompletar:previo+recibido<pactado,f:datos.fecha};
 const num=await FPRO.tomarNumero('CB',datos.fecha);
 await guardarDoc('ventas',id,{f:datos.fecha,estado:'contabilizada',tipoDoc:'CB',num:num.num,cliente:q.cliente?.nombre||'',cotId:q.id,cc:q.cc||'PROD',forma:'k:30',venc:datos.entrega||'',origen:'cotizacion-aprobada',reconocimiento:'entrega',conIva:false,lineas:[{cta:'4120',desc:'Fabricación e instalación según cotización '+q.numero,cant:1,pu:total,ivaT:0}],ret:[],fe:{estado:'no'},condicionesPago:condiciones});
 if(recibido)await guardarDoc('ingresos','abono-'+q.id,{f:datos.fecha,tipo:'saldo',valor:recibido,cuenta:datos.cuenta,cotId:q.id,ventaId:id,cliente:q.cliente?.nombre||'',concepto:'Abono inicial · '+q.numero,cobrado:true,causado:false,rete:0,reteica:0});
 q.conversionVentaId=id;q.condicionesPago=condiciones;
 return {ok:true,documentos:[{col:'ventas',id,data:store.ventas.find(v=>v.id===id)}]};});
}
function resumen(q){const v=documento(q),total=v?FPRO.calcVenta(v).total:Math.round(totalDe(q)),cob=abonado(q),p=q.condicionesPago?.porcentajeInicial??60;
 return `<div class="panel" id="cot-fin-resumen"><h2>Venta y pagos del trabajo</h2><div class="kpis">${kpi('Total del trabajo',cop(total),'Cotización '+esc(q.numero))}${kpi('Cobrado',cop(cob),'Dinero y retenciones aplicados')}${kpi('Pendiente',cop(Math.max(0,total-cob)),'Por cobrar; no está en caja ni bancos')}</div><p>Condición inicial: ${esc(p)} %. ${v?'Documento interno '+esc(v.num||'')+' · visible en Finanzas.':'La cotización aún no tiene documento de venta.'}</p>${v?.reconocimiento==='entrega'?`<p class="who">${fechaEntrega(v)?'Trabajo entregado: ingreso reconocido en contabilidad.':'Trabajo pendiente de entrega: el ingreso contable está diferido. Cobrar no equivale a entregar.'}</p>`:''}${!v&&puedeConvertir()?`<button class="btn primary" data-cot-convertir="${esc(q.id)}">Convertir a venta y registrar abono</button>`:v&&puedeCobrar()?`<button class="btn" data-cot-finanzas="${esc(v.id)}">Ver documento y registrar próximos pagos</button>`:''}</div>`;
}
function abrir(id){const q=quotes.find(q=>q.id===id);if(!q||!estados.includes(q.estado)||!puedeConvertir())return;
 if(documento(q)){toast('Esta cotización ya tiene un documento de venta. Los próximos abonos se registran en Finanzas.');return}
 document.getElementById('cot-conversion')?.remove();
 const d=document.createElement('dialog');d.id='cot-conversion';d.style.cssText='width:min(620px,94vw);max-height:90vh;overflow:auto;border:1px solid #cbd5e1;border-radius:12px;padding:24px;color:#1b2329';
 const total=Math.round(totalDe(q)),previo=abonado(q);
 d.innerHTML=`<form><h2>¿Convertir ${esc(q.numero)} en documento de venta?</h2><p>El trabajo aparecerá en Finanzas. Se registrará como recibido únicamente el abono confirmado. Este documento interno no se envía a DIAN.</p><p>Total: <b>${cop(total)}</b> · Abonos anteriores: <b>${cop(previo)}</b></p>
 <div class="fields"><label class="f">Anticipo acordado (%)<input name="porcentaje" type="number" min="0" max="100" step="0.01" value="60" required></label><label class="f">Fecha del documento y del nuevo abono<input name="fecha" type="date" value="${hoyISO()}" required></label>
 <label class="f">Dinero recibido ahora<input name="recibido" type="number" min="0" step="1" max="${Math.max(0,total-previo)}" value="0" required ${puedeCobrar()?'':'readonly'}><small>${puedeCobrar()?'Deja 0 si todavía no pagaron. No repitas los abonos anteriores.':'El contador o auxiliar registrará el dinero recibido.'}</small></label>
 <label class="f">Caja o banco<select name="cuenta"><option value="">Seleccionar</option>${cuentasActivas().map(c=>`<option value="${esc(c.id)}">${esc(nombreCuenta(c.id))}</option>`).join('')}</select></label>
 <label class="f">Entrega prevista (opcional)<input name="entrega" type="date" min="${hoyISO()}"></label></div>
 ${puedeCobrar()?'<button type="button" class="btn small" data-completar="1">El cliente pagó el anticipo acordado</button>':''}
 <p id="cot-calculo" role="status"></p><label class="chk"><input name="autorizaInicio" type="checkbox"> Permitir iniciar sin abono o con el anticipo incompleto</label>
 <p id="cot-error" role="alert" style="color:#b03a2e"></p><div class="row" style="justify-content:flex-end;margin-top:16px"><button type="button" class="btn" data-cancelar="1">Ahora no</button><button type="submit" class="btn primary">Crear documento y guardar</button></div></form>`;
 const form=d.querySelector('form'),els=form.elements;
 const actualizar=()=>{const pct=+els.porcentaje.value,rec=+els.recibido.value;d.querySelector('#cot-calculo').textContent=`Anticipo acordado: ${cop(Math.round(total*pct/100))}. Cobrado al guardar: ${cop(previo+rec)}. Pendiente total: ${cop(Math.max(0,total-previo-rec))}.`;els.cuenta.required=rec>0};
 form.addEventListener('input',actualizar);form.addEventListener('click',e=>{if(e.target.closest('[data-cancelar]'))d.close();if(e.target.closest('[data-completar]')){els.recibido.value=String(Math.max(0,Math.round(total*(+els.porcentaje.value)/100)-previo));actualizar()}});
 form.addEventListener('submit',async e=>{e.preventDefault();const boton=form.querySelector('[type=submit]');boton.disabled=true;d.querySelector('#cot-error').textContent='';try{await convertir({cotId:id,porcentaje:+els.porcentaje.value,recibido:+els.recibido.value,cuenta:els.cuenta.value,fecha:els.fecha.value,entrega:els.entrega.value,autorizaInicio:els.autorizaInicio.checked,clave:crypto.randomUUID()});d.close();render();toast('Documento creado en Finanzas. El valor no cobrado quedó pendiente.')}catch(err){d.querySelector('#cot-error').textContent=err.msg||err.message||'No se pudo guardar';boton.disabled=false}});
 d.addEventListener('close',()=>d.remove());document.body.appendChild(d);actualizar();d.showModal();
}
let abrirVentaId=new URLSearchParams(location.search).get("venta");
const original=render;render=function(){const r=original.apply(this,arguments);if(abrirVentaId&&store.ventas.some(v=>v.id===abrirVentaId)){const id=abrirVentaId;abrirVentaId=null;vista="ventas";FPRO.ver(id);return r}if(vista==='detalle'){const q=quotes.find(q=>q.id===detalleId),m=document.getElementById('main');if(q&&estados.includes(q.estado)&&m&&!document.getElementById('cot-fin-resumen'))m.insertAdjacentHTML('beforeend',resumen(q))}return r};
document.addEventListener('click',e=>{const c=e.target.closest('[data-cot-convertir]');if(c)abrir(c.dataset.cotConvertir);const v=e.target.closest('[data-cot-finanzas]');if(v){if(SOLO_FIN){vista='ventas';FPRO.ver(v.dataset.cotFinanzas)}else{const params=new URLSearchParams({app:'finanzas',venta:v.dataset.cotFinanzas});if(SIMU){params.set('sim','1');params.set('rol',rolActual())}const w=window.open(location.pathname+'?'+params,'tekalum-finanzas');if(!w)toast('Permite abrir la ventana de Finanzas');else w.focus()}}});
window.COTFIN={abrir,convertir,fechaEntrega,resumen,abonado};
})();
