import {useEffect,useRef,useState} from "react";
import {staffApi} from "../lib/staffApi";
import type {Context} from "../lib/staffApi";
import "./Management.css";
import {NotificationDetails} from "./NotificationDetails";
import "./NotificationDetails.css";
export type Notice={payload?:Record<string,unknown>;id:string;club_id:string;recipient_user_id:string;title:string;message:string;notification_type:string;created_at:string;read_at:string|null};
export function NotificationIndicator(p:Context){
 const [unread,setUnread]=useState(false);
 useEffect(()=>{let cancelled=false,running=false;const c=new AbortController();setUnread(false);
  async function load(){if(running||document.hidden||!p.clubId)return;running=true;try{const data=await staffApi<{notifications:Notice[]}>(p,`/notifications?club_id=${encodeURIComponent(p.clubId)}&unread_only=true&limit=1${p.role==="member"?"&category=accepted":""}`,"GET",undefined,c.signal);if(!cancelled)setUnread(Array.isArray(data.notifications)&&data.notifications.some(n=>n.recipient_user_id===p.userId&&n.club_id===p.clubId&&!n.read_at));}catch{if(!cancelled)setUnread(false);}finally{running=false;}}
  void load();const timer=setInterval(()=>void load(),60000);const refresh=()=>void load();window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);window.addEventListener("deuceiq-notifications-refresh",refresh);
  return()=>{cancelled=true;c.abort();clearInterval(timer);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);window.removeEventListener("deuceiq-notifications-refresh",refresh);};
 },[p.apiBase,p.clubId,p.userId,p.role]);
 return unread?<span className="notification-dot" role="img" aria-label="Unread notifications" title="Unread notifications" />:null;
}
export function NotificationsPage(p:Context){
 const member=p.role==="member";
 const columns=member?[{id:"accepted",title:"Accepted Requests"}]:[{id:"requests",title:"Member Requests"},{id:"bookings",title:"Bookings"},{id:"clinics",title:"Clinic Registrations"}];
 return <section className="members-card compact-notifications"><p className="card-kicker">YOUR INBOX</p><h3>Notifications</h3><p>{member?"Your accepted requests. Select a notification for details.":"Each column scrolls independently. Select a notification for details."}</p><div className={`notification-columns${member?" member-notification-column":""}`}>{columns.map(c=><NotificationColumn key={`${p.userId}:${p.clubId}:${c.id}`} {...p} category={c.id} title={c.title}/>)}</div></section>;
}
function NotificationColumn(p:Context & {category:string;title:string}){
 const [fetching,setFetching]=useState(false);
 const [unread,setUnread]=useState(false),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false),[message,setMessage]=useState("");
 const [page,setPage]=useState<{key:string;rows:Notice[];more:boolean;error?:string}|null>(null);
 const pending=useRef(false),mounted=useRef(true),confirmedReads=useRef(new Map<string,string>());
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const key=JSON.stringify([p.clubId,p.userId,unread,p.category]),current=page?.key===key?page:null;
 useEffect(()=>{let cancelled=false,running=false;const c=new AbortController();
  async function load(){if(running||document.hidden||!p.clubId)return;running=true;setFetching(true);try{const q=new URLSearchParams({club_id:p.clubId,unread_only:String(unread),offset:String(offset),limit:"25",category:p.category});const data=await staffApi<{notifications:Notice[];has_more:boolean;category:string}>(p,`/notifications?${q}`,"GET",undefined,c.signal);
   if(data.category!==p.category||!Array.isArray(data.notifications)||typeof data.has_more!=="boolean"||data.notifications.some(n=>n.recipient_user_id!==p.userId||n.club_id!==p.clubId))throw new Error("Install the notifications backend update, then refresh.");
   if(!cancelled)setPage(previous=>{const incoming=data.notifications.map(n=>confirmedReads.current.has(n.id)?{...n,read_at:confirmedReads.current.get(n.id)!}:n);const all=offset&&previous?.key===key?[...previous.rows,...incoming]:incoming;return {key,rows:[...new Map(all.map(n=>[n.id,n])).values()],more:data.has_more};});
  }catch(e){if(!cancelled)setPage({key,rows:[],more:false,error:e instanceof Error?e.message:"Notifications unavailable."});}finally{running=false;if(!cancelled)setFetching(false);}}
  void load();const timer=setInterval(()=>void load(),60000);const refresh=()=>void load();window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);
  return()=>{cancelled=true;c.abort();clearInterval(timer);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
 },[key,offset,revision,p.apiBase]);
 function refresh(){setOffset(0);setRevision(v=>v+1);setBlocked(false);window.dispatchEvent(new Event("deuceiq-notifications-refresh"));}
 async function read(n:Notice){if(pending.current||blocked)return;pending.current=true;setBusy(true);setMessage("");try{const data=await staffApi<{notification:Notice}>(p,`/notifications/${n.id}/read`,"PATCH");if(data.notification?.id!==n.id||!data.notification.read_at)throw new Error("Could not confirm read status. Refresh before retrying.");if(mounted.current){confirmedReads.current.set(n.id,data.notification.read_at);setPage(previous=>previous?{...previous,rows:previous.rows.map(row=>row.id===n.id?{...row,read_at:data.notification.read_at}:row)}:previous);window.dispatchEvent(new Event("deuceiq-notifications-refresh"));}}catch(e){if(mounted.current){setMessage(e instanceof Error?e.message:"Unable to mark as read.");setBlocked(true);}}finally{pending.current=false;if(mounted.current)setBusy(false);}}
 return <section className="notification-column management-page"><h4>{p.title}</h4><div className="management-controls"><label>Show<select disabled={busy} value={unread?"unread":"all"} onChange={e=>{setUnread(e.target.value==="unread");setOffset(0);refresh();}}><option value="all">All notifications</option><option value="unread">Unread only</option></select></label><button disabled={busy} onClick={refresh}>Refresh</button></div>
 <div className="notification-column-scroll" tabIndex={0} role="region" aria-label={`${p.title} notification list`}>{message&&<p role="status">{message}{blocked&&" Refresh to continue."}</p>}{!current&&<p role="status">Loading notifications…</p>}{current?.error&&<p role="alert">{current.error}</p>}{current&&!current.error&&!current.rows.length&&<p>No notifications to show.</p>}
 {current?.rows.map(n=><article key={n.id} className={!n.read_at?"unread-notification":""}><details className="notification-expand"><summary><h4>{n.title} {!n.read_at&&(p.category==="accepted"?<span className="accepted-notification-dot" role="img" aria-label="Unread accepted request" title="Unread accepted request"/>:<span className="management-status">Unread</span>)}</h4><p className="notification-created">Received {new Date(n.created_at).toLocaleString()}</p><span className="notification-details-hint">View details</span></summary><p>{n.message}</p><NotificationDetails key={`${p.userId}:${p.clubId}:${n.id}`} context={p} notice={n}/></details><button type="button" disabled={!!n.read_at||busy||blocked} onClick={()=>void read(n)}>{n.read_at?"Read":"Mark as read"}</button></article>)}
 {current?.more&&<button type="button" disabled={busy||fetching} onClick={()=>{setFetching(true);setOffset(v=>v+25);}}>Load more {p.title.toLowerCase()}</button>}</div></section>;
}
