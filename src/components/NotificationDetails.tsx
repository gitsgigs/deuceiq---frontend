import {CourtOverlapDetails} from "./CourtOverlapDetails";
import {RequestConversation} from "./RequestConversation";
import {useEffect,useRef,useState} from "react";
import {staffApi,type Context} from "../lib/staffApi";
import type {Notice} from "./NotificationsPage";
type Booking={starts_at:string;ends_at:string;status:string;lesson_type?:{name:string};location?:{name:string;timezone:string};court?:{name:string;court_number:number};pro?:{first_name:string;last_name:string}};
export function NotificationDetails({context:p,notice:n}:{context:Context;notice:Notice}){
 const ref=useRef<HTMLDivElement>(null);
 const [opened,setOpened]=useState(false),[retry,setRetry]=useState(0);
 const [result,setResult]=useState<{booking:Booking|null;error?:string}|null>(null);
 const clinic=["clinic_registration","clinic_waitlist_joined"].includes(n.notification_type);
 useEffect(()=>{const el=ref.current?.closest("details");if(!el)return;const toggle=()=>{if(el.open)setOpened(true);};el.addEventListener("toggle",toggle);toggle();return()=>el.removeEventListener("toggle",toggle);},[]);
 useEffect(()=>{if(!opened||!clinic)return;const c=new AbortController();let cancelled=false;setResult(null);
  staffApi<{notification_id:string;club_id:string;booking:Booking|null}>(p,`/notifications/${encodeURIComponent(n.id)}/details?club_id=${encodeURIComponent(p.clubId)}`,"GET",undefined,c.signal).then(data=>{if(data.notification_id!==n.id||data.club_id!==p.clubId)throw new Error("Could not confirm these details.");if(!cancelled)setResult({booking:data.booking});}).catch(e=>{if(!cancelled)setResult({booking:null,error:e instanceof Error?e.message:"Details unavailable."});});return()=>{cancelled=true;c.abort();};
 },[opened,clinic,n.id,p.userId,p.clubId,p.apiBase,retry]);
 const value=(key:string)=>typeof n.payload?.[key]==="string"?String(n.payload[key]).replaceAll("_"," "):"Not recorded";
 const b=result?.booking;
 function when(value:string){const d=new Date(value);if(Number.isNaN(d.getTime()))return "Not recorded";try{return d.toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short",timeZone:b?.location?.timezone||undefined});}catch{return d.toLocaleString();}}
 return <div ref={ref} className="notification-detail-body">
 {n.notification_type==="booking_request_message"&&typeof n.payload?.request_id==="string"?<RequestConversation context={p} requestId={n.payload.request_id}/>:clinic?<><dl><dt>Who registered</dt><dd>{value("registrant_name")}</dd><dt>Participant</dt><dd>{value("participant_type")}</dd><dt>Registration status at notification</dt><dd>{value("registration_status")}</dd></dl>
 {opened&&!result&&<p role="status">Loading clinic details…</p>}
 {result?.error?<p role="alert">{result.error} <button onClick={()=>setRetry(v=>v+1)}>Retry details</button></p>:b?<><p className="notification-created">Current clinic schedule · {b.location?.timezone||"your device's time zone"}</p><dl><dt>Activity</dt><dd>{b.lesson_type?.name||"Clinic"}</dd><dt>Starts</dt><dd>{when(b.starts_at)}</dd><dt>Ends</dt><dd>{when(b.ends_at)}</dd><dt>Location</dt><dd>{b.location?.name||"Not recorded"}</dd><dt>Court</dt><dd>{b.court?.name|| (b.court?.court_number?`Court ${b.court.court_number}`:"Not assigned")}</dd><dt>Pro</dt><dd>{[b.pro?.first_name,b.pro?.last_name].filter(Boolean).join(" ")||"Not assigned"}</dd><dt>Booking status</dt><dd>{b.status}</dd></dl></>:result&&<p>The linked clinic is no longer available, or its details were not recorded.</p>}</>:n.notification_type==="court_overlap"?<CourtOverlapDetails payload={n.payload}/>:<p>{n.message}</p>}
 <p className="notification-created">Notification created: {new Date(n.created_at).toLocaleString()}</p>
 </div>;
}
