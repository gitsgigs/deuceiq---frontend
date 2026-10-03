import type {Notice} from './NotificationsPage';

type Booking={id:string;starts_at:string;ends_at:string;status:string;lesson_type?:{name:string}|null;location?:{name:string;timezone:string}|null;court?:{name:string;court_number:number}|null;pro?:{first_name:string;last_name:string}|null};
type Participant={id:string;name:string;status:string;participant_type:string};
export type ClinicInfo={booking:Booking;participants:Participant[]};

export function groupClinicNotices(notices:Notice[]){
 const groups=new Map<string,Notice[]>();
 for(const n of notices){const booking=typeof n.payload?.booking_id==='string'?n.payload.booking_id:'';const key=booking||`notice:${n.id}`;const group=groups.get(key)??[];group.push(n);groups.set(key,group);}
 return [...groups.entries()].map(([key,rows])=>({key,rows:rows.sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id))})).sort((a,b)=>b.rows[0].created_at.localeCompare(a.rows[0].created_at));
}

export function ClinicRegistrationCards({notices,unreadOnly,disabled,onRead,onReadLegacy}:{notices:Notice[];unreadOnly:boolean;disabled:boolean;onRead:(bookingId:string,through:string)=>Promise<void>;onReadLegacy:(notice:Notice)=>Promise<void>}){
 return <>{groupClinicNotices(notices).filter(g=>!unreadOnly||g.rows.some(n=>!n.read_at)).map(g=>{
  const first=g.rows[0],info=g.rows.find(n=>n.clinic)?.clinic,b=info?.booking;
  const unread=g.rows.filter(n=>!n.read_at);
  const bookingId=typeof first.payload?.booking_id==='string'?first.payload.booking_id:'';
  const newIds=new Set(unread.map(n=>String(n.payload?.enrollment_id??'')));
  const snapshots=new Map<string,Participant>();
  for(const n of g.rows){const id=String(n.payload?.enrollment_id??n.id);if(!snapshots.has(id))snapshots.set(id,{id,name:String(n.payload?.registrant_name??'Participant'),status:String(n.payload?.registration_status??'registered'),participant_type:String(n.payload?.participant_type??'participant')});}
  const participants=info?info.participants:[...snapshots.values()];
  function when(value:string){try{return new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short',timeZone:b?.location?.timezone||undefined});}catch{return new Date(value).toLocaleString();}}
  const end=b?new Date(b.ends_at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',timeZone:b.location?.timezone||undefined}):'';
  const sameDay=b&&new Date(b.starts_at).toLocaleDateString('en-CA',{timeZone:b.location?.timezone||undefined})===new Date(b.ends_at).toLocaleDateString('en-CA',{timeZone:b.location?.timezone||undefined});
  return <article key={g.key} className={`clinic-registration-card${unread.length?' unread-notification':''}`}>
   <header><h4>{b?.lesson_type?.name||'Clinic'} {unread.length>0&&<span className="accepted-notification-dot" role="img" aria-label="New clinic registrations" title="New clinic registrations"/>}</h4></header>
   {b?<><p className="clinic-session-time">{when(b.starts_at)} – {sameDay?end:when(b.ends_at)}</p><p>{[b.location?.name,b.court?.name|| (b.court?.court_number?`Court ${b.court.court_number}`:null)].filter(Boolean).join(' · ')}</p>{b.pro&&<p>Pro: {[b.pro.first_name,b.pro.last_name].filter(Boolean).join(' ')}</p>}{b.status!=='confirmed'&&<p>Clinic status: {b.status.replaceAll('_',' ')}</p>}</>:<p>Clinic details unavailable. Latest registration: {when(first.created_at)}</p>}
   <p className="clinic-roster-count">{participants.filter(r=>r.status==='enrolled').length} registered{participants.some(r=>r.status==='waitlisted')&&` · ${participants.filter(r=>r.status==='waitlisted').length} waitlisted`}</p>
   <ul className="clinic-registration-participants" aria-label="Clinic participants">{participants.map(r=><li key={r.id}><span><strong>{r.name}</strong>{newIds.has(r.id)&&<span className="accepted-notification-dot" role="img" aria-label="New addition" title="New addition"/>}</span><small>{r.participant_type==='guest'?'Guest · ':''}{r.status==='enrolled'?'Registered':r.status.replaceAll('_',' ')}</small></li>)}</ul>
   {participants.length===0&&<p>No current registrations.</p>}
   <p className="notification-created">Latest addition {when(first.created_at)}</p>
   <button type="button" disabled={disabled||!unread.length} onClick={()=>void(bookingId?onRead(bookingId,first.created_at):onReadLegacy(first))}>{unread.length?'Mark additions as read':'Read'}</button>
  </article>;
 })}</>;
}
