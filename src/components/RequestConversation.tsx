import {bookingDateRange} from "../lib/bookingDateRange";
import {useRequestUnread,refreshRequestUnread} from "../lib/requestUnread";
import {useEffect,useRef,useState} from "react";
import {staffApi,type Context} from "../lib/staffApi";
import "./RequestConversation.css";
type Thread={request_id:string;club_id:string;status:string;messages:{id:string;sender_label:string;body:string;created_at:string;mine:boolean}[]};
export function RequestConversation({context:p,requestId}:{context:Context;requestId:string}){
 const [open,setOpen]=useState(false),[thread,setThread]=useState<Thread|null>(null),[error,setError]=useState(""),[body,setBody]=useState(""),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const attempt=useRef<{body:string;id:string}|null>(null),sending=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const unread=useRequestUnread(p,requestId);
 const seen=useRef("");
 const path=`/member-booking-requests/${encodeURIComponent(requestId)}/conversation?club_id=${encodeURIComponent(p.clubId)}`;
 function check(t:Thread){if(t.request_id!==requestId||t.club_id!==p.clubId||!Array.isArray(t.messages))throw new Error("Could not confirm conversation.");return t;}
 useEffect(()=>{if(!open)return;const c=new AbortController();let cancelled=false,running=false;
  async function load(){if(running||sending.current)return;running=true;try{const t=check(await staffApi<Thread>(p,path,"GET",undefined,c.signal));if(!cancelled){setThread(t);setError("");}}catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Unable to load conversation.");}finally{running=false;}}
  void load();const timer=setInterval(()=>{if(!document.hidden)void load();},15000);return()=>{cancelled=true;c.abort();clearInterval(timer);};
 },[open,path,p.userId,p.apiBase,revision]);
 useEffect(()=>{if(!open||!thread||document.hidden)return;const ids=thread.messages.filter(m=>!m.mine).map(m=>m.id);const signature=JSON.stringify(ids);if(!ids.length||seen.current===signature)return;let cancelled=false;
  staffApi(p,`/member-booking-requests/${encodeURIComponent(requestId)}/conversation/seen?club_id=${encodeURIComponent(p.clubId)}`,"POST",{message_ids:ids}).then(()=>{if(!cancelled){seen.current=signature;refreshRequestUnread(p);window.dispatchEvent(new Event("deuceiq-notifications-refresh"));}}).catch(()=>{});return()=>{cancelled=true;};
 },[open,thread,requestId,p.userId,p.clubId,p.apiBase]);
 async function send(){const text=body.trim();if(!text||sending.current)return;sending.current=true;setBusy(true);setError("");
  if(attempt.current?.body!==text)attempt.current={body:text,id:crypto.randomUUID()};
  try{const t=check(await staffApi<Thread>(p,path,"POST",{message:text,message_id:attempt.current.id}));if(alive.current){setThread(t);setBody("");attempt.current=null;}}
  catch(e){if(alive.current)setError(e instanceof Error?e.message:"Unable to confirm message. Retry without changing it to avoid duplicates.");}finally{sending.current=false;if(alive.current)setBusy(false);}
 }
 return <div className="request-conversation"><button aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?"Hide conversation":"Message / conversation"}{unread&&<span className="request-unread-dot" role="img" aria-label="New unread messages" title="New unread messages"/>}</button>{open&&<div className="request-chat"><h5>Request conversation</h5><p>Shared with the requesting player and authorized club staff.</p>{error&&<p role="alert">{error} <button disabled={busy} onClick={()=>setRevision(v=>v+1)}>Refresh chat</button></p>}{!thread&&!error&&<p role="status">Loading conversation…</p>}
 {thread&&thread.messages.length>=200&&<p>Showing the latest 200 messages. Earlier messages remain saved.</p>}<div className="request-chat-history" aria-label="Conversation messages">{thread?.messages.map(m=><div className={m.mine?"request-message mine":"request-message"} key={m.id}><strong>{m.mine?"You":m.sender_label}</strong><time>{new Date(m.created_at).toLocaleString()}</time><p>{m.body}</p></div>)}{thread&&!thread.messages.length&&<p>No messages yet.</p>}</div>
 {thread?.status==="pending"?<form onSubmit={e=>{e.preventDefault();void send();}}><label>Message<textarea value={body} disabled={busy} maxLength={2000} onChange={e=>setBody(e.target.value)} rows={3}/></label><button disabled={busy||!body.trim()}>{busy?"Sending…":"Send message"}</button></form>:thread&&<p>Request {thread.status}. This conversation is closed.</p>}</div>}</div>;
}
export function MyRequestConversations({context:p}:{context:Context}){
 const [page,setPage]=useState<{key:string;rows:{id:string;status:string;activity:string;starts_at:string;ends_at:string;decision_note?:string}[];more:boolean}|null>(null),[error,setError]=useState(""),[offset,setOffset]=useState(0);
 const key=JSON.stringify([p.userId,p.clubId,offset]);
 useEffect(()=>{let cancelled=false,running=false;const c=new AbortController();setError("");async function load(){if(running)return;running=true;try{const d=await staffApi<{requests:NonNullable<typeof page>["rows"];has_more:boolean}>(p,`/member/request-conversations?club_id=${encodeURIComponent(p.clubId)}&offset=${offset}`,"GET",undefined,c.signal);if(!cancelled){setPage({key,rows:d.requests,more:d.has_more});setError("");}}catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Unable to load requests.");}finally{running=false;}}void load();const timer=setInterval(()=>{if(!document.hidden)void load();},15000);return()=>{cancelled=true;c.abort();clearInterval(timer);};},[key,p.apiBase]);
 const current=page?.key===key?page:null;
 return <section className="my-request-conversations"><h4>My requests and messages</h4>{error&&<p role="alert">{error}</p>}{current?.rows.map(r=><article key={r.id}><strong>{r.activity||"Booking request"} · {r.status}</strong><p>{bookingDateRange(r.starts_at,r.ends_at)}</p>{r.decision_note&&<p>{r.decision_note}</p>}<RequestConversation key={`${key}:${r.id}`} context={p} requestId={r.id}/></article>)}{current&&!current.rows.length&&<p>No requests yet.</p>}<button disabled={!offset} onClick={()=>setOffset(v=>Math.max(0,v-25))}>Previous requests</button><button disabled={!current?.more} onClick={()=>setOffset(v=>v+25)}>More requests</button></section>;
}
