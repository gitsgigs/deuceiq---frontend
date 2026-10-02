export function bookingDateRange(startValue:string,endValue:string,timeZone?:string):string {
  const start=new Date(startValue),end=new Date(endValue);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))return "Date unavailable";
  const date=new Intl.DateTimeFormat('en-US',{timeZone,month:'short',day:'numeric',year:'numeric'});
  const time=new Intl.DateTimeFormat('en-US',{timeZone,hour:'numeric',minute:'2-digit',...(timeZone?{timeZoneName:'short' as const}:{})});
  const firstDate=date.format(start),lastDate=date.format(end);
  return firstDate===lastDate
    ? `${firstDate}, ${time.format(start)} – ${time.format(end)}`
    : `${firstDate}, ${time.format(start)} – ${lastDate}, ${time.format(end)}`;
}
