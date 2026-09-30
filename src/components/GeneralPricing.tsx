import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
type Activity = { id: string; name: string; category: string };
const tiers = ["member", "non_member", "junior", "senior"] as const;
const labels = { member: "Member", non_member: "Non-member", junior: "Junior", senior: "Senior" };
type Values = Record<string,string>;
export function GeneralPricing(p: { clubId: string; userId: string; role: string; clubName: string }) {
  const [name,setName] = useState(p.clubName), [activities,setActivities] = useState<Activity[]>([]), [rates,setRates] = useState<Record<string,Values>>({}), [currency,setCurrency] = useState("");
  const [error,setError] = useState<string|null>(null), [message,setMessage] = useState<string|null>(null), [loading,setLoading] = useState(true), [busy,setBusy] = useState(false), [blocked,setBlocked] = useState(false), [refresh,setRefresh] = useState(0);
  const pending = useRef(false);
  async function identity() { const {data,error} = await supabase.auth.getSession(); if (error || data.session?.user.id !== p.userId) throw new Error("Your session changed. Sign in again."); }
  useEffect(() => { let cancelled=false; setLoading(true); setError(null); setBlocked(false); setActivities([]); setRates({});
    async function load() { try {
      await identity();
      const club=await supabase.from("clubs").select("name,currency").eq("id",p.clubId).single();
      if (club.error) throw new Error("Unable to load club details.");
      const allActivities: Activity[]=[]; const allRates: Record<string,Values>={};
      for(let offset=0;;offset+=500) {
        const result=await supabase.from("lesson_types").select("id,name,category").eq("club_id",p.clubId).eq("active",true).in("category",["rental","private","semi_private","clinic"]).order("id").range(offset,offset+499);
        if(result.error) throw new Error("Unable to load activity types."); allActivities.push(...result.data); if(result.data.length<500)break;
      }
      for(let offset=0;;offset+=500) {
        const result=await supabase.from("club_activity_rates").select("lesson_type_id,membership_type,hourly_rate").eq("club_id",p.clubId).order("lesson_type_id").order("membership_type").range(offset,offset+499);
        if(result.error) throw new Error("Unable to load membership rates. Confirm the settings database update is installed.");
        for(const r of result.data) { (allRates[r.lesson_type_id] ||= {})[r.membership_type]=String(r.hourly_rate); } if(result.data.length<500)break;
      }
      if(!cancelled){setActivities(allActivities);setRates(allRates);setName(club.data.name);setCurrency(club.data.currency);}
    }catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Settings unavailable.");}finally{if(!cancelled)setLoading(false);} }
    void load(); return()=>{cancelled=true;};
  },[p.clubId,p.userId,refresh]);
  async function save(action:()=>Promise<void>) { if(pending.current||blocked)return;pending.current=true;setBusy(true);setError(null);setMessage(null);try{await identity();await action();}catch(e){setBlocked(true);setError((e instanceof Error?e.message:"Save could not be confirmed.")+" Reload rates before retrying.");}finally{pending.current=false;setBusy(false);} }
  return <div className="general-pricing">
    <button type="button" disabled={busy||loading} onClick={()=>{setMessage(null);setRefresh(v=>v+1);}}>Reload rates and club name</button>
    {loading&&<p role="status">Loading general settings...</p>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    {!loading&&!error&&<>
      {["owner","director"].includes(p.role)?<form onSubmit={e=>{e.preventDefault();void save(async()=>{if (!name.trim()) throw new Error("Enter a club name."); const result=await supabase.from("clubs").update({name:name.trim()}).eq("id",p.clubId).select("id,name").single();if(result.error||!result.data)throw new Error("Club name could not be saved.");setName(result.data.name);setMessage("Club name saved. Refresh the page to update the sidebar heading.");});}}><fieldset disabled={busy||blocked}><label>Club name<input value={name} required maxLength={200} minLength={1} onChange={e=>setName(e.target.value)}/></label><button>Save club name</button></fieldset></form>:<p>Club name: <strong>{name}</strong> (Owner/Director can change this.)</p>}
      <h4>Hourly rate schedule ({currency})</h4><p>Blank blocks new bookings for that tier; zero explicitly means free. Saving replaces the four tier rates for that activity. Existing agreed rates stay unchanged. Assign a pricing tier to each profile in Members; guests use Non-member.</p>
      {!activities.length&&<p>No active rental, lesson or clinic types found.</p>}
      {activities.map(a=><form key={a.id} className="rate-card" onSubmit={e=>{e.preventDefault();void save(async()=>{const values=Object.fromEntries(tiers.map(t=>[t,(rates[a.id]?.[t]||"").trim()||null]));const result=await supabase.rpc("save_activity_hourly_rates",{p_club_id:p.clubId,p_lesson_type_id:a.id,p_rates:values});if(result.error||result.data?.saved!==true)throw new Error("Rates could not be saved.");setMessage(`Rates saved for ${a.name}.`);});}}><h4>{a.name}</h4><p>{a.category==="clinic"?"Per participant per hour":"Per court/lesson hour"}</p><fieldset disabled={busy||blocked}>{tiers.map(t=><label key={t}>{labels[t]}<input type="number" min="0" max="9999999999.99" step="0.01" placeholder="Not set" value={rates[a.id]?.[t]||""} onChange={e=>{const value=e.target.value;setRates(old=>({...old,[a.id]:{...old[a.id],[t]:value}}));}}/></label>)}<button>Save rates</button></fieldset></form>)}
    </>}
  </div>;
}
