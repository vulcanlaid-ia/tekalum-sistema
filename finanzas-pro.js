/* =====================================================================================================
   TEKALUM Finanzas · módulo profesional
   Ventas (facturas o cuentas de cobro), notas crédito y débito, documentos soporte, acuse de recibo,
   situación tributaria, impuestos y retenciones, formas de pago, numeración, resoluciones y facturación
   electrónica preparada (se enciende cuando termine la habilitación ante la DIAN).
   Todo se contabiliza solo: cada documento genera su asiento en el mismo motor (asientosTodos).
   ===================================================================================================== */
(()=>{
"use strict";
const r0=x=>Math.round(+x||0);
const hoy=()=>hoyISO();
const S_ = s=>String(s??"");
const yo=()=>window.VYE_SESION?.nombre||"";

/* ---------------- íconos nuevos ---------------- */
Object.assign(IC,{
  factura:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  nota:'<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M9 13h6"/>',
  impuesto:'<path d="M5 19L19 5"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
  soporte:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 14l2 2 4-4"/>',
  cxc:'<path d="M4 7h16v10H4z"/><path d="M8 12h8M12 9v6"/>',
  cxp:'<path d="M4 7h16v10H4z"/><path d="M8 12h8"/>',
  acuse:'<path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6M9 16l2 2 4-4"/>'});

/* ---------------- tipos de comprobante nuevos ---------------- */
TIPOS_COMP.FV="Factura de venta";
Object.assign(TIPOS_COMP,{NCV:"Nota crédito de venta",NDV:"Nota débito de venta",NCC:"Nota crédito de compra",NDC:"Nota débito de compra"});

/* ======================= Situación tributaria ======================= */
const TRIB_DEF={persona:"natural",iva:"no_responsable",regimen:"ordinario",agente:false,autorret:false,fe:false,
  razon:"",comercial:"TEKALUM",tipoDoc:"CC",doc:"",dv:"",dir:"",mpio:"52001",ciudad:"Pasto",tel:"",email:"",ciiu:"",resp:["R-99-PN"],ica:["52001"],uvt:52374,uvtAnio:2026};
const trib=()=>({...TRIB_DEF,...(CONT.trib||{})});
const esResp=()=>trib().iva==="responsable";
const feOn=()=>!!trib().fe;
const RESP_FISCAL=[["R-99-PN","No responsable (no aplica otra)"],["O-13","Gran contribuyente"],["O-15","Autorretenedor"],["O-23","Agente de retención de IVA"],["O-47","Régimen simple de tributación"]];
// dígito de verificación del NIT (algoritmo de la DIAN)
function dvNit(n){const d=S_(n).replace(/\D/g,"");if(!d)return "";const P=[3,7,13,17,19,23,29,37,41,43,47,53,59,67,71];let s=0;for(let i=0;i<d.length&&i<P.length;i++)s+=(+d[d.length-1-i])*P[i];const r=s%11;return String(r>1?11-r:r)}
const DOC_DIAN={CC:"13",NIT:"31",CE:"22",PP:"41",TI:"12",RC:"11",OT:"42"};

/* ======================= Impuestos y retenciones ======================= */
// tarifas y bases de la norma vigente (nov. 2026); el contador las confirma en Configuración
const IMP_DEF=()=>[
  {id:"iva19",tipo:"iva",nombre:"IVA 19 %",tarifa:19,ctaV:"240805",ctaC:"240810",activo:true},
  {id:"iva5",tipo:"iva",nombre:"IVA 5 %",tarifa:5,ctaV:"240805",ctaC:"240810",activo:true},
  {id:"ivaEx",tipo:"iva",nombre:"Exento de IVA (0 %)",tarifa:0,ctaV:"240805",ctaC:"240810",activo:true},
  {id:"ivaExcl",tipo:"iva",nombre:"Excluido de IVA",tarifa:0,ctaV:"240805",ctaC:"240810",activo:true},
  {id:"rfCompras",tipo:"rf",nombre:"Retención · compras generales (declarante)",tarifa:2.5,baseUVT:10,ctaC:"236540",ctaV:"135515",activo:true},
  {id:"rfComprasND",tipo:"rf",nombre:"Retención · compras generales (no declarante)",tarifa:3.5,baseUVT:10,ctaC:"236540",ctaV:"135515",activo:true},
  {id:"rfServ",tipo:"rf",nombre:"Retención · servicios generales (declarante)",tarifa:4,baseUVT:2,ctaC:"236525",ctaV:"135515",activo:true},
  {id:"rfServND",tipo:"rf",nombre:"Retención · servicios generales (no declarante)",tarifa:6,baseUVT:2,ctaC:"236525",ctaV:"135515",activo:true},
  {id:"rfHon",tipo:"rf",nombre:"Retención · honorarios (persona natural)",tarifa:10,baseUVT:0,ctaC:"236515",ctaV:"135515",activo:true},
  {id:"rfArr",tipo:"rf",nombre:"Retención · arrendamiento de inmuebles",tarifa:3.5,baseUVT:10,ctaC:"236530",ctaV:"135515",activo:true},
  {id:"rfTransp",tipo:"rf",nombre:"Retención · transporte de carga",tarifa:1,baseUVT:2,ctaC:"236525",ctaV:"135515",activo:true},
  {id:"riva15",tipo:"riva",nombre:"ReteIVA (15 % del IVA)",tarifa:15,baseUVT:0,ctaC:"2367",ctaV:"135517",activo:true},
  {id:"rica",tipo:"rica",nombre:"ReteICA Pasto (por mil)",tarifa:0,porMil:true,baseUVT:0,ctaC:"2368",ctaV:"135518",activo:true},
  {id:"ica",tipo:"ica",nombre:"Industria y comercio Pasto (por mil)",tarifa:0,porMil:true,baseUVT:0,ctaC:"511505",ctaV:"2412",activo:true},
  {id:"inc8",tipo:"inc",nombre:"Impuesto nacional al consumo 8 %",tarifa:8,baseUVT:0,ctaC:"",ctaV:"2495",activo:false},
  {id:"autorret",tipo:"autorret",nombre:"Autorretención especial de renta",tarifa:0,baseUVT:0,ctaC:"236575",ctaV:"135595",activo:false}];
const imps=()=>{const L=CONT.impuestos&&CONT.impuestos.length?CONT.impuestos:[],D=IMP_DEF();return L.length?[...L,...D.filter(d=>!L.some(x=>x.id===d.id))]:D};
const impDe=id=>imps().find(x=>x.id===id)||null;
const TIPO_IMP={iva:"IVA",inc:"Impuesto al consumo (INC)",rf:"Retención en la fuente",riva:"ReteIVA",rica:"ReteICA",ica:"Industria y comercio (ICA)",autorret:"Autorretenciones"};
const IMP_AYUDA={iva:"Cuenta en compras = IVA descontable; cuenta en ventas = IVA generado.",inc:"Solo para restaurantes, bares y algunos bienes. Cuenta en ventas = INC por pagar.",rf:"Cuenta en compras = retención que practicamos (por pagar); cuenta en ventas = retención que nos practican.",riva:"15 % del IVA de la factura.",rica:"Tarifa por mil según el municipio y la actividad.",ica:"Impuesto sobre los ingresos del periodo. Cuenta en compras = gasto de ICA; cuenta en ventas = ICA por pagar. Se liquida en Reportes › Impuestos.",autorret:"Si TEKALUM es autorretenedor, se liquida sobre los ingresos. Cuenta en compras = autorretención por pagar; cuenta en ventas = anticipo de renta."};
Object.assign(PUC_BASE,{"511505":"Impuesto de industria y comercio","2412":"Impuesto de industria y comercio por pagar","2495":"Otros impuestos por pagar (INC)","236575":"Autorretenciones por pagar","135595":"Otros anticipos de impuestos (autorretenciones)"});
const valorRet=(im,base,iva)=>!im?0:im.tipo==="riva"?r0(iva*(+im.tarifa||0)/100):im.porMil?r0(base*(+im.tarifa||0)/1000):r0(base*(+im.tarifa||0)/100);
const baseMinRet=im=>r0((+im?.baseUVT||0)*(+trib().uvt||0));

/* ======================= Formas de pago y numeración ======================= */
const MEDIOS=[["10","Efectivo"],["42","Consignación bancaria"],["47","Transferencia bancaria"],["48","Tarjeta crédito"],["49","Tarjeta débito"],["ZZZ","Otro"]];
const plazos=()=>CONT.plazos&&CONT.plazos.length?CONT.plazos:[15,30,60];
const medioDe=cta=>(CONT.medios||{})[cta]||(store.cuentas.find(c=>c.id===cta)?.tipo==="caja"?"10":"47");
const opcForma=sel=>`<optgroup label="De contado (el dinero entra o sale de)">${cuentasActivas().map(c=>`<option value="c:${esc(c.id)}" ${sel==="c:"+c.id?"selected":""}>Contado · ${esc(nombreCuenta(c.id))}</option>`).join("")}</optgroup><optgroup label="A crédito">${plazos().map(d=>`<option value="k:${d}" ${sel==="k:"+d?"selected":""}>Crédito a ${d} días</option>`).join("")}</optgroup>`;
const formaDe=v=>S_(v).startsWith("c:")?{tipo:"contado",cuenta:S_(v).slice(2),dias:0}:{tipo:"credito",cuenta:"",dias:+S_(v).slice(2)||30};
const formaTxt=v=>{const f=formaDe(v);return f.tipo==="contado"?"Contado · "+nombreCuenta(f.cuenta):"Crédito a "+f.dias+" días"};
const formaDef=tipo=>(tipo==="venta"?CONT.fpVenta:CONT.fpCompra)||(cuentasActivas()[0]?"c:"+cuentasActivas()[0].id:"k:30");
const NUM_DEF={CB:{pref:"CC",sig:1,nom:"Cuenta de cobro (sin facturación electrónica)"},FV:{pref:"FV",sig:1,nom:"Factura electrónica de venta (sin resolución: solo pruebas)"},NCV:{pref:"NC",sig:1,nom:"Nota crédito de venta"},NDV:{pref:"ND",sig:1,nom:"Nota débito de venta"},NCC:{pref:"NCC",sig:1,nom:"Nota crédito de compra"},NDC:{pref:"NDC",sig:1,nom:"Nota débito de compra"}};
const numCfg=()=>{const n=clone(NUM_DEF);for(const [k,v] of Object.entries(CONT.numeracion||{}))n[k]={...n[k],...v};return n};
const resols=()=>CONT.resoluciones||[];
const resolVigente=(tipo,f)=>resols().find(r=>r.tipo===tipo&&r.activa!==false&&(!r.vigHasta||S_(f||hoy())<=r.vigHasta)&&(+r.sig||+r.desde)<=+r.hasta);
// toma el siguiente número (de la resolución DIAN si la facturación electrónica está activa)
async function tomarNumero(tipo,f){
  const usados=new Set([...store.ventas.map(v=>v.num),...store.notasdoc.map(n=>n.num)].filter(Boolean));
  if(tipo==="FV"&&feOn()){const r=resolVigente("FV",f);if(!r)throw {msg:"No hay una resolución de facturación vigente. Regístrala en Configuración › Facturación electrónica."};
    let n=Math.max(+r.sig||0,+r.desde||1);while(usados.has(r.pref+n))n++;if(n>+r.hasta)throw {msg:"Se acabó el rango de la resolución "+r.numero+". Solicita una nueva a la DIAN."};
    CONT.resoluciones=resols().map(x=>x.id===r.id?{...x,sig:n+1}:x);await guardarCont();return {num:r.pref+n,resol:r.id}}
  const N=numCfg(),c=N[tipo]||{pref:tipo,sig:1};let n=+c.sig||1,num;do{num=c.pref+"-"+String(n).padStart(4,"0");n++}while(usados.has(num));
  CONT.numeracion={...(CONT.numeracion||{}),[tipo]:{pref:c.pref,sig:n}};await guardarCont();return {num}
}

/* ======================= Ventas: cálculo y asiento ======================= */
const ctasIngreso=()=>{const s=new Set(["4120","4170","4295",...todasCtas([]).filter(c=>/^4[12]/.test(c)&&c.length>=4)]);return [...s].filter(c=>c!=="4175").sort()};
function calcVenta(v){
  const conIva=v.estado==="contabilizada"?!!v.conIva:esResp();
  const L=(v.lineas||[]).map(l=>{const bruto=r0((+l.cant||0)*(+l.pu||0)),dcto=r0(bruto*Math.min(100,Math.max(0,+l.dcto||0))/100),base=bruto-dcto;
    const im=l.ivaT!=null?(+l.ivaT||l.imp?{id:l.imp||"iva",tipo:"iva",nombre:l.impNom||"IVA "+l.ivaT+" %",tarifa:+l.ivaT,ctaV:impDe(l.imp)?.ctaV}:null):conIva?impDe(l.imp):null;
    const iva=im&&im.tipo==="iva"?r0(base*(+im.tarifa||0)/100):0;return {...l,bruto,dcto,base,iva,im:iva?im:null}});
  const bruto=L.reduce((s,l)=>s+l.bruto,0),dcto=L.reduce((s,l)=>s+l.dcto,0),base=bruto-dcto,iva=L.reduce((s,l)=>s+l.iva,0),total=base+iva;
  const ivaPor={};for(const l of L)if(l.iva){const k=l.im.id;(ivaPor[k] ||= {im:l.im,base:0,v:0});ivaPor[k].base+=l.base;ivaPor[k].v+=l.iva}
  const rets=(v.ret||[]).map(r=>{const im=r.tipoR?{...(impDe(r.imp)||{}),id:r.imp,nombre:r.nom,tipo:r.tipoR}:impDe(r.imp);const val=r.valor!==""&&r.valor!=null?r0(r.valor):valorRet(im,base,iva);return {...r,im,v:Math.max(0,val)}}).filter(r=>r.im&&r.v>0);
  const ret=rets.reduce((s,r)=>s+r.v,0);return {L,bruto,dcto,base,iva,total,ivaPor,rets,ret,neto:total-ret};
}
const refVenta=v=>v.cotId?"cot:"+v.cotId:"ventas:"+v.id;
const ctaRetV=im=>im.tipo==="riva"?mapa("reteiva"):im.tipo==="rica"?mapa("reteica"):mapa("rete");
function lineasVenta(v){const t=calcVenta(v),L=[{cta:mapa("cxc"),d:t.neto,det:"Cuenta por cobrar"}];
  for(const r of t.rets)L.push({cta:ctaRetV(r.im),d:r.v,det:r.im.nombre});
  for(const l of t.L)if(l.base)L.push({cta:l.cta||mapa("venta"),c:l.base,cc:l.cc||v.cc||"PROD",det:l.desc||""});
  for(const x of Object.values(t.ivaPor))L.push({cta:x.im.ctaV||mapa("ivaGen"),c:x.v,det:x.im.nombre});
  return L}
const nomDocV=v=>v.tipoDoc==="FV"?"Factura de venta":"Cuenta de cobro";
// notas: [base, iva] por línea; la referencia define las cuentas
function calcNota(n){const venta=esNotaVenta(n);const L=(n.lineas||[]).map(l=>{const base=r0(l.base);let iva=0;if(venta){const t=l.ivaT!=null?+l.ivaT:(impDe(l.imp)?.tipo==="iva"?+impDe(l.imp).tarifa:0);iva=r0(base*(t||0)/100)}else iva=r0(l.iva);return {...l,base,iva}});
  const base=L.reduce((s,l)=>s+l.base,0),iva=L.reduce((s,l)=>s+l.iva,0);return {L,base,iva,total:base+iva}}
const esNotaVenta=n=>n.tipo==="NCV"||n.tipo==="NDV";
const egGrupo0=id=>{for(const g of agruparTx(store.egresos))if(g.some(y=>y.id===id))return g[0];return null};
const cxpDeEg=e=>catEg(e.cat)[3]==="materiales"?mapa("cxpMat"):mapa("cxpOtros");
function lineasNota(n){const t=calcNota(n);
  if(esNotaVenta(n)){const v=store.ventas.find(x=>x.id===n.ref);const cta1=v?.lineas?.[0]?.cta||mapa("venta");
    if(n.tipo==="NCV")return [...t.L.map(l=>({cta:mapa("devVentas"),d:l.base,det:l.desc||"Devolución o rebaja",cc:v?.cc||"PROD"})),{cta:mapa("ivaGen"),d:t.iva,det:"IVA de la nota"},{cta:mapa("cxc"),c:t.total,det:"Menos cuenta por cobrar"}];
    return [{cta:mapa("cxc"),d:t.total,det:"Más cuenta por cobrar"},...t.L.map(l=>({cta:cta1,c:l.base,det:l.desc||"Ajuste",cc:v?.cc||"PROD"})),{cta:mapa("ivaGen"),c:t.iva,det:"IVA de la nota"}]}
  const e=store.egresos.find(x=>x.id===n.ref);if(!e)return [];const gasto=mapa("eg."+e.cat),cxp=cxpDeEg(e);
  if(n.tipo==="NCC")return [{cta:cxp,d:t.total,det:"Menos cuenta por pagar"},...t.L.map(l=>({cta:gasto,c:l.base,det:l.desc||"Devolución o descuento"})),{cta:mapa("ivaDesc"),c:t.iva,det:"IVA descontable"}];
  return [...t.L.map(l=>({cta:gasto,d:l.base,det:l.desc||"Mayor valor"})),{cta:mapa("ivaDesc"),d:t.iva,det:"IVA descontable"},{cta:cxp,c:t.total,det:"Más cuenta por pagar"}]}
ASIENTO_HOOKS.push(add=>{
  for(const v of store.ventas){if(v.estado!=="contabilizada")continue;
    add("FV",v.f,nomDocV(v)+" "+v.num+(v.cotId?" · obra":""),v.cliente,lineasVenta(v),{col:"ventas",id:v.id},{ref:refVenta(v),numFijo:v.num,...(v.cotId?{cot:v.cotId}:{})})}
  for(const n of store.notasdoc){if(n.estado!=="contabilizada")continue;
    if(esNotaVenta(n)){const v=store.ventas.find(x=>x.id===n.ref);if(!v)continue;add(n.tipo,n.f,TIPOS_COMP[n.tipo]+" "+n.num+" · "+(v.num||""),v.cliente,lineasNota(n),{col:"notasdoc",id:n.id},{ref:refVenta(v),numFijo:n.num,...(v.cotId?{cot:v.cotId}:{})})}
    else{const e=store.egresos.find(x=>x.id===n.ref);if(!e)continue;const g0=egGrupo0(e.id);add(n.tipo,n.f,TIPOS_COMP[n.tipo]+" "+n.num+" · "+(e.nota||e.concepto||""),e.tercero,lineasNota(n),{col:"notasdoc",id:n.id},{ref:"egresos:"+(g0?.id||e.id),numFijo:n.num})}}
});
cotFacturada=cid=>store.ventas.find(v=>v.cotId===cid&&v.estado==="contabilizada")||null;
CARTERA_REF.ventas=x=>{const v=store.ventas.find(y=>y.id===x.k.slice(7));x.venc=v?.venc||x.f;x.doc=v?.num||x.doc;x.ter=v?.cliente||x.ter};
// pagos y saldo de una venta
const abonosDe=v=>store.ingresos.filter(i=>v.cotId?i.cotId===v.cotId&&ING_VENTA.includes(i.tipo):i.ventaId===v.id);
const notasDe=v=>store.notasdoc.filter(n=>n.ref===v.id&&n.estado==="contabilizada");
const pagadoDe=L=>L.reduce((s,i)=>s+(+i.valor||0)+(+i.rete||0)+(+i.reteica||0),0),debeV=x=>calcVenta(x).neto+notasDe(x).reduce((s,n)=>s+(n.tipo==="NCV"?-1:1)*calcNota(n).total,0);
// varias cuentas de cobro de una misma obra: lo pagado se aplica en orden (la más antigua primero)
function saldoVenta(v){if(v.estado!=="contabilizada")return 0;if(!v.cotId)return debeV(v)-pagadoDe(abonosDe(v));
  const V=store.ventas.filter(x=>x.cotId===v.cotId&&x.estado==="contabilizada").sort((a,b)=>S_(a.f).localeCompare(S_(b.f))||S_(a.num).localeCompare(S_(b.num)));let pool=pagadoDe(abonosDe(v));
  for(const x of V){const due=debeV(x),ap=Math.min(Math.max(0,pool),Math.max(0,due));pool-=ap;if(x.id===v.id)return due-ap}return 0}
function estadoVenta(v){if(v.estado==="anulada")return "anulada";if(v.estado!=="contabilizada")return "borrador";const s=saldoVenta(v);if(s<=0)return notasDe(v).some(n=>n.tipo==="NCV"&&n.motivo==="2")?"anulnc":"pagada";return v.venc&&v.venc<hoy()?"vencida":"porcobrar"}
const EST_V={borrador:["#8a8f98","st-borrador","Borrador"],porcobrar:["#2a78d6","st-enviada","Por cobrar"],vencida:["#e8743b","st-produccion","Vencida"],pagada:["#1f9d55","st-aprobada","Pagada"],anulada:["#c0392b","st-perdida","Anulada"],anulnc:["#c0392b","st-perdida","Anulada con nota"]};
const EST_FE={no:["st-borrador","Sin facturación electrónica"],pendiente:["st-produccion","Pendiente de envío a la DIAN"],emitida:["st-aprobada","Aceptada por la DIAN"],rechazada:["st-perdida","Rechazada por la DIAN"]};

/* ======================= estilos ======================= */
const css=document.createElement("style");css.textContent=`
.fp-filtros{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:14px}
.fp-filtros label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted);min-width:130px}
.fp-filtros input,.fp-filtros select{min-height:38px}
.fp-mes{display:flex;justify-content:space-between;align-items:baseline;margin:16px 2px 8px}.fp-mes h3{margin:0;font-size:16px}.fp-mes small{color:var(--muted)}
.fp-tabla{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.fp-tabla th{font:700 11px var(--f-body);letter-spacing:.04em;text-transform:uppercase;color:var(--muted);text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);background:var(--surface-2,#f6f8fb)}
.fp-tabla td{padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:middle}.fp-tabla tr:last-child td{border-bottom:0}
.fp-tabla tr.fp-click{cursor:pointer}.fp-tabla tr.fp-click:hover td{background:#f4f8ff}
.fp-tabla td.fp-bar{width:6px;padding:0}.fp-tabla td.fp-bar span{display:block;width:4px;height:34px;border-radius:4px;margin-left:8px}
.fp-tabla .r{text-align:right}.fp-vacio{padding:34px 16px;text-align:center;color:var(--muted);background:#fff;border:1px dashed var(--line);border-radius:12px}
.fp-pie{display:flex;justify-content:space-between;color:var(--muted);font-size:12.5px;margin:8px 4px}
.fp-doc{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px}
.fp-doc-h{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:14px}
.fp-doc-h h1{margin:4px 0 0;font-size:22px}.fp-volver{all:unset;cursor:pointer;color:var(--muted);font-size:13px}.fp-volver:hover{color:var(--ink,#13233f)}
.fp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.fp-sec{margin-top:18px}.fp-sec>h3{font-size:14px;margin:0 0 8px;color:var(--ink,#13233f)}
.fp-lineas{width:100%;border-collapse:collapse}.fp-lineas th{font:700 11px var(--f-body);text-transform:uppercase;letter-spacing:.04em;color:var(--muted);text-align:left;padding:6px 6px;border-bottom:1px solid var(--line)}
.fp-lineas td{padding:6px;border-bottom:1px solid var(--line);vertical-align:top}.fp-lineas input,.fp-lineas select{width:100%;min-width:0}
.fp-lineas .num-in{text-align:right}.fp-x{all:unset;cursor:pointer;color:var(--muted);font-size:18px;padding:4px 6px}.fp-x:hover{color:var(--bad)}
.fp-bajo{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,1fr);gap:18px;margin-top:16px}
.fp-tot{background:var(--surface-2,#f6f8fb);border-radius:12px;padding:12px 14px}.fp-tot div{display:flex;justify-content:space-between;padding:4px 0}.fp-tot .fp-gran{border-top:1px solid var(--line);margin-top:6px;padding-top:8px;font-size:17px;font-weight:800}
.fp-acc{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;border-top:1px solid var(--line);margin-top:18px;padding-top:14px}
.fp-chip{display:inline-flex;gap:6px;align-items:center;font:600 12px var(--f-body);padding:4px 10px;border-radius:999px;background:var(--info-soft);color:var(--info)}
.fp-chip.off{background:var(--surface-2);color:var(--muted);border:1px solid var(--line)}
.fp-tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:14px;flex-wrap:wrap}.fp-tabs button{all:unset;cursor:pointer;padding:9px 14px;font-weight:600;color:var(--muted);border-bottom:2px solid transparent}.fp-tabs button[aria-current=page]{color:var(--accent,#1d4ed8);border-color:currentColor}
.fp-cfg{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:14px}.fp-cfg h2{font-size:16px;margin:0 0 4px}.fp-cfg>p{margin:0 0 12px;color:var(--muted);font-size:13px}
.fp-sw{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line)}.fp-sw:first-of-type{border-top:0}.fp-sw small{display:block;color:var(--muted)}
.fp-asiento td,.fp-asiento th{padding:7px 8px}.fp-ok{color:var(--ok);font-weight:700}.fp-mal{color:var(--bad);font-weight:700}
.fp-alerta{border-left:4px solid var(--warn);background:var(--warn-soft);padding:10px 14px;border-radius:8px;margin-bottom:12px;font-size:13.5px}
.fp-alerta.info{border-color:var(--info);background:var(--info-soft)}.fp-alerta.ok{border-color:var(--ok);background:var(--ok-soft)}
@media(max-width:760px){.fp-bajo{grid-template-columns:1fr}.fp-lineas thead{display:none}.fp-lineas tr{display:grid;grid-template-columns:1fr 1fr;gap:6px;border-bottom:1px solid var(--line);padding:8px 0}.fp-lineas td{border:0;padding:0}.fp-lineas td.fp-ancho{grid-column:1/-1}.fp-tabla .fp-oc{display:none}}
`;document.head.appendChild(css);

/* ======================= piezas de interfaz ======================= */
const cab=(eyebrow,t,sub,acc="")=>`<div class="fin-h"><div><div class="eyebrow">${eyebrow}</div><h1>${t}</h1>${sub?`<p>${sub}</p>`:""}</div>${acc?`<div class="row">${acc}</div>`:""}</div>`;
const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const mesNom=m=>{const [y,mm]=S_(m).split("-");return MESES[+mm-1]+" "+y};
function filtroFechas(F,key,lista,campoF="f"){const ms=[...new Set(lista.map(x=>S_(x[campoF]).slice(0,7)).filter(Boolean))].sort().reverse(),as=[...new Set(ms.map(m=>m.slice(0,4)))];
  return `<label>Mes<select data-fpf="${key}:mes"><option value="">Todos</option>${[...new Set(ms.map(m=>m.slice(5)))].sort().map(m=>`<option value="${m}" ${F.mes===m?"selected":""}>${MESES[+m-1]}</option>`).join("")}</select></label>
    <label>Año<select data-fpf="${key}:anio"><option value="">Todos</option>${as.map(a=>`<option ${F.anio===a?"selected":""}>${a}</option>`).join("")}</select></label>`}
const pasaFecha=(F,f)=>(!F.mes||S_(f).slice(5,7)===F.mes)&&(!F.anio||S_(f).slice(0,4)===F.anio);
function porMes(L,campoF,cols,fila,vacio){if(!L.length)return `<div class="fp-vacio">${vacio}</div>`;const G={};for(const x of L)(G[S_(x[campoF]).slice(0,7)] ||= []).push(x);
  return Object.keys(G).sort().reverse().map(m=>`<div class="fp-mes"><h3>${mesNom(m)}</h3><small>${G[m].length} documento${G[m].length===1?"":"s"}</small></div>
    <div class="tbl-wrap"><table class="fp-tabla sin-busca"><thead><tr><th></th>${cols.map(c=>`<th class="${c[1]||""}">${c[0]}</th>`).join("")}</tr></thead><tbody>${G[m].map(fila).join("")}</tbody></table></div>`).join("")+`<div class="fp-pie"><span>Mostrando ${L.length} de ${L.length}</span><span>Página 1 de 1</span></div>`}
const barra=c=>`<td class="fp-bar"><span style="background:${c}"></span></td>`;
function tablaAsiento(L,titulo){const d=L.reduce((s,l)=>s+r0(l.d),0),c=L.reduce((s,l)=>s+r0(l.c),0),ok=d===c&&d>0;
  return `<div class="tbl-wrap"><table class="sin-busca fp-asiento"><thead><tr><th>Cuenta</th><th>Detalle</th><th class="r">Débito</th><th class="r">Crédito</th></tr></thead><tbody>
    ${L.filter(l=>r0(l.d)||r0(l.c)).map(l=>`<tr><td>${celdaCta(l.cta)}</td><td class="who">${esc(l.det||"")}${l.cc?" · CC "+esc(l.cc):""}</td><td class="r num">${r0(l.d)?cop(l.d):""}</td><td class="r num">${r0(l.c)?cop(l.c):""}</td></tr>`).join("")}
    <tr class="subt"><td colspan="2"><b>${titulo||"Totales"}</b> <span class="${ok?"fp-ok":"fp-mal"}">${ok?"✓ Balanceado":"✗ No cuadra"}</span></td><td class="r num"><b>${cop(d)}</b></td><td class="r num"><b>${cop(c)}</b></td></tr></tbody></table></div>`}
const datalistTer=()=>`<datalist id="fp-ters">${tercerosTodos().map(t=>`<option value="${esc(t.nombre)}">${esc(t.doc?(t.tipoDoc||"")+" "+t.doc:"")}</option>`).join("")}</datalist>`;
const opcImp=(sel,tipos)=>`<option value="">Ninguno</option>`+imps().filter(i=>tipos.includes(i.tipo)&&i.activo!==false).map(i=>`<option value="${esc(i.id)}" ${sel===i.id?"selected":""}>${esc(i.nombre)}</option>`).join("");
const ctasIngresoX=()=>ctasIngreso();
const opcCtaIng=sel=>ctasIngreso().map(c=>`<option value="${c}" ${sel===c?"selected":""}>${c} · ${esc(nomCta(c))}</option>`).join("");
let fpModal=null; // asiento | pago | nota | fe | ret | resol
const modalCab=(t,sub)=>fmCab(t,sub);

/* ======================= Ventas: lista, formulario y detalle ======================= */
let vDraft=null,vVer=null,vF={q:"",mes:"",anio:"",estado:""},pagoD=null,asPrev=null;
const nuevaVenta=(o={})=>({f:hoy(),forma:formaDef("venta"),venc:"",cliente:"",cotId:"",cc:"",lineas:[{cta:"4120",desc:"",cant:1,pu:"",dcto:"",imp:""}],ret:[],notas:CONT.notaVenta||"",estado:"borrador",...o});
function vVentas(){
  if(vDraft)return formVenta();
  if(vVer){const v=store.ventas.find(x=>x.id===vVer);if(v)return detalleVenta(v);vVer=null}
  const T=store.ventas.slice().sort((a,b)=>S_(b.f).localeCompare(S_(a.f))||S_(b.num).localeCompare(S_(a.num)));
  const L=T.filter(v=>pasaFecha(vF,v.f)&&(!vF.estado||estadoVenta(v)===vF.estado)&&(!vF.q||normNom([v.num,v.cliente,v.notas].join(" ")).includes(normNom(vF.q))));
  const cont=T.filter(v=>v.estado==="contabilizada"),porC=cont.reduce((s,v)=>s+Math.max(0,saldoVenta(v)),0),venc=cont.filter(v=>estadoVenta(v)==="vencida");
  const mesAct=hoy().slice(0,7),delMes=cont.filter(v=>S_(v.f).startsWith(mesAct)).reduce((s,v)=>s+calcVenta(v).total,0);
  return `${cab("Ventas","Facturas de venta",feOn()?"Facturas electrónicas de venta: se numeran con la resolución de la DIAN y se envían al proveedor tecnológico.":"Mientras no haya facturación electrónica, cada venta sale como <b>cuenta de cobro</b> numerada y queda en la contabilidad. Cuando actives la facturación electrónica, el mismo botón emite la factura.",`<button class="btn" data-frcm="1">Recibo de caja</button><button class="btn primary" data-fp="venta-nueva">+ Nueva ${feOn()?"factura":"venta"}</button>`)}
  ${feOn()?"":`<div class="fp-alerta info">Facturación electrónica <b>apagada</b>. ${esResp()?"":"TEKALUM es no responsable de IVA: las ventas no llevan IVA. "}Se enciende en <button class="btn small ghost" data-fin="dian">Configuración › Facturación electrónica</button></div>`}
  <div class="kpis">${kpi("Vendido este mes",cop(delMes),mesNom(mesAct))}${kpi("Por cobrar",cop(porC),`${cont.filter(v=>saldoVenta(v)>0).length} documento(s)`)}${kpi("Vencidas",String(venc.length),venc.length?cop(venc.reduce((s,v)=>s+saldoVenta(v),0)):"al día",venc.length?"color:var(--bad)":"")}${kpi("Documentos",String(T.length),T.filter(v=>v.estado==="borrador").length+" en borrador")}</div>
  <div class="fp-filtros" style="margin-top:12px"><label style="flex:1;min-width:200px">Buscar<input id="fp-vq" data-fpf="v:q" value="${esc(vF.q)}" placeholder="Número, cliente o descripción"></label>${filtroFechas(vF,"v",T)}
    <label>Estado<select data-fpf="v:estado"><option value="">Todos</option>${Object.entries(EST_V).map(([k,x])=>`<option value="${k}" ${vF.estado===k?"selected":""}>${x[2]}</option>`).join("")}</select></label></div>
  ${porMes(L,"f",[["Fecha"],["Número"],["Cliente"],["Vence","fp-oc"],["Total","r"],["Saldo","r"],["Estado"]],v=>{const e=estadoVenta(v),t=calcVenta(v),x=EST_V[e];
    return `<tr class="fp-click" data-fp="venta-ver" data-id="${esc(v.id)}" tabindex="0">${barra(x[0])}<td class="num">${fechaCorta(v.f)}</td><td class="num"><b>${esc(v.num||"Borrador")}</b><div class="who">${esc(nomDocV(v))}${v.cotId?" · obra "+esc(quotes.find(q=>q.id===v.cotId)?.numero||""):""}</div></td>
      <td>${esc(v.cliente||"—")}${autorTag(v)}</td><td class="num fp-oc">${v.venc?fechaCorta(v.venc):"—"}</td><td class="r num">${cop(t.total)}</td><td class="r num">${v.estado==="contabilizada"?cop(Math.max(0,saldoVenta(v))):"—"}</td><td><span class="pill ${x[1]}">${x[2]}</span></td></tr>`},
    T.length?"Ningún documento con esos filtros.":`Aún no hay ventas registradas.<div style="margin-top:10px"><button class="btn primary" data-fp="venta-nueva">Crear la primera →</button></div>`)}
  ${fpModalHtml()}`;
}
function formVenta(){
  const v=vDraft,t=calcVenta(v),f=formaDe(v.forma),obras=obrasVendidas().filter(q=>!store.ventas.some(x=>x.cotId===q.id&&x.estado!=="anulada"&&x.id!==v.id)||q.id===v.cotId);
  const tipoDoc=feOn()?"Factura electrónica de venta":"Cuenta de cobro",ivaOk=esResp();
  return `<div class="fp-doc">${datalistTer()}${typeof datalistItems==="function"?datalistItems():""}<div class="fp-doc-h"><div><button class="fp-volver" data-fp="venta-cerrar">← Volver al listado</button><h1>${v.id?"Editar":"Nueva"} ${tipoDoc.toLowerCase()}</h1><div class="who">${feOn()?"Se numera con la resolución de la DIAN al contabilizar.":"Se numera al contabilizar (consecutivo interno). No es factura electrónica."}</div></div>
    <span class="fp-chip ${feOn()?"":"off"}">${feOn()?"Electrónica":"No electrónica"}</span></div>
    <div class="fp-grid">
      <label class="f">Cliente *<input id="fp-cli" list="fp-ters" data-fpv="cliente" value="${esc(v.cliente)}" placeholder="Busca por nombre" autocomplete="off"></label>
      <label class="f">Fecha *<input type="date" data-fpv="f" value="${esc(v.f)}"></label>
      <label class="f">Forma de pago *<select data-fpv="forma" data-bsel="1">${opcForma(v.forma)}</select></label>
      <label class="f">Vence<input type="date" data-fpv="venc" value="${esc(f.tipo==="credito"?(v.venc||sumaDias(v.f,f.dias)):v.f)}" ${f.tipo==="contado"?"disabled":""}></label>
      <label class="f">Obra relacionada (opcional)<select data-fpv="cotId"><option value="">Ninguna</option>${obras.map(q=>`<option value="${esc(q.id)}" ${v.cotId===q.id?"selected":""}>${esc(q.numero)} · ${esc(q.cliente?.nombre||"")} · ${cop(totalDe(q))}</option>`).join("")}</select></label>
      <label class="f">Centro de costo<select data-fpv="cc">${opcCC(v.cc,"PROD")}</select></label>${typeof selLista==="function"?selLista(v):""}</div>
    ${v.cotId?`<div class="fp-alerta info" style="margin-top:12px">Al contabilizar, esta ${tipoDoc.toLowerCase()} reemplaza la venta automática de la obra y cruza los anticipos que el cliente ya pagó.</div>`:""}
    <div class="fp-sec"><h3>Detalle</h3><div class="tbl-wrap"><table class="fp-lineas"><thead><tr><th style="width:21%">Concepto (cuenta)</th><th>Descripción</th><th style="width:8%">Cant.</th><th style="width:13%">Precio</th><th style="width:8%">Desc. %</th><th style="width:14%">Impuesto</th><th style="width:12%" class="r">Total</th><th></th></tr></thead><tbody>
      ${v.lineas.map((l,i)=>`<tr><td class="fp-ancho"><select id="fp-l${i}cta" data-fpl="${i}|cta">${opcCtaIng(l.cta)}</select></td><td class="fp-ancho"><input id="fp-l${i}desc" list="fp-items" data-fpl="${i}|desc" value="${esc(l.desc)}" placeholder="Producto, servicio o descripción" autocomplete="off"></td>
        <td><input id="fp-l${i}cant" class="num-in" data-fpl="${i}|cant" value="${esc(l.cant)}" inputmode="decimal"></td><td><input id="fp-l${i}pu" class="num-in" data-fpl="${i}|pu" value="${esc(l.pu)}" inputmode="numeric" placeholder="0"></td>
        <td><input id="fp-l${i}dcto" class="num-in" data-fpl="${i}|dcto" value="${esc(l.dcto)}" inputmode="decimal" placeholder="0"></td>
        <td>${ivaOk?`<select data-fpl="${i}|imp">${opcImp(l.imp,["iva"])}</select>`:`<span class="who" title="TEKALUM es no responsable de IVA">No aplica</span>`}</td>
        <td class="r num">${cop(t.L[i].base+t.L[i].iva)}</td><td>${v.lineas.length>1?`<button class="fp-x" data-fp="linea-quitar" data-i="${i}" aria-label="Quitar línea">×</button>`:""}</td></tr>`).join("")}</tbody></table></div>
      <button class="btn small" data-fp="linea-mas" style="margin-top:8px">+ Agregar línea</button></div>
    <div class="fp-bajo"><div><label class="f">Notas que salen en el documento<textarea data-fpv="notas" rows="3" placeholder="Condiciones, garantía, cuenta para consignar…">${esc(v.notas||"")}</textarea></label>
      <div class="fp-sec"><h3>Retenciones que nos practica el cliente</h3>${(v.ret||[]).map((r,i)=>{const im=impDe(r.imp);return `<div class="row" style="gap:6px;align-items:flex-end;margin-bottom:6px"><label class="f" style="flex:2">Retención<select data-fpr="${i}|imp">${opcImp(r.imp,["rf","riva","rica"])}</select></label><label class="f" style="flex:1">Valor<input id="fp-r${i}valor" class="num-in" data-fpr="${i}|valor" value="${esc(r.valor??"")}" placeholder="${cop(valorRet(im,t.base,t.iva))}" inputmode="numeric"></label><button class="fp-x" data-fp="ret-quitar" data-i="${i}" aria-label="Quitar retención">×</button></div>`}).join("")||`<p class="who" style="margin:0 0 6px">Sin retenciones. Agrégalas solo si el cliente te las descuenta.</p>`}
        <button class="btn small ghost" data-fp="ret-mas">+ Agregar retención</button></div></div>
      <div class="fp-tot"><div><span>Subtotal</span><b class="num">${cop(t.bruto)}</b></div>${t.dcto?`<div><span>Descuento</span><b class="num">− ${cop(t.dcto)}</b></div>`:""}${Object.values(t.ivaPor).map(x=>`<div><span>${esc(x.im.nombre)}</span><b class="num">${cop(x.v)}</b></div>`).join("")}
        <div class="fp-gran"><span>Total</span><span class="num">${cop(t.total)}</span></div>${t.rets.map(r=>`<div><span>− ${esc(r.im.nombre)}</span><b class="num">${cop(r.v)}</b></div>`).join("")}${t.ret?`<div class="fp-gran"><span>Neto a cobrar</span><span class="num">${cop(t.neto)}</span></div>`:""}</div></div>
    <div class="fp-acc"><button class="btn ghost" data-fp="venta-cerrar">Cancelar</button><button class="btn" data-fp="asiento-venta">Ver asiento contable</button><button class="btn" data-fp="venta-borrador">Guardar borrador</button><button class="btn primary" data-fp="venta-contab">Contabilizar</button></div></div>
  ${fpModalHtml()}`;
}
function detalleVenta(v){
  const t=calcVenta(v),e=estadoVenta(v),x=EST_V[e],ab=abonosDe(v),ns=store.notasdoc.filter(n=>n.ref===v.id),saldo=saldoVenta(v),A=asientosTodos().filter(a=>a.ref===refVenta(v)||(a.src.col==="ventas"&&a.src.id===v.id));
  const fe=v.fe?.estado||(v.tipoDoc==="FV"?"pendiente":"no");
  return `<div class="fp-doc"><div class="fp-doc-h"><div><button class="fp-volver" data-fp="venta-cerrar">← Volver al listado</button><h1>${esc(nomDocV(v))} ${esc(v.num||"(borrador)")}</h1><div class="who">${esc(v.cliente)} · ${fechaCorta(v.f)}${v.venc?" · vence "+fechaCorta(v.venc):""}</div></div>
      <div class="row"><span class="pill ${x[1]}">${x[2]}</span><span class="pill ${EST_FE[fe][0]}">${EST_FE[fe][1]}</span></div></div>
    <div class="fp-acc" style="justify-content:flex-start;border-top:0;margin:0 0 16px;padding-top:0">${v.estado==="borrador"?`<button class="btn ghost" data-fp="venta-borrar" data-id="${esc(v.id)}">Borrar borrador</button><button class="btn primary" data-fp="venta-editar" data-id="${esc(v.id)}">Editar y contabilizar</button>`:""}
      ${v.estado==="contabilizada"?`${saldo>0?`<button class="btn primary" data-fp="pago-nuevo" data-id="${esc(v.id)}">Registrar pago</button>`:""}<button class="btn" data-fp="nota-de" data-id="${esc(v.id)}" data-t="NCV">Nota crédito</button><button class="btn" data-fp="nota-de" data-id="${esc(v.id)}" data-t="NDV">Nota débito</button>
        ${v.tipoDoc==="FV"?`<button class="btn" data-fp="fe-ver" data-id="${esc(v.id)}">Datos para la DIAN</button><button class="btn" data-fp="fe-emitir" data-id="${esc(v.id)}" ${feOn()&&fe!=="emitida"?"":"disabled"} title="${feOn()?"Envía la factura al proveedor tecnológico":"Se activa con la facturación electrónica"}">Emitir a la DIAN</button>`:""}
        ${typeof btnEnviar==="function"?btnEnviar(v):""}<button class="btn" data-fp="venta-imprimir" data-id="${esc(v.id)}">Imprimir / PDF</button>${v.tipoDoc!=="FV"&&!ab.length&&!ns.length?`<button class="btn ghost" data-fp="venta-anular" data-id="${esc(v.id)}">Anular</button>`:""}`:""}</div>
    <div class="fp-grid"><div><div class="eyebrow">Forma de pago</div><b>${esc(formaTxt(v.forma))}</b></div><div><div class="eyebrow">Obra</div><b>${v.cotId?esc(quotes.find(q=>q.id===v.cotId)?.numero||"—"):"—"}</b></div><div><div class="eyebrow">Total</div><b>${cop(t.total)}</b></div><div><div class="eyebrow">Saldo</div><b style="color:${saldo>0?"var(--warn)":"var(--ok)"}">${cop(Math.max(0,saldo))}${saldo<0?` (a favor del cliente ${cop(-saldo)})`:""}</b></div></div>
    <div class="fp-sec"><h3>Detalle</h3><div class="tbl-wrap"><table class="sin-busca"><thead><tr><th>Descripción</th><th>Cuenta</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Desc.</th><th class="r">IVA</th><th class="r">Total</th></tr></thead><tbody>
      ${t.L.map(l=>`<tr><td>${esc(l.desc)}</td><td>${celdaCta(l.cta)}</td><td class="r num">${esc(l.cant)}</td><td class="r num">${cop(l.pu)}</td><td class="r num">${l.dcto?cop(l.dcto):""}</td><td class="r num">${l.iva?cop(l.iva):""}</td><td class="r num">${cop(l.base+l.iva)}</td></tr>`).join("")}
      <tr class="subt"><td colspan="6" class="r"><b>Total</b></td><td class="r num"><b>${cop(t.total)}</b></td></tr>${t.rets.map(r=>`<tr><td colspan="6" class="r">− ${esc(r.im.nombre)}</td><td class="r num">${cop(r.v)}</td></tr>`).join("")}${t.ret?`<tr class="subt"><td colspan="6" class="r"><b>Neto a cobrar</b></td><td class="r num"><b>${cop(t.neto)}</b></td></tr>`:""}</tbody></table></div></div>
    <div class="fp-sec"><h3>Pagos recibidos</h3>${ab.length?`<div class="tbl-wrap"><table class="sin-busca"><tbody>${ab.map(i=>`<tr><td class="num">${fechaCorta(i.f)}</td><td>${esc(i.concepto||"")}</td><td>${esc(nombreCuenta(i.cuenta))}</td><td class="r num">${cop((+i.valor||0)+(+i.rete||0)+(+i.reteica||0))}</td></tr>`).join("")}</tbody></table></div>`:`<p class="who">Aún no hay pagos.</p>`}</div>
    ${ns.length?`<div class="fp-sec"><h3>Notas</h3><div class="tbl-wrap"><table class="sin-busca"><tbody>${ns.map(n=>`<tr><td class="num">${esc(n.num||"Borrador")}</td><td>${esc(TIPOS_COMP[n.tipo])}</td><td>${esc(motivoTxt(n))}</td><td class="r num">${cop(calcNota(n).total)}</td><td><span class="pill ${n.estado==="contabilizada"?"st-aprobada":"st-borrador"}">${n.estado==="contabilizada"?"Contabilizada":"Borrador"}</span></td></tr>`).join("")}</tbody></table></div></div>`:""}
    ${v.estado==="contabilizada"?`<div class="fp-sec"><h3>Asiento contable</h3>${A.length?A.map(a=>`<div class="who" style="margin:6px 0 4px"><b>${esc(a.num)}</b> · ${fechaCorta(a.f)} · ${esc(a.concepto)}</div>${tablaAsiento(a.lineas)}`).join(""):`<p class="who">Sin asiento.</p>`}</div>`:""}
    <div class="fp-acc"><button class="btn ghost" data-fp="venta-cerrar">← Volver al listado</button></div></div>
  ${fpModalHtml()}`;
}
function imprimirVenta(v){
  const t=calcVenta(v),T=trib(),c=terceroDe(v.cliente)||{},w=window.open("","_blank");if(!w){toast("Permite las ventanas emergentes para ver el documento");return}
  const emp=T.razon||precios.empresa?.nombre||"TEKALUM",nit=T.doc?`${T.tipoDoc==="NIT"?"NIT":"C.C."} ${T.doc}${T.dv?"-"+T.dv:""}`:"";
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(nomDocV(v))} ${esc(v.num)}</title><style>body{font:13px system-ui,sans-serif;max-width:780px;margin:28px auto;padding:0 18px;color:#1f2326}h1{font-size:20px;margin:0}.cab{display:flex;justify-content:space-between;gap:14px;border-bottom:2px solid #13233f;padding-bottom:12px}.num{font-size:18px;font-weight:800;text-align:right}table{width:100%;border-collapse:collapse;margin-top:14px}td,th{border-bottom:1px solid #dde;padding:7px;text-align:left}.r{text-align:right}.tot td{border:0;padding:3px 7px}.g{font-weight:800;font-size:15px}.box{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.box div{background:#f5f7fa;border-radius:8px;padding:10px}small{color:#667}.pie{margin-top:22px;font-size:11.5px;color:#556}</style>
  <div class="cab"><div>${T.logo?`<img src="${T.logo}" alt="" style="max-height:64px;max-width:200px;display:block;margin-bottom:6px">`:""}<h1>${esc(T.comercial||emp)}</h1><div>${esc(emp)}${nit?" · "+esc(nit):""}</div><small>${esc([T.dir,T.ciudad,T.tel,T.email].filter(Boolean).join(" · "))}</small><div><small>${esResp()?"Responsable de IVA":"No responsable de IVA"}${T.ciiu?" · Actividad CIIU "+esc(T.ciiu):""}</small></div></div>
    <div class="num">${esc(nomDocV(v).toUpperCase())}<br>No. ${esc(v.num)}</div></div>
  <div class="box"><div><small>Cliente</small><br><b>${esc(v.cliente)}</b>${c.doc?`<br>${esc(c.tipoDoc||"")} ${esc(c.doc)}${c.dv?"-"+esc(c.dv):""}`:""}${c.dir?`<br>${esc(c.dir)}`:""}${c.ciudad?" · "+esc(c.ciudad):""}${c.email?`<br>${esc(c.email)}`:""}</div>
    <div><small>Fecha</small> <b>${fechaCorta(v.f)}</b><br><small>Vence</small> <b>${v.venc?fechaCorta(v.venc):"Contado"}</b><br><small>Forma de pago</small> <b>${esc(formaDe(v.forma).tipo==="contado"?"Contado":"Crédito")}</b></div></div>
  <table><thead><tr><th>Descripción</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Desc.</th>${t.iva?`<th class="r">IVA</th>`:""}<th class="r">Total</th></tr></thead><tbody>${t.L.map(l=>`<tr><td>${esc(l.desc)}</td><td class="r">${esc(l.cant)}</td><td class="r">${cop(l.pu)}</td><td class="r">${l.dcto?cop(l.dcto):""}</td>${t.iva?`<td class="r">${l.iva?cop(l.iva):""}</td>`:""}<td class="r">${cop(l.base+l.iva)}</td></tr>`).join("")}</tbody></table>
  <table class="tot"><tr><td class="r">Subtotal</td><td class="r" style="width:150px">${cop(t.bruto)}</td></tr>${t.dcto?`<tr><td class="r">Descuento</td><td class="r">− ${cop(t.dcto)}</td></tr>`:""}${t.iva?`<tr><td class="r">IVA</td><td class="r">${cop(t.iva)}</td></tr>`:""}<tr class="g"><td class="r">Total</td><td class="r">${cop(t.total)}</td></tr>${t.rets.map(r=>`<tr><td class="r">− ${esc(r.im.nombre)}</td><td class="r">${cop(r.v)}</td></tr>`).join("")}${t.ret?`<tr class="g"><td class="r">Neto a pagar</td><td class="r">${cop(t.neto)}</td></tr>`:""}</table>
  ${v.notas?`<p style="white-space:pre-wrap;margin-top:16px">${esc(v.notas)}</p>`:""}
  <div class="pie">${v.tipoDoc==="FV"?(v.fe?.cufe?"CUFE: "+esc(v.fe.cufe):"Representación gráfica pendiente de validación por la DIAN."):"Documento equivalente para persona natural no obligada a facturar electrónicamente."}</div><script>print()<\/script>`);w.document.close();
}

/* ======================= Notas crédito y débito ======================= */
let nDraft=null,nF={q:"",mes:"",anio:"",tipo:""},nLado="venta";
const MOTIVOS={C:[["1","Devolución parcial de bienes o no aceptación del servicio"],["2","Anulación de la factura"],["3","Rebaja o descuento parcial o total"],["4","Ajuste de precio"],["5","Descuento comercial por pronto pago"],["6","Descuento comercial por volumen de ventas"]],D:[["1","Intereses"],["2","Gastos por cobrar"],["3","Cambio del valor"],["4","Otros"]]};
const motivoTxt=n=>(MOTIVOS[n.tipo[1]]||[]).find(m=>m[0]===n.motivo)?.[1]||"";
const nuevaNota=(tipo,ref)=>{const n={tipo,ref:ref||"",f:hoy(),motivo:tipo[1]==="C"?"3":"4",desc:"",lineas:[{desc:"",base:"",imp:"",iva:""}],estado:"borrador"};
  if(ref&&esNotaVenta(n)){const v=store.ventas.find(x=>x.id===ref);if(v)n.lineas=[{desc:"",base:"",imp:v.lineas?.[0]?.imp||"",iva:""}]}return n};
const comprasCausadas=()=>store.egresos.filter(e=>!["activo","capital"].includes(catEg(e.cat)[3])).sort((a,b)=>S_(b.f).localeCompare(S_(a.f)));
function refTxt(n){if(esNotaVenta(n)){const v=store.ventas.find(x=>x.id===n.ref);return v?`${v.num} · ${v.cliente}`:"—"}const e=store.egresos.find(x=>x.id===n.ref);return e?`${e.nota||e.concepto} · ${e.tercero||""}`:"—"}
function vNotas(lado){
  nLado=lado;const tipos=lado==="venta"?["NCV","NDV"]:["NCC","NDC"],T=store.notasdoc.filter(n=>tipos.includes(n.tipo)).sort((a,b)=>S_(b.f).localeCompare(S_(a.f)));
  const L=T.filter(n=>pasaFecha(nF,n.f)&&(!nF.tipo||n.tipo===nF.tipo)&&(!nF.q||normNom([n.num,refTxt(n),n.desc].join(" ")).includes(normNom(nF.q))));
  return `${cab(lado==="venta"?"Ventas":"Compras",lado==="venta"?"Notas crédito y débito de venta":"Notas de compra",lado==="venta"?"La nota crédito baja lo que debe el cliente (devolución, descuento, anulación); la nota débito lo sube. Cada nota queda ligada a su factura.":"Lo que el proveedor nos descuenta o nos cobra de más sobre una factura ya registrada. Baja o sube la cuenta por pagar y el costo.",
    `<button class="btn" data-fp="nota-nueva" data-t="${tipos[1]}">+ Nota débito</button><button class="btn primary" data-fp="nota-nueva" data-t="${tipos[0]}">+ Nota crédito</button>`)}
  <div class="fp-filtros"><label style="flex:1;min-width:200px">Buscar<input id="fp-nq" data-fpf="n:q" value="${esc(nF.q)}" placeholder="Número, documento o tercero"></label>${filtroFechas(nF,"n",T)}
    <label>Tipo<select data-fpf="n:tipo"><option value="">Todas</option>${tipos.map(k=>`<option value="${k}" ${nF.tipo===k?"selected":""}>${TIPOS_COMP[k]}</option>`).join("")}</select></label></div>
  ${porMes(L,"f",[["Fecha"],["Número"],["Documento"],["Motivo","fp-oc"],["Valor","r"],["Estado"]],n=>{const c=n.estado==="contabilizada",col=n.tipo[1]==="C"?"#6b4fd8":"#2a78d6";
    return `<tr class="fp-click" data-fp="nota-abrir" data-id="${esc(n.id)}" tabindex="0">${barra(c?col:"#8a8f98")}<td class="num">${fechaCorta(n.f)}</td><td class="num"><b>${esc(n.num||"Borrador")}</b><div class="who">${esc(TIPOS_COMP[n.tipo])}</div></td><td>${esc(refTxt(n))}</td><td class="fp-oc">${esc(motivoTxt(n))}</td><td class="r num">${cop(calcNota(n).total)}</td><td><span class="pill ${c?"st-aprobada":"st-borrador"}">${c?"Contabilizada":"Borrador"}</span></td></tr>`},
    T.length?"Ninguna nota con esos filtros.":"Aún no hay notas.")}
  ${fpModalHtml()}`;
}
function modalNota(){
  const n=nDraft,t=calcNota(n),venta=esNotaVenta(n),C=n.tipo[1]==="C",ro=n.estado==="contabilizada";
  const refs=venta?store.ventas.filter(v=>v.estado==="contabilizada"):comprasCausadas(),e=!venta?store.egresos.find(x=>x.id===n.ref):null,ivaC=!venta&&+e?.ivaDesc>0,vRef=venta?store.ventas.find(x=>x.id===n.ref):null,ivaV=!!vRef?.conIva;
  return `<div class="panel ingreso">${modalCab((ro?"":n.id?"Editar ":"Nueva ")+TIPOS_COMP[n.tipo].toLowerCase()+(n.num?" "+n.num:""),venta?(C?"Baja lo que debe el cliente":"Sube lo que debe el cliente"):(C?"Baja lo que debemos al proveedor":"Sube lo que debemos al proveedor"))}
    <div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">
      <label class="f full">${venta?"Factura de venta":"Factura de compra o gasto"} *<select data-fpn="ref" data-bsel="1" ${ro?"disabled":""}><option value="">Elige el documento…</option>${refs.map(x=>venta?`<option value="${esc(x.id)}" ${n.ref===x.id?"selected":""}>${esc(x.num)} · ${esc(x.cliente)} · ${cop(calcVenta(x).total)}</option>`:`<option value="${esc(x.id)}" ${n.ref===x.id?"selected":""}>${fechaCorta(x.f)} · ${esc(x.tercero||"Sin tercero")} · ${esc(x.nota||x.concepto)} · ${cop(x.valor)}</option>`).join("")}</select></label>
      <label class="f">Fecha *<input type="date" data-fpn="f" value="${esc(n.f)}" ${ro?"disabled":""}></label>
      <label class="f">Motivo (DIAN) *<select data-fpn="motivo" ${ro?"disabled":""}>${MOTIVOS[n.tipo[1]].map(m=>`<option value="${m[0]}" ${n.motivo===m[0]?"selected":""}>${m[0]} · ${esc(m[1])}</option>`).join("")}</select></label>
      <label class="f full">Explicación<input data-fpn="desc" value="${esc(n.desc||"")}" placeholder="Ej. el cliente devolvió una ventana" ${ro?"disabled":""}></label></div>
    ${venta&&C&&n.ref&&!ro?`<button class="btn small" data-fp="nota-todo" style="margin-top:10px">Traer todas las líneas de la factura (anulación total)</button>`:""}
    <table class="fp-lineas" style="margin-top:10px"><thead><tr><th>Descripción</th><th style="width:22%">Valor sin impuesto</th><th style="width:24%">${venta?"Impuesto":"IVA"}</th><th></th></tr></thead><tbody>
      ${n.lineas.map((l,i)=>`<tr><td class="fp-ancho"><input data-fpnl="${i}|desc" value="${esc(l.desc)}" placeholder="Qué se ajusta" ${ro?"disabled":""}></td><td><input id="fp-n${i}base" class="num-in" data-fpnl="${i}|base" value="${esc(l.base)}" inputmode="numeric" ${ro?"disabled":""}></td>
        <td>${venta?(ivaV?`<select data-fpnl="${i}|imp" ${ro?"disabled":""}>${opcImp(l.imp,["iva"])}</select>`:`<span class="who">No aplica</span>`):ivaC?`<input id="fp-n${i}iva" class="num-in" data-fpnl="${i}|iva" value="${esc(l.iva)}" inputmode="numeric" ${ro?"disabled":""}>`:`<span class="who">No aplica</span>`}</td>
        <td>${n.lineas.length>1&&!ro?`<button class="fp-x" data-fp="nl-quitar" data-i="${i}">×</button>`:""}</td></tr>`).join("")}</tbody></table>
    ${ro?"":`<button class="btn small" data-fp="nl-mas" style="margin-top:6px">+ Agregar línea</button>`}
    <div class="fp-tot" style="margin-top:12px"><div><span>Valor</span><b class="num">${cop(t.base)}</b></div>${t.iva?`<div><span>IVA</span><b class="num">${cop(t.iva)}</b></div>`:""}<div class="fp-gran"><span>Total de la nota</span><span class="num">${cop(t.total)}</span></div></div>
    <h3 style="margin:14px 0 6px">Asiento contable</h3>${n.ref&&t.total?tablaAsiento(lineasNota(n)):`<p class="who">Elige el documento y escribe el valor para ver el asiento.</p>`}
    <div class="row" style="margin-top:12px;justify-content:flex-end">${ro?`<button class="btn" data-fp="nota-imprimir">Imprimir</button><button class="btn ghost" data-fm-cerrar="1">Cerrar</button>`:`<button class="btn ghost" data-fm-cerrar="1">Cancelar</button>${n.id?`<button class="btn ghost" data-fp="nota-borrar">Borrar</button>`:""}<button class="btn" data-fp="nota-guardar" data-c="0">Guardar borrador</button><button class="btn primary" data-fp="nota-guardar" data-c="1">Contabilizar</button>`}</div></div>`;
}

/* ======================= Documentos soporte y acuse de recibo ======================= */
function vSoporte(){
  const A=asientosTodos().filter(a=>a.dsNum),q=normNom(nF.q);
  return `${cab("Compras","Documentos soporte","Cuando le compras a una persona que no factura (un maestro, un transportador, un vendedor informal), el sistema arma el documento soporte. "+(feOn()?"Con la facturación electrónica activa, se transmite a la DIAN.":"Por ahora es un borrador interno; se transmitirá a la DIAN cuando actives la facturación electrónica."),`<button class="btn primary" data-fp="ds-nuevo">+ Nuevo documento soporte</button>`)}
  <div class="fp-alerta info">Para que un gasto salga con documento soporte, al registrarlo en <b>Gastos y egresos</b> marca "Documento soporte (quien vende no factura)". También puedes tomar la <b>foto del recibo</b> y la IA lo lee.</div>
  ${porMes(A.filter(a=>!q||normNom(a.tercero+" "+a.concepto).includes(q)),"f",[["Fecha"],["Número"],["Proveedor"],["Concepto","fp-oc"],["Valor","r"],["DIAN"]],a=>{const e=store.egresos.find(x=>x.id===a.src.id),v=e?r0(+e.valor):0,t=terceroDe(a.tercero)||{};
    return `<tr class="fp-click" data-fp="ds-ver" data-id="${esc(a.src.id)}" tabindex="0">${barra(t.doc?"#1f9d55":"#e8743b")}<td class="num">${fechaCorta(a.f)}</td><td class="num"><b>${esc(a.dsNum)}</b></td><td>${esc(a.tercero||"Sin proveedor")}${t.doc?`<div class="who">${esc(t.tipoDoc||"CC")} ${esc(t.doc)}</div>`:`<div class="who" style="color:var(--warn)">Falta la cédula del vendedor</div>`}</td><td class="fp-oc">${esc(a.concepto)}</td><td class="r num">${cop(v)}</td><td><span class="pill ${feOn()?"st-produccion":"st-borrador"}">${feOn()?"Por transmitir":"Borrador interno"}</span></td></tr>`},
    "Aún no hay documentos soporte.")}`;
}
function vAcuse(){
  const C=store.compras.filter(c=>esReal(c)&&c.cufe).sort((a,b)=>S_(b.fecha).localeCompare(S_(a.fecha))),fe=feOn()&&!!CONT.fe?.proveedor;
  const EV=[["030","Acuse de recibo"],["032","Recibo del bien o servicio"],["033","Aceptación expresa"]];
  return `${cab("Compras","Acuse de recibo","Eventos que la DIAN exige sobre las facturas electrónicas de compra a crédito: acuse de recibo (030), recibo del bien (032) y aceptación expresa (033). Así el proveedor puede negociar la factura como título valor.",`<button class="btn" data-fp="acuse-enviar" ${fe?"":"disabled"} title="${fe?"Envía los eventos pendientes":"Se activa con la facturación electrónica y el proveedor tecnológico"}">Enviar eventos pendientes</button>`)}
  ${fe?"":`<div class="fp-alerta">Los eventos se envían firmados a la DIAN a través del proveedor tecnológico. Cuando termines la habilitación (Configuración › Facturación electrónica), este botón queda activo. Mientras tanto puedes marcar qué eventos corresponden.</div>`}
  ${porMes(C,"fecha",[["Fecha"],["Documento"],["Proveedor"],["Total","r"],["Eventos"]],c=>{const ev=c.eventos||{},n=EV.filter(([k])=>ev[k]).length;
    return `<tr>${barra(n===3?"#1f9d55":n?"#e8743b":"#8a8f98")}<td class="num">${fechaCorta(c.fecha)}</td><td class="num"><b>${esc(c.documento||"")}</b></td><td>${esc(c.proveedor)}<div class="who">${c.nit?"NIT "+esc(c.nit):""}</div></td><td class="r num">${cop(c.total)}</td>
      <td>${EV.map(([k,t])=>`<label class="chk" title="${t}" style="margin-right:8px"><input type="checkbox" data-fpacuse="${esc(c.id)}|${k}" ${ev[k]?"checked":""}> ${k}</label>`).join("")}<div class="who">${ev.enviado?"Enviado a la DIAN":n?"Marcado · pendiente de envío":"Sin eventos"}</div></td></tr>`},
    "No hay facturas electrónicas de compra (con CUFE). Llegan al importar el XML o el Excel de la DIAN.")}`;
}

/* ======================= Reporte de impuestos y certificados ======================= */
let impT="resumen",impP={desde:"",hasta:"",anio:""};
function periodoDef(){const m=hoy().slice(0,7);return {desde:m.slice(0,4)+"-01-01",hasta:hoy()}}
function vImpuestos(){
  const A=asientosTodos(),P={...periodoDef(),...Object.fromEntries(Object.entries(impP).filter(([k,v])=>v))},S=sumasCtas(A,P.desde,P.hasta);
  const sumP=pre=>Object.entries(S).filter(([c])=>c.startsWith(pre)).reduce((s,[,x])=>({d:s.d+x.d,c:s.c+x.c}),{d:0,c:0});
  const ivaG=sumP(mapa("ivaGen")),ivaD=sumP(mapa("ivaDesc")),rfP=sumP("2365"),rivaP=sumP(mapa("rivaPagar")),ricaP=sumP(mapa("ricaPagar")),rfN=sumP(mapa("rete")),rivaN=sumP(mapa("reteiva")),ricaN=sumP(mapa("reteica"));
  const tabs=`<div class="fp-tabs">${[["resumen","Resumen del periodo"],["liq","Liquidar ICA y autorretención"],["cert","Certificados de retención"]].map(([k,t])=>`<button data-fp="imp-tab" data-t="${k}" ${impT===k?'aria-current="page"':""}>${t}</button>`).join("")}</div>`;
  const per=`<div class="fp-filtros"><label>Desde<input type="date" data-fpimp="desde" value="${esc(P.desde)}"></label><label>Hasta<input type="date" data-fpimp="hasta" value="${esc(P.hasta)}"></label>
    <label>Periodo rápido<select data-fpimp="rapido"><option value="">Elegir…</option>${[["mes","Este mes"],["bim","Bimestre actual (IVA)"],["cua","Cuatrimestre actual (IVA)"],["anio","Año actual"]].map(([k,t])=>`<option value="${k}">${t}</option>`).join("")}</select></label></div>`;
  if(impT==="liq"&&typeof liqImpuestos==="function")return cab("Reportes","Impuestos","",`<button class="btn" data-fin="cfgimpuestos">Configurar impuestos</button>`)+tabs+liqImpuestos();
  if(impT==="cert")return cab("Reportes","Impuestos","",`<button class="btn" data-fin="cfgimpuestos">Configurar impuestos</button>`)+tabs+certificados(A);
  const fila=(t,c,v,nota)=>`<tr><td>${t}${nota?`<div class="who">${nota}</div>`:""}</td><td>${celdaCta(c)}</td><td class="r num"><b>${cop(v)}</b></td></tr>`;
  const ivaNeto=(ivaG.c-ivaG.d)-(ivaD.d-ivaD.c);
  return `${cab("Reportes","Impuestos","IVA, retenciones que nos practican y retenciones que practicamos, tomados de la contabilidad del periodo.",`<button class="btn" data-fin="cfgimpuestos">Configurar impuestos</button>`)}${tabs}
  <div class="fp-alerta ${esResp()?"":"info"}">${esResp()?"TEKALUM es <b>responsable de IVA</b>: el IVA generado menos el descontable se declara en el formulario 300.":"TEKALUM es <b>no responsable de IVA</b>: no cobra IVA y el IVA de las compras hace parte del costo. Esta sección queda lista para cuando cambie la situación."}</div>${per}
  <div class="kpis">${kpi("IVA por pagar (neto)",cop(Math.max(0,ivaNeto)),ivaNeto<0?"Saldo a favor "+cop(-ivaNeto):"Generado − descontable")}${kpi("Retenciones que nos hicieron",cop((rfN.d-rfN.c)+(rivaN.d-rivaN.c)+(ricaN.d-ricaN.c)),"Se descuentan en la declaración")}${kpi("Retenciones por pagar",cop((rfP.c-rfP.d)+(rivaP.c-rivaP.d)+(ricaP.c-ricaP.d)),trib().agente?"Formulario 350 · mensual":"No somos agentes de retención")}</div>
  <div class="grid2"><div class="fin-card"><div class="fin-card-h"><h3>IVA</h3></div><div class="tbl-wrap"><table class="sin-busca"><tbody>${fila("IVA generado en ventas",mapa("ivaGen"),ivaG.c-ivaG.d)}${fila("IVA descontable en compras",mapa("ivaDesc"),ivaD.d-ivaD.c)}<tr class="subt"><td colspan="2"><b>${ivaNeto>=0?"IVA a pagar":"Saldo a favor"}</b></td><td class="r num"><b>${cop(Math.abs(ivaNeto))}</b></td></tr></tbody></table></div></div>
    <div class="fin-card"><div class="fin-card-h"><h3>Retenciones</h3></div><div class="tbl-wrap"><table class="sin-busca"><tbody>
      ${fila("Retención en la fuente que nos practicaron",mapa("rete"),rfN.d-rfN.c,"Anticipo de renta")}${fila("ReteIVA que nos practicaron",mapa("reteiva"),rivaN.d-rivaN.c)}${fila("ReteICA que nos practicaron",mapa("reteica"),ricaN.d-ricaN.c)}
      ${fila("Retención en la fuente que practicamos","2365",rfP.c-rfP.d,"Por pagar a la DIAN")}${fila("ReteIVA que practicamos",mapa("rivaPagar"),rivaP.c-rivaP.d)}${fila("ReteICA que practicamos",mapa("ricaPagar"),ricaP.c-ricaP.d,"Por pagar al municipio")}</tbody></table></div></div></div>`;
}
function retencionesPracticadas(anio){const R={};for(const e of store.egresos){if(S_(e.f).slice(0,4)!==anio||!(+e.rf||+e.rica||+e.riva))continue;const k=normNom(e.tercero)||"sin";const x=(R[k] ||= {ter:e.tercero||"Sin tercero",base:0,rf:0,riva:0,rica:0,iva:0,n:0});x.base+=(+e.valor||0)-(+e.ivaDesc||0);x.iva+=+e.ivaDesc||0;x.rf+=+e.rf||0;x.riva+=+e.riva||0;x.rica+=+e.rica||0;x.n++}return Object.values(R).sort((a,b)=>a.ter.localeCompare(b.ter,"es"))}
function certificados(){const anio=impP.anio||hoy().slice(0,4),R=retencionesPracticadas(anio);
  return `<div class="fp-filtros"><label>Año gravable<select data-fpimp="anio">${[...new Set([hoy().slice(0,4),...store.egresos.map(e=>S_(e.f).slice(0,4))])].filter(Boolean).sort().reverse().map(a=>`<option ${a===anio?"selected":""}>${a}</option>`).join("")}</select></label></div>
  ${trib().agente?"":`<div class="fp-alerta info">TEKALUM no es agente de retención, así que no practica retenciones ni expide certificados. Cuando lo sea (Configuración › Empresa y tributario), cada retención que registres en las facturas de compra aparecerá aquí con su certificado.</div>`}
  ${R.length?`<div class="tbl-wrap"><table class="fp-tabla sin-busca"><thead><tr><th>Tercero</th><th class="r">Base</th><th class="r">Retención fuente</th><th class="r">ReteIVA</th><th class="r">ReteICA</th><th></th></tr></thead><tbody>${R.map((x,i)=>`<tr><td>${esc(x.ter)}<div class="who">${x.n} documento(s)</div></td><td class="r num">${cop(x.base)}</td><td class="r num">${cop(x.rf)}</td><td class="r num">${cop(x.riva)}</td><td class="r num">${cop(x.rica)}</td><td class="r"><button class="btn small" data-fp="cert-ver" data-i="${i}" data-anio="${anio}">Certificado</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="fp-vacio">No hay retenciones practicadas en ${anio}.</div>`}`}
function imprimirCert(x,anio){const T=trib(),t=terceroDe(x.ter)||{},w=window.open("","_blank");if(!w)return toast("Permite las ventanas emergentes");
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Certificado de retención ${esc(x.ter)} ${anio}</title><style>body{font:13px system-ui,sans-serif;max-width:720px;margin:30px auto;padding:0 18px}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #ccd;padding:7px;text-align:left}.r{text-align:right}</style>
  ${T.logo?`<img src="${T.logo}" alt="" style="max-height:56px;max-width:180px">`:""}<h1>Certificado de retenciones · año gravable ${anio}</h1><p><b>Retenedor:</b> ${esc(T.razon||precios.empresa?.nombre||"TEKALUM")} · ${esc(T.tipoDoc)} ${esc(T.doc)}${T.dv?"-"+esc(T.dv):""} · ${esc(T.ciudad)}</p><p><b>Retenido:</b> ${esc(x.ter)}${t.doc?" · "+esc(t.tipoDoc||"")+" "+esc(t.doc):""}</p>
  <table><thead><tr><th>Concepto</th><th class="r">Base</th><th class="r">Valor retenido</th></tr></thead><tbody><tr><td>Retención en la fuente a título de renta</td><td class="r">${cop(x.base)}</td><td class="r">${cop(x.rf)}</td></tr>${x.riva?`<tr><td>Retención de IVA</td><td class="r">${cop(x.iva)}</td><td class="r">${cop(x.riva)}</td></tr>`:""}${x.rica?`<tr><td>Retención de industria y comercio (${esc(T.ciudad)})</td><td class="r">${cop(x.base)}</td><td class="r">${cop(x.rica)}</td></tr>`:""}</tbody></table>
  <p style="margin-top:16px">Valores consignados oportunamente a la DIAN${x.rica?" y al municipio":""}. Expedido el ${fechaCorta(hoy())}.</p><script>print()<\/script>`);w.document.close()}

/* ======================= Configuración ======================= */
let cfgD=null,cfgVista="",resD=null;
const cfgIni=(k,fn)=>{if(cfgVista!==k||!cfgD){cfgVista=k;cfgD=fn()}return cfgD};
function vCfgEmpresa(){
  const d=cfgIni("empresa",()=>clone(trib())),dv=d.tipoDoc==="NIT"?dvNit(d.doc):"",falt=faltanEmpresa(d);
  const inp=(k,t,x="")=>`<label class="f">${t}<input data-fpc="${k}" value="${esc(d[k]??"")}" ${x}></label>`;
  return `${cab("Configuración","Empresa y situación tributaria","Estos datos salen en las cuentas de cobro, en las facturas electrónicas, en los certificados y en la exógena. Lo que digas aquí decide cómo se tratan el IVA y las retenciones.",`<button class="btn primary" data-fp="cfg-empresa-guardar">Guardar cambios</button>`)}
  <div class="fp-cfg"><h2>Identificación</h2><p>Mientras TEKALUM no tenga RUT propio, deja el documento en blanco; el sistema sigue funcionando.</p><div class="fp-grid">
    ${inp("comercial","Nombre comercial")}${inp("razon","Nombre o razón social (como en el RUT)")}
    <label class="f">Tipo de persona<select data-fpc="persona"><option value="natural" ${d.persona==="natural"?"selected":""}>Persona natural</option><option value="juridica" ${d.persona==="juridica"?"selected":""}>Persona jurídica (S.A.S.)</option></select></label>
    <label class="f">Tipo de documento<select data-fpc="tipoDoc">${TIPOS_DOC.filter(x=>["CC","NIT","CE"].includes(x[0])).map(([k,t])=>`<option value="${k}" ${d.tipoDoc===k?"selected":""}>${t}</option>`).join("")}</select></label>
    ${inp("doc","Número de documento","inputmode=numeric")}<label class="f">Dígito de verificación<input data-fpc="dv" value="${esc(d.dv||dv)}" maxlength="1" inputmode="numeric">${dv&&d.dv&&d.dv!==dv?`<small style="color:var(--bad)">Según la DIAN debería ser ${dv}</small>`:dv?`<small class="who">Calculado: ${dv}</small>`:""}</label>
    ${inp("dir","Dirección")}<label class="f">Municipio<select data-fpc="mpio">${Object.entries(DANE).map(([n,c])=>`<option value="${c[1]}" ${d.mpio===c[1]?"selected":""}>${esc(n.replace(/\b\w/g,m=>m.toUpperCase()))} · ${c[1]}</option>`).join("")}</select></label>
    ${inp("tel","Teléfono")}${inp("email","Correo para facturación","type=email")}${inp("ciiu","Actividad económica (CIIU)","placeholder='Ej. 2511' inputmode=numeric")}</div></div>
  <div class="fp-cfg"><h2>Situación tributaria</h2><p>Decide qué impuestos aplica el sistema. Confírmala con Oswaldo antes de cambiarla.</p>
    <div class="fp-sw"><div style="flex:1"><b>IVA</b><small>No responsable: las ventas no llevan IVA y el IVA de las compras se suma al costo. Responsable: se cobra IVA y el de las compras se descuenta.</small></div><select data-fpc="iva"><option value="no_responsable" ${d.iva!=="responsable"?"selected":""}>No responsable de IVA</option><option value="responsable" ${d.iva==="responsable"?"selected":""}>Responsable de IVA</option></select></div>
    <div class="fp-sw"><div style="flex:1"><b>Régimen</b><small>Régimen simple: no practica ReteFuente ni ReteICA.</small></div><select data-fpc="regimen"><option value="ordinario" ${d.regimen!=="simple"?"selected":""}>Ordinario</option><option value="simple" ${d.regimen==="simple"?"selected":""}>Régimen simple de tributación</option></select></div>
    <label class="fp-sw"><input type="checkbox" data-fpc="agente" ${d.agente?"checked":""}><div><b>Agente de retención</b><small>Si está activo, en las facturas de compra aparece el botón para practicar retenciones y salen los certificados.</small></div></label>
    <label class="fp-sw"><input type="checkbox" data-fpc="autorret" ${d.autorret?"checked":""}><div><b>Autorretenedor</b><small>Los clientes no le practican retención; se la hace uno mismo.</small></div></label>
    <fieldset class="f" style="border:0;padding:0;margin:10px 0 0"><legend style="font-size:13px;color:var(--muted)">Responsabilidades fiscales del RUT (casilla 53)</legend><div class="row" style="gap:10px;flex-wrap:wrap">${RESP_FISCAL.map(([k,t])=>`<label class="chk"><input type="checkbox" data-fpcr="${k}" ${(d.resp||[]).includes(k)?"checked":""}> ${k} · ${esc(t)}</label>`).join("")}</div></fieldset>
    <div class="fp-grid" style="margin-top:10px"><label class="f">Valor de la UVT<input data-fpc="uvt" value="${esc(d.uvt)}" inputmode="numeric"><small class="who">UVT ${esc(d.uvtAnio)}. Confírmala cada año.</small></label><label class="f">Año de la UVT<input data-fpc="uvtAnio" value="${esc(d.uvtAnio)}" inputmode="numeric"></label></div></div>
  ${typeof extraEmpresa==="function"?extraEmpresa():""}
  <div class="fp-cfg"><h2>Facturación electrónica</h2><p>${feOn()?"Activa.":"Apagada. Se enciende en Configuración › Facturación electrónica cuando termines la habilitación."} ${falt.length&&!feOn()?"Para poder encenderla faltan: "+falt.join(", ")+".":""}</p><button class="btn" data-fin="dian">Ir a Facturación electrónica</button></div>`;
}
function faltanEmpresa(d=trib()){const f=[];if(!S_(d.razon).trim())f.push("razón social");if(!S_(d.doc).trim())f.push("NIT o cédula");if(d.tipoDoc==="NIT"&&!S_(d.dv||"").trim())f.push("dígito de verificación");if(!S_(d.dir).trim())f.push("dirección");if(!S_(d.email).trim())f.push("correo");if(!(d.resp||[]).length)f.push("responsabilidades fiscales");return f}
function vCfgImpuestos(){
  const L=cfgIni("imp",()=>clone(imps()));
  return `${cab("Configuración","Impuestos y retenciones","Catálogo de impuestos colombianos con su tarifa, la base mínima en UVT y las cuentas donde se registran.",`<button class="btn ghost" data-fp="imp-reset">Restablecer catálogo</button><button class="btn primary" data-fp="imp-guardar">Guardar</button>`)}
  ${CONT.impConfirmado?`<div class="fp-alerta ok">Tarifas confirmadas por ${esc(CONT.impConfirmado.por||"el contador")} el ${fechaCorta(CONT.impConfirmado.f)}.</div>`:`<div class="fp-alerta">Tarifas y bases tomadas de la norma vigente a noviembre de 2026 (UVT ${esc(trib().uvt)}). <b>Oswaldo debe confirmarlas</b> antes de usarlas en documentos reales. <button class="btn small" data-fp="imp-confirmar">Las revisé y están bien</button></div>`}
  <div class="fp-cfg" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap"><label class="f">Nuevo impuesto<select id="fp-impnuevo">${Object.entries(TIPO_IMP).map(([k,t])=>`<option value="${k}">${t}</option>`).join("")}</select></label><button class="btn" data-fp="imp-nuevo">+ Agregar impuesto</button></div>
  ${["iva","inc","rf","riva","rica","ica","autorret"].map(tp=>`<div class="fp-cfg"><h2>${TIPO_IMP[tp]}</h2><p>${IMP_AYUDA[tp]||""}</p><div class="tbl-wrap"><table class="sin-busca"><thead><tr><th>Nombre</th><th style="width:11%">Tarifa ${tp==="rica"||tp==="ica"?"(por mil)":"(%)"}</th>${tp==="iva"?"":`<th style="width:12%">Base mínima (UVT)</th>`}<th style="width:14%">Cuenta en compras</th><th style="width:14%">Cuenta en ventas</th><th style="width:7%">Activo</th></tr></thead><tbody>
    ${L.map((x,i)=>x.tipo!==tp?"":`<tr><td><input data-fpimpc="${i}|nombre" value="${esc(x.nombre)}"></td><td><input class="num-in" data-fpimpc="${i}|tarifa" value="${esc(x.tarifa)}" inputmode="decimal"></td>${tp==="iva"?"":`<td><input class="num-in" data-fpimpc="${i}|baseUVT" value="${esc(x.baseUVT??0)}" inputmode="decimal"><div class="who">${cop((+x.baseUVT||0)*(+trib().uvt||0))}</div></td>`}
      <td><input data-fpimpc="${i}|ctaC" value="${esc(x.ctaC||"")}" inputmode="numeric"><div class="who">${esc(nomCta(x.ctaC||""))}</div></td><td><input data-fpimpc="${i}|ctaV" value="${esc(x.ctaV||"")}" inputmode="numeric"><div class="who">${esc(nomCta(x.ctaV||""))}</div></td><td><input type="checkbox" data-fpimpc="${i}|activo" ${x.activo!==false?"checked":""}></td></tr>`).join("")}</tbody></table></div></div>`).join("")}
  <div class="fp-cfg"><h2>Cómo se usan</h2><p style="margin:0">IVA: en las facturas de venta (si es responsable) y como descontable en las compras. Retenciones: las que nos practican los clientes van en la factura de venta; las que practicamos (si somos agentes) van en la factura de compra. ReteICA: tarifa por mil según el municipio y la actividad.</p></div>`;
}
function vCfgPagos(){
  const d=cfgIni("pagos",()=>({medios:{...(CONT.medios||{})},plazos:plazos().join(", "),fpVenta:CONT.fpVenta||"",fpCompra:CONT.fpCompra||""}));
  return `${cab("Configuración","Formas de pago","De contado, el dinero entra o sale de una cuenta (caja, banco, Nequi). A crédito, el documento queda como cuenta por cobrar o por pagar con su vencimiento.",`<button class="btn primary" data-fp="pagos-guardar">Guardar</button>`)}
  <div class="fp-cfg"><h2>Cuentas de dinero (contado)</h2><p>El medio de pago es el código que pide la DIAN en la factura electrónica.</p>${cuentasActivas().length?`<div class="tbl-wrap"><table class="sin-busca"><thead><tr><th>Cuenta</th><th>Cuenta contable</th><th>Medio de pago (DIAN)</th></tr></thead><tbody>${cuentasActivas().map(c=>`<tr><td><b>${esc(nombreCuenta(c.id))}</b></td><td>${celdaCta(ctaDinero(c.id))}</td><td><select data-fpcm="${esc(c.id)}">${MEDIOS.map(([k,t])=>`<option value="${k}" ${(d.medios[c.id]||medioDe(c.id))===k?"selected":""}>${k} · ${t}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>`:`<p class="who">No hay cuentas. Créalas en Cajas y bancos.</p>`}<button class="btn small" data-fin="cuentas" style="margin-top:8px">Administrar cuentas</button></div>
  <div class="fp-cfg"><h2>Plazos de crédito</h2><p>Días que se ofrecen al vender o comprar a crédito, separados por coma.</p><label class="f" style="max-width:320px">Plazos (días)<input data-fpcp="plazos" value="${esc(d.plazos)}" placeholder="15, 30, 60"></label></div>
  <div class="fp-cfg"><h2>Formas de pago por defecto</h2><p>Se proponen al crear un documento nuevo.</p><div class="fp-grid"><label class="f">En ventas<select data-fpcp="fpVenta">${opcForma(d.fpVenta||formaDef("venta"))}</select></label><label class="f">En compras<select data-fpcp="fpCompra">${opcForma(d.fpCompra||formaDef("compra"))}</select></label></div></div>`;
}
function vCfgNum(){
  const N=numCfg(),d=cfgIni("num",()=>clone(N));
  return `${cab("Configuración","Comprobantes y numeración","Cada documento lleva su prefijo y su consecutivo. Las facturas electrónicas toman el número de la resolución de la DIAN.",`<button class="btn primary" data-fp="num-guardar">Guardar</button>`)}
  <div class="fp-cfg"><h2>Documentos con numeración propia</h2><p>El número se asigna al contabilizar y no cambia nunca.</p><div class="tbl-wrap"><table class="sin-busca"><thead><tr><th>Documento</th><th style="width:16%">Prefijo</th><th style="width:16%">Siguiente número</th><th>Próximo</th></tr></thead><tbody>
    ${Object.entries(d).map(([k,x])=>`<tr><td><b>${esc(x.nom)}</b>${k==="FV"&&resolVigente("FV")?`<div class="who">Con la facturación activa usa la resolución ${esc(resolVigente("FV").numero)}</div>`:""}</td><td><input data-fpnum="${k}|pref" value="${esc(x.pref)}"></td><td><input class="num-in" data-fpnum="${k}|sig" value="${esc(x.sig)}" inputmode="numeric"></td><td class="num">${esc(x.pref)}-${String(+x.sig||1).padStart(4,"0")}</td></tr>`).join("")}</tbody></table></div></div>
  ${typeof extraNum==="function"?extraNum():""}
  <div class="fp-cfg"><h2>Comprobantes contables automáticos</h2><p>Se numeran solos, por tipo y en orden de fecha.</p><div class="tbl-wrap"><table class="sin-busca"><thead><tr><th>Código</th><th>Comprobante</th><th class="r">Usados</th></tr></thead><tbody>${(()=>{const A=asientosTodos(),n={};for(const a of A)n[a.tipo]=(n[a.tipo]||0)+1;return Object.entries(TIPOS_COMP).map(([k,t])=>`<tr><td class="num"><b>${k}</b></td><td>${esc(t)}</td><td class="r num">${n[k]||0}</td></tr>`).join("")})()}</tbody></table></div></div>`;
}
let feT="hab";
function vFE(){
  const T=trib(),falt=faltanEmpresa(),r=resolVigente("FV"),fe=CONT.fe||{},S=CONT.dian||{},pasos=PASOS_DIAN.filter(([k])=>S[k]).length;
  const terc=tercerosTodos().filter(t=>t.tipos?.has?.("cliente")),malos=terc.filter(t=>!t.doc||!t.email||!(t.mpio||daneDe(t.ciudad))||((t.tipoDoc==="NIT")&&!t.dv));
  const listo=!falt.length&&!!r&&!!fe.proveedor;
  const tabs=`<div class="fp-tabs">${[["hab","Habilitación"],["res","Resoluciones"],["prov","Proveedor y certificado"],["datos","Datos que faltan"]].map(([k,t])=>`<button data-fp="fe-tab" data-t="${k}" ${feT===k?'aria-current="page"':""}>${t}</button>`).join("")}</div>`;
  const sw=`<div class="fp-cfg" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><h2 style="margin:0">Facturación electrónica ${feOn()?'<span class="pill st-aprobada">Activa</span>':'<span class="pill st-borrador">Apagada</span>'}</h2><p style="margin:4px 0 0">${feOn()?"Las ventas salen como factura electrónica con la numeración de la resolución.":listo?"Todo está listo para encenderla.":"Se puede encender cuando estén: datos de la empresa, resolución vigente y proveedor tecnológico."}</p></div>
    <button class="btn ${feOn()?"":"primary"}" data-fp="fe-switch" ${feOn()||listo?"":"disabled"}>${feOn()?"Apagar":"Encender"}</button></div>`;
  let body="";
  if(feT==="hab")body=`<div class="grid2"><div class="fin-card"><div class="fin-card-h"><h3>Trámites ante la DIAN (${pasos} de ${PASOS_DIAN.length})</h3></div><ol class="fin-pasos">${PASOS_DIAN.map(([k,t,n])=>`<li class="${S[k]?"hecho":""}"><label class="chk"><input type="checkbox" data-dian="${k}" ${S[k]?"checked":""}> <b>${esc(t)}</b></label><small>${esc(n)}</small></li>`).join("")}</ol></div>
    <div class="fin-card"><div class="fin-card-h"><h3>Qué tiene listo el sistema</h3></div><ul class="fin-listo">${[["Facturas de venta con numeración, impuestos, retenciones y asiento",true],["Notas crédito y débito ligadas a la factura, con los motivos de la DIAN",true],["Documento soporte para compras a quien no factura",true],["Datos de cada factura en el formato que pide la DIAN (ver en cada factura)",true],["Acuse de recibo de facturas de compra (030, 032, 033)",true],["Resolución de numeración vigente",!!r],["Proveedor tecnológico configurado",!!fe.proveedor],["Datos completos de la empresa",!falt.length]].map(([t,ok])=>`<li class="${ok?"ok":""}">${finIco(ok?"M5 12l5 5L20 7":"M12 8v5M12 16h.01",16)}<div><b>${esc(t)}</b></div></li>`).join("")}</ul></div></div>`;
  if(feT==="res")body=`<div class="fp-cfg"><div class="row" style="justify-content:space-between"><div><h2>Resoluciones de numeración</h2><p>La DIAN autoriza un prefijo y un rango de números con vigencia. Una resolución activa por tipo de documento.</p></div><button class="btn primary" data-fp="res-nueva">+ Nueva resolución</button></div>
    ${resols().length?`<div class="tbl-wrap"><table class="fp-tabla sin-busca"><thead><tr><th>Documento</th><th>Resolución</th><th>Prefijo</th><th>Rango</th><th>Vigente hasta</th><th>Siguiente</th><th>Estado</th><th></th></tr></thead><tbody>${resols().map(x=>{const vig=(!x.vigHasta||hoy()<=x.vigHasta)&&(+x.sig||+x.desde)<=+x.hasta,quedan=+x.hasta-(+x.sig||+x.desde)+1;
      return `<tr><td>${x.tipo==="FV"?"Factura de venta":"Documento soporte"}</td><td class="num">${esc(x.numero)}<div class="who">${x.fecha?fechaCorta(x.fecha):""}</div></td><td class="num"><b>${esc(x.pref)}</b></td><td class="num">${esc(x.desde)} – ${esc(x.hasta)}</td><td class="num">${x.vigHasta?fechaCorta(x.vigHasta):"—"}</td><td class="num">${esc(x.pref)}${+x.sig||+x.desde}<div class="who">quedan ${quedan}</div></td><td><span class="pill ${x.activa===false?"st-borrador":vig?"st-aprobada":"st-perdida"}">${x.activa===false?"Inactiva":vig?"Vigente":"Vencida o agotada"}</span></td><td class="r"><button class="btn small" data-fp="res-editar" data-id="${esc(x.id)}">Editar</button></td></tr>`}).join("")}</tbody></table></div>`:`<div class="fp-vacio">No hay resoluciones. Cuando la DIAN te autorice la numeración, regístrala aquí.</div>`}</div>`;
  if(feT==="prov"){const d=cfgIni("fe",()=>({proveedor:"",ambiente:"pruebas",softId:"",testSet:"",url:"",certVence:"",...fe}));
    body=`<div class="fp-cfg"><h2>Proveedor tecnológico</h2><p>Empresa autorizada por la DIAN que valida y transmite los documentos (o la solución gratuita de la DIAN). Las claves y el certificado se guardan en el servidor como secretos, nunca aquí.</p><div class="fp-grid">
      <label class="f">Proveedor<input data-fpfe="proveedor" value="${esc(d.proveedor)}" placeholder="Nombre del proveedor"></label><label class="f">Ambiente<select data-fpfe="ambiente"><option value="pruebas" ${d.ambiente!=="produccion"?"selected":""}>Habilitación (pruebas)</option><option value="produccion" ${d.ambiente==="produccion"?"selected":""}>Producción</option></select></label>
      <label class="f">Identificador del software<input data-fpfe="softId" value="${esc(d.softId)}"></label><label class="f">TestSetId de la DIAN<input data-fpfe="testSet" value="${esc(d.testSet)}"></label>
      <label class="f full">Dirección del servicio (URL de la API)<input data-fpfe="url" value="${esc(d.url)}" placeholder="https://"></label><label class="f">Certificado de firma: vence<input type="date" data-fpfe="certVence" value="${esc(d.certVence)}"></label></div>
      <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn primary" data-fp="fe-guardar">Guardar</button></div></div>`}
  if(feT==="datos")body=`<div class="fp-cfg"><h2>Empresa</h2>${falt.length?`<p>Faltan: <b>${esc(falt.join(", "))}</b>.</p><button class="btn" data-fin="cfgempresa">Completar</button>`:`<p class="fp-ok">Completos.</p>`}</div>
    <div class="fp-cfg"><h2>Clientes</h2><p>Para la factura electrónica cada cliente necesita documento, correo y municipio (y DV si tiene NIT).</p>${malos.length?`<div class="tbl-wrap"><table class="sin-busca"><thead><tr><th>Cliente</th><th>Le falta</th></tr></thead><tbody>${malos.slice(0,60).map(t=>`<tr><td>${esc(t.nombre)}</td><td class="who">${[!t.doc&&"documento",!t.email&&"correo",!(t.mpio||daneDe(t.ciudad))&&"municipio",t.tipoDoc==="NIT"&&!t.dv&&"DV"].filter(Boolean).join(", ")}</td></tr>`).join("")}</tbody></table></div><button class="btn small" data-fin="ctb:terceros" style="margin-top:8px">Completar en Terceros</button>`:`<p class="fp-ok">Todos los clientes tienen sus datos.</p>`}</div>`;
  return cab("Configuración","Facturación electrónica","TEKALUM queda listo para facturar electrónicamente: tú haces la habilitación ante la DIAN y aquí registras la resolución y el proveedor. Al encenderla, las ventas pasan de cuenta de cobro a factura electrónica.")+sw+tabs+body+fpModalHtml();
}
function modalResol(){const d=resD;const inp=(k,t,x="")=>`<label class="f">${t}<input data-fpres="${k}" value="${esc(d[k]??"")}" ${x}></label>`;
  return `<div class="panel ingreso">${modalCab(d.id?"Editar resolución":"Nueva resolución","Datos tal como vienen en la resolución de la DIAN")}<div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
    <label class="f">Documento<select data-fpres="tipo"><option value="FV" ${d.tipo==="FV"?"selected":""}>Factura electrónica de venta</option><option value="DS" ${d.tipo==="DS"?"selected":""}>Documento soporte</option></select></label>
    ${inp("numero","Número de resolución","inputmode=numeric")}${inp("fecha","Fecha","type=date")}${inp("pref","Prefijo","maxlength=4")}${inp("desde","Desde el número","inputmode=numeric")}${inp("hasta","Hasta el número","inputmode=numeric")}${inp("vigHasta","Vigente hasta","type=date")}${d.tipo==="FV"?inp("clave","Clave técnica"):""}
    <label class="chk full"><input type="checkbox" data-fpres="activa" ${d.activa!==false?"checked":""}> Activa</label></div>
    <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fp="res-guardar">Guardar resolución</button></div></div>`}
// datos de la factura en la estructura que piden los proveedores tecnológicos (UBL 2.1 DIAN)
function payloadFE(v){const t=calcVenta(v),T=trib(),c=terceroDe(v.cliente)||{},f=formaDe(v.forma);
  return {tipoDocumento:"01",prefijo:S_(v.num).replace(/\d+$/,""),numero:S_(v.num).match(/\d+$/)?.[0]||"",fechaEmision:v.f,fechaVencimiento:v.venc||v.f,moneda:"COP",
    emisor:{tipoPersona:T.persona==="juridica"?"1":"2",tipoDocumento:DOC_DIAN[T.tipoDoc]||"13",documento:T.doc,dv:T.dv,razonSocial:T.razon,nombreComercial:T.comercial,direccion:T.dir,municipio:T.mpio,correo:T.email,telefono:T.tel,responsabilidades:T.resp,regimenIVA:esResp()?"48":"49",ciiu:T.ciiu},
    adquirente:{tipoDocumento:DOC_DIAN[c.tipoDoc||"CC"]||"13",documento:c.doc||"",dv:c.dv||"",nombre:v.cliente,direccion:c.dir||"",municipio:c.mpio||daneDe(c.ciudad)?.[1]||"",correo:c.email||"",telefono:c.tel||""},
    formaPago:{metodo:f.tipo==="contado"?"1":"2",medio:f.tipo==="contado"?medioDe(f.cuenta):"ZZZ",vence:v.venc||v.f},
    lineas:t.L.map((l,i)=>({n:i+1,descripcion:l.desc,cantidad:+l.cant||0,unidad:l.unidad||"94",precioUnitario:r0(l.pu),descuento:l.dcto,base:l.base,impuestos:l.iva?[{tributo:"01",tarifa:+l.im.tarifa,base:l.base,valor:l.iva}]:[]})),
    totales:{bruto:t.bruto,descuentos:t.dcto,base:t.base,impuestos:t.iva,total:t.total,retenciones:t.ret,aPagar:t.neto},
    retencionesInformadas:t.rets.map(r=>({tributo:{rf:"06",riva:"05",rica:"07"}[r.im.tipo],tarifa:+r.im.tarifa,valor:r.v})),notas:v.notas||""}}

/* ======================= modales comunes ======================= */
let feVer=null,retC=null;
function fpModalHtml(){
  if(finModal==="fpasiento"&&asPrev)return `<div class="panel ingreso">${modalCab("Asiento contable","Así quedará en la contabilidad al contabilizar")}${tablaAsiento(asPrev)}<div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost" data-fm-cerrar="1">Cerrar</button></div></div>`;
  if(finModal==="fppago"&&pagoD){const v=store.ventas.find(x=>x.id===pagoD.id);if(!v)return "";const s=saldoVenta(v);
    return `<div class="panel ingreso">${modalCab("Registrar pago · "+esc(v.num),esc(v.cliente)+" · saldo "+cop(s))}<div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
      <label class="f">Fecha<input type="date" data-fppago="f" value="${esc(pagoD.f)}"></label><label class="f">Entró a<select data-fppago="cuenta">${opcCuentas(pagoD.cuenta)}</select></label><label class="f">Valor recibido<input id="fp-pago-v" data-fppago="valor" value="${esc(pagoD.valor)}" inputmode="numeric"></label><label class="f full">Nota<input data-fppago="nota" value="${esc(pagoD.nota||"")}" placeholder="Ej. transferencia Bancolombia"></label></div>
      <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fp="pago-guardar">Registrar recibo de caja</button></div></div>`}
  if(finModal==="fpnota"&&nDraft)return modalNota();
  if(finModal==="fpresol"&&resD)return modalResol();
  if(finModal==="fpfe"&&feVer){const v=store.ventas.find(x=>x.id===feVer);if(!v)return "";const p=payloadFE(v),fal=[...faltanEmpresa().map(x=>"Empresa: "+x),...(!p.adquirente.documento?["Cliente: documento"]:[]),...(!p.adquirente.correo?["Cliente: correo"]:[]),...(!p.adquirente.municipio?["Cliente: municipio"]:[])];
    return `<div class="panel ingreso">${modalCab("Datos para la DIAN · "+esc(v.num),"Lo que se enviará al proveedor tecnológico")}${fal.length?`<div class="fp-alerta">Faltan datos: ${esc(fal.join(", "))}.</div>`:`<div class="fp-alerta ok">Datos completos.</div>`}<pre style="white-space:pre-wrap;font-size:11.5px;background:#f5f7fa;border-radius:8px;padding:10px;max-height:52vh;overflow:auto">${esc(JSON.stringify(p,null,2))}</pre><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-fm-cerrar="1">Cerrar</button></div></div>`}
  if(finModal==="fpret"&&retC){const e=store.egresos.find(x=>x.id===retC.id);if(!e)return "";const base=(+e.valor||0)-(+e.ivaDesc||0);
    return `<div class="panel ingreso">${modalCab("Retenciones practicadas",esc(e.tercero||"")+" · base "+cop(base))}<div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      <label class="f">Retención en la fuente<select data-fpret="rfImp">${opcImp(retC.rfImp,["rf"])}</select></label><label class="f">Valor<input data-fpret="rf" value="${esc(retC.rf)}" inputmode="numeric"></label>
      <label class="f">ReteIVA<select data-fpret="rivaImp">${opcImp(retC.rivaImp,["riva"])}</select></label><label class="f">Valor<input data-fpret="riva" value="${esc(retC.riva)}" inputmode="numeric"></label>
      <label class="f">ReteICA<select data-fpret="ricaImp">${opcImp(retC.ricaImp,["rica"])}</select></label><label class="f">Valor<input data-fpret="rica" value="${esc(retC.rica)}" inputmode="numeric"></label></div>
      <p class="who">Al elegir una retención el valor se calcula solo (puedes cambiarlo). Si la base es menor a la mínima, el valor sugerido es cero.</p>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fp="ret-guardar">Guardar retenciones</button></div></div>`}
  return "";
}

/* ======================= registro de vistas ======================= */
Object.assign(FINX,{ventas:vVentas,notasv:()=>vNotas("venta"),notasc:()=>vNotas("compra"),soporte:vSoporte,acuse:vAcuse,impuestos:vImpuestos,cfgempresa:vCfgEmpresa,cfgimpuestos:vCfgImpuestos,cfgpagos:vCfgPagos,cfgnum:vCfgNum,dian:vFE});
for(const k of Object.keys(FINX))if(!finVistas.includes(k))finVistas.push(k);

/* ======================= acciones ======================= */
const rerender=el=>{const id=el?.id,p=el?.selectionStart;render();if(id){const x=document.getElementById(id);if(x){x.focus();try{x.setSelectionRange(p,p)}catch{}}}};
function validarVenta(v,contab){const t=calcVenta(v);if(!S_(v.cliente).trim())throw {msg:"Escribe el cliente"};if(!t.L.some(l=>l.base>0&&S_(l.desc).trim()))throw {msg:"Agrega al menos una línea con descripción y precio"};
  if(t.L.some(l=>l.base<0))throw {msg:"Hay una línea con valor negativo"};if(contab&&mesCerrado(v.f))throw {msg:mesLargo(S_(v.f).slice(0,7))+" está cerrado en Contabilidad."};
  if(contab&&feOn()){const c=terceroDe(v.cliente)||{};const f=[!c.doc&&"documento",!c.email&&"correo"].filter(Boolean);if(f.length)throw {msg:"Para la factura electrónica, al cliente le falta: "+f.join(", ")+". Complétalo en Terceros."}}
  return t}
async function guardarVenta(contab){
  const v=clone(vDraft),f=formaDe(v.forma),t=validarVenta(v,contab);
  v.venc=f.tipo==="credito"?(v.venc||sumaDias(v.f,f.dias)):"";v.lineas=v.lineas.filter(l=>S_(l.desc).trim()||+l.pu);v.ret=(v.ret||[]).filter(r=>r.imp);
  v.totales={base:t.base,iva:t.iva,total:t.total,ret:t.ret,neto:t.neto};
  if(contab){v.conIva=esResp();v.lineas=v.lineas.map(l=>{const x=t.L.find(y=>y===l)||t.L[v.lineas.indexOf(l)];const im=v.conIva?impDe(l.imp):null;return {...l,ivaT:im&&im.tipo==="iva"?+im.tarifa:0,impNom:im?.nombre||""}});v.ret=t.rets.map(r=>({imp:r.imp,valor:r.v,nom:r.im.nombre,tipoR:r.im.tipo}));v.tipoDoc=feOn()?"FV":"CB";const n=await tomarNumero(v.tipoDoc,v.f);v.num=n.num;if(n.resol)v.resol=n.resol;v.estado="contabilizada";v.fe={estado:v.tipoDoc==="FV"?"pendiente":"no"};v.fContab=new Date().toISOString();v.contabPor=yo()}
  else v.estado="borrador";
  const id=await guardarDoc("ventas",v.id||null,v);
  if(contab&&f.tipo==="contado"){const sv=saldoVenta(store.ventas.find(x=>x.id===id)||{...v,id});if(sv>0)await guardarDoc("ingresos",null,abonoDe({...v,id},sv,v.f,f.cuenta,"Pago de contado"));if(v.cotId&&sv<t.neto)toast("Se descontaron los anticipos de la obra: el pago de contado es "+cop(Math.max(0,sv)))}
  vDraft=null;vVer=id;toast(contab?nomDocV(v)+" "+v.num+" contabilizada":"Borrador guardado");render();scrollTo(0,0);return id}
function abonoDe(v,valor,f,cuenta,nota){return v.cotId?{f,tipo:"saldo",cuenta,valor:r0(valor),cotId:v.cotId,cliente:v.cliente,concepto:"Pago "+v.num,nota:nota||"",ventaId:v.id,cobrado:true,causado:false,rete:0,reteica:0,puc:mapa("cxc"),creado:new Date().toISOString(),por:myId||null}
  :{f,tipo:"abonofv",cuenta,valor:r0(valor),cotId:"",cliente:v.cliente,concepto:"Pago "+v.num,nota:nota||"",ventaId:v.id,ventaRef:refVenta(v),cobrado:true,causado:false,rete:0,reteica:0,puc:mapa("cxc"),creado:new Date().toISOString(),por:myId||null}}
async function guardarNota(contab){
  const n=clone(nDraft),t=calcNota(n);if(!n.ref)throw {msg:"Elige el documento al que se le hace la nota"};if(!(t.total>0))throw {msg:"Escribe el valor de la nota"};
  if(contab&&mesCerrado(n.f))throw {msg:mesLargo(S_(n.f).slice(0,7))+" está cerrado en Contabilidad."};
  if(n.tipo==="NCV"){const v=store.ventas.find(x=>x.id===n.ref);const max=calcVenta(v).total-notasDe(v).filter(x=>x.tipo==="NCV"&&x.id!==n.id).reduce((s,x)=>s+calcNota(x).total,0)+notasDe(v).filter(x=>x.tipo==="NDV").reduce((s,x)=>s+calcNota(x).total,0);if(t.total>max)throw {msg:"La nota crédito no puede ser mayor que lo facturado ("+cop(max)+")"}}
  n.lineas=n.lineas.filter(l=>+l.base).map(l=>esNotaVenta(n)?{...l,ivaT:l.ivaT!=null?l.ivaT:(impDe(l.imp)?.tipo==="iva"?+impDe(l.imp).tarifa:0)}:l);n.totales={base:t.base,iva:t.iva,total:t.total};
  if(contab){const num=await tomarNumero(n.tipo,n.f);n.num=num.num;n.estado="contabilizada";n.fContab=new Date().toISOString();n.contabPor=yo()}
  await guardarDoc("notasdoc",n.id||null,n);nDraft=null;finModal=null;toast(contab?TIPOS_COMP[n.tipo]+" "+n.num+" contabilizada":"Borrador guardado");render()}

document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-fp],[data-fpro]");if(!b)return;const d=b.dataset,a=d.fp||d.fpro;if(d.fpro)tbMenu="";
  try{
    switch(a){
      case "venta-nueva":if(!SOLO_FIN){irFin("ventas");return}vVer=null;vDraft=nuevaVenta();if(vista!=="ventas"){vista="ventas"}render();scrollTo(0,0);setTimeout(()=>$("#fp-cli")?.focus(),40);return;
      case "venta-cerrar":vDraft=null;vVer=null;render();scrollTo(0,0);return;
      case "venta-ver":vVer=d.id;render();scrollTo(0,0);return;
      case "venta-editar":{const v=store.ventas.find(x=>x.id===d.id);if(!v)return;vDraft=clone(v);vVer=null;render();scrollTo(0,0);return}
      case "venta-borrar":{const v=store.ventas.find(x=>x.id===d.id);if(!v||v.estado!=="borrador"||!confirm("¿Borrar este borrador?"))return;await borrarDoc("ventas",v.id);vVer=null;toast("Borrador borrado");render();return}
      case "venta-borrador":await guardarVenta(false);return;
      case "venta-contab":if(!confirm(`¿Contabilizar? Se le asigna número y ya no se puede editar (los cambios se hacen con notas crédito o débito).`))return;await guardarVenta(true);return;
      case "venta-imprimir":{const v=store.ventas.find(x=>x.id===d.id);if(v)imprimirVenta(v);return}
      case "venta-anular":{const v=store.ventas.find(x=>x.id===d.id);if(!v)return;if(mesCerrado(v.f))throw {msg:"El mes está cerrado en Contabilidad."};if(!confirm(`¿Anular ${v.num}? Se quita de la contabilidad y el número queda anulado.`))return;await guardarDoc("ventas",v.id,{...v,estado:"anulada",anuladaF:new Date().toISOString(),anuladaPor:yo()});toast("Documento anulado");render();return}
      case "linea-mas":vDraft.lineas.push({cta:vDraft.lineas.at(-1)?.cta||"4120",desc:"",cant:1,pu:"",dcto:"",imp:vDraft.lineas.at(-1)?.imp||""});render();return;
      case "linea-quitar":vDraft.lineas.splice(+d.i,1);render();return;
      case "ret-mas":(vDraft.ret ||= []).push({imp:"",valor:""});render();return;
      case "ret-quitar":vDraft.ret.splice(+d.i,1);render();return;
      case "asiento-venta":{const v=vDraft;asPrev=lineasVenta(v);finModal="fpasiento";render();return}
      case "pago-nuevo":{const v=store.ventas.find(x=>x.id===d.id);pagoD={id:v.id,f:hoy(),cuenta:cuentasActivas()[0]?.id||"",valor:String(Math.max(0,saldoVenta(v))),nota:""};finModal="fppago";render();setTimeout(()=>$("#fp-pago-v")?.focus(),40);return}
      case "pago-guardar":{const v=store.ventas.find(x=>x.id===pagoD.id),val=r0(pagoD.valor);if(!(val>0))throw {msg:"Escribe el valor recibido"};if(store.cuentas.length&&!pagoD.cuenta)throw {msg:"Elige a qué cuenta entró"};if(val>saldoVenta(v)&&!confirm("El valor es mayor que el saldo. ¿Registrar de todas formas (queda saldo a favor del cliente)?"))return;
        await guardarDoc("ingresos",null,abonoDe(v,val,pagoD.f,pagoD.cuenta,pagoD.nota));pagoD=null;finModal=null;toast("Recibo de caja registrado");render();return}
      case "nota-nueva":{const t=d.t||"NCV";if(!SOLO_FIN){irFin(esNotaVenta({tipo:t})?"notasv":"notasc");return}if(vista!=="notasv"&&vista!=="notasc")vista=esNotaVenta({tipo:t})?"notasv":"notasc";nDraft=nuevaNota(t);finModal="fpnota";render();return}
      case "nota-de":{nDraft=nuevaNota(d.t,d.id);finModal="fpnota";render();return}
      case "nota-abrir":{const n=store.notasdoc.find(x=>x.id===d.id);if(!n)return;nDraft=clone(n);finModal="fpnota";render();return}
      case "nota-todo":{const v=store.ventas.find(x=>x.id===nDraft.ref);if(!v)return;const t=calcVenta(v);nDraft.motivo="2";nDraft.lineas=t.L.filter(l=>l.base).map(l=>({desc:l.desc,base:String(l.base),imp:l.im?.id||"",iva:""}));render();return}
      case "nl-mas":nDraft.lineas.push({desc:"",base:"",imp:nDraft.lineas.at(-1)?.imp||"",iva:""});render();return;
      case "nl-quitar":nDraft.lineas.splice(+d.i,1);render();return;
      case "nota-guardar":if(d.c==="1"&&!confirm("¿Contabilizar la nota? Se le asigna número y no se puede editar."))return;await guardarNota(d.c==="1");return;
      case "nota-borrar":{if(!nDraft?.id||nDraft.estado!=="borrador"||!confirm("¿Borrar este borrador?"))return;await borrarDoc("notasdoc",nDraft.id);nDraft=null;finModal=null;render();return}
      case "nota-imprimir":{const n=nDraft,t=calcNota(n),w=window.open("","_blank");if(!w)return;w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(n.num)}</title><style>body{font:13px system-ui;max-width:720px;margin:30px auto}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:6px}.r{text-align:right}</style><h2>${esc(TIPOS_COMP[n.tipo])} ${esc(n.num)}</h2><p>${esc(refTxt(n))} · ${fechaCorta(n.f)}<br>Motivo: ${esc(motivoTxt(n))}${n.desc?" · "+esc(n.desc):""}</p><table>${t.L.map(l=>`<tr><td>${esc(l.desc)}</td><td class="r">${cop(l.base)}</td><td class="r">${l.iva?cop(l.iva):""}</td></tr>`).join("")}<tr><td><b>Total</b></td><td></td><td class="r"><b>${cop(t.total)}</b></td></tr></table><script>print()<\/script>`);w.document.close();return}
      case "ds-nuevo":if(typeof egNuevo==="function"){egDraft={...egNuevo(),ds:true}}irFin("egresos","egreso");return;
      case "ds-ver":verDocSoporte(d.id);return;
      case "acuse-enviar":toast("La conexión con el proveedor tecnológico se activa al terminar la habilitación");return;
      case "imp-tab":impT=d.t;render();return;
      case "cert-ver":{const R=retencionesPracticadas(d.anio);if(R[+d.i])imprimirCert(R[+d.i],d.anio);return}
      case "cfg-empresa-guardar":{const x=cfgD;if(x.tipoDoc==="NIT"&&x.doc&&!x.dv)x.dv=dvNit(x.doc);x.uvt=r0(x.uvt)||TRIB_DEF.uvt;
        if(trib().iva!==x.iva&&!confirm(x.iva==="responsable"?"¿Pasar a responsable de IVA? Desde ahora las ventas podrán llevar IVA y el IVA de las compras nuevas quedará como descontable.":"¿Pasar a no responsable de IVA? Las ventas nuevas ya no llevarán IVA."))return;
        const {logo:_l,ica:_i,...resto}=x;CONT.trib={...trib(),...resto};cfgD=null;render();await guardarCont("Datos de la empresa guardados");return}
      case "imp-guardar":CONT.impuestos=cfgD.map(x=>({...x,tarifa:+S_(x.tarifa).replace(",",".")||0,baseUVT:+S_(x.baseUVT??0).replace(",",".")||0}));cfgD=null;render();await guardarCont("Impuestos guardados");return;
      case "imp-nuevo":{const tp=$("#fp-impnuevo")?.value||"iva";cfgD.push({id:"imp"+uid4(),tipo:tp,nombre:"Nuevo · "+TIPO_IMP[tp],tarifa:0,baseUVT:0,porMil:tp==="ica"||tp==="rica",ctaC:"",ctaV:"",activo:true});render();return}
      case "imp-reset":if(!confirm("¿Volver al catálogo colombiano por defecto?"))return;cfgD=IMP_DEF();render();return;
      case "imp-confirmar":CONT.impConfirmado={f:hoy(),por:yo()};render();await guardarCont("Gracias. Quedó registrado quién las confirmó.");return;
      case "pagos-guardar":{const p=S_(cfgD.plazos).split(/[,; ]+/).map(Number).filter(n=>n>0&&n<=365);CONT.medios=cfgD.medios;CONT.plazos=p.length?[...new Set(p)].sort((a,b)=>a-b):[30];CONT.fpVenta=cfgD.fpVenta;CONT.fpCompra=cfgD.fpCompra;cfgD=null;render();await guardarCont("Formas de pago guardadas");return}
      case "num-guardar":{const N={};for(const [k,x] of Object.entries(cfgD)){const p=S_(x.pref).trim().toUpperCase().replace(/[^A-Z0-9]/g,"");if(!p)throw {msg:"Cada documento necesita prefijo"};N[k]={pref:p,sig:Math.max(1,r0(x.sig))}}CONT.numeracion=N;cfgD=null;render();await guardarCont("Numeración guardada");return}
      case "fe-tab":feT=d.t;cfgD=null;cfgVista="";render();return;
      case "fe-guardar":CONT.fe={...(CONT.fe||{}),...cfgD};cfgD=null;cfgVista="";render();await guardarCont("Proveedor guardado");return;
      case "fe-switch":{const on=!feOn();if(on&&!confirm("¿Encender la facturación electrónica? Las ventas nuevas saldrán como factura electrónica con la numeración de la resolución."))return;if(!on&&!confirm("¿Apagar la facturación electrónica?"))return;CONT.trib={...trib(),fe:on};render();await guardarCont(on?"Facturación electrónica encendida":"Facturación electrónica apagada");return}
      case "res-nueva":resD={tipo:"FV",numero:"",fecha:"",pref:"",desde:"1",hasta:"",vigHasta:"",clave:"",activa:true};finModal="fpresol";render();return;
      case "res-editar":resD=clone(resols().find(x=>x.id===d.id));finModal="fpresol";render();return;
      case "res-guardar":{const r=resD;if(!S_(r.numero).trim()||!S_(r.pref).trim()||!(+r.desde>0)||!(+r.hasta>=+r.desde))throw {msg:"Revisa número, prefijo y rango"};
        const id=r.id||"res"+uid4(),obj={...r,id,pref:S_(r.pref).trim().toUpperCase(),desde:r0(r.desde),hasta:r0(r.hasta),sig:r.sig||r0(r.desde)};let L=resols().filter(x=>x.id!==id);if(obj.activa!==false)L=L.map(x=>x.tipo===obj.tipo?{...x,activa:false}:x);CONT.resoluciones=[...L,obj];resD=null;finModal=null;render();await guardarCont("Resolución guardada");return}
      case "fe-ver":feVer=d.id;finModal="fpfe";render();return;
      case "fe-emitir":{const v=store.ventas.find(x=>x.id===d.id);if(!feOn())throw {msg:"Enciende la facturación electrónica primero"};if(!CONT.fe?.proveedor)throw {msg:"Configura el proveedor tecnológico"};await guardarDoc("ventas",v.id,{...v,fe:{...(v.fe||{}),estado:"pendiente",enCola:new Date().toISOString()}});toast("Quedó en cola para enviarse al proveedor tecnológico");render();return}
      case "ret-guardar":{const e0=store.egresos.find(x=>x.id===retC.id);if(!e0)return;if(e0.pagado!==false)throw {msg:"Las retenciones se registran antes de pagar la factura"};
        await guardarDoc("egresos",e0.id,{...e0,rf:r0(retC.rf),rica:r0(retC.rica),riva:r0(retC.riva),rfImp:retC.rfImp||"",rivaImp:retC.rivaImp||"",ricaImp:retC.ricaImp||"",rfCta:impDe(retC.rfImp)?.ctaC||""});retC=null;finModal=null;toast("Retenciones registradas");render();return}
    }
  }catch(err){toast(err?.msg||errMsg(err))}
});
// botón "Retenciones" de la factura de compra (solo si TEKALUM es agente de retención)
document.addEventListener("click",e=>{const b=e.target.closest("[data-retc]");if(!b)return;const x=store.egresos.find(y=>y.id===b.dataset.retc);if(!x)return;retC={id:x.id,rfImp:x.rfImp||"",rf:x.rf||"",rivaImp:x.rivaImp||"",riva:x.riva||"",ricaImp:x.ricaImp||"",rica:x.rica||""};finModal="fpret";facVer=null;render()});
// reportes › certificados
document.addEventListener("click",e=>{const b=e.target.closest('[data-rep="impuestos:cert"]');if(!b)return;e.stopImmediatePropagation();impT="cert";irFin("impuestos")},true);
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.matches?.("tr.fp-click"))e.target.click()});
document.addEventListener("input",e=>{const el=e.target,d=el.dataset||{};
  if(d.fpf){const [k,c]=d.fpf.split(":");const F={v:vF,n:nF}[k];F[c]=el.value;if(c==="q")rerender(el);return}
  if(vDraft&&d.fpv&&["cliente","notas"].includes(d.fpv)){vDraft[d.fpv]=el.value;return}
  if(vDraft&&d.fpl){const [i,k]=d.fpl.split("|");vDraft.lineas[+i][k]=el.value;if(["cant","pu","dcto"].includes(k))rerender(el);return}
  if(vDraft&&d.fpr){const [i,k]=d.fpr.split("|");vDraft.ret[+i][k]=el.value;if(k==="valor")rerender(el);return}
  if(nDraft&&d.fpn==="desc"){nDraft.desc=el.value;return}
  if(nDraft&&d.fpnl){const [i,k]=d.fpnl.split("|");nDraft.lineas[+i][k]=el.value;if(k!=="desc")rerender(el);return}
  if(pagoD&&d.fppago){pagoD[d.fppago]=el.value;return}
  if(cfgD&&d.fpc&&!["persona","tipoDoc","mpio","iva","regimen","agente","autorret"].includes(d.fpc)){cfgD[d.fpc]=el.value;return}
  if(cfgD&&d.fpimpc){const [i,k]=d.fpimpc.split("|");if(k!=="activo")cfgD[+i][k]=el.value;return}
  if(cfgD&&d.fpcp==="plazos"){cfgD.plazos=el.value;return}
  if(cfgD&&d.fpnum){const [k,c]=d.fpnum.split("|");cfgD[k][c]=el.value;return}
  if(cfgD&&d.fpfe){cfgD[d.fpfe]=el.value;return}
  if(resD&&d.fpres&&d.fpres!=="activa"&&d.fpres!=="tipo"){resD[d.fpres]=el.value;return}
  if(retC&&d.fpret&&!d.fpret.endsWith("Imp")){retC[d.fpret]=el.value;return}
});
document.addEventListener("change",async e=>{const el=e.target,d=el.dataset||{};
  if(d.fpf){const [k,c]=d.fpf.split(":");({v:vF,n:nF})[k][c]=el.value;render();return}
  if(vDraft&&d.fpv){vDraft[d.fpv]=el.value;if(d.fpv==="forma"||d.fpv==="f"){const f=formaDe(vDraft.forma);vDraft.venc=f.tipo==="credito"?sumaDias(vDraft.f,f.dias):""}
    if(d.fpv==="cotId"&&el.value){const q=quotes.find(x=>x.id===el.value);if(q){vDraft.cliente=q.cliente?.nombre||vDraft.cliente;const vacia=vDraft.lineas.length===1&&!vDraft.lineas[0].desc&&!+vDraft.lineas[0].pu;if(vacia)vDraft.lineas=[{cta:"4120",desc:`Obra ${q.numero}${q.obra?" · "+q.obra:""}: fabricación e instalación según cotización`,cant:1,pu:String(Math.round(totalDe(q))),dcto:"",imp:""}];vDraft.cc=q.cc||vDraft.cc}}
    render();return}
  if(vDraft&&d.fpl){const [i,k]=d.fpl.split("|");vDraft.lineas[+i][k]=el.value;render();return}
  if(vDraft&&d.fpr){const [i,k]=d.fpr.split("|");vDraft.ret[+i][k]=el.value;if(k==="imp")vDraft.ret[+i].valor="";render();return}
  if(nDraft&&d.fpn){nDraft[d.fpn]=el.value;if(d.fpn==="ref"&&esNotaVenta(nDraft)){const v=store.ventas.find(x=>x.id===el.value);if(v)nDraft.lineas.forEach(l=>{if(!l.imp)l.imp=v.lineas?.[0]?.imp||""})}render();return}
  if(nDraft&&d.fpnl){const [i,k]=d.fpnl.split("|");nDraft.lineas[+i][k]=el.value;render();return}
  if(pagoD&&d.fppago){pagoD[d.fppago]=el.value;return}
  if(cfgD&&d.fpc){cfgD[d.fpc]=el.type==="checkbox"?el.checked:el.value;if(d.fpc==="doc"&&cfgD.tipoDoc==="NIT")cfgD.dv=dvNit(el.value);if(["tipoDoc","doc","persona","iva","regimen"].includes(d.fpc))render();return}
  if(cfgD&&d.fpcr){const s=new Set(cfgD.resp||[]);el.checked?s.add(d.fpcr):s.delete(d.fpcr);if(el.checked&&d.fpcr==="R-99-PN")["O-13","O-15","O-23","O-47"].forEach(x=>s.delete(x));if(el.checked&&d.fpcr!=="R-99-PN")s.delete("R-99-PN");cfgD.resp=[...s];render();return}
  if(cfgD&&d.fpimpc){const [i,k]=d.fpimpc.split("|");cfgD[+i][k]=k==="activo"?el.checked:el.value;render();return}
  if(cfgD&&d.fpcm){cfgD.medios[d.fpcm]=el.value;return}
  if(cfgD&&d.fpcp){cfgD[d.fpcp]=el.value;return}
  if(cfgD&&d.fpnum){const [k,c]=d.fpnum.split("|");cfgD[k][c]=el.value;render();return}
  if(cfgD&&d.fpfe){cfgD[d.fpfe]=el.value;return}
  if(resD&&d.fpres){resD[d.fpres]=el.type==="checkbox"?el.checked:el.value;if(d.fpres==="tipo")render();return}
  if(retC&&d.fpret){retC[d.fpret]=el.value;if(d.fpret.endsWith("Imp")){const ex=store.egresos.find(x=>x.id===retC.id),base=(+ex.valor||0)-(+ex.ivaDesc||0),im=impDe(el.value),k=d.fpret.replace("Imp","");retC[k]=im&&base>=baseMinRet(im)?String(valorRet(im,base,+ex.ivaDesc||0)):"";render()}return}
  if(d.fpimp){if(d.fpimp==="rapido"){const h=hoy(),y=h.slice(0,4),m=+h.slice(5,7);const ini=k=>{const n={mes:1,bim:2,cua:4,anio:12}[k];const m0=Math.floor((m-1)/n)*n+1;return `${y}-${String(m0).padStart(2,"0")}-01`};if(el.value){impP.desde=ini(el.value);impP.hasta=h}}else impP[d.fpimp]=el.value;render();return}
  if(d.fpacuse){const [id,k]=d.fpacuse.split("|"),c=store.compras.find(x=>x.id===id);if(!c)return;try{await guardarDoc("compras",c.id,{...c,eventos:{...(c.eventos||{}),[k]:el.checked?hoy():""}});render()}catch(err){toast(errMsg(err))}return}
});
// al cerrar con el velo o "Cancelar", se descartan los borradores de los modales
document.addEventListener("click",e=>{if(e.target.closest("[data-fm-cerrar]")){nDraft=null;pagoD=null;resD=null;asPrev=null;feVer=null;retC=null}},true);
// cambia de pantalla: los borradores de configuración se recargan desde lo guardado
document.addEventListener("click",e=>{const b=e.target.closest("[data-fin],[data-go]");if(!b)return;cfgD=null;cfgVista="";if(!b.closest(".panel.ingreso")&&typeof ctb==="object"){ctb.ter=null;ctb.nota=null}
  if(b.dataset.fin==="ventas"){vVer=null;if(vDraft&&!S_(vDraft.cliente).trim()&&!vDraft.lineas.some(l=>S_(l.desc).trim()||+l.pu))vDraft=null}},true);

/* ======================= Inicio: pasos para terminar la configuración ======================= */
let pasosAb=false;
function pasosConfig(){
  const P=[["Datos de la empresa","Nombre, documento, dirección y correo",!faltanEmpresa().length,"cfgempresa"],
    ["Cuentas de dinero","Caja, banco o Nequi con su saldo inicial",cuentasActivas().length>0,"cuentas"],
    ["Impuestos revisados por el contador","Tarifas, bases y cuentas de retención",!!CONT.impConfirmado,"cfgimpuestos"],
    ["Formas de pago","Plazos de crédito y medio de pago de cada cuenta",!!(CONT.plazos||CONT.medios),"cfgpagos"],
    ["Fecha de inicio de la contabilidad","Desde cuándo lleva libros TEKALUM",!!CONT.inicio,"ctb:cierre"]];
  if(trib().fe||resols().length)P.push(["Resolución de facturación","Prefijo y rango autorizados por la DIAN",!!resolVigente("FV"),"dian"]);
  const falta=P.filter(p=>!p[2]).length;if(!falta)return "";
  const lista=P.map(([t,d,ok,k])=>`<li class="${ok?"ok":""}">${finIco(ok?"M5 12l5 5L20 7":"M12 8v5M12 16h.01",16)}<div><b>${esc(t)}</b><small>${esc(d)}</small></div>${ok?"":`<button class="btn small" data-fin="${k}" style="margin-left:auto">Completar</button>`}</li>`).join("");
  return `<div class="fp-alerta info" style="display:block;margin-bottom:14px"><button class="fp-volver" data-fp="pasos" style="display:flex;justify-content:space-between;width:100%;color:inherit"><span><b>Faltan ${falta} paso${falta===1?"":"s"} para terminar la configuración</b><br><small>Así los documentos y los informes salen completos.</small></span><span>${pasosAb?"▴":"▾"}</span></button>${pasosAb?`<ul class="fin-listo" style="margin:10px 0 0">${lista}</ul>`:""}</div>`;
}
FINX.finaccesos=()=>pasosConfig()+vFinAccesos();
document.addEventListener("click",e=>{if(e.target.closest('[data-fp="pasos"]')){pasosAb=!pasosAb;render()}});

/* alertas de la campana (Auditoría) */
window.auditoriaExtra=()=>{const R=[],h=hoy(),cont=store.ventas.filter(v=>v.estado==="contabilizada");
  const venc=cont.filter(v=>estadoVenta(v)==="vencida");if(venc.length)R.push(["media",`${venc.length} venta${venc.length>1?"s":""} vencida${venc.length>1?"s":""} sin cobrar`,venc.slice(0,3).map(v=>`${v.num} · ${v.cliente} · ${cop(saldoVenta(v))}`).join(" · "),"ventas"]);
  const bv=store.ventas.filter(v=>v.estado==="borrador"),bn=store.notasdoc.filter(n=>n.estado==="borrador");if(bv.length+bn.length)R.push(["info",`${bv.length+bn.length} borrador${bv.length+bn.length>1?"es":""} sin contabilizar`,[bv.length?bv.length+" de ventas":"",bn.length?bn.length+" de notas":""].filter(Boolean).join(" y ")+". No cuentan en la contabilidad hasta contabilizarlos.",bv.length?"ventas":"notasv"]);
  if(feOn()){const r=resolVigente("FV");if(!r)R.push(["alta","Facturación electrónica sin resolución vigente","Las ventas no se pueden numerar. Registra la nueva resolución de la DIAN.","dian"]);else{const q=+r.hasta-(+r.sig||+r.desde)+1,tot=+r.hasta-+r.desde+1,dias=r.vigHasta?Math.floor((Date.parse(r.vigHasta)-Date.parse(h))/864e5):999;if(q<=Math.max(10,tot*.1))R.push(["alta","Se están acabando los números de factura",`Quedan ${q} números en la resolución ${r.numero}. Pide una nueva a la DIAN.`,"dian"]);if(dias<=30)R.push(["alta","La resolución de facturación vence pronto",`Vence el ${fechaCorta(r.vigHasta)} (${dias} días).`,"dian"])}
    const cv=CONT.fe?.certVence;if(cv){const d=Math.floor((Date.parse(cv)-Date.parse(h))/864e5);if(d<=30)R.push(["alta","El certificado de firma digital vence pronto",`Vence el ${fechaCorta(cv)} (${d} días). Sin él no se pueden firmar facturas.`,"dian"])}
    const sinDoc=[...new Set(cont.filter(v=>v.tipoDoc==="FV").map(v=>v.cliente))].filter(n=>!(terceroDe(n)||{}).doc);if(sinDoc.length)R.push(["media","Clientes sin documento en facturas electrónicas",sinDoc.slice(0,3).join(", "),"ctb:terceros"]);
    const pend=cont.filter(v=>v.tipoDoc==="FV"&&v.fe?.estado!=="emitida");if(pend.length)R.push(["media",`${pend.length} factura${pend.length>1?"s":""} sin enviar a la DIAN`,"Quedaron en cola para el proveedor tecnológico.","ventas"])}
  if((trib().agente||store.ventas.some(v=>(v.ret||[]).length))&&!CONT.impConfirmado)R.push(["info","Tarifas de impuestos sin confirmar por el contador","Oswaldo debe revisar tarifas y bases en Configuración › Impuestos y retenciones.","cfgimpuestos"]);
  return R};
/* para pruebas */
window.FPRO={draft:()=>vDraft,ver:id=>{vVer=id;vDraft=null;render();scrollTo(0,0)},htmlVenta:v=>{let h="";const w0=window.open;window.open=()=>({document:{write:x=>h+=x,close(){}}});try{imprimirVenta(v)}finally{window.open=w0}return h.replace(/<script>print\(\)<\/script>/,"")},calcVenta,lineasVenta,saldoVenta,estadoVenta,calcNota,lineasNota,dvNit,payloadFE,trib,imps,tomarNumero,guardarVenta:async(v,contab)=>{vDraft=clone(v);return guardarVenta(contab)},guardarNota:async(n,contab)=>{nDraft=clone(n);return guardarNota(contab)},abonoDe,refVenta,retencionesPracticadas,set:(k,v)=>{({vDraft:()=>vDraft=v,nDraft:()=>nDraft=v})[k]?.()}};
if(typeof render==="function")try{render()}catch(err){console.error(err)}
})();
