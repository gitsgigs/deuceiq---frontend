import {useEffect,useRef,useState} from "react";
import {staffApi} from "../lib/staffApi";
import type {Context} from "../lib/staffApi";
import "./OpportunityCenter.css";

type Pattern={value:string;sessions:number};
type Profile={member_id:string;name:string;session_count:number;attendance_confirmed:number;patterns:Record<string,Pattern[]>};
type Candidate={opening_id:string;category:string;starts_at:string;ends_at:string;timezone:string;court_id:string;pro_id:string|null;activity_id:string|null;suggested_invitees:{member_id:string;name:string;matching_sessions:number;same_pro_sessions:number}[]};
type Suggestion={candidate:Candidate;agent_note:string;priority:string};
type Review={status:string;note:string};
type Labels=Record<string,Record<string,string>>;
export type Brief={date:string;generated_at:string;scope:string;suggestions:Suggestion[];labels:Labels;reviews:Record<string,Review>;notice:string;unconfirmed:string};
type Center={history:{profiles:Record<string,Profile>;as_of:string;window_days:number};location:{name:string};brief:Brief|null;morning_brief:Brief|null;labels:Labels;storage_ready:boolean};
export type OpportunityContext=Context&{locationId:string|null};
const dateTime=(value:string,zone:string)=>new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short",timeZone:zone}).format(new Date(value));
const heading=(c:Candidate)=>c.category==="clinic"?"Fill a scheduled clinic":c.category==="court"?"Bring regular players back on court":"Offer a familiar lesson time";

