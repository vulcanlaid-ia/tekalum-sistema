/* Adaptador para Cloudflare: reemplaza los servicios de claude.ai (base de datos, usuario y descargas)
   por la API propia en /api. La app no cambia: sigue pidiendo window.claude.use("db"), ("user") y ("downloads"). */
(function(){
  let sesion=null;
  const LS={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
  const enc=encodeURIComponent,subs=[];
  let cache=null,cargando=null,fallos=0;
  const SID=(()=>{try{let x=sessionStorage.getItem("vye-sid");if(!x){x=Date.now().toString(36)+Math.random().toString(36).slice(2,10);sessionStorage.setItem("vye-sid",x)}return x}catch{return "s"+Date.now().toString(36)}})();
  const cab=()=>({"content-type":"application/json","x-usuario":LS.get("vye-usuario")||"","x-clave":LS.get("vye-clave")||"","x-sid":SID});

  async function api(ruta,opts={}){
    const r=await fetch("/api"+ruta,{...opts,headers:cab()});
    if(r.status===401){pedirAcceso(LS.get("vye-clave")?"Usuario o contraseña incorrectos.":"");const e=new Error("clave");e.code="not_granted";throw e}
    if(!r.ok){const e=new Error("api "+r.status);e.code=r.status===400?"invalid_argument":"unavailable";throw e}
    return r.json();
  }
  function entregar(s){
    if(!cache)return;
    const filas=cache[s.col]||[];
    if(s.tipo==="doc"){const d=filas.find(x=>x.id===s.id);s.cb({id:s.id,exists:!!d,data:()=>d?d.data:undefined,metadata:{fromCache:false,hasPendingWrites:false}});return}
    const docs=filas.map(x=>({id:x.id,exists:true,data:()=>x.data,metadata:{fromCache:false,hasPendingWrites:false}}));
    if(s.orden){const [f,dir]=s.orden,m=dir==="desc"?-1:1;docs.sort((a,b)=>{const va=a.data()[f],vb=b.data()[f];return va===vb?0:va==null?1:vb==null?-1:(va<vb?-1:1)*m})}
    s.cb({docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}});
  }
  function refrescar(){
    if(cargando)return cargando;
    cargando=(async()=>{
      try{cache=await api("/all");fallos=0;subs.forEach(entregar)}
      catch(e){if(e.code!=="not_granted"&&++fallos===3)subs.forEach(s=>s.err&&s.err({code:"unavailable",message:"Sin conexión con el servidor"}))}
      finally{cargando=null}
    })();
    return cargando;
  }
  // aplica el cambio en la copia local para que la pantalla responda al instante
  function local(col,id,data){
    cache ||= {};const f=(cache[col] ||= []),i=f.findIndex(x=>x.id===id);
    if(data===null){if(i>=0)f.splice(i,1)}else if(i>=0)f[i]={id,data};else f.push({id,data});
    subs.forEach(entregar);
  }
  function sub(s){subs.push(s);if(cache)setTimeout(()=>entregar(s),0);else refrescar();return ()=>{const i=subs.indexOf(s);if(i>=0)subs.splice(i,1)}}
  const nuevoId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);

  function docRef(col,id){
    const ruta=`/docs/${enc(col)}/${enc(id)}`;
    return {id,path:col+"/"+id,
      async get(){
        if(col==="archivos_img"){const r=await api(ruta).catch(()=>null);return {id,exists:!!r,data:()=>r?.data,metadata:{}}}
        await refrescar();const d=(cache?.[col]||[]).find(x=>x.id===id);return {id,exists:!!d,data:()=>d?.data,metadata:{}}},
      async set(data){const body=JSON.parse(JSON.stringify(data));await api(ruta,{method:"PUT",body:JSON.stringify(body)});local(col,id,body)},
      async update(data){const r=await api(ruta,{method:"PATCH",body:JSON.stringify(data)});local(col,id,r.data)},
      async delete(){await api(ruta,{method:"DELETE"});local(col,id,null)},
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
  const db={doc(p){const a=p.split("/");return docRef(a.slice(0,-1).join("/"),a[a.length-1])},collection:p=>colRef(p)};

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
  async function mostrarSesion(){
    try{sesion=await api("/sesion")}catch{return}
    LS.set("vye-nombre-cuenta",sesion.nombre||"");
    window.VYE_SESION={usuario:sesion.usuario,rol:sesion.rol,nombre:nombre()};
    iniciarPresencia();
    const b=document.createElement("div");b.id="vye-sesion";
    b.style.cssText="position:fixed;right:12px;bottom:12px;z-index:40;display:flex;gap:8px;align-items:center;padding:6px 8px 6px 12px;border-radius:999px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.18);font:13px system-ui,sans-serif;color:#1f2326";
    const t=document.createElement("span");t.textContent=nombre()+" · "+({admin:"Administrador",proyector:"Proyecciones",contador:"Contador",auxiliar:"Auxiliar contable"}[sesion.rol]||"Usuario");
    const x=document.createElement("button");x.className="btn";x.textContent="Salir";x.style.cssText="padding:4px 10px";
    x.onclick=()=>{try{localStorage.removeItem("vye-clave");sessionStorage.removeItem("vye-sid")}catch{}location.reload()};
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
  if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
  setInterval(()=>{if(document.visibilityState==="visible")refrescar()},15000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refrescar()});
})();
