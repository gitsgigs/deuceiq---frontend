import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { createRequest } from "../lib/createActions";
export type PickedPlayer={id:string;first_name:string;last_name:string};
export function PlayerPicker(p:{apiBase:string;clubId:string;userId:string;selected:PickedPlayer[];onChange:(v:PickedPlayer[])=>void;max:number}){
 const [search,setSearch]=useState(''),[rows,setRows]=useState<PickedPlayer[]>([]),[error,setError]=useState<string|null>(null);
 useEffect(()=>{const c=new AbortController();let cancelled=false;setRows([]);setError(null);
 const timer=setTimeout(async()=>{if(search.trim().length<2)return;try{const auth=await supabase.auth.getSession();if(auth.error||auth.data.session?.user.id!==p.userId)throw new Error('Sign in again.');const query=new URLSearchParams({club_id:p.clubId,search:search.trim(),include_inactive:'false'});const result=await createRequest(p.apiBase,auth.data.session.access_token,`/members?${query}`,{signal:c.signal});if(!Array.isArray(result))throw new Error('Player search unavailable.');if(!cancelled)setRows((result as PickedPlayer[]).slice(0,30));}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Search failed.');}},300);
 return()=>{cancelled=true;c.abort();clearTimeout(timer);};},[search,p.apiBase,p.clubId,p.userId]);
 return <div><label>Assign players<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search member names (2+ letters)"/></label>{error&&<p role="alert">{error}</p>}
 {p.selected.map(m=><p key={m.id}>{m.first_name} {m.last_name} <button type="button" onClick={()=>p.onChange(p.selected.filter(x=>x.id!==m.id))}>Remove</button></p>)}
 {rows.filter(r=>!p.selected.some(s=>s.id===r.id)).map(m=><button key={m.id} type="button" disabled={p.selected.length>=p.max} onClick={()=>p.onChange([...p.selected,m])}>{m.first_name} {m.last_name}</button>)}
 </div>;
}
