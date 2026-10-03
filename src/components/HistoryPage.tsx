import {isHistoryParticipantUncharged} from "../lib/historyPaymentStatus";
import {staffApi} from "../lib/staffApi";
import {ParticipantPayment} from "./ParticipantPayment";
import {bookingDateRange} from "../lib/bookingDateRange";
import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
import "./HistoryPage.css";

type Cursor={starts_at:string;id:string};
type Court={id:string;name:string|null;court_number:number|null;surface:string|null};
type Pro={pro_id:string;name:string;starts_at:string;ends_at:string;court_id:string|null};
type Player={record_id:string;name:string;kind:string;status:string;waitlist_position:number|null};
type Entry={booking_id:string;starts_at:string;ends_at:string;timezone:string;status:string;source:string;location_name:string|null;activity_name:string|null;category:string|null;courts:Court[];pros:Pro[];participants:Player[];currency:string;booking_charge:number|null;pricing_mode:string|null;amount_paid:number|null;amount_due:number|null;payment_tracking:string};
type PaymentStatus={booking_id:string;participant_id:string;paid_cents:number;status:string};
type Page={payments:PaymentStatus[];paymentError?:string;key:string;rows:Entry[];more:boolean;next:Cursor|null;error?:string};
const roles=["front_desk","manager","owner","director"];

