/* =====================================================================================================
   TEKALUM Finanzas · módulo profesional (parte 2)
   Causación línea por línea, reglas de proveedor (4 tipos), retenciones sugeridas, catálogo de productos y
   servicios, envío de documentos al cliente, baja y venta de activos, conciliación de activos, grupos de
   centros de costo, migración desde Siigo / World Office / Excel, búsqueda por CUFE, descarga en ZIP y
   auditoría de numeración.
   ===================================================================================================== */
(()=>{
"use strict";
const r0=x=>Math.round(+x||0),S_=s=>String(s??""),hoy=()=>hoyISO(),yo=()=>window.VYE_SESION?.nombre||"";
const trib=()=>FPRO.trib(),esResp=()=>trib().iva==="responsable";
const impsL=()=>FPRO.imps(),impDe=id=>impsL().find(x=>x.id===id)||null;
const cab=(eyebrow,t,sub,acc="")=>`<div class="fin-h"><div><div class="eyebrow">${eyebrow}</div><h1>${t}</h1>${sub?`<p>${sub}</p>`:""}</div>${acc?`<div class="row">${acc}</div>`:""}</div>`;
TIPOS_COMP.BA="Baja o venta de activo fijo";

/* ======================= Reglas de proveedor (4 tipos) ======================= */
const valDestR=r=>!r?"":r.destino==="gasto"?"gasto:"+(r.cat||"otros"):r.destino||"";
const catDeDest=d=>d==="bodega"?"materiales":d==="local"?"estructura":S_(d).startsWith("gasto:")?S_(d).slice(6)||"otros":"";
const txtDest=d=>d==="bodega"?"Materiales (bodega)":d==="local"?"Adecuación del local":S_(d).startsWith("gasto:")?catEg(S_(d).slice(6))[1]:"Sin clasificar";
function destLinea(r,nombre,tarifa){if(!r)return "";const x=normNom(nombre);
  for(const it of r.items||[]){const t=normNom(it.texto);if(!t||!it.dest)continue;if(it.modo==="empieza"?x.startsWith(t):it.modo==="termina"?x.endsWith(t):x.includes(t))return it.dest}
  const iv=(r.ivaR||{})[String(tarifa)];if(iv)return iv;return valDestR(r)}
let rD=null;
function modalReglasProv(){const d=rD;
  return `<div class="panel ingreso">${fmCab("Reglas de proveedor",esc(d.nombre))}
  <div class="fp-cfg"><h2>Regla de categorización</h2><p>Todas las líneas de las facturas de este proveedor van a la misma cuenta, salvo que otra regla diga algo distinto.</p><select data-frg="destino" data-bsel="1">${opcDest(d.destino)}</select></div>
  <div class="fp-cfg"><h2>Regla por IVA</h2><p>Según la tarifa de IVA de cada línea.</p><div class="fp-grid">${["19","5","0"].map(t=>`<label class="f">Líneas con IVA ${t} %<select data-frgiva="${t}">${opcDest(d.ivaR[t]||"")}</select></label>`).join("")}</div></div>
  <div class="fp-cfg"><h2>Regla por nombre del ítem</h2><p>Si el nombre de la línea empieza por, contiene o termina en un texto, va a la cuenta indicada. Gana la primera que coincida.</p>
    ${d.items.map((it,i)=>`<div class="row" style="gap:6px;margin-bottom:6px;align-items:flex-end"><label class="f" style="flex:1">Criterio<select data-frgit="${i}|modo">${[["empieza","Empieza por"],["contiene","Contiene"],["termina","Termina en"]].map(([k,t])=>`<option value="${k}" ${it.modo===k?"selected":""}>${t}</option>`).join("")}</select></label><label class="f" style="flex:1.4">Texto<input data-frgit="${i}|texto" value="${esc(it.texto)}" placeholder="Ej. vidrio"></label><label class="f" style="flex:2">Va a<select data-frgit="${i}|dest">${opcDest(it.dest)}</select></label><button class="fp-x" data-frg-quitar="${i}" aria-label="Quitar regla">×</button></div>`).join("")}
    <button class="btn small ghost" data-frg-mas="1">+ Agregar regla por nombre</button></div>
  <div class="fp-cfg"><label class="fp-sw" style="border:0"><input type="checkbox" data-frg="asumir" ${d.asumir?"checked":""}><div><b>Asumir retenciones</b><small>Las retenciones de este proveedor no se le descuentan: TEKALUM las paga y van al gasto (531520).</small></div></label></div>
  <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-frg-guardar="1">Guardar reglas</button></div></div>`}
const abrirReglas=(k,nombre)=>{const r=(CONT.reglasProv||{})[k]||{};rD={k,nombre:r.nombre||nombre||k,destino:valDestR(r),ivaR:{...(r.ivaR||{})},items:clone(r.items||[]),asumir:!!r.asumir};finModal="fpreglas";facVer=null;render()};

/* ======================= Causación línea por línea ======================= */
let cD=null;
const RET_DE_CAT={honorarios:"rfHon",arriendo:"rfArr",transporte:"rfTransp",servicios:"rfServ",internet:"rfServ",software:"rfServ",aseo:"rfServ",mantenimiento:"rfServ",publicidad:"rfServ",seguros:"rfServ",bancarios:"",intereses:"",impuestos:"",obrero:"",segSocial:"",prestaciones:"",bonos:"",nominaAdmin:"",segSocialAdmin:"",prestacionesAdmin:""};
const retDeDest=d=>{const c=catDeDest(d);if(c in RET_DE_CAT)return RET_DE_CAT[c];return "rfCompras"};
function lineasCompra(c){
  let L=(c.lineas||[]).map((l,i0)=>{const total=r0(l.total),iva=r0(l.iva),base=+l.base?r0(l.base):total-iva;return {nombre:S_(l.nombre||l.desc||"Ítem"),total,base,iva,tarifa:base>0&&iva>0?Math.round(iva/base*100):0,i0}}).filter(l=>l.total);
  if(!L.length)L=[{nombre:c.documento?"Factura "+c.documento:"Factura",total:r0(c.total),base:r0(c.base)||r0(c.total)-r0(c.iva),iva:r0(c.iva),tarifa:+c.base&&+c.iva?Math.round(+c.iva/+c.base*100):0}];
  const dif=r0(c.total)-L.reduce((s,l)=>s+l.total,0);if(Math.abs(dif)>=1)L.push({nombre:"Ajuste por diferencia en la factura",total:dif,base:dif,iva:0,tarifa:0,ajuste:true});return L}
function filasCausa(){const c=store.compras.find(x=>x.id===cD.id),L=lineasCompra(c),regla=reglaProvDe(c.proveedor,c.nit);let F;
  const sinAj=cD.descartarAj?(()=>{const M=L.filter(l=>!l.ajuste),aj=L.find(l=>l.ajuste);if(aj&&M.length){const k=M.reduce((a,b)=>b.total>a.total?b:a);k.total+=aj.total;k.base+=aj.total}return M})():L;
  if(cD.modo==="uno")F=[{k:"U",nombre:"Toda la factura",total:sinAj.reduce((s,l)=>s+l.total,0),base:sinAj.reduce((s,l)=>s+l.base,0),iva:sinAj.reduce((s,l)=>s+l.iva,0),tarifa:sinAj[0]?.tarifa||0,n:sinAj.length}];
  else if(cD.modo==="iva"){const G={};for(const l of sinAj){const k="T"+l.tarifa;(G[k] ||= {k,nombre:l.tarifa?"Líneas con IVA "+l.tarifa+" %":"Líneas sin IVA",total:0,base:0,iva:0,tarifa:l.tarifa,n:0});G[k].total+=l.total;G[k].base+=l.base;G[k].iva+=l.iva;G[k].n++}F=Object.values(G)}
  else F=sinAj.map((l,i)=>({...l,k:"L"+i,n:1}));
  for(const f of F){if(cD.dest[f.k]===undefined)cD.dest[f.k]=destLinea(regla,f.nombre,f.tarifa)||(typeof valDest==="function"?valDest(c):"")}
  return {c,F,regla}}
function sugerirRet(c,F,regla){const T=trib(),out={rf:0,rfImp:"",riva:0,rica:0,asumir:!!regla?.asumir};if(!T.agente||T.regimen==="simple")return out;
  const B={};for(const f of F){const d=cD.dest[f.k];if(!d)continue;const k=retDeDest(d);if(!k)continue;B[k]=(B[k]||0)+(f.total-f.iva)}
  let mx=0;for(const [k,b] of Object.entries(B)){const im=impDe(k);if(!im||im.activo===false)continue;if(b<r0((+im.baseUVT||0)*(+T.uvt||0)))continue;out.rf+=r0(b*(+im.tarifa||0)/100);if(b>mx){mx=b;out.rfImp=k}}
  const iva=F.reduce((s,f)=>s+f.iva,0),agIva=(T.resp||[]).some(x=>["O-13","O-23"].includes(x));if(agIva&&iva>0){const im=impDe("riva15");if(im)out.riva=r0(iva*(+im.tarifa||0)/100)}
  const ica=impDe("rica");if(ica&&+ica.tarifa>0&&(T.ica||[T.mpio]).includes(T.mpio)){const base=Object.values(B).reduce((s,b)=>s+b,0);out.rica=r0(base*(+ica.tarifa)/1000)}
  return out}
function modalCausar(){const {c,F,regla}=filasCausa(),T=trib(),tot=F.reduce((s,f)=>s+f.total,0),falta=F.some(f=>!cD.dest[f.k]);
  if(!cD.retOk){const s=sugerirRet(c,F,regla);Object.assign(cD.ret,s);cD.retOk=true}
  const R=cD.ret,ret=r0(R.rf)+r0(R.riva)+r0(R.rica);
  return `<div class="panel ingreso" style="width:min(980px,calc(100% - 24px))">${fmCab("Causar factura "+esc(c.documento||""),esc(c.proveedor)+(c.nit?" · NIT "+esc(c.nit):"")+" · "+fechaCorta(c.fecha))}
  <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px"><div class="fp-tabs" style="margin:0;border:0">${[["lineas","Línea por línea"],["iva","Agrupar por IVA"],["uno","Totalizar en un solo ítem"]].map(([k,t])=>`<button data-fcz-modo="${k}" ${cD.modo===k?'aria-current="page"':""}>${t}</button>`).join("")}</div>
    <div class="row" style="gap:6px"><button class="btn small" data-fcz-reglas="1">Reglas de proveedor</button>${c.foto?`<button class="btn small" data-arch="ver" data-id="${esc(c.foto)}">Ver foto</button>`:""}</div></div>
  ${esResp()?`<div class="fp-alerta info">TEKALUM es responsable de IVA: el IVA de cada línea queda como <b>descontable</b>.</div>`:`<div class="fp-alerta info">TEKALUM es no responsable de IVA: el IVA se <b>lleva al valor de cada línea</b> (hace parte del costo).</div>`}
  <div class="tbl-wrap" style="max-height:44vh;overflow:auto"><table class="fp-lineas"><thead><tr><th>Descripción</th><th style="width:32%">Para qué es (cuenta)</th><th class="r" style="width:12%">Base</th><th class="r" style="width:10%">IVA</th><th class="r" style="width:13%">Total</th></tr></thead><tbody>
    ${F.map(f=>{const d=cD.dest[f.k];return `<tr><td class="fp-ancho">${esc(f.nombre)}${f.n>1?`<div class="who">${f.n} líneas</div>`:""}${f.ajuste?`<div class="who" style="color:var(--warn)">El total de las líneas no coincide con el total de la factura</div>`:""}</td><td class="fp-ancho"><select data-fcz-dest="${f.k}" data-bsel="1">${opcDest(d)}</select>${d?`<div class="who">${celdaCta(mapa("eg."+catDeDest(d)))}</div>`:""}</td><td class="r num">${cop(f.base)}</td><td class="r num">${f.iva?cop(f.iva):""}</td><td class="r num"><b>${cop(f.total)}</b></td></tr>`}).join("")}
    <tr class="subt"><td colspan="4" class="r"><b>Total factura</b></td><td class="r num"><b>${cop(tot)}</b></td></tr></tbody></table></div>
  ${F.some(f=>f.ajuste)||cD.descartarAj?`<label class="chk" style="margin-top:6px"><input type="checkbox" data-fcz="descartarAj" ${cD.descartarAj?"checked":""}> Sumar la diferencia a la línea más grande (descartar ajuste)</label>`:""}
  ${T.agente?`<div class="fp-sec"><h3>Retenciones practicadas <span class="pill st-enviada">sugeridas</span></h3><div class="fp-grid">
    <label class="f">Retención en la fuente<select data-fczr="rfImp">${`<option value="">Ninguna</option>`+impsL().filter(i=>i.tipo==="rf").map(i=>`<option value="${i.id}" ${R.rfImp===i.id?"selected":""}>${esc(i.nombre)}</option>`).join("")}</select></label><label class="f">Valor<input data-fczr="rf" value="${esc(R.rf||"")}" inputmode="numeric"></label>
    <label class="f">ReteIVA<input data-fczr="riva" value="${esc(R.riva||"")}" inputmode="numeric"></label><label class="f">ReteICA<input data-fczr="rica" value="${esc(R.rica||"")}" inputmode="numeric"></label></div>
    <label class="chk" style="margin-top:6px"><input type="checkbox" data-fczr="asumir" ${R.asumir?"checked":""}> Asumir las retenciones (no se descuentan al proveedor)</label></div>`:""}
  ${anticipoDisp(c.proveedor)?`<div class="fp-alerta info" style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span>Este proveedor tiene <b>${cop(anticipoDisp(c.proveedor))}</b> en anticipos.</span><label class="f" style="max-width:200px;margin:0">Cruzar en esta factura<input data-fczant="1" value="${esc(cD.anticipo||"")}" inputmode="numeric" placeholder="0"></label></div>`:""}
  <div class="fp-sec"><h3>Forma de pago</h3><div class="fp-grid"><label class="f">Pago<select data-fcz="forma"><option value="credito" ${cD.forma!=="pagada"?"selected":""}>A crédito (queda por pagar)</option><option value="pagada" ${cD.forma==="pagada"?"selected":""}>Ya está pagada</option></select></label>
    ${cD.forma==="pagada"?`<label class="f">Se pagó desde<select data-fcz="cuenta">${opcCuentas(cD.cuenta)}</select></label><label class="f">Fecha del pago<input type="date" data-fcz="fPago" value="${esc(cD.fPago||c.fecha)}"></label>`:`<label class="f">Plazo (días)<input data-fcz="dias" value="${esc(cD.dias)}" inputmode="numeric"></label><label class="f">Vence<input type="date" value="${esc(c.venc||sumaDias(c.fecha,+cD.dias||0))}" disabled></label>`}</div></div>
  <div class="fp-tot" style="margin-top:12px"><div><span>Total factura</span><b class="num">${cop(tot)}</b></div>${ret&&!R.asumir?`<div><span>− Retenciones</span><b class="num">${cop(ret)}</b></div>`:""}<div class="fp-gran"><span>${cD.forma==="pagada"?"Pagado":"Queda por pagar"}</span><span class="num">${cop(tot-(R.asumir?0:ret)-Math.min(r0(cD.anticipo),anticipoDisp(c.proveedor)))}</span></div></div>
  <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fcz-guardar="1" ${falta?"disabled title='Elige para qué es cada línea'":""}>Causar factura</button></div></div>`}
async function causarLineas(){return atomico(causarLineasDentro)}
async function causarLineasDentro(){
  const {c,F,regla}=filasCausa();if(!cD.retOk){Object.assign(cD.ret,sugerirRet(c,F,regla));cD.retOk=true}const R=cD.ret,pag=cD.forma==="pagada";if(F.some(f=>!cD.dest[f.k]))throw {msg:"Elige para qué es cada línea"};if(pag&&store.cuentas.length&&!cD.cuenta)throw {msg:"Elige de qué cuenta se pagó"};
  if(mesCerrado(c.fecha))throw {msg:mesLargo(S_(c.fecha).slice(0,7))+" está cerrado en Contabilidad."};
  if(egDeC(c))throw {msg:"Esta factura ya está causada"};
  const tx="tx"+uid4()+uid4(),venc=pag?"":(c.venc||sumaDias(c.fecha,+cD.dias||0)),G={};
  for(const f of F){const d=cD.dest[f.k];(G[d] ||= {d,total:0,iva:0,nom:[]});G[d].total+=f.total;G[d].iva+=f.iva;G[d].nom.push(f.nombre)}
  const filas=Object.values(G);let i=0;
  for(const g of filas){const cat=catDeDest(g.d),x=catEg(cat);
    await guardarDoc("egresos",null,{tx:filas.length>1?tx:"",f:c.fecha,cat,tipo:x[2],concepto:`${x[1]} · factura ${c.documento||"sin número"} · ${c.proveedor}`,valor:r0(g.total),nota:c.documento||"",tercero:c.proveedor,cotId:"",pagado:pag,...(pag?{fPago:cD.fPago||c.fecha,fPagoReg:new Date().toISOString(),cuenta:cD.cuenta}:{credito:true,venc,cuenta:""}),compraId:c.id,...(esResp()&&g.iva?{ivaDesc:r0(g.iva)}:{}),...(g.d==="local"?{cc:"ADM"}:{}),detalle:g.nom.slice(0,20).join(" · ").slice(0,400),puc:mapa("eg."+cat),
      ...(i===0&&r0(cD.anticipo)>0?{anticipo:Math.min(r0(cD.anticipo),anticipoDisp(c.proveedor),r0(g.total)),fAnticipo:c.fecha}:{}),...(i===0&&(r0(R.rf)||r0(R.riva)||r0(R.rica))?{rf:r0(R.rf),riva:r0(R.riva),rica:r0(R.rica),rfImp:R.rfImp||"",rfCta:impDe(R.rfImp)?.ctaC||"",retAsumida:!!R.asumir}:{}),creado:new Date().toISOString(),por:myId||null});i++}
  const dom=filas.reduce((a,b)=>b.total>a.total?b:a),ctaLineas={};lineasCompra(c).forEach((l,i)=>{if(l.ajuste||l.i0==null)return;const d=cD.dest[cD.modo==="uno"?"U":cD.modo==="iva"?"T"+l.tarifa:"L"+i];if(d)ctaLineas[l.i0]=mapa("eg."+catDeDest(d))});
  await guardarDoc("compras",c.id,{...c,destino:dom.d.startsWith("gasto:")?"gasto":dom.d,...(dom.d.startsWith("gasto:")?{cat:catDeDest(dom.d)}:{}),...(venc?{venc}:{}),causaModo:cD.modo,causadaPor:yo(),ctaLineas});
  await aprenderRegla(c.proveedor,c.nit,dom.d.startsWith("gasto:")?"gasto":dom.d,dom.d.startsWith("gasto:")?catDeDest(dom.d):"");
  CONT.causaModo=cD.modo;await guardarCont();
  cD=null;finModal=null;toast(`Factura causada en ${filas.length} cuenta${filas.length===1?"":"s"}`);render()}
const abrirCausa=id=>{const c=store.compras.find(x=>x.id===id);if(!c)return;cD={id,modo:CONT.causaModo||"lineas",dest:{},forma:"credito",dias:30,cuenta:cuentasActivas()[0]?.id||"",fPago:c.fecha,ret:{},retOk:false,descartarAj:false};finModal="fpcausar";facVer=null;render()};

/* ======================= Búsqueda por CUFE ======================= */
let cufeD=null;
const modalCufe=()=>`<div class="panel ingreso">${fmCab("Buscar una factura por CUFE","El CUFE es el código único que trae cada factura electrónica (abajo del código QR)")}
  <label class="f">CUFE<input id="fp-cufe" data-fcufe="1" value="${esc(cufeD.v)}" placeholder="96 caracteres" autocomplete="off"></label>
  <ol class="who" style="margin:10px 0 0 18px;padding:0"><li>Pulsa <b>Abrir en la DIAN</b>: se abre la consulta oficial con ese documento.</li><li>Descarga ahí el PDF o el XML.</li><li>Súbelo en <b>Facturas de compra › Factura electrónica</b>; el sistema lo lee solo.</li></ol>
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-fm-cerrar="1">Cerrar</button><button class="btn primary" data-fcufe-abrir="1">Abrir en la DIAN</button></div></div>`;

/* ======================= Catálogo de productos y servicios ======================= */
const UNIDADES=[["94","Unidad"],["MTK","Metro cuadrado"],["MTR","Metro lineal"],["KGM","Kilogramo"],["HUR","Hora"],["DAY","Día"],["LTR","Litro"],["ZZ","Otra (mutuamente definida)"]];
const CATS_BASE=()=>[{id:"fab",nombre:"Ventanas, puertas y divisiones (fabricación)",tipo:"producto",ctaIng:"4120",ctaInv:"1430",ctaCosto:"6120"},{id:"serv",nombre:"Instalación, mantenimiento y reparación",tipo:"servicio",ctaIng:"4170",ctaInv:"",ctaCosto:""},{id:"merc",nombre:"Materiales y repuestos para la venta",tipo:"producto",ctaIng:"4135",ctaInv:"1435",ctaCosto:"6135"}];
Object.assign(PUC_BASE,{"4135":"Comercio al por mayor y al por menor","1430":"Productos terminados","1435":"Mercancías no fabricadas por la empresa","6120":"Costo de ventas · industria manufacturera","6135":"Costo de ventas · comercio"});
const cats=()=>CONT.itemCats?.length?CONT.itemCats:CATS_BASE();const catDe=id=>cats().find(x=>x.id===id);
let itF={q:"",cat:"",tipo:"",estado:"activos"},itD=null,catD=null;
window.datalistItems=()=>`<datalist id="fp-items">${store.items.filter(x=>x.activo!==false).map(x=>`<option value="${esc(x.nombre)}">${esc((x.cod||"")+" · "+cop(x.precio))}</option>`).join("")}</datalist>`;
const nuevoCod=()=>{const n=store.items.map(x=>+S_(x.cod).replace(/\D/g,"")||0);return "P"+String(Math.max(0,...n)+1).padStart(4,"0")};
function vItems(){
  const L=store.items.filter(x=>(itF.estado==="todos"||(itF.estado==="activos"?x.activo!==false:x.activo===false))&&(!itF.cat||x.cat===itF.cat)&&(!itF.tipo||x.tipo===itF.tipo)&&(!itF.q||normNom([x.cod,x.nombre,x.barras].join(" ")).includes(normNom(itF.q)))).sort((a,b)=>S_(a.cod).localeCompare(S_(b.cod)));
  return `${cab("Productos y servicios","Productos y servicios","Lo que TEKALUM vende. Al facturar, escribes el nombre y el sistema pone el precio, la cuenta de ingreso, el impuesto y la unidad que pide la DIAN.",`<button class="btn" data-fit-cats="1">Categorías</button><button class="btn" data-fin="itemsprecios">Listas de precios</button><button class="btn" data-fin="migrar">Importar</button><button class="btn primary" data-fit-nuevo="1" ${cats().length?"":"disabled"}>+ Nuevo ítem</button>`)}
  ${cats().length?"":`<div class="fp-alerta info"><b>Empieza con las categorías.</b> Cada categoría dice a qué cuenta va la venta (y el inventario y el costo, si es producto). <button class="btn small primary" data-fit-base="1">Crear categorías base</button></div>`}
  <div class="fp-filtros"><label style="flex:1;min-width:200px">Buscar<input id="fp-itq" data-fitf="q" value="${esc(itF.q)}" placeholder="Código o nombre"></label>
    <label>Categoría<select data-fitf="cat"><option value="">Todas</option>${cats().map(c=>`<option value="${c.id}" ${itF.cat===c.id?"selected":""}>${esc(c.nombre)}</option>`).join("")}</select></label>
    <label>Tipo<select data-fitf="tipo"><option value="">Todos</option><option value="producto" ${itF.tipo==="producto"?"selected":""}>Producto</option><option value="servicio" ${itF.tipo==="servicio"?"selected":""}>Servicio</option></select></label>
    <label>Estado<select data-fitf="estado">${[["activos","Activos"],["inactivos","Inactivos"],["todos","Todos"]].map(([k,t])=>`<option value="${k}" ${itF.estado===k?"selected":""}>${t}</option>`).join("")}</select></label></div>
  ${L.length?`<div class="tbl-wrap"><table class="fp-tabla sin-busca"><thead><tr><th>Código</th><th>Ítem</th><th>Tipo</th><th class="fp-oc">Categoría</th><th class="fp-oc">Unidad</th><th class="r">Precio</th><th>Estado</th></tr></thead><tbody>${L.map(x=>`<tr class="fp-click" data-fit-ed="${esc(x.id)}" tabindex="0"><td class="num"><b>${esc(x.cod)}</b></td><td>${esc(x.nombre)}${x.barras?`<div class="who">${esc(x.barras)}</div>`:""}</td><td>${x.tipo==="servicio"?"Servicio":"Producto"}</td><td class="fp-oc">${esc(catDe(x.cat)?.nombre||"—")}</td><td class="fp-oc">${esc((UNIDADES.find(u=>u[0]===x.unidad)||[,"Unidad"])[1])}</td><td class="r num">${cop(x.precio)}</td><td><span class="pill ${x.activo===false?"st-borrador":"st-aprobada"}">${x.activo===false?"Inactivo":"Activo"}</span></td></tr>`).join("")}</tbody></table></div>`:`<div class="fp-vacio">${store.items.length?"Ningún ítem con esos filtros.":"Aún no hay productos ni servicios."}</div>`}
  ${finModal==="fpitem"&&itD?modalItem():""}${finModal==="fpcats"&&catD?modalCats():""}`}
function modalItem(){const d=itD;return `<div class="panel ingreso">${fmCab(d.id?"Editar ítem":"Nuevo ítem","Producto o servicio del catálogo")}<div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
  <label class="f">Tipo *<select data-fit="tipo"><option value="producto" ${d.tipo!=="servicio"?"selected":""}>Producto</option><option value="servicio" ${d.tipo==="servicio"?"selected":""}>Servicio</option></select></label>
  <label class="f">Categoría *<select data-fit="cat">${cats().filter(c=>c.tipo===d.tipo||!c.tipo).map(c=>`<option value="${c.id}" ${d.cat===c.id?"selected":""}>${esc(c.nombre)}</option>`).join("")}</select></label>
  <label class="f full">Nombre *<input id="fp-itn" data-fit="nombre" value="${esc(d.nombre)}"></label><label class="f">Código<input data-fit="cod" value="${esc(d.cod)}"></label>
  <label class="f">Unidad DIAN *<select data-fit="unidad">${UNIDADES.map(([k,t])=>`<option value="${k}" ${d.unidad===k?"selected":""}>${k} · ${t}</option>`).join("")}</select></label>
  <label class="f">Precio de venta (lista General)<input data-fit="precio" value="${esc(d.precio)}" inputmode="numeric">${listas().length&&d.id?`<small class="who">${listas().map(l=>esc(l.nombre)+": "+cop(precioDe(store.items.find(x=>x.id===d.id)||d,l.id))).join(" · ")}</small>`:""}</label>
  <label class="f">Costo unitario (opcional)<input data-fit="costo" value="${esc(d.costo??"")}" inputmode="numeric"><small class="who">Para ver el margen si no está ligado a bodega</small></label>
  <label class="f">Impuesto<select data-fit="imp"><option value="">Ninguno</option>${impsL().filter(i=>i.tipo==="iva").map(i=>`<option value="${i.id}" ${d.imp===i.id?"selected":""}>${esc(i.nombre)}</option>`).join("")}</select></label>
  <label class="f">Código de barras<input data-fit="barras" value="${esc(d.barras||"")}"></label>
  ${d.tipo!=="servicio"?`<label class="f full">Material de bodega (para calcular el margen)<select data-fit="matId"><option value="">Ninguno</option>${store.bodega.map(b=>`<option value="${esc(b.id)}" ${d.matId===b.id?"selected":""}>${esc(matInfo(b.id).nombre)}</option>`).join("")}</select></label>`:""}
  <label class="f full">Descripción<input data-fit="desc" value="${esc(d.desc||"")}"></label><label class="chk full"><input type="checkbox" data-fit="activo" ${d.activo!==false?"checked":""}> Activo</label></div>
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fit-guardar="1">Guardar</button></div></div>`}
function modalCats(){return `<div class="panel ingreso" style="width:min(900px,calc(100% - 24px))">${fmCab("Categorías","Cada categoría define las cuentas de sus productos o servicios")}
  <div class="tbl-wrap"><table class="fp-lineas"><thead><tr><th>Nombre</th><th style="width:14%">Tipo</th><th style="width:12%">Cuenta ingreso</th><th style="width:12%">Inventario</th><th style="width:12%">Costo</th><th></th></tr></thead><tbody>${catD.map((c,i)=>`<tr><td class="fp-ancho"><input data-fcat="${i}|nombre" value="${esc(c.nombre)}"></td><td><select data-fcat="${i}|tipo"><option value="producto" ${c.tipo!=="servicio"?"selected":""}>Producto</option><option value="servicio" ${c.tipo==="servicio"?"selected":""}>Servicio</option></select></td><td><input data-fcat="${i}|ctaIng" value="${esc(c.ctaIng)}" inputmode="numeric"></td><td><input data-fcat="${i}|ctaInv" value="${esc(c.ctaInv||"")}" inputmode="numeric"></td><td><input data-fcat="${i}|ctaCosto" value="${esc(c.ctaCosto||"")}" inputmode="numeric"></td><td>${store.items.some(x=>x.cat===c.id)?"":`<button class="fp-x" data-fcat-quitar="${i}">×</button>`}</td></tr>`).join("")}</tbody></table></div>
  <button class="btn small" data-fcat-mas="1" style="margin-top:8px">+ Agregar categoría</button>
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fcat-guardar="1">Guardar categorías</button></div></div>`}
// al escribir el nombre de un ítem en una venta se completa la línea
document.addEventListener("change",e=>{const d=e.target.dataset||{};if(!d.fpl||!d.fpl.endsWith("|desc"))return;const it=store.items.find(x=>normNom(x.nombre)===normNom(e.target.value));const v=FPRO.draft();if(!it||!v)return;const l=v.lineas[+d.fpl.split("|")[0]];
  Object.assign(l,{itemId:it.id,cta:catDe(it.cat)?.ctaIng||l.cta,pu:String(precioDe(it,v.lista)||l.pu||""),imp:it.imp||l.imp,unidad:it.unidad||"94"})},true);

/* ======================= Listas de precios ======================= */
// "General" es el precio de cada ítem; las demás listas tienen un % sobre la General o un precio propio por ítem
const listas=()=>CONT.listasPrecios||[];const listaDe=id=>listas().find(x=>x.id===id);
function precioDe(it,lid){if(!it)return 0;const L=lid&&lid!=="general"?listaDe(lid):null;if(!L)return r0(it.precio);const p=it.precios?.[L.id];if(p!==undefined&&p!==""&&p!==null)return r0(p);return r0((+it.precio||0)*(1+(+L.ajuste||0)/100))}
const listaCliente=n=>(CONT.listaCliente||{})[normNom(n)]||"";
window.selLista=v=>listas().length?`<label class="f">Lista de precios<select data-fpv="lista"><option value="">General</option>${listas().map(l=>`<option value="${l.id}" ${v.lista===l.id?"selected":""}>${esc(l.nombre)}</option>`).join("")}</select></label>`:"";
// al cambiar la lista o el cliente, los ítems del catálogo toman el precio de la lista
document.addEventListener("change",e=>{const d=e.target.dataset||{};if(d.fpv!=="lista"&&d.fpv!=="cliente")return;const v=FPRO.draft();if(!v)return;
  if(d.fpv==="cliente"){const l=listaCliente(e.target.value);if(l&&listaDe(l)&&v.lista!==l)v.lista=l;else return}else v.lista=e.target.value;
  let n=0;for(const ln of v.lineas){const it=store.items.find(x=>x.id===ln.itemId);if(it){ln.pu=String(precioDe(it,v.lista));n++}}if(n)toast(`Precios de la lista ${listaDe(v.lista)?.nombre||"General"} aplicados`)},true);
let lpD=null,lpGrid=null;
function vListas(){const L=listas(),I=store.items.filter(x=>x.activo!==false).sort((a,b)=>S_(a.cod).localeCompare(S_(b.cod))),G=lpGrid||(lpGrid={});
  const nCli=id=>Object.values(CONT.listaCliente||{}).filter(x=>x===id).length;
  return `${cab("Productos y servicios","Listas de precios","La lista <b>General</b> es el precio normal de cada producto. Crea otras listas (por ejemplo para constructoras o mayoristas) con un porcentaje sobre la General o con precios propios, y asígnalas a tus clientes: al facturarles, los precios salen de su lista.",`<button class="btn primary" data-flp-nueva="1">+ Nueva lista</button>`)}
  <div class="tbl-wrap"><table class="fp-tabla sin-busca"><thead><tr><th>Lista</th><th class="r">Ajuste sobre la General</th><th class="r">Clientes</th><th></th></tr></thead><tbody>
    <tr><td><b>General</b><div class="who">Precio de cada ítem en el catálogo</div></td><td class="r">—</td><td class="r num">${Math.max(0,tercerosTodos().filter(t=>t.tipos?.has?.("cliente")).length-Object.keys(CONT.listaCliente||{}).length)}</td><td></td></tr>
    ${L.map(l=>`<tr><td><b>${esc(l.nombre)}</b></td><td class="r num">${+l.ajuste?(l.ajuste>0?"+":"")+l.ajuste+" %":"Precios propios"}</td><td class="r num">${nCli(l.id)}</td><td class="r"><button class="btn small" data-flp-ed="${l.id}">Editar y asignar clientes</button></td></tr>`).join("")}</tbody></table></div>
  ${I.length&&L.length?`<div class="fp-cfg" style="margin-top:14px"><div class="row" style="justify-content:space-between;gap:8px"><div><h2>Precios por ítem</h2><p style="margin:0">Vacío = se calcula con el ajuste de la lista (lo que ves en gris).</p></div><button class="btn primary" data-flp-grid="1">Guardar precios</button></div>
    <div class="tbl-wrap" style="margin-top:10px"><table class="fp-lineas"><thead><tr><th>Ítem</th><th class="r" style="width:14%">General</th>${L.map(l=>`<th class="r" style="width:14%">${esc(l.nombre)}</th>`).join("")}</tr></thead><tbody>
    ${I.map(it=>`<tr><td class="fp-ancho"><b>${esc(it.cod)}</b> ${esc(it.nombre)}</td><td><input class="num-in" data-flpg="${esc(it.id)}|general" value="${esc(G[it.id+"|general"]??it.precio)}" inputmode="numeric" aria-label="Precio General de ${esc(it.nombre)}"></td>${L.map(l=>`<td><input class="num-in" data-flpg="${esc(it.id)}|${l.id}" value="${esc(G[it.id+"|"+l.id]??it.precios?.[l.id]??"")}" placeholder="${esc(String(r0((+it.precio||0)*(1+(+l.ajuste||0)/100))))}" inputmode="numeric" aria-label="Precio ${esc(l.nombre)} de ${esc(it.nombre)}"></td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`:
    `<div class="fp-vacio" style="margin-top:14px">${I.length?"Crea una lista para ponerle precios a tus ítems.":"Primero crea tus productos y servicios en el catálogo."}</div>`}
  ${finModal==="fplista"&&lpD?modalLista():""}`}
function modalLista(){const d=lpD,C=tercerosTodos().filter(t=>t.tipos?.has?.("cliente")||(CONT.listaCliente||{})[normNom(t.nombre)]);
  return `<div class="panel ingreso">${fmCab(d.id?"Editar lista de precios":"Nueva lista de precios","Los ítems sin precio propio toman el de la General con este ajuste")}
  <div class="fields" style="margin:0;grid-template-columns:2fr 1fr"><label class="f">Nombre<input id="fp-lpn" data-flp="nombre" value="${esc(d.nombre)}" placeholder="Ej. Constructoras"></label><label class="f">Ajuste sobre la General (%)<input data-flp="ajuste" value="${esc(d.ajuste)}" inputmode="decimal" placeholder="Ej. -10"></label></div>
  <div class="fp-sec"><h3>Clientes con esta lista</h3>${C.length?`<div style="max-height:34vh;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px">${C.map(t=>{const k=normNom(t.nombre),otra=(CONT.listaCliente||{})[k];return `<label class="chk"><input type="checkbox" data-flpc="${esc(k)}" ${d.cli.has(k)?"checked":""}> ${esc(t.nombre)}${otra&&otra!==d.id&&listaDe(otra)?` <span class="who">(ahora en ${esc(listaDe(otra).nombre)})</span>`:""}</label>`}).join("")}</div>`:`<p class="who">Aún no hay clientes.</p>`}</div>
  <div class="row" style="justify-content:space-between;margin-top:12px">${d.id?`<button class="btn ghost" data-flp-borrar="1">Borrar lista</button>`:"<span></span>"}<div class="row"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-flp-guardar="1">Guardar lista</button></div></div></div>`}
document.addEventListener("click",async e=>{const t=e.target.closest("[data-flp-nueva],[data-flp-ed],[data-flp-guardar],[data-flp-borrar],[data-flp-grid]");if(!t)return;const d=t.dataset;
  try{
    if(d.flpNueva){lpD={id:"",nombre:"",ajuste:"",cli:new Set()};finModal="fplista";render();setTimeout(()=>$("#fp-lpn")?.focus(),40);return}
    if(d.flpEd){const l=listaDe(d.flpEd);lpD={...l,ajuste:S_(l.ajuste??""),cli:new Set(Object.entries(CONT.listaCliente||{}).filter(([,v])=>v===l.id).map(([k])=>k))};finModal="fplista";render();return}
    if(d.flpGuardar){const nm=S_(lpD.nombre).trim();if(!nm)throw {msg:"Escribe el nombre de la lista"};if(normNom(nm)==="general"||listas().some(l=>l.id!==lpD.id&&normNom(l.nombre)===normNom(nm)))throw {msg:"Ya hay una lista con ese nombre"};
      const aj=+S_(lpD.ajuste).replace(",",".")||0;if(aj<=-100)throw {msg:"El ajuste no puede ser de −100 % o menos"};const id=lpD.id||"lp"+uid4();
      CONT.listasPrecios=[...listas().filter(l=>l.id!==id),{id,nombre:nm,ajuste:aj}];const LC={...(CONT.listaCliente||{})};for(const [k,v] of Object.entries(LC))if(v===id&&!lpD.cli.has(k))delete LC[k];for(const k of lpD.cli)LC[k]=id;CONT.listaCliente=LC;
      lpD=null;finModal=null;render();await guardarCont("Lista de precios guardada");return}
    if(d.flpBorrar){if(!confirm(`¿Borrar la lista "${lpD.nombre}"? Sus clientes vuelven a la General.`))return;const id=lpD.id;CONT.listasPrecios=listas().filter(l=>l.id!==id);CONT.listaCliente=Object.fromEntries(Object.entries(CONT.listaCliente||{}).filter(([,v])=>v!==id));
      for(const it of store.items.filter(x=>x.precios?.[id]!==undefined)){const p={...it.precios};delete p[id];await guardarDoc("items",it.id,{...it,precios:p})}lpD=null;finModal=null;render();await guardarCont("Lista borrada");return}
    if(d.flpGrid){let n=0;const G=lpGrid||{};const porItem={};for(const [k,v] of Object.entries(G)){const [id,lid]=k.split("|");(porItem[id] ||= {})[lid]=v}
      for(const [id,cam] of Object.entries(porItem)){const it=store.items.find(x=>x.id===id);if(!it)continue;const nuevo={...it,precios:{...(it.precios||{})}};
        for(const [lid,v] of Object.entries(cam)){const s=S_(v).trim();if(lid==="general"){if(!(r0(s)>0))throw {msg:"El precio General de "+it.nombre+" debe ser mayor que cero"};nuevo.precio=r0(s)}else if(s==="")delete nuevo.precios[lid];else nuevo.precios[lid]=r0(s)}
        await guardarDoc("items",id,nuevo);n++}lpGrid=null;toast(n?`Precios guardados (${n} ítem${n===1?"":"s"})`:"No había cambios");render();return}
  }catch(err){toast(err?.msg||errMsg(err))}});
document.addEventListener("input",e=>{const d=e.target.dataset||{};if(lpD&&d.flp){lpD[d.flp]=e.target.value;return}if(d.flpg){(lpGrid ||= {})[d.flpg]=e.target.value;return}});
document.addEventListener("change",e=>{const d=e.target.dataset||{};if(lpD&&d.flpc){e.target.checked?lpD.cli.add(d.flpc):lpD.cli.delete(d.flpc)}});
document.addEventListener("click",e=>{if(e.target.closest("[data-fm-cerrar]"))lpD=null;if(e.target.closest("[data-fin],[data-go]"))lpGrid=null},true);
// costo de una obra: materiales que salieron de bodega para sus OT (o los de la cotización si aún no hay despachos),
// más la mano de obra, consumibles, dirección y administración que calcula la cotización, más los gastos ligados a la obra
function costoObra(q){if(!q)return null;let C=null;try{C=calcQuote(q,precios)}catch{}const conCot=!!(C&&C.items.length&&C.costo>0);
  let matE=0;if(conCot)for(const {c} of C.items)matE+=(c.cPerfil+c.cVidrio+c.cAcc)*c.cant;const mo=conCot?C.costo-matE:0;
  const ots=store.ordenes.filter(o=>o.cotId===q.id&&o.estado!=="anulada").map(o=>S_(o.numero)).filter(Boolean);let matR=0,hayR=false;
  if(ots.length)for(const k of kardexTodos())for(const l of k.L){if(!ots.some(n=>S_(l.nota).includes(n)))continue;if(l.t==="salida"&&!/^Devolución a proveedor/.test(l.nota)){matR+=l.val;hayR=true}else if(l.dev)matR-=l.val}
  const gas=store.egresos.filter(e=>e.cotId===q.id&&e.cat!=="materiales"&&!NO_GASTO.includes(catEg(e.cat)[3])).reduce((t,e)=>t+(+e.valor||0),0);
  if(!conCot&&!hayR&&!gas)return null;
  if(!conCot)return {costo:matR+gas,mat:matR,mo:0,gas,real:true,parcial:true,fuente:"Material de bodega y gastos de la obra (sin mano de obra: la cotización no tiene detalle)"};
  return {costo:(hayR?matR:matE)+mo+gas,mat:hayR?matR:matE,mo,gas,real:hayR,fuente:hayR?"Material real de bodega + mano de obra de la cotización"+(gas?" + gastos de la obra":""):"Estimado de la cotización"+(gas?" + gastos de la obra":"")}}
let mgFil="todo";
function vItemsVentas(){const M={},per=hoy().slice(0,4),obras={};
  // base de cada obra: suma de las ventas contabilizadas ligadas a ella (para repartir su costo)
  for(const v of store.ventas){if(v.estado!=="contabilizada"||!v.cotId)continue;obras[v.cotId]=(obras[v.cotId]||0)+FPRO.calcVenta(v).base}
  const cObra={};for(const id of Object.keys(obras))cObra[id]=costoObra(quotes.find(q=>q.id===id));
  for(const v of store.ventas){if(v.estado!=="contabilizada")continue;const t=FPRO.calcVenta(v);for(const l of t.L){if(!l.base)continue;const it=store.items.find(x=>x.id===l.itemId)||(l.desc?store.items.find(x=>normNom(x.nombre)===normNom(l.desc)):null),k=it?it.id:"d:"+normNom(l.desc)+(v.cotId?"|"+v.cotId:"");
    const x=(M[k] ||= {nombre:it?it.nombre:l.desc||"Sin descripción",tipo:it?.tipo||"",cant:0,ing:0,costo:null,it,fuente:"",obra:v.cotId?quotes.find(q=>q.id===v.cotId)?.numero:""});x.cant+=+l.cant||0;x.ing+=l.base;let c=null;
    if(it?.matId){const b=store.bodega.find(y=>y.id===it.matId);if(b){c=(+l.cant||0)*kardexDe(b).prom;x.fuente="Costo promedio del kárdex"}}
    else if(it&&+it.costo>0){c=(+l.cant||0)*(+it.costo);x.fuente="Costo del catálogo"}
    else if(v.cotId&&cObra[v.cotId]&&obras[v.cotId]>0){c=cObra[v.cotId].costo*l.base/obras[v.cotId];x.fuente=cObra[v.cotId].fuente;x.real=cObra[v.cotId].real}
    if(c!=null)x.costo=(x.costo||0)+c}}
  let L=Object.values(M).sort((a,b)=>b.ing-a.ing);const conC=L.filter(x=>x.costo!=null),ing=L.reduce((s,x)=>s+x.ing,0),ingC=conC.reduce((s,x)=>s+x.ing,0),cos=conC.reduce((s,x)=>s+x.costo,0),sinC=L.filter(x=>x.costo==null);
  if(mgFil==="sin")L=sinC;else if(mgFil==="con")L=conC;
  // margen contable del año: ingresos operacionales (41) menos costos (6 y 7)
  let i41=0,c67=0;try{for(const a of asientosTodos())if(S_(a.f).startsWith(per))for(const l of a.lineas){const c=S_(l.cta);if(c.startsWith("41"))i41+=l.c-l.d;else if(/^[67]/.test(c)&&a.tipo!=="TC")c67+=l.d-l.c}}catch{}
  const pct=(a,b)=>b?Math.round(a/b*1000)/10:null,colP=p=>p==null?"":p<15?"color:var(--bad)":p<30?"color:var(--warn)":"color:var(--ok)";
  return `${cab("Productos y servicios","Ventas y margen","Lo vendido por producto, servicio u obra, con su costo y su margen. El costo sale del kárdex (productos ligados a un material), del costo del catálogo o, en las obras, del material que salió de bodega para sus OT más la mano de obra de la cotización.")}
  <div class="kpis">${kpi("Ingreso total",cop(ing),L.length+" ítems")}${kpi("Costo",cop(cos),sinC.length?sinC.length+" ítem(s) sin costo":"de todo lo vendido")}${kpi("Margen bruto",cop(ingC-cos),pct(ingC-cos,ingC)==null?"—":pct(ingC-cos,ingC)+" % sobre lo que tiene costo",colP(pct(ingC-cos,ingC)))}${kpi("Margen contable "+per,i41?pct(i41-c67,i41)+" %":"—",i41?"ingresos 41 menos costos 6 y 7: "+cop(i41-c67):"sin ingresos en el año",colP(pct(i41-c67,i41)))}</div>
  ${sinC.length?`<div class="fp-alerta" style="margin-top:12px">${sinC.length} ítem(s) por ${cop(sinC.reduce((s,x)=>s+x.ing,0))} no tienen costo. Para verlo: liga el producto a un material de bodega o ponle costo en el catálogo; en las obras, el costo sale de la cotización ligada a la venta.</div>`:""}
  <div class="row" style="margin:12px 0">${[["todo","Todo"],["con","Con costo"],["sin","Sin costo"]].map(([k,t])=>`<button class="chip" data-fmg="${k}" aria-pressed="${mgFil===k}">${t}</button>`).join("")}</div>
  ${L.length?`<div class="tbl-wrap"><table class="fp-tabla"><thead><tr><th>Ítem</th><th class="r">Cantidad</th><th class="r">Ingreso</th><th class="r">Costo</th><th class="r">Margen</th><th class="r">% margen</th></tr></thead><tbody>${L.map(x=>{const p=x.costo==null?null:pct(x.ing-x.costo,x.ing);return `<tr><td>${esc(x.nombre)}<div class="who">${x.tipo==="servicio"?"Servicio":x.it?"Producto":x.obra?"Obra "+esc(x.obra):"Sin catálogo"}${x.fuente?" · "+esc(x.fuente):""}</div></td><td class="r num">${fmtQ(x.cant)}</td><td class="r num">${cop(x.ing)}</td><td class="r num">${x.costo!=null?cop(x.costo):x.it?`<button class="btn small" data-fit-ed="${esc(x.it.id)}">Ponerle costo</button>`:x.obra?`<span class="who" title="La cotización de la obra no tiene detalle y aún no hay material despachado ni gastos ligados">Sin costo</span>`:`<button class="btn small" data-fmg-cat="${esc(x.nombre)}" data-pu="${Math.round(x.ing/(x.cant||1))}">Ponerle costo</button>`}</td><td class="r num">${x.costo==null?"—":cop(x.ing-x.costo)}</td><td class="r num" style="font-weight:700;${colP(p)}">${p==null?"—":String(p).replace(".",",")+" %"}</td></tr>`}).join("")}</tbody>
  <tfoot><tr><td><b>Total con costo</b></td><td></td><td class="r num"><b>${cop(ingC)}</b></td><td class="r num"><b>${cop(cos)}</b></td><td class="r num"><b>${cop(ingC-cos)}</b></td><td class="r num" style="font-weight:700;${colP(pct(ingC-cos,ingC))}">${pct(ingC-cos,ingC)==null?"—":String(pct(ingC-cos,ingC)).replace(".",",")+" %"}</td></tr></tfoot></table></div>`:`<div class="fp-vacio" style="margin-top:12px">${store.ventas.some(v=>v.estado==="contabilizada")?"No hay ítems en este filtro.":"Aún no hay ventas contabilizadas."}</div>`}${finModal==="fpitem"&&itD?modalItem():""}`}
document.addEventListener("click",e=>{const b=e.target.closest("[data-fmg],[data-fmg-cat]");if(!b)return;if(b.dataset.fmg){mgFil=b.dataset.fmg;render();return}
  // crea el producto en el catálogo con el nombre de la línea vendida: desde ahí se le pone el costo
  const c=cats()[0];itD={tipo:c?.tipo||"producto",cat:c?.id||"",nombre:b.dataset.fmgCat,cod:nuevoCod(),unidad:"94",precio:b.dataset.pu||"",costo:"",imp:"",barras:"",desc:"",activo:true};finModal="fpitem";render();setTimeout(()=>document.querySelector('[data-fit="costo"]')?.focus(),40)});

/* ======================= Envío del documento al cliente ======================= */
let envD=null;
window.btnEnviar=v=>`<button class="btn primary" data-fenv="${esc(v.id)}">Enviar al cliente</button>`;
async function enlaceVenta(v){if(modo!=="compartido")throw {msg:"El enlace para el cliente funciona en la versión publicada"};const E=precios.empresa||{},token=v.token||nuevoToken();
  await db.doc("publicas/"+token).set({tipo:"documento",ventaId:v.id,numero:v.num,cliente:v.cliente,html:FPRO.htmlVenta(v),empresa:{nombre:E.nombre||"TEKALUM",whatsapp:E.whatsapp||"",tel:E.tel||""},total:FPRO.calcVenta(v).total,f:new Date().toISOString()});
  if(!v.token)await guardarDoc("ventas",v.id,{...v,token,enviada:new Date().toISOString()});return location.origin+"/c/"+token}
const modalEnviar=()=>{const v=store.ventas.find(x=>x.id===envD.id),t=terceroDe(v?.cliente)||{},tel=S_(t.tel).replace(/\D/g,""),msg=`Hola${v.cliente?" "+v.cliente.split(" ")[0]:""}, te comparto ${v.tipoDoc==="FV"?"la factura":"la cuenta de cobro"} ${v.num} de ${precios.empresa?.nombre||"TEKALUM"} por ${cop(FPRO.calcVenta(v).neto)}: ${envD.url}`;
  return `<div class="panel ingreso">${fmCab("Enviar "+esc(v.num),"El cliente abre el enlace, lo ve y lo puede imprimir o guardar en PDF")}<label class="f">Enlace<input value="${esc(envD.url)}" readonly onclick="this.select()"></label>
  <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/${tel?(tel.length===10?"57"+tel:tel):""}?text=${encodeURIComponent(msg)}">Enviar por WhatsApp</a><a class="btn" href="mailto:${esc(t.email||"")}?subject=${encodeURIComponent((v.tipoDoc==="FV"?"Factura ":"Cuenta de cobro ")+v.num)}&body=${encodeURIComponent(msg)}">Enviar por correo</a><button class="btn" data-fenv-copiar="1">Copiar enlace</button></div>
  ${v.vistas?`<p class="who" style="margin-top:10px">El cliente lo abrió ${v.vistas} vez${v.vistas===1?"":"es"} (primera: ${fechaCorta(S_(v.vistaCliente).slice(0,10))}).</p>`:""}<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn ghost" data-fm-cerrar="1">Cerrar</button></div></div>`};

/* ======================= Activos: baja o venta, conciliación ======================= */
let bajaD=null;
window.btnBaja=m=>m.tipo==="Por comprar"?"":`<button class="btn-ico" data-fbaja="${esc(m.id)}" aria-label="${m.baja?"Deshacer la baja":"Dar de baja o vender"}" title="${m.baja?"Deshacer la baja":"Dar de baja o vender"}">${m.baja?"↺":"⤓"}</button>`;
const MOTIVOS_BAJA=[["venta","Venta"],["dano","Daño sin reparación"],["obsoleto","Obsolescencia"],["perdida","Pérdida o robo"],["donacion","Donación"],["devolucion","Devolución al proveedor"]];
const modalBaja=()=>{const m=store.maquinaria.find(x=>x.id===bajaD.id),x=depAct(m,S_(bajaD.f).slice(0,7));
  return `<div class="panel ingreso">${fmCab("Dar de baja · "+esc(m.nombre),"Sale de la contabilidad y deja de depreciarse desde el mes de la baja")}<div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
  <label class="f">Fecha<input type="date" data-fbj="f" value="${esc(bajaD.f)}"></label><label class="f">Motivo<select data-fbj="motivo">${MOTIVOS_BAJA.map(([k,t])=>`<option value="${k}" ${bajaD.motivo===k?"selected":""}>${t}</option>`).join("")}</select></label>
  ${bajaD.motivo==="venta"?`<label class="f">Valor de venta<input data-fbj="valor" value="${esc(bajaD.valor)}" inputmode="numeric"></label><label class="f">Entró a<select data-fbj="cuenta">${opcCuentas(bajaD.cuenta)}</select></label><label class="f full">Comprador<input data-fbj="tercero" value="${esc(bajaD.tercero||"")}"></label>`:""}
  <label class="f full">Nota<input data-fbj="nota" value="${esc(bajaD.nota||"")}"></label></div>
  <div class="fp-tot" style="margin-top:12px"><div><span>Costo</span><b class="num">${cop(x.costo)}</b></div><div><span>Depreciación acumulada</span><b class="num">${cop(x.dep)}</b></div><div class="fp-gran"><span>Valor en libros</span><span class="num">${cop(x.libros)}</span></div>${bajaD.motivo==="venta"?`<div><span>${r0(bajaD.valor)-x.libros>=0?"Utilidad":"Pérdida"} en la venta</span><b class="num">${cop(Math.abs(r0(bajaD.valor)-x.libros))}</b></div>`:`<div><span>Pérdida por la baja</span><b class="num">${cop(x.libros)}</b></div>`}</div>
  ${m.contab?"":`<p class="who">Este activo no está en la contabilidad: solo cambia su estado.</p>`}
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fbj-guardar="1">Dar de baja</button></div></div>`};
ASIENTO_HOOKS.push((add,A)=>{
  for(const m of store.maquinaria){if(!m.baja?.f||!m.contab||!(valorDe(m)>0)||m.tipo==="Por comprar")continue;const g=grupoDe(m),cDep=ctaDepG(g),cAct=ctaActG(g);
    let dep=0;for(const a of A)if(a.src.col==="maquinaria"&&S_(a.src.id).split("|")[0]===m.id)for(const l of a.lineas)if(l.cta===cDep)dep+=l.c-l.d;
    const costo=r0(valorDe(m)),venta=m.baja.motivo==="venta"?r0(m.baja.valor):0,dif=costo-r0(dep)-venta;
    add("BA",m.baja.f,(m.baja.motivo==="venta"?"Venta de activo · ":"Baja de activo · ")+m.nombre,m.baja.tercero||"",[{cta:cDep,d:r0(dep)},...(venta?[{cta:ctaDinero(m.baja.cuenta),aux:m.baja.cuenta||"",d:venta}]:[]),...(dif>0?[{cta:"5310",d:dif,det:"Pérdida en venta o retiro"}]:[]),{cta:cAct,c:costo},...(dif<0?[{cta:"4245",c:-dif,det:"Utilidad en venta"}]:[])],{col:"maquinaria",id:m.id+"|baja"})}
});
function vActivosConc(){const A=asientosTodos(),mes=hoy().slice(0,7);let costo=0,dep=0;const filas=[];
  for(const m of store.maquinaria){if(!m.contab||m.tipo==="Por comprar")continue;const x=depAct(m,mes);if(x.sit==="baja")continue;costo+=r0(x.costo);dep+=r0(x.dep);filas.push([m,x])}
  let c15=0,c1592=0;for(const a of A)for(const l of a.lineas){const c=S_(l.cta);if(c.startsWith("1592"))c1592+=l.c-l.d;else if(c.startsWith("15"))c15+=l.d-l.c}
  const ok1=Math.abs(costo-c15)<1000,ok2=Math.abs(dep-c1592)<1000;
  return `${cab("Activos fijos","Conciliación con la contabilidad","Compara el auxiliar de activos fijos (lo que dice cada ficha) con los saldos de las cuentas del balance. Si no cuadran, hay compras de activos sin ficha o fichas que no están en la contabilidad.")}
  <div class="kpis">${kpi("Costo según fichas",cop(costo),filas.length+" activos en la contabilidad")}${kpi("Saldo cuentas 15",cop(c15),ok1?"cuadra":"diferencia "+cop(c15-costo),ok1?"color:var(--ok)":"color:var(--warn)")}${kpi("Depreciación según fichas",cop(dep),"al cierre de "+mesLargo(mes))}${kpi("Saldo cuenta 1592",cop(c1592),ok2?"cuadra":"diferencia "+cop(c1592-dep),ok2?"color:var(--ok)":"color:var(--warn)")}</div>
  ${ok1&&ok2?`<div class="fp-alerta ok" style="margin-top:12px">El auxiliar de activos y la contabilidad cuadran.</div>`:`<div class="fp-alerta" style="margin-top:12px">Revisa: (1) compras de maquinaria o equipo registradas como egreso sin su ficha en Activos fijos; (2) activos con ficha marcados "Aún no está en la contabilidad"; (3) activos comprados con factura y además registrados como saldo inicial. Oswaldo puede ajustar la diferencia con una nota contable.</div>`}
  <div class="tbl-wrap" style="margin-top:12px"><table class="fp-tabla sin-busca"><thead><tr><th>Activo</th><th>Cómo entró</th><th class="r">Costo</th><th class="r">Depreciación</th><th class="r">En libros</th></tr></thead><tbody>${filas.map(([m,x])=>`<tr><td>${esc(m.nombre)}<div class="who">${esc(x.g.nombre)}</div></td><td class="who">${esc((CONTAB_ACT.find(c=>c[0]===m.contab)||[,""])[1])}</td><td class="r num">${cop(x.costo)}</td><td class="r num">${cop(x.dep)}</td><td class="r num">${cop(x.libros)}</td></tr>`).join("")||`<tr><td colspan="5" class="muted">No hay activos en la contabilidad.</td></tr>`}</tbody></table></div>`}

/* ======================= Grupos de centros de costo ======================= */
let ccG=null;
window.panelGruposCC=A=>{const G=CONT.ccGrupos||[],anio=S_(ctb.mes||hoy()).slice(0,4),R={};for(const a of A){if(S_(a.f).slice(0,4)!==anio)continue;for(const l of a.lineas){if(!l.cc)continue;const c=S_(l.cta)[0],x=(R[l.cc] ||= {i:0,c:0,g:0});if(c==="4")x.i+=l.c-l.d;else if(c==="6"||c==="7")x.c+=l.d-l.c;else if(c==="5")x.g+=l.d-l.c}}
  const sum=cods=>cods.reduce((s,k)=>{const x=R[k]||{i:0,c:0,g:0};return {i:s.i+x.i,c:s.c+x.c,g:s.g+x.g}},{i:0,c:0,g:0});
  return `<div class="panel" style="margin-top:14px"><div class="row" style="justify-content:space-between"><div><h2 style="margin:0">Grupos de centros de costo</h2><p class="muted" style="margin:4px 0 0;font-size:13px">Un grupo solo agrupa; los movimientos se imputan a cada centro. Año ${anio}.</p></div><button class="btn small" data-fccg="1">${G.length?"Editar grupos":"+ Crear grupo"}</button></div>
  ${G.length?`<div class="tbl-wrap" style="margin-top:10px"><table class="sin-busca"><thead><tr><th>Grupo</th><th>Centros</th><th class="r">Ingresos</th><th class="r">Costos</th><th class="r">Gastos</th><th class="r">Resultado</th></tr></thead><tbody>${G.map(g=>{const s=sum(g.cods||[]);return `<tr><td><b>${esc(g.nombre)}</b></td><td class="who">${(g.cods||[]).map(k=>esc(nomCC(k))).join(", ")||"—"}</td><td class="r num">${cop(s.i)}</td><td class="r num">${cop(s.c)}</td><td class="r num">${cop(s.g)}</td><td class="r num"><b>${cop(s.i-s.c-s.g)}</b></td></tr>`}).join("")}</tbody></table></div>`:""}
  ${finModal==="fpccg"&&ccG?modalCCG():""}</div>`};
const modalCCG=()=>`<div class="panel ingreso">${fmCab("Grupos de centros de costo","Marca qué centros pertenecen a cada grupo")}${ccG.map((g,i)=>`<div class="fp-cfg"><div class="row" style="gap:6px"><input data-fccgn="${i}" value="${esc(g.nombre)}" placeholder="Nombre del grupo" style="flex:1"><button class="fp-x" data-fccg-quitar="${i}">×</button></div><div class="row" style="gap:10px;flex-wrap:wrap;margin-top:8px">${centros().map(c=>`<label class="chk"><input type="checkbox" data-fccgc="${i}|${esc(c.cod)}" ${(g.cods||[]).includes(c.cod)?"checked":""}> ${esc(c.cod)} · ${esc(c.nombre)}</label>`).join("")}</div></div>`).join("")}
  <button class="btn small" data-fccg-mas="1">+ Agregar grupo</button><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fccg-guardar="1">Guardar</button></div></div>`;

/* ======================= Migrar datos (Siigo, World Office, Excel) ======================= */
const MIG_TIPOS={plan:["Plan de cuentas",[["cod","Código de la cuenta",["codigo","cuenta","cod","code"]],["nombre","Nombre de la cuenta",["nombre","descripcion","name"]]]],
  terceros:["Terceros (clientes y proveedores)",[["tipoDoc","Tipo de documento",["tipo de identificacion","tipo identificacion","tipo doc","tipo documento"]],["doc","Número de identificación",["identificacion","nit","documento","cedula","numero"]],["dv","Dígito de verificación",["dv","digito"]],["nombre","Nombre o razón social",["nombre","razon social","tercero"]],["dir","Dirección",["direccion"]],["ciudad","Ciudad",["ciudad","municipio"]],["email","Correo",["correo","email","e-mail"]],["tel","Teléfono",["telefono","celular","movil"]],["rol","Tipo (cliente o proveedor)",["tipo de tercero","clasificacion","relacion","tipo"]]]],
  saldos:["Saldos iniciales (balance)",[["cta","Código de la cuenta",["codigo","cuenta"]],["ter","Tercero (nombre o documento)",["tercero","identificacion","nit","nombre tercero"]],["d","Débito",["debito","debe","saldo debito"]],["c","Crédito",["credito","haber","saldo credito"]],["saldo","Saldo (si viene en una sola columna)",["saldo final","saldo"]]]],
  activos:["Activos fijos",[["nombre","Nombre del activo",["nombre","descripcion","activo"]],["grupo","Grupo",["grupo","clase","tipo"]],["costo","Costo",["costo","valor","costo historico"]],["fecha","Fecha de compra",["fecha","adquisicion","compra"]],["vida","Vida útil (años)",["vida","anos","años"]]]],
  productos:["Productos y servicios",[["cod","Código",["codigo","referencia","cod"]],["nombre","Nombre",["nombre","descripcion"]],["precio","Precio",["precio","valor","precio de venta"]],["tipo","Tipo (producto o servicio)",["tipo"]],["unidad","Unidad",["unidad","medida"]]]]};
let mig={origen:"siigo",tipo:"terceros",filas:null,cab:[],mapa:{},archivo:"",fecha:""};
function vMigrar(){const T=MIG_TIPOS[mig.tipo],cols=mig.cab;
  const prev=mig.filas?mig.filas.slice(0,8).map(f=>Object.fromEntries(T[1].map(([k])=>[k,mig.mapa[k]>=0?S_(f[mig.mapa[k]]):""]))):[];
  return `${cab("Configuración","Migrar datos","Trae la información desde otro programa contable. Exporta el reporte en Excel desde Siigo o World Office y súbelo aquí: el sistema reconoce las columnas y te deja revisar antes de importar.",`<button class="btn" data-fmig-exportar="1">Exportar copia de Finanzas</button>`)}
  <div class="fp-cfg"><h2>1. ¿De dónde viene?</h2><div class="row" style="gap:8px;flex-wrap:wrap">${[["siigo","Siigo"],["wo","World Office"],["otro","Otro (Excel o CSV)"]].map(([k,t])=>`<button class="btn ${mig.origen===k?"primary":""}" data-fmig-origen="${k}">${t}</button>`).join("")}</div>
    <p class="who" style="margin-top:8px">${mig.origen==="siigo"?"En Siigo: Reportes › (Catálogo de cuentas, Terceros, Balance de prueba por tercero, Activos fijos o Productos) › Exportar a Excel.":mig.origen==="wo"?"En World Office: Informes › (Plan de cuentas, Terceros, Balance de prueba, Activos o Inventarios) › Exportar a Excel.":"Cualquier Excel o CSV con una fila de títulos."}</p></div>
  <div class="fp-cfg"><h2>2. ¿Qué vas a traer?</h2><div class="row" style="gap:8px;flex-wrap:wrap">${Object.entries(MIG_TIPOS).map(([k,t])=>`<button class="btn ${mig.tipo===k?"primary":""}" data-fmig-tipo="${k}">${t[0]}</button>`).join("")}</div>
    <label class="btn" style="margin-top:12px;display:inline-flex" tabindex="0">Subir archivo (Excel o CSV)<input type="file" accept=".xlsx,.csv" data-fmig-file="1" hidden></label>${mig.archivo?` <span class="who">${esc(mig.archivo)} · ${mig.filas?.length||0} filas</span>`:""}</div>
  ${mig.filas?`<div class="fp-cfg"><h2>3. Revisa las columnas</h2><p>El sistema las reconoció solo. Corrige las que no correspondan.</p><div class="fp-grid">${T[1].map(([k,t])=>`<label class="f">${t}<select data-fmig-col="${k}"><option value="-1">— No viene —</option>${cols.map((c,i)=>`<option value="${i}" ${mig.mapa[k]===i?"selected":""}>${esc(c||"Columna "+(i+1))}</option>`).join("")}</select></label>`).join("")}
    ${mig.tipo==="saldos"?`<label class="f">Fecha de los saldos<input type="date" data-fmig-fecha="1" value="${esc(mig.fecha||CONT.inicio||hoy())}"></label>`:""}</div>
    <div class="tbl-wrap" style="margin-top:10px"><table class="sin-busca"><thead><tr>${T[1].map(([,t])=>`<th>${esc(t)}</th>`).join("")}</tr></thead><tbody>${prev.map(f=>`<tr>${T[1].map(([k])=>`<td>${esc(f[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" data-fmig-importar="1">Importar ${mig.filas.length} filas</button></div></div>`:""}`}
const normH=s=>normNom(s).replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
async function leerArchivo(file){const buf=await file.arrayBuffer();if(/\.csv$/i.test(file.name))return csvFilas(new TextDecoder().decode(buf));return leerXlsxFilas(buf)}
function detectar(F){let h=0;for(let i=0;i<Math.min(F.length,15);i++){const t=(F[i]||[]).filter(x=>S_(x).trim()&&isNaN(numCO(x))).length;if(t>=2){h=i;break}}
  const cabz=(F[h]||[]).map(x=>S_(x).trim()),M={};for(const [k,,claves] of MIG_TIPOS[mig.tipo][1]){let best=-1;for(const cl of claves){const i=cabz.findIndex((c,j)=>!Object.values(M).includes(j)&&normH(c)===cl);if(i>=0){best=i;break}}
    if(best<0)for(const cl of claves){const i=cabz.findIndex((c,j)=>!Object.values(M).includes(j)&&normH(c).includes(cl));if(i>=0){best=i;break}}M[k]=best}
  return {cab:cabz,mapa:M,filas:F.slice(h+1).filter(f=>f&&f.some(x=>S_(x).trim()))}}
async function importar(){const T=mig.tipo,G=k=>f=>mig.mapa[k]>=0?S_(f[mig.mapa[k]]).trim():"",n=v=>{const x=numCO(v);return isNaN(x)?0:x};let ok=0,omit=0;
  if(T==="plan"){const N={...(CONT.nombres||{})};for(const f of mig.filas){const c=G("cod")(f).replace(/\D/g,""),nm=G("nombre")(f);if(!c||!nm){omit++;continue}N[c]=nm;ok++}CONT.nombres=N;await guardarCont()}
  if(T==="terceros"){const ya=new Set(tercerosTodos().map(t=>normNom(t.nombre))),ya2=new Set(store.terceros.map(t=>S_(t.doc)));
    for(const f of mig.filas){const nm=G("nombre")(f),doc=G("doc")(f).replace(/[^\dA-Za-z]/g,"");if(!nm||ya.has(normNom(nm))&&(!doc||ya2.has(doc))){omit++;continue}const td=normNom(G("tipoDoc")(f)),rol=normNom(G("rol")(f));
      await guardarDoc("terceros",null,{nombre:nm,tipoDoc:/nit|31/.test(td)?"NIT":/extranj|22/.test(td)?"CE":/pasap|41/.test(td)?"PP":doc.length>=9&&/^[89]/.test(doc)?"NIT":"CC",doc,dv:G("dv")(f),dir:G("dir")(f),ciudad:G("ciudad")(f),email:G("email")(f),tel:G("tel")(f),tipos:rol.includes("prove")?["proveedor"]:rol.includes("emple")?["empleado"]:["cliente"],migrado:mig.origen});ya.add(normNom(nm));ok++}}
  if(T==="saldos"){const L=[];for(const f of mig.filas){const c=G("cta")(f).replace(/\D/g,"");if(!c||c.length<4){omit++;continue}let d=n(G("d")(f)),cr=n(G("c")(f));if(!d&&!cr&&mig.mapa.saldo>=0){const s=n(G("saldo")(f));if(["1","5","6","7"].includes(c[0])){if(s>=0)d=s;else cr=-s}else{if(s>=0)cr=s;else d=-s}}if(!d&&!cr){omit++;continue}L.push({cta:c,d:r0(d),c:r0(cr),ter:G("ter")(f),det:""});ok++}
    const dif=L.reduce((s,l)=>s+l.d-l.c,0);if(dif)L.push({cta:mapa("apertura"),d:dif<0?-dif:0,c:dif>0?dif:0,det:"Diferencia de la migración (revisar)"});
    if(L.length)await guardarDoc("asientos",null,{num:numNCnuevo(),f:mig.fecha||CONT.inicio||hoy(),clase:"Asiento de apertura",concepto:"Saldos iniciales migrados desde "+({siigo:"Siigo",wo:"World Office"}[mig.origen]||"Excel"),lineas:L,creado:new Date().toISOString(),por:myId||null});
    if(dif)toast("Los saldos no cuadraban por "+cop(Math.abs(dif))+": la diferencia quedó en la cuenta "+mapa("apertura")+" para revisar")}
  if(T==="activos"){const GR=gruposAct();for(const f of mig.filas){const nm=G("nombre")(f),costo=n(G("costo")(f));if(!nm||!(costo>0)){omit++;continue}const gq=normNom(G("grupo")(f)),g=GR.find(x=>gq&&normNom(x.nombre).includes(gq.split(" ")[0]))||GR[0],fe=fechaCO(G("fecha")(f))||"";
    await guardarDoc("maquinaria",null,{...clone(MAQ_NUEVA),nombre:nm,grupo:g.id,clase:g.id,tipo:"Máquina",fAdq:fe,anio:fe?+fe.slice(0,4):"",valor:costo,cantidad:1,vidaAnios:+G("vida")(f)||+g.vida||10,contab:"inicial",estado:"operativa",real:true,migrado:mig.origen});ok++}}
  if(T==="productos"){if(!cats().length){CONT.itemCats=CATS_BASE();await guardarCont()}const ya=new Set(store.items.map(x=>normNom(x.nombre)));
    for(const f of mig.filas){const nm=G("nombre")(f);if(!nm||ya.has(normNom(nm))){omit++;continue}const serv=/serv/i.test(G("tipo")(f));const u=normNom(G("unidad")(f));
      await guardarDoc("items",null,{cod:G("cod")(f)||nuevoCod(),nombre:nm,tipo:serv?"servicio":"producto",cat:serv?(cats().find(c=>c.tipo==="servicio")?.id||cats()[0].id):cats()[0].id,unidad:/m2|metro cuadrado|mtk/.test(u)?"MTK":/^m$|metro|mtr|ml/.test(u)?"MTR":/kg|kilo/.test(u)?"KGM":/hora/.test(u)?"HUR":"94",precio:r0(n(G("precio")(f))),imp:"",activo:true,migrado:mig.origen});ya.add(normNom(nm));ok++}}
  mig.filas=null;mig.archivo="";toast(`Importadas ${ok} filas${omit?` · ${omit} omitidas (vacías o repetidas)`:""}`);render()}

/* ======================= Descarga de documentos (ZIP) ======================= */
let dzMes=hoy().slice(0,7),dzOcup=false;
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=t[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}})();
function zip(files){const enc=new TextEncoder(),partes=[],dir=[];let off=0;
  for(const f of files){const nm=enc.encode(f.name),d=f.data,crc=CRC(d),h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nm.length,true);
    partes.push(new Uint8Array(h.buffer),nm,d);const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);dir.push(new Uint8Array(c.buffer),nm);off+=30+nm.length+d.length}
  const dl=dir.reduce((s,x)=>s+x.length,0),e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,dl,true);e.setUint32(16,off,true);
  return new Blob([...partes,...dir,new Uint8Array(e.buffer)],{type:"application/zip"})}
const dataUrlBytes=u=>{const b=atob(S_(u).split(",")[1]||"");const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a};
const limpioNom=s=>S_(s).replace(/[\\/:*?"<>|]+/g," ").replace(/\s+/g," ").trim().slice(0,60);
function vDescargas(){const C=store.compras.filter(c=>esReal(c)&&S_(c.fecha).startsWith(dzMes)),V=store.ventas.filter(v=>v.estado==="contabilizada"&&S_(v.f).startsWith(dzMes)),ms=[...new Set([hoy().slice(0,7),...store.compras.map(c=>S_(c.fecha).slice(0,7)),...store.ventas.map(v=>S_(v.f).slice(0,7))])].filter(Boolean).sort().reverse();
  return `${cab("Reportes","Descarga de documentos","Todos los documentos del mes en un solo archivo ZIP: fotos y archivos de las facturas de compra, y las cuentas de cobro o facturas de venta.",`<label class="f">Mes<select data-fdz-mes="1">${ms.map(m=>`<option value="${m}" ${m===dzMes?"selected":""}>${esc(mesLargo(m))}</option>`).join("")}</select></label>`)}
  <div class="kpis">${kpi("Facturas de compra",String(C.length),C.filter(c=>c.foto).length+" con foto o archivo")}${kpi("Documentos de venta",String(V.length),"cuentas de cobro y facturas")}</div>
  <div class="row" style="margin-top:12px"><button class="btn primary" data-fdz="1" ${dzOcup||!(C.length+V.length)?"disabled":""}>${dzOcup?"Armando el ZIP…":"Descargar ZIP de "+esc(mesLargo(dzMes))}</button></div>`}
async function descargarZip(){dzOcup=true;render();try{const F=[],enc=new TextEncoder();const idx=[["Tipo","Fecha","Tercero","Documento","Total","Archivo"]];
  for(const c of store.compras.filter(c=>esReal(c)&&S_(c.fecha).startsWith(dzMes))){let nombre="";if(c.foto){let d=store.archivos_img.find(x=>x.id===c.foto)?.data;if(!d&&modo==="compartido"){try{const s=await db.doc("archivos_img/"+c.foto).get();d=s.exists?s.data()?.data:null}catch{}}
      if(d){const ext=/^data:application\/pdf/.test(d)?"pdf":/^data:image\/png/.test(d)?"png":"jpg";nombre=`compras/${c.fecha} ${limpioNom(c.proveedor)} ${limpioNom(c.documento)}.${ext}`;F.push({name:nombre,data:dataUrlBytes(d)})}}
    idx.push(["Compra",c.fecha,c.proveedor,c.documento||"",r0(c.total),nombre])}
  for(const v of store.ventas.filter(v=>v.estado==="contabilizada"&&S_(v.f).startsWith(dzMes))){const nombre=`ventas/${v.f} ${limpioNom(v.num)} ${limpioNom(v.cliente)}.html`;F.push({name:nombre,data:enc.encode(FPRO.htmlVenta(v))});idx.push([v.tipoDoc==="FV"?"Factura de venta":"Cuenta de cobro",v.f,v.cliente,v.num,FPRO.calcVenta(v).total,nombre])}
  F.push({name:"indice.csv",data:enc.encode("﻿"+idx.map(r=>r.map(x=>`"${S_(x).replace(/"/g,'""')}"`).join(";")).join("\r\n"))});
  await descargar(`Documentos TEKALUM ${dzMes}.zip`,zip(F));toast(`ZIP listo: ${F.length-1} archivo(s)`)}catch(err){toast(err?.msg||errMsg(err))}finally{dzOcup=false;render()}}

/* ======================= Auditoría de numeración ======================= */
function vNumAudit(){const D=[...store.ventas.map(v=>({col:"ventas",num:v.num,estado:v.estado,f:v.f,ter:v.cliente,x:v,tipo:v.tipoDoc==="FV"?"Factura de venta":"Cuenta de cobro"})),...store.notasdoc.map(n=>({col:"notasdoc",num:n.num,estado:n.estado,f:n.f,ter:"",x:n,tipo:TIPOS_COMP[n.tipo]}))];
  const P={};for(const d of D){if(!d.num)continue;const m=S_(d.num).match(/^(.*?)(\d+)$/);if(!m)continue;(P[m[1]] ||= []).push(+m[2])}
  const huecos=Object.entries(P).map(([p,ns])=>{const s=[...new Set(ns)].sort((a,b)=>a-b),h=[];for(let i=1;i<s.length;i++)for(let k=s[i-1]+1;k<s[i]&&h.length<50;k++)h.push(k);return {p,n:s.length,de:s[0],a:s.at(-1),h}});
  const anul=D.filter(d=>d.estado==="anulada"),borr=D.filter(d=>d.estado==="borrador");
  return `${cab("Reportes","Numeración y documentos anulados","Los documentos numerados no se pueden borrar: solo se anulan, y el número queda registrado. Aquí se ve si hay saltos en la numeración, qué se anuló y quién lo hizo.",esAdminSis()?`<button class="btn" data-rep="usuarios">Ver lo borrado en la bitácora</button>`:"")}
  <div class="tbl-wrap"><table class="fp-tabla sin-busca"><thead><tr><th>Prefijo</th><th class="r">Documentos</th><th>Rango</th><th>Saltos en la numeración</th></tr></thead><tbody>${huecos.map(x=>`<tr><td class="num"><b>${esc(x.p||"(sin prefijo)")}</b></td><td class="r num">${x.n}</td><td class="num">${x.de} a ${x.a}</td><td>${x.h.length?`<span class="fp-mal">Faltan: ${x.h.join(", ")}</span>`:`<span class="fp-ok">Sin saltos</span>`}</td></tr>`).join("")||`<tr><td colspan="4" class="muted">Aún no hay documentos numerados.</td></tr>`}</tbody></table></div>
  <div class="grid2" style="margin-top:14px"><div class="fin-card"><div class="fin-card-h"><h3>Anulados (${anul.length})</h3></div>${anul.map(d=>`<div class="who" style="padding:6px 0;border-bottom:1px solid var(--line)"><b>${esc(d.num)}</b> · ${esc(d.tipo)} · ${fechaCorta(d.f)}${d.ter?" · "+esc(d.ter):""}<br>Anuló: ${esc(d.x.anuladaPor||"—")} ${d.x.anuladaF?"el "+fechaCorta(S_(d.x.anuladaF).slice(0,10)):""}</div>`).join("")||`<p class="who">Ninguno.</p>`}</div>
    <div class="fin-card"><div class="fin-card-h"><h3>Borradores sin número (${borr.length})</h3></div>${borr.map(d=>`<div class="who" style="padding:6px 0;border-bottom:1px solid var(--line)">${esc(d.tipo)} · ${fechaCorta(d.f)}${d.ter?" · "+esc(d.ter):""} · creado por ${esc(d.x._creadoNombre||"—")}</div>`).join("")||`<p class="who">Ninguno.</p>`}</div></div>`}

/* ======================= Preferencias ======================= */
let prefD=null;
function vCfgPref(){const d=prefD||(prefD={notaVenta:CONT.notaVenta||"",causaModo:CONT.causaModo||"lineas",msgCobro:CONT.msgCobro||""});
  return `${cab("Configuración","Preferencias","Textos y comportamientos por defecto de los documentos.",`<button class="btn primary" data-fpref-guardar="1">Guardar</button>`)}
  <div class="fp-cfg"><h2>Observaciones en las ventas</h2><p>Texto con el que empiezan las notas de cada cuenta de cobro o factura nueva (se puede cambiar en cada documento).</p><textarea data-fpref="notaVenta" rows="3" style="width:100%" maxlength="1000" placeholder="Ej. Garantía de 1 año en fabricación e instalación. Consignar en Bancolombia ahorros …">${esc(d.notaVenta)}</textarea></div>
  <div class="fp-cfg"><h2>Causación de facturas de compra</h2><p>Cómo se abre la causación de cada factura. En cada factura puedes cambiarlo.</p><select data-fpref="causaModo">${[["lineas","Línea por línea"],["iva","Agrupar por IVA (modo simplificado)"],["uno","Totalizar en un solo ítem"]].map(([k,t])=>`<option value="${k}" ${d.causaModo===k?"selected":""}>${t}</option>`).join("")}</select></div>`}

/* ======================= registro de vistas y modales ======================= */
const conModal=f=>()=>f()+(finModal==="fpcausar"&&cD?modalCausar():finModal==="fpreglas"&&rD?modalReglasProv():finModal==="fpcufe"&&cufeD?modalCufe():finModal==="fpenviar"&&envD?modalEnviar():finModal==="fpbaja"&&bajaD?modalBaja():(typeof modalesT2==="function"?modalesT2():""));
Object.assign(FINX,{itemsprecios:vListas,items:vItems,itemsventas:vItemsVentas,activosconc:vActivosConc,migrar:vMigrar,descargas:vDescargas,numaudit:vNumAudit,cfgpref:vCfgPref});
for(const k of Object.keys(FINX))if(!finVistas.includes(k))finVistas.push(k);
// las ventanas de esta parte se muestran sobre cualquier pantalla de Finanzas
for(const k of ["facturas","ventas","activos","ctb:centros"].filter(k=>FINX[k]))FINX[k]=conModal(FINX[k]);
if(!FINX.facturas)FINX.facturas=conModal(vFacturasCompra);if(!FINX.ingresos)FINX.ingresos=conModal(vIngresos);if(!FINX.activos)FINX.activos=conModal(vActivos);

/* ======================= acciones ======================= */
document.addEventListener("click",async e=>{const t=e.target.closest("[data-fpcausar],[data-fcz-modo],[data-fcz-reglas],[data-fcz-guardar],[data-fpreglas],[data-frg-mas],[data-frg-quitar],[data-frg-guardar],[data-fpcufe],[data-fcufe-abrir],[data-fit-nuevo],[data-fit-ed],[data-fit-guardar],[data-fit-cats],[data-fit-base],[data-fcat-mas],[data-fcat-quitar],[data-fcat-guardar],[data-fenv],[data-fenv-copiar],[data-fbaja],[data-fbj-guardar],[data-fccg],[data-fccg-mas],[data-fccg-quitar],[data-fccg-guardar],[data-fmig-origen],[data-fmig-tipo],[data-fmig-importar],[data-fmig-exportar],[data-fdz],[data-fpref-guardar]");if(!t)return;const d=t.dataset;
  try{
    if(d.fpcausar){abrirCausa(d.fpcausar);return}
    if(d.fczModo){cD.modo=d.fczModo;cD.dest={};render();return}
    if(d.fczReglas){const c=store.compras.find(x=>x.id===cD.id);const cdBak=cD;abrirReglas(claveProv(c.proveedor,c.nit),c.proveedor);rD.volver=cdBak;return}
    if(d.fczGuardar){await causarLineas();return}
    if(d.fpreglas){abrirReglas(d.fpreglas,d.nom);return}
    if(d.frgMas){rD.items.push({modo:"contiene",texto:"",dest:""});render();return}
    if(d.frgQuitar){rD.items.splice(+d.frgQuitar,1);render();return}
    if(d.frgGuardar){const [dest,cat]=S_(rD.destino).split(":"),old=(CONT.reglasProv||{})[rD.k]||{};CONT.reglasProv={...(CONT.reglasProv||{}),[rD.k]:{...old,nombre:rD.nombre,destino:dest||"",cat:cat||"",ivaR:Object.fromEntries(Object.entries(rD.ivaR).filter(([,v])=>v)),items:rD.items.filter(i=>S_(i.texto).trim()&&i.dest),asumir:!!rD.asumir,auto:false}};
      if(typeof facReg!=="undefined"&&facReg?.ed)facReg.ed[rD.k]=CONT.reglasProv[rD.k];const back=rD.volver;rD=null;await guardarCont("Reglas guardadas");if(back){cD={...back,dest:{},retOk:false};finModal="fpcausar"}else finModal=facReg?"facreg":null;render();return}
    if(d.fpcufe){cufeD={v:""};finModal="fpcufe";render();setTimeout(()=>$("#fp-cufe")?.focus(),40);return}
    if(d.fcufeAbrir){const v=S_(cufeD.v).trim();if(!/^[0-9a-f]{40,}$/i.test(v))throw {msg:"Revisa el CUFE: son letras y números (96 caracteres)"};window.open("https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey="+encodeURIComponent(v),"_blank","noopener");return}
    if(d.fitNuevo){const c=cats()[0];itD={tipo:c?.tipo||"producto",cat:c?.id||"",nombre:"",cod:nuevoCod(),unidad:"94",precio:"",imp:"",barras:"",desc:"",activo:true};finModal="fpitem";render();setTimeout(()=>$("#fp-itn")?.focus(),40);return}
    if(d.fitEd){const x=store.items.find(y=>y.id===d.fitEd);if(!x)return;itD=clone(x);finModal="fpitem";render();return}
    if(d.fitGuardar){const x=itD;if(!S_(x.nombre).trim())throw {msg:"Escribe el nombre"};if(!x.cat)throw {msg:"Elige la categoría"};if(store.items.some(y=>y.id!==x.id&&S_(y.cod)===S_(x.cod)))throw {msg:"Ya hay un ítem con ese código"};
      await guardarDoc("items",x.id||null,{...x,nombre:x.nombre.trim(),cod:S_(x.cod).trim()||nuevoCod(),precio:r0(x.precio),costo:r0(S_(x.costo).replace(/\D/g,""))});itD=null;finModal=null;toast("Ítem guardado");render();return}
    if(d.fitCats){catD=clone(cats());if(!catD.length)catD=CATS_BASE();finModal="fpcats";render();return}
    if(d.fitBase){CONT.itemCats=CATS_BASE();render();await guardarCont("Categorías base creadas");return}
    if(d.fcatMas){catD.push({id:"c"+uid4(),nombre:"",tipo:"producto",ctaIng:"4120",ctaInv:"",ctaCosto:""});render();return}
    if(d.fcatQuitar){catD.splice(+d.fcatQuitar,1);render();return}
    if(d.fcatGuardar){if(catD.some(c=>!S_(c.nombre).trim()||!/^4\d{3,}$/.test(S_(c.ctaIng))))throw {msg:"Cada categoría necesita nombre y una cuenta de ingreso (empieza por 4)"};CONT.itemCats=catD;catD=null;finModal=null;render();await guardarCont("Categorías guardadas");return}
    if(d.fenv){const v=store.ventas.find(x=>x.id===d.fenv);if(!v)return;const url=await enlaceVenta(v);envD={id:v.id,url};finModal="fpenviar";render();return}
    if(d.fenvCopiar){try{await navigator.clipboard.writeText(envD.url);toast("Enlace copiado")}catch{toast("Selecciona el enlace y cópialo")}return}
    if(d.fbaja){const m=store.maquinaria.find(x=>x.id===d.fbaja);if(!m)return;if(m.baja){if(mesCerrado(m.baja.f))throw {msg:"El mes de la baja está cerrado en Contabilidad"};if(!confirm(`¿Deshacer la baja de "${m.nombre}"?`))return;const {baja,...resto}=m;await guardarDoc("maquinaria",m.id,resto);toast("Baja deshecha");render();return}
      bajaD={id:m.id,f:hoy(),motivo:"venta",valor:"",cuenta:cuentasActivas()[0]?.id||"",tercero:"",nota:""};finModal="fpbaja";render();return}
    if(d.fbjGuardar){const m=store.maquinaria.find(x=>x.id===bajaD.id);if(mesCerrado(bajaD.f))throw {msg:"Ese mes está cerrado en Contabilidad"};if(bajaD.motivo==="venta"&&!(r0(bajaD.valor)>0))throw {msg:"Escribe el valor de venta"};
      await guardarDoc("maquinaria",m.id,{...m,baja:{f:bajaD.f,motivo:bajaD.motivo,valor:bajaD.motivo==="venta"?r0(bajaD.valor):0,cuenta:bajaD.motivo==="venta"?bajaD.cuenta:"",tercero:bajaD.tercero||"",nota:bajaD.nota||"",por:yo()}});bajaD=null;finModal=null;toast("Activo dado de baja");render();return}
    if(d.fccg!==undefined&&t.matches("[data-fccg]")){ccG=clone(CONT.ccGrupos||[]);if(!ccG.length)ccG=[{id:"g"+uid4(),nombre:"",cods:[]}];finModal="fpccg";render();return}
    if(d.fccgMas){ccG.push({id:"g"+uid4(),nombre:"",cods:[]});render();return}
    if(d.fccgQuitar){ccG.splice(+d.fccgQuitar,1);render();return}
    if(d.fccgGuardar){CONT.ccGrupos=ccG.filter(g=>S_(g.nombre).trim());ccG=null;finModal=null;render();await guardarCont("Grupos guardados");return}
    if(d.fmigOrigen){mig.origen=d.fmigOrigen;render();return}
    if(d.fmigTipo){mig={...mig,tipo:d.fmigTipo,filas:null,archivo:""};render();return}
    if(d.fmigImportar){if(!confirm(`¿Importar ${mig.filas.length} filas de ${MIG_TIPOS[mig.tipo][0].toLowerCase()}?`))return;await importar();return}
    if(d.fmigExportar){const data={exportado:new Date().toISOString(),config:clone(CONT)};for(const k of ["cuentas","ingresos","egresos","traslados","inversion","asientos","terceros","ventas","notasdoc","items","compras"])data[k]=clone(store[k]||[]);
      await descargar(`Copia Finanzas TEKALUM ${hoy()}.json`,new Blob([JSON.stringify(data,null,1)],{type:"application/json"}));return}
    if(d.fdz){await descargarZip();return}
    if(d.fprefGuardar){Object.assign(CONT,{notaVenta:prefD.notaVenta,causaModo:prefD.causaModo});prefD=null;render();await guardarCont("Preferencias guardadas");return}
  }catch(err){toast(err?.msg||errMsg(err))}
});
document.addEventListener("input",e=>{const el=e.target,d=el.dataset||{};
  if(cD&&d.fczr&&d.fczr!=="asumir"&&d.fczr!=="rfImp"){cD.ret[d.fczr]=el.value;return}
  if(cD&&d.fcz==="dias"){cD.dias=el.value;return}
  if(cD&&d.fczant){cD.anticipo=el.value;return}
  if(rD&&d.frgit){const [i,k]=d.frgit.split("|");if(k==="texto")rD.items[+i].texto=el.value;return}
  if(cufeD&&d.fcufe){cufeD.v=el.value;return}
  if(itD&&d.fit&&!["tipo","cat","unidad","imp","activo","matId"].includes(d.fit)){itD[d.fit]=el.value;return}
  if(catD&&d.fcat){const [i,k]=d.fcat.split("|");if(k!=="tipo")catD[+i][k]=el.value;return}
  if(d.fitf==="q"){itF.q=el.value;const p=el.selectionStart;render();const x=$("#fp-itq");if(x){x.focus();x.setSelectionRange(p,p)}return}
  if(bajaD&&d.fbj&&!["motivo","cuenta"].includes(d.fbj)){bajaD[d.fbj]=el.value;return}
  if(ccG&&d.fccgn!==undefined){ccG[+d.fccgn].nombre=el.value;return}
  if(prefD&&d.fpref){prefD[d.fpref]=el.value;return}
});
document.addEventListener("change",async e=>{const el=e.target,d=el.dataset||{};
  if(cD&&d.fczDest){cD.dest[d.fczDest]=el.value;cD.retOk=false;render();return}
  if(cD&&d.fcz){cD[d.fcz]=el.type==="checkbox"?el.checked:el.value;render();return}
  if(cD&&d.fczr){cD.ret[d.fczr]=el.type==="checkbox"?el.checked:el.value;if(d.fczr==="rfImp"){const {c,F}=filasCausa(),im=impDe(el.value);let b=0;for(const f of F)if(retDeDest(cD.dest[f.k])===el.value||!el.value)b+=f.total-f.iva;cD.ret.rf=im?String(r0(b*(+im.tarifa||0)/100)):"0"}render();return}
  if(rD&&d.frg){rD[d.frg]=el.type==="checkbox"?el.checked:el.value;return}
  if(rD&&d.frgiva){rD.ivaR[d.frgiva]=el.value;return}
  if(rD&&d.frgit){const [i,k]=d.frgit.split("|");rD.items[+i][k]=el.value;return}
  if(itD&&d.fit){itD[d.fit]=el.type==="checkbox"?el.checked:el.value;if(d.fit==="tipo"){itD.cat=cats().find(c=>c.tipo===el.value)?.id||itD.cat}if(["tipo","cat"].includes(d.fit))render();return}
  if(catD&&d.fcat){const [i,k]=d.fcat.split("|");catD[+i][k]=el.value;return}
  if(d.fitf&&d.fitf!=="q"){itF[d.fitf]=el.value;render();return}
  if(bajaD&&d.fbj){bajaD[d.fbj]=el.value;render();return}
  if(ccG&&d.fccgc){const [i,cod]=d.fccgc.split("|"),s=new Set(ccG[+i].cods||[]);el.checked?s.add(cod):s.delete(cod);ccG[+i].cods=[...s];return}
  if(prefD&&d.fpref){prefD[d.fpref]=el.value;return}
  if(d.fmigCol){mig.mapa[d.fmigCol]=+el.value;render();return}
  if(d.fmigFecha){mig.fecha=el.value;return}
  if(d.fdzMes){dzMes=el.value;render();return}
  if(d.fmigFile){const f=el.files?.[0];el.value="";if(!f)return;try{const F=await leerArchivo(f),r=detectar(F);Object.assign(mig,{filas:r.filas,cab:r.cab,mapa:r.mapa,archivo:f.name});render()}catch(err){toast("No se pudo leer el archivo: "+(err.message||err))}return}
});
document.addEventListener("click",e=>{if(e.target.closest("[data-fm-cerrar]")){cD=null;rD=null;cufeD=null;itD=null;catD=null;envD=null;bajaD=null;ccG=null}},true);
document.addEventListener("click",e=>{if(e.target.closest("[data-fin],[data-go]"))prefD=null},true);
/* ======================= Asistente de medios magnéticos (exógena) ======================= */
// conceptos del formato 1003 (retenciones que nos practicaron); el contador los confirma
const C1003={venta:"1302",servicio:"1303",honorarios:"1304",arriendo:"1307",financiero:"1306",otro:"1308",iva:"1309"};
const FORMATOS_EXO=[["1001","Pagos o abonos en cuenta y retenciones practicadas","Egresos y compras de cada proveedor, empleado o contratista"],["1003","Retenciones en la fuente que le practicaron","Retenciones que nos hicieron los clientes (cuentas 1355)"],["1005","Impuesto a las ventas descontable","IVA de las compras, por proveedor (240810)"],["1006","Impuesto a las ventas generado","IVA de las ventas, por cliente (240805)"],["1007","Ingresos recibidos","Cuentas de ingreso (clase 4), por cliente"],["1008","Saldos de cuentas por cobrar al 31 de diciembre","Cartera de clientes al cierre"],["1009","Saldos de cuentas por pagar al 31 de diciembre","Proveedores y acreedores al cierre"],["1012","Saldos en bancos y billeteras","Bancos, Nequi y Daviplata al 31 de diciembre"],["2276","Rentas de trabajo y pensiones","Sueldos, prestaciones y bonos por empleado"],["MUN","Exógena municipal / distrital","Ingresos y pagos por tercero con su municipio y ReteICA"]];
function exoExtra(anio){const ini=anio+"-01-01",fin=anio+"-12-31",f1003={},f1005={},f1006={},en=f=>S_(f)>=ini&&S_(f)<=fin;
  const put=(M,k,nombre,o)=>{const x=(M[k] ||= {nombre,...Object.fromEntries(Object.keys(o).map(c=>[c,0]))});for(const [c,v] of Object.entries(o))if(typeof v==="number")x[c]+=v;else x[c]=v};
  for(const v of store.ventas){if(v.estado!=="contabilizada"||!en(v.f))continue;const t=FPRO.calcVenta(v),serv=t.L.some(l=>S_(l.cta).startsWith("4170"));
    for(const r of t.rets){if(r.im.tipo==="rica")continue;const conc=r.im.tipo==="riva"?C1003.iva:serv?C1003.servicio:C1003.venta;put(f1003,conc+"|"+normNom(v.cliente),v.cliente,{conc,base:r.im.tipo==="riva"?t.iva:t.base,v:r.v})}
    if(t.iva)put(f1006,normNom(v.cliente),v.cliente,{gen:t.iva,rec:0,cons:0})}
  for(const i of store.ingresos){if(!en(i.f)||!(+i.rete)||!i.cliente)continue;const conc=i.tipo==="honorarios"?C1003.honorarios:i.tipo==="servicio"?C1003.servicio:i.tipo==="financiero"?C1003.financiero:C1003.venta;put(f1003,conc+"|"+normNom(i.cliente),i.cliente,{conc,base:(+i.valor||0)+(+i.rete||0)+(+i.reteica||0),v:+i.rete||0})}
  for(const e of store.egresos){if(!en(e.f)||!(+e.ivaDesc)||!e.tercero)continue;put(f1005,normNom(e.tercero),e.tercero,{desc:+e.ivaDesc,dev:0})}
  for(const n of store.notasdoc){if(n.estado!=="contabilizada"||!en(n.f))continue;const iva=FPRO.calcNota(n).iva;if(!iva)continue;
    if(n.tipo==="NCV"){const v=store.ventas.find(x=>x.id===n.ref);if(v)put(f1005,normNom(v.cliente),v.cliente,{desc:0,dev:iva})}
    if(n.tipo==="NCC"){const e=store.egresos.find(x=>x.id===n.ref);if(e)put(f1006,normNom(e.tercero),e.tercero,{gen:0,rec:iva,cons:0})}
    if(n.tipo==="NDC"){const e=store.egresos.find(x=>x.id===n.ref);if(e)put(f1005,normNom(e.tercero),e.tercero,{desc:iva,dev:0})}
    if(n.tipo==="NDV"){const v=store.ventas.find(x=>x.id===n.ref);if(v)put(f1006,normNom(v.cliente),v.cliente,{gen:iva,rec:0,cons:0})}}
  const conDatos=M=>Object.values(M).map(x=>({...x,...datosExo(x.nombre)}));
  return {f1003:conDatos(f1003),f1005:conDatos(f1005),f1006:conDatos(f1006)}}
window.hojasExoExtra=(anio,h,cabId,id,M)=>{const X=exoExtra(anio),dir=x=>[x.dir||"",x.dpto||"",x.mpio||"",x.pais||"169"];
  return [h("1003 Retenciones que nos practicaron",["Concepto",...cabId,"Dirección","Código dpto.","Código municipio","Valor acumulado del pago o abono sujeto a retención","Retención que le practicaron"],X.f1003.map(x=>[x.conc,...id(x),...dir(x).slice(0,3),M(x.base),M(x.v)]),[9,14,14,5,14,14,14,14,30,30,10,12,22,20]),
    h("1005 IVA descontable",[...cabId,"Impuesto descontable","IVA resultante por devoluciones en ventas anuladas, rescindidas o resueltas"],X.f1005.map(x=>[...id(x),M(x.desc),M(x.dev)]),[14,14,5,14,14,14,14,30,18,24]),
    h("1006 IVA generado",[...cabId,"Impuesto generado","IVA recuperado en devoluciones en compras anuladas, rescindidas o resueltas","Impuesto al consumo"],X.f1006.map(x=>[...id(x),M(x.gen),M(x.rec),M(x.cons)]),[14,14,5,14,14,14,14,30,18,24,16])]};
let exoA={formato:"",asist:false};
const anioExo=()=>{const anios=[...new Set([...store.egresos,...store.ingresos,...store.ventas].map(x=>S_(x.f).slice(0,4)).filter(Boolean).concat(String(new Date().getFullYear())))].sort().reverse();return ctb.anio&&anios.includes(ctb.anio)?ctb.anio:(anios.includes(String(new Date().getFullYear()-1))?String(new Date().getFullYear()-1):anios[0])};
const filasFormato=(k,R,X)=>({"1001":R.f1001,"1003":X.f1003,"1005":X.f1005,"1006":X.f1006,"1007":R.f1007,"1008":R.f1008,"1009":R.f1009,"1012":R.f1012,"2276":R.f2276,"MUN":[...(R.fMunI||[]),...(R.fMunP||[])]}[k]||[]);
window.exoAsistente=()=>{const anio=anioExo(),R=exogenaDe(anio),X=exoExtra(anio),V=validacionesExo(anio);
  const todos=[...R.f1001,...R.f1007,...R.f1008,...R.f1009,...R.f2276,...X.f1003,...X.f1005,...X.f1006].filter(x=>x.doc!=="222222222"&&x.nombre),inc=[...new Map(todos.filter(x=>x.falta||x.faltaDane).map(x=>[normNom(x.nombre),x])).values()];
  const vacios=FORMATOS_EXO.filter(([k])=>!filasFormato(k,R,X).length);const anios=[...new Set([anio,String(new Date().getFullYear()),String(new Date().getFullYear()-1),...store.egresos.map(e=>S_(e.f).slice(0,4))])].filter(Boolean).sort().reverse();
  return `<div class="fp-alerta info" style="margin-bottom:14px"><b>Importante.</b> Revisa las validaciones antes de presentar: formatos sin información, terceros incompletos o asientos sin tercero.</div>
  <div class="fp-cfg"><h2>Paso 1 · Configuración</h2><p>El sistema arma cada formato solo, con las cuentas y los conceptos de la contabilidad. Revisa cómo se arma cada uno o ajusta los conceptos y topes.</p>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" data-fexo="asist">Configuración asistida</button><button class="btn" data-fexo="avanzada">Configuración avanzada (por cuenta)</button><button class="btn ghost" data-fexo="resumen">${exoA.asist?"Ocultar resumen":"Ver resumen de formatos"}</button><button class="btn ghost" data-fexo="topes">Conceptos por categoría y topes</button></div>
    ${exoA.asist?`<div class="tbl-wrap" style="margin-top:10px"><table class="sin-busca"><thead><tr><th>Formato</th><th>De dónde sale</th><th class="r">Terceros</th><th>Estado</th></tr></thead><tbody>${FORMATOS_EXO.map(([k,t,d])=>{const n=filasFormato(k,R,X).length;return `<tr><td><b>${k}</b> ${esc(t)}</td><td class="who">${esc(d)}</td><td class="r num">${n}</td><td><span class="pill ${incluido(anio,k,n)?"st-aprobada":"st-borrador"}">${incluido(anio,k,n)?"Se presenta":n?"No se incluye":"Sin información en "+anio}</span></td></tr>`}).join("")}</tbody></table></div>
      <p class="who" style="margin-top:8px">Conceptos del 1003: ventas ${C1003.venta}, servicios ${C1003.servicio}, honorarios ${C1003.honorarios}, arrendamientos ${C1003.arriendo}, rendimientos ${C1003.financiero}, ReteIVA ${C1003.iva}. Topes: 1001 ${cop(exo().tope1001)}, 1008 ${cop(exo().tope1008)}, 1009 ${cop(exo().tope1009)}. Oswaldo los confirma.</p>`:""}</div>
  <div class="fp-cfg"><h2>Paso 2 · Generar y validar cada formato</h2><div class="row" style="gap:10px;align-items:flex-end;flex-wrap:wrap">
    <label class="f">Año de proceso<select data-fexo-anio="1">${anios.map(a=>`<option ${a===anio?"selected":""}>${a}</option>`).join("")}</select></label>
    <label class="f" style="min-width:300px;flex:1">Formato<select data-fexo-f="1"><option value="">Seleccionar formato</option>${FORMATOS_EXO.map(([k,t])=>`<option value="${k}" ${exoA.formato===k?"selected":""}>${k==="MUN"?"":k+" — "}${esc(t)}</option>`).join("")}</select></label>
    <button class="btn primary" data-fexo="generar" ${exoA.formato?"":"disabled"}>Generar formato</button><button class="btn" data-fexo="informe">Informe de cálculos realizados</button></div>
    ${exoA.formato?`<p class="who" style="margin-top:8px">${filasFormato(exoA.formato,R,X).length} registro(s) en ${anio}. El Excel trae las columnas del formato listas para pasarlas al prevalidador de la DIAN.</p>`:""}</div>
  <h3 style="margin:4px 0 8px">Validaciones</h3><div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
    <div class="fin-card"><div class="fin-card-h"><h3>Formatos sin información</h3><b style="color:var(--warn)">${vacios.length}</b></div>${vacios.map(([k,t])=>`<div class="who">${k==="MUN"?"":k+" "}${esc(t)}</div>`).join("")||`<p class="who">Todos tienen información.</p>`}<p class="who" style="margin-top:6px">Si un formato no tiene información en el año, normalmente no se presenta.</p></div>
    <div class="fin-card"><div class="fin-card-h"><h3>Asientos sin tercero</h3><b style="color:${V.sinTer.length?"var(--bad)":"var(--ok)"}">${V.sinTer.length}</b></div>${V.sinTer.slice(0,6).map(a=>`<div class="who">${esc(a.num)} · ${fechaCorta(a.f)} · ${esc(a.concepto)}</div>`).join("")||`<p class="who">Sin pendientes.</p>`}</div>
    <div class="fin-card"><div class="fin-card-h"><h3>Terceros incompletos</h3><b style="color:${inc.length?"var(--bad)":"var(--ok)"}">${inc.length}</b></div>${inc.slice(0,6).map(x=>`<button class="btn small ghost" data-ctb="ter-editar" data-k="${esc(x.nombre)}" style="display:block;margin:2px 0">${esc(x.nombre)} · ${x.falta?"falta documento":"falta municipio"}</button>`).join("")||`<p class="who">Sin pendientes.</p>`}</div></div>
  <h3 style="margin:18px 0 8px">Detalle de los formatos</h3>${typeof exoModales==="function"?exoModales():""}`};
document.addEventListener("click",async e=>{const b=e.target.closest("[data-fexo]");if(!b)return;const k=b.dataset.fexo,anio=anioExo();
  try{if(k==="resumen"){exoA.asist=!exoA.asist;render();return}
    if(k==="asist"){exP={i:0};finModal="fpexopaso";render();return}
    if(k==="avanzada"){exM={m:clone(exoMapa(anio)||{}),q:"",f:"mov",fmt:""};finModal="fpexomap";render();return}
    if(k==="topes"){const p=[...document.querySelectorAll("#main .panel")].find(x=>/concepto|tope/i.test(x.innerText));const z=p||document.querySelector("#main h3:last-of-type");if(z){z.scrollIntoView({behavior:"smooth",block:"start"});z.style.outline="3px solid var(--accent,#1d4ed8)";z.style.outlineOffset="4px";setTimeout(()=>{z.style.outline=""},2200)}return}
    if(k==="generar"){const f0=exoA.formato,R0=exogenaDe(anio),X0=exoExtra(anio);if(!incluido(anio,f0,filasFormato(f0,R0,X0).length)&&!confirm("Este formato está marcado como «no se presenta». ¿Generarlo igual?"))return;const H=hojasExogena(anio),f=exoA.formato,hs=H.filter(x=>f==="MUN"?/^Municipal/.test(x.nombre):x.nombre.startsWith(f));if(!hs.length)throw {msg:"No se encontró el formato"};
      await descargar(`Exógena ${f} ${anio} TEKALUM.xlsx`,new Blob([libroXlsx(hs)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));return}
    if(k==="informe"){const A=asientosTodos(),ini=anio+"-01-01",fin=anio+"-12-31",fmtDe=c=>{c=S_(c);return c.startsWith("1355")?"1003":c.startsWith("240810")?"1005":c.startsWith("240805")?"1006":c[0]==="4"?"1007":c.startsWith("13")?"1008":/^(22|23)/.test(c)?"1009":/^11(10|20)/.test(c)?"1012":/^(5|6|7)/.test(c)?"1001":""};
      const F=[["Fecha","Comprobante","Concepto","Cuenta","Nombre de la cuenta","Tercero","Débito","Crédito","Formato"]];const Mn=v=>({v:Math.round(+v||0),s:ESTILO.dinero});
      for(const a of A){if(a.f<ini||a.f>fin)continue;for(const l of a.lineas){const f=fmtDe(l.cta);if(!f)continue;F.push([a.f,a.num,a.concepto,l.cta,nomCta(l.cta),l.ter||a.tercero||"",Mn(l.d),Mn(l.c),f])}}
      await descargar(`Informe de cálculos exógena ${anio}.xlsx`,new Blob([libroXlsx([{nombre:"Cálculos",filas:F,anchos:[11,12,40,10,30,30,15,15,9],filtroHasta:F.length}])],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));return}
  }catch(err){toast(err?.msg||errMsg(err))}});
document.addEventListener("change",e=>{const d=e.target.dataset||{};if(d.fexoAnio){ctb.anio=e.target.value;render();return}if(d.fexoF!==undefined&&e.target.matches("[data-fexo-f]")){exoA.formato=e.target.value;render()}});

/* ======================= Tanda 1: logo, ciudades ReteICA, clases de comprobante, tipos de documento ======================= */
for(const x of [["RC","Registro civil"],["OT","Otro documento"]])if(!TIPOS_DOC.some(t=>t[0]===x[0]))TIPOS_DOC.push(x);
const syncClases=()=>{for(const c of CONT.clasesNC||[])if(!CLASES_NC.includes(c))CLASES_NC.push(c)};
window.extraEmpresa=()=>{const T=trib(),ica=new Set(T.ica||[T.mpio]);
  return `<div class="fp-cfg"><h2>Logo de la empresa</h2><p>Sale en las cuentas de cobro, las facturas, los certificados y el enlace que recibe el cliente. PNG o JPG.</p>
    <div class="row" style="gap:12px;align-items:center">${T.logo?`<img src="${T.logo}" alt="Logo" style="max-height:64px;max-width:200px;border:1px solid var(--line);border-radius:8px;padding:4px;background:#fff">`:`<span class="who">Sin logo</span>`}
    <label class="btn" tabindex="0">${T.logo?"Cambiar logo":"Subir logo"}<input type="file" accept="image/png,image/jpeg" data-flogo="1" hidden></label>${T.logo?`<button class="btn ghost" data-flogo-quitar="1">Quitar</button>`:""}</div></div>
  <div class="fp-cfg"><h2>Ciudades para ReteICA</h2><p>Municipios donde TEKALUM declara industria y comercio. En compras hechas en estas ciudades se sugiere la ReteICA (si es agente de retención).</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:4px;max-height:200px;overflow:auto">${Object.entries(DANE).map(([n,c])=>`<label class="chk"><input type="checkbox" data-fica="${c[1]}" ${ica.has(c[1])?"checked":""}> ${esc(n.replace(/\b\w/g,m=>m.toUpperCase()))}</label>`).join("")}</div></div>`};
window.extraNum=()=>{const L=CONT.clasesNC||[];return `<div class="fp-cfg"><h2>Tipos de comprobante contable propios</h2><p>Además de Nota de contabilidad, Ajuste, Reclasificación, Provisión, Depreciación manual, Cierre y Saldo inicial, puedes crear los tuyos. Aparecen al hacer un comprobante contable.</p>
  ${L.map((c,i)=>`<div class="row" style="gap:6px;margin-bottom:6px"><span class="pill st-enviada">${esc(c)}</span><button class="fp-x" data-fcls-quitar="${i}" aria-label="Quitar ${esc(c)}">×</button></div>`).join("")}
  <div class="row" style="gap:6px"><input id="fp-cls" placeholder="Ej. Nómina, Cierre de caja" style="max-width:280px" aria-label="Nuevo tipo de comprobante"><button class="btn small" data-fcls-mas="1">+ Agregar</button></div></div>`};
document.addEventListener("change",async e=>{const d=e.target.dataset||{};
  if(d.flogo){const f=e.target.files?.[0];e.target.value="";if(!f)return;try{const img=await cargarImagen(f),r=aJpeg(img,420,.88);if(r.url.length>400000)throw {msg:"La imagen es muy grande"};CONT.trib={...trib(),logo:r.url};render();await guardarCont("Logo guardado")}catch(err){toast(err?.msg||"No se pudo leer la imagen")}return}
  if(d.fica){const s=new Set(trib().ica||[trib().mpio]);e.target.checked?s.add(d.fica):s.delete(d.fica);CONT.trib={...trib(),ica:[...s]};await guardarCont();return}});
document.addEventListener("click",async e=>{const b=e.target.closest("[data-flogo-quitar],[data-fcls-mas],[data-fcls-quitar]");if(!b)return;const d=b.dataset;
  if(d.flogoQuitar){const {logo,...r}=trib();CONT.trib=r;render();await guardarCont("Logo quitado");return}
  if(d.fclsMas){const v=S_($("#fp-cls")?.value).trim();if(!v)return toast("Escribe el nombre");if([...CLASES_NC,...(CONT.clasesNC||[])].some(c=>normNom(c)===normNom(v)))return toast("Ya existe");CONT.clasesNC=[...(CONT.clasesNC||[]),v];syncClases();render();await guardarCont("Tipo de comprobante agregado");return}
  if(d.fclsQuitar){CONT.clasesNC=(CONT.clasesNC||[]).filter((_,i)=>i!==+d.fclsQuitar);render();await guardarCont("Tipo quitado");return}});

/* ======================= Tanda 2: anticipos a proveedores, recibo de varias facturas, pago a proveedor ======================= */
if(!CAT_EGRESO.some(c=>c[0]==="devAnticipo"))CAT_EGRESO.splice(CAT_EGRESO.length-1,0,["devAnticipo","Devolución de un anticipo a un cliente (obra cancelada)","variable","capital","2805","Anticipos de clientes (devolución)"]);
if(!CAT_EGRESO.some(c=>c[0]==="anticipoProv"))CAT_EGRESO.splice(CAT_EGRESO.length-1,0,["anticipoProv","Anticipo a un proveedor (se descuenta de su factura)","variable","capital","133005","Anticipos a proveedores"]);
TIPOS_COMP.CA="Cruce de anticipo a proveedor";Object.assign(PUC_BASE,{"1330":"Anticipos y avances","133005":"Anticipos a proveedores"});
function anticipoDisp(ter){const k=normNom(ter);if(!k)return 0;let s=0;for(const a of asientosTodos())for(const l of a.lineas)if(S_(l.cta).startsWith("1330")&&normNom(l.ter||a.tercero)===k)s+=l.d-l.c;return Math.max(0,r0(s))}
let rcm=null,rcmOk=null,pgm=null;
function docsCliente(n){const k=normNom(n);if(!k)return [];const D=[];
  for(const v of store.ventas){if(v.estado!=="contabilizada"||normNom(v.cliente)!==k)continue;const s=FPRO.saldoVenta(v);if(s>0)D.push({k:"v:"+v.id,num:v.num,f:v.f,venc:v.venc,saldo:s,tipo:v.tipoDoc==="FV"?"Factura":"Cuenta de cobro"})}
  for(const q of obrasVendidas()){if(normNom(q.cliente?.nombre)!==k||cotFacturada(q.id))continue;const r=carteraDe(q);if(r.saldo>0)D.push({k:"q:"+q.id,num:q.numero,f:S_(q.f_aprobada||q.creada||"").slice(0,10),venc:"",saldo:r0(r.saldo),tipo:"Obra"})}
  return D.sort((a,b)=>S_(a.f).localeCompare(S_(b.f)))}
function modalRcm(){const D=docsCliente(rcm.cliente),tot=D.reduce((s,d)=>s+r0(rcm.abonos[d.k]),0),C=[...new Set([...store.ventas.filter(v=>v.estado==="contabilizada").map(v=>v.cliente),...obrasVendidas().map(q=>q.cliente?.nombre)].filter(Boolean))];
  return `<div class="panel ingreso" style="width:min(860px,calc(100% - 24px))">${fmCab("Recibo de caja","Un solo recibo para abonar a varias facturas u obras del mismo cliente")}
  <datalist id="fp-rcm-cli">${C.map(n=>`<option value="${esc(n)}">`).join("")}</datalist>
  <div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))"><label class="f full">Cliente *<input id="fp-rcm-c" list="fp-rcm-cli" data-frc="cliente" value="${esc(rcm.cliente)}" placeholder="Escribe el nombre" autocomplete="off"></label>
    <label class="f">Fecha del recibo *<input type="date" data-frc="f" value="${esc(rcm.f)}"></label><label class="f">Dónde entra el dinero *<select data-frc="cuenta">${opcCuentas(rcm.cuenta)}</select></label><label class="f">Nota<input data-frc="nota" value="${esc(rcm.nota)}" placeholder="Ej. transferencia"></label></div>
  ${rcm.cliente?(D.length?`<div class="tbl-wrap" style="margin-top:10px"><table class="fp-lineas"><thead><tr><th>Documento</th><th>Fecha</th><th>Vence</th><th class="r">Saldo</th><th class="r" style="width:22%">Abono</th></tr></thead><tbody>${D.map(d=>`<tr><td><b>${esc(d.num)}</b><div class="who">${esc(d.tipo)}</div></td><td class="num">${fechaCorta(d.f)}</td><td class="num">${d.venc?fechaCorta(d.venc):"—"}</td><td class="r num">${cop(d.saldo)}</td><td><input class="num-in" id="fp-rcm-${esc(d.k.replace(":","-"))}" data-frca="${esc(d.k)}" value="${esc(rcm.abonos[d.k]??"")}" placeholder="0" inputmode="numeric" aria-label="Abono a ${esc(d.num)}"><button class="btn small ghost" data-frc-todo="${esc(d.k)}" style="margin-top:4px">Pagar todo</button></td></tr>`).join("")}
    <tr class="subt"><td colspan="4" class="r"><b>Total del recibo</b></td><td class="r num"><b>${cop(tot)}</b></td></tr></tbody></table></div>`:`<p class="who" style="margin-top:10px">Este cliente no tiene facturas ni obras con saldo pendiente.</p>`):""}
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-frc-guardar="1" ${tot>0?"":"disabled"}>Registrar recibo de caja</button></div></div>`}
const modalRcmOk=()=>`<div class="panel ingreso">${fmCab("Recibo de caja registrado",esc(rcmOk.cliente)+" · "+cop(rcmOk.tot))}<div class="tbl-wrap"><table class="sin-busca"><tbody>${rcmOk.L.map(x=>`<tr><td>${esc(x.num)}</td><td class="r num">${cop(x.v)}</td></tr>`).join("")}</tbody></table></div>
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-frc-imprimir="1">Imprimir recibo</button><button class="btn primary" data-fm-cerrar="1">Listo</button></div></div>`;
function gruposPorPagar(prov){const k=normNom(prov);return agruparTx(store.egresos.filter(e=>e.pagado===false&&normNom(e.tercero)===k)).map(g=>{const tot=g.reduce((s,y)=>s+(+y.valor||0),0),ret=g.reduce((s,y)=>s+(y.retAsumida?0:(+y.rf||0)+(+y.rica||0)+(+y.riva||0)),0),ant=g.reduce((s,y)=>s+(+y.anticipo||0),0);return {id:g[0].id,g,doc:g[0].nota||g[0].concepto,f:g[0].f,venc:g[0].venc||"",saldo:saldoCxpEg(g[0])}}).filter(x=>x.saldo>0)}
function modalPgm(){const provs=[...new Set(store.egresos.filter(e=>e.pagado===false&&e.tercero).map(e=>e.tercero))].sort(),G=pgm.prov?gruposPorPagar(pgm.prov):[],disp=pgm.prov?anticipoDisp(pgm.prov):0;
  const vPag=x=>pgm.val[x.id]!=null&&pgm.val[x.id]!==""?r0(pgm.val[x.id]):x.saldo-r0(pgm.ant[x.id]),tot=G.filter(x=>pgm.sel[x.id]).reduce((s,x)=>s+vPag(x),0),cruz=G.filter(x=>pgm.sel[x.id]).reduce((s,x)=>s+r0(pgm.ant[x.id]),0);
  return `<div class="panel ingreso" style="width:min(860px,calc(100% - 24px))">${fmCab("Pago a proveedor","Paga varias facturas del mismo proveedor de una vez y cruza sus anticipos")}
  <div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))"><label class="f full">Proveedor *<select data-fpg="prov" data-bsel="1"><option value="">Elige el proveedor…</option>${provs.map(p=>`<option ${pgm.prov===p?"selected":""}>${esc(p)}</option>`).join("")}</select></label>
    <label class="f">Fecha del pago *<input type="date" data-fpg="f" value="${esc(pgm.f)}"></label><label class="f">Sale de *<select data-fpg="cuenta">${opcCuentas(pgm.cuenta)}</select></label></div>
  ${pgm.prov?`${disp?`<div class="fp-alerta info" style="margin-top:10px">Este proveedor tiene <b>${cop(disp)}</b> en anticipos. Escribe cuánto cruzar en cada factura.</div>`:""}
    <div class="tbl-wrap" style="margin-top:10px"><table class="fp-lineas"><thead><tr><th style="width:5%"></th><th>Factura</th><th>Vence</th><th class="r">Saldo</th>${disp?`<th class="r" style="width:18%">Cruzar anticipo</th>`:""}<th class="r" style="width:18%">Valor a pagar</th></tr></thead><tbody>${G.map(x=>`<tr><td><input type="checkbox" data-fpgs="${esc(x.id)}" ${pgm.sel[x.id]?"checked":""} aria-label="Pagar ${esc(x.doc)}"></td><td><b>${esc(x.doc)}</b><div class="who">${fechaCorta(x.f)}</div></td><td class="num">${x.venc?fechaCorta(x.venc):"—"}</td><td class="r num">${cop(x.saldo)}</td>${disp?`<td><input class="num-in" id="fp-pga-${esc(x.id)}" data-fpga="${esc(x.id)}" value="${esc(pgm.ant[x.id]??"")}" placeholder="0" inputmode="numeric" aria-label="Anticipo a cruzar en ${esc(x.doc)}"></td>`:""}<td><input class="num-in" id="fp-pgv-${esc(x.id)}" data-fpgv="${esc(x.id)}" value="${esc(pgm.val[x.id]??"")}" placeholder="${esc(String(x.saldo-r0(pgm.ant[x.id])))}" inputmode="numeric" aria-label="Valor a pagar de ${esc(x.doc)}"></td></tr>`).join("")||`<tr><td colspan="5" class="who">No tiene facturas por pagar.</td></tr>`}</tbody></table></div>
    <div class="fp-tot" style="margin-top:10px">${cruz?`<div><span>Anticipos cruzados</span><b class="num">${cop(cruz)}</b></div>`:""}<div class="fp-gran"><span>Sale de la cuenta</span><span class="num">${cop(tot)}</span></div></div>`:""}
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fpg-guardar="1" ${G.some(x=>pgm.sel[x.id])?"":"disabled"}>Registrar pago</button></div></div>`}
window.modalesT2=()=>finModal==="fprcm"&&rcm?modalRcm():finModal==="fprcmok"&&rcmOk?modalRcmOk():finModal==="fpgm"&&pgm?modalPgm():"";
document.addEventListener("click",async e=>{const b=e.target.closest("[data-frcm],[data-frc-todo],[data-frc-guardar],[data-frc-imprimir],[data-fpgm],[data-fpg-guardar]");if(!b)return;const d=b.dataset;
  try{
    if(d.frcm){rcm={cliente:"",f:hoy(),cuenta:cuentasActivas()[0]?.id||"",nota:"",abonos:{}};finModal="fprcm";render();setTimeout(()=>$("#fp-rcm-c")?.focus(),40);return}
    if(d.frcTodo){const x=docsCliente(rcm.cliente).find(z=>z.k===d.frcTodo);if(x)rcm.abonos[x.k]=String(x.saldo);render();return}
    if(d.frcGuardar){const D=docsCliente(rcm.cliente),L=D.filter(x=>r0(rcm.abonos[x.k])>0);if(!L.length)throw {msg:"Escribe al menos un abono"};if(store.cuentas.length&&!rcm.cuenta)throw {msg:"Elige dónde entra el dinero"};if(mesCerrado(rcm.f))throw {msg:"Ese mes está cerrado en Contabilidad"};
      if(L.some(x=>r0(rcm.abonos[x.k])>x.saldo)&&!confirm("Hay abonos mayores que el saldo; el exceso queda a favor del cliente. ¿Seguir?"))return;
      const id="tx"+uid4()+uid4(),hechos=[];let primero="";await atomico(async()=>{for(const x of L){const val=r0(rcm.abonos[x.k]);let nid;if(x.k.startsWith("v:")){const v=store.ventas.find(y=>y.id===x.k.slice(2));nid=await guardarDoc("ingresos",null,{...FPRO.abonoDe(v,val,rcm.f,rcm.cuenta,rcm.nota),rcm:id,tx:L.length>1?id:""})}
        else{const q=quotes.find(y=>y.id===x.k.slice(2));nid=await guardarDoc("ingresos",null,{f:rcm.f,tipo:"saldo",cuenta:rcm.cuenta,valor:val,cotId:q.id,cliente:q.cliente?.nombre||rcm.cliente,concepto:"Abono "+q.numero,nota:rcm.nota,cobrado:true,causado:false,rete:0,reteica:0,puc:mapa("cxc"),rcm:id,tx:L.length>1?id:"",creado:new Date().toISOString(),por:myId||null})}if(!primero)primero=nid;hechos.push({num:x.num,v:val})}});
      rcmOk={id,primero,cliente:rcm.cliente,f:rcm.f,cuenta:rcm.cuenta,L:hechos,tot:hechos.reduce((s,x)=>s+x.v,0)};rcm=null;finModal="fprcmok";toast("Recibo de caja registrado");render();return}
    if(d.frcImprimir&&rcmOk?.primero){imprimirRecibo(rcmOk.primero);return}
    if(d.frcImprimir){const T=trib(),w=window.open("","_blank");if(!w)return toast("Permite las ventanas emergentes");w.document.write(`<!doctype html><meta charset="utf-8"><title>Recibo de caja</title><style>body{font:13px system-ui;max-width:640px;margin:30px auto}table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #ddd;padding:6px}.r{text-align:right}</style>${T.logo?`<img src="${T.logo}" style="max-height:56px">`:""}<h2>Recibo de caja</h2><p><b>${esc(T.razon||precios.empresa?.nombre||"TEKALUM")}</b>${T.doc?" · "+esc(T.doc):""}</p><p>Recibimos de <b>${esc(rcmOk.cliente)}</b> el ${fechaCorta(rcmOk.f)} en ${esc(nombreCuenta(rcmOk.cuenta))}:</p><table>${rcmOk.L.map(x=>`<tr><td>Abono a ${esc(x.num)}</td><td class="r">${cop(x.v)}</td></tr>`).join("")}<tr><td><b>Total</b></td><td class="r"><b>${cop(rcmOk.tot)}</b></td></tr></table><p style="margin-top:40px">Firma: ______________________</p><script>print()<\/script>`);w.document.close();return}
    if(d.fpgm){pgm={prov:"",f:hoy(),cuenta:cuentasActivas()[0]?.id||"",sel:{},ant:{},val:{}};finModal="fpgm";render();return}
    if(d.fpgGuardar){const G=gruposPorPagar(pgm.prov).filter(x=>pgm.sel[x.id]),disp=anticipoDisp(pgm.prov),cruz=G.reduce((s,x)=>s+r0(pgm.ant[x.id]),0);if(!G.length)throw {msg:"Marca las facturas a pagar"};if(cruz>disp)throw {msg:"No puedes cruzar más de "+cop(disp)+" de anticipos"};
      if(G.some(x=>r0(pgm.ant[x.id])>x.saldo))throw {msg:"El anticipo cruzado no puede ser mayor que el saldo de la factura"};if(store.cuentas.length&&!pgm.cuenta&&G.some(x=>x.saldo>r0(pgm.ant[x.id])))throw {msg:"Elige de qué cuenta sale el pago"};if(mesCerrado(pgm.f))throw {msg:"Ese mes está cerrado en Contabilidad"};
      const pid=G.length>1?"pg"+uid4()+uid4():"";await atomico(async()=>{for(const x of G){const a=r0(pgm.ant[x.id]),v=pgm.val[x.id]!=null&&pgm.val[x.id]!==""?r0(pgm.val[x.id]):x.saldo-a;if(v<0)throw {msg:"Revisa el valor a pagar de "+x.doc};
        if(a+v<x.saldo){const y0=x.g[0];await guardarDoc("egresos",y0.id,{...y0,...(a?{anticipo:(+y0.anticipo||0)+a,fAnticipo:pgm.f}:{}),abonos:[...(y0.abonos||[]),...(v?[{id:uid4(),f:pgm.f,valor:v,cuenta:pgm.cuenta,pagoId:pid,reg:new Date().toISOString()}]:[])]});continue}
        let i=0;for(const y of x.g){await guardarDoc("egresos",y.id,{...y,pagado:true,fPago:pgm.f,fPagoReg:new Date().toISOString(),cuenta:pgm.cuenta,pagoId:pid,...(i===0&&a?{anticipo:(+y.anticipo||0)+a,fAnticipo:pgm.f}:{})});i++}}});
      pgm=null;finModal=null;toast(`Pago registrado (${G.length} factura${G.length===1?"":"s"})`);render();return}
  }catch(err){toast(err?.msg||errMsg(err))}});
document.addEventListener("input",e=>{const d=e.target.dataset||{};if(rcm&&d.frc&&d.frc!=="cuenta"){rcm[d.frc]=e.target.value;if(d.frc==="cliente"&&docsCliente(e.target.value).length){rcm.abonos={};const id=e.target.id,p=e.target.selectionStart;render();const x=document.getElementById(id);if(x){x.focus();x.setSelectionRange(p,p)}}return}
  if(rcm&&d.frca){rcm.abonos[d.frca]=e.target.value;const id=e.target.id,p=e.target.selectionStart;render();const x=document.getElementById(id);if(x){x.focus();x.setSelectionRange(p,p)}return}
  if(pgm&&d.fpgv){pgm.val[d.fpgv]=e.target.value;const id=e.target.id,p=e.target.selectionStart;render();const x=document.getElementById(id);if(x){x.focus();x.setSelectionRange(p,p)}return}
  if(pgm&&d.fpga){pgm.ant[d.fpga]=e.target.value;const id=e.target.id,p=e.target.selectionStart;render();const x=document.getElementById(id);if(x){x.focus();x.setSelectionRange(p,p)}return}});
document.addEventListener("change",e=>{const d=e.target.dataset||{};if(rcm&&d.frc){rcm[d.frc]=e.target.value;if(d.frc==="cliente"){rcm.abonos={};render()}return}
  if(pgm&&d.fpg){pgm[d.fpg]=e.target.value;if(d.fpg==="prov"){pgm.sel={};pgm.ant={};render()}return}
  if(pgm&&d.fpgs){pgm.sel[d.fpgs]=e.target.checked;render();return}});
document.addEventListener("click",e=>{if(e.target.closest("[data-fm-cerrar]")){rcm=null;rcmOk=null;pgm=null}},true);

/* ======================= Recibo de caja impreso y otros ingresos de la misma transacción ======================= */
function imprimirRecibo(id){const i0=store.ingresos.find(x=>x.id===id);if(!i0)return;const G=i0.tx?store.ingresos.filter(x=>x.tx===i0.tx):[i0];
  const a=asientosTodos().find(a=>a.tipo==="RC"&&a.src.col==="ingresos"&&(a.src.id===id||(a.src.ids||[]).includes(id)||G.some(g=>g.id===a.src.id)));
  const T=trib(),tot=G.reduce((s,x)=>s+(+x.valor||0),0),ret=G.reduce((s,x)=>s+(+x.rete||0)+(+x.reteica||0),0),ters=[...new Set(G.map(x=>quotes.find(q=>q.id===x.cotId)?.cliente?.nombre||x.cliente).filter(Boolean))];
  const w=window.open("","_blank");if(!w)return toast("Permite las ventanas emergentes para ver el recibo");
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Recibo de caja ${esc(a?.num||"")}</title><style>body{font:13px system-ui,sans-serif;max-width:680px;margin:28px auto;padding:0 18px;color:#1f2326}.cab{display:flex;justify-content:space-between;gap:12px;border-bottom:2px solid #13233f;padding-bottom:10px}h1{font-size:18px;margin:0}.n{font-size:17px;font-weight:800;text-align:right}table{width:100%;border-collapse:collapse;margin-top:14px}td,th{border-bottom:1px solid #dde;padding:7px;text-align:left}.r{text-align:right}.g{font-weight:800}small{color:#667}</style>
  <div class="cab"><div>${T.logo?`<img src="${T.logo}" alt="" style="max-height:56px;max-width:180px;display:block;margin-bottom:6px">`:""}<h1>${esc(T.comercial||T.razon||precios.empresa?.nombre||"TEKALUM")}</h1><small>${esc([T.razon,T.doc?(T.tipoDoc==="NIT"?"NIT ":"C.C. ")+T.doc+(T.dv?"-"+T.dv:""):"",T.dir,T.ciudad,T.tel].filter(Boolean).join(" · "))}</small></div><div class="n">RECIBO DE CAJA<br>No. ${esc(a?.num||"")}</div></div>
  <p>Fecha: <b>${fechaCorta(i0.f)}</b> · Recibimos de: <b>${esc(ters.join(", ")||"—")}</b> · Entró a: <b>${esc(nombreCuenta(i0.cuenta))}</b></p>
  <table><thead><tr><th>Concepto</th><th>Documento</th><th class="r">Valor</th></tr></thead><tbody>${G.map(x=>{const q=quotes.find(y=>y.id===x.cotId),v=store.ventas.find(y=>y.id===x.ventaId);return `<tr><td>${esc(x.concepto||tipoIng(x.tipo)[1])}</td><td>${esc(v?.num||q?.numero||"")}</td><td class="r">${cop((+x.valor||0)+(+x.rete||0)+(+x.reteica||0))}</td></tr>`}).join("")}
  ${ret?`<tr><td colspan="2" class="r">Menos retenciones que nos practicaron</td><td class="r">− ${cop(ret)}</td></tr>`:""}<tr class="g"><td colspan="2" class="r">Total recibido</td><td class="r">${cop(tot)}</td></tr></tbody></table>
  ${i0.nota?`<p>Nota: ${esc(i0.nota)}</p>`:""}<p style="margin-top:46px">Recibió: ______________________ &nbsp;&nbsp; Entregó: ______________________</p><script>print()<\/script>`);w.document.close()}
window.imprimirRecibo=imprimirRecibo;
document.addEventListener("click",e=>{const b=e.target.closest("[data-frc-ver]");if(b)imprimirRecibo(b.dataset.frcVer)});
document.addEventListener("input",e=>{const d=e.target.dataset||{};if(d.ingx&&finIng?.extra?.[+d.j]&&!["tipo","cotId"].includes(d.ingx))finIng.extra[+d.j][d.ingx]=e.target.value});
document.addEventListener("change",e=>{const d=e.target.dataset||{};if(d.ingx&&finIng?.extra?.[+d.j]){finIng.extra[+d.j][d.ingx]=e.target.value;if(d.ingx==="tipo"&&!tipoIng(e.target.value)[5])finIng.extra[+d.j].cotId="";render()}});

/* ======================= Tanda 3: balance de prueba por niveles ======================= */
const numNCnuevo=()=>Math.max(0,...store.asientos.map(x=>+x.num||0))+1;
let bp={nivel:"4",modo:"detallado",per:"mes",q:""};
window.pruebaNiveles=A=>{const mes=ctb.mes||hoy().slice(0,7),desde=bp.per==="anio"?mes.slice(0,4)+"-01-01":mes+"-01",hasta=finMes(mes),S={};
  for(const a of A){if(a.f>hasta)continue;for(const l of a.lineas){const x=(S[l.cta] ||= {si:0,d:0,c:0});if(a.f<desde)x.si+=l.d-l.c;else{x.d+=l.d;x.c+=l.c}}}
  const G={};const acum=(k,x)=>{const y=(G[k] ||= {si:0,d:0,c:0});y.si+=x.si;y.d+=x.d;y.c+=x.c};
  for(const [c,x] of Object.entries(S)){if(!x.si&&!x.d&&!x.c)continue;for(const L of [1,2,4,6])if(c.length>L)acum(c.slice(0,L),x);acum(c,x)}
  const nv=bp.nivel==="todos"?99:+bp.nivel,q=normNom(bp.q),cods=Object.keys(G).filter(c=>c.length<=nv||(nv===99)).sort();
  const ver=q?new Set(cods.filter(c=>c.startsWith(q)||normNom(nomCta(c)).includes(q)).flatMap(c=>[1,2,4,6,c.length].map(L=>c.slice(0,L)))):null;
  const sf=(c,x)=>{const r=x.si+x.d-x.c;return natDeb(c)?r:-r},det=bp.modo==="detallado";
  let tD=0,tC=0,tSiD=0,tSiC=0;for(const c of Object.keys(G).filter(c=>c.length===1)){const x=G[c];tD+=x.d;tC+=x.c;if(x.si>0)tSiD+=x.si;else tSiC-=x.si}
  const filas=cods.filter(c=>!ver||ver.has(c)).map(c=>{const x=G[c],nivel=[1,2,4,6].indexOf(c.length);return `<tr class="${c.length<=2?"subt":""}"><td style="padding-left:${8+Math.max(0,nivel<0?4:nivel)*14}px"><span class="puc">${esc(c)}</span> ${c.length<=2?"<b>":""}${esc(nomCta(c))}${c.length<=2?"</b>":""}</td>${det?`<td class="r num">${cop(x.si)}</td><td class="r num">${cop(x.d)}</td><td class="r num">${cop(x.c)}</td>`:""}<td class="r num">${c.length<=2?"<b>":""}${cop(sf(c,x))}${c.length<=2?"</b>":""}</td></tr>`}).join("");
  const ok=Math.round(tD)===Math.round(tC)&&Math.round(tSiD)===Math.round(tSiC);
  return `<div class="fp-filtros"><label>Periodo<select data-fbp="per"><option value="mes" ${bp.per==="mes"?"selected":""}>${esc(mesLargo(mes))}</option><option value="anio" ${bp.per==="anio"?"selected":""}>Acumulado ${mes.slice(0,4)} (enero a ${esc(mesLargo(mes).split(" ")[0])})</option></select></label>
    <label>Nivel<select data-fbp="nivel">${[["1","Clase"],["2","Grupo"],["4","Cuenta"],["6","Subcuenta"],["todos","Auxiliar (todo)"]].map(([k,t])=>`<option value="${k}" ${bp.nivel===k?"selected":""}>${t}</option>`).join("")}</select></label>
    <div class="row" style="gap:4px;align-items:flex-end"><button class="chip" data-fbpm="simple" aria-pressed="${!det}">Simple</button><button class="chip" data-fbpm="detallado" aria-pressed="${det}">Detallado</button><button class="btn small" data-fbpn="todos">Expandir</button><button class="btn small" data-fbpn="1">Contraer</button></div>
    <label style="flex:1;min-width:180px">Buscar cuenta<input id="fp-bpq" data-fbp="q" value="${esc(bp.q)}" placeholder="Código o nombre"></label></div>
  <div class="${ok?"fp-alerta ok":"fp-alerta"}" style="margin-bottom:10px">${ok?"✓ Débitos y créditos cuadran.":"✗ Los débitos y los créditos no cuadran: revisa los comprobantes."} Movimientos: débitos ${cop(tD)} · créditos ${cop(tC)}.</div>
  <div class="tbl-wrap"><table class="fp-tabla sin-busca"><thead><tr><th>Cuenta</th>${det?`<th class="r">Saldo inicial</th><th class="r">Débitos</th><th class="r">Créditos</th>`:""}<th class="r">Saldo final</th></tr></thead><tbody>${filas||`<tr><td colspan="5" class="muted">Sin movimientos en el periodo.</td></tr>`}
    <tr class="subt"><td><b>Totales</b></td>${det?`<td class="r num"></td><td class="r num"><b>${cop(tD)}</b></td><td class="r num"><b>${cop(tC)}</b></td>`:""}<td></td></tr></tbody></table></div>`};
document.addEventListener("click",e=>{const b=e.target.closest("[data-fbpm],[data-fbpn]");if(!b)return;if(b.dataset.fbpm)bp.modo=b.dataset.fbpm;if(b.dataset.fbpn)bp.nivel=b.dataset.fbpn;render()});
document.addEventListener("input",e=>{if(e.target.dataset?.fbp==="q"){bp.q=e.target.value;const p=e.target.selectionStart;render();const x=$("#fp-bpq");if(x){x.focus();x.setSelectionRange(p,p)}}});
document.addEventListener("change",e=>{const k=e.target.dataset?.fbp;if(k&&k!=="q"){bp[k]=e.target.value;render()}});

/* ======================= Tanda 3: liquidación de ICA y autorretención ======================= */
let liq={desde:"",hasta:"",avisos:"15",bomberil:"0"};
window.liqImpuestos=()=>{const y=hoy().slice(0,4),desde=liq.desde||y+"-01-01",hasta=liq.hasta||hoy(),A=asientosTodos();let base=0;for(const a of A){if(a.f<desde||a.f>hasta)continue;for(const l of a.lineas)if(S_(l.cta).startsWith("41"))base+=l.c-l.d}
  const ica=impDe("ica"),au=impDe("autorret"),vIca=r0(base*(+ica?.tarifa||0)/1000),vAv=r0(vIca*(+liq.avisos||0)/100),vBo=r0(vIca*(+liq.bomberil||0)/100),totIca=vIca+vAv+vBo,vAu=au&&au.activo!==false?r0(base*(+au.tarifa||0)/100):0;
  const ya=k=>store.asientos.find(n=>n.liq===k+"|"+desde+"|"+hasta&&!n.anulado),T=trib();
  return `<div class="fp-filtros"><label>Desde<input type="date" data-fliq="desde" value="${esc(desde)}"></label><label>Hasta<input type="date" data-fliq="hasta" value="${esc(hasta)}"></label></div>
  <div class="kpis">${kpi("Ingresos operacionales del periodo",cop(base),"Cuentas 41, menos devoluciones")}${kpi("ICA a pagar",cop(totIca),ica?.tarifa?`Tarifa ${ica.tarifa} por mil`:"Falta la tarifa")}${kpi("Autorretención",cop(vAu),au?.activo!==false&&+au?.tarifa?au.tarifa+" %":"No aplica")}</div>
  <div class="grid2" style="margin-top:12px"><div class="fin-card"><div class="fin-card-h"><h3>Industria y comercio (${esc(T.ciudad||"Pasto")})</h3></div>
    ${+ica?.tarifa?"":`<div class="fp-alerta">Falta la tarifa de ICA (por mil) de tu actividad. Pídela a Oswaldo y ponla en <button class="btn small" data-fin="cfgimpuestos">Configuración › Impuestos</button></div>`}
    <div class="fields" style="margin:0;grid-template-columns:1fr 1fr"><label class="f">Avisos y tableros (% del ICA)<input data-fliq="avisos" value="${esc(liq.avisos)}" inputmode="decimal"></label><label class="f">Sobretasa bomberil (% del ICA)<input data-fliq="bomberil" value="${esc(liq.bomberil)}" inputmode="decimal"></label></div>
    <div class="fp-tot" style="margin-top:10px"><div><span>Base gravable</span><b class="num">${cop(base)}</b></div><div><span>Impuesto de industria y comercio</span><b class="num">${cop(vIca)}</b></div><div><span>Avisos y tableros</span><b class="num">${cop(vAv)}</b></div><div><span>Sobretasa bomberil</span><b class="num">${cop(vBo)}</b></div><div class="fp-gran"><span>Total ICA</span><span class="num">${cop(totIca)}</span></div></div>
    <div class="row" style="margin-top:10px;justify-content:flex-end">${ya("ica")?`<span class="pill st-aprobada">Ya se causó (NC-${String(ya("ica").num).padStart(4,"0")})</span>`:`<button class="btn primary" data-fliq-causar="ica" ${totIca>0?"":"disabled"}>Causar ICA del periodo</button>`}</div></div>
  <div class="fin-card"><div class="fin-card-h"><h3>Autorretención</h3></div>${T.autorret||(au?.activo!==false&&+au?.tarifa)?`<div class="fp-tot"><div><span>Base</span><b class="num">${cop(base)}</b></div><div class="fp-gran"><span>Autorretención (${esc(au?.tarifa||0)} %)</span><span class="num">${cop(vAu)}</span></div></div>
    <div class="row" style="margin-top:10px;justify-content:flex-end">${ya("autorret")?`<span class="pill st-aprobada">Ya se causó</span>`:`<button class="btn primary" data-fliq-causar="autorret" ${vAu>0?"":"disabled"}>Causar autorretención</button>`}</div>`:`<p class="who">TEKALUM no es autorretenedor. Si llega a serlo, actívalo en Configuración › Empresa y pon la tarifa en Impuestos.</p>`}</div></div>`};
document.addEventListener("input",e=>{const k=e.target.dataset?.fliq;if(k&&!["desde","hasta"].includes(k))liq[k]=e.target.value});
document.addEventListener("change",e=>{const k=e.target.dataset?.fliq;if(k){liq[k]=e.target.value;render()}});
document.addEventListener("click",async e=>{const b=e.target.closest("[data-fliq-causar]");if(!b)return;const k=b.dataset.fliqCausar,y=hoy().slice(0,4),desde=liq.desde||y+"-01-01",hasta=liq.hasta||hoy(),A=asientosTodos();let base=0;for(const a of A){if(a.f<desde||a.f>hasta)continue;for(const l of a.lineas)if(S_(l.cta).startsWith("41"))base+=l.c-l.d}
  try{if(mesCerrado(hasta))throw {msg:"El mes de la fecha final está cerrado en Contabilidad"};const T=trib(),num=numNCnuevo();
    if(k==="ica"){const im=impDe("ica"),v=r0(base*(+im.tarifa||0)/1000),tot=v+r0(v*(+liq.avisos||0)/100)+r0(v*(+liq.bomberil||0)/100),ter="Municipio de "+(T.ciudad||"Pasto");if(!confirm(`¿Causar ICA por ${cop(tot)} (${fechaCorta(desde)} a ${fechaCorta(hasta)})?`))return;
      await guardarDoc("asientos",null,{f:hasta,clase:"Provisión",ref:"ICA",concepto:`Liquidación ICA ${desde} a ${hasta}`,tercero:ter,lineas:[{cta:im.ctaC||"511505",d:tot,c:0,ter},{cta:im.ctaV||"2412",d:0,c:tot,ter}],num,liq:"ica|"+desde+"|"+hasta,creado:new Date().toISOString(),por:myId||null});toast("ICA causado");render();return}
    const im=impDe("autorret"),v=r0(base*(+im.tarifa||0)/100);if(!confirm(`¿Causar autorretención por ${cop(v)}?`))return;
    await guardarDoc("asientos",null,{f:hasta,clase:"Provisión",ref:"Autorretención",concepto:`Autorretención ${desde} a ${hasta}`,tercero:"DIAN",lineas:[{cta:im.ctaV||"135595",d:v,c:0,ter:"DIAN"},{cta:im.ctaC||"236575",d:0,c:v,ter:"DIAN"}],num,liq:"autorret|"+desde+"|"+hasta,creado:new Date().toISOString(),por:myId||null});toast("Autorretención causada");render()}catch(err){toast(err?.msg||errMsg(err))}});

/* ======================= Tanda 3: exógena configurada por cuenta y paso a paso ======================= */
window.exoMapa=anio=>CONT.exoCtas?.[anio]||null;
const FMT_DE_CTA=c=>{c=S_(c);return c.startsWith("1355")?"1003":c.startsWith("240810")?"1005":c.startsWith("240805")?"1006":c[0]==="4"?"1007":c.startsWith("13")?"1008":/^(22|23)/.test(c)?"1009":/^11(10|20)/.test(c)?"1012":/^(5|6|7)/.test(c)?"1001":""};
const CONC_SUG=c=>{c=S_(c);if(c[0]==="4")return c.startsWith("4210")?"4003":c.startsWith("41")?"4001":"4002";const cat=CAT_EGRESO.find(x=>mapa("eg."+x[0])===c);return cat?(exo().c1001?.[cat[0]]||C1001_DEF[cat[0]]||"5016"):/^(5|6|7)/.test(c)?"5016":""};
let exM=null,exP=null;
function ctasExo(anio){const ini=anio+"-01-01",fin=anio+"-12-31",M={};for(const a of asientosTodos()){if(a.f<ini||a.f>fin)continue;for(const l of a.lineas){if(!/^(1|2|4|5|6|7)/.test(S_(l.cta)))continue;const x=(M[l.cta] ||= {d:0,c:0});x.d+=l.d;x.c+=l.c}}return M}
function modalExoMapa(){const anio=anioExo(),M=ctasExo(anio),C=[...new Set([...Object.keys(M),...Object.keys(exM.m)])].filter(c=>c.length>=4).sort(),q=normNom(exM.q);
  const L=C.filter(c=>(!q||c.startsWith(q)||normNom(nomCta(c)).includes(q))&&(exM.f==="todas"||(exM.f==="map"?exM.m[c]?.fmt:exM.f==="sin"?!exM.m[c]?.fmt:!!M[c]))&&(!exM.fmt||(exM.m[c]?.fmt||FMT_DE_CTA(c))===exM.fmt));
  const FM=[["","Automático"],["no","No se reporta"],...FORMATOS_EXO.filter(f=>f[0]!=="MUN").map(f=>[f[0],f[0]+" · "+f[1].slice(0,28)])];
  return `<div class="panel ingreso" style="width:min(1020px,calc(100% - 24px))">${fmCab("Configuración de formatos · "+anio,"Qué cuenta contable va a qué formato y con qué concepto. «Automático» usa las reglas del sistema.")}
  <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px"><button class="btn small" data-fexm="sugerir">Sugerir mapeo</button><button class="btn small" data-fexm="copiar">Copiar del año anterior</button>
    <input id="fp-exmq" data-fexmf="q" value="${esc(exM.q)}" placeholder="Cuenta o nombre" style="max-width:200px" aria-label="Buscar cuenta"><select data-fexmf="fmt" aria-label="Formato"><option value="">Todos los formatos</option>${FORMATOS_EXO.filter(f=>f[0]!=="MUN").map(f=>`<option ${exM.fmt===f[0]?"selected":""}>${f[0]}</option>`).join("")}</select>
    <select data-fexmf="f" aria-label="Estado">${[["todas","Todas"],["mov","Con movimiento"],["map","Configuradas"],["sin","Sin configurar"]].map(([k,t])=>`<option value="${k}" ${exM.f===k?"selected":""}>${t}</option>`).join("")}</select></div>
  <div class="tbl-wrap" style="max-height:52vh;overflow:auto"><table class="fp-lineas"><thead><tr><th>Cuenta contable</th><th class="r">Débitos</th><th class="r">Créditos</th><th style="width:22%">Formato</th><th style="width:14%">Concepto</th></tr></thead><tbody>
  ${L.map(c=>{const m=exM.m[c]||{},auto=FMT_DE_CTA(c);return `<tr><td class="fp-ancho"><span class="puc">${esc(c)}</span> ${esc(nomCta(c))}</td><td class="r num">${cop(M[c]?.d||0)}</td><td class="r num">${cop(M[c]?.c||0)}</td><td><select data-fexmc="${esc(c)}|fmt" aria-label="Formato de ${esc(c)}">${FM.map(([k,t])=>`<option value="${k}" ${(m.fmt||"")===k?"selected":""}>${k===""&&auto?"Automático ("+auto+")":t}</option>`).join("")}</select></td><td><input data-fexmc="${esc(c)}|conc" value="${esc(m.conc||"")}" placeholder="${esc(CONC_SUG(c))}" inputmode="numeric" aria-label="Concepto de ${esc(c)}"></td></tr>`}).join("")||`<tr><td colspan="5" class="who">Ninguna cuenta con esos filtros.</td></tr>`}</tbody></table></div>
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fexm="guardar">Guardar configuración</button></div></div>`}
function modalExoPaso(){const anio=anioExo(),R=exogenaDe(anio),X=exoExtra(anio),[k,t,d]=FORMATOS_EXO[exP.i],F=filasFormato(k,R,X),inc=incluido(anio,k,F.length),tot=F.reduce((s,x)=>s+(+x.v||0)+(+x.sal||0)+(+x.pres||0)+(+x.desc||0)+(+x.gen||0)+(+x.base||0),0);
  return `<div class="panel ingreso">${fmCab(`Formato ${exP.i+1} de ${FORMATOS_EXO.length}`,`${k==="MUN"?"":k+" · "}${esc(t)}`)}
  <p>${esc(d)}.</p><div class="kpis">${kpi("Terceros o registros",String(F.length),anio)}${kpi("Valor total",cop(tot),"suma de las columnas de valor")}${kpi("¿Se presenta?",inc?"Sí":"No",inc?"Incluido":"No se incluye este año",inc?"color:var(--ok)":"color:var(--muted)")}</div>
  ${F.length?"":`<div class="fp-alerta info" style="margin-top:10px">Sin información en ${anio}: normalmente no se presenta.</div>`}
  <div class="row" style="justify-content:space-between;margin-top:14px"><button class="btn" data-fexp="ant" ${exP.i?"":"disabled"}>Anterior</button><div class="row"><button class="btn ${inc?"ghost":"primary"}" data-fexp="incluir">${inc?"No incluir":"Incluir"}</button>${exP.i<FORMATOS_EXO.length-1?`<button class="btn primary" data-fexp="sig">Siguiente</button>`:`<button class="btn primary" data-fm-cerrar="1">Terminar</button>`}</div></div></div>`}
const incluido=(anio,k,n)=>{const v=CONT.exoIncluir?.[anio]?.[k];return v===undefined?n>0:!!v};
window.exoModales=()=>finModal==="fpexomap"&&exM?modalExoMapa():finModal==="fpexopaso"&&exP?modalExoPaso():"";
document.addEventListener("click",async e=>{const b=e.target.closest("[data-fexm],[data-fexp]");if(!b)return;const anio=anioExo();
  try{const k=b.dataset.fexm;
    if(k==="sugerir"){for(const c of Object.keys(ctasExo(anio)).filter(c=>c.length>=4)){const f=FMT_DE_CTA(c);if(!f||exM.m[c]?.fmt)continue;exM.m[c]={fmt:f,conc:CONC_SUG(c)}}render();toast("Mapeo sugerido: revísalo y guarda");return}
    if(k==="copiar"){const prev=CONT.exoCtas?.[String(+anio-1)];if(!prev)throw {msg:"No hay configuración de "+(+anio-1)};exM.m={...clone(prev),...exM.m};render();toast("Copiado de "+(+anio-1));return}
    if(k==="guardar"){const m=Object.fromEntries(Object.entries(exM.m).filter(([,v])=>v.fmt||S_(v.conc).trim()));CONT.exoCtas={...(CONT.exoCtas||{}),[anio]:m};exM=null;finModal=null;render();await guardarCont("Configuración de formatos guardada");return}
    const p=b.dataset.fexp;if(p==="ant"){exP.i--;render();return}if(p==="sig"){exP.i++;render();return}
    if(p==="incluir"){const [fk]=FORMATOS_EXO[exP.i],R=exogenaDe(anio),X=exoExtra(anio),n=filasFormato(fk,R,X).length;CONT.exoIncluir={...(CONT.exoIncluir||{}),[anio]:{...(CONT.exoIncluir?.[anio]||{}),[fk]:!incluido(anio,fk,n)}};render();await guardarCont();return}
  }catch(err){toast(err?.msg||errMsg(err))}});
document.addEventListener("change",e=>{const d=e.target.dataset||{};if(exM&&d.fexmc){const [c,k]=d.fexmc.split("|");exM.m[c]={...(exM.m[c]||{}),[k]:e.target.value};if(k==="fmt")render();return}if(exM&&d.fexmf&&d.fexmf!=="q"){exM[d.fexmf]=e.target.value;render()}});
document.addEventListener("input",e=>{const d=e.target.dataset||{};if(exM&&d.fexmc?.endsWith("|conc")){const c=d.fexmc.split("|")[0];exM.m[c]={...(exM.m[c]||{}),conc:e.target.value};return}if(exM&&d.fexmf==="q"){exM.q=e.target.value;const p=e.target.selectionStart;render();const x=$("#fp-exmq");if(x){x.focus();x.setSelectionRange(p,p)}}});
document.addEventListener("click",e=>{if(e.target.closest("[data-fm-cerrar]")){exM=null;exP=null}},true);

/* ======================= Auditoría contable: provisiones, traslado de costos y cierre anual ======================= */
Object.assign(TIPOS_COMP,{PN:"Provisión de prestaciones sociales",TC:"Traslado de costos de producción al costo de ventas",CR:"Cierre anual de resultados"});
Object.assign(PUC_BASE,{"2610":"Pasivos estimados para obligaciones laborales","261005":"Cesantías consolidadas (provisión)","261010":"Intereses sobre cesantías (provisión)","261015":"Vacaciones consolidadas (provisión)","261020":"Prima de servicios (provisión)","6120":"Costo de ventas · industria manufacturera","3605":"Utilidad del ejercicio","3610":"Pérdida del ejercicio"});
// porcentajes de ley sobre el salario (Oswaldo los confirma)
const PROV={ces:[8.33,"261005","Cesantías"],int:[1,"261010","Intereses sobre cesantías"],vac:[4.17,"261015","Vacaciones"],pri:[8.33,"261020","Prima de servicios"]};
// 1. provisión mensual de prestaciones sobre los sueldos pagados en el mes
ASIENTO_HOOKS.push(add=>{if(!CONT.provNom)return;const ini=inicioCont().slice(0,7),hoyM=hoy().slice(0,7);
  for(let m=ini;m<hoyM;m=sumaMes(m,1)){if(typeof window.mesConNomina==="function"&&window.mesConNomina(m))continue;const base=k=>store.egresos.filter(e=>S_(e.f).startsWith(m)&&e.cat===k&&esReal(e)).reduce((s,e)=>s+(+e.valor||0),0),bt=base("obrero"),ba=base("nominaAdmin");if(!bt&&!ba)continue;
    const L=[];for(const [b,cta,cc] of [[bt,"720530","PROD"],[ba,"510530","ADM"]]){if(!b)continue;for(const [,x] of Object.entries(PROV)){const v=r0(b*x[0]/100);if(v){L.push({cta,d:v,cc,det:x[2]});L.push({cta:x[1],c:v,det:x[2]})}}}
    add("PN",finMes(m),"Provisión de prestaciones · "+mesLargo(m),"",L,{col:"provision",id:m})}});
// 2. al cerrar un mes, los costos de producción (clase 7) pasan al costo de ventas (6120)
ASIENTO_HOOKS.push((add,A)=>{for(const m of Object.keys(CONT.cierres||{}).filter(m=>CONT.cierres[m]).sort()){const S={};for(const a of A){if(a.tipo==="TC"||!S_(a.f).startsWith(m))continue;for(const l of a.lineas)if(S_(l.cta)[0]==="7"){const k=l.cta+"|"+(l.cc||"");S[k]=(S[k]||0)+l.d-l.c}}
  const L=[];for(const [k,v] of Object.entries(S)){const [cta,cc]=k.split("|");if(!r0(v))continue;L.push({cta:"6120",d:v>0?r0(v):0,c:v<0?-r0(v):0,cc});L.push({cta,c:v>0?r0(v):0,d:v<0?-r0(v):0,cc})}
  if(L.length)add("TC",finMes(m),"Costos de producción de "+mesLargo(m)+" al costo de ventas","",L,{col:"traslado-costos",id:m})}});
// 3. cierre anual: los resultados (clases 4 a 7) pasan a utilidad o pérdida del ejercicio
ASIENTO_HOOKS.push((add,A)=>{for(const y of Object.keys(CONT.cierresAnio||{}).filter(y=>CONT.cierresAnio[y])){const S={};for(const a of A){if(a.tipo==="CR"||a.f<y+"-01-01"||a.f>y+"-12-31")continue;for(const l of a.lineas)if(/^[4-7]/.test(S_(l.cta))){const k=l.cta+"|"+(l.cc||"");S[k]=(S[k]||0)+l.d-l.c}}
  const L=[];let res=0;for(const [k,v] of Object.entries(S)){const [cta,cc]=k.split("|"),x=r0(v);if(!x)continue;res-=x;L.push({cta,cc,d:x<0?-x:0,c:x>0?x:0})}
  if(res>0)L.push({cta:"3605",c:res,det:"Utilidad del ejercicio "+y});else if(res<0)L.push({cta:"3610",d:-res,det:"Pérdida del ejercicio "+y});
  if(L.length)add("CR",y+"-12-31","Cierre anual de resultados "+y,"",L,{col:"cierre-anual",id:y})}});
window.panelCierreAnual=()=>{const A=asientosTodos(true),anios=[...new Set(A.map(a=>a.f.slice(0,4)))].filter(y=>y&&y<=hoy().slice(0,4)).sort().reverse(),CR=A.filter(a=>a.tipo==="CR");
  return `<div class="panel" style="margin-top:14px"><h2 style="margin:0 0 4px">Cierre del año</h2><p class="muted" style="margin:0 0 10px;font-size:13px">Al terminar el año, los ingresos, costos y gastos se cierran contra la utilidad (3605) o la pérdida (3610) del ejercicio. Los informes de resultados no cambian; el balance de prueba y los libros sí lo muestran. Se hace cuando diciembre esté revisado y cerrado.</p>
    ${anios.map(y=>{const c=CONT.cierresAnio?.[y],a=CR.find(x=>x.f.startsWith(y)),dicC=mesCerrado(y+"-12");return `<div class="row" style="justify-content:space-between;padding:8px 0;border-top:1px solid var(--line)"><span><b>${y}</b> ${c?`<span class="pill st-aprobada">Cerrado${a?" · "+esc(a.num):""}</span>`:`<span class="pill st-borrador">Abierto</span>`}</span>${c?`<button class="btn small ghost" data-fcanio="${y}" data-v="0">Reabrir</button>`:`<button class="btn small ${dicC?"primary":""}" data-fcanio="${y}" data-v="1" ${dicC?"":`title="Primero cierra diciembre de ${y}"`}>Hacer cierre de ${y}</button>`}</div>`}).join("")}</div>
  <div class="panel" style="margin-top:14px"><h2 style="margin:0 0 4px">Nómina: provisión de prestaciones</h2><p class="muted" style="margin:0 0 10px;font-size:13px">Cada mes se provisionan cesantías (8,33 %), intereses sobre cesantías (1 %), vacaciones (4,17 %) y prima (8,33 %) sobre los sueldos pagados en el mes. Así el gasto queda en el mes que corresponde y no todo cuando se paga. Al pagar prestaciones, el pago descuenta la provisión (cuenta 2610). Porcentajes de ley: Oswaldo los confirma.</p>
    <label class="chk"><input type="checkbox" data-fprov="1" ${CONT.provNom?"checked":""}> Provisionar las prestaciones cada mes</label></div>`};
document.addEventListener("click",async e=>{const b=e.target.closest("[data-fcanio]");if(!b)return;const y=b.dataset.fcanio,on=b.dataset.v==="1";
  if(on&&!mesCerrado(y+"-12")&&!confirm(`Diciembre de ${y} no está cerrado. ¿Hacer el cierre del año de todas formas?`))return;if(!confirm(on?`¿Hacer el cierre de ${y}? Los resultados pasan a la utilidad o pérdida del ejercicio.`:`¿Reabrir ${y}? Se quita el asiento de cierre.`))return;
  CONT.cierresAnio={...(CONT.cierresAnio||{}),[y]:on?{f:hoy(),por:yo()}:null};render();await guardarCont(on?"Año cerrado":"Año reabierto")});
document.addEventListener("change",async e=>{if(!e.target.dataset?.fprov)return;const on=e.target.checked;if(!confirm(on?"¿Provisionar las prestaciones cada mes? Los pagos de prestaciones descontarán la provisión (2610).":"¿Dejar de provisionar? Los pagos de prestaciones volverán a ir directo al gasto."))return render();
  const M={...(CONT.mapa||{})};if(on){M["eg.prestaciones"]="2610";M["eg.prestacionesAdmin"]="2610"}else{delete M["eg.prestaciones"];delete M["eg.prestacionesAdmin"]}CONT.mapa=M;CONT.provNom=on;render();await guardarCont(on?"Provisiones activadas":"Provisiones desactivadas")});
// aviso: aportes de equipos sin su ficha en Activos fijos
{const _ax=window.auditoriaExtra;window.auditoriaExtra=()=>{const R=_ax?_ax():[];const ap=store.inversion.filter(a=>a.tipoAporte==="especie"&&["equipos","otros"].includes(a.cat||"otros")).reduce((s,a)=>s+(+a.valor||0),0),fi=store.maquinaria.filter(m=>m.contab==="aporte").reduce((s,m)=>s+(+m.valor||0),0);
  if(ap>fi+1000)R.push(["media","Aportes de equipos sin ficha de activo",`Los socios aportaron ${cop(ap)} en equipos y en Activos fijos hay ${cop(fi)} marcados como aporte. Crea la ficha de cada equipo (Cómo entró: «Lo aportó un socio») para que se deprecie.`,"activos"]);return R}}
// los saldos de las cuentas de dinero se recalculan cuando cambia algo
{const _g=guardarDoc;guardarDoc=async function(...a){window.__saldos=null;try{return await _g.apply(this,a)}finally{window.__saldos=null}};const _b=borrarDoc;borrarDoc=async function(...a){window.__saldos=null;try{return await _b.apply(this,a)}finally{window.__saldos=null}}}

/* ======================= Conciliación bancaria: revisar, confirmar en lote, registrar en lote, documento y cierre ======================= */
const concSel={};let concCtx=null;
const candidatos=(x,lin)=>lin.filter(l=>Math.round(l.l.d-l.l.c)===Math.round(x.v)&&Math.abs(Date.parse(l.a.f)-Date.parse(x.f))/864e5<=4).length;
window.concExtra=C=>{concCtx=C;const {key,K,E,par,lin,ok,dif,sinPar}=C,S=(concSel[key] ||= {}),cerr=!!K.cerrada;
  const pares=Object.entries(par).filter(([,k])=>!ok[k]).map(([i,k])=>{const x=E[+i],l=lin.find(z=>z.k===k),amb=candidatos(x,lin)>1;if(S[i]===undefined)S[i]=!amb;return {i,k,x,l,amb}});
  const banco=sinPar.filter(({x})=>PISTAS_BANCO.some(([r])=>r.test(x.desc||"")));
  let h="";
  if(E.length&&pares.length&&!cerr)h+=`<div class="fp-cfg" style="margin-top:12px"><div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><div><h2>Revisa los emparejados</h2><p style="margin:0">Cada movimiento del extracto con el registro que el sistema le encontró. Desmarca los que no correspondan. Los marcados en amarillo tienen más de un registro posible: revísalos.</p></div><button class="btn primary" data-fconc="confirmar" ${pares.some(p=>S[p.i])?"":"disabled"}>Confirmar los marcados (${pares.filter(p=>S[p.i]).length})</button></div>
    <div class="tbl-wrap" style="margin-top:8px"><table class="fp-lineas"><thead><tr><th style="width:5%"></th><th>Extracto del banco</th><th>Registrado en el sistema</th><th class="r">Valor</th></tr></thead><tbody>${pares.map(p=>`<tr style="${p.amb?"background:#fff7e8":""}"><td><input type="checkbox" data-fconcp="${p.i}" ${S[p.i]?"checked":""} aria-label="Confirmar emparejado"></td><td>${fechaCorta(p.x.f)} · ${esc(p.x.desc||"")}${p.amb?`<div class="who" style="color:var(--warn)">Hay otro registro con el mismo valor: confirma que sea este</div>`:""}</td><td><b>${esc(p.l?.a.num||"")}</b> · ${fechaCorta(p.l?.a.f)} · ${esc(p.l?.a.concepto||"")}</td><td class="r num">${cop(p.x.v)}</td></tr>`).join("")}</tbody></table></div>
    <div class="row" style="gap:6px;margin-top:6px"><button class="btn small ghost" data-fconc="todos">Marcar todos</button><button class="btn small ghost" data-fconc="ninguno">Desmarcar todos</button></div></div>`;
  if(banco.length&&!cerr)h+=`<div class="fp-alerta info" style="margin-top:12px;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><span><b>${banco.length} cargo${banco.length>1?"s":""} o abono${banco.length>1?"s":""} del banco sin registrar</b> (4×1000, comisiones, cuota de manejo, intereses): ${cop(banco.reduce((s,o)=>s+Math.abs(o.x.v),0))}.</span><button class="btn primary small" data-fconc="lote">Registrarlos todos</button></div>`;
  h+=`<div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center">${cerr?`<span class="pill st-aprobada">Conciliación cerrada · ${esc(K.cerrada.por||"")} · ${fechaCorta(S_(K.cerrada.f).slice(0,10))}</span><button class="btn small ghost" data-fconc="reabrir">Reabrir</button>`:dif!=null&&Math.round(dif)===0?`<button class="btn primary small" data-fconc="cerrar">Cerrar la conciliación del mes</button>`:`<span class="who">Para cerrar la conciliación, la diferencia debe quedar en $ 0.</span>`}<button class="btn small" data-fconc="imprimir">Imprimir conciliación</button></div>`;
  return h};
document.addEventListener("change",e=>{const d=e.target.dataset||{};if(d.fconcp!==undefined&&concCtx){concSel[concCtx.key][d.fconcp]=e.target.checked;render()}});
document.addEventListener("click",e=>{const b=e.target.closest('[data-ctbc="concOk"]');if(b&&b.disabled){e.preventDefault();e.stopImmediatePropagation()}},true);
document.addEventListener("click",async e=>{const b=e.target.closest("[data-fconc]");if(!b||!concCtx)return;const a=b.dataset.fconc,{key,cid,K,E,par,lin,ok,libros,ext,dif,sinPar,fin}=concCtx,S=concSel[key]||{};
  try{const guardarK=async(nK,msg)=>{CONT.conc={...(CONT.conc||{}),[key]:nK};render();await guardarCont(msg)};
    if(a==="todos"||a==="ninguno"){for(const i of Object.keys(par))S[i]=a==="todos";render();return}
    if(a==="confirmar"){const sel={};for(const [i,k] of Object.entries(par))if(S[i]&&!ok[k])sel[k]=true;await guardarK({...K,ok:{...ok,...sel}},`${Object.keys(sel).length} movimientos conciliados`);return}
    if(a==="lote"){const L=sinPar.filter(({x})=>PISTAS_BANCO.some(([r])=>r.test(x.desc||"")));if(!confirm(`¿Registrar ${L.length} movimientos del banco?`))return;const banco=nombreCuenta(cid).split(" ")[0];
      for(const {x} of L){const pista=(PISTAS_BANCO.find(([r])=>r.test(x.desc))||[])[1];if(x.v>0)await guardarDoc("ingresos",null,{f:x.f,tipo:"financiero",cuenta:cid,valor:Math.round(x.v),cliente:banco,concepto:x.desc,cobrado:true,causado:false,rete:0,reteica:0,puc:mapa("ing.financiero"),creado:new Date().toISOString(),por:myId||null});
        else await guardarDoc("egresos",null,{f:x.f,cat:pista&&pista!=="financiero"?pista:"bancarios",tipo:"variable",concepto:x.desc,valor:Math.round(-x.v),tercero:banco,pagado:true,cuenta:cid,fPago:x.f,fPagoReg:new Date().toISOString(),creado:new Date().toISOString(),por:myId||null})}
      toast(`${L.length} movimientos del banco registrados`);render();return}
    if(a==="cerrar"){if(!confirm("¿Cerrar la conciliación? Ya no se podrán marcar ni desmarcar movimientos de este mes."))return;await guardarK({...K,cerrada:{f:new Date().toISOString(),por:yo()}},"Conciliación cerrada");return}
    if(a==="reabrir"){if(!confirm("¿Reabrir la conciliación de este mes?"))return;const {cerrada,...r}=K;await guardarK({...r,historial:[...(K.historial||[]),{cerrada,reabierta:new Date().toISOString(),por:yo()}]},"Conciliación reabierta");return}
    if(a==="imprimir"){const T=trib(),pend=lin.filter(x=>!ok[x.k]),entra=pend.filter(x=>x.l.d>0),sale=pend.filter(x=>x.l.c>0),noReg=sinPar||[],w=window.open("","_blank");if(!w)return toast("Permite las ventanas emergentes");
      const sm=L=>L.reduce((s,x)=>s+x,0),fila=(t,v,b)=>`<tr${b?' class="g"':""}><td>${t}</td><td class="r">${cop(v)}</td></tr>`;
      w.document.write(`<!doctype html><meta charset="utf-8"><title>Conciliación ${esc(nombreCuenta(cid))} ${esc(mesLargo(S_(fin).slice(0,7)))}</title><style>body{font:13px system-ui;max-width:720px;margin:28px auto;padding:0 18px}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border-bottom:1px solid #dde;padding:6px;text-align:left}.r{text-align:right}.g{font-weight:800}h3{margin:18px 0 4px}</style>
      ${T.logo?`<img src="${T.logo}" style="max-height:50px">`:""}<h2>Conciliación bancaria · ${esc(nombreCuenta(cid))}</h2><p>${esc(T.razon||precios.empresa?.nombre||"TEKALUM")} · corte ${fechaCorta(fin)}${K.cerrada?` · cerrada por ${esc(K.cerrada.por||"")}`:" · sin cerrar"}</p>
      <table>${fila("Saldo según extracto del banco",ext||0,true)}${fila("(+) Consignaciones registradas que el banco aún no muestra",sm(entra.map(x=>x.l.d)))}${fila("(−) Pagos registrados que el banco aún no muestra",-sm(sale.map(x=>x.l.c)))}${fila("(−/+) Movimientos del banco sin registrar en el sistema",-sm(noReg.map(o=>o.x.v)))}${fila("Saldo según libros",libros,true)}${fila("Diferencia",dif??0,true)}</table>
      ${entra.length+sale.length?`<h3>Partidas en tránsito</h3><table><tr><th>Fecha</th><th>Comprobante</th><th>Concepto</th><th class="r">Valor</th></tr>${pend.map(x=>`<tr><td>${fechaCorta(x.a.f)}</td><td>${esc(x.a.num)}</td><td>${esc(x.a.concepto)}</td><td class="r">${cop(x.l.d-x.l.c)}</td></tr>`).join("")}</table>`:""}
      ${noReg.length?`<h3>En el banco y no en el sistema</h3><table>${noReg.map(o=>`<tr><td>${fechaCorta(o.x.f)}</td><td>${esc(o.x.desc||"")}</td><td class="r">${cop(o.x.v)}</td></tr>`).join("")}</table>`:""}
      <p style="margin-top:40px">Elaboró: ____________________ &nbsp; Revisó: ____________________</p><script>print()<\/script>`);w.document.close();return}
  }catch(err){toast(err?.msg||errMsg(err))}});

/* ======================= Guardián contable: candado de meses cerrados y reglas de integridad ======================= */
const VOLATILES=new Set(["_editadoPor","_editadoNombre","_editadoF","_creadoPor","_creadoNombre","_creadoF","editado","editadoPor","vistas","vistaCliente","ultimaVista","token","enviada","fe","eventos"]);
const limpio=o=>{const r={};for(const [k,v] of Object.entries(o||{}))if(!VOLATILES.has(k)&&k!=="id")r[k]=v;return r};
const mesDe=f=>S_(f).slice(0,7),cerrado=f=>!!f&&mesCerrado(mesDe(f));
const fechasDoc=(col,d)=>!d?[]:col==="egresos"?[d.f,d.pagado!==false&&d.fPago,d.fAnticipo,...(d.abonos||[]).map(a=>a.f)]:col==="ingresos"?[d.f,d.fCobro]:col==="maquinaria"?[d.contab?d.fAdq:"",d.baja?.f]:col==="cuentas"?[d.fIni]:col==="bodega"?(d.mov||[]).map(m=>m.f):[d.f];
const COLS_GUARD=["ingresos","egresos","traslados","inversion","asientos","ventas","notasdoc","maquinaria","cuentas","bodega"];
const usadoTercero=n=>{const k=normNom(n);return !!k&&(store.egresos.some(e=>normNom(e.tercero)===k)||store.ingresos.some(i=>normNom(i.cliente)===k)||store.ventas.some(v=>normNom(v.cliente)===k)||store.inversion.some(a=>normNom(a.socio)===k)||store.compras.some(c=>normNom(c.proveedor)===k))};
function guardian(col,id,data){
  const old=id?store[col]?.find(x=>x.id===id):null,mens=t=>{throw {msg:t}};
  if(col==="terceros"&&old&&data&&normNom(old.nombre)!==normNom(data.nombre)&&usadoTercero(old.nombre))mens(`"${old.nombre}" ya tiene movimientos: no se le puede cambiar el nombre (se perdería su documento en la exógena y en la cartera). Crea el tercero nuevo y pide al contador que los una.`);
  if(!COLS_GUARD.includes(col))return;
  // 1. fechas anteriores al inicio de la contabilidad
  const ini=CONT.inicio;if(ini&&data&&!old&&["ingresos","egresos","traslados","inversion","ventas","notasdoc"].includes(col)&&S_(data.f)&&S_(data.f)<ini)mens(`La contabilidad empieza el ${fechaCorta(ini)}: no se pueden registrar movimientos con fecha anterior. Si es un saldo de antes, va como saldo inicial.`);
  // 2. facturas de compra ya causadas: se corrigen con notas, no editando
  if(col==="egresos"&&old&&data&&(old.compraId||(old.abonos||[]).length||store.notasdoc.some(n=>n.ref===old.id&&n.estado==="contabilizada"))){for(const k of ["valor","cat","f","tercero","tx","ivaDesc"])if(JSON.stringify(old[k]??"")!==JSON.stringify(data[k]??""))mens("Esta factura ya está causada (o tiene pagos o notas): no se puede cambiar su valor, fecha, concepto ni proveedor. Corrígela con una nota crédito o débito.")}
  if(col==="egresos"&&old&&!data&&(old.pagado!==false&&old.compraId||(old.abonos||[]).length||store.notasdoc.some(n=>n.ref===old.id&&n.estado==="contabilizada")))mens("Esta factura ya tiene pagos, abonos o notas: no se puede borrar. Corrígela con una nota crédito.");
  // 3. anular una venta con pagos o notas
  if(col==="ventas"&&old&&data&&old.estado==="contabilizada"&&data.estado==="anulada"&&(store.ingresos.some(i=>i.ventaId===old.id)||store.notasdoc.some(n=>n.ref===old.id&&n.estado==="contabilizada")))mens(`${old.num} tiene pagos o notas registrados: no se puede anular. Haz una nota crédito por el total (motivo «Anulación») o primero borra el recibo de caja.`);
  // 4. meses cerrados: nada nuevo, nada cambiado, nada borrado
  const fNew=fechasDoc(col,data).filter(Boolean),fOld=fechasDoc(col,old).filter(Boolean);
  if(!old&&data){if(fNew.some(cerrado))mens(`${mesLargo(mesDe(fNew.find(cerrado)))} está cerrado en Contabilidad. Pide a Oswaldo que lo reabra.`);return}
  if(old&&!data){if(fOld.some(cerrado))mens(`${mesLargo(mesDe(fOld.find(cerrado)))} está cerrado en Contabilidad: no se puede borrar.`);return}
  if(!old||!data)return;
  const a=limpio(old),b=limpio(data),cambios=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>JSON.stringify(a[k]??null)!==JSON.stringify(b[k]??null));if(!cambios.length)return;
  if(col==="bodega"){const viejos=(old.mov||[]).filter(m=>cerrado(m.f)).map(m=>JSON.stringify(m)),nuevos=(data.mov||[]).map(m=>JSON.stringify(m));if(viejos.some(m=>!nuevos.includes(m)))mens("Hay movimientos de bodega de un mes cerrado que no se pueden cambiar.");if((data.mov||[]).some(m=>cerrado(m.f)&&!(old.mov||[]).some(o=>JSON.stringify(o)===JSON.stringify(m))))mens("No se pueden registrar movimientos de bodega con fecha de un mes cerrado.");return}
  // lo que sí se puede hacer sobre un documento de un mes cerrado: pagarlo o abonarlo con fecha de un mes abierto
  const permitidos=col==="egresos"?["pagado","fPago","fPagoReg","cuenta","pagoId","abonos","anticipo","fAnticipo"]:col==="ingresos"?["cobrado","fCobro","cuenta"]:col==="maquinaria"?["baja","notas","estado","foto","marca","ubicacion"]:[];
  const fBase=col==="egresos"||col==="ingresos"||col==="ventas"||col==="notasdoc"||col==="traslados"||col==="inversion"||col==="asientos"?[old.f]:fOld;
  if(fBase.some(cerrado)){const malos=cambios.filter(k=>!permitidos.includes(k));if(malos.length)mens(`${mesLargo(mesDe(fBase.find(cerrado)))} está cerrado en Contabilidad: no se puede cambiar (${malos.slice(0,3).join(", ")}). Pide a Oswaldo que lo reabra.`);
    if(col==="egresos"&&old.pagado===false&&data.pagado!==false&&old.cuenta!==data.cuenta&&false)return}
  const nuevas=fNew.filter(f=>!fOld.includes(f));if(nuevas.some(cerrado))mens(`No se puede registrar un pago o movimiento con fecha de ${mesLargo(mesDe(nuevas.find(cerrado)))}: ese mes está cerrado.`);
  if(col==="maquinaria"&&old.contab&&["valor","fAdq","vidaAnios","grupo","contab","cantidad"].some(k=>cambios.includes(k))&&Object.keys(CONT.cierres||{}).some(m=>CONT.cierres[m]&&old.fAdq&&mesDe(old.fAdq)<=m))mens("Este activo ya se depreció en meses cerrados: no se puede cambiar su costo, fecha, vida útil ni grupo. Pide al contador un ajuste.");
  if(col==="cuentas"&&["saldoIni","fIni"].some(k=>cambios.includes(k))&&cerrado(old.fIni))mens("El saldo inicial de esta cuenta es de un mes cerrado: no se puede cambiar.");
}
{const _g=guardarDoc;guardarDoc=async function(col,id,data,...r){guardian(col,id,data);return _g.call(this,col,id,data,...r)};const _b=borrarDoc;borrarDoc=async function(col,id,...r){guardian(col,id,null);return _b.call(this,col,id,...r)}}
// bodega: no se puede sacar más de lo que hay ni antes de que entre
if(typeof registrarMovimiento==="function"){const _rm=registrarMovimiento;registrarMovimiento=async function(key,tipo,cant,nota,extra={}){if(tipo==="salida"){const b=store.bodega.find(x=>x.id===key),hay=+b?.cantidad||0;if(+cant>hay+1e-9)throw {msg:`No hay suficiente en bodega: hay ${hay} y se quieren sacar ${cant}.`};const f=S_(extra.fecha||new Date().toISOString()),prim=(b?.mov||[]).filter(m=>m.t==="entrada").map(m=>S_(m.f)).sort()[0];if(prim&&f<prim)throw {msg:"La salida no puede tener fecha anterior a la primera entrada de ese material."}}return _rm.apply(this,arguments)}}
// configuración: con meses cerrados no se cambian las reglas que mueven esos meses; huella de cada mes cerrado
const huellaMes=m=>{let h=0;for(const a of asientosTodos())if(a.f.startsWith(m))for(const l of a.lineas)h=(h*31+(l.cta+"|"+l.d+"|"+l.c).split("").reduce((s,c)=>(s*33+c.charCodeAt(0))|0,7))|0;return String(h)};
const CFG_CERRADA=["mapa","inicio","ventaCuando","provNom"];
{const _gc=guardarCont;guardarCont=async function(...a){const C=CONT.cierres||{},meses=Object.keys(C).filter(m=>C[m]).sort();
  for(const m of meses)if(!C[m].cfg){C[m]={...C[m],cfg:clone(Object.fromEntries(CFG_CERRADA.map(k=>[k,CONT[k]??null]))),huella:huellaMes(m)}}
  const ult=meses.length?C[meses.at(-1)].cfg:null;if(ult)for(const k of CFG_CERRADA)if(JSON.stringify(CONT[k]??null)!==JSON.stringify(ult[k]??null)){CONT[k]=clone(ult[k]);toast("Hay meses cerrados: no se pueden cambiar las cuentas, la fecha de inicio ni las reglas de venta o provisiones. Pide a Oswaldo que reabra los meses.");render();return}
  return _gc.apply(this,a)}}
{const _ax=window.auditoriaExtra;window.auditoriaExtra=()=>{const R=_ax?_ax():[];const C=CONT.cierres||{};for(const m of Object.keys(C).filter(m=>C[m]?.huella))if(huellaMes(m)!==C[m].huella)R.push(["alta",`${mesLargo(m)} está cerrado pero su contabilidad cambió`,"Algo modificó comprobantes de un mes cerrado. Revisa la bitácora (Usuarios y actividad) y pide a Oswaldo que lo revise y vuelva a cerrar.","ctb:cierre"]);return R}}
window.guardianTF=guardian;

/* ======================= Aplicar saldos a favor (clientes y proveedores) ======================= */
async function aplicarFavor(tipo,ter,objetivos){const A=asientosTodos(),D=docsCartera(A,tipo,"9999-12-31").filter(x=>normNom(x.ter)===normNom(ter)),favor=D.filter(x=>x.saldo<0&&!x.k.startsWith("ant:"));let disp=-favor.reduce((s,x)=>s+x.saldo,0);if(!disp)throw {msg:"No hay saldo a favor para aplicar"};
  const L=[];for(const t of objetivos){if(disp<=0)break;const x=D.find(z=>z.k===t);if(!x||x.saldo<=0)continue;const v=Math.min(disp,x.saldo);disp-=v;let resta=v;
    for(const fv of favor){if(resta<=0)break;const u=Math.min(resta,-fv.saldo-(fv._usado||0));if(u<=0)continue;fv._usado=(fv._usado||0)+u;resta-=u;
      if(tipo==="cxc"){L.push({cta:fv.cta||mapa("cxc"),d:u,c:0,ter,ref:fv.k,det:"Aplicación de saldo a favor"});L.push({cta:x.cta||mapa("cxc"),d:0,c:u,ter,ref:x.k,det:"Aplicado a "+x.doc})}
      else{L.push({cta:fv.cta,d:0,c:u,ter,ref:fv.k,det:"Aplicación de saldo a favor"});L.push({cta:x.cta,d:u,c:0,ter,ref:x.k,det:"Aplicado a "+x.doc})}}}
  if(!L.length)throw {msg:"No hay documentos pendientes para aplicar el saldo a favor"};
  await guardarDoc("asientos",null,{num:numNCnuevo(),f:hoy(),clase:"Reclasificación",ref:"Saldo a favor",concepto:"Aplicación de saldo a favor · "+ter,tercero:ter,lineas:L,creado:new Date().toISOString(),por:myId||null});toast("Saldo a favor aplicado");render()}
window.aplicarFavor=aplicarFavor;
const favorDe=(tipo,ter)=>{if(!ter)return 0;return -docsCartera(asientosTodos(),tipo,"9999-12-31").filter(x=>normNom(x.ter)===normNom(ter)&&x.saldo<0&&!x.k.startsWith("ant:")).reduce((s,x)=>s+x.saldo,0)};
window.favorDe=favorDe;
document.addEventListener("click",async e=>{const b=e.target.closest("[data-ffavor]");if(!b)return;try{const [tipo,ter]=[b.dataset.ffavor,b.dataset.ter];const D=docsCartera(asientosTodos(),tipo,"9999-12-31").filter(x=>normNom(x.ter)===normNom(ter)&&x.saldo>0).sort((a,b)=>S_(a.f).localeCompare(S_(b.f)));if(!confirm(`¿Aplicar ${cop(favorDe(tipo,ter))} de saldo a favor a los documentos pendientes de ${ter}?`))return;await aplicarFavor(tipo,ter,D.map(x=>x.k));if(rcm)rcm.abonos={};}catch(err){toast(err?.msg||errMsg(err))}});

/* ======================= Barra de informes: Excel, PDF e Imprimir en cada reporte ======================= */
const VISTAS_INF=["impuestos","itemsventas","activosconc","numaudit","activos","descargas"],TABS_INF=["diario","mayor","prueba","estados","portercero","flujo","patrimonio","cxc","cxp","inventario","centros","exogena"];
const esInforme=()=>vista==="contabilidad"?TABS_INF.includes(ctb.tab):VISTAS_INF.includes(vista);
const cssInf=document.createElement("style");cssInf.textContent=`.fp-barinf{display:flex;gap:6px;flex-wrap:wrap}
@media print{.rail,#barra-nav,.navbar,.subnav,.fp-barinf,.fm-velo,.toast,#fab,.fab,button,select,.fp-filtros{display:none!important}body,html{background:#fff!important}#main,.fin-main,main{margin:0!important;padding:0!important;max-width:none!important;width:auto!important}body.solo-fin{display:block!important}.fin-card,.panel,.fp-cfg,.fp-tabla{box-shadow:none!important;break-inside:avoid}}`;document.head.appendChild(cssInf);
function barraInformes(){if(!esInforme())return;const m=document.querySelector("#main");if(!m||m.querySelector(".fp-barinf"))return;const h=m.querySelector(".head,.fin-h");if(!h)return;
  const d=document.createElement("div");d.className="fp-barinf";d.innerHTML=`<button class="btn small" data-finf="excel">Excel</button><button class="btn small" data-finf="pdf">PDF</button><button class="btn small" data-finf="imprimir">Imprimir</button>`;h.appendChild(d)}
const celdaXl=t=>{const s=S_(t).replace(/ /g," ").trim();const limpio=s.replace(/[$\s]/g,"").replace(/^−/,"-");if(/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+$/.test(limpio)&&/\d/.test(limpio)){const n=numCO(limpio);if(!isNaN(n))return s.includes("$")?{v:Math.round(n),s:ESTILO.dinero}:n}return s};
document.addEventListener("click",async e=>{const b=e.target.closest("[data-finf]");if(!b)return;const k=b.dataset.finf;
  if(k==="imprimir"||k==="pdf"){if(k==="pdf")toast("En la ventana de impresión elige «Guardar como PDF»");setTimeout(()=>window.print(),k==="pdf"?600:0);return}
  const titulo=(document.querySelector("#main h1")?.innerText||"Informe").trim(),H=[];let i=0;
  for(const t of document.querySelectorAll("#main table")){if(!t.offsetParent)continue;const F=[...t.querySelectorAll("tr")].map(tr=>[...tr.children].map(td=>celdaXl(td.innerText.split("\n")[0]))).filter(f=>f.some(x=>x!==""));if(F.length<2)continue;
    const cab=t.closest(".panel,.fin-card,.fp-cfg")?.querySelector("h2,h3")?.innerText||titulo;H.push({nombre:(++i+" "+cab).replace(/[\\/?*[\]:]/g," ").slice(0,30),filas:F,anchos:F[0].map((_,j)=>j===0?34:16),filtroHasta:F.length})}
  if(!H.length)return toast("Este informe no tiene tablas para exportar");
  await descargar(`${titulo} ${hoy()}.xlsx`,new Blob([libroXlsx(H)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}))});

/* campos sin nombre visible (tablas de configuración): se les pone el nombre de su columna para lectores de pantalla */
function etiquetar(){const m=document.querySelector('#main');if(!m)return;for(const x of m.querySelectorAll('input:not([type=hidden]),select,textarea')){if(x.closest('label')||x.getAttribute('aria-label')||x.placeholder||x.title)continue;
  const td=x.closest('td'),tr=x.closest('tr'),tabla=x.closest('table');let n='';if(td&&tabla){const i=[...tr.children].indexOf(td),th=tabla.querySelectorAll('thead th')[i];const fila=tr.children[0]?.innerText||tr.children[0]?.querySelector('input')?.value||'';n=(th?.innerText||'').trim()+(fila&&i>0?' · '+fila.trim():'')}
  if(!n){const c=x.closest('.fp-sw,.fp-cfg');n=(c?.querySelector('b,h2')?.innerText||'').trim()}if(n)x.setAttribute('aria-label',n.slice(0,80))}}
{const _r=render;render=function(){window.__saldos=null;try{syncClases()}catch{}const out=_r.apply(this,arguments);try{etiquetar();barraInformes()}catch{}return out}}
if(typeof renderSuave==="function"){const _s=renderSuave;renderSuave=function(){window.__saldos=null;const out=_s.apply(this,arguments);try{etiquetar();barraInformes()}catch{}return out}}
// cotizaciones cuya venta cae en un mes cerrado: no se cambia su valor ni su fecha de venta
if(typeof guardarCotizacion==="function"){const _gq=guardarCotizacion;guardarCotizacion=async function(q,...r){const old=q?.id?quotes.find(x=>x.id===q.id):null;if(old&&!cotFacturada(old.id)){const fo=fechaVenta(old),fn=fechaVenta(q);if((fo&&mesCerrado(mesDe(fo)))||(fn&&mesCerrado(mesDe(fn)))){const tN=Math.round(calcQuote(q,precios).total),tO=Math.round(totalDe(old));if(fo!==fn||tN!==tO)throw {msg:"La venta de esta obra está en un mes cerrado: no se puede cambiar su valor ni su fecha de instalación. Pide a Oswaldo que reabra el mes o haz una nota."}}}return _gq.call(this,q,...r)}}
window.FPRO2={gruposPorPagar,anticipoDisp,lineasCompra,destLinea,sugerirRet,abrirCausa,causarLineas,set:o=>{if(o.cD!==undefined)cD=o.cD},get:()=>({cD}),importar:async(tipo,filas,mapa,extra={})=>{mig={...mig,tipo,filas,mapa,...extra};await importar()},zip};
if(typeof render==="function")try{render()}catch(err){console.error(err)}
})();