export default function OpportunityCenter(p:OpportunityContext){
  const [data,setData]=useState<Center|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [tab,setTab]=useState("opportunities"),[filter,setFilter]=useState("all"),[member,setMember]=useState<string|null>(null),[search,setSearch]=useState("");
  const [briefView,setBriefView]=useState("morning");
  const [editing,setEditing]=useState<Suggestion|null>(null),[note,setNote]=useState(""),[saving,setSaving]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const query=`?club_id=${encodeURIComponent(p.clubId)}&location_id=${encodeURIComponent(p.locationId??"")}`;
  useEffect(()=>{if(!p.locationId)return;const controller=new AbortController();setData(null);setError("");
    void staffApi<Center>(p,"/opportunity-center"+query,"GET",undefined,controller.signal).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message)});
    return()=>controller.abort();},[p.clubId,p.userId,p.locationId]);
  useEffect(()=>{if(!editing)return;const modal=dialog.current!;modal.showModal();return()=>{if(modal.open)modal.close()};},[editing]);
  async function refresh(){setBusy(true);setError("");try{const brief=await staffApi<Brief>(p,"/opportunity-center/refresh"+query,"POST");setData(d=>d?{...d,brief}:d);setBriefView("week");}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  async function save(status:string){if(!editing||!brief)return;setSaving(true);try{const updated=await staffApi<Brief>(p,"/opportunity-center/review"+query,"PATCH",{opening_id:editing.candidate.opening_id,date:brief.date,status,note,morning:briefView==="morning"});setData(d=>d?{...d,[briefView==="morning"?"morning_brief":"brief"]:updated}:d);setEditing(null)}catch(e){setError((e as Error).message)}finally{setSaving(false)}}
  if(!p.locationId)return <p>Select a location to see its opportunities.</p>;
  const brief=briefView==="morning"?data?.morning_brief:data?.brief,profiles=data?.history.profiles??{};
  const active=member?profiles[member]:null;
  function label(value:string,kind:string){if(kind==="partners")return data?.labels.members[value]??"Member";if(kind==="pros")return data?.labels.pros[value]??"Pro";if(kind==="clinics"){const [id,day]=value.split("|");return `${data?.labels.activities[id]??"Clinic"} · ${day}`;}return value.replace("|"," · ");}
  return <div className="oc-page">
    <header className="oc-heading"><div><p className="oc-kicker">TURN PATTERNS INTO POSSIBILITIES</p><p>Better use of your courts. Thoughtful suggestions. Your decision.</p></div><span className="oc-club">{data?.location.name??"Club opportunities"}</span></header>
    <div className="oc-demo-banner"><span>Human review required</span><span>AI explains verified history. Interest, eligibility and prices still need confirmation.</span></div>
    {error&&<p role="alert">{error}</p>}{!data&&!error&&<p>Loading your club’s history…</p>}
    <div className="oc-tabs" role="tablist" aria-label="Opportunity views"><button role="tab" aria-selected={tab==="opportunities"} onClick={()=>setTab("opportunities")}>Opportunities</button><button role="tab" aria-selected={tab==="members"} onClick={()=>setTab("members")}>Member insights</button></div>
    {tab==="opportunities"?<>
      <div className="oc-filters" aria-label="Brief period"><button aria-pressed={briefView==="morning"} onClick={()=>setBriefView("morning")}>Morning brief</button><button aria-pressed={briefView==="week"} onClick={()=>setBriefView("week")}>Next seven days</button></div>
      <section className="oc-metrics"><div><span>Suggestions to review</span><strong>{brief?.suggestions.length??0}</strong><small>Maximum 10 per brief</small></div><div><span>Members with history</span><strong>{Object.values(profiles).filter(v=>v.session_count>0).length}</strong><small>Club members only</small></div><div><span>History window</span><strong>180<em> days</em></strong><small>Counts from saved sessions</small></div><div><span>Final decision</span><strong>Human</strong><small>No automatic bookings or messages</small></div></section>
      <div className="oc-toolbar"><div className="oc-filters">{["all","pending","shortlisted","dismissed"].map(v=><button key={v} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{v==="pending"?"Needs review":v[0].toUpperCase()+v.slice(1)}</button>)}</div><button disabled={!data||busy||!data.storage_ready} onClick={()=>void refresh()}>{busy?"Preparing suggestions…":"Refresh suggestions"}</button></div>
      <p className="oc-bottom-note">Refresh sends candidate times and aggregate counts to our AI provider. Names, contact details and messages are excluded. Today’s generated list is reused to limit repeated AI calls.</p>
      {brief?<><p className="oc-bottom-note">Generated {dateTime(brief.generated_at,brief.suggestions[0]?.candidate.timezone??"UTC")} · {brief.scope==="today"?"Today’s morning brief":"Next seven days"}. Availability can change. Reviews are saved for 14 days.</p>{brief.notice&&<p className="oc-action-notice">{brief.notice}</p>}
        <div className="oc-proposals">{brief.suggestions.filter(s=>filter==="all"||(brief.reviews[s.candidate.opening_id]?.status??"pending")===filter).map(s=>{const c=s.candidate;return <article className={`oc-proposal oc-${c.category}`} key={c.opening_id}>
          <header><span className="oc-category">{c.category}</span><span className="oc-status">{brief.reviews[c.opening_id]?.status??"Needs review"}</span></header><h2>{heading(c)}</h2>
          <p>{dateTime(c.starts_at,c.timezone)}–{new Intl.DateTimeFormat(undefined,{timeStyle:"short",timeZone:c.timezone}).format(new Date(c.ends_at))} · {brief.labels.courts[c.court_id]??"Court"}{c.pro_id?` · ${brief.labels.pros[c.pro_id]??"Pro"}`:""}</p>
          <p>{s.agent_note}</p><div className="oc-invitees">{c.suggested_invitees.map(v=><button key={v.member_id} onClick={()=>{setMember(v.member_id);setTab("members")}}>{v.name}<small>{v.matching_sessions} matching sessions</small></button>)}</div>
          <footer><small>Historical fit; interest unconfirmed.</small><button onClick={()=>{setNote(brief.reviews[c.opening_id]?.note??"");setEditing(s)}}>Review suggestion</button></footer>
        </article>})}</div></>:data&&<div className="oc-empty"><h3>{briefView==="morning"?"Morning brief not ready":"No brief generated yet"}</h3><p>{briefView==="morning"?"The brief is scheduled one hour before opening. You can also refresh suggestions for the coming week.":"Refresh suggestions to check available opportunities against your club’s history."}</p></div>}
    </>:<div className="oc-member-workspace"><section className="oc-member-list"><h2>Member insights</h2><label>Find a member<input value={search} onChange={e=>setSearch(e.target.value)}/></label>{Object.values(profiles).filter(v=>v.name.toLowerCase().includes(search.toLowerCase())).map(v=><button key={v.member_id} onClick={()=>setMember(v.member_id)}>{v.name}<small>{v.session_count} historical sessions</small></button>)}</section>
      {active&&<section className="oc-insights"><header><h3>{active.name}</h3></header>{[["days","Most frequent days"],["partners","Regular playing partners"],["clinics","Clinics & usual days"],["pros","Most frequent assigned pros"],["court_slots","Court rental habits"]].map(([kind,title])=><section className="oc-pattern" key={kind}><h4>{title}</h4>{active.patterns[kind].length?active.patterns[kind].slice(0,5).map(v=><div className="oc-pattern-row" key={v.value}><span>{label(v.value,kind)}</span><strong>{v.sessions} sessions</strong></div>):<p>Not enough history yet</p>}</section>)}<p className="oc-footnote">Partners use shared court rentals and semi-private lessons only. Clinic rosters never establish partners.</p><p className="oc-footnote">{active.attendance_confirmed} sessions have explicit attendance. Other counts reflect bookings; clinic pros may have coached a group.</p></section>}</div>}
    {editing&&<dialog ref={dialog} className="oc-review" onCancel={()=>{if(!saving)setEditing(null)}} aria-label="Review suggestion"><h2>{heading(editing.candidate)}</h2><p>Shortlisting is a review decision. No court is reserved, nobody is enrolled or messaged, and no payment is taken.</p>{error&&<p role="alert">{error}</p>}<label className="oc-note">Staff note<textarea value={note} maxLength={1000} onChange={e=>setNote(e.target.value)}/></label><footer><button disabled={saving} onClick={()=>setEditing(null)}>Close</button><button disabled={saving} onClick={()=>void save("dismissed")}>Dismiss</button><button disabled={saving} onClick={()=>void save("shortlisted")}>Save to shortlist</button></footer></dialog>}
  </div>;
}
