/* Adaptador para Cloudflare: reemplaza los servicios de claude.ai (base de datos, usuario y descargas)
   por la API propia en /api. La app no cambia: sigue pidiendo window.claude.use("db"), ("user") y ("downloads"). */
(function(){
  let sesion=null;
  const LS={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
  const enc=encodeURIComponent,subs=[];
  const SID=(()=>{try{let x=sessionStorage.getItem("vye-sid");if(!x){x=Date.now().toString(36)+Math.random().toString(36).slice(2,10);sessionStorage.setItem("vye-sid",x)}return x}catch{return "s"+Date.now().toString(36)}})();
  const cab=()=>({"content-type":"application/json","x-usuario":LS.get("vye-usuario")||"","x-clave":LS.get("vye-clave")||"","x-sid":SID});
  const USR=()=>LS.get("vye-usuario")||"";

  /* ===================== Guardado en este equipo (IndexedDB) =====================
     "snap:<usuario>"  copia de los datos para poder abrir el sistema sin internet
     cola              lo registrado sin internet, en orden, para subirlo cuando vuelva la conexión */
  const IDB=(()=>{let p=null;
    const abrir=()=>p ||= new Promise((ok,mal)=>{try{const r=indexedDB.open("tekalum",1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore("kv");d.createObjectStore("cola",{keyPath:"n",autoIncrement:true})};r.onsuccess=()=>ok(r.result);r.onerror=()=>mal(r.error)}catch(e){mal(e)}});
    const tx=async(st,modo,fn)=>{const d=await abrir();return new Promise((ok,mal)=>{const t=d.transaction(st,modo),s=t.objectStore(st);let res;const q=fn(s);if(q)q.onsuccess=()=>res=q.result;t.oncomplete=()=>ok(res);t.onerror=()=>mal(t.error);t.onabort=()=>mal(t.error)})};
    return {get:k=>tx("kv","readonly",s=>s.get(k)),set:(k,v)=>tx("kv","readwrite",s=>s.put(v,k)),borrar:k=>tx("kv","readwrite",s=>s.delete(k)),cola:()=>tx("cola","readonly",s=>s.getAll()),add:o=>tx("cola","readwrite",s=>s.add(o)),put:o=>tx("cola","readwrite",s=>s.put(o)),del:n=>tx("cola","readwrite",s=>s.delete(n))}})();

  /* ===================== Estado de los datos =====================
     base  = lo que dice el servidor (la última copia que se pudo bajar)
     cola  = lotes registrados sin internet que aún no suben (cada uno se sube completo o nada, con su misma clave)
     cache = base + cola (+ lo que se está preparando dentro de una operación agrupada): es lo que ve la pantalla */
  let base=null,cache=null,ver=null,confirmados=new Set(),cargando=null,fallos=0;
  let cola=[],sinInternet=false,ultimoOk=0,vaciando=false,desdeCopia=0,enviandoAhora=null;
  let transaccion=null,colaEscrituras=Promise.resolve();   // operación agrupada en preparación y orden de las escrituras
  const listo=Promise.race([(async()=>{try{cola=(await IDB.cola()).filter(e=>e&&(e.metodo||e.lote))}catch{cola=[]}pintarEstado()})(),new Promise(r=>setTimeout(r,3000))]);
  const pendientes=()=>cola.filter(e=>e.usuario===USR()&&e.estado==="pendiente");
  const fallidos=()=>cola.filter(e=>e.usuario===USR()&&e.estado==="fallido");
  const copia=(x)=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
  const nuevaClave=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9_-]/g,"");

  // llamada a la API; si no hay internet (o la conexión se atasca), el error trae code "offline"
  const sinRed=()=>{const e=new Error("sin conexión");e.code="offline";return e};
  async function llamar(ruta,opts={},ms=25000){
    const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);
    let r;try{r=await fetch("/api"+ruta,{...opts,headers:cab(),signal:ac.signal})}catch{clearTimeout(t);throw sinRed()}
    r.fin=()=>clearTimeout(t);return r;
  }
  async function api(ruta,opts={},conCab,ms){
    if(ms==null)ms=ruta==="/all"?90000:25000;   // bajar todo en una conexión lenta puede tardar; lo demás es pequeño
    const r=await llamar(ruta,opts,ms);
    try{
      if(r.status===401){pedirAcceso(LS.get("vye-clave")?"Usuario o contraseña incorrectos.":"");const e=new Error("clave");e.code="not_granted";throw e}
      if(!r.ok){
        // 400/403/409: el servidor explica por qué (permiso, mes cerrado, otra sesión cambió el documento) y la pantalla lo muestra tal cual
        let msg="";if([400,403,409].includes(r.status)){try{msg=(await r.json()).error||""}catch{}}
        const e=new Error("api "+r.status);e.code=r.status===400?"invalid_argument":r.status===403?"permission_denied":r.status===409?"conflict":"unavailable";if(msg)e.msg=msg;throw e}
      let j;try{j=await r.json()}catch{throw sinRed()}   // la conexión se cortó a mitad de la descarga
      return conCab?{json:j,ver:r.headers.get("x-ver")}:j;
    }finally{r.fin()}
  }
  function entregar(s){
    if(!cache)return;
    const filas=cache[s.col]||[];
    if(s.tipo==="doc"){const d=filas.find(x=>x.id===s.id);s.cb({id:s.id,exists:!!d,data:()=>d?copia(d.data):undefined,metadata:{fromCache:false,hasPendingWrites:false}});return}
    const docs=filas.map(x=>({id:x.id,exists:true,data:()=>x.data,metadata:{fromCache:false,hasPendingWrites:false}}));
    if(s.orden){const [f,dir]=s.orden,m=dir==="desc"?-1:1;docs.sort((a,b)=>{const va=a.data()[f],vb=b.data()[f];return va===vb?0:va==null?1:vb==null?-1:(va<vb?-1:1)*m})}
    s.cb({docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}});
  }
  const notificar=()=>subs.forEach(entregar);

  // ---- operaciones: un lote es {clave, operaciones:[{col,id,data(null = borrar),previo?}]} ----
  // (las entradas antiguas de la cola, de antes del lote, tienen metodo PUT/PATCH/DELETE y se siguen subiendo igual)
  const opsDe=e=>e.lote?e.lote.operaciones:[{col:e.col,id:e.id,data:e.metodo==="DELETE"?null:e.body,parche:e.metodo==="PATCH"}];
  function ponerDoc(c,col,id,data,parche){
    const f=(c[col] ||= []),i=f.findIndex(x=>x.id===id);
    if(data===null){if(i>=0)f.splice(i,1);return}
    const d=parche&&i>=0?{...f[i].data,...data}:data;
    if(i>=0)f[i]={id,data:d};else if(!parche)f.push({id,data:d});
  }
  function reconstruir(){
    if(!base)return;
    const c={};for(const [k,v] of Object.entries(base))c[k]=v.slice();
    for(const e of pendientes())for(const o of opsDe(e))ponerDoc(c,o.col,o.id,o.data,o.parche);
    if(transaccion)for(const o of transaccion.operaciones.values())ponerDoc(c,o.col,o.id,o.data);
    cache=c;
  }
  // lo que el servidor acaba de aceptar queda en la copia del servidor y en pantalla al instante
  function confirmarDocs(docs){
    base ||= {};
    for(const d of docs||[]){ponerDoc(base,d.col,d.id,d.data===null?null:copia(d.data));const k=d.col+"|"+d.id;if(d.data===null)confirmados.delete(k);else confirmados.add(k)}
    reconstruir();notificar();guardarCopia();
  }
  // "previo" (la versión que se leyó) solo se manda si ese documento no tiene cambios esperando subir;
  // así el servidor detecta que otra persona lo cambió, sin confundir con cambios propios aún no subidos
  function conPrevio(col,id){
    if(!base)return {};   // aún no hay datos cargados: no se inventa una versión vacía (daría un conflicto falso)
    if(pendientes().some(e=>opsDe(e).some(o=>o.col===col&&o.id===id)))return {};
    return {previo:copia((base?.[col]||[]).find(x=>x.id===id)?.data||null)};
  }

  // ---- bajar los cambios: primero se pregunta si algo cambió (unos pocos bytes) y solo entonces se baja lo nuevo ----
  async function completo(){
    const {json,ver:vh}=await api("/all",{},true);
    base=json;confirmados=new Set();for(const [c,L] of Object.entries(base))for(const d of L)confirmados.add(c+"|"+d.id);
    ver=vh?JSON.parse(vh):null;
  }
  async function delta(){
    const d=await api("/cambios?desde="+enc(ver.u));
    for(const x of d.docs){const L=(base[x.col] ||= []),i=L.findIndex(y=>y.id===x.id);if(i>=0)L[i]={id:x.id,data:x.data};else L.push({id:x.id,data:x.data});confirmados.add(x.col+"|"+x.id)}
    if(d.ver.n!==confirmados.size)return false; // alguien borró algo: se baja todo una vez para cuadrar
    ver=d.ver;return true;
  }
  async function sincronizar(){
    if(base&&ver){
      const v=await api("/version");
      if(v.n===ver.n&&v.u===ver.u)return false;
      if(!(await delta()))await completo();
      return true;
    }
    await completo();return true;
  }
  async function cargarCopia(){
    try{
      const s=await IDB.get("snap:"+USR());
      if(!s||!s.base)return false;
      base=s.base;ver=s.ver||null;desdeCopia=s.t||0;confirmados=new Set();
      for(const [c,L] of Object.entries(base))for(const d of L)confirmados.add(c+"|"+d.id);
      reconstruir();notificar();return true;
    }catch{return false}
  }
  let tCopia=0;
  function guardarCopia(){
    clearTimeout(tCopia);
    tCopia=setTimeout(()=>{if(!base)return;const b={};for(const [c,L] of Object.entries(base))if(c!=="archivos_img")b[c]=L;IDB.set("snap:"+USR(),{base:b,ver,t:Date.now()}).catch(()=>{})},1500);
  }
  function refrescar(){
    if(transaccion)return Promise.resolve();   // mientras se prepara una operación agrupada no se cambian los datos de debajo
    if(cargando)return cargando;
    cargando=(async()=>{
      try{
        await listo;
        if(!base)await cargarCopia();         // se abre ya con la copia guardada (con internet lenta no se espera a bajar todo)
        await vaciar();                       // primero se sube lo que se registró sin internet
        const cambio=await sincronizar();
        enLinea();fallos=0;
        if(cambio||!cache){reconstruir();guardarCopia();notificar()}
        else if(cola.length)pintarEstado();
      }catch(e){
        if(e.code==="offline"){
          fueraDeLinea();
          // sin internet y sin datos en pantalla: se abre con la última copia guardada en este equipo
          if(!cache&&!(await cargarCopia()))subs.forEach(s=>s.err&&s.err({code:"unavailable",message:"Sin internet y este equipo todavía no tiene una copia de los datos"}));
        }else if(e.code!=="not_granted"&&++fallos===3&&!cache)subs.forEach(s=>s.err&&s.err({code:"unavailable",message:"Sin conexión con el servidor"}));
      }finally{cargando=null}
    })();
    return cargando;
  }

  // ---- subir lo registrado sin internet, en el mismo orden y con la misma clave (el servidor no lo duplica) ----
  const quitar=async e=>{cola=cola.filter(x=>x!==e);try{await IDB.del(e.n)}catch{}};
  async function vaciar(){
    if(vaciando||!pendientes().length)return;
    vaciando=true;pintarEstado();
    const correr=async()=>{
      for(const e of pendientes()){
        if(!e.intentado){e.intentado=true;try{await IDB.put(e)}catch{}}   // pudo haber llegado al servidor: si se le funde algo, cambia de clave
        let r;enviandoAhora=e;
        try{r=e.lote?await llamar("/lote",{method:"POST",body:JSON.stringify(e.lote)},40000)
                    :await llamar(e.ruta,{method:e.metodo,body:e.body===undefined?undefined:JSON.stringify(e.body),headers:undefined},40000)}
        catch{fueraDeLinea();return}
        finally{enviandoAhora=null}
        r.fin();
        if(r.status===401){pedirAcceso("Vuelve a entrar para subir lo que registraste sin internet.");return}
        if(r.ok){let j=null;try{j=await r.json()}catch{}await quitar(e);if(j?.documentos)confirmarDocs(j.documentos);else if(j?.data)confirmarDocs([{col:e.col,id:e.id,data:e.metodo==="DELETE"?null:j.data}]);continue}
        if(r.status>=500||r.status===429)return;                          // el servidor no pudo ahora: se intenta luego
        // 400/403/409: el servidor lo rechazó (permiso, mes cerrado, otra persona cambió el documento): no se pierde, se muestra para decidir
        let msg="";try{msg=(await r.json()).error||""}catch{}
        e.estado="fallido";e.error=msg||("Error "+r.status);try{await IDB.put(e)}catch{}
      }
    };
    try{if(navigator.locks)await navigator.locks.request("vye-cola",{ifAvailable:true},async l=>{if(l)await correr()});else await correr()}
    finally{vaciando=false;reconstruir();notificar();pintarEstado()}
  }
  // guarda un lote en la cola; un cambio de un solo documento que aún no ha intentado subir se funde con él
  async function encolar(lote,fundible){
    if(fundible&&lote.operaciones.length===1){
      const o=lote.operaciones[0];
      for(let i=cola.length-1;i>=0;i--){const p=cola[i];
        if(p.usuario!==USR()||p.estado!=="pendiente"||!p.lote)continue;
        const j=p.lote.operaciones.findIndex(x=>x.col===o.col&&x.id===o.id);if(j<0)continue;
        if(p===enviandoAhora)break;   // se está enviando en este momento: no se toca, el cambio va en otra entrada
        // si ya se intentó subir, pudo haber llegado con la clave anterior: con otros datos lleva clave nueva (si sí llegó,
        // el servidor lo rechaza por conflicto y queda visible en el panel; nunca se pierde en silencio)
        if(p.intentado){p.lote.clave=nuevaClave();p.intentado=false}
        const nuevo=p.lote.operaciones[j].previo===null&&!confirmados.has(o.col+"|"+o.id);   // se había creado sin internet
        if(o.data===null&&nuevo){p.lote.operaciones.splice(j,1);if(!p.lote.operaciones.length)await quitar(p);else try{await IDB.put(p)}catch{}}
        else{p.lote.operaciones[j]={...p.lote.operaciones[j],data:o.data};try{await IDB.put(p)}catch{}}
        reconstruir();notificar();pintarEstado();return}
    }
    const e={usuario:USR(),lote,ts:new Date().toISOString(),estado:"pendiente"};
    try{e.n=await IDB.add(e)}catch{const er=new Error("sin conexión");er.code="offline";er.msg="Sin internet, y este equipo no puede guardar en espera. Intenta de nuevo cuando vuelva la conexión.";throw er}
    cola.push(e);reconstruir();notificar();pintarEstado();
  }
  let tAviso=0;
  const avisoGuardado=()=>{if(Date.now()-tAviso<20000)return;tAviso=Date.now();try{window.toast&&window.toast("Sin internet: quedó guardado en este equipo y se sube solo cuando vuelva la conexión.")}catch{}};
  const necesitaRed=ops=>ops.some(o=>o.col==="config"||o.col==="publicas");

  // envía un lote; si no hay internet (o hay cosas esperando subir antes), queda en la cola y se ve igual en pantalla
  async function enviarOEncolar(lote,fundible){
    await listo;
    const red=necesitaRed(lote.operaciones);
    if(!red&&(pendientes().length||navigator.onLine===false)){await encolar(lote,fundible);avisoGuardado();setTimeout(refrescar,0);return null}
    try{const r=await api("/lote",{method:"POST",body:JSON.stringify(lote)},false,40000);confirmarDocs(r.documentos);return r}
    catch(e){
      if(e.code!=="offline")throw e;
      fueraDeLinea();
      if(red){e.msg="Sin internet: este cambio necesita conexión.";throw e}
      await encolar(lote,fundible);avisoGuardado();return null;
    }
  }

  // ---- escrituras: una sola, o varias juntas como una operación agrupada (todo o nada) ----
  function enCola(fn){const p=colaEscrituras.then(fn);colaEscrituras=p.catch(()=>{});return p}
  function preparar(col,id,data){
    if(!transaccion||transaccion.fase!=="preparando")throw Object.assign(new Error("Hay una operación guardándose. Espera a que termine."),{msg:"Hay una operación guardándose. Espera a que termine."});
    const k=col+"/"+id,existe=transaccion.operaciones.get(k);
    transaccion.operaciones.set(k,{col,id,data:data===null?null:copia(data),...(existe?("previo" in existe?{previo:existe.previo}:{}):conPrevio(col,id))});
    reconstruir();notificar();
    return data;
  }
  async function guardarRemoto(col,id,data){
    if(transaccion)return preparar(col,id,data);
    return enCola(async()=>{
      if(!base&&cargando)await cargando;   // primera carga en curso: se espera para conocer la versión actual del documento
      const lote={clave:nuevaClave(),operaciones:[{col,id,data,...conPrevio(col,id)}]};
      const r=await enviarOEncolar(lote,true);
      return r?r.documentos[0].data:data;
    });
  }
  function atomic(fn){if(transaccion)return Promise.reject(Object.assign(new Error("Ya hay una operación en curso."),{msg:"Ya hay una operación en curso."}));return enCola(()=>atomicDentro(fn))}
  async function atomicDentro(fn){
    await listo;
    if(transaccion)throw Object.assign(new Error("Ya hay una operación en curso."),{msg:"Ya hay una operación en curso."});
    const tx={operaciones:new Map(),fase:"preparando"};
    const bloqueo=document.createElement("div");
    bloqueo.setAttribute("role","status");bloqueo.textContent="Guardando operación…";
    bloqueo.style.cssText="position:fixed;inset:0;z-index:9999;background:#ffffffcc;display:grid;place-items:center;font:600 18px system-ui";
    document.body.appendChild(bloqueo);transaccion=tx;
    try{
      const resultado=await fn();tx.fase="guardando";   // lo preparado sigue visible mientras se envía
      const ops=[...tx.operaciones.values()];
      if(ops.length)await enviarOEncolar({clave:nuevaClave(),operaciones:ops},false);
      return resultado;
    }catch(e){transaccion=null;reconstruir();notificar();throw e}   // nada se guardó: la pantalla vuelve a como estaba
    finally{transaccion=null;bloqueo.remove();reconstruir();notificar()}
  }
  function sub(s){subs.push(s);if(cache)setTimeout(()=>entregar(s),0);else refrescar();return ()=>{const i=subs.indexOf(s);if(i>=0)subs.splice(i,1)}}
  const nuevoId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);

  function docRef(col,id){
    const ruta=`/docs/${enc(col)}/${enc(id)}`;
    return {id,path:col+"/"+id,
      async get(){
        if(col==="archivos_img"){const r=await api(ruta).catch(()=>null);return {id,exists:!!r,data:()=>r?.data,metadata:{}}}
        await refrescar();const d=(cache?.[col]||[]).find(x=>x.id===id);return {id,exists:!!d,data:()=>d?copia(d.data):undefined,metadata:{}}},
      async set(data){return guardarRemoto(col,id,copia(data))},
      async update(data){const previo=cache?.[col]?.find(x=>x.id===id)?.data;if(!previo)throw new Error("Recarga el documento antes de editarlo");return guardarRemoto(col,id,{...copia(previo),...copia(data)})},
      async delete(){return guardarRemoto(col,id,null)},
      onSnapshot(cb,err){return sub({tipo:"doc",col,id,cb,err})}};
  }
  function colRef(col,orden){
    return {path:col,
      doc(id){return docRef(col,id||nuevoId())},
      async add(data){const r=docRef(col,nuevoId());await r.set(data);return r},
      orderBy(f,dir="asc"){return colRef(col,[f,dir])},
      async get(){await refrescar();let snap;const s={tipo:"col",col,orden,cb:x=>snap=x};entregar(s);return snap},
      onSnapshot(cb,err){return sub({tipo:"col",col,orden,cb,err})}};
  }
  async function convertirCotizacion(datos){
    let r;try{r=await api("/convertir-cotizacion",{method:"POST",body:JSON.stringify(datos)},false,40000)}
    catch(e){if(e.code==="offline"){fueraDeLinea();e.msg="Convertir una cotización en venta necesita internet.";}throw e}
    confirmarDocs(r.documentos||[]);return r;
  }
  const db={convertirCotizacion,atomic,get enTransaccion(){return !!transaccion},doc(p){const a=p.split("/");return docRef(a.slice(0,-1).join("/"),a[a.length-1])},collection:p=>colRef(p)};

  /* ===================== Indicador y panel de "sin internet" ===================== */
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const NOM_COL={egresos:"Egreso",ingresos:"Ingreso",traslados:"Traslado",inversion:"Aporte de socio",ventas:"Venta",compras:"Factura de compra",terceros:"Tercero",cuentas:"Cuenta",items:"Producto o servicio",notasdoc:"Nota",asientos:"Comprobante contable",nominas:"Nómina",maquinaria:"Equipo",bodega:"Bodega",cotizaciones:"Cotización",proveedores:"Proveedor",ordenes:"Orden de trabajo",personal:"Empleado",archivos:"Foto o archivo",archivos_img:"Foto",retazos:"Retazo",caja:"Caja",chatarra:"Chatarra",auditoria:"Auditoría"};
  // lo principal de un registro en espera (en un lote, el primer documento que no sea configuración)
  const principal=e=>{const L=opsDe(e),o=L.find(x=>x.col!=="config")||L[0]||{};return {col:o.col,borra:o.data===null,body:o.data||{},mas:L.length-1}};
  const resumen=e=>{const b=principal(e).body,v=+b.valor||+b.total||0;return [b.concepto,b.nota,b.cliente||b.tercero||b.proveedor||b.nombre||b.socio,v?"$ "+Math.round(v).toLocaleString("es-CO"):""].filter(x=>x&&typeof x==="string").join(" · ").slice(0,90)};
  const hora=t=>{try{return new Date(t).toLocaleString("es-CO",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}catch{return ""}};
  function fueraDeLinea(){if(!sinInternet){sinInternet=true}pintarEstado()}
  function enLinea(){sinInternet=false;ultimoOk=Date.now();desdeCopia=0;pintarEstado()}
  function pintarEstado(){
    if(!document.body)return;
    const P=pendientes().length,F=fallidos().length;let el=document.getElementById("vye-estado");
    if(!sinInternet&&!P&&!F){el?.remove();if(document.getElementById("vye-panel"))pintarPanel();return}
    if(!el){el=document.createElement("button");el.id="vye-estado";el.type="button";el.onclick=abrirPanel;document.body.appendChild(el)}
    const rojo=F>0&&!sinInternet,azul=!sinInternet&&P>0&&!F;
    el.style.cssText="position:fixed;right:12px;bottom:56px;z-index:41;max-width:calc(100% - 24px);padding:8px 14px;border:0;border-radius:999px;font:600 13px system-ui,sans-serif;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.25);cursor:pointer;background:"+(rojo?"#b3261e":azul?"#1d4ed8":"#b45309");
    el.textContent=sinInternet?`Sin internet${P?` · ${P} por subir`:""}${F?` · ${F} con problema`:""}`:F?F>1?`${F} registros no se pudieron subir · Ver`:`1 registro no se pudo subir · Ver`:`Subiendo ${P} registro${P>1?"s":""}…`;
  }
  function abrirPanel(){if(!document.getElementById("vye-panel")){const d=document.createElement("div");d.id="vye-panel";d.style.cssText="position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(18,24,28,.55)";d.onclick=e=>{if(e.target===d)d.remove()};document.body.appendChild(d)}pintarPanel()}
  function pintarPanel(){
    const d=document.getElementById("vye-panel");if(!d)return;
    const P=pendientes(),F=fallidos();
    const fila=(e,fall)=>`<div style="padding:8px 0;border-top:1px solid #e3e6ea"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(NOM_COL[principal(e).col]||principal(e).col||"Registro")}${principal(e).borra?" (borrar)":""}${principal(e).mas?` y ${principal(e).mas} documento${principal(e).mas>1?"s":""} más (se suben juntos)`:""}</b><span style="color:#667;font-size:12px">${esc(hora(e.ts))}</span></div><div style="color:#444;font-size:13px">${esc(resumen(e))||"&nbsp;"}</div>${fall?`<div style="color:#b3261e;font-size:13px;margin-top:2px">${esc(e.error||"")}</div><button data-vp="descartar" data-n="${e.n}" style="margin-top:4px;font:inherit;font-size:12px;padding:3px 10px;border:1px solid #c7cdd4;border-radius:6px;background:#fff;cursor:pointer">Descartar</button>`:""}</div>`;
    d.innerHTML=`<div style="width:min(560px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:14px;padding:18px;font:14px system-ui,sans-serif;color:#1f2326;box-shadow:0 20px 60px rgba(0,0,0,.35)">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:8px"><div><h2 style="margin:0 0 4px;font-size:18px">${sinInternet?"Sin conexión a internet":"Registros por subir"}</h2>
      <div style="color:#556;font-size:13px">${sinInternet?`Puedes seguir registrando: todo queda guardado en este equipo y se sube solo cuando vuelva el internet. ${desdeCopia?"Los datos que ves son de la última vez que hubo conexión ("+esc(hora(desdeCopia))+").":""}`:"Se suben en el mismo orden en que se registraron."}</div></div><button data-vp="cerrar" style="border:0;background:none;font-size:22px;line-height:1;cursor:pointer" aria-label="Cerrar">×</button></div>
      ${P.length?`<h3 style="margin:14px 0 2px;font-size:14px">Por subir (${P.length})</h3>${P.map(e=>fila(e,false)).join("")}`:""}
      ${F.length?`<h3 style="margin:14px 0 2px;font-size:14px;color:#b3261e">No se pudieron subir (${F.length})</h3><div style="color:#556;font-size:13px">El servidor los rechazó. Anota lo que dicen y avisa al contador; si ya no hacen falta, descártalos.</div>${F.map(e=>fila(e,true)).join("")}`:""}
      ${!P.length&&!F.length?`<p style="color:#556">No hay nada pendiente.</p>`:""}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button data-vp="reintentar" style="font:inherit;padding:8px 16px;border:0;border-radius:8px;background:#0d6b73;color:#fff;cursor:pointer">Reintentar ahora</button></div></div>`;
  }
  document.addEventListener("click",async e=>{const b=e.target.closest("[data-vp]");if(!b)return;const a=b.dataset.vp;
    if(a==="cerrar")document.getElementById("vye-panel")?.remove();
    if(a==="reintentar"){b.textContent="Reintentando…";await refrescar();pintarPanel()}
    if(a==="descartar"){const x=cola.find(y=>String(y.n)===b.dataset.n);if(x&&confirm("¿Descartar este registro? Se pierde: no se sube."))await quitar(x),reconstruir(),notificar(),pintarPanel(),pintarEstado()}
  });
  // el service worker guarda la página nueva en segundo plano; aquí se avisa para que se recargue cuando la persona quiera
  function avisarVersionNueva(){
    if(document.getElementById("vye-nueva"))return;
    const d=document.createElement("div");d.id="vye-nueva";
    d.style.cssText="position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:70;display:flex;gap:10px;align-items:center;padding:8px 8px 8px 16px;border-radius:999px;background:#0c1a33;color:#fff;font:600 13px system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.3)";
    d.innerHTML=`<span>Hay una versión nueva del sistema.</span><button style="font:inherit;padding:6px 14px;border:0;border-radius:999px;background:#fff;color:#0c1a33;cursor:pointer">Actualizar</button><button aria-label="Después" style="font:inherit;border:0;background:none;color:#fff;cursor:pointer;font-size:16px;padding:0 8px">×</button>`;
    const [a,x]=d.querySelectorAll("button");a.onclick=()=>location.reload();x.onclick=()=>d.remove();
    document.body.appendChild(d);
  }
  if("serviceWorker" in navigator)navigator.serviceWorker.addEventListener("message",e=>{if(e.data&&e.data.tipo==="nueva-version")avisarVersionNueva()});
  window.addEventListener("online",()=>refrescar());
  window.addEventListener("offline",()=>fueraDeLinea());
  window.VYE_COLA={pendientes:()=>pendientes().length,fallidos:()=>fallidos().length,sinInternet:()=>sinInternet,vaciar:()=>refrescar()};

  // Usuario: el nombre sale de la cuenta con la que se entra (el administrador lo cambia en Usuarios y actividad)
  const nombre=()=>sesion?.nombre||LS.get("vye-nombre-cuenta")||LS.get("vye-usuario")||"";
  const idCuenta=()=>LS.get("vye-usuario")?"u-"+LS.get("vye-usuario"):null;
  const idDe=n=>n?"u-"+n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""):null;
  const nombreDe=id=>id&&id.startsWith("u-")?id.slice(2).split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" "):"";
  const perfil=id=>({id,name:id===idCuenta()?nombre():nombreDe(id),avatarUrl:"",color:"#0d6b73",email:null,isMe:id===idCuenta(),guest:false});
  // rol de la cuenta con la que se entró ("admin", "usuario" o "proyector"); window.VYE_SESION lo deja a mano para limitar secciones

  const esAdmin=async()=>{if(!sesion)sesion=await api("/sesion").catch(()=>({rol:"usuario"}));return sesion.rol==="admin"};
  const user={isOwner:esAdmin,canEdit:async()=>true,can:async()=>true,id:async()=>idCuenta(),name:async()=>nombre(),
    me:async()=>({id:idCuenta(),name:nombre(),avatarUrl:"",color:"#0d6b73",email:null,isOwner:await esAdmin(),canEdit:true}),
    profiles:async ids=>Object.fromEntries([].concat(ids).map(id=>[id,perfil(id)])),search:async()=>[]};

  // Descargas normales del navegador
  const downloads={async save({filename,data}){
    const blob=data instanceof Blob?data:new Blob([data]),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
    return {status:"saved"};
  }};

  // IA por el servidor (/api/ia): lee facturas y dibujos. Solo aparece si el servidor tiene la clave de Anthropic.
  const aBase64=b=>new Promise((ok,mal)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(",")[1]);r.onerror=mal;r.readAsDataURL(b)});
  async function pedirIA(input,opts={}){
    const prompt=typeof input==="string"?input:[].concat(input).map(t=>typeof t.content==="string"?t.content:"").join("\n\n");
    const imagenes=await Promise.all([].concat(opts.images||[]).map(async b=>({tipo:b.type||"image/jpeg",datos:await aBase64(b)})));
    // pide directo (no con api()) para mostrar el error que devuelve el servidor
    let res;
    try{res=await fetch("/api/ia",{method:"POST",signal:opts.signal,headers:cab(),body:JSON.stringify({prompt,imagenes,esquema:opts.esquema})})}
    catch(e){e.code=e.name==="AbortError"?"cancelled":"sin conexión";throw e}
    const r=await res.json().catch(()=>({error:"respuesta "+res.status}));
    if(!res.ok){const e=new Error(r.error||"error "+res.status);e.code=res.status===429?"rate_limited":(r.error||"error "+res.status);throw e}
    return r;
  }
  const sample=async(input,opts)=>{const r=await pedirIA(input,opts);return {text:r.texto,truncated:!!r.cortado}};
  sample.json=async(input,opts)=>{const t=(await pedirIA(input,opts)).texto||"";try{return JSON.parse(t)}catch{const m=t.match(/\{[\s\S]*\}/);if(m)return JSON.parse(m[0]);const e=new Error("La IA no devolvió JSON");e.code="invalid_output";throw e}};
  sample.limits=async()=>({images:true});sample.servidor=true;
  let iaLista=null;
  const conIA=()=>iaLista ||= api("/ia").then(r=>r.disponible?sample:null).catch(()=>null);

  window.claude={use:async n=>n==="sample"?conIA():({db,user,downloads})[n]||null};

  // Pantalla de acceso: usuario y contraseña de la cuenta, y el nombre de la persona (autor de lo que registre)
  function pedirAcceso(msg){
    if(document.getElementById("vye-acceso"))return;
    const d=document.createElement("div");d.id="vye-acceso";
    d.innerHTML=`<form class="panel" style="width:min(380px,100%);display:flex;flex-direction:column;gap:12px">
      <div><div class="eyebrow">TEKALUM</div><h2 style="margin:4px 0 0">Entrar al sistema</h2></div>
      ${msg?`<div class="notice">${msg}</div>`:""}
      <label class="f">Usuario<input id="acc-usuario" required autocomplete="username" autocapitalize="none" spellcheck="false"></label>
      <label class="f">Contraseña<input id="acc-clave" required type="password" autocomplete="current-password"></label>
      <button class="btn primary" type="submit" style="justify-content:center">Entrar</button>
      <p style="margin:0;font-size:12px;color:#5b6470;line-height:1.4">Por seguridad, el sistema registra con tu usuario lo que creas, cambias o borras, cuándo estás conectado y desde dónde te conectas (la ubicación exacta solo si das permiso).</p></form>`;
    d.style.cssText="position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(18,24,28,.55)";
    document.body.appendChild(d);
    d.querySelector("#acc-usuario").value=LS.get("vye-usuario")||"";
    d.querySelector("form").addEventListener("submit",e=>{e.preventDefault();
      LS.set("vye-usuario",d.querySelector("#acc-usuario").value.trim().toLowerCase());LS.set("vye-clave",d.querySelector("#acc-clave").value);location.reload()});
    setTimeout(()=>d.querySelector(LS.get("vye-usuario")?"#acc-clave":"#acc-usuario").focus(),0);
  }
  // quién está dentro y botón para salir (en un computador compartido)
  // el rol de la última vez se usa al instante (así el menú aparece sin esperar al servidor, también con internet lenta)
  // y se confirma en segundo plano; si cambió, la pantalla se vuelve a pintar
  async function mostrarSesion(){
    let guardada=null;try{guardada=JSON.parse(LS.get("vye-sesion-"+USR())||"null")}catch{}
    if(guardada){sesion=guardada;montarSesion();
      try{const nueva=await api("/sesion");LS.set("vye-sesion-"+USR(),JSON.stringify(nueva));
        if(nueva.rol!==sesion.rol||nombre()!==(nueva.nombre||nombre())||JSON.stringify(nueva.acceso)!==JSON.stringify(sesion.acceso)){sesion=nueva;LS.set("vye-nombre-cuenta",nueva.nombre||"");window.VYE_SESION={usuario:nueva.usuario,rol:nueva.rol,nombre:nombre(),acceso:nueva.acceso||{}};window.dispatchEvent(new Event("vye-sesion"));const t=document.querySelector("#vye-sesion span");if(t)t.textContent=etiquetaSesion()}}catch{}
      return}
    try{sesion=await api("/sesion");LS.set("vye-sesion-"+USR(),JSON.stringify(sesion))}catch{return}
    montarSesion();
  }
  const etiquetaSesion=()=>nombre()+" · "+({admin:"Administrador",proyector:"Gerencia",contador:"Contador",auxiliar:"Auxiliar contable",usuario:"Gestión"}[sesion.rol]||"Usuario");
  function montarSesion(){
    LS.set("vye-nombre-cuenta",sesion.nombre||"");
    window.VYE_SESION={usuario:sesion.usuario,rol:sesion.rol,nombre:nombre(),acceso:sesion.acceso||{}};
    window.dispatchEvent(new Event("vye-sesion")); // la app vuelve a pintarse con lo que le corresponde a este rol
    iniciarPresencia();
    const b=document.createElement("div");b.id="vye-sesion";
    b.style.cssText="position:fixed;right:12px;bottom:12px;z-index:40;display:flex;gap:8px;align-items:center;padding:6px 8px 6px 12px;border-radius:999px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.18);font:13px system-ui,sans-serif;color:#1f2326";
    const t=document.createElement("span");t.textContent=etiquetaSesion();
    const x=document.createElement("button");x.className="btn";x.textContent="Salir";x.style.cssText="padding:4px 10px";
    x.onclick=async()=>{
      // al salir se borra la copia de los datos de este equipo; lo que esté sin subir se conserva para cuando vuelva a entrar
      const P=pendientes().length;
      if(P&&!confirm("Tienes "+P+" registro"+(P>1?"s":"")+" sin subir (se hicieron sin internet). Quedan guardados en este equipo y se suben cuando vuelvas a entrar con tu usuario. ¿Salir ahora?"))return;
      try{await IDB.borrar("snap:"+USR())}catch{}
      try{localStorage.removeItem("vye-clave");localStorage.removeItem("vye-sesion-"+USR());sessionStorage.removeItem("vye-sid")}catch{}
      location.reload()};
    b.append(t,x);document.body.appendChild(b);
  }
  document.addEventListener("DOMContentLoaded",()=>{if(!LS.get("vye-usuario")||!LS.get("vye-clave"))pedirAcceso("");else mostrarSesion()});

  let geo=null,geoT=0;
  function pedirUbicacion(){
    if(!navigator.geolocation||LS.get("vye-geo")==="no")return;
    navigator.geolocation.getCurrentPosition(p=>{geo={lat:+p.coords.latitude.toFixed(6),lon:+p.coords.longitude.toFixed(6),prec:Math.round(p.coords.accuracy)};geoT=Date.now();latido()},
      e=>{if(e.code===1)LS.set("vye-geo","no")},{enableHighAccuracy:true,timeout:20000,maximumAge:300000});
  }
  const dispositivo=()=>{const u=navigator.userAgent,m=/Mobi|Android|iPhone|iPad/i.test(u);
    const so=/Android/i.test(u)?"Android":/iPhone|iPad/i.test(u)?"iPhone":/Windows/i.test(u)?"Windows":/Mac OS/i.test(u)?"Mac":/Linux/i.test(u)?"Linux":"";
    const nav=/Edg[/]/.test(u)?"Edge":/OPR[/]/.test(u)?"Opera":/Chrome[/]/.test(u)?"Chrome":/Firefox[/]/.test(u)?"Firefox":/Safari[/]/.test(u)?"Safari":"";
    return [m?"Celular":"Computador",so,nav].filter(Boolean).join(" · ")};
  function latido(){
    if(document.visibilityState!=="visible"&&geo&&Date.now()-geoT<1e3)return;
    const pant=(document.querySelector("#main h1")?.textContent||"").trim().slice(0,60);
    fetch("/api/ping",{method:"POST",headers:cab(),keepalive:true,body:JSON.stringify({sid:SID,disp:dispositivo(),pantalla:pant,...(geo||{})})}).catch(()=>{});
  }
  function iniciarPresencia(){
    latido();pedirUbicacion();
    setInterval(()=>{if(document.visibilityState==="visible")latido()},30000);
    setInterval(()=>{if(document.visibilityState==="visible")pedirUbicacion()},10*60000);
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")latido()});
  }
  // para la pantalla Usuarios y actividad
  window.VYE_API=async ruta=>api(ruta);

  // service worker para poder instalar la app con ícono en el escritorio
  if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").then(()=>navigator.serviceWorker.ready).then(async reg=>{
    // si por algún motivo la página aún no quedó guardada en este equipo, se le pide al service worker que la guarde
    try{const c=await caches.open("tekalum-v4");if(!(await c.match("/shell")))reg.active?.postMessage("guardar-pagina")}catch{}
    setTimeout(avisarListo,4000);
  }).catch(()=>{}));
  // una sola vez por equipo y usuario: avisa que ya se puede trabajar sin internet (página y datos guardados)
  let intentosListo=0;
  async function avisarListo(){
    try{
      if(LS.get("vye-listo-"+USR()))return;
      const pag=await (await caches.open("tekalum-v4")).match("/shell"),snap=await IDB.get("snap:"+USR());
      if(pag&&snap&&snap.base){LS.set("vye-listo-"+USR(),"1");window.toast&&window.toast("Este equipo ya quedó listo para trabajar aunque se caiga el internet.")}
      else if(++intentosListo<6)setTimeout(avisarListo,8000);
    }catch{}
  }
  window.VYE_LISTO=async()=>{try{const pag=await (await caches.open("tekalum-v4")).match("/shell"),snap=await IDB.get("snap:"+USR());return {pagina:!!pag,datos:!!(snap&&snap.base)}}catch{return {pagina:false,datos:false}}};
  // cada 15 s se pregunta si hay cambios; si nadie toca el sistema en 3 minutos, solo cada minuto (al volver a usarlo se actualiza al instante)
  let ultimaAccion=Date.now(),tic=0;
  const acc=()=>{const inactivo=Date.now()-ultimaAccion>180000;ultimaAccion=Date.now();if(inactivo)refrescar()};
  for(const ev of ["pointerdown","keydown","touchstart","wheel"])addEventListener(ev,acc,{passive:true,capture:true});
  setInterval(()=>{if(document.visibilityState!=="visible")return;tic++;if(Date.now()-ultimaAccion>180000&&tic%4)return;refrescar()},15000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refrescar()});
})();
