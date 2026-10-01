import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./OwnerChecklist.css";

type Destination = "settings" | "members" | "pros";
type Props = { apiBase: string; userId: string; clubId: string; role: string; onNavigate: (destination: Destination) => void };
type Step = { id: string; title: string; description: string; destination: Destination; optional?: boolean };
type Result = { done: boolean; detail: string; unavailable?: boolean };
const steps: Step[] = [
  {id:"locations", title:"Review your locations", description:"Set location details, time zones, and opening hours.", destination:"settings"},
  {id:"courts", title:"Set up your courts", description:"Have an active court assigned to a location.", destination:"settings"},
  {id:"pricing", title:"Set your prices", description:"Save all four pricing tiers for each active booking activity. Zero means free.", destination:"settings"},
  {id:"members", title:"Add your first member", description:"Add or invite members from the Members page.", destination:"members"},
  {id:"pros", title:"Add your teaching pros", description:"Needed if your club offers lessons with a pro.", destination:"pros", optional:true},
  {id:"payments", title:"Set up club payments", description:"Connect your club's account when you're ready to accept payments.", destination:"settings", optional:true},
];

export function OwnerChecklist(p: Props) {
  const [results, setResults] = useState<Record<string, Result>>({});
  const [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true);
  useEffect(() => {
    if (p.role !== "owner" || !p.clubId) return;
    const controller = new AbortController(); setResults({}); setLoading(true);
    async function load() {
      try {
        const {data,error} = await supabase.auth.getSession();
        if (error || data.session?.user.id !== p.userId) throw new Error("Sign in again to check progress.");
        const token = data.session.access_token;
        const jobs: Record<string, () => Promise<Result>> = {
          locations: async () => {
            const {data,error} = await supabase.from("locations").select("id,timezone,opening_time,closing_time").eq("club_id",p.clubId).abortSignal(controller.signal);
            if (error) throw error;
            const done = !!data?.length && data.every(r => r.timezone && r.opening_time && r.closing_time);
            return {done,detail: done ? "Locations have time zones and opening hours." : "Review location details and opening hours in Settings."};
          },
          courts: async () => {
            const {count,error} = await supabase.from("courts").select("id",{count:"exact",head:true}).eq("club_id",p.clubId).eq("active",true).not("location_id","is",null).abortSignal(controller.signal);
            if (error) throw error;
            return {done: (count ?? 0)>0,detail: (count ?? 0)>0 ? `${count} active court${count===1?"":"s"} assigned to locations.` : "Add or activate a court and assign its location."};
          },
          pricing: async () => {
            const activities: {id:string}[] = []; const rates: {lesson_type_id:string;membership_type:string;hourly_rate:number|null}[] = [];
            for(let offset=0;;offset+=500) {
              const {data,error}=await supabase.from("lesson_types").select("id").eq("club_id",p.clubId).eq("active",true).in("category",["rental","private","semi_private","clinic"]).order("id").range(offset,offset+499).abortSignal(controller.signal);
              if(error)throw error; activities.push(...(data ?? [])); if(!data || data.length<500)break;
            }
            for(let offset=0;;offset+=500) {
              const {data,error}=await supabase.from("club_activity_rates").select("lesson_type_id,membership_type,hourly_rate").eq("club_id",p.clubId).order("lesson_type_id").order("membership_type").range(offset,offset+499).abortSignal(controller.signal);
              if(error)throw error; rates.push(...(data ?? [])); if(!data || data.length<500)break;
            }
            const complete = activities.filter(a => ["member","non_member","junior","senior"].every(t => rates.some(r => r.lesson_type_id===a.id && r.membership_type===t && r.hourly_rate!==null && Number.isFinite(Number(r.hourly_rate)) && Number(r.hourly_rate)>=0))).length;
            return {done: activities.length>0 && complete===activities.length,detail: activities.length ? `${complete} of ${activities.length} activities have all four tier prices. Intentionally blank tiers keep this step pending.` : "No active booking activities found. Review General Settings."};
          },
          members: async () => {
            const {count,error} = await supabase.from("members").select("id",{count:"exact",head:true}).eq("club_id",p.clubId).eq("active",true).abortSignal(controller.signal);
            if(error)throw error;
            return {done:(count ?? 0)>0,detail:(count ?? 0)>0 ? "An active member profile is saved." : "Add your first member or send an invitation."};
          },
          pros: async () => {
            const {count,error} = await supabase.from("pros").select("id",{count:"exact",head:true}).eq("club_id",p.clubId).eq("active",true).abortSignal(controller.signal);
            if(error)throw error;
            return {done:(count ?? 0)>0,detail:(count ?? 0)>0 ? "An active pro profile is saved." : "Optional for clubs that only rent courts."};
          },
          payments: async () => {
            const response=await fetch(`${p.apiBase.replace(/\/$/,"")}/payments/connect/status?club_id=${encodeURIComponent(p.clubId)}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal,cache:"no-store"});
            if(!response.ok) return {done:false,unavailable:true,detail:"Payment setup is not available yet. You can finish the other steps."};
            const result=await response.json();
            // Test readiness is never represented as live payment readiness.
            if(result.mode==="test")return {done:false,detail:result.state==="ready" ? "Test account connected. Live payment collection is still pending." : "Test setup only. You can return to Stripe setup later."};
            return {done:false,unavailable:true,detail:"Live payment readiness has not been verified."};
          },
        };
        await Promise.all(steps.map(async step => {
          let result: Result;
          try {result=await jobs[step.id]();} catch {result={done:false,unavailable:true,detail:"Could not check this step. Refresh to try again."};}
          if(!controller.signal.aborted)setResults(old=>({...old,[step.id]:result}));
        }));
      } catch {
        if(!controller.signal.aborted)setResults(Object.fromEntries(steps.map(s=>[s.id,{done:false,unavailable:true,detail:"Sign in again to check setup progress."}])));
      } finally {if(!controller.signal.aborted)setLoading(false);}
    }
    void load(); return()=>controller.abort();
  },[p.apiBase,p.clubId,p.userId,p.role,refresh]);
  if(p.role!=="owner" || !p.clubId)return null;
  const essentials=steps.filter(s=>!s.optional), done=essentials.filter(s=>results[s.id]?.done).length;
  return <section className="owner-checklist" aria-labelledby="owner-checklist-title">
    <header><div><p className="card-kicker">GETTING STARTED</p><h3 id="owner-checklist-title">New owner checklist</h3><p>{loading ? "Checking your club setup..." : `${done} of ${essentials.length} essential steps complete`}</p></div><button disabled={loading} onClick={()=>setRefresh(n=>n+1)}>Refresh progress</button></header>
    <progress aria-label="Essential club setup progress" max={essentials.length} value={done}/>
    <p className="owner-checklist-intro">Progress updates from your saved club details. Owners of this club share the same setup progress. You can finish these steps at your own pace.</p>
    <details open={done!==essentials.length}><summary>{done===essentials.length ? "Essential setup complete — review checklist" : "Your setup steps"}</summary>
      <ol>{steps.map(step=>{const result=results[step.id];return <li key={step.id}>
        <span className={`owner-step-marker ${result?.done ? "is-complete" : ""}`} aria-hidden="true">{result?.done ? "✓" : "○"}</span>
        <div><h4>{step.title}{step.optional && <span className="owner-step-optional">Optional</span>}</h4><p>{step.description}</p><p className="owner-step-detail">{result ? `${result.done ? "Complete: " : result.unavailable ? "Not checked: " : ""}${result.detail}` : "Checking..."}</p></div>
        <button onClick={()=>p.onNavigate(step.destination)}>{result?.done ? "Review" : "Open"}</button>
      </li>;})}</ol>
    </details>
  </section>;
}
