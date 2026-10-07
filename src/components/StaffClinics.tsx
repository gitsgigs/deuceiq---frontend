import "./StaffClinics.css";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { FullRoster } from "./RosterTools";
type Clinic = { id: string; club_id: string; starts_at: string; ends_at: string; status: string; location_id: string | null; lesson_type: { name: string; category: string }; court: { name: string | null } | null };
type Props = { apiBase: string; userId: string; clubId: string; role: string; locations: { id: string; name: string; timezone?: string | null }[]; onCreate: () => void; canCreate: boolean };
const roles = ["owner", "director", "manager", "front_desk"];
export function StaffClinics(p: Props) {
  const [rows,setRows]=useState<Clinic[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[refresh,setRefresh]=useState(0);
  const [history,setHistory]=useState(false),[location,setLocation]=useState(""),[search,setSearch]=useState(""),[selected,setSelected]=useState<Clinic|null>(null);
  const listScope=useRef("");
  useEffect(()=>{
    let cancelled=false,running=false;const controller=new AbortController();const nextScope=JSON.stringify([p.userId,p.clubId,p.role,history,location]);if(listScope.current!==nextScope){setRows([]);setLoading(true);listScope.current=nextScope;}setError(null);
    async function load(){if(running||document.hidden||!roles.includes(p.role))return;running=true;
      try{
        const {data,error}=await supabase.auth.getSession();
        if(error||data.session?.user.id!==p.userId)throw new Error("Your session changed. Sign in again.");
        const all: Clinic[]=[];const now=new Date().toISOString();
        for(let offset=0;;offset+=250){
          let query=supabase.from("bookings").select("id,club_id,starts_at,ends_at,status,location_id,lesson_type:lesson_types!inner(name,category),court:courts!bookings_court_id_fkey(name)").eq("club_id",p.clubId).eq("lesson_type.category","clinic").order("starts_at").order("id").range(offset,offset+249);
          if(!history)query=query.gte("ends_at",now).neq("status","cancelled").neq("status","canceled");
          if(location)query=query.eq("location_id",location);
          const result=await query.abortSignal(controller.signal);
          if(result.error)throw new Error("Saved clinics could not be loaded. Please refresh and try again.");
          if(cancelled)return;
          // PostgREST returns to-one relations as objects for these foreign keys.
          const records=result.data as unknown as Clinic[];
          if(records.some(c=>c.club_id!==p.clubId||!c.lesson_type||Array.isArray(c.lesson_type)||c.lesson_type.category!=="clinic"))throw new Error("Unexpected clinic list response.");
          all.push(...records);if(records.length<250)break;
        }
        if(!cancelled){setRows(all);setError(null);}
      }catch(e){if(!cancelled){setRows([]);setError(e instanceof Error?e.message:"Clinics unavailable.");}}finally{running=false;if(!cancelled)setLoading(false);}
    }
    void load();const focus=()=>void load();window.addEventListener("focus",focus);document.addEventListener("visibilitychange",focus);
    const timer=setInterval(focus,60000);
    return()=>{cancelled=true;controller.abort();clearInterval(timer);window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",focus);};
  },[p.clubId,p.userId,p.role,location,history,refresh]);
  if(!roles.includes(p.role))return <p>You do not have access to staff clinics.</p>;
  const filtered=rows.filter(c=>c.lesson_type.name.toLowerCase().includes(search.trim().toLowerCase()));
  function date(c:Clinic,value:string){const zone=p.locations.find(l=>l.id===c.location_id)?.timezone||"UTC";return new Date(value).toLocaleString("en-US",{timeZone:zone,month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"});}
  return <section className="members-card club-pages compact-staff-clinics"><div className="card-heading"><div><p className="card-kicker">CLUB CLINICS</p><h3>Available Clinics</h3><p>Select a clinic to register a member or guest, view its roster, or manage its waitlist.</p></div><button disabled={!p.canCreate} onClick={p.onCreate}>Create clinic</button></div>
    <div className="club-editor"><label>Location <select value={location} onChange={e=>setLocation(e.target.value)}><option value="">All club locations</option>{p.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label>Search clinics <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Clinic name" /></label><label><input type="checkbox" checked={history} onChange={e=>setHistory(e.target.checked)} /> Include past and cancelled clinics</label><button disabled={loading} onClick={()=>setRefresh(v=>v+1)}>Refresh</button></div>
    {loading&&<p role="status">Loading clinics...</p>}{error&&<p role="alert">{error}</p>}{!loading&&!error&&!filtered.length&&<p>No clinics match these filters.</p>}
    {filtered.map(c=><article key={c.id}><button type="button" className="staff-clinic-select" onClick={()=>setSelected(c)}><h4>{c.lesson_type.name}</h4><p>{date(c,c.starts_at)} - {date(c,c.ends_at)}</p><p>{p.locations.find(l=>l.id===c.location_id)?.name||"Location unavailable"}{c.court?.name?` | Primary court: ${c.court.name}`:""}</p><p>Status: {c.status.replaceAll("_"," ")}</p><span className="staff-clinic-action">{["cancelled","canceled","completed","no_show"].includes(c.status)?"View roster":"Register participant / view roster"}</span></button></article>)}
    {selected&&<FullRoster key={selected.id} bookingId={selected.id} clubId={p.clubId} title={selected.lesson_type.name} apiBase={p.apiBase} userId={p.userId} canEdit={!["cancelled","canceled","completed","no_show"].includes(selected.status)} onClose={()=>setSelected(null)} onChanged={()=>setRefresh(v=>v+1)} />}
  </section>;
}
