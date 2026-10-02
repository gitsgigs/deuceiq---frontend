import "./StaffClinics.css";
import {ClinicDates} from "./ClinicDates";
import {FullRoster} from "./RosterTools";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
type Session = { id: string; starts_at: string; ends_at: string };
type Series = { id:string; name:string; clinic_type:string; location_name:string; timezone:string; recurrence_rule:string; starts_on:string; ends_on:string|null; start_time:string; duration_minutes:number; published:boolean; sessions:Session[] };
type Props={apiBase:string;clubId:string;userId:string;role:string;onRegister:(id:string)=>Promise<void>;onCreate:()=>void;canCreate:boolean};
function recurrence(s:Series) {
  const parts:Record<string,string>=Object.fromEntries(s.recurrence_rule.split(';').map(p=>p.split('=')));
  const names:Record<string,string>={MO:'Monday',TU:'Tuesday',WE:'Wednesday',TH:'Thursday',FR:'Friday',SA:'Saturday',SU:'Sunday'};
  const days=parts.BYDAY?.split(',').map(d=>names[d]||d).join(', ') || new Date(`${s.starts_on}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'});
  return `${parts.INTERVAL && parts.INTERVAL !== '1' ? `Every ${parts.INTERVAL} weeks` : 'Weekly'} on ${days}`;
}
export function ClinicSchedule(p:Props){
  const [calendar,setCalendar]=useState<Series|null>(null),[roster,setRoster]=useState<{id:string;name:string}|null>(null);
  const management=['owner','director','manager'].includes(p.role);
  const [rows,setRows]=useState<Series[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
  const [query,setQuery]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('');
  const [date,setDate]=useState(''),[days,setDays]=useState<string[]>([]);
  const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const minutes=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
  const invalid=Boolean(from&&to&&minutes(to)<=minutes(from));
  const filtered=invalid?[]:rows.flatMap(s=>{
    if(!s.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))return [];
    const fits=(start:number,duration:number)=>Number.isFinite(start)&&(!from||start>=minutes(from))&&(!to||start+duration<=minutes(to));
    if(!date&&!days.length){return (!from&&!to)||fits(minutes(s.start_time),s.duration_minutes)?[s]:[];}
    const sessions=s.sessions.filter(session=>{
      const start=new Date(session.starts_at),end=new Date(session.ends_at);
      if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))return false;
      try{
        const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:s.timezone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(start).map(p=>[p.type,p.value]));
        const localDate=`${parts.year}-${parts.month}-${parts.day}`;
        return (!date||date===localDate)&&(!days.length||days.includes(parts.weekday))&&fits(Number(parts.hour)*60+Number(parts.minute),(end.getTime()-start.getTime())/60000);
      }catch{return false;}
    });
    return sessions.length?[{...s,sessions}]:[];
  });
  const pending=useRef(false);
  async function identity(){const {data,error}=await supabase.auth.getSession();if(error||data.session?.user.id!==p.userId)throw new Error('Your session changed. Sign in again.');}
  useEffect(()=>{let cancelled=false;setRows([]);setError(null);setLoading(true);setUncertain(false);
    async function load(){try{await identity();const result=await supabase.rpc('read_clinic_schedule',{p_club_id:p.clubId});if(result.error||!Array.isArray(result.data?.series))throw new Error('The recurring schedule could not be loaded.');if(!cancelled)setRows(result.data.series);}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Schedule unavailable.');}finally{if(!cancelled)setLoading(false);}}
    void load();return()=>{cancelled=true;};
  },[p.clubId,p.userId,revision]);
  async function publish(s:Series){if(pending.current||uncertain||!management)return;pending.current=true;setBusy(true);setError(null);
    try{await identity();const result=s.published?await supabase.from('published_clinic_series').delete().eq('series_id',s.id).eq('club_id',p.clubId).select('series_id'):await supabase.from('published_clinic_series').insert({series_id:s.id,club_id:p.clubId}).select('series_id');if(result.error||result.data?.length!==1)throw new Error('The publication change could not be confirmed.');setRevision(v=>v+1);}catch(e){setUncertain(true);setError((e instanceof Error?e.message:'Unable to update schedule.')+' Refresh before retrying.');}finally{pending.current=false;setBusy(false);}}
  return <section className={`members-card club-pages ${p.role==='member'?'member-recurring-list':'compact-staff-schedule'}`}><div className="card-heading"><div><p className="card-kicker">RECURRING PROGRAMS</p><h3>Available Clinics</h3><p>Choose a dated session to register. Registration is for that session only.</p></div><button disabled={loading||busy} onClick={()=>setRevision(v=>v+1)}>Refresh schedule</button></div>
    {<><div className="clinic-schedule-search"><label>Clinic name<input type="search" value={query} maxLength={100} placeholder="Search clinic names" onChange={e=>setQuery(e.target.value)}/></label><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>From<input type="time" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="time" value={to} onChange={e=>setTo(e.target.value)}/></label><button disabled={!query&&!from&&!to&&!date&&!days.length} onClick={()=>{setQuery('');setFrom('');setTo('');setDate('');setDays([]);}}>Clear filters</button></div><fieldset className="clinic-weekday-filters"><legend>Day(s)</legend>{weekdays.map(day=><button type="button" key={day} aria-pressed={days.includes(day)} onClick={()=>setDays(previous=>previous.includes(day)?previous.filter(d=>d!==day):[...previous,day])}>{day}</button>)}</fieldset><p>Date and day filters show matching scheduled sessions. No days selected means any day.</p><p>Matches clinics that start and finish within your time window, in each clinic's local time. Leave a time blank for no limit.</p>{invalid&&<p role="alert">Choose a To time later than the From time.</p>}{!loading&&!error&&rows.length>0&&!invalid&&<p role="status">{filtered.length} of {rows.length} recurring clinics match{filtered.length===0?'. Try another name or time window.':'.'}</p>}</>}
    {management&&<><p>Publish recurring clinics here so members and Front Desk can see the weekly schedule. Hiding a schedule removes it from member and Front Desk browsing without cancelling its sessions.</p><button disabled={!p.canCreate||busy} onClick={p.onCreate}>Create recurring clinic</button></>}
    {loading&&<p role="status">Loading recurring clinics...</p>}{error&&<p role="alert">{error}</p>}{!loading&&!error&&!rows.length&&<p>{management?'No active recurring clinics. Create a clinic with Repeat weekly enabled.':'No recurring clinic schedules have been published yet.'}</p>}
    {filtered.map(s=><article key={s.id}><h4><button type="button" onClick={()=>setCalendar(s)}>{s.name}</button></h4><p>{s.clinic_type} | {s.location_name}</p><p>{recurrence(s)} at {s.start_time.slice(0,5)} ({s.timezone}), {s.duration_minutes} minutes</p><p>{s.starts_on} through {s.ends_on||'No end date set'}</p>
      {management&&<button disabled={busy||uncertain} onClick={()=>void publish(s)}>{s.published?'Hide from schedule':'Publish to schedule'}</button>}
      <button type="button" onClick={()=>setCalendar(s)}>View dates ({s.sessions.length})</button>

    </article>)}
    {calendar&&<ClinicDates program={calendar} clubId={p.clubId} userId={p.userId} onClose={()=>setCalendar(null)} onRegister={async id=>{const name=calendar.name;if(p.role==='member')await p.onRegister(id);else setRoster({id,name});setCalendar(null);}}/>}
    {roster&&<FullRoster bookingId={roster.id} clubId={p.clubId} title={roster.name} apiBase={p.apiBase} userId={p.userId} canEdit={['owner','director','manager','front_desk'].includes(p.role)} onClose={()=>setRoster(null)} onChanged={()=>setRevision(v=>v+1)}/>}
  </section>;
}
