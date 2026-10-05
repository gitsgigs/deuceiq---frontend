import {useEffect,useState} from "react";
import {staffApi} from "../lib/staffApi";
import type {Brief,OpportunityContext} from "./OpportunityCenter";
import "./MorningBrief.css";

export default function MorningBrief(p:OpportunityContext&{onOpen:()=>void}){
  const [state,setState]=useState<{date:string;brief:Brief|null;opening_time:string;timezone:string;storage_ready:boolean}|null>(null),[error,setError]=useState("");
  useEffect(()=>{if(!p.locationId)return;let stopped=false,running=false;const controller=new AbortController();setState(null);setError("");async function load(){if(running)return;running=true;try{const result=await staffApi<NonNullable<typeof state>>(p,`/opportunity-center/morning-brief?club_id=${p.clubId}&location_id=${p.locationId}`,"GET",undefined,controller.signal);if(!stopped){setState(result);setError("")}}catch(e){if(!stopped)setError((e as Error).message)}finally{running=false}}void load();const timer=setInterval(()=>{if(!document.hidden)void load()},60000);return()=>{stopped=true;controller.abort();clearInterval(timer)}},[p.clubId,p.userId,p.locationId]);
  const brief=state?.brief;
  const hour=Number(state?.opening_time?.slice(0,2)),minutes=Number(state?.opening_time?.slice(3,5));
  const before=((hour*60+minutes-60)+1440)%1440;const h=Math.floor(before/60);
  const scheduled=Number.isFinite(before)?`${h%12||12}:${String(before%60).padStart(2,"0")} ${h>=12?"PM":"AM"}${hour===0?" the previous day":""}`:null;
  return <section className="morning-brief" aria-label="Morning brief"><div className="morning-brief-heading"><h3>Morning brief</h3><span>{brief?`${brief.suggestions.length} suggestions`:"Daily review"}</span></div>
    {error?<p role="alert">{error}</p>:brief?<><p>{state?.date} · {brief.suggestions.length} opportunities for today.</p>{brief.notice&&<p>{brief.notice}</p>}<ul>{brief.suggestions.slice(0,3).map(s=><li key={s.candidate.opening_id}>{s.agent_note}</li>)}</ul></>:<p>{!p.locationId?"Select a location.":!state?"Checking today’s brief…":!state.storage_ready?"Brief storage is unavailable.":scheduled?`Prepared daily at ${scheduled} (${state.timezone}), one hour before opening. No brief is ready for today yet.`:"Set this location’s opening hours to schedule its brief."}</p>}
    <div className="morning-brief-footer"><small>Target 5–10 supported suggestions. Maximum 10.<br/>Every action needs human review.</small><button onClick={p.onOpen}>View opportunities →</button></div>
  </section>;
}
