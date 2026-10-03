export const clinicWeekdays=[{code:'MO',label:'Mon'},{code:'TU',label:'Tue'},{code:'WE',label:'Wed'},{code:'TH',label:'Thu'},{code:'FR',label:'Fri'},{code:'SA',label:'Sat'},{code:'SU',label:'Sun'}];
export type ClinicTimeSlot={days:string[];start:string;end:string};
export function weekdayForDate(date:string){return ['SU','MO','TU','WE','TH','FR','SA'][new Date(`${date}T12:00:00Z`).getUTCDay()];}
export function validateClinicSlots(slots:ClinicTimeSlot[],firstDate:string,lastDate:string){
 if(!slots.length||slots.length>6)throw new Error('Choose between one and six weekly time slots.');
 const clock=(v:string)=>{if(!/^\d{2}:\d{2}$/.test(v))throw new Error('Enter a start and end time for every slot.');const [h,m]=v.split(':').map(Number);if(h>23||m>59)throw new Error('Choose valid local times.');return h*60+m;};
 return slots.map((slot,i)=>{
  if(!slot.days.length||slot.days.some(d=>!clinicWeekdays.some(w=>w.code===d)))throw new Error(`Choose at least one weekday for time slot ${i+1}.`);
  const start=clock(slot.start),end=clock(slot.end);
  if(end<=start)throw new Error(`Time slot ${i+1} must finish after it starts on the same day.`);
  for(const prior of slots.slice(0,i)){if(prior.days.some(d=>slot.days.includes(d))&&start<clock(prior.end)&&end>clock(prior.start))throw new Error('Weekly time slots overlap on the same day. Adjust their days or times.');}
  let occurrences=0;for(let day=firstDate;day<=lastDate;){if(slot.days.includes(weekdayForDate(day)))occurrences++;const next=new Date(`${day}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);day=next.toISOString().slice(0,10);}
  if(occurrences>366)throw new Error('A time slot can contain at most 366 sessions. Shorten the date range or select fewer days.');
  if(!occurrences)throw new Error(`Time slot ${i+1} has no matching weekday in the chosen date range.`);
  return {...slot,days:clinicWeekdays.filter(w=>slot.days.includes(w.code)).map(w=>w.code),duration_minutes:end-start};
 });
}
