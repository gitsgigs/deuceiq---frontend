import {useState} from "react";
import "./MemberClinicCalendar.css";
type Clinic={booking_id:string;name:string;starts_at:string;ends_at:string;location_name:string|null;pro_name:string|null;spots_remaining:number;enrolled_count:number;capacity:number;waitlist_count:number};
const dayKey=(d:Date)=>`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export function MemberClinicCalendar<T extends Clinic>({clinics,loading,error,onSelectClinic}:{clinics:T[];loading:boolean;error:string|null;onSelectClinic:(c:T)=>void}){
 const [selectedMonth,setMonth]=useState<Date|null>(null);
 const sorted=clinics.filter(c=>!Number.isNaN(Date.parse(c.starts_at))).slice().sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
 const first=sorted.length?new Date(sorted[0].starts_at):new Date();
 const month=selectedMonth||new Date(first.getFullYear(),first.getMonth(),1);
 const start=new Date(month.getFullYear(),month.getMonth(),1),days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 const groups=new Map<string,T[]>();for(const c of sorted){const key=dayKey(new Date(c.starts_at));groups.set(key,[...(groups.get(key)||[]),c]);}
 const move=(delta:number)=>setMonth(new Date(month.getFullYear(),month.getMonth()+delta,1));
 const time=(value:string)=>new Date(value).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
 const cells=Array.from({length:Math.ceil((start.getDay()+days)/7)*7},(_,i)=>{const n=i-start.getDay()+1;return n>0&&n<=days?new Date(month.getFullYear(),month.getMonth(),n):null;});
 return <section className="members-card member-clinic-calendar"><div className="clinic-calendar-heading"><h3>Available Clinics</h3><span>{clinics.length} upcoming</span></div><p>Select a clinic for details and registration. Dates and times use your device's time zone.</p>
 <div className="clinic-calendar-toolbar"><button onClick={()=>move(-1)} aria-label="Previous month">Previous</button><h4 aria-live="polite">{month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h4><button onClick={()=>move(1)} aria-label="Next month">Next</button><button onClick={()=>setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1))}>This month</button></div>
 {loading?<p role="status">Loading clinics...</p>:error?<p role="alert">{error}</p>:<><div className="clinic-calendar-scroll"><div className="clinic-calendar-grid">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div className="clinic-weekday" key={d}>{d}</div>)}{cells.map((d,i)=><div className={`clinic-day${d?'':' clinic-day-empty'}`} key={i}>{d&&<><time className={dayKey(d)===dayKey(new Date())?'clinic-today':''} dateTime={`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}><span className="clinic-phone-date">{d.toLocaleDateString(undefined,{weekday:"short",month:"short"})} </span>{d.getDate()}</time>{(groups.get(dayKey(d))||[]).map(c=><button className="clinic-calendar-event" key={c.booking_id} onClick={()=>onSelectClinic(c)}><strong>{c.name}</strong><span>{time(c.starts_at)} - {time(c.ends_at)}</span><span>{c.location_name||'Location TBD'}</span>{c.pro_name&&<span>{c.pro_name}</span>}<span className="clinic-availability">{c.spots_remaining>0?`${c.spots_remaining} spots open`:'Waitlist'} · {c.enrolled_count}/{c.capacity} enrolled{c.waitlist_count>0?` · ${c.waitlist_count} waitlisted`:''}</span></button>)}</>}</div>)}</div></div>{!sorted.some(c=>{const d=new Date(c.starts_at);return d.getFullYear()===month.getFullYear()&&d.getMonth()===month.getMonth();})&&<p>No available clinics in this month.</p>}</>}
 </section>;
}
