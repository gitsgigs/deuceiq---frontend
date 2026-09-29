import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
type Session = { id: string; starts_at: string; ends_at: string };
type Series = { id:string; name:string; clinic_type:string; location_name:string; timezone:string; recurrence_rule:string; starts_on:string; ends_on:string|null; start_time:string; duration_minutes:number; published:boolean; sessions:Session[] };
type Props={clubId:string;userId:string;role:string;onRegister:(id:string)=>void;onCreate:()=>void;canCreate:boolean};
function recurrence(s:Series) {
  const parts:Record<string,string>=Object.fromEntries(s.recurrence_rule.split(';').map(p=>p.split('=')));
  const names:Record<string,string>={MO:'Monday',TU:'Tuesday',WE:'Wednesday',TH:'Thursday',FR:'Friday',SA:'Saturday',SU:'Sunday'};
  const days=parts.BYDAY?.split(',').map(d=>names[d]||d).join(', ') || new Date(`${s.starts_on}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'});
  return `${parts.INTERVAL && parts.INTERVAL !== '1' ? `Every ${parts.INTERVAL} weeks` : 'Weekly'} on ${days}`;
}
export function ClinicSchedule(p:Props){
  const management=['owner','director','manager'].includes(p.role);
  const [rows,setRows]=useState<Series[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
  const pending=useRef(false);
  async function identity(){const {data,error}=await supabase.auth.getSession();if(error||data.session?.user.id!==p.userId)throw new Error('Your session changed. Sign in again.');}
  useEffect(()=>{let cancelled=false;setRows([]);setError(null);setLoading(true);setUncertain(false);
    async function load(){try{await identity();const result=await supabase.rpc('read_clinic_schedule',{p_club_id:p.clubId});if(result.error||!Array.isArray(result.data?.series))throw new Error('The recurring schedule could not be loaded.');if(!cancelled)setRows(result.data.series);}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Schedule unavailable.');}finally{if(!cancelled)setLoading(false);}}
    void load();return()=>{cancelled=true;};
  },[p.clubId,p.userId,revision]);
  async function publish(s:Series){if(pending.current||uncertain||!management)return;pending.current=true;setBusy(true);setError(null);
    try{await identity();const result=s.published?await supabase.from('published_clinic_series').delete().eq('series_id',s.id).eq('club_id',p.clubId).select('series_id'):await supabase.from('published_clinic_series').insert({series_id:s.id,club_id:p.clubId}).select('series_id');if(result.error||result.data?.length!==1)throw new Error('The publication change could not be confirmed.');setRevision(v=>v+1);}catch(e){setUncertain(true);setError((e instanceof Error?e.message:'Unable to update schedule.')+' Refresh before retrying.');}finally{pending.current=false;setBusy(false);}}
  return <section className="members-card club-pages"><div className="card-heading"><div><p className="card-kicker">RECURRING PROGRAMS</p><h3>Clinic Schedule</h3><p>Choose a dated session to register. Registration is for that session only.</p></div><button disabled={loading||busy} onClick={()=>setRevision(v=>v+1)}>Refresh schedule</button></div>
    {management&&<><p>Publish recurring clinics here so members and Front Desk can see the weekly schedule. Hiding a schedule does not cancel its clinics or remove their dated registration listings.</p><button disabled={!p.canCreate||busy} onClick={p.onCreate}>Create recurring clinic</button></>}
    {loading&&<p role="status">Loading recurring clinics...</p>}{error&&<p role="alert">{error}</p>}{!loading&&!error&&!rows.length&&<p>{management?'No active recurring clinics. Create a clinic with Repeat weekly enabled.':'No recurring clinic schedules have been published yet.'}</p>}
    {rows.map(s=><article key={s.id}><h4>{s.name}</h4><p>{s.clinic_type} | {s.location_name}</p><p>{recurrence(s)} at {s.start_time.slice(0,5)} ({s.timezone}), {s.duration_minutes} minutes</p><p>{s.starts_on} through {s.ends_on||'No end date set'}</p>
      {management&&<button disabled={busy||uncertain} onClick={()=>void publish(s)}>{s.published?'Hide from schedule':'Publish to schedule'}</button>}
      <details><summary>Upcoming sessions ({s.sessions.length})</summary>{!s.sessions.length&&<p>No upcoming sessions are currently scheduled. Contact Front Desk for dates.</p>}{s.sessions.map(d=><p key={d.id}>{new Date(d.starts_at).toLocaleString('en-US',{timeZone:s.timezone,dateStyle:'medium',timeStyle:'short'})} {p.role==='member'&&<button onClick={()=>p.onRegister(d.id)}>View availability / register</button>}</p>)}</details>
    </article>)}
  </section>;
}
