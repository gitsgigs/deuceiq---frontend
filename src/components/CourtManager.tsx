import {useEffect,useRef,useState} from "react";
import {staffApi} from "../lib/staffApi";
import type {Context} from "../lib/staffApi";
import "./Management.css";
type Court={id:string;club_id:string;location_id:string|null;court_number:number;name:string|null;surface:string|null;indoor:boolean;active:boolean};
type Props=Context&{locations:{id:string;name:string}[];onChanged:()=>void};
type Form={id?:string;location_id:string;court_number:string;name:string;surface:string;indoor:boolean;active:boolean};
const roles=["owner","director","manager"];
export function CourtManager(p:Props){
 const [revision,setRevision]=useState(0),[result,setResult]=useState<{key:string;rows:Court[];error?:string}|null>(null),[location,setLocation]=useState("");
 const [form,setForm]=useState<Form|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[blocked,setBlocked]=useState(false);
 const pending=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const key=JSON.stringify([p.clubId,p.userId,p.role,revision]),current=result?.key===key?result:null;
 useEffect(()=>{if(!roles.includes(p.role))return;let cancelled=false;const c=new AbortController();
  void(async()=>{try{const rows:Court[]=[];
   for(let offset=0;;offset+=100){const q=new URLSearchParams({club_id:p.clubId,include_inactive:"true",offset:String(offset),limit:"100"});const data=await staffApi<{courts:Court[];has_more:boolean}>(p,`/courts?${q}`,"GET",undefined,c.signal);
    if(!Array.isArray(data.courts)||typeof data.has_more!=="boolean"||data.courts.some(v=>v.club_id!==p.clubId))throw new Error("Install the court management backend update, then refresh.");
    rows.push(...data.courts);if(!data.has_more)break;if(cancelled)return;
   }if(!cancelled)setResult({key,rows});
  }catch(e){if(!cancelled)setResult({key,rows:[],error:e instanceof Error?e.message:"Courts unavailable."});}})();return()=>{cancelled=true;c.abort();};
 },[key,p.apiBase]);
 function refresh(){setRevision(v=>v+1);setForm(null);setBlocked(false);}
 async function save(e:React.FormEvent){e.preventDefault();if(!form||pending.current||blocked)return;
  if(!p.locations.some(l=>l.id===form.location_id)||!Number.isInteger(Number(form.court_number))||Number(form.court_number)<1){setMessage("Choose a location and a positive whole court number.");return;}
  pending.current=true;setBusy(true);setMessage("");
  try{const body={location_id:form.location_id,court_number:Number(form.court_number),name:form.name.trim(),surface:form.surface.trim(),indoor:form.indoor,active:form.active};
   const data=await staffApi<Court|{court:Court}>(p,form.id?`/courts/${form.id}`:"/courts",form.id?"PATCH":"POST",{...body,...(!form.id?{club_id:p.clubId}:{})});
   const saved="court" in data?data.court:data;
   if(!saved?.id||saved.club_id!==p.clubId||(form.id&&saved.id!==form.id))throw new Error("The save could not be confirmed. Refresh and check the court before retrying.");
   if(mounted.current){refresh();setMessage("Court saved.");p.onChanged();}
  }catch(e){if(mounted.current){setMessage(e instanceof Error?e.message:"Court save failed.");setBlocked(true);}}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 if(!roles.includes(p.role))return null;
 const rows=current?.rows||[],filtered=rows.filter(c=>!location||c.location_id===location);
 return <section className="management-page"><h4>Court management</h4><p>{rows.filter(c=>c.active).length} active · {rows.filter(c=>!c.active).length} inactive courts. Totals follow the saved court records.</p>
 <div className="management-controls"><label>Location<select disabled={busy} value={location} onChange={e=>setLocation(e.target.value)}><option value="">All locations</option>{p.locations.map(l=><option value={l.id} key={l.id}>{l.name}</option>)}</select></label><button disabled={busy||!current||!!current.error||!p.locations.length||!!form} onClick={()=>{setMessage("");setForm({location_id:location||p.locations[0].id,court_number:"",name:"",surface:"",indoor:false,active:true});}}>Add court</button><button disabled={busy} onClick={refresh}>Refresh courts</button></div>
 {!current&&<p role="status">Loading courts…</p>}{current?.error&&<p role="alert">{current.error}</p>}{message&&<p role="status">{message}{blocked&&" Refresh courts before trying again."}</p>}
 {form&&<form className="management-editor" onSubmit={e=>void save(e)}><h4>{form.id?"Edit court":"New court"}</h4><fieldset disabled={busy||blocked}>
 <label>Location<select required value={form.location_id} onChange={e=>setForm({...form,location_id:e.target.value})}><option value="">Choose location</option>{p.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
 <label>Court number<input type="number" min="1" step="1" required value={form.court_number} onChange={e=>setForm({...form,court_number:e.target.value})}/></label>
 <label>Court name<input maxLength={200} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
 <label>Surface<input required list="court-surfaces" maxLength={80} value={form.surface} onChange={e=>setForm({...form,surface:e.target.value})}/><datalist id="court-surfaces">{["Hard","Clay","Har-Tru","Grass","Carpet","Synthetic"].map(s=><option key={s} value={s}/>)}</datalist></label>
 <label>Environment<select value={form.indoor?"indoor":"outdoor"} onChange={e=>setForm({...form,indoor:e.target.value==="indoor"})}><option value="outdoor">Outdoor</option><option value="indoor">Indoor</option></select></label>
 <label>Status<select value={form.active?"active":"inactive"} onChange={e=>setForm({...form,active:e.target.value==="active"})}><option value="active">Active</option><option value="inactive">Inactive</option></select></label></fieldset>
 <p>Deactivating hides a court from new booking choices; it does not cancel existing bookings. Courts already referenced by bookings or schedules cannot be moved to another location.</p>
 <div className="management-controls"><button disabled={busy||blocked}>{busy?"Saving…":"Save court"}</button><button type="button" disabled={busy} onClick={()=>setForm(null)}>Close</button></div></form>}
 {current&&!current.error&&!filtered.length&&<p>No courts found for this location.</p>}
 {filtered.map(c=><article key={c.id}><h4>#{c.court_number} {c.name} <span className="management-status">{c.active?"Active":"Inactive"}</span></h4><p>{p.locations.find(l=>l.id===c.location_id)?.name||"Location unavailable"} · {c.surface||"Surface unspecified"} · {c.indoor?"Indoor":"Outdoor"}</p><button disabled={busy||blocked||!!form} onClick={()=>{setMessage("");setForm({id:c.id,location_id:c.location_id||"",court_number:String(c.court_number),name:c.name||"",surface:c.surface||"",indoor:c.indoor,active:c.active});}}>Edit / {c.active?"deactivate":"reactivate"}</button></article>)}
 </section>;
}
