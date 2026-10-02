import {RequestConversation} from "./RequestConversation";
import {useEffect,useRef,useState} from "react";
import {staffApi} from "../lib/staffApi";
import type {Context} from "../lib/staffApi";
import {BookingPrice} from "./PricePreview";
import {FullRoster} from "./RosterTools";
import "./Management.css";
import "./StaffBookings.css";
type Person={first_name?:string;last_name?:string};
type Row={created_at?:string|null;id:string;club_id:string;location_id:string;starts_at:string;ends_at:string;status:string;source?:string;request_type?:string;decision_note?:string;pricing_mode?:string;original_booking_id?:string;
 member?:Person;second_member?:Person;guest_first_name?:string;guest_last_name?:string;pro?:Person;court?:{name?:string;court_number?:number};location?:{name:string;timezone:string};lesson_type?:{name:string;category:string};booking_participants?:{id:string;member?:Person}[]};
type Props=Context&{locations:{id:string;name:string;timezone?:string|null}[];initialLocation:string;onCreate:()=>void;onCalendar:(location:string,date:string)=>void;onChanged:()=>void};
const allowed=["owner","director","manager","front_desk"];
const name=(p?:Person)=>[p?.first_name,p?.last_name].filter(Boolean).join(" ");
const dateAt=(value:string,zone:string)=>{const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;};
export function StaffBookings(p:Props){
 const [tab,setTab]=useState<"bookings"|"requests">("requests"),[location,setLocation]=useState(p.initialLocation||p.locations[0]?.id||"");
 const zone=p.locations.find(l=>l.id===location)?.timezone||"UTC";
 const [day,setDay]=useState(()=>dateAt(new Date().toISOString(),zone)),[status,setStatus]=useState("pending"),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0);
 const [result,setResult]=useState<{key:string;rows:Row[];more:boolean;error?:string}|null>(null);
 const [action,setAction]=useState<{row:Row;kind:"approve"|"decline"|"settle"|"cancel"}|null>(null),[note,setNote]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[blocked,setBlocked]=useState(false),[roster,setRoster]=useState<Row|null>(null);
 const pending=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const key=JSON.stringify([p.clubId,p.userId,p.role,tab,location,day,status,offset]);
 const current=result?.key===key?result:null,loading=!current;
 useEffect(()=>{if(!allowed.includes(p.role))return;let cancelled=false;const c=new AbortController();
  const q=new URLSearchParams({club_id:p.clubId,limit:"25",offset:String(offset)});
  if(location)q.set("location_id",location);
  if(tab==="bookings")q.set("booking_date",day);else q.set("status",status);
  void staffApi<{bookings?:Row[];requests?:Row[];has_more:boolean}>(p,`/${tab==="bookings"?"bookings":"member-booking-requests"}?${q}`,"GET",undefined,c.signal).then(data=>{
   const rows=tab==="bookings"?data.bookings:data.requests;
   if(!Array.isArray(rows)||typeof data.has_more!=="boolean"||rows.some(r=>r.club_id!==p.clubId))throw new Error("Install the staff management backend update, then refresh.");
   if(!cancelled)setResult({key,rows,more:data.has_more});
  }).catch(e=>{if(!cancelled)setResult({key,rows:[],more:false,error:e.message});});
  return()=>{cancelled=true;c.abort();};
 },[key,revision,p.apiBase]);
 function refresh(){setOffset(0);setRevision(v=>v+1);setAction(null);setBlocked(false);}
 function when(row:Row,value:string){return new Date(value).toLocaleString("en-US",{timeZone:row.location?.timezone||p.locations.find(l=>l.id===row.location_id)?.timezone||"UTC",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"});}
 async function decide(){if(!action||pending.current||blocked)return;pending.current=true;setBusy(true);setMessage("");
  try{const {row,kind}=action;
   const data=kind==="cancel"?await staffApi<{booking?:Row}>(p,`/bookings/${row.id}`,"DELETE"):
    await staffApi<{request_id?:string;status?:string}>(p,`/member-booking-requests/${row.id}/${kind}?club_id=${encodeURIComponent(p.clubId)}`,"POST",{decision_note:note.trim()||null});
   if(kind==="cancel"?!("booking" in data&&data.booking?.id===row.id&&data.booking.status==="cancelled"):!("request_id" in data&&data.request_id===row.id&&data.status===(kind==="approve"?"approved":kind==="settle"?"settled":"declined")))throw new Error("The result could not be confirmed. Refresh and check before retrying.");
   if(mounted.current){refresh();setMessage(kind==="cancel"?"Booking cancelled.":`Request ${kind==="approve"?"approved":kind==="settle"?"settled":"declined"}.`);p.onChanged();window.dispatchEvent(new Event("deuceiq-notifications-refresh"));}
  }catch(e){if(mounted.current){setMessage(e instanceof Error?e.message:"Unable to confirm change.");setBlocked(true);}}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 if(!allowed.includes(p.role))return <p>You do not have access to staff bookings.</p>;
 return <section className="members-card management-page"><div className="card-heading"><div><p className="card-kicker">STAFF BOOKINGS</p><h3>Bookings and requests</h3></div><button disabled={busy||!p.initialLocation} onClick={p.onCreate}>Create booking</button></div>
 <div className="management-controls"><button disabled={busy||tab==="requests"} onClick={()=>{setTab("requests");refresh();}}>Member requests</button><button disabled={busy||tab==="bookings"} onClick={()=>{setTab("bookings");refresh();}}>Saved bookings</button><button disabled={busy} onClick={refresh}>Refresh</button></div>
 <div className="management-controls"><label>Location<select disabled={busy} value={location} onChange={e=>{setLocation(e.target.value);refresh();}}><option value="">All locations{tab==="bookings"?" (UTC dates)":""}</option>{p.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
 {tab==="bookings"?<label>Date<input disabled={busy} type="date" required value={day} onChange={e=>{if(e.target.value){setDay(e.target.value);refresh();}}}/></label>:<label>Request status<select disabled={busy} value={status} onChange={e=>{setStatus(e.target.value);refresh();}}>{["pending","approved","declined","settled","all"].map(s=><option key={s} value={s}>{s}</option>)}</select></label>}</div>
 {tab==="requests"&&<p>Review new bookings and reschedule requests. Approval checks availability and configured prices again; a request does not hold a court.</p>}
 {message&&<p role="status">{message}{blocked&&" Use Refresh before trying another action."}</p>}
 {loading&&<p role="status">Loading…</p>}{current?.error&&<p role="alert">{current.error}</p>}{current&&!current.error&&!current.rows.length&&<p>No records match these filters.</p>}
 {current?.rows.map(row=><article key={row.id} className={tab==="requests" ? "compact-booking-request" : undefined}><h4>{row.lesson_type?.name||"Booking"} <span className="management-status">{row.status}</span></h4>
 {tab==="requests"&&<p className="request-created">Created: {row.created_at && !Number.isNaN(Date.parse(row.created_at)) ? <time dateTime={row.created_at}>{when(row,row.created_at)}</time> : "Unavailable"}</p>}
 <p>{when(row,row.starts_at)} – {when(row,row.ends_at)}</p><p>{row.location?.name||p.locations.find(l=>l.id===row.location_id)?.name||"Location unavailable"} · Court {row.court?.court_number??""} {row.court?.name||"unassigned"}</p>
 <p>Pro: {name(row.pro)||"Unassigned"}</p>
 {tab==="requests"?<><p>Request: {row.request_type?.replaceAll("_"," ")} · Pricing: {row.pricing_mode||"split"}</p><p>Players: {[name(row.member)||"Member profile unavailable",name(row.second_member),[row.guest_first_name,row.guest_last_name].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>{row.original_booking_id&&<p>Original booking: {row.original_booking_id}</p>}{row.decision_note&&<p>Decision note: {row.decision_note}</p>}</>:<><p>Members: {(row.booking_participants||[]).map(v=>name(v.member)).filter(Boolean).join(", ")||"See calendar / roster for participant details"}</p><BookingPrice bookingId={row.id} userId={p.userId}/></>}
 <div className="management-controls">{tab==="requests"&&row.status==="pending"&&["approve","decline","settle"].map(kind=><button key={kind} disabled={busy||blocked||!!action} onClick={()=>{setAction({row,kind:kind as "approve"|"decline"|"settle"});setNote("");setMessage("");}}>{kind==="approve"?"Approve":kind==="settle"?"Settled":"Decline"}</button>)}
 {tab==="bookings"&&<><button disabled={busy} onClick={()=>p.onCalendar(row.location_id,dateAt(row.starts_at,p.locations.find(l=>l.id===row.location_id)?.timezone||"UTC"))}>Open calendar / edit</button>{row.lesson_type?.category==="clinic"&&<button disabled={busy} onClick={()=>setRoster(row)}>View / edit roster</button>}{!["cancelled","completed","no_show"].includes(row.status)&&<button disabled={busy||blocked||!!action} onClick={()=>{setAction({row,kind:"cancel"});setMessage("");}}>Cancel booking</button>}</>}</div>
 {action?.row.id===row.id&&<div className="management-confirm"><p>{action.kind==="settle"?"Mark this request as settled? It will leave the pending list and close the conversation. No booking will be created or changed.":action.kind==="cancel"?"Cancel this entire booking? All assigned court time for this booking will be released.":`${action.kind==="approve"?"Approve":"Decline"} this request?`}</p>{action.kind!=="cancel"&&<label>Decision note (optional)<textarea maxLength={1000} disabled={busy} value={note} onChange={e=>setNote(e.target.value)}/></label>}<div className="management-controls"><button disabled={busy||blocked} onClick={()=>void decide()}>{busy?"Saving…":"Confirm"}</button><button disabled={busy} onClick={()=>setAction(null)}>Back</button></div></div>}
 {tab==="requests"&&<RequestConversation key={`${p.userId}:${p.clubId}:${row.id}:${row.status}`} context={p} requestId={row.id}/>}
 </article>)}
 <div className="management-pages"><button disabled={busy||loading||offset===0} onClick={()=>{setOffset(v=>Math.max(0,v-25));setAction(null);}}>Previous</button><span>Page {offset/25+1}</span><button disabled={busy||loading||!current?.more} onClick={()=>{setOffset(v=>v+25);setAction(null);}}>Next</button></div>
 {roster&&<FullRoster bookingId={roster.id} clubId={p.clubId} title={roster.lesson_type?.name||"Clinic"} apiBase={p.apiBase} userId={p.userId} canEdit={!["cancelled","completed","no_show"].includes(roster.status)} onClose={()=>setRoster(null)} onChanged={()=>{setRevision(v=>v+1);p.onChanged();}}/>}
 </section>;
}
