import {useEffect,useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import './ClinicDates.css';
export type ClinicSession={id:string;starts_at:string;ends_at:string};
export type CalendarProgram={name:string;timezone:string;sessions:ClinicSession[]};
type Details={id:string;name:string;description:string;location:string;timezone:string;pro:string|null;capacity:number;enrolled:number;waitlisted:number;spots:number;courts:{name:string;number:number}[]};
export function clinicDay(value:string,zone:string){const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const get=(key:string)=>parts.find(p=>p.type===key)?.value;return `${get('year')}-${get('month')}-${get('day')}`;}
export function ClinicDates({program,clubId,userId,onClose,onRegister}:{program:CalendarProgram;clubId:string;userId:string;onClose:()=>void;onRegister:(id:string)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const sessions=program.sessions.filter(s=>new Date(s.starts_at).getTime()>Date.now());
 const first=sessions[0]?clinicDay(sessions[0].starts_at,program.timezone):clinicDay(new Date().toISOString(),program.timezone);
 const [month,setMonth]=useState(first.slice(0,7)),[day,setDay]=useState(''),[selected,setSelected]=useState<ClinicSession|null>(null),[details,setDetails]=useState<Details|null>(null),[error,setError]=useState('');
 useEffect(()=>{const el=dialog.current;const focus=document.activeElement as HTMLElement|null;el?.showModal();return()=>{el?.close();focus?.focus();};},[]);
 useEffect(()=>{let stopped=false;setDetails(null);setError('');if(!selected)return;
  void(async()=>{try{const auth=await supabase.auth.getSession();if(auth.error||auth.data.session?.user.id!==userId)throw new Error('Please sign in again.');const result=await supabase.rpc('clinic_session_details',{p_club:clubId,p_booking:selected.id});if(result.error||result.data?.id!==selected.id)throw new Error('Session details could not be loaded. Close the calendar and refresh the schedule, then try again.');if(!stopped)setDetails(result.data);}catch(e){if(!stopped)setError(e instanceof Error?e.message:'Session unavailable.');}})();return()=>{stopped=true;};
 },[selected,clubId,userId]);
 const [year,mon]=month.split('-').map(Number),count=new Date(Date.UTC(year,mon,0)).getUTCDate(),offset=new Date(Date.UTC(year,mon-1,1)).getUTCDay();
 const dates=new Set(sessions.map(s=>clinicDay(s.starts_at,program.timezone)));
 const changeMonth=(delta:number)=>{setMonth(new Date(Date.UTC(year,mon-1+delta,1)).toISOString().slice(0,7));setDay('');setSelected(null);};
 const time=(value:string)=>new Date(value).toLocaleTimeString('en-US',{timeZone:program.timezone,hour:'numeric',minute:'2-digit',timeZoneName:'short'});
 return <dialog ref={dialog} className="clinic-dates" aria-labelledby="clinic-dates-title" onCancel={onClose}>
  <div className="clinic-dates-heading"><h3 id="clinic-dates-title">{program.name}</h3><button type="button" onClick={onClose}>Close</button></div>
  <p>Select a red-dot date, then a session. Times use {program.timezone}.</p>
  <div className="clinic-dates-heading"><button type="button" aria-label="Previous month" onClick={()=>changeMonth(-1)}>Previous</button><strong aria-live="polite">{new Date(Date.UTC(year,mon-1,1)).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'})}</strong><button type="button" aria-label="Next month" onClick={()=>changeMonth(1)}>Next</button></div>
  <div className="clinic-dates-grid">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span key={d}>{d}</span>)}{Array.from({length:offset},(_,i)=><span key={`blank${i}`}/>)}{Array.from({length:count},(_,i)=>{const date=`${month}-${String(i+1).padStart(2,'0')}`;const has=dates.has(date);return <button type="button" key={date} disabled={!has} aria-label={`${date}${has?', clinic sessions available':''}`} aria-pressed={day===date} onClick={()=>{setDay(date);const matches=sessions.filter(s=>clinicDay(s.starts_at,program.timezone)===date);setSelected(matches.length===1?matches[0]:null);}}>{i+1}{has&&<span className="clinic-red-dot"/>}</button>;})}</div>
  {!sessions.length&&<p>No upcoming sessions are scheduled.</p>}
  {day&&<section aria-label="Sessions on selected date"><h4>{day}</h4>{sessions.filter(s=>clinicDay(s.starts_at,program.timezone)===day).map(s=><button className="clinic-session-choice" type="button" key={s.id} aria-pressed={selected?.id===s.id} onClick={()=>setSelected(s)}>{time(s.starts_at)} – {time(s.ends_at)}</button>)}</section>}
  {selected&&!details&&!error&&<p role="status">Loading session details...</p>}{error&&<p role="alert">{error}</p>}
  {details&&selected&&<section className="clinic-session-details"><h4>{program.name}</h4><p>{details.name} · {day} · {time(selected.starts_at)} – {time(selected.ends_at)}</p>{details.description&&<p>{details.description}</p>}<p>Location: {details.location}</p><p>Courts: {details.courts.map(c=>`#${c.number} ${c.name}`).join(', ')||'Unassigned'}</p><p>Primary pro: {details.pro||'Unassigned'}</p><p>{details.spots} spots available · {details.enrolled}/{details.capacity} enrolled · {details.waitlisted} waitlisted</p><p>Registration is for this session only. Review participant details and pricing in the next step.</p><button type="button" onClick={()=>onRegister(details.id)}>{details.spots>0?'Register':'Register / join waitlist'}</button></section>}
 </dialog>;
}
