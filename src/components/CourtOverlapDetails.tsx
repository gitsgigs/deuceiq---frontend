type Conflict = {booking_id:string;court_name?:string;activity?:string;location?:string;timezone?:string;starts_at:string;ends_at:string;created_at:string;reserved_at:string};
function when(value:unknown,zone?:string){
 if(typeof value!=="string")return "Not recorded";
 const date=new Date(value);if(Number.isNaN(date.getTime()))return "Not recorded";
 try{return date.toLocaleString(undefined,{timeZone:zone,timeZoneName:"short"});}catch{return date.toLocaleString();}
}
export function CourtOverlapDetails({payload}:{payload?:Record<string,unknown>}){
 const conflicts=(Array.isArray(payload?.conflicts)?payload.conflicts:[]).filter((x):x is Conflict=>typeof x==="object"&&x!==null&&typeof x.booking_id==="string");
 const zone=conflicts[0]?.timezone;
 return <div className="court-overlap-details">
 <p><strong>The existing reservation keeps its court.</strong> The overlapping reservation or change was not saved.</p>
 <dl><dt>Attempted start</dt><dd>{when(payload?.attempted_starts_at,zone)}</dd><dt>Attempted end</dt><dd>{when(payload?.attempted_ends_at,zone)}</dd><dt>Attempt received</dt><dd>{when(payload?.attempted_at,zone)}</dd></dl>
 {conflicts.map((c,i)=><section key={`${c.booking_id}:${i}`}><h5>{c.court_name||"Court"} · {c.activity||"Existing reservation"}</h5><dl><dt>Location</dt><dd>{c.location||"Not recorded"}</dd><dt>Reserved start</dt><dd>{when(c.starts_at,c.timezone)}</dd><dt>Reserved end</dt><dd>{when(c.ends_at,c.timezone)}</dd><dt>Reservation created</dt><dd>{when(c.created_at,c.timezone)}</dd><dt>Court assigned</dt><dd>{when(c.reserved_at,c.timezone)}</dd><dt>Reservation reference</dt><dd>{c.booking_id}</dd></dl></section>)}
 {!conflicts.length&&<p>Reservation details were not recorded.</p>}
 </div>;
}
