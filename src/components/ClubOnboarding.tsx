import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import "./ClubOnboarding.css";

const API = import.meta.env.VITE_API_BASE || "https://api.deuceiq.com";
type Application = {id:string;applicant_name:string;email:string;club_name:string;location:string;status:string;created_at:string;seen_at:string|null;review_note:string;admin_email_status:string;setup_email_status:string};
type Page = {applications:Application[];has_more:boolean;unread:number};
async function api<T>(path:string, body?:unknown, authenticated=false):Promise<T> {
 const headers:Record<string,string>={"Content-Type":"application/json"};
 if(authenticated){const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw new Error("Please sign in again.");headers.Authorization=`Bearer ${data.session.access_token}`;}
 const response=await fetch(`${API}${path}`,{method:body===undefined?"GET":"POST",headers,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store",referrerPolicy:"no-referrer"});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof data.detail==="string"?data.detail:"Request could not be completed. Please try again.");
 return data as T;
}
function errorText(e:unknown){return e instanceof Error?e.message:"Please try again.";}

export function PlatformAdminLink({userId,variant="sidebar"}:{userId:string;variant?:"sidebar"|"overview"}){
 const [state,setState]=useState<{userId:string;allowed:boolean;unread:number}|null>(null);
 useEffect(()=>{let stopped=false,running=false;
  async function load(){
   if(running||document.hidden)return;running=true;
   try{
    const auth=await supabase.auth.getSession();
    if(auth.error||auth.data.session?.user.id!==userId){if(!stopped)setState(null);return;}
    const access=await api<{is_admin:boolean}>("/platform/access",undefined,true);
    // Show authorized navigation even if the optional unread count fails.
    if(!stopped)setState({userId,allowed:access.is_admin,unread:0});
    if(access.is_admin){try{const page=await api<Page>("/platform/club-applications",undefined,true);if(!stopped)setState({userId,allowed:true,unread:page.unread});}catch{/* The destination presents inbox errors; keep authorized navigation available. */}}
   }catch{if(!stopped)setState(null);}finally{running=false;}
  }
  void load();const timer=setInterval(()=>void load(),60000);window.addEventListener("focus",load);return()=>{stopped=true;clearInterval(timer);window.removeEventListener("focus",load);};
 },[userId]);
 if(state?.userId!==userId||!state.allowed)return null;
 if(variant==="overview")return <a className="metric-card platform-admin-overview" href="/platform-admin"><span>Platform Admin {state.unread>0&&<span className="notification-dot" role="img" aria-label="Unread club applications"/>}</span><strong>Review clubs</strong><small>{state.unread>0?`${state.unread} unread applications`:"New club approvals"}</small></a>;
 return <a className="nav-item platform-admin-link" href="/platform-admin"><span className="nav-icon">&#10003;</span><span className="nav-label">Platform Admin {state.unread>0&&<span className="notification-dot" role="img" aria-label="New club applications"/>}</span></a>;
}

function SignIn({onMessage,setupToken}:{onMessage:(s:string)=>void;setupToken?:string}){
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false);
 return <form onSubmit={async e=>{e.preventDefault();setBusy(true);onMessage("");try{const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;}catch(e){onMessage(errorText(e));}finally{setBusy(false);}}}>
  <label>Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
  <label>Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
  <button disabled={busy}>Sign in</button>
  {setupToken&&<button type="button" disabled={busy||!email.trim()} onClick={async()=>{setBusy(true);try{const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/owner-setup?setup=${encodeURIComponent(setupToken)}`});if(error)throw error;onMessage("If eligible, a password setup email has been sent. Open its link to continue.");}catch(e){onMessage(errorText(e));}finally{setBusy(false);}}}>Set or reset password</button>}
 </form>;
}

export function ClubOnboarding(){
 const path=window.location.pathname;
 const [needsPassword,setNeedsPassword]=useState(()=>new URLSearchParams(window.location.search).get("mode")==="new" || new URLSearchParams(window.location.hash.slice(1)).get("type")==="recovery");
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
 const [token]=useState(()=>path==="/register-club"?new URLSearchParams(window.location.hash.slice(1)).get("verify"):new URLSearchParams(window.location.search).get("setup"));
 useEffect(()=>{let active=true;supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setLoading(false);}});const {data}=supabase.auth.onAuthStateChange((event,s)=>{if(event==="PASSWORD_RECOVERY")setNeedsPassword(true);setSession(s);setLoading(false);});return()=>{active=false;data.subscription.unsubscribe();};},[]);
 return <main className="onboarding-shell"><section className={`onboarding-card ${path==="/platform-admin"?"onboarding-wide":""}`}><p className="onboarding-brand">DeuceIQ</p>
 {path==="/register-club"?<RegisterClub token={token} setMessage={setMessage}/>:
 loading?<p>Loading your session...</p>:path==="/platform-admin"?<><h1>Platform Admin</h1><p>Review new club applications. This area is separate from club management.</p>{session?<AdminInbox key={session.user.id} setMessage={setMessage}/>:<SignIn onMessage={setMessage}/>}</>:
 <><h1>Owner setup</h1>{!token?<p>This invitation is missing its setup link. Open the latest invitation email.</p>:session?<OwnerSetup needsPassword={needsPassword} token={token} session={session} setMessage={setMessage}/>:<><p>Open your invitation email, or sign in with the email your club application used.</p><SignIn setupToken={token} onMessage={setMessage}/></>}</>}
 {message&&<p className="onboarding-message" role="status">{message}</p>}
 <div className="onboarding-actions"><a className="onboarding-button" href="/">Back to DeuceIQ</a>{session&&path!=="/register-club"&&<button onClick={()=>void supabase.auth.signOut().then(({error})=>{if(error)setMessage(error.message);})}>Sign out</button>}</div>
 </section></main>;
}

function RegisterClub({token,setMessage}:{token:string|null;setMessage:(s:string)=>void}){
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false);
 if(token)return <><h1>Verify your club application</h1><p>Confirm your email to send your application for review. Your club will need approval before it can be used.</p><button disabled={busy||done} onClick={async()=>{setBusy(true);try{const data=await api<{message:string}>("/club-applications/verify",{token});setMessage(data.message);setDone(true);window.history.replaceState(null,"","/register-club");}catch(e){setMessage(errorText(e));}finally{setBusy(false);}}}>{done?"Email verified":busy?"Verifying...":"Confirm my email"}</button></>;
 return <><h1>Register your club</h1><p>Tell us about your club. Verify your email, then DeuceIQ will review your application.</p><form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setMessage("");try{const data=await api<{message:string}>("/club-applications",{name:f.get("name"),email:f.get("email"),club_name:f.get("club"),location:f.get("location")});setMessage(data.message);setDone(true);}catch(e){setMessage(errorText(e));}finally{setBusy(false);}}}>
 <label>Your name<input name="name" autoComplete="name" required maxLength={120}/></label><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Club name<input name="club" required minLength={2} maxLength={200}/></label><label>Club location<input name="location" placeholder="City, state or region, country" required minLength={2} maxLength={300}/></label>
 <button disabled={busy}>{busy?"Sending...":done?"Resend verification email":"Send verification email"}</button></form></>;
}

function OwnerSetup({token,session,setMessage,needsPassword}:{needsPassword:boolean;token:string;session:Session;setMessage:(s:string)=>void}){
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[password,setPassword]=useState(""),[confirm,setConfirm]=useState("");
 return <><p>Signed in as {session.user.email}. Accept your invitation to manage your approved club.</p><form onSubmit={async e=>{e.preventDefault();if(needsPassword&&!password){setMessage("Set a password to complete your new account.");return;}if(password!==confirm){setMessage("Passwords do not match.");return;}setBusy(true);setMessage("");try{if(password){const {error}=await supabase.auth.updateUser({password});if(error)throw error;}await api<{club_id:string}>("/owner-setup/accept",{token},true);setDone(true);window.history.replaceState(null,"","/owner-setup");setMessage("Your Owner access is ready. Open your club to configure locations, courts, staff, and pricing. Bookings require prices to be set.");}catch(e){setMessage(errorText(e));}finally{setBusy(false);}}}>
 <p>For a new account, set a password below. Existing users may leave these fields empty.</p><label>New password<input type="password" autoComplete="new-password" required={needsPassword} minLength={12} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm password<input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
 <button disabled={busy||done}>{done?"Invitation accepted":busy?"Completing setup...":"Accept Owner invitation"}</button></form>{done&&<a className="onboarding-button" href="/">Open my club</a>}</>;
}

function AdminInbox({setMessage}:{setMessage:(s:string)=>void}){
 const [status,setStatus]=useState("pending"),[offset,setOffset]=useState(0),[page,setPage]=useState<Page|null>(null),[error,setError]=useState(""),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[selected,setSelected]=useState<Application|null>(null),[note,setNote]=useState("");const pending=useRef(false);
 useEffect(()=>{let stopped=false;setPage(null);setError("");api<Page>(`/platform/club-applications?status=${status}&offset=${offset}`,undefined,true).then(data=>{if(!stopped)setPage(data);}).catch(e=>{if(!stopped)setError(errorText(e));});return()=>{stopped=true;};},[status,offset,revision]);
 async function review(decision:string){if(!selected||pending.current)return;pending.current=true;setBusy(true);setMessage("");try{const data=await api<{message:string}>(`/platform/club-applications/${selected.id}/review`,{decision,note},true);setMessage(data.message);setSelected(null);setRevision(v=>v+1);}catch(e){setMessage(errorText(e));setRevision(v=>v+1);}finally{pending.current=false;setBusy(false);}}
 return <><div className="onboarding-actions onboarding-toolbar"><label>Applications<select disabled={busy} value={status} onChange={e=>{setStatus(e.target.value);setOffset(0);setSelected(null);}}>{["pending","approved","accepted","declined"].map(s=><option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}</select></label><button className="onboarding-refresh" disabled={busy} onClick={()=>setRevision(v=>v+1)}>Refresh</button>{page&&<span className="onboarding-unread">{page.unread} unread</span>}</div>
 {error?<p role="alert">{error}</p>:!page?<p>Loading applications...</p>:page.applications.length===0?<p>No {status} applications.</p>:page.applications.map(a=><article className="onboarding-application" key={a.id}><h2>{a.club_name} {!a.seen_at&&a.status==="pending"&&<span className="onboarding-dot" aria-label="Unread"/>}</h2><p>{a.applicant_name} · {a.email}</p><p>{a.location}</p><p>Submitted {new Date(a.created_at).toLocaleString()}</p>{a.status==="approved"&&<p>Setup email: {a.setup_email_status}</p>}{a.admin_email_status==="failed"&&<p>The administrator email failed; this request is safely stored here.</p>}<button disabled={busy} onClick={async()=>{setSelected(a);setNote(a.review_note||"");try{await api(`/platform/club-applications/${a.id}/seen`,{},true);setRevision(v=>v+1);}catch(e){setMessage(errorText(e));}}}>Review details</button></article>)}
 {selected&&<section className="onboarding-review"><h2>{selected.club_name}</h2><p>{selected.applicant_name} ({selected.email}) will receive Owner access to a separate club if approved.</p><label>Private review note<textarea value={note} maxLength={1000} disabled={busy} onChange={e=>setNote(e.target.value)}/></label><div className="onboarding-actions">{selected.status==="pending"&&<><button disabled={busy} onClick={()=>void review("approve")}>Approve and send setup invitation</button><button disabled={busy} onClick={()=>void review("decline")}>Decline application</button></>}{selected.status==="approved"&&<button disabled={busy} onClick={()=>void review("resend")}>Resend setup invitation</button>}<button disabled={busy} onClick={()=>setSelected(null)}>Close</button></div></section>}
 <div className="onboarding-actions onboarding-pagination"><button disabled={busy||offset===0} onClick={()=>{setOffset(v=>Math.max(0,v-25));setSelected(null);}}>Previous</button><span>Page {offset/25+1}</span><button disabled={busy||!page?.has_more} onClick={()=>{setOffset(v=>v+25);setSelected(null);}}>Next</button></div></>;
}
