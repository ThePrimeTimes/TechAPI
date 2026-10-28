(() => {
const $ = s => document.querySelector(s);
const inputA=$("#searchA"), inputB=$("#searchB"), boxA=$("#suggestA"), boxB=$("#suggestB");
const cardA=$("#cardA"), cardB=$("#cardB"), status=$("#status"), comparison=$("#comparison"), table=$("#table");
let phones=[], a=null, b=null;
const txt=v => v===null||v===undefined||v==="" ? "Not listed" : String(v);
const pretty=s=>String(s||"").replace(/[-_]/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const name=p=>`${pretty(p.brand)} ${p.name}`.trim();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const list=(x,s=", ")=>Array.isArray(x)&&x.length?x.join(s):"Not listed";

async function imageFor(p){
 if(p.image_url && /^https?:\/\//i.test(p.image_url)) return {url:p.image_url,source:p.source_urls?.[0]};
 // Best-effort fallback: Wikipedia public API; it may return an article thumbnail, not always a product image.
 try {
  const q=`${pretty(p.brand)} ${p.name} smartphone`;
  const url=`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=0&gsrlimit=6&prop=pageimages&piprop=thumbnail&pithumbsize=450&format=json&origin=*`;
  const r=await fetch(url); if(!r.ok) return null;
  const data=await r.json(); const pages=Object.values(data.query?.pages||{}).filter(x=>x.thumbnail?.source);
  const model=String(p.name).toLowerCase().replace(/[^a-z0-9]/g,"");
  pages.sort((x,y)=>Number((y.title||"").toLowerCase().replace(/[^a-z0-9]/g,"").includes(model))-Number((x.title||"").toLowerCase().replace(/[^a-z0-9]/g,"").includes(model)));
  return pages[0]?{url:pages[0].thumbnail.source,source:`https://en.wikipedia.org/?curid=${pages[0].pageid}`}:null;
 } catch { return null; }
}
async function renderCard(el,p){
 if(!p){el.className="phone empty";el.textContent="Choose a phone";return;}
 el.className="phone"; el.innerHTML=`<strong>${esc(name(p))}</strong><small>${esc(p.release_date||"Release date not listed")}</small><small>Searching for image…</small>`;
 const img=await imageFor(p);
 el.innerHTML=`${img?`<img loading="lazy" alt="${esc(name(p))} image" src="${esc(img.url)}">`:""}<strong>${esc(name(p))}</strong><small>${esc(p.release_date||"Release date not listed")}</small>`;
 const im=el.querySelector("img"); if(im) im.onerror=()=>im.remove();
}
function camera(p,type){const xs=(p.cameras||[]).filter(c=>String(c.type||"").toLowerCase().includes(type));return xs.length?xs.map(c=>`${c.mp??"?"} MP${c.ois?" · OIS":""}`).join(" / "):"Not listed";}
function rows(x,y){
 const dim=p=>[p.dimensions?.height_mm,p.dimensions?.width_mm,p.dimensions?.depth_mm].every(v=>v!=null)?`${p.dimensions.height_mm} × ${p.dimensions.width_mm} × ${p.dimensions.depth_mm} mm`:"Not listed";
 const specs=[
 ["Brand / model",name(x),name(y)],["Release date",txt(x.release_date),txt(y.release_date)],
 ["Display size",x.display?.size_inch?`${x.display.size_inch} inches`:"Not listed",y.display?.size_inch?`${y.display.size_inch} inches`:"Not listed"],
 ["Display type",txt(x.display?.type),txt(y.display?.type)],["Resolution",txt(x.display?.resolution),txt(y.display?.resolution)],
 ["Refresh rate",x.display?.refresh_hz?`${x.display.refresh_hz} Hz`:"Not listed",y.display?.refresh_hz?`${y.display.refresh_hz} Hz`:"Not listed"],
 ["Processor",txt(x.soc),txt(y.soc)],["RAM",x.ram_gb?`${x.ram_gb} GB`:"Not listed",y.ram_gb?`${y.ram_gb} GB`:"Not listed"],
 ["Storage options",list((x.storage_options_gb||[]).map(v=>`${v} GB`)),list((y.storage_options_gb||[]).map(v=>`${v} GB`))],
 ["Main camera",camera(x,"main"),camera(y,"main")],["Selfie camera",camera(x,"selfie"),camera(y,"selfie")],
 ["Battery",x.battery_mah?`${x.battery_mah} mAh`:"Not listed",y.battery_mah?`${y.battery_mah} mAh`:"Not listed"],
 ["Wired charging",x.charging_wired_w?`${x.charging_wired_w} W`:"Not listed",y.charging_wired_w?`${y.charging_wired_w} W`:"Not listed"],
 ["Wireless charging",x.charging_wireless_w?`${x.charging_wireless_w} W`:"Not listed",y.charging_wireless_w?`${y.charging_wireless_w} W`:"Not listed"],
 ["Operating system",`${txt(x.os)}${x.os_version?" "+x.os_version:""}`,`${txt(y.os)}${y.os_version?" "+y.os_version:""}`],
 ["Water resistance",txt(x.ip_rating),txt(y.ip_rating)],["Weight",x.weight_g?`${x.weight_g} g`:"Not listed",y.weight_g?`${y.weight_g} g`:"Not listed"],
 ["Dimensions",dim(x),dim(y)],["Wi-Fi",txt(x.connectivity?.wifi),txt(y.connectivity?.wifi)],
 ["Bluetooth",txt(x.connectivity?.bluetooth),txt(y.connectivity?.bluetooth)],["NFC",txt(x.connectivity?.nfc),txt(y.connectivity?.nfc)],
 ["MSRP (USD)",x.msrp_usd?`$${x.msrp_usd}`:"Not listed",y.msrp_usd?`$${y.msrp_usd}`:"Not listed"]
 ];
 return specs.map(r=>`<tr><th scope="row">${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("");
}
function renderTable(){if(!a||!b){comparison.hidden=true;return;}comparison.hidden=false;table.innerHTML=`<table class="spec-table"><thead><tr><th>Feature</th><th>${esc(name(a))}</th><th>${esc(name(b))}</th></tr></thead><tbody>${rows(a,b)}</tbody></table>`;}
function suggest(input,box,q,which){
 const query=q.trim().toLowerCase();box.innerHTML="";if(!query){box.classList.remove("show");return;}
 const matches=phones.filter(p=>`${p.brand} ${p.name}`.toLowerCase().includes(query)).slice(0,12);
 if(!matches.length){box.innerHTML='<div class="suggestion">No match in this dataset.</div>';box.classList.add("show");return;}
 for(const p of matches){const btn=document.createElement("button");btn.className="suggestion";btn.type="button";btn.innerHTML=`${esc(p.name)}<small>${esc(pretty(p.brand))}${p.release_date?" · "+esc(String(p.release_date).slice(0,4)):""}</small>`;
 btn.addEventListener("click",async()=>{input.value=name(p);box.classList.remove("show");if(which==="a")a=p;else b=p;status.textContent="Loading selected phone and checking image…";await renderCard(which==="a"?cardA:cardB,p);renderTable();status.textContent=`${phones.length.toLocaleString()} records loaded. Some records or images may be missing.`;});box.appendChild(btn);}
 box.classList.add("show");
}
inputA.addEventListener("input",()=>suggest(inputA,boxA,inputA.value,"a"));inputB.addEventListener("input",()=>suggest(inputB,boxB,inputB.value,"b"));
document.addEventListener("click",e=>{if(e.target!==inputA&&!boxA.contains(e.target))boxA.classList.remove("show");if(e.target!==inputB&&!boxB.contains(e.target))boxB.classList.remove("show");});
$("#reset").addEventListener("click",()=>{a=b=null;inputA.value=inputB.value="";renderCard(cardA,null);renderCard(cardB,null);renderTable();status.textContent=`${phones.length.toLocaleString()} records loaded.`;});
fetch("./data/phones.json").then(r=>{if(!r.ok)throw Error("Database file not found");return r.json();}).then(data=>{phones=Array.isArray(data)?data:[];status.textContent=`${phones.length.toLocaleString()} phone records loaded. Search for a brand or model.`;}).catch(err=>{status.textContent="Could not load database. Check Cloudflare build settings and confirm the data/smartphone folder exists.";console.error(err);});
})();
