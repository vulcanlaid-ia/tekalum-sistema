/* =====================================================================================================
   TEKALUM Finanzas · Nómina (parte 3)
   Empleados (con lo que antes estaba en "Personal y bonos" del sistema de gestión), liquidación de nómina
   quincenal o mensual, novedades (horas extra, recargos, vacaciones, incapacidades, licencias, bonos de las
   OT, préstamos), asiento contable completo (sueldos, aportes del empleado y del empleador, parafiscales y
   provisiones), pago de la nómina, PILA, prima, cesantías, intereses, vacaciones, liquidación de contrato,
   desprendibles, certificado de ingresos y retenciones, formato 2276 y nómina electrónica (apagada).
   Los porcentajes y valores de ley son configurables: Oswaldo los confirma.
   ===================================================================================================== */
(()=>{
"use strict";
const r0=x=>Math.round(+x||0),S_=s=>String(s??""),hoy=()=>hoyISO(),yo=()=>window.VYE_SESION?.nombre||"";
const numIn=v=>{const s=S_(v).replace(/[^\d.,-]/g,"");if(!s)return 0;return +s.replace(/\./g,"").replace(",",".")||0};
const horasIn=v=>+S_(v).replace(",",".")||0;
const cab=(eyebrow,t,sub,acc="")=>`<div class="fin-h"><div><div class="eyebrow">${eyebrow}</div><h1>${t}</h1>${sub?`<p>${sub}</p>`:""}</div>${acc?`<div class="row">${acc}</div>`:""}</div>`;
const NOMS=()=>(store.nominas ||= []);
const EMPS=()=>store.personal||[];
const emp=pid=>EMPS().find(p=>p.id===pid);
const nomE=pid=>emp(pid)?.nombre||"(empleado borrado)";
const trib=()=>window.FPRO?FPRO.trib():{};

/* ======================= configuración de nómina ======================= */
// valores 2026 (Decreto del salario mínimo 2026). La jornada baja a 42 h/semana el 15 de julio de 2026 (Ley 2101): 210 h al mes.
// Recargo dominical y festivo: 90 % desde el 1 de julio de 2026 (Ley 2466 de 2025). Todo esto lo confirma Oswaldo.
const NOM_DEF={per:"quincenal",smmlv:1750905,aux:249095,horas:210,exon:false,bonoOT:"salarial",cuenta:"",ne:false,
  pct:{saludE:4,pensionE:4,fsp:1,saludR:8.5,pensionR:12,caja:4,icbf:3,sena:2,ces:8.33,int:1,pri:8.33,vac:4.17,hed:25,hen:75,rn:35,rdf:90},
  arl:{I:0.522,II:1.044,III:2.436,IV:4.35,V:6.96}};
const cfgN=()=>{const c=CONT.nomina||{};return {...NOM_DEF,...c,pct:{...NOM_DEF.pct,...(c.pct||{})},arl:{...NOM_DEF.arl,...(c.arl||{})}}};
const CONTRATOS=[["indefinido","Término indefinido"],["fijo","Término fijo"],["obra","Obra o labor"],["aprendizaje","Aprendizaje (SENA)"],["servicios","Prestación de servicios (no es nómina)"]];
const TIPOS_DOC=[["CC","Cédula de ciudadanía"],["CE","Cédula de extranjería"],["PPT","Permiso por protección temporal"],["PA","Pasaporte"],["TI","Tarjeta de identidad"]];
const enNomina=p=>p&&p.contrato!=="servicios"&&+p.salario>0;
const areaDe=p=>p?.area==="admin"||(!p?.area&&p?.rol==="Administración")?"admin":"taller";
const pre=p=>areaDe(p)==="admin"?"5105":"7205",ccDe=p=>areaDe(p)==="admin"?"ADM":"PROD";

Object.assign(PUC_BASE,{"2505":"Salarios por pagar","237005":"Aportes a EPS (salud)","237006":"Aportes a ARL","237010":"Aportes parafiscales (caja, ICBF, SENA)","238030":"Fondos de pensiones","238095":"Otros descuentos de nómina por pagar","236505":"Retención en la fuente · salarios","136525":"Préstamos y anticipos a trabajadores",
  "510515":"Horas extras y recargos (administración)","510524":"Incapacidades (administración)","510527":"Auxilio de transporte (administración)","510533":"Intereses sobre cesantías (administración)","510536":"Prima de servicios (administración)","510539":"Vacaciones (administración)","510545":"Auxilios (administración)","510548":"Bonificaciones (administración)","510560":"Indemnizaciones laborales (administración)","510569":"Aportes a EPS (administración)","510570":"Aportes a fondos de pensiones (administración)","510572":"Aportes a cajas de compensación (administración)","510575":"Aportes ICBF (administración)","510578":"SENA (administración)",
  "720515":"Horas extras y recargos (taller)","720524":"Incapacidades (taller)","720527":"Auxilio de transporte (taller)","720533":"Intereses sobre cesantías (taller)","720536":"Prima de servicios (taller)","720539":"Vacaciones (taller)","720545":"Auxilios (taller)","720560":"Indemnizaciones laborales (taller)","720569":"Aportes a EPS (taller)","720570":"Aportes a fondos de pensiones (taller)","720572":"Aportes a cajas de compensación (taller)","720575":"Aportes ICBF (taller)","720578":"SENA (taller)"});
PUC_BASE["510568"]="Aportes a ARL (administración)";PUC_BASE["720568"]="Aportes a ARL (taller)";PUC_BASE["510530"]="Cesantías (administración)";PUC_BASE["720530"]="Cesantías (taller)";
TIPOS_COMP.NM="Liquidación de nómina";
// préstamos o anticipos de sueldo a empleados: se registran como egreso y se descuentan en la nómina
if(!CAT_EGRESO.some(c=>c[0]==="prestamoEmp"))CAT_EGRESO.splice(CAT_EGRESO.length-1,0,["prestamoEmp","Préstamo o anticipo de sueldo a un empleado (se descuenta en la nómina)","variable","capital","136525","Préstamos y anticipos a trabajadores"]);

/* ======================= fechas y periodos ======================= */
const ultDia=f=>finMes(S_(f).slice(0,7))===S_(f).slice(0,10);
const d30=f=>ultDia(f)?30:Math.min(30,+S_(f).slice(8,10));
const dias360=(a,b)=>{if(!a||!b||b<a)return 0;const [y1,m1]=a.split("-").map(Number),[y2,m2]=b.split("-").map(Number);return (y2-y1)*360+(m2-m1)*30+(d30(b)-d30(a))+1};
function periodoDe(id){const [y,m,q]=S_(id).split("-"),mes=y+"-"+m;
  if(q==="1")return {id,mes,desde:mes+"-01",hasta:mes+"-15",dias:15,nombre:"1.ª quincena de "+mesLargo(mes)};
  if(q==="2")return {id,mes,desde:mes+"-16",hasta:finMes(mes),dias:15,nombre:"2.ª quincena de "+mesLargo(mes)};
  return {id,mes,desde:mes+"-01",hasta:finMes(mes),dias:30,nombre:mesLargo(mes)}}
function siguientePeriodo(){const c=cfgN(),L=NOMS().filter(n=>n.tipo==="nomina"&&n.estado!=="anulada").map(n=>n.periodo).sort(),ult=L.at(-1);
  const base=hoy().slice(0,7),q=+hoy().slice(8,10)<=15?"1":"2";
  if(!ult)return c.per==="mensual"?base:base+"-"+q;
  const [y,m,qq]=ult.split("-"),mes=y+"-"+m;
  if(c.per==="mensual")return qq?sumaMes(mes,1):sumaMes(mes,1);
  return qq==="1"?mes+"-2":sumaMes(mes,1)+"-1"}
function diasEmp(p,P){const ini=S_(p.ingreso)>P.desde?S_(p.ingreso):P.desde,fin=p.retiro&&S_(p.retiro)<P.hasta?S_(p.retiro):P.hasta;if(fin<ini)return 0;
  const a=P.dias===15&&P.desde.endsWith("-16")?Math.max(16,d30(ini)):d30(ini),b=d30(fin);return Math.max(0,Math.min(P.dias,b-a+1))}

/* ======================= cálculo de la liquidación de un empleado ======================= */
// L: {pid,dias,vac,inc,lic,hed,hen,rn,rdf,otrasH,bonoS,bonoN,otroN,ret,prestamo,otrosDesc,nota}
function calcLinea(L,c,p){const P=c.pct,S=+L.salario||+p?.salario||0,dia=S/30,vh=S/(+c.horas||210),sm=+c.smmlv||0;
  const dias=Math.max(0,+L.dias||0),vac=Math.min(dias,+L.vac||0),inc=Math.min(dias-vac,+L.inc||0),lic=Math.min(dias-vac-inc,+L.lic||0),trab=Math.max(0,dias-vac-inc-lic);
  const sueldo=r0(S*trab/30),vacPago=r0(S*vac/30),incap=r0(Math.max(S*2/3,sm)*inc/30);
  const H=+c.horas||210,hx=(h,f)=>r0(S*f*horasIn(h)/H),hed=hx(L.hed,1+P.hed/100),hen=hx(L.hen,1+P.hen/100),rn=hx(L.rn,P.rn/100),rdf=hx(L.rdf,P.rdf/100),extras=hed+hen+rn+rdf+r0(L.otrasH);
  const bonoS=r0(L.bonoS),noSal=r0(L.bonoN)+r0(L.otroN);
  const tieneAux=(p?.aux==="si")||(p?.aux!=="no"&&S<=2*sm);
  const aux=tieneAux?r0((+c.aux||0)*trab/30):0;
  const salarial=sueldo+vacPago+incap+extras+bonoS,exceso=Math.max(0,noSal-0.4*(salarial+noSal));
  const diasCot=Math.max(0,dias-lic);let ibc=salarial+exceso;if(diasCot&&ibc<sm/30*diasCot)ibc=r0(sm/30*diasCot);ibc=r0(ibc);
  const ibcMes=diasCot?ibc*30/diasCot:0,exon=c.exon&&ibcMes<10*sm;
  const saludE=r0(ibc*P.saludE/100),pensionE=r0(ibc*P.pensionE/100),fsp=ibcMes>=4*sm?r0(ibc*P.fsp/100):0;
  const ret=r0(L.ret),prestamo=r0(L.prestamo),otrosDesc=r0(L.otrosDesc);
  const devengado=salarial+noSal+aux,deducciones=saludE+pensionE+fsp+ret+prestamo+otrosDesc,neto=devengado-deducciones;
  const ibcArl=Math.max(0,ibc-vacPago-incap),tarifaArl=+c.arl[p?.riesgo||"I"]||0;
  const saludR=exon?0:r0(ibc*P.saludR/100),pensionR=r0(ibc*P.pensionR/100),arl=r0(ibcArl*tarifaArl/100),caja=r0(ibc*P.caja/100),icbf=exon?0:r0(ibc*P.icbf/100),sena=exon?0:r0(ibc*P.sena/100);
  const basePr=salarial+aux,ces=r0(basePr*P.ces/100),int=r0(basePr*P.int/100),pri=r0(basePr*P.pri/100),vacP=r0((sueldo+vacPago+incap)*P.vac/100);
  const aportes=saludR+pensionR+arl+caja+icbf+sena,prov=ces+int+pri+vacP;
  return {pid:L.pid,nombre:p?.nombre||L.nombre||"",doc:p?.doc||"",area:areaDe(p),salario:S,dias,trab,vac,inc,lic,sueldo,vacPago,incap,hed,hen,rn,rdf,extras,bonoS,noSal,bonoN:r0(L.bonoN),otroN:r0(L.otroN),aux,salarial,ibc,exon,
    saludE,pensionE,fsp,ret,prestamo,otrosDesc,devengado,deducciones,neto,saludR,pensionR,arl,caja,icbf,sena,aportes,ces,int,pri,vacP,prov,costo:devengado+aportes+prov,riesgo:p?.riesgo||"I"}}
const calcNom=n=>{if(n.estado==="contabilizada"&&n.calc)return n.calc;const c=cfgN(),C=(n.lineas||[]).map(L=>calcLinea(L,c,emp(L.pid)));return {lineas:C,tot:sumar(C)}};
const CAMPOS_T=["sueldo","vacPago","incap","extras","bonoS","noSal","aux","devengado","saludE","pensionE","fsp","ret","prestamo","otrosDesc","deducciones","neto","saludR","pensionR","arl","caja","icbf","sena","aportes","ces","int","pri","vacP","prov","costo","ibc"];
const sumar=C=>Object.fromEntries(CAMPOS_T.map(k=>[k,C.reduce((s,x)=>s+(+x[k]||0),0)]));

/* ======================= provisiones disponibles por empleado ======================= */
// lo provisionado en las nóminas contabilizadas menos lo ya pagado (y las vacaciones disfrutadas)
function provDisp(pid,f,excluir){const D={ces:0,int:0,pri:0,vac:0};
  for(const n of NOMS()){if(n.estado!=="contabilizada"||S_(n.f)>f)continue;const x=(n.calc?.lineas||[]).find(l=>l.pid===pid);if(!x)continue;D.ces+=x.ces;D.int+=x.int;D.pri+=x.pri;D.vac+=x.vacP-(x.vacProv??0)}
  for(const d of NOMS()){if(d.tipo!=="prest"||d.estado==="anulada"||d.id===excluir||S_(d.f)>f)continue;const l=(d.lineas||[]).find(l=>l.pid===pid);if(!l)continue;for(const k of ["ces","int","pri","vac"])D[k]-=+(l.prov?.[k])||0}
  for(const k in D)D[k]=Math.max(0,r0(D[k]));return D}

/* ======================= asientos contables ======================= */
const CTA={salud:"237005",arl:"237006",para:"237010",pension:"238030",desc:"238095",ret:"236505",prest:"136525",spp:"2505",ces:"261005",int:"261010",vac:"261015",pri:"261020"};
const SUF={ces:"30",int:"33",pri:"36",vac:"39",indem:"60",otros:"45"};
const NOM_CON={ces:"Cesantías",int:"Intereses sobre cesantías",pri:"Prima de servicios",vac:"Vacaciones",indem:"Indemnización",otros:"Otros pagos"};
function lineasNomina(n){const L=[],C=n.calc.lineas,pila="pila:"+S_(n.f).slice(0,7);
  const D=(cta,v,det,p,cc,extra={})=>{v=r0(v);if(v)L.push({cta,d:v,det,ter:p?.nombre||"",cc:cc||"",...extra})},Cr=(cta,v,det,ter,extra={})=>{v=r0(v);if(v)L.push({cta,c:v,det,ter:ter||"",...extra})};
  for(const x of C){const p=emp(x.pid)||{nombre:x.nombre,area:x.area},pr=x.area==="admin"?"5105":"7205",cc=x.area==="admin"?"ADM":"PROD",nm=x.nombre;
    D(pr+"06",x.sueldo,"Sueldo · "+nm,p,cc);
    const vp=x.vacProv??0;D(CTA.vac,vp,"Vacaciones disfrutadas (de la provisión) · "+nm,p);D(pr+"39",x.vacPago-vp,"Vacaciones disfrutadas · "+nm,p,cc);
    D(pr+"24",x.incap,"Incapacidad · "+nm,p,cc);D(pr+"15",x.extras,"Horas extras y recargos · "+nm,p,cc);D(pr+"48",x.bonoS+x.bonoN,"Bonificaciones · "+nm,p,cc);D(pr+"45",x.otroN,"Otros pagos no salariales · "+nm,p,cc);D(pr+"27",x.aux,"Auxilio de transporte · "+nm,p,cc);
    // aportes del empleador
    D(pr+"69",x.saludR,"Salud empleador · "+nm,p,cc);D(pr+"70",x.pensionR,"Pensión empleador · "+nm,p,cc);D(pr+"68",x.arl,"ARL · "+nm,p,cc);D(pr+"72",x.caja,"Caja de compensación · "+nm,p,cc);D(pr+"75",x.icbf,"ICBF · "+nm,p,cc);D(pr+"78",x.sena,"SENA · "+nm,p,cc);
    // provisiones
    D(pr+"30",x.ces,"Provisión cesantías · "+nm,p,cc);D(pr+"33",x.int,"Provisión intereses · "+nm,p,cc);D(pr+"36",x.pri,"Provisión prima · "+nm,p,cc);D(pr+"39",x.vacP,"Provisión vacaciones · "+nm,p,cc);
    Cr(CTA.ces,x.ces,"Cesantías · "+nm,nm);Cr(CTA.int,x.int,"Intereses sobre cesantías · "+nm,nm);Cr(CTA.pri,x.pri,"Prima · "+nm,nm);Cr(CTA.vac,x.vacP,"Vacaciones · "+nm,nm);
    // seguridad social y parafiscales por pagar (PILA del mes)
    Cr(CTA.salud,x.saludE+x.saludR,"Salud · "+nm,p.eps||"EPS",{ref:pila});Cr(CTA.pension,x.pensionE+x.fsp+x.pensionR,"Pensión"+(x.fsp?" y solidaridad":"")+" · "+nm,p.afp||"Fondo de pensiones",{ref:pila});Cr(CTA.arl,x.arl,"ARL · "+nm,cfgN().arlNombre||"ARL",{ref:pila});Cr(CTA.para,x.caja+x.icbf+x.sena,"Caja, ICBF y SENA · "+nm,p.caja||"Caja de compensación",{ref:pila});
    // descuentos y neto a pagar
    Cr(CTA.ret,x.ret,"Retención en la fuente · "+nm,"DIAN");Cr(CTA.prest,x.prestamo,"Descuento de préstamo · "+nm,nm);Cr(CTA.desc,x.otrosDesc,"Otros descuentos · "+nm,nm);
    Cr(CTA.spp,x.neto,"Neto a pagar · "+nm,nm,{ref:"nompago:"+n.id+":"+x.pid})}
  return L}
const pagadoEmp=(n,pid)=>(n.pagos||[]).filter(p=>p.pid===pid).reduce((s,p)=>s+(+p.valor||0),0);
const pilaMes=m=>{const T={salud:0,pension:0,arl:0,para:0};for(const n of NOMS()){if(n.tipo!=="nomina"||n.estado!=="contabilizada"||S_(n.f).slice(0,7)!==m)continue;const t=n.calc.tot;T.salud+=t.saludE+t.saludR;T.pension+=t.pensionE+t.fsp+t.pensionR;T.arl+=t.arl;T.para+=t.caja+t.icbf+t.sena}T.total=T.salud+T.pension+T.arl+T.para;return T};
const pilaPagada=m=>NOMS().filter(d=>d.tipo==="pila"&&d.estado!=="anulada"&&d.mes===m).reduce((s,d)=>s+(+d.total||0),0);
ASIENTO_HOOKS.push(add=>{
  for(const n of NOMS()){if(n.estado==="anulada")continue;
    if(n.tipo==="nomina"&&n.estado==="contabilizada"&&n.calc){add("NM",n.f,"Nómina "+periodoDe(n.periodo).nombre,"",lineasNomina(n),{col:"nominas",id:n.id},{numFijo:n.num});
      const lotes={};for(const p of n.pagos||[])(lotes[p.lote||p.id] ||= []).push(p);
      for(const [lt,P] of Object.entries(lotes)){const L=P.map(p=>({cta:CTA.spp,d:r0(p.valor),det:"Pago de nómina · "+nomE(p.pid),ter:nomE(p.pid),ref:"nompago:"+n.id+":"+p.pid}));const tot=P.reduce((s,p)=>s+r0(p.valor),0);
        L.push({cta:ctaDinero(P[0].cuenta),aux:P[0].cuenta||"",c:tot});add("CE",P[0].f,"Pago de nómina · "+periodoDe(n.periodo).nombre,P.length===1?nomE(P[0].pid):"Empleados",L,{col:"nominas",id:n.id+"|p|"+lt})}}
    if(n.tipo==="pila"){const ref="pila:"+n.mes,v=n.valores||{},L=[];for(const [k,cta,t] of [["salud",CTA.salud,"Salud"],["pension",CTA.pension,"Pensión"],["arl",CTA.arl,"ARL"],["para",CTA.para,"Caja, ICBF y SENA"]])if(r0(v[k]))L.push({cta,d:r0(v[k]),det:t+" · PILA "+mesLargo(n.mes),ref});
      if(L.length){L.push({cta:ctaDinero(n.cuenta),aux:n.cuenta||"",c:L.reduce((s,l)=>s+l.d,0)});add("CE",n.f,"Pago PILA de "+mesLargo(n.mes)+(n.planilla?" · planilla "+n.planilla:""),"Seguridad social (PILA)",L,{col:"nominas",id:n.id})}}
    if(n.tipo==="prest"){const L=[];let tot=0;
      for(const l of n.lineas||[]){const p=emp(l.pid)||{nombre:l.nombre},pr=(l.area||areaDe(p))==="admin"?"5105":"7205",cc=pr==="5105"?"ADM":"PROD",nm=p.nombre||l.nombre;
        for(const k of ["ces","int","pri","vac","indem","otros"]){const v=r0(l[k]);if(!v)continue;tot+=v;const pv=Math.min(v,r0(l.prov?.[k]));if(pv)L.push({cta:CTA[k],d:pv,det:NOM_CON[k]+" · "+nm,ter:nm});if(v-pv)L.push({cta:pr+SUF[k],d:v-pv,det:NOM_CON[k]+(pv?" (lo no provisionado)":"")+" · "+nm,ter:nm,cc})}
        const de=r0(l.desc);if(de){L.push({cta:CTA.prest,c:de,det:"Descuento de préstamo · "+nm,ter:nm});tot-=de}}
      if(L.length){L.push({cta:ctaDinero(n.cuenta),aux:n.cuenta||"",c:tot});add("CE",n.f,(n.concepto==="liquidacion"?"Liquidación de contrato":"Pago de "+(TIT_PREST[n.concepto]||"prestaciones").toLowerCase())+(n.periodoTxt?" · "+n.periodoTxt:""),n.concepto==="liquidacion"?nomE(n.lineas?.[0]?.pid):"Empleados",L,{col:"nominas",id:n.id})}}
  }});
CARTERA_REF.pila=x=>{const m=x.k.slice(5);x.doc="Aportes PILA de "+mesLargo(m);x.ter="Seguridad social y parafiscales";x.venc=sumaMes(m,1)+"-10"};
CARTERA_REF.nominas=x=>{const n=NOMS().find(y=>y.id===S_(x.k.slice(8)).split("|")[0]);x.doc=n?(n.num||"")+" · descuentos de nómina":x.doc;x.ter=x.ter||"Descuentos de nómina";x.venc=x.f};
// los meses con nómina liquidada no llevan la provisión automática "PN" (la nómina ya provisiona)
window.mesConNomina=m=>NOMS().some(n=>n.tipo==="nomina"&&n.estado==="contabilizada"&&S_(n.f).slice(0,7)===m);

/* ======================= guardián: meses cerrados ======================= */
{const _g=guardarDoc;guardarDoc=async function(col,id,data,...r){if(col==="nominas"){const old=id?NOMS().find(x=>x.id===id):null,cerr=f=>!!f&&mesCerrado(S_(f).slice(0,7));
    if(old&&old.estado==="contabilizada"&&data&&cerr(old.f)){const a={...old,pagos:null,_editadoF:null,_editadoPor:null,_editadoNombre:null},b={...data,pagos:null,_editadoF:null,_editadoPor:null,_editadoNombre:null};if(JSON.stringify(a)!==JSON.stringify(b))throw {msg:mesLargo(S_(old.f).slice(0,7))+" está cerrado en Contabilidad: esta nómina no se puede cambiar."}}
    const nuevosPagos=(data?.pagos||[]).filter(p=>!(old?.pagos||[]).some(o=>o.id===p.id));if(nuevosPagos.some(p=>cerr(p.f)))throw {msg:"No se puede registrar un pago con fecha de un mes cerrado."};
    if(data&&(!old||old.estado!=="contabilizada")&&data.estado!=="borrador"&&cerr(data.f))throw {msg:mesLargo(S_(data.f).slice(0,7))+" está cerrado en Contabilidad. Pide a Oswaldo que lo reabra."}}
  return _g.call(this,col,id,data,...r)};
 const _b=borrarDoc;borrarDoc=async function(col,id,...r){if(col==="nominas"){const old=NOMS().find(x=>x.id===id);if(old&&old.estado!=="borrador"&&old.tipo==="nomina")throw {msg:"Una nómina contabilizada no se borra: se anula."};if(old&&old.tipo!=="nomina"&&mesCerrado(S_(old.f).slice(0,7)))throw {msg:"Ese mes está cerrado: no se puede borrar."}}return _b.call(this,col,id,...r)}}
const guardar=async(col,id,data,msg)=>{try{const r=await guardarDoc(col,id,data);if(msg)toast(msg);return r}catch(err){toast(err?.msg||err?.message||"No se pudo guardar");throw err}};

/* ======================= vistas ======================= */
let nomSel=null,empD=null,novD=null,pagoD=null,pilaD=null,prD=null,infTab="mes",infAnio=hoy().slice(0,4),empFiltro="activos";
const est=n=>n.estado==="contabilizada"?`<span class="pill st-aprobada">Contabilizada</span>`:n.estado==="anulada"?`<span class="pill st-rechazada">Anulada</span>`:`<span class="pill st-borrador">Borrador</span>`;
const pendNom=n=>n.estado!=="contabilizada"?0:n.calc.lineas.reduce((s,x)=>s+Math.max(0,x.neto-pagadoEmp(n,x.pid)),0);
const avisoCfg=()=>CONT.nomina?"":`<div class="fp-alerta" style="margin-bottom:12px">Antes de liquidar, revisa la <b>Configuración de nómina</b> (quincenal o mensual, salario mínimo, auxilio de transporte y porcentajes). Están con los valores de 2026; Oswaldo los confirma. <button class="btn small" data-fin="nomcfg">Abrir configuración</button></div>`;

// ---------- Empleados ----------
function vEmpleados(){const L=EMPS().filter(p=>empFiltro==="todos"||(empFiltro==="activos"?p.activo!==false:p.activo===false)).sort((a,b)=>(b.activo!==false)-(a.activo!==false)||S_(a.nombre).localeCompare(S_(b.nombre)));
  const act=EMPS().filter(p=>p.activo!==false),nom=act.filter(enNomina),sinDatos=act.filter(p=>p.contrato!=="servicios"&&(!(+p.salario>0)||!p.doc)),nomina=nom.reduce((s,p)=>s+(+p.salario||0),0);
  return `${cab("Nómina","Empleados","Datos de cada trabajador para la nómina y para las órdenes de trabajo del taller. Lo que antes estaba en «Personal y bonos» del sistema de gestión ahora está aquí.",`<button class="btn primary" data-fnom-emp="nuevo">+ Agregar empleado</button>`)}
  <div class="kpis">${kpi("Activos",act.length,nom.length+" en nómina")}${kpi("Salarios básicos",cop(nomina),"al mes")}${kpi("Faltan datos",sinDatos.length,sinDatos.length?"salario o documento":"todo completo",sinDatos.length?"color:var(--warn)":"")}${kpi("Autorizan salidas",act.filter(p=>p.autoriza).length,"de bodega (OT)")}</div>
  <div class="row" style="margin:12px 0">${[["activos","Activos"],["retirados","Retirados o inactivos"],["todos","Todos"]].map(([k,t])=>`<button class="chip" data-fnom-filtro="${k}" aria-pressed="${empFiltro===k}">${t}</button>`).join("")}</div>
  <div class="fin-card">${L.length?`<div class="tbl-wrap"><table class="fp-tabla"><thead><tr><th>Empleado</th><th>Cargo y área</th><th>Contrato</th><th class="r">Salario</th><th>Ingreso</th><th class="r">OT activas</th><th class="r">OT cerradas</th><th class="r">Consumo vs. teórico</th><th class="r">Aptas para bono</th><th class="r">Bonos</th><th></th></tr></thead><tbody>
    ${L.map(p=>{const s=typeof statsPersona==="function"?statsPersona(p.id):{};const falta=p.contrato!=="servicios"&&(!(+p.salario>0)||!p.doc);return `<tr class="${claseReal(p)}"${p.activo===false?' style="opacity:.6"':""}><td><b>${esc(p.nombre)}</b>${marcaReal(p)}${p.autoriza?' <span class="pill st-instalada">Autoriza</span>':""}${p.activo===false?` <span class="pill st-borrador">${p.retiro?"Retirado":"Inactivo"}</span>`:""}<div class="who">${esc([p.tipoDoc&&p.doc?p.tipoDoc+" "+p.doc:"",p.telefono].filter(Boolean).join(" · "))}</div>${falta?`<div class="who" style="color:var(--warn)">Falta ${!(+p.salario>0)?"el salario":"el documento"}</div>`:""}</td>
      <td>${esc(p.rol||"")}<div class="who">${areaDe(p)==="admin"?"Administración":"Taller (producción)"}</div></td><td>${esc((CONTRATOS.find(c=>c[0]===(p.contrato||"indefinido"))||CONTRATOS[0])[1])}</td><td class="r num">${+p.salario?cop(p.salario):"—"}</td><td class="num">${p.ingreso?fechaCorta(p.ingreso):"—"}</td>
      <td class="r num">${s.activas??"—"}</td><td class="r num">${s.n??"—"}</td><td class="r num" style="color:${s.ef==null?"var(--muted)":s.ef-1>tolOT()?"var(--warn)":"var(--ok)"}">${s.ef==null?"—":Math.round(s.ef*100)+" %"}</td><td class="r num">${s.bono??"—"}</td><td class="r num">${s.entregados??"—"}</td>
      <td class="r"><button class="btn small ghost" data-fnom-emp="${esc(p.id)}">Editar</button></td></tr>`}).join("")}</tbody></table></div>`:`<div class="empty">${empFiltro==="activos"?"Registra a los trabajadores para liquidar la nómina y asignarlos a las órdenes de trabajo.":"No hay empleados en este filtro."} <button class="btn small primary" data-fnom-emp="nuevo">+ Agregar empleado</button></div>`}
  <p class="who" style="margin:10px 0 0">Cada OT cerrada a tiempo, dentro del material teórico y sin faltantes queda <b>apta para bono de eficiencia</b>. El bono se registra en la OT y se trae a la nómina con «Traer bonos de las OT».</p></div>`}
function modalEmp(){const d=empD,c=cfgN(),sal=numIn(d.salario),auxAuto=sal<=2*c.smmlv;
  const sel=(k,L,v)=>`<select data-fne="${k}">${L.map(([a,b])=>`<option value="${esc(a)}" ${S_(v)===a?"selected":""}>${esc(b)}</option>`).join("")}</select>`;
  return `<div class="panel ingreso">${fmCab(d.id?"Editar empleado":"Agregar empleado",d.id?esc(d.nombre):"Datos para la nómina, la PILA y las órdenes de trabajo")}
  <h3 style="margin:4px 0 8px">Datos personales</h3><div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
    <label class="f full">Nombre completo<input data-fne="nombre" value="${esc(d.nombre)}" placeholder="Ej. Carlos Rodríguez" autocomplete="off"></label>
    <label class="f">Tipo de documento${sel("tipoDoc",TIPOS_DOC,d.tipoDoc||"CC")}</label><label class="f">Número de documento<input data-fne="doc" value="${esc(d.doc||"")}" inputmode="numeric"></label>
    <label class="f">Teléfono<input data-fne="telefono" value="${esc(d.telefono||"")}" inputmode="tel"></label><label class="f">Correo<input data-fne="email" value="${esc(d.email||"")}" type="email"></label>
    <label class="f full">Dirección<input data-fne="dir" value="${esc(d.dir||"")}"></label></div>
  <h3 style="margin:14px 0 8px">Contrato</h3><div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
    <label class="f">Cargo${sel("rol",ROLES.map(r=>[r,r]),d.rol||ROLES[0])}</label><label class="f">Área (dónde va el gasto)${sel("area",[["taller","Taller · costo de producción (7205)"],["admin","Administración · gasto (5105)"]],areaDe(d))}</label>
    <label class="f">Tipo de contrato${sel("contrato",CONTRATOS,d.contrato||"indefinido")}</label><label class="f">Salario mensual<input data-fne="salario" value="${esc(d.salario||"")}" inputmode="numeric" placeholder="Ej. ${n0.format(c.smmlv)}"></label>
    <label class="f">Fecha de ingreso<input type="date" data-fne="ingreso" value="${esc(d.ingreso||"")}"></label><label class="f">Fin del contrato (si es a término fijo)<input type="date" data-fne="finContrato" value="${esc(d.finContrato||"")}"></label>
    <label class="f">Auxilio de transporte${sel("aux",[["auto",auxAuto?"Sí (gana hasta 2 salarios mínimos)":"No (gana más de 2 salarios mínimos)"],["si","Sí, siempre"],["no","No (vive cerca o no aplica)"]],d.aux||"auto")}</label>
    <label class="f">Riesgo ARL${sel("riesgo",Object.keys(c.arl).map(k=>[k,"Clase "+k+" · "+String(c.arl[k]).replace(".",",")+" %"]),d.riesgo||(areaDe(d)==="admin"?"I":"III"))}</label></div>
  ${d.contrato==="servicios"?`<div class="fp-alerta" style="margin-top:10px">Un contratista de prestación de servicios no va en la nómina: se le paga con un egreso (categoría honorarios o servicios) y él paga su propia seguridad social.</div>`:""}
  <h3 style="margin:14px 0 8px">Seguridad social y pago</h3><div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
    <label class="f">EPS (salud)<input data-fne="eps" value="${esc(d.eps||"")}" placeholder="Ej. Emssanar"></label><label class="f">Fondo de pensiones<input data-fne="afp" value="${esc(d.afp||"")}" placeholder="Ej. Porvenir"></label>
    <label class="f">Fondo de cesantías<input data-fne="fces" value="${esc(d.fces||"")}"></label><label class="f">Caja de compensación<input data-fne="caja" value="${esc(d.caja||"")}" placeholder="Ej. Comfamiliar de Nariño"></label>
    <label class="f">Banco o billetera<input data-fne="banco" value="${esc(d.banco||"")}" placeholder="Ej. Nequi"></label><label class="f">Número de cuenta<input data-fne="cuentaNum" value="${esc(d.cuentaNum||"")}" inputmode="numeric"></label></div>
  <h3 style="margin:14px 0 8px">Taller</h3>
  <label class="chk-lg"><input type="checkbox" data-fne="autoriza" ${d.autoriza?"checked":""}> Puede autorizar salidas extraordinarias de bodega</label>
  <label class="chk-lg"><input type="checkbox" data-fne="activo" ${d.activo!==false?"checked":""}> Activo (aparece en la nómina y para asignar en las OT)</label>
  ${d.retiro?`<p class="who">Retirado el ${fechaCorta(d.retiro)}${d.motivoRetiro?" · "+esc(d.motivoRetiro):""}.</p>`:""}
  <div class="row" style="justify-content:space-between;margin-top:14px">${d.id&&d.activo!==false&&enNomina(d)?`<button class="btn ghost" data-fnom-liq="${esc(d.id)}">Liquidar contrato (retiro)</button>`:"<span></span>"}<span class="row"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fnom-emp-guardar="1">Guardar</button></span></div></div>`}

// ---------- Liquidar nómina ----------
function vNomina(){if(nomSel){const n=NOMS().find(x=>x.id===nomSel);if(n)return vNomDoc(n);nomSel=null}
  const L=NOMS().filter(n=>n.tipo==="nomina").sort((a,b)=>S_(b.periodo).localeCompare(S_(a.periodo))||S_(b.f).localeCompare(S_(a.f)));const c=cfgN(),sig=periodoDe(siguientePeriodo());
  const cont=L.filter(n=>n.estado==="contabilizada"),anio=hoy().slice(0,4),delAnio=cont.filter(n=>S_(n.f).startsWith(anio)),pend=cont.reduce((s,n)=>s+pendNom(n),0);
  return `${cab("Nómina","Liquidar nómina",`Nómina ${c.per==="mensual"?"mensual":"quincenal"} con salario, auxilio de transporte, horas extra, bonos, aportes, parafiscales y provisiones. Al contabilizar se hace el asiento completo y queda lista para pagar.`,`<button class="btn" data-fin="nomcfg">Configuración</button><button class="btn primary" data-fnom-nueva="1">+ Liquidar ${esc(sig.nombre)}</button>`)}
  ${avisoCfg()}
  <div class="kpis">${kpi("Costo de nómina "+anio,cop(delAnio.reduce((s,n)=>s+n.calc.tot.costo,0)),"salarios, aportes y provisiones")}${kpi("Pagado a empleados "+anio,cop(delAnio.reduce((s,n)=>s+n.calc.tot.neto,0)-delAnio.reduce((s,n)=>s+pendNom(n),0)),"netos")}${kpi("Salarios por pagar",cop(pend),pend?"pendientes":"al día",pend?"color:var(--warn)":"")}${kpi("Empleados en nómina",EMPS().filter(p=>p.activo!==false&&enNomina(p)).length,"activos")}</div>
  <div class="fin-card" style="margin-top:12px">${L.length?`<div class="tbl-wrap"><table class="fp-tabla"><thead><tr><th>Número</th><th>Periodo</th><th class="r">Empleados</th><th class="r">Devengado</th><th class="r">Deducciones</th><th class="r">Neto</th><th class="r">Costo total</th><th>Estado</th><th class="r">Por pagar</th><th></th></tr></thead><tbody>
    ${L.map(n=>{const t=calcNom(n).tot,pp=pendNom(n);return `<tr><td class="num"><b>${esc(n.num||"—")}</b></td><td>${esc(periodoDe(n.periodo).nombre)}</td><td class="r num">${(n.lineas||[]).length}</td><td class="r num">${cop(t.devengado)}</td><td class="r num">${cop(t.deducciones)}</td><td class="r num"><b>${cop(t.neto)}</b></td><td class="r num">${cop(t.costo)}</td><td>${est(n)}</td><td class="r num" style="${pp?"color:var(--warn)":""}">${n.estado==="contabilizada"?(pp?cop(pp):"Pagada"):"—"}</td><td class="r"><button class="btn small ${n.estado==="borrador"?"primary":"ghost"}" data-fnom-abrir="${esc(n.id)}">${n.estado==="borrador"?"Continuar":"Ver"}</button></td></tr>`}).join("")}</tbody></table></div>`
    :`<div class="empty">Todavía no hay nóminas. ${EMPS().some(enNomina)?`<button class="btn small primary" data-fnom-nueva="1">+ Liquidar ${esc(sig.nombre)}</button>`:`Primero registra los empleados con su salario. <button class="btn small primary" data-fin="nomempleados">Ir a Empleados</button>`}</div>`}</div>`}
function vNomDoc(n){const P=periodoDe(n.periodo),C=calcNom(n),t=C.tot,bor=n.estado==="borrador",pp=pendNom(n);
  const acc=bor?`<button class="btn ghost" data-fnom-volver="1">← Volver</button><button class="btn" data-fnom-bonos="1">Traer bonos de las OT</button><button class="btn danger ghost" data-fnom-borrar="1">Borrar borrador</button><button class="btn primary" data-fnom-contab="1">Contabilizar nómina</button>`
    :`<button class="btn ghost" data-fnom-volver="1">← Volver</button><button class="btn" data-fnom-desp="all">⎙ Desprendibles</button>${n.estado==="contabilizada"&&pp?`<button class="btn primary" data-fnom-pagar="${esc(n.id)}">Pagar nómina</button>`:""}${n.estado==="contabilizada"&&!(n.pagos||[]).length?`<button class="btn danger ghost" data-fnom-anular="1">Anular</button>`:""}`;
  return `${cab("Nómina · "+(n.num||"borrador"),esc(P.nombre),`Del ${fechaCorta(P.desde)} al ${fechaCorta(P.hasta)} · ${P.dias} días. ${bor?"Revisa los días y las novedades de cada empleado; el cálculo se actualiza solo.":"Contabilizada"+(n.contabPor?" por "+esc(n.contabPor):"")+"."}`,acc)}
  ${bor&&!(n.lineas||[]).length?`<div class="fp-alerta">No hay empleados en esta nómina. <button class="btn small" data-fnom-sync="1">Agregar empleados activos</button></div>`:""}
  <div class="kpis">${kpi("Devengado",cop(t.devengado),"salarios, extras, bonos y auxilio")}${kpi("Deducciones",cop(t.deducciones),"salud, pensión y descuentos")}${kpi("Neto a pagar",cop(t.neto),n.estado==="contabilizada"?(pp?"falta "+cop(pp):"pagado"):"a los empleados",pp?"color:var(--warn)":"")}${kpi("Costo para la empresa",cop(t.costo),"con aportes y provisiones")}</div>
  <div class="fin-card" style="margin-top:12px"><div class="fin-card-h"><h3>Empleados</h3>${bor?`<button class="btn small ghost" data-fnom-sync="1">Actualizar lista de empleados</button>`:""}</div>
  <div class="tbl-wrap"><table class="fp-tabla"><thead><tr><th>Empleado</th><th class="r">Días</th><th class="r">Salario del periodo</th><th class="r">Extras y bonos</th><th class="r">Aux. transporte</th><th class="r">Devengado</th><th class="r">Deducciones</th><th class="r">Neto</th>${n.estado==="contabilizada"?`<th class="r">Pagado</th>`:""}<th></th></tr></thead><tbody>
  ${C.lineas.map((x,i)=>{const nov=[x.vac&&x.vac+" d vacaciones",x.inc&&x.inc+" d incapacidad",x.lic&&x.lic+" d licencia",x.extras&&"extras "+cop(x.extras),x.prestamo&&"préstamo −"+cop(x.prestamo)].filter(Boolean).join(" · ");const pg=pagadoEmp(n,x.pid);
    return `<tr><td><b>${esc(x.nombre)}</b><div class="who">${esc(nov||(x.area==="admin"?"Administración":"Taller"))}</div></td><td class="r num">${x.dias}</td><td class="r num">${cop(x.sueldo+x.vacPago+x.incap)}</td><td class="r num">${cop(x.extras+x.bonoS+x.noSal)}</td><td class="r num">${cop(x.aux)}</td><td class="r num">${cop(x.devengado)}</td><td class="r num">${cop(x.deducciones)}</td><td class="r num"><b>${cop(x.neto)}</b></td>${n.estado==="contabilizada"?`<td class="r num" style="${pg<x.neto?"color:var(--warn)":"color:var(--ok)"}">${cop(pg)}</td>`:""}
    <td class="r" style="white-space:nowrap">${bor?`<button class="btn small" data-fnom-nov="${i}">Novedades</button>`:`<button class="btn small ghost" data-fnom-desp="${esc(x.pid)}" title="Desprendible de pago">⎙</button>`}</td></tr>`}).join("")}
  </tbody><tfoot><tr><td><b>Total</b></td><td></td><td class="r num">${cop(t.sueldo+t.vacPago+t.incap)}</td><td class="r num">${cop(t.extras+t.bonoS+t.noSal)}</td><td class="r num">${cop(t.aux)}</td><td class="r num"><b>${cop(t.devengado)}</b></td><td class="r num"><b>${cop(t.deducciones)}</b></td><td class="r num"><b>${cop(t.neto)}</b></td>${n.estado==="contabilizada"?"<td></td>":""}<td></td></tr></tfoot></table></div></div>
  <div class="grid2" style="margin-top:12px"><div class="fin-card"><div class="fin-card-h"><h3>Lo que paga la empresa además del salario</h3></div><div class="fp-tot">
    <div><span>Salud (empleador)${cfgN().exon?" · exonerado":""}</span><b class="num">${cop(t.saludR)}</b></div><div><span>Pensión (empleador)</span><b class="num">${cop(t.pensionR)}</b></div><div><span>ARL</span><b class="num">${cop(t.arl)}</b></div><div><span>Caja de compensación</span><b class="num">${cop(t.caja)}</b></div><div><span>ICBF y SENA</span><b class="num">${cop(t.icbf+t.sena)}</b></div>
    <div><span>Provisión cesantías e intereses</span><b class="num">${cop(t.ces+t.int)}</b></div><div><span>Provisión prima</span><b class="num">${cop(t.pri)}</b></div><div><span>Provisión vacaciones</span><b class="num">${cop(t.vacP)}</b></div><div class="fp-gran"><span>Costo total de la nómina</span><span class="num">${cop(t.costo)}</span></div></div></div>
    <div class="fin-card"><div class="fin-card-h"><h3>Seguridad social de esta nómina (va a la PILA)</h3></div><div class="fp-tot">
    <div><span>Salud (empleado ${String(cfgN().pct.saludE).replace(".",",")} % + empleador)</span><b class="num">${cop(t.saludE+t.saludR)}</b></div><div><span>Pensión (empleado + empleador${t.fsp?" + solidaridad":""})</span><b class="num">${cop(t.pensionE+t.fsp+t.pensionR)}</b></div><div><span>ARL</span><b class="num">${cop(t.arl)}</b></div><div><span>Caja, ICBF y SENA</span><b class="num">${cop(t.caja+t.icbf+t.sena)}</b></div><div class="fp-gran"><span>Total</span><span class="num">${cop(t.saludE+t.saludR+t.pensionE+t.fsp+t.pensionR+t.arl+t.caja+t.icbf+t.sena)}</span></div></div>
    <p class="who" style="margin:8px 0 0">Se paga en <b>Nómina › Pagos y PILA</b>. ${n.estado==="contabilizada"?`Asiento ${esc(asientoNum(n))}.`:"Al contabilizar se hace un solo asiento con todo esto."}</p></div></div>`}
const asientoNum=n=>{try{return asientosTodos().find(a=>a.tipo==="NM"&&a.src.col==="nominas"&&a.src.id===n.id)?.num||n.num}catch{return n.num}};
function modalNov(){const n=NOMS().find(x=>x.id===nomSel);if(!n)return "";const L=n.lineas[novD.i],p=emp(L.pid),x=calcLinea({...L,...novD.v},cfgN(),p),v=novD.v;
  const inp=(k,t,ph="",ayuda="")=>`<label class="f">${t}<input data-fnv="${k}" value="${esc(v[k]??"")}" inputmode="decimal" placeholder="${esc(ph)}">${ayuda?`<small class="who">${ayuda}</small>`:""}</label>`;
  return `<div class="panel ingreso">${fmCab("Novedades · "+esc(x.nombre),`Salario ${cop(x.salario)} al mes · ${x.area==="admin"?"administración":"taller"} · ARL clase ${esc(x.riesgo)}`)}
  <h3 style="margin:4px 0 8px">Días</h3><div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${inp("dias","Días del periodo",String(periodoDe(n.periodo).dias))}${inp("vac","Días de vacaciones disfrutadas","0")}${inp("inc","Días de incapacidad","0","Se paga al 66,67 %")}${inp("lic","Días de licencia no remunerada","0")}</div>
  <h3 style="margin:14px 0 8px">Horas extra y recargos (en horas)</h3><div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${inp("hed","Extra diurnas","0","+"+cfgN().pct.hed+" %")}${inp("hen","Extra nocturnas","0","+"+cfgN().pct.hen+" %")}${inp("rn","Recargo nocturno","0",cfgN().pct.rn+" %")}${inp("rdf","Recargo dominical o festivo","0",cfgN().pct.rdf+" %")}${inp("otrasH","Otras extras o recargos (valor)","0")}</div>
  <h3 style="margin:14px 0 8px">Otros pagos</h3><div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${inp("bonoS","Bonos y comisiones salariales","0","Suman para aportes y prestaciones")}${inp("bonoN","Bonos no salariales","0","Solo si está pactado por escrito")}${inp("otroN","Otros pagos no salariales","0","Ej. auxilio de alimentación")}</div>
  <h3 style="margin:14px 0 8px">Descuentos</h3><div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${inp("prestamo","Préstamo o anticipo","0","Abona a la cuenta 136525")}${inp("otrosDesc","Otros descuentos","0","Libranzas, embargos")}${inp("ret","Retención en la fuente","0")}</div>
  <label class="f full" style="margin-top:10px">Nota<input data-fnv="nota" value="${esc(v.nota||"")}"></label>
  <div class="fp-tot" style="margin-top:12px"><div><span>Devengado</span><b class="num">${cop(x.devengado)}</b></div><div><span>Salud ${String(cfgN().pct.saludE).replace(".",",")} % y pensión ${String(cfgN().pct.pensionE).replace(".",",")} %${x.fsp?" + solidaridad":""}</span><b class="num">− ${cop(x.saludE+x.pensionE+x.fsp)}</b></div>${x.ret+x.prestamo+x.otrosDesc?`<div><span>Otros descuentos</span><b class="num">− ${cop(x.ret+x.prestamo+x.otrosDesc)}</b></div>`:""}<div class="fp-gran"><span>Neto a pagar</span><span class="num">${cop(x.neto)}</span></div></div>
  ${x.noSal>0.4*(x.salarial+x.noSal)?`<p class="who" style="color:var(--warn)">Los pagos no salariales pasan del 40 %: el exceso suma para la seguridad social (Ley 1393).</p>`:""}
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fnov-guardar="1">Aplicar</button></div></div>`}

// ---------- Pagos y PILA ----------
function vPagos(){const pend=[];for(const n of NOMS())if(n.tipo==="nomina"&&n.estado==="contabilizada")for(const x of n.calc.lineas){const s=x.neto-pagadoEmp(n,x.pid);if(s>0)pend.push({n,x,s})}
  const meses=[...new Set(NOMS().filter(n=>n.tipo==="nomina"&&n.estado==="contabilizada").map(n=>S_(n.f).slice(0,7)))].sort().reverse();
  const pagos=NOMS().filter(d=>d.tipo==="pila"&&d.estado!=="anulada").sort((a,b)=>S_(b.f).localeCompare(S_(a.f)));
  const pagosNom=[];for(const n of NOMS())if(n.tipo==="nomina")for(const p of n.pagos||[])pagosNom.push({n,p});pagosNom.sort((a,b)=>S_(b.p.f).localeCompare(S_(a.p.f)));
  return `${cab("Nómina","Pagos y PILA","Paga los netos a los empleados y la planilla de seguridad social (PILA). Cada pago sale de la cuenta que elijas y queda como comprobante de egreso.")}
  <div class="kpis">${kpi("Salarios por pagar",cop(pend.reduce((s,y)=>s+y.s,0)),pend.length+" pago(s) pendiente(s)",pend.length?"color:var(--warn)":"")}${kpi("PILA por pagar",cop(meses.reduce((s,m)=>s+Math.max(0,pilaMes(m).total-pilaPagada(m)),0)),"aportes y parafiscales")}</div>
  <div class="fin-card" style="margin-top:12px"><div class="fin-card-h"><h3>Salarios por pagar</h3></div>${pend.length?`<div class="tbl-wrap"><table class="fp-tabla"><thead><tr><th>Nómina</th><th>Empleado</th><th>Cuenta del empleado</th><th class="r">Neto</th><th class="r">Pendiente</th><th></th></tr></thead><tbody>
    ${pend.map(y=>{const p=emp(y.x.pid);return `<tr><td><b>${esc(y.n.num)}</b><div class="who">${esc(periodoDe(y.n.periodo).nombre)}</div></td><td>${esc(y.x.nombre)}</td><td class="who">${esc([p?.banco,p?.cuentaNum].filter(Boolean).join(" · ")||"—")}</td><td class="r num">${cop(y.x.neto)}</td><td class="r num"><b>${cop(y.s)}</b></td><td class="r"><button class="btn small primary" data-fnom-pagar="${esc(y.n.id)}" data-pid="${esc(y.x.pid)}">Pagar</button></td></tr>`}).join("")}</tbody></table></div>`:`<div class="empty" style="padding:16px">No hay salarios pendientes de pago.</div>`}</div>
  <div class="fin-card" style="margin-top:12px"><div class="fin-card-h"><h3>PILA por mes</h3></div>${meses.length?`<div class="tbl-wrap"><table class="fp-tabla"><thead><tr><th>Mes</th><th class="r">Salud</th><th class="r">Pensión</th><th class="r">ARL</th><th class="r">Caja, ICBF y SENA</th><th class="r">Total</th><th class="r">Pagado</th><th></th></tr></thead><tbody>
    ${meses.map(m=>{const T=pilaMes(m),pg=pilaPagada(m),f=T.total-pg;return `<tr><td><b>${esc(mesLargo(m))}</b><div class="who">Pagar antes del ${fechaCorta(sumaMes(m,1)+"-10")} (según el NIT o cédula)</div></td><td class="r num">${cop(T.salud)}</td><td class="r num">${cop(T.pension)}</td><td class="r num">${cop(T.arl)}</td><td class="r num">${cop(T.para)}</td><td class="r num"><b>${cop(T.total)}</b></td><td class="r num" style="color:${f>0?"var(--warn)":"var(--ok)"}">${cop(pg)}</td><td class="r">${f>0?`<button class="btn small primary" data-fnom-pila="${esc(m)}">Registrar pago</button>`:`<span class="pill st-aprobada">Pagada</span>`}</td></tr>`}).join("")}</tbody></table></div>`:`<div class="empty" style="padding:16px">Aparece cuando contabilices la primera nómina.</div>`}</div>
  <div class="grid2" style="margin-top:12px"><div class="fin-card"><div class="fin-card-h"><h3>Pagos a empleados</h3></div>${pagosNom.length?pagosNom.slice(0,40).map(({n,p})=>`<div class="who" style="padding:6px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:8px"><span>${fechaCorta(p.f)} · <b>${esc(nomE(p.pid))}</b> · ${esc(n.num)} · ${esc(nombreCuenta(p.cuenta))}</span><b class="num">${cop(p.valor)}</b></div>`).join(""):`<div class="empty" style="padding:12px">Sin pagos todavía.</div>`}</div>
    <div class="fin-card"><div class="fin-card-h"><h3>Planillas PILA pagadas</h3></div>${pagos.length?pagos.map(d=>`<div class="who" style="padding:6px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:8px;align-items:center"><span>${fechaCorta(d.f)} · <b>${esc(mesLargo(d.mes))}</b>${d.planilla?" · planilla "+esc(d.planilla):""} · ${esc(nombreCuenta(d.cuenta))}</span><span class="row" style="gap:6px"><b class="num">${cop(d.total)}</b><button class="btn small ghost" data-fnom-pila-borrar="${esc(d.id)}" title="Borrar este pago" aria-label="Borrar pago">×</button></span></div>`).join(""):`<div class="empty" style="padding:12px">Sin planillas pagadas.</div>`}</div></div>`}
function modalPago(){const n=NOMS().find(x=>x.id===pagoD.id);if(!n)return "";const L=n.calc.lineas.map(x=>({x,s:x.neto-pagadoEmp(n,x.pid)})).filter(y=>y.s>0);
  return `<div class="panel ingreso">${fmCab("Pagar nómina · "+esc(n.num),esc(periodoDe(n.periodo).nombre))}
  <div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))"><label class="f">Fecha del pago<input type="date" data-fnp="f" value="${esc(pagoD.f)}"></label><label class="f">Sale de<select data-fnp="cuenta">${opcCuentas(pagoD.cuenta)}</select></label></div>
  <div class="tbl-wrap" style="margin-top:10px"><table class="fp-tabla sin-busca"><thead><tr><th></th><th>Empleado</th><th>Cuenta del empleado</th><th class="r">Pendiente</th><th class="r">Valor a pagar</th></tr></thead><tbody>
  ${L.map(({x,s})=>{const p=emp(x.pid),on=pagoD.sel[x.pid]!==false;return `<tr><td><input type="checkbox" data-fnp-sel="${esc(x.pid)}" ${on?"checked":""} aria-label="Pagar a ${esc(x.nombre)}"></td><td>${esc(x.nombre)}</td><td class="who">${esc([p?.banco,p?.cuentaNum].filter(Boolean).join(" · ")||"—")}</td><td class="r num">${cop(s)}</td><td class="r"><input class="inline-num" data-fnp-val="${esc(x.pid)}" value="${esc(pagoD.val[x.pid]??s)}" inputmode="numeric" style="width:120px" ${on?"":"disabled"}></td></tr>`}).join("")}</tbody></table></div>
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fnp-guardar="1">Registrar pago</button></div></div>`}
function modalPila(){const T=pilaMes(pilaD.mes),pg=pilaPagada(pilaD.mes),v=pilaD.v;
  return `<div class="panel ingreso">${fmCab("Pago de PILA · "+esc(mesLargo(pilaD.mes)),"Lo liquidado en las nóminas del mes. Si la planilla dice otro valor (por redondeos o novedades), corrígelo aquí.")}
  <div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))"><label class="f">Fecha del pago<input type="date" data-fpl="f" value="${esc(pilaD.f)}"></label><label class="f">Sale de<select data-fpl="cuenta">${opcCuentas(pilaD.cuenta)}</select></label><label class="f">Número de planilla<input data-fpl="planilla" value="${esc(pilaD.planilla||"")}"></label></div>
  <div class="fields" style="margin-top:10px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">${[["salud","Salud"],["pension","Pensión"],["arl","ARL"],["para","Caja, ICBF y SENA"]].map(([k,t])=>`<label class="f">${t}<input data-fplv="${k}" value="${esc(v[k])}" inputmode="numeric"><small class="who">Liquidado: ${cop(T[k])}</small></label>`).join("")}</div>
  <div class="fp-tot" style="margin-top:12px">${pg?`<div><span>Ya pagado de este mes</span><b class="num">${cop(pg)}</b></div>`:""}<div class="fp-gran"><span>Total de este pago</span><span class="num">${cop(["salud","pension","arl","para"].reduce((s,k)=>s+numIn(v[k]),0))}</span></div></div>
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fpl-guardar="1">Registrar pago</button></div></div>`}

// ---------- Prestaciones y liquidaciones ----------
const TIT_PREST={pri:"Prima de servicios",ces:"Cesantías (consignación al fondo)",int:"Intereses sobre cesantías",vac:"Vacaciones en dinero",liquidacion:"Liquidación de contrato"};
const semestre=f=>{const y=S_(f).slice(0,4),m=+S_(f).slice(5,7);return m<=6?[y+"-01-01",y+"-06-30","1.er semestre "+y]:[y+"-07-01",y+"-12-31","2.º semestre "+y]};
const diasVacTomados=pid=>NOMS().filter(n=>n.tipo==="nomina"&&n.estado==="contabilizada").reduce((s,n)=>s+((n.calc.lineas.find(l=>l.pid===pid)||{}).vac||0),0)+NOMS().filter(d=>d.tipo==="prest"&&d.estado!=="anulada").reduce((s,d)=>s+(+((d.lineas||[]).find(l=>l.pid===pid)?.diasVac)||0),0);
function sugerir(concepto,f,pid,fRet){const c=cfgN(),R={};const L=pid?[emp(pid)].filter(Boolean):EMPS().filter(p=>p.activo!==false&&enNomina(p));
  for(const p of L){const S=+p.salario||0,aux=(p.aux==="si")||(p.aux!=="no"&&S<=2*c.smmlv)?+c.aux:0,base=S+aux,fin=fRet||f,ing=S_(p.ingreso)||inicioCont();
    const y0=S_(fin).slice(0,4)+"-01-01",[s0,s1]=semestre(fin);const x={pid:p.id,nombre:p.nombre,area:areaDe(p),ces:0,int:0,pri:0,vac:0,indem:0,otros:0,desc:0,diasVac:0};
    const dAnio=dias360(ing>y0?ing:y0,fin),dSem=dias360(ing>s0?ing:s0,concepto==="pri"?(fin<s1?fin:s1):fin);
    const yaPag=(k,filtro)=>NOMS().filter(d=>d.tipo==="prest"&&d.estado!=="anulada"&&filtro(d)).reduce((s,d)=>s+(+((d.lineas||[]).find(l=>l.pid===p.id)||{})[k]||0),0);
    if(concepto==="pri"||concepto==="liquidacion")x.pri=Math.max(0,r0(base*dSem/360)-yaPag("pri",d=>S_(d.f)>=s0&&S_(d.f)<=s1));
    if(concepto==="ces"||concepto==="liquidacion"){const yy=concepto==="ces"?String(+S_(f).slice(0,4)-(+S_(f).slice(5,7)<=2?1:0)):S_(fin).slice(0,4),a=yy+"-01-01",b=concepto==="ces"?yy+"-12-31":fin,d=dias360(ing>a?ing:a,b);x.ces=r0(base*d/360);if(concepto==="liquidacion")x.int=r0(x.ces*d*0.12/360);x.ces=Math.max(0,x.ces-yaPag("ces",d=>S_(d.anioPago)===yy));if(concepto==="liquidacion")x.int=Math.max(0,x.int-yaPag("int",d=>S_(d.anioPago)===yy))}
    if(concepto==="int"){const yy=String(+S_(f).slice(0,4)-(+S_(f).slice(5,7)<=2?1:0)),a=yy+"-01-01",d=dias360(ing>a?ing:a,yy+"-12-31"),ces=r0(base*d/360);x.int=Math.max(0,r0(ces*d*0.12/360)-yaPag("int",d=>S_(d.anioPago)===yy))}
    if(concepto==="vac"||concepto==="liquidacion"){const ganados=dias360(ing,fin)*15/360,pend=Math.max(0,Math.round((ganados-diasVacTomados(p.id))*100)/100);x.diasVac=concepto==="vac"?0:pend;x.vac=concepto==="vac"?0:r0(S/30*pend)}
    if(concepto==="liquidacion")x.vacPend=x.diasVac;
    R[p.id]=x}
  return R}
function vPrest(){const docs=NOMS().filter(d=>d.tipo==="prest"&&d.estado!=="anulada").sort((a,b)=>S_(b.f).localeCompare(S_(a.f))),act=EMPS().filter(p=>p.activo!==false&&enNomina(p)),f=hoy();
  return `${cab("Nómina","Prestaciones y liquidaciones","Prima (junio y diciembre), cesantías (al fondo antes del 14 de febrero), intereses sobre cesantías (al empleado antes del 31 de enero), vacaciones en dinero y liquidación de contrato cuando alguien se retira. Lo que ya está provisionado se descuenta de la provisión.")}
  ${!act.length?`<div class="fp-alerta" style="margin-bottom:12px">Para pagar prestaciones primero registra los empleados con su salario y fecha de ingreso. <button class="btn small primary" data-fin="nomempleados">Ir a Empleados</button></div>`:`<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px">${["pri","ces","int","vac"].map(k=>`<button class="btn ${k==="pri"?"primary":""}" data-fnom-prest="${k}">${esc(TIT_PREST[k])}</button>`).join("")}<button class="btn ghost" data-fnom-liq="">Liquidar contrato…</button></div>`}
  <div class="fin-card"><div class="fin-card-h"><h3>Provisiones acumuladas por empleado</h3><span class="who">lo provisionado en las nóminas menos lo pagado</span></div>${act.length?`<div class="tbl-wrap"><table class="fp-tabla"><thead><tr><th>Empleado</th><th class="r">Cesantías</th><th class="r">Intereses</th><th class="r">Prima</th><th class="r">Vacaciones</th><th class="r">Días de vacaciones pendientes</th></tr></thead><tbody>
    ${act.map(p=>{const D=provDisp(p.id,f),g=Math.max(0,dias360(S_(p.ingreso)||inicioCont(),f)*15/360-diasVacTomados(p.id));return `<tr><td><b>${esc(p.nombre)}</b><div class="who">Ingreso ${p.ingreso?fechaCorta(p.ingreso):"sin fecha"}</div></td><td class="r num">${cop(D.ces)}</td><td class="r num">${cop(D.int)}</td><td class="r num">${cop(D.pri)}</td><td class="r num">${cop(D.vac)}</td><td class="r num">${n2.format(g)}</td></tr>`}).join("")}</tbody></table></div>`:`<div class="empty" style="padding:16px">Sin empleados en nómina.</div>`}</div>
  <div class="fin-card" style="margin-top:12px"><div class="fin-card-h"><h3>Pagos de prestaciones y liquidaciones</h3></div>${docs.length?`<div class="tbl-wrap"><table class="fp-tabla"><thead><tr><th>Fecha</th><th>Concepto</th><th>Empleados</th><th class="r">Valor</th><th>Sale de</th><th></th></tr></thead><tbody>
    ${docs.map(d=>`<tr><td class="num">${fechaCorta(d.f)}</td><td><b>${esc(TIT_PREST[d.concepto]||d.concepto)}</b>${d.periodoTxt?`<div class="who">${esc(d.periodoTxt)}</div>`:""}</td><td>${esc((d.lineas||[]).map(l=>nomE(l.pid)).join(", "))}</td><td class="r num"><b>${cop(d.total)}</b></td><td class="who">${esc(nombreCuenta(d.cuenta))}</td><td class="r" style="white-space:nowrap">${d.concepto==="liquidacion"?`<button class="btn small ghost" data-fnom-liqimp="${esc(d.id)}" title="Imprimir liquidación">⎙</button>`:""}<button class="btn small ghost" data-fnom-prest-borrar="${esc(d.id)}" aria-label="Borrar">×</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty" style="padding:16px">Todavía no hay pagos de prestaciones.</div>`}</div>`}
function modalPrest(){const d=prD,liq=d.concepto==="liquidacion",cols=liq?["ces","int","pri","vac","indem","otros"]:[d.concepto];const tot=Object.values(d.L).filter(x=>x.on!==false).reduce((s,x)=>s+cols.reduce((a,k)=>a+numIn(x[k]),0)-numIn(x.desc),0);
  return `<div class="panel ingreso" style="width:min(900px,calc(100% - 24px))">${fmCab(esc(TIT_PREST[d.concepto]),liq?"Calcula lo que se le debe al empleado al terminar el contrato. Revisa cada valor; la indemnización solo aplica si el despido fue sin justa causa.":"Valores sugeridos con el salario actual y los días trabajados (base ÷ 360). Corrígelos si hace falta.")}
  <div class="fields" style="margin:0;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${liq?`<label class="f">Empleado<select data-fpr="pid">${EMPS().filter(p=>p.activo!==false&&enNomina(p)).map(p=>`<option value="${esc(p.id)}" ${d.pid===p.id?"selected":""}>${esc(p.nombre)}</option>`).join("")}</select></label><label class="f">Fecha de retiro<input type="date" data-fpr="fRet" value="${esc(d.fRet)}"></label><label class="f">Motivo<select data-fpr="motivo">${["Renuncia","Terminación con justa causa","Despido sin justa causa","Fin del contrato a término fijo","Fin de la obra o labor","Mutuo acuerdo"].map(m=>`<option ${d.motivo===m?"selected":""}>${m}</option>`).join("")}</select></label>`:""}
    <label class="f">Fecha del pago<input type="date" data-fpr="f" value="${esc(d.f)}"></label><label class="f">Sale de<select data-fpr="cuenta">${opcCuentas(d.cuenta)}</select></label><label class="f">Periodo<input data-fpr="periodoTxt" value="${esc(d.periodoTxt||"")}"></label></div>
  ${liq?(()=>{const x=Object.values(d.L)[0];if(!x)return "";const D=provDisp(x.pid,d.f),fila=(k,t,ayuda)=>`<label class="f">${t}<input data-fprv="${esc(x.pid)}|${k}" value="${esc(x[k]??"")}" inputmode="${k==="diasVac"?"decimal":"numeric"}">${ayuda?`<small class="who">${ayuda}</small>`:""}</label>`;
    return `<div class="fields" style="margin-top:12px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">${fila("ces","Cesantías","Provisionado: "+cop(D.ces))}${fila("int","Intereses sobre cesantías","Provisionado: "+cop(D.int))}${fila("pri","Prima de servicios","Provisionado: "+cop(D.pri))}${fila("vac","Vacaciones pendientes","Provisionado: "+cop(D.vac))}${fila("diasVac","Días de vacaciones pendientes","")}${fila("indem","Indemnización","Solo despido sin justa causa")}${fila("otros","Otros pagos","")}${fila("desc","Descuento de préstamo","Lo que aún debe")}</div>`})():`<div class="tbl-wrap" style="margin-top:10px"><table class="fp-tabla sin-busca"><thead><tr><th></th><th>Empleado</th>${cols.map(k=>`<th class="r">${esc(NOM_CON[k])}</th>`).join("")}${d.concepto==="vac"||liq?`<th class="r">Días de vacaciones</th>`:""}<th class="r">Descuento de préstamo</th><th class="r">Provisionado</th></tr></thead><tbody>
  ${Object.values(d.L).map(x=>{const D=provDisp(x.pid,d.f);return `<tr>${liq?"":`<td><input type="checkbox" data-fpr-on="${esc(x.pid)}" ${x.on!==false?"checked":""} aria-label="Incluir a ${esc(x.nombre)}"></td>`}<td>${esc(x.nombre)}</td>${cols.map(k=>`<td class="r"><input class="inline-num" data-fprv="${esc(x.pid)}|${k}" value="${esc(x[k])}" inputmode="numeric" style="width:110px"></td>`).join("")}${d.concepto==="vac"||liq?`<td class="r"><input class="inline-num" data-fprv="${esc(x.pid)}|diasVac" value="${esc(x.diasVac)}" inputmode="decimal" style="width:70px"></td>`:""}<td class="r"><input class="inline-num" data-fprv="${esc(x.pid)}|desc" value="${esc(x.desc)}" inputmode="numeric" style="width:100px"></td><td class="r who">${cols.filter(k=>D[k]!=null).map(k=>cop(D[k])).join(" · ")||"—"}</td></tr>`}).join("")}</tbody></table></div>`}
  ${d.concepto==="vac"?`<p class="who">Las vacaciones en dinero solo se permiten por acuerdo y hasta la mitad de los días (art. 189 CST). Valor sugerido: salario ÷ 30 × días.</p>`:""}
  <div class="fp-tot" style="margin-top:12px"><div class="fp-gran"><span>Total a pagar</span><span class="num">${cop(tot)}</span></div></div>
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-fm-cerrar="1">Cancelar</button><button class="btn primary" data-fpr-guardar="1">${liq?"Registrar liquidación y retiro":"Registrar pago"}</button></div></div>`}

// ---------- Informes ----------
function datosAnio(y){const E={};for(const n of NOMS()){if(n.tipo!=="nomina"||n.estado!=="contabilizada"||!S_(n.f).startsWith(y))continue;for(const x of n.calc.lineas){const e=(E[x.pid] ||= {pid:x.pid,nombre:x.nombre,sal:0,extras:0,bonos:0,noSal:0,aux:0,vac:0,saludE:0,pensionE:0,fsp:0,ret:0,ces:0,int:0,pri:0,vacD:0,indem:0,dev:0,ss:0});
    e.sal+=x.sueldo+x.incap;e.vac+=x.vacPago;e.extras+=x.extras;e.bonos+=x.bonoS;e.noSal+=x.noSal;e.aux+=x.aux;e.saludE+=x.saludE;e.pensionE+=x.pensionE;e.fsp+=x.fsp;e.ret+=x.ret;e.dev+=x.devengado;e.ss+=x.saludR+x.pensionR+x.arl}}
  for(const d of NOMS()){if(d.tipo!=="prest"||d.estado==="anulada"||!S_(d.f).startsWith(y))continue;for(const l of d.lineas||[]){const e=(E[l.pid] ||= {pid:l.pid,nombre:nomE(l.pid),sal:0,extras:0,bonos:0,noSal:0,aux:0,vac:0,saludE:0,pensionE:0,fsp:0,ret:0,ces:0,int:0,pri:0,vacD:0,indem:0,dev:0,ss:0});e.ces+=r0(l.ces);e.int+=r0(l.int);e.pri+=r0(l.pri);e.vacD+=r0(l.vac);e.indem+=r0(l.indem)+r0(l.otros)}}
  return Object.values(E)}
function vInformes(){const anios=[...new Set(NOMS().map(n=>S_(n.f).slice(0,4)).filter(Boolean).concat(hoy().slice(0,4)))].sort().reverse();
  const tabs=[["mes","Resumen por mes"],["emp","Acumulado por empleado"],["cert","Certificados de ingresos y retenciones"]];
  let cuerpo="";
  if(infTab==="mes"){const M={};for(const n of NOMS()){if(n.tipo!=="nomina"||n.estado!=="contabilizada"||!S_(n.f).startsWith(infAnio))continue;const m=S_(n.f).slice(0,7),t=n.calc.tot,x=(M[m] ||= {dev:0,ded:0,neto:0,ap:0,prov:0,costo:0,n:0});x.dev+=t.devengado;x.ded+=t.deducciones;x.neto+=t.neto;x.ap+=t.aportes;x.prov+=t.prov;x.costo+=t.costo;x.n++}
    const L=Object.entries(M).sort(),T=L.reduce((s,[,x])=>{for(const k in x)s[k]=(s[k]||0)+x[k];return s},{});
    cuerpo=L.length?`<div class="tbl-wrap"><table class="fp-tabla"><thead><tr><th>Mes</th><th class="r">Nóminas</th><th class="r">Devengado</th><th class="r">Deducciones</th><th class="r">Neto pagado a empleados</th><th class="r">Aportes del empleador</th><th class="r">Provisiones</th><th class="r">Costo total</th></tr></thead><tbody>${L.map(([m,x])=>`<tr><td>${esc(mesLargo(m))}</td><td class="r num">${x.n}</td><td class="r num">${cop(x.dev)}</td><td class="r num">${cop(x.ded)}</td><td class="r num">${cop(x.neto)}</td><td class="r num">${cop(x.ap)}</td><td class="r num">${cop(x.prov)}</td><td class="r num"><b>${cop(x.costo)}</b></td></tr>`).join("")}</tbody><tfoot><tr><td><b>Total ${esc(infAnio)}</b></td><td class="r num">${T.n}</td><td class="r num">${cop(T.dev)}</td><td class="r num">${cop(T.ded)}</td><td class="r num">${cop(T.neto)}</td><td class="r num">${cop(T.ap)}</td><td class="r num">${cop(T.prov)}</td><td class="r num"><b>${cop(T.costo)}</b></td></tr></tfoot></table></div>`:`<div class="empty" style="padding:16px">No hay nóminas contabilizadas en ${esc(infAnio)}.</div>`}
  else{const E=datosAnio(infAnio);
    cuerpo=E.length?`<div class="tbl-wrap"><table class="fp-tabla"><thead><tr><th>Empleado</th><th class="r">Salarios</th><th class="r">Extras y bonos</th><th class="r">Auxilio de transporte</th><th class="r">Vacaciones</th><th class="r">Prestaciones pagadas</th><th class="r">Salud y pensión (empleado)</th><th class="r">Retención</th><th></th></tr></thead><tbody>${E.map(e=>`<tr><td><b>${esc(e.nombre)}</b></td><td class="r num">${cop(e.sal)}</td><td class="r num">${cop(e.extras+e.bonos+e.noSal)}</td><td class="r num">${cop(e.aux)}</td><td class="r num">${cop(e.vac+e.vacD)}</td><td class="r num">${cop(e.ces+e.int+e.pri)}</td><td class="r num">${cop(e.saludE+e.pensionE+e.fsp)}</td><td class="r num">${cop(e.ret)}</td><td class="r">${infTab==="cert"?`<button class="btn small" data-fnom-cert="${esc(e.pid)}">⎙ Certificado</button>`:""}</td></tr>`).join("")}</tbody></table></div>
      ${infTab==="cert"?`<p class="who" style="margin-top:8px">Certificado de ingresos y retenciones por rentas de trabajo (formulario 220) del año ${esc(infAnio)}. Se entrega a cada empleado antes de marzo. Los mismos valores van al formato 2276 de la exógena.</p>`:""}`:`<div class="empty" style="padding:16px">Sin pagos laborales en ${esc(infAnio)}.</div>`}
  return `${cab("Nómina","Informes de nómina","Lo que cuesta la nómina, lo que recibió cada empleado y los certificados de ingresos y retenciones.",`<label class="f" style="margin:0">Año<select data-fnom-anio="1">${anios.map(y=>`<option ${y===infAnio?"selected":""}>${y}</option>`).join("")}</select></label>`)}
  <div class="tabs" role="tablist" style="margin-bottom:12px">${tabs.map(([k,t])=>`<button role="tab" data-fnom-inf="${k}" aria-selected="${infTab===k}">${t}</button>`).join("")}</div><div class="fin-card">${cuerpo}</div>`}

// ---------- Configuración ----------
let cfgD=null;
function vNomCfg(){const d=cfgD||(cfgD=clone(cfgN())),P=d.pct;
  const inp=(k,t,v,ayuda="")=>`<label class="f">${t}<input data-fnc="${k}" value="${esc(S_(v).replace(".",","))}" inputmode="decimal">${ayuda?`<small class="who">${ayuda}</small>`:""}</label>`;
  return `${cab("Nómina","Configuración de nómina","Valores de ley que usa la liquidación. Vienen con los de 2026; confírmalos con Oswaldo y cámbialos cada enero. Cambiarlos no altera las nóminas ya contabilizadas.",`<button class="btn primary" data-fnc-guardar="1">Guardar</button>`)}
  <div class="fp-cfg"><h2>Periodicidad y valores del año</h2><div class="fp-grid">
    <label class="f">Se paga<select data-fnc="per"><option value="quincenal" ${d.per==="quincenal"?"selected":""}>Cada quincena</option><option value="mensual" ${d.per==="mensual"?"selected":""}>Cada mes</option></select></label>
    ${inp("smmlv","Salario mínimo mensual",d.smmlv)}${inp("aux","Auxilio de transporte mensual",d.aux,"Para quienes ganan hasta 2 salarios mínimos")}${inp("horas","Horas de la jornada al mes",d.horas,"210 h desde el 15 de julio de 2026 (42 h por semana)")}
    <label class="f">Cuenta de pago habitual<select data-fnc="cuenta">${opcCuentas(d.cuenta)}</select></label><label class="f">ARL de la empresa<input data-fnc="arlNombre" value="${esc(d.arlNombre||"")}" placeholder="Ej. Positiva"></label></div></div>
  <div class="fp-cfg"><h2>Aportes del empleado</h2><div class="fp-grid">${inp("pct.saludE","Salud (%)",P.saludE)}${inp("pct.pensionE","Pensión (%)",P.pensionE)}${inp("pct.fsp","Fondo de solidaridad (%)",P.fsp,"Desde 4 salarios mínimos")}</div></div>
  <div class="fp-cfg"><h2>Aportes y parafiscales del empleador</h2><div class="fp-grid">${inp("pct.saludR","Salud (%)",P.saludR)}${inp("pct.pensionR","Pensión (%)",P.pensionR)}${inp("pct.caja","Caja de compensación (%)",P.caja)}${inp("pct.icbf","ICBF (%)",P.icbf)}${inp("pct.sena","SENA (%)",P.sena)}</div>
    <label class="chk" style="margin-top:10px"><input type="checkbox" data-fnc="exon" ${d.exon?"checked":""}> Exonerado de salud, ICBF y SENA para quienes ganan menos de 10 salarios mínimos (art. 114-1 del Estatuto Tributario). Una persona natural solo aplica si tiene 2 o más empleados: pregúntale a Oswaldo.</label>
    <h3 style="margin:12px 0 6px;font-size:14px">ARL por clase de riesgo (%)</h3><div class="fp-grid">${Object.keys(d.arl).map(k=>inp("arl."+k,"Clase "+k,d.arl[k])).join("")}</div></div>
  <div class="fp-cfg"><h2>Provisiones de prestaciones (%)</h2><div class="fp-grid">${inp("pct.ces","Cesantías",P.ces)}${inp("pct.int","Intereses sobre cesantías",P.int)}${inp("pct.pri","Prima de servicios",P.pri)}${inp("pct.vac","Vacaciones",P.vac)}</div></div>
  <div class="fp-cfg"><h2>Horas extra y recargos (% adicional)</h2><div class="fp-grid">${inp("pct.hed","Extra diurna",P.hed)}${inp("pct.hen","Extra nocturna",P.hen)}${inp("pct.rn","Recargo nocturno",P.rn)}${inp("pct.rdf","Recargo dominical o festivo",P.rdf,"90 % desde julio de 2026; 100 % desde julio de 2027")}</div></div>
  <div class="fp-cfg"><h2>Bonos de las órdenes de trabajo</h2><p>Cómo entran a la nómina los bonos de eficiencia registrados en las OT.</p><select data-fnc="bonoOT"><option value="salarial" ${d.bonoOT!=="nosalarial"?"selected":""}>Salariales (suman para aportes y prestaciones)</option><option value="nosalarial" ${d.bonoOT==="nosalarial"?"selected":""}>No salariales (requiere pacto escrito con el empleado)</option></select></div>`}

// ---------- Nómina electrónica (apagada) ----------
function vNomElec(){const act=EMPS().filter(p=>p.activo!==false&&enNomina(p)),falt=p=>[!p.doc&&"documento",!p.ingreso&&"fecha de ingreso",!(+p.salario>0)&&"salario",!p.contrato&&"tipo de contrato",!p.cuentaNum&&"cuenta de pago"].filter(Boolean);
  const meses=[...new Set(NOMS().filter(n=>n.tipo==="nomina"&&n.estado==="contabilizada").map(n=>S_(n.f).slice(0,7)))].sort().reverse();const T=trib();
  return `${cab("Nómina","Nómina electrónica","Cada mes se envía a la DIAN un documento soporte de pago de nómina por empleado. Queda apagada hasta que termines el trámite de habilitación ante la DIAN.")}
  <div class="fp-alerta" style="margin-bottom:12px"><b>Apagada.</b> El sistema ya guarda todo lo que pide el documento (devengos, deducciones, días, datos del empleado). Cuando tengas la habilitación en el portal de la DIAN (o un proveedor tecnológico), se conecta y se encienden los envíos.</div>
  <div class="grid2"><div class="fin-card"><div class="fin-card-h"><h3>Lista de requisitos</h3></div>${[[!!T.doc,"NIT o cédula de la empresa en Empresa y tributario"],[false,"Habilitación como emisor de nómina electrónica (portal DIAN)"],[false,"Set de pruebas aprobado"],[false,"Software o proveedor tecnológico conectado"],[act.length>0&&act.every(p=>!falt(p).length),"Datos completos de los empleados"]].map(([ok,t])=>`<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px solid var(--line)"><span style="color:${ok?"var(--ok)":"var(--muted)"};font-weight:700">${ok?"✓":"○"}</span><span>${esc(t)}</span></div>`).join("")}</div>
    <div class="fin-card"><div class="fin-card-h"><h3>Datos de los empleados</h3></div>${act.length?act.map(p=>{const f=falt(p);return `<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(p.nombre)}</span>${f.length?`<span class="who" style="color:var(--warn)">Falta: ${esc(f.join(", "))}</span>`:`<span class="pill st-aprobada">Completo</span>`}</div>`}).join(""):`<div class="empty" style="padding:12px">Sin empleados en nómina.</div>`}</div></div>
  <div class="fin-card" style="margin-top:12px"><div class="fin-card-h"><h3>Documentos que se enviarían</h3></div>${meses.length?`<div class="tbl-wrap"><table class="fp-tabla"><thead><tr><th>Mes</th><th class="r">Empleados</th><th class="r">Devengado</th><th class="r">Deducciones</th><th>Estado</th></tr></thead><tbody>${meses.map(m=>{const N=NOMS().filter(n=>n.tipo==="nomina"&&n.estado==="contabilizada"&&S_(n.f).startsWith(m)),ids=new Set(N.flatMap(n=>n.calc.lineas.map(l=>l.pid)));return `<tr><td>${esc(mesLargo(m))}</td><td class="r num">${ids.size}</td><td class="r num">${cop(N.reduce((s,n)=>s+n.calc.tot.devengado,0))}</td><td class="r num">${cop(N.reduce((s,n)=>s+n.calc.tot.deducciones,0))}</td><td><span class="pill st-borrador">Sin enviar (apagada)</span></td></tr>`}).join("")}</tbody></table></div>`:`<div class="empty" style="padding:16px">Aparecen cuando contabilices nóminas.</div>`}</div>`}

/* ======================= impresión ======================= */
function hoja(titulo,cuerpo){const T=trib(),w=window.open("","_blank");if(!w){toast("Permite las ventanas emergentes para ver el documento");return}
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font:13px system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 18px;color:#1f2326}.cab{display:flex;justify-content:space-between;gap:12px;border-bottom:2px solid #13233f;padding-bottom:10px;margin-bottom:12px}h1{font-size:18px;margin:0}h2{font-size:15px;margin:18px 0 6px}.n{font-size:15px;font-weight:800;text-align:right}table{width:100%;border-collapse:collapse;margin-top:8px}td,th{border-bottom:1px solid #dde;padding:6px;text-align:left}.r{text-align:right}.g{font-weight:800}small{color:#667}.hoja{page-break-after:always}.hoja:last-child{page-break-after:auto}.firma{margin-top:44px;display:flex;gap:40px}.firma div{flex:1;border-top:1px solid #333;padding-top:4px;font-size:12px}@media print{body{margin:0}}</style>
  ${cuerpo}<script>setTimeout(()=>print(),300)<\/script>`);w.document.close()}
const cabEmpresa=(t2,num)=>{const T=trib();return `<div class="cab"><div>${T.logo?`<img src="${T.logo}" alt="" style="max-height:52px;max-width:170px;display:block;margin-bottom:6px">`:""}<h1>${esc(T.comercial||T.razon||precios.empresa?.nombre||"TEKALUM")}</h1><small>${esc([T.razon,T.doc?(T.tipoDoc==="NIT"?"NIT ":"C.C. ")+T.doc+(T.dv?"-"+T.dv:""):"",T.dir,T.ciudad].filter(Boolean).join(" · "))}</small></div><div class="n">${t2}${num?"<br>"+esc(num):""}</div></div>`};
function desprendibles(n,pid){const P=periodoDe(n.periodo),L=calcNom(n).lineas.filter(x=>!pid||pid==="all"||x.pid===pid);
  hoja("Desprendibles "+(n.num||""),L.map(x=>{const p=emp(x.pid)||{},fila=(t,v)=>v?`<tr><td>${t}</td><td class="r">${cop(v)}</td></tr>`:"";return `<div class="hoja">${cabEmpresa("DESPRENDIBLE DE PAGO",n.num)}
  <p><b>${esc(x.nombre)}</b>${p.doc?" · "+esc((p.tipoDoc||"CC")+" "+p.doc):""} · ${esc(p.rol||"")}<br>Periodo: <b>${esc(P.nombre)}</b> (${fechaCorta(P.desde)} a ${fechaCorta(P.hasta)}) · Salario básico: ${cop(x.salario)} · Días: ${x.dias}</p>
  <table><thead><tr><th>Devengos</th><th class="r">Valor</th></tr></thead><tbody>${fila("Sueldo ("+x.trab+" días)",x.sueldo)}${fila("Vacaciones ("+x.vac+" días)",x.vacPago)}${fila("Incapacidad ("+x.inc+" días)",x.incap)}${fila("Horas extra y recargos",x.extras)}${fila("Bonos y comisiones",x.bonoS)}${fila("Pagos no salariales",x.noSal)}${fila("Auxilio de transporte",x.aux)}<tr class="g"><td>Total devengado</td><td class="r">${cop(x.devengado)}</td></tr></tbody></table>
  <table><thead><tr><th>Deducciones</th><th class="r">Valor</th></tr></thead><tbody>${fila("Salud",x.saludE)}${fila("Pensión",x.pensionE)}${fila("Fondo de solidaridad pensional",x.fsp)}${fila("Retención en la fuente",x.ret)}${fila("Préstamo o anticipo",x.prestamo)}${fila("Otros descuentos",x.otrosDesc)}<tr class="g"><td>Total deducciones</td><td class="r">${cop(x.deducciones)}</td></tr></tbody></table>
  <table><tbody><tr class="g"><td>NETO A PAGAR</td><td class="r">${cop(x.neto)}</td></tr></tbody></table>${p.banco||p.cuentaNum?`<p><small>Se paga a: ${esc([p.banco,p.cuentaNum].filter(Boolean).join(" · "))}</small></p>`:""}
  <div class="firma"><div>Firma del empleador</div><div>Recibí conforme · ${esc(x.nombre)}</div></div></div>`}).join(""))}
function certificado(pid,y){const e=datosAnio(y).find(x=>x.pid===pid);if(!e)return;const p=emp(pid)||{},T=trib(),fila=(t,v)=>`<tr><td>${t}</td><td class="r">${cop(v)}</td></tr>`;
  const sal=e.sal+e.extras+e.bonos+e.aux+e.noSal,pres=e.ces+e.int+e.pri+e.vac+e.vacD,tot=sal+pres+e.indem;
  hoja("Certificado de ingresos y retenciones "+y,`<div class="hoja">${cabEmpresa("CERTIFICADO DE INGRESOS Y RETENCIONES<br><small>por rentas de trabajo · año gravable "+esc(y)+"</small>","")}
  <p>Retenedor: <b>${esc(T.razon||T.comercial||"TEKALUM")}</b>${T.doc?" · "+esc((T.tipoDoc==="NIT"?"NIT ":"C.C. ")+T.doc+(T.dv?"-"+T.dv:"")):""}<br>Trabajador: <b>${esc(e.nombre)}</b>${p.doc?" · "+esc((p.tipoDoc||"CC")+" "+p.doc):""}<br>Periodo: 01/01/${esc(y)} a 31/12/${esc(y)}${p.retiro&&S_(p.retiro).startsWith(y)?" (retiro "+fechaCorta(p.retiro)+")":""}</p>
  <h2>Ingresos</h2><table><tbody>${fila("Pagos por salarios",e.sal+e.extras+e.bonos)}${fila("Auxilio de transporte y otros pagos",e.aux+e.noSal)}${fila("Cesantías e intereses sobre cesantías",e.ces+e.int)}${fila("Prima de servicios",e.pri)}${fila("Vacaciones",e.vac+e.vacD)}${e.indem?fila("Indemnizaciones y otros",e.indem):""}<tr class="g"><td>Total ingresos brutos</td><td class="r">${cop(tot)}</td></tr></tbody></table>
  <h2>Aportes y retención</h2><table><tbody>${fila("Aportes obligatorios a salud (trabajador)",e.saludE)}${fila("Aportes obligatorios a pensión y solidaridad (trabajador)",e.pensionE+e.fsp)}${fila("Valor de la retención en la fuente",e.ret)}</tbody></table>
  <p><small>Valores tomados de las nóminas y pagos de prestaciones registrados en TEKALUM. El formulario oficial es el 220 de la DIAN; el contador lo revisa antes de entregarlo.</small></p><div class="firma"><div>Firma del retenedor</div></div></div>`)}
function imprimirLiq(d){const l=(d.lineas||[])[0];if(!l)return;const p=emp(l.pid)||{},fila=(t,v)=>+v?`<tr><td>${t}</td><td class="r">${cop(v)}</td></tr>`:"";
  hoja("Liquidación de contrato",`<div class="hoja">${cabEmpresa("LIQUIDACIÓN DE CONTRATO","")}<p>Empleado: <b>${esc(p.nombre||l.nombre)}</b>${p.doc?" · "+esc((p.tipoDoc||"CC")+" "+p.doc):""}<br>Ingreso: ${p.ingreso?fechaCorta(p.ingreso):"—"} · Retiro: ${fechaCorta(d.fRet||p.retiro)} · Motivo: ${esc(d.motivo||"")}<br>Salario básico: ${cop(p.salario)}</p>
  <table><tbody>${fila("Cesantías",l.ces)}${fila("Intereses sobre cesantías",l.int)}${fila("Prima de servicios",l.pri)}${fila("Vacaciones ("+(l.diasVac||0)+" días)",l.vac)}${fila("Indemnización",l.indem)}${fila("Otros pagos",l.otros)}${+l.desc?`<tr><td>Menos préstamos</td><td class="r">− ${cop(l.desc)}</td></tr>`:""}<tr class="g"><td>Total a pagar</td><td class="r">${cop(d.total)}</td></tr></tbody></table>
  <p><small>Los salarios del último periodo se pagan en la nómina correspondiente.</small></p><div class="firma"><div>Firma del empleador</div><div>Recibí a satisfacción · ${esc(p.nombre||"")}</div></div></div>`)}

/* ======================= exógena 2276 y alertas ======================= */
if(typeof exogenaDe==="function"){const _ex=exogenaDe;exogenaDe=function(anio,...r){const R=_ex(anio,...r);try{const E=datosAnio(String(anio));for(const e of E){const p=emp(e.pid);const k=normNom(e.nombre);let x=(R.f2276||[]).find(y=>normNom(y.nombre)===k);
    if(!x){x={...datosExo(e.nombre),nombre:e.nombre,sal:0,pres:0,otros:0,ss:0};if(p?.doc){x.doc=x.doc||p.doc;x.tipo=x.tipo||({CC:"13",CE:"22",PA:"41",TI:"12",PPT:"47"}[p.tipoDoc||"CC"]||"13")}(R.f2276 ||= []).push(x)}
    x.sal+=e.sal+e.extras+e.bonos;x.pres+=e.ces+e.int+e.pri+e.vac+e.vacD;x.otros+=e.aux+e.noSal+e.indem;x.ss+=e.ss}}catch(err){console.warn("2276 nómina",err)}return R}}
{const _ax=window.auditoriaExtra;window.auditoriaExtra=()=>{const R=_ax?_ax():[];try{
  const meses=new Set(NOMS().filter(n=>n.tipo==="nomina"&&n.estado==="contabilizada").map(n=>S_(n.f).slice(0,7)));
  const dob=store.egresos.filter(e=>["obrero","nominaAdmin","segSocial","segSocialAdmin"].includes(e.cat)&&meses.has(S_(e.f).slice(0,7))&&esReal(e));
  if(dob.length)R.push(["alta","Sueldos registrados dos veces",`Hay ${dob.length} egreso(s) de sueldos o seguridad social en meses que ya tienen nómina liquidada. La nómina ya los incluye: revisa si sobran.`,"egresos"]);
  for(const m of meses){const f=pilaMes(m).total-pilaPagada(m);if(f>1000&&hoy()>sumaMes(m,1)+"-10")R.push(["alta","PILA sin pagar · "+mesLargo(m),`Faltan ${cop(f)} de seguridad social y parafiscales. Paga la planilla para evitar intereses de mora.`,"nompagos"])}
  const pend=NOMS().filter(n=>n.tipo==="nomina"&&n.estado==="contabilizada"&&pendNom(n)>0&&S_(n.f)<hoy()&&diasDesde(n.f)>5);
  if(pend.length)R.push(["media","Salarios sin pagar",`${pend.map(n=>n.num).join(", ")}: hay netos sin pagar a empleados después de 5 días.`,"nompagos"]);
  const bor=NOMS().filter(n=>n.tipo==="nomina"&&n.estado==="borrador"&&periodoDe(n.periodo).hasta<hoy());if(bor.length)R.push(["media","Nómina sin contabilizar",`${bor.map(n=>periodoDe(n.periodo).nombre).join(", ")} está en borrador.`,"nomina"]);
  const falt=EMPS().filter(p=>p.activo!==false&&p.contrato!=="servicios"&&(+p.salario>0)&&(!p.doc||!p.ingreso));if(falt.length)R.push(["baja","Empleados con datos incompletos",`${falt.map(p=>p.nombre).join(", ")}: falta documento o fecha de ingreso (los pide la PILA y la nómina electrónica).`,"nomempleados"]);
  const faltan=f=>Math.round((Date.parse(S_(f).slice(0,10))-Date.parse(hoy()))/864e5),fin=EMPS().filter(p=>p.activo!==false&&p.contrato==="fijo"&&p.finContrato&&faltan(p.finContrato)>=0&&faltan(p.finContrato)<=35);if(fin.length)R.push(["media","Contratos a término fijo por vencer",`${fin.map(p=>p.nombre+" ("+fechaCorta(p.finContrato)+")").join(", ")}: el preaviso es de 30 días; si no se avisa, se renueva por el mismo tiempo.`,"nomempleados"]);
  }catch(err){console.warn(err)}return R}}

/* ======================= registro de vistas, menú y accesos ======================= */
const conModalN=f=>()=>f()+(finModal==="fnomemp"&&empD?modalEmp():finModal==="fnomnov"&&novD?modalNov():finModal==="fnompago"&&pagoD?modalPago():finModal==="fnompila"&&pilaD?modalPila():finModal==="fnomprest"&&prD?modalPrest():"");
Object.assign(FINX,{nomina:conModalN(vNomina),nomempleados:conModalN(vEmpleados),nompagos:conModalN(vPagos),nomprest:conModalN(vPrest),nominformes:conModalN(vInformes),nomcfg:conModalN(vNomCfg),nomelec:conModalN(vNomElec)});
for(const k of Object.keys(FINX))if(!finVistas.includes(k))finVistas.push(k);
if(!AREAS_FIN.some(a=>a.id==="nomina")){const i=AREAS_FIN.findIndex(a=>a.id==="bancos");AREAS_FIN.splice(i<0?3:i,0,{id:"nomina",t:"Nómina",i:IC.personal,subs:[["nomina","Liquidar nómina"],["nomempleados","Empleados"],["nompagos","Pagos y PILA"],["nomprest","Prestaciones y liquidaciones"],["nominformes","Informes de nómina"],["nomcfg","Configuración de nómina"],["nomelec","Nómina electrónica"]]})}
try{const g=CREAR_FIN.find(x=>x[0]==="Compras y gastos");if(g&&!g[1].some(x=>x[2].includes("fnom")))g[1].push(["personal","Liquidación de nómina",'data-fnom-nueva="1"'])}catch{}
try{if(!ACCESOS_FIN.some(x=>x[2].includes("nomina")))ACCESOS_FIN.splice(Math.min(5,ACCESOS_FIN.length),0,["personal","Liquida la nómina",'data-fin="nomina"'])}catch{}

/* ======================= acciones ======================= */
const abrir=(m)=>{finModal=m;render();setTimeout(()=>document.querySelector(".fin-main .panel.ingreso input:not([type=date]):not([type=checkbox]),.fin-main .panel.ingreso select")?.focus(),40)};
const nuevaLinea=(p,P)=>({pid:p.id,nombre:p.nombre,salario:+p.salario||0,dias:diasEmp(p,P)});
async function crearNomina(){const per=siguientePeriodo(),P=periodoDe(per);
  if(NOMS().some(n=>n.tipo==="nomina"&&n.periodo===per&&n.estado!=="anulada")){toast("Ya existe la nómina de "+P.nombre);return}
  const E=EMPS().filter(p=>p.activo!==false&&enNomina(p)&&(!p.ingreso||S_(p.ingreso)<=P.hasta)&&(!p.retiro||S_(p.retiro)>=P.desde));
  if(!E.length){toast("No hay empleados activos con salario. Regístralos en Nómina › Empleados.");vista="nomempleados";render();return}
  if(mesCerrado(P.mes)){toast(mesLargo(P.mes)+" está cerrado en Contabilidad");return}
  const id=await guardar("nominas",null,{tipo:"nomina",periodo:per,f:P.hasta,estado:"borrador",lineas:E.map(p=>nuevaLinea(p,P)),creado:new Date().toISOString(),por:yo()});
  nomSel=id;vista="nomina";render();scrollTo(0,0)}
document.addEventListener("click",async e=>{const t=e.target.closest("[data-fnom-emp],[data-fnom-emp-guardar],[data-fnom-filtro],[data-fnom-nueva],[data-fnom-abrir],[data-fnom-volver],[data-fnom-nov],[data-fnov-guardar],[data-fnom-sync],[data-fnom-bonos],[data-fnom-borrar],[data-fnom-contab],[data-fnom-anular],[data-fnom-desp],[data-fnom-pagar],[data-fnp-guardar],[data-fnom-pila],[data-fpl-guardar],[data-fnom-pila-borrar],[data-fnom-prest],[data-fnom-liq],[data-fpr-guardar],[data-fnom-prest-borrar],[data-fnom-liqimp],[data-fnom-inf],[data-fnom-cert],[data-fnc-guardar]");if(!t)return;const d=t.dataset;
  try{
    if(d.fnomEmp!==undefined){const p=d.fnomEmp==="nuevo"?null:emp(d.fnomEmp);empD=p?{...clone(p),contrato:p.contrato||"indefinido",tipoDoc:p.tipoDoc||"CC",aux:p.aux||"auto",area:areaDe(p),riesgo:p.riesgo||(areaDe(p)==="admin"?"I":"III")}:{nombre:"",rol:ROLES[0],area:"taller",contrato:"indefinido",tipoDoc:"CC",aux:"auto",riesgo:"III",activo:true,ingreso:hoy()};if(empD.salario)empD.salario=String(empD.salario);abrir("fnomemp");return}
    if(d.fnomEmpGuardar){const x=empD;if(!S_(x.nombre).trim())return toast("Escribe el nombre");const sal=numIn(x.salario),c=cfgN();
      if(x.contrato!=="servicios"&&sal&&sal<c.smmlv&&!confirm(`El salario (${cop(sal)}) es menor que el mínimo (${cop(c.smmlv)}). Solo se permite si es medio tiempo. ¿Guardar así?`))return;
      if(x.doc&&EMPS().some(p=>p.id!==x.id&&p.doc&&S_(p.doc)===S_(x.doc)))return toast("Ya hay otro empleado con ese documento");
      const old=x.id?emp(x.id):null,data={...(old||{}),...x,nombre:S_(x.nombre).trim(),salario:sal,doc:S_(x.doc).replace(/\D/g,""),activo:x.activo!==false};delete data.id;
      await guardar("personal",x.id||null,data,"Empleado guardado");finModal=null;empD=null;render();return}
    if(d.fnomFiltro){empFiltro=d.fnomFiltro;render();return}
    if(d.fnomNueva){if(vista!=="nomina"){vista="nomina";nomSel=null}await crearNomina();return}
    if(d.fnomAbrir){nomSel=d.fnomAbrir;render();scrollTo(0,0);return}
    if(d.fnomVolver){nomSel=null;render();return}
    const n=NOMS().find(x=>x.id===nomSel);
    if(d.fnomNov!==undefined){const L=n.lineas[+d.fnomNov];novD={i:+d.fnomNov,v:Object.fromEntries(["dias","vac","inc","lic","hed","hen","rn","rdf","otrasH","bonoS","bonoN","otroN","prestamo","otrosDesc","ret","nota"].map(k=>[k,L[k]??(k==="dias"?L.dias:"")]))};abrir("fnomnov");return}
    if(d.fnovGuardar){const v={...novD.v},P=periodoDe(n.periodo);for(const k of Object.keys(v))if(k!=="nota")v[k]=["hed","hen","rn","rdf","dias","vac","inc","lic"].includes(k)?horasIn(v[k]):numIn(v[k]);
      if(v.dias>P.dias)return toast("Los días no pueden pasar de "+P.dias);if(v.vac+v.inc+v.lic>v.dias)return toast("Vacaciones, incapacidad y licencia no pueden sumar más que los días del periodo");
      const L=n.lineas.slice();L[novD.i]={...L[novD.i],...v};await guardar("nominas",n.id,{...n,lineas:L});finModal=null;novD=null;render();return}
    if(d.fnomSync){const P=periodoDe(n.periodo),E=EMPS().filter(p=>p.activo!==false&&enNomina(p)&&(!p.ingreso||S_(p.ingreso)<=P.hasta)&&(!p.retiro||S_(p.retiro)>=P.desde));
      const L=n.lineas.filter(l=>E.some(p=>p.id===l.pid)).map(l=>({...l,salario:+emp(l.pid).salario||l.salario,nombre:emp(l.pid).nombre}));for(const p of E)if(!L.some(l=>l.pid===p.id))L.push(nuevaLinea(p,P));
      await guardar("nominas",n.id,{...n,lineas:L},"Lista de empleados actualizada");render();return}
    if(d.fnomBonos){const P=periodoDe(n.periodo),usados=new Set(NOMS().filter(x=>x.tipo==="nomina"&&x.estado!=="anulada"&&x.id!==n.id).flatMap(x=>(x.lineas||[]).flatMap(l=>l.ots||[])));
      const B={};for(const o of store.ordenes||[]){if(!o.bono?.valor||usados.has(o.id))continue;const f=S_(o.bono.f).slice(0,10);if(f<P.desde||f>P.hasta)continue;const A=(o.asignados||[]).filter(pid=>n.lineas.some(l=>l.pid===pid));if(!A.length)continue;for(const pid of A){const x=(B[pid] ||= {v:0,ots:[]});x.v+=(+o.bono.valor)/(o.asignados.length||1);x.ots.push(o.id)}}
      if(!Object.keys(B).length)return toast("No hay bonos de OT registrados en este periodo");const campo=cfgN().bonoOT==="nosalarial"?"bonoN":"bonoS";
      const L=n.lineas.map(l=>{const b=B[l.pid];if(!b)return {...l,ots:[]};const prev=(l.ots||[]).length?0:0;return {...l,[campo]:r0(b.v)+prev,ots:b.ots}});
      await guardar("nominas",n.id,{...n,lineas:L},"Bonos de "+Object.values(B).reduce((s,b)=>s+b.ots.length,0)+" OT agregados");render();return}
    if(d.fnomBorrar){if(!confirm("¿Borrar este borrador de nómina?"))return;await borrarDoc("nominas",n.id);nomSel=null;toast("Borrador borrado");render();return}
    if(d.fnomContab){const C=calcNom(n);if(!C.lineas.length)return toast("La nómina no tiene empleados");if(C.lineas.some(x=>x.neto<0))return toast("Hay un neto negativo: revisa los descuentos");
      if(!confirm(`¿Contabilizar la nómina de ${periodoDe(n.periodo).nombre}? Neto a pagar ${cop(C.tot.neto)} · costo total ${cop(C.tot.costo)}. Después no se puede editar (se anula si hace falta).`))return;
      // vacaciones disfrutadas: salen de la provisión acumulada hasta donde alcance
      for(const x of C.lineas){if(x.vacPago){const D=provDisp(x.pid,n.f);x.vacProv=Math.min(x.vacPago,D.vac)}else x.vacProv=0}
      const nums=NOMS().map(x=>+(S_(x.num).match(/^NOM-(\d+)$/)||[])[1]||0),num="NOM-"+String(Math.max(0,...nums)+1).padStart(4,"0");
      await guardar("nominas",n.id,{...n,estado:"contabilizada",num,calc:{lineas:C.lineas,tot:C.tot},cfg:cfgN(),contab:new Date().toISOString(),contabPor:yo()},"Nómina "+num+" contabilizada");render();return}
    if(d.fnomAnular){const mot=prompt("Motivo de la anulación:");if(!mot)return;await guardar("nominas",n.id,{...n,estado:"anulada",anulada:{f:new Date().toISOString(),por:yo(),motivo:mot}},"Nómina anulada");render();return}
    if(d.fnomDesp){const nn=n||NOMS().find(x=>x.id===nomSel);if(nn)desprendibles(nn,d.fnomDesp);return}
    if(d.fnomPagar){const nn=NOMS().find(x=>x.id===d.fnomPagar);if(!nn)return;const sel={};if(d.pid)for(const x of nn.calc.lineas)sel[x.pid]=x.pid===d.pid;pagoD={id:nn.id,f:hoy(),cuenta:cfgN().cuenta||cuentasActivas()[0]?.id||"",sel,val:{}};abrir("fnompago");return}
    if(d.fnpGuardar){const nn=NOMS().find(x=>x.id===pagoD.id);if(!pagoD.cuenta)return toast("Elige de qué cuenta sale el pago");const lote=uid4()+uid4(),P=[];
      for(const x of nn.calc.lineas){if(pagoD.sel[x.pid]===false)continue;const s=x.neto-pagadoEmp(nn,x.pid);if(s<=0)continue;const v=r0(numIn(pagoD.val[x.pid]??s));if(!v)continue;if(v>s)return toast("A "+x.nombre+" se le pagaría más de lo pendiente ("+cop(s)+")");P.push({id:uid4()+uid4(),lote,f:pagoD.f,cuenta:pagoD.cuenta,pid:x.pid,valor:v,reg:new Date().toISOString(),por:yo()})}
      if(!P.length)return toast("Elige al menos un empleado");await guardar("nominas",nn.id,{...nn,pagos:[...(nn.pagos||[]),...P]},"Pago registrado: "+cop(P.reduce((s,p)=>s+p.valor,0)));finModal=null;pagoD=null;render();return}
    if(d.fnomPila){const m=d.fnomPila,T=pilaMes(m),pg=pilaPagada(m),fr=T.total?Math.max(0,(T.total-pg)/T.total):0;pilaD={mes:m,f:hoy(),cuenta:cfgN().cuenta||cuentasActivas()[0]?.id||"",planilla:"",v:Object.fromEntries(["salud","pension","arl","para"].map(k=>[k,String(r0(T[k]*fr))]))};abrir("fnompila");return}
    if(d.fplGuardar){if(!pilaD.cuenta)return toast("Elige de qué cuenta sale el pago");const v=Object.fromEntries(Object.entries(pilaD.v).map(([k,x])=>[k,r0(numIn(x))])),total=Object.values(v).reduce((s,x)=>s+x,0);if(!total)return toast("El valor está en cero");
      await guardar("nominas",null,{tipo:"pila",mes:pilaD.mes,f:pilaD.f,cuenta:pilaD.cuenta,planilla:S_(pilaD.planilla).trim(),valores:v,total,estado:"registrado",creado:new Date().toISOString(),por:yo()},"Pago de PILA registrado");finModal=null;pilaD=null;render();return}
    if(d.fnomPilaBorrar){if(!confirm("¿Borrar este pago de PILA? Se quita su comprobante de egreso."))return;await borrarDoc("nominas",d.fnomPilaBorrar);toast("Pago borrado");render();return}
    if(d.fnomPrest){const k=d.fnomPrest,f=hoy(),R=sugerir(k,f);if(!Object.keys(R).length)return toast("No hay empleados activos en nómina");const [,,sem]=semestre(f);
      prD={concepto:k,f,cuenta:cfgN().cuenta||cuentasActivas()[0]?.id||"",periodoTxt:k==="pri"?sem:k==="ces"||k==="int"?"Año "+(+f.slice(0,4)-(+f.slice(5,7)<=2?1:0)):"",L:Object.fromEntries(Object.entries(R).map(([pid,x])=>[pid,{...x,[k]:String(x[k]||0)}]))};abrir("fnomprest");return}
    if(d.fnomLiq!==undefined){const L=EMPS().filter(p=>p.activo!==false&&enNomina(p));if(!L.length)return toast("No hay empleados activos en nómina");const pid=d.fnomLiq||L[0].id,f=hoy(),R=sugerir("liquidacion",f,pid,f);
      prD={concepto:"liquidacion",pid,fRet:f,f,motivo:"Renuncia",cuenta:cfgN().cuenta||cuentasActivas()[0]?.id||"",periodoTxt:"",L:Object.fromEntries(Object.entries(R).map(([k,x])=>[k,Object.fromEntries(Object.entries(x).map(([a,b])=>[a,typeof b==="number"?String(b):b]))]))};empD=null;abrir("fnomprest");return}
    if(d.fprGuardar){const D=prD,liq=D.concepto==="liquidacion",cols=liq?["ces","int","pri","vac","indem","otros"]:[D.concepto];if(!D.cuenta)return toast("Elige de qué cuenta sale el pago");
      const L=[];for(const x of Object.values(D.L)){if(x.on===false)continue;const l={pid:x.pid,nombre:x.nombre,area:x.area,desc:r0(numIn(x.desc)),diasVac:horasIn(x.diasVac)};for(const k of cols)l[k]=r0(numIn(x[k]));const disp=provDisp(x.pid,D.f);l.prov={};for(const k of ["ces","int","pri","vac"])if(l[k])l.prov[k]=Math.min(l[k],disp[k]);
        if(cols.some(k=>l[k]))L.push(l)}
      if(!L.length)return toast("No hay valores para pagar");const total=L.reduce((s,l)=>s+cols.reduce((a,k)=>a+(l[k]||0),0)-l.desc,0);if(total<0)return toast("El descuento es mayor que el pago");
      if(liq&&!confirm(`¿Registrar la liquidación de ${nomE(D.pid)} por ${cop(total)} y marcarlo como retirado el ${fechaCorta(D.fRet)}?`))return;
      const anioPago=D.concepto==="liquidacion"?S_(D.fRet).slice(0,4):["ces","int"].includes(D.concepto)?String(+S_(D.f).slice(0,4)-(+S_(D.f).slice(5,7)<=2?1:0)):"";
      const id=await guardar("nominas",null,{tipo:"prest",concepto:D.concepto,anioPago,f:D.f,cuenta:D.cuenta,periodoTxt:S_(D.periodoTxt).trim(),lineas:L,total,estado:"registrado",...(liq?{fRet:D.fRet,motivo:D.motivo}:{}),creado:new Date().toISOString(),por:yo()},liq?"Liquidación registrada":"Pago registrado");
      if(liq){const p=emp(D.pid);if(p)await guardar("personal",p.id,{...p,activo:false,retiro:D.fRet,motivoRetiro:D.motivo});const doc=NOMS().find(x=>x.id===id);if(doc)imprimirLiq(doc)}
      finModal=null;prD=null;vista="nomprest";render();return}
    if(d.fnomPrestBorrar){const x=NOMS().find(y=>y.id===d.fnomPrestBorrar);if(!x||!confirm("¿Borrar este pago? Se quita su comprobante de egreso."+(x.concepto==="liquidacion"?" El empleado vuelve a quedar activo.":"")))return;await borrarDoc("nominas",x.id);
      if(x.concepto==="liquidacion"){const p=emp(x.lineas?.[0]?.pid);if(p)await guardar("personal",p.id,{...p,activo:true,retiro:"",motivoRetiro:""})}toast("Pago borrado");render();return}
    if(d.fnomLiqimp){const x=NOMS().find(y=>y.id===d.fnomLiqimp);if(x)imprimirLiq(x);return}
    if(d.fnomInf){infTab=d.fnomInf;render();return}
    if(d.fnomCert){certificado(d.fnomCert,infAnio);return}
    if(d.fncGuardar){const x=clone(cfgD);for(const k of ["smmlv","aux","horas"])x[k]=numIn(x[k]);for(const k in x.pct)x.pct[k]=+S_(x.pct[k]).replace(",",".")||0;for(const k in x.arl)x.arl[k]=+S_(x.arl[k]).replace(",",".")||0;
      if(!(x.smmlv>0))return toast("Escribe el salario mínimo");CONT.nomina=x;cfgD=null;await guardarCont("Configuración de nómina guardada");render();return}
  }catch(err){if(!err?.msg)console.error(err)}});
// campos de los formularios
document.addEventListener("input",e=>{const t=e.target,d=t.dataset||{};
  if(d.fne&&empD){empD[d.fne]=t.type==="checkbox"?t.checked:t.value;return}
  if(d.fnv&&novD){novD.v[d.fnv]=t.value;return}
  if(d.fnp&&pagoD){pagoD[d.fnp]=t.value;return}if(d.fnpVal&&pagoD){pagoD.val[d.fnpVal]=t.value;return}
  if(d.fpl&&pilaD){pilaD[d.fpl]=t.value;return}if(d.fplv&&pilaD){pilaD.v[d.fplv]=t.value;return}
  if(d.fpr&&prD&&!["pid","fRet"].includes(d.fpr)){prD[d.fpr]=t.value;return}
  if(d.fprv&&prD){const [pid,k]=d.fprv.split("|");if(prD.L[pid])prD.L[pid][k]=t.value;return}
  if(d.fnc&&cfgD){const v=t.type==="checkbox"?t.checked:t.value,[a,b]=d.fnc.split(".");if(b)cfgD[a][b]=v;else cfgD[a]=v;return}});
document.addEventListener("change",e=>{const t=e.target,d=t.dataset||{};
  if(d.fne&&empD){if(["contrato","area","salario"].includes(d.fne)){if(d.fne==="area"&&!empD._riesgoTocado)empD.riesgo=t.value==="admin"?"I":"III";render()}if(d.fne==="riesgo")empD._riesgoTocado=true;return}
  if(d.fnv&&novD){render();return}
  if(d.fnpSel&&pagoD){pagoD.sel[d.fnpSel]=t.checked;render();return}
  if((d.fplv||d.fprv)&&(pilaD||prD)){render();return}
  if(d.fprOn&&prD){prD.L[d.fprOn].on=t.checked;render();return}
  if(d.fpr&&prD&&["pid","fRet"].includes(d.fpr)){prD[d.fpr]=t.value;const R=sugerir("liquidacion",prD.f,prD.pid,prD.fRet);prD.L=Object.fromEntries(Object.entries(R).map(([k,x])=>[k,Object.fromEntries(Object.entries(x).map(([a,b])=>[a,typeof b==="number"?String(b):b]))]));render();return}
  if(d.fnomAnio){infAnio=t.value;render();return}});
// en la lista de empleados, guardar limpia la marca interna
{const _g=guardarDoc;guardarDoc=async function(col,id,data,...r){if(col==="personal"&&data){data={...data};delete data._riesgoTocado}return _g.call(this,col,id,data,...r)}}

// si la ventana se abrió directo en una pantalla de nómina (desde el sistema de gestión), se pinta ahora que el módulo está listo
if(typeof render==="function"&&finVistas.includes(vista))setTimeout(()=>{try{render()}catch{}},0);
window.FNOM={calcLinea,calcNom,periodoDe,siguientePeriodo,provDisp,pilaMes,pilaPagada,lineasNomina,sugerir,cfgN,dias360,diasEmp,datosAnio,crearNomina,set:o=>{if("nomSel" in o)nomSel=o.nomSel}};
})();