export function HistoryPage(p:{apiBase:string;clubId:string;userId:string;role:string;locations:{id:string;name:string}[]}) {
 const [location,setLocation]=useState(""),[from,setFrom]=useState(""),[through,setThrough]=useState("");
 const [search,setSearch]=useState(""),[query,setQuery]=useState(""),[upcoming,setUpcoming]=useState(false),[refresh,setRefresh]=useState(0);
 const [paging,setPaging]=useState<{key:string;index:number;cursors:(Cursor|null)[]}>({key:"",index:0,cursors:[null]});
 const [page,setPage]=useState<Page|null>(null);
 const [paymentRevision,setPaymentRevision]=useState(0);
 useEffect(()=>{const update=()=>setPaymentRevision(v=>v+1);const timer=setInterval(update,30000);window.addEventListener("focus",update);return()=>{clearInterval(timer);window.removeEventListener("focus",update);};},[]);
 useEffect(()=>{const timer=setTimeout(()=>setQuery(search.trim()),300);return()=>clearTimeout(timer);},[search]);
 const filterKey=JSON.stringify([p.clubId,p.userId,p.role,location,from,through,query,upcoming,refresh]);
 const index=paging.key===filterKey?paging.index:0;
 const cursors=paging.key===filterKey?paging.cursors:[null];
 const cursor=cursors[index];
 const key=JSON.stringify([filterKey,cursor]);
 const current=page?.key===key?page:null;
 const invalid=Boolean(from&&through&&from>through);
 const loading=!current&&!invalid;
 useEffect(()=>{
   if(!roles.includes(p.role)||!p.clubId||invalid)return;
   const controller=new AbortController();let cancelled=false;
   void(async()=>{try{
     const auth=await supabase.auth.getSession();
     if(auth.error||auth.data.session?.user.id!==p.userId)throw new Error("Sign in again to view History.");
     const {data,error}=await supabase.rpc("get_court_usage_history",{
       p_club_id:p.clubId,p_location_id:location||null,p_from:from||null,p_through:through||null,
       p_search:query,p_include_upcoming:upcoming,p_before_starts:cursor?.starts_at||null,p_before_id:cursor?.id||null,p_limit:25,
     }).abortSignal(controller.signal);
     if(error)throw new Error(error.code==="42501"?"Your account no longer has access to this club's history.":"History could not be loaded. Confirm the History database update is installed, then refresh.");
     if(!data||!Array.isArray(data.rows)||typeof data.has_more!=="boolean"||data.rows.some((r:Entry)=>!r.booking_id||!Array.isArray(r.courts)||!Array.isArray(r.participants)||!Array.isArray(r.pros)))throw new Error("History returned an incomplete response.");
     let payments:PaymentStatus[]=[];let paymentError:string|undefined;
     if(data.rows.length){try{const result=await staffApi<{mode:string;payments:PaymentStatus[]}>(p,`/payments/history/status?club_id=${encodeURIComponent(p.clubId)}`,"POST",{booking_ids:data.rows.map((r:Entry)=>r.booking_id)},controller.signal);if(!Array.isArray(result.payments))throw new Error();payments=result.payments;}catch{paymentError="Payment indicators could not be checked. Refresh History to retry.";}}
     if(!cancelled)setPage({key,rows:data.rows,more:data.has_more,next:data.next_cursor,payments,paymentError});
   }catch(e){if(!cancelled)setPage({key,rows:[],more:false,next:null,payments:[],error:e instanceof Error?e.message:"History unavailable."});}})();
   return()=>{cancelled=true;controller.abort();};
 },[key,paymentRevision]);
 if(!roles.includes(p.role))return <p>You do not have access to History.</p>;
 function uncharged(row:Entry,m:Player){return isHistoryParticipantUncharged(row,m,current?.payments??[],!!current?.paymentError);}
 function dot(label:string){return <span className="history-uncharged-dot" role="img" aria-label={label} title={label}/>;}
 function money(row:Entry,value:number|null){if(value===null)return "Not recorded";try{return new Intl.NumberFormat("en-US",{style:"currency",currency:row.currency}).format(value);}catch{return `${value.toFixed(2)} ${row.currency}`;}}
 function courtName(c:Court){return [c.court_number!=null?`#${c.court_number}`:"",c.name].filter(Boolean).join(" · ")||"Court";}
 return <section className="members-card usage-history">
   <div className="card-heading"><div><p className="card-kicker">CLUB RECORDS</p><h3>History</h3><p>Saved court bookings across every activity. Each entry includes all courts assigned to that booking.</p></div><button type="button" onClick={()=>setRefresh(v=>v+1)}>Refresh</button></div>
   <div className="history-notice"><strong>Participant payments</strong><p>Open a participant’s Charge / Refund controls to view verified payment status and receipts. Saved booking prices are not proof of payment. Review each participant’s amount before charging.</p></div>
   <div className="history-filters">
     <label>Location<select value={location} onChange={e=>setLocation(e.target.value)}><option value="">All locations</option>{p.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
     <label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
     <label>Through<input type="date" value={through} onChange={e=>setThrough(e.target.value)}/></label>
     <label className="history-search">Search records<input type="search" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Player, pro, court, location or lesson"/></label>
     <label><input type="checkbox" checked={upcoming} onChange={e=>setUpcoming(e.target.checked)}/> Include upcoming bookings</label>
   </div>
   <p>Dates use each location's time zone. Status distinguishes bookings, cancellations, and no-shows; assigned time does not by itself confirm attendance.</p>
   <p>{dot("Uncharged participant")} Red dot: participant has no successful charge.</p>
   {current?.paymentError&&<p role="status">{current.paymentError}</p>}
   {invalid&&<p role="alert">The end date must be on or after the start date.</p>}
   {loading&&<p role="status">Loading history…</p>}{current?.error&&<p role="alert">{current.error}</p>}
   {!loading&&!invalid&&!current?.error&&!current?.rows.length&&<p>No saved bookings match these filters.</p>}
   {!invalid&&current?.rows.map(row=><article className="history-entry" key={row.booking_id}>
     <header><div><h4>{row.activity_name||"Unspecified activity"} {row.participants.some(m=>uncharged(row,m))&&dot("This booking has uncharged participants")}</h4><p>{bookingDateRange(row.starts_at,row.ends_at,row.timezone)}</p></div><span className="history-status">{row.status.replaceAll("_"," ")}</span></header>
     <div className="history-entry-grid">
       <div><h5>Location / courts</h5><p>{row.location_name||"Location unavailable"}</p>{row.courts.length?<ul>{row.courts.map(c=><li key={c.id}>{courtName(c)}{c.surface?` (${c.surface})`:""}</li>)}</ul>:<p>No court assigned</p>}<p>Type: {row.category?.replaceAll("_"," ")||"Not recorded"}</p></div>
       <div><h5>Players</h5><details><summary>{row.participants.length} saved participant record{row.participants.length===1?"":"s"}</summary>{row.participants.length?<ul>{row.participants.map(m=><li key={m.record_id}><strong>{m.name||"Name unavailable"}</strong> {uncharged(row,m)&&dot("Participant has not been successfully charged")} — {m.kind}, {m.status.replaceAll("_"," ")}{m.waitlist_position!=null?` (waitlist ${m.waitlist_position})`:""}<ParticipantPayment context={p} bookingId={row.booking_id} recordId={m.record_id} name={m.name} onPaymentChange={()=>setPaymentRevision(v=>v+1)}/></li>)}</ul>:<p>No participants recorded</p>}</details>
       <h5>Assigned pros</h5>{row.pros.length?<ul>{row.pros.map((pro,i)=><li key={`${pro.pro_id}:${i}`}><strong>{pro.name}</strong><br/>{bookingDateRange(pro.starts_at,pro.ends_at,row.timezone)}<br/>{row.courts.find(c=>c.id===pro.court_id)?courtName(row.courts.find(c=>c.id===pro.court_id)!):"Court not recorded"}</li>)}</ul>:<p>No pro assigned</p>}</div>
       <div><h5>Charges / payments</h5><dl><dt>Saved booking charge</dt><dd>{money(row,row.booking_charge)}</dd><dt>Payments / refunds</dt><dd>See each participant</dd><dt>Balance</dt><dd>Review participant charges</dd><dt>Receipts</dt><dd>Open Charge / Refund</dd></dl>{row.booking_charge===null&&<p>No price snapshot is stored for this earlier booking.</p>}</div>
     </div><small>Booking reference: {row.booking_id}</small>
   </article>)}
   <div className="history-pages"><button type="button" disabled={index===0||loading||invalid} onClick={()=>setPaging({key:filterKey,cursors,index:index-1})}>Previous</button><span>Page {index+1}</span><button type="button" disabled={loading||invalid||!current?.more||!current?.next} onClick={()=>{if(current?.next)setPaging({key:filterKey,index:index+1,cursors:[...cursors.slice(0,index+1),current.next]});}}>Next</button></div>
 </section>;
}
