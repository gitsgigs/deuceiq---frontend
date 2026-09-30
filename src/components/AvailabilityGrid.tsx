import {useMemo} from "react";
type Slot={court_id:string;court_name:string;starts_at:string;ends_at:string};
export function AvailabilityGrid(p:{slots:Slot[];selected:Slot|null;disabled:boolean;duration:string;format:(iso:string)=>string;onSelect:(slot:Slot)=>void}){
 const {courts,times,cells}=useMemo(()=>{
  const courts=[...new Map(p.slots.map(s=>[s.court_id,s.court_name])).entries()];
  courts.sort((a,b)=>a[1].localeCompare(b[1],undefined,{numeric:true}));
  const times=[...new Set(p.slots.map(s=>s.starts_at))].sort((a,b)=>Date.parse(a)-Date.parse(b));
  const cells=new Map(p.slots.map(s=>[`${s.court_id}:${s.starts_at}`,s]));
  return {courts,times,cells};
 },[p.slots]);
 if(!p.slots.length)return null;
 return <section className="availability-calendar" aria-label="Available court times">
  <p className="availability-calendar-key"><strong>Choose a green time.</strong> Each cell starts a {p.duration}-minute booking. A dash means no opening for that duration.</p>
  <div className="availability-calendar-scroll" tabIndex={0} role="region" aria-label="Court availability calendar, scroll for more courts and times">
   <table><caption className="availability-grid-caption">Available booking start times by court</caption>
    <thead><tr><th scope="col">Start time</th>{courts.map(([id,name])=><th scope="col" key={id}>{name}</th>)}</tr></thead>
    <tbody>{times.map(start=><tr key={start}><th scope="row">{p.format(start)}</th>{courts.map(([id,name])=>{
     const slot=cells.get(`${id}:${start}`);
     const selected=!!slot&&p.selected?.court_id===id&&p.selected.starts_at===start&&p.selected.ends_at===slot.ends_at;
     return <td key={id}>{slot?<button type="button" disabled={p.disabled} aria-pressed={selected} aria-label={`${name}, ${p.format(start)} to ${p.format(slot.ends_at)}${selected?", selected":""}`} onClick={()=>p.onSelect(slot)}><span>{selected?"✓ Selected":"Available"}</span><small>until {p.format(slot.ends_at)}</small></button>:<span className="availability-no-slot" aria-label={`${name}: no opening at ${p.format(start)}`}>—</span>}</td>;
    })}</tr>)}</tbody>
   </table>
  </div><p className="availability-scroll-hint">Scroll for more times and courts. Times follow the selected location's time zone.</p>
 </section>;
}
