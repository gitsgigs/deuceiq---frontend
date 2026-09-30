import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type PricingMode = "split" | "highest";
type Price = {currency:string;total:number;awaiting_participants?:boolean;legacy_unpriced?:boolean;lines:{member_id?:string;amount:number;registration_price?:number;tier:string}[]};
export function PricingChoice(p:{value:PricingMode;onChange:(v:PricingMode)=>void}) {
  return <label>Organizer's pricing choice<select value={p.value} onChange={e=>p.onChange(e.target.value as PricingMode)}>
    <option value="split">Split by participant's applicable rate</option>
    <option value="highest">Use the highest applicable rate</option>
  </select><small>Split divides each player's hourly rate by the number of players. Highest uses the highest rate for the whole court/lesson hour.</small></label>;
}
export function PricePreview(p:{clubId:string;userId:string;bookingId?:string;friendEmail?:string;lessonId?:string;startsAt?:string;endsAt?:string;memberIds?:string[];guestCount?:number;mode?:PricingMode;onReady?:(ready:boolean)=>void}) {
  const [result,setResult]=useState<{key:string;price?:Price;error?:string}|null>(null);
  const key=JSON.stringify([p.clubId,p.userId,p.bookingId,p.friendEmail,p.lessonId,p.startsAt,p.endsAt,p.memberIds||[],p.guestCount||0,p.mode||"split"]);
  useEffect(()=>{
    let cancelled=false;
    p.onReady?.(false);
    if(!p.bookingId&&(!p.lessonId||!p.startsAt||!p.endsAt))return;
    const timer=setTimeout(async()=>{try{
      const auth=await supabase.auth.getSession();
      if(auth.error||auth.data.session?.user.id!==p.userId)throw new Error("Sign in again to check pricing.");
      const {data,error}=p.bookingId
        ? await supabase.rpc("quote_clinic_signup",{p_booking_id:p.bookingId,p_member_ids:p.memberIds||[],p_guest_count:p.guestCount||0,p_friend_email:p.friendEmail||null})
        : await supabase.rpc("quote_activity_price",{p_club_id:p.clubId,p_lesson_type_id:p.lessonId,p_starts_at:p.startsAt,p_ends_at:p.endsAt,p_member_ids:p.memberIds||[],p_guest_count:p.guestCount||0,p_pricing_mode:p.mode||"split"});
      if(error)throw new Error(error.code==="PZ001"?error.message:"Pricing is unavailable. Ask club staff to check the pricing setup.");
      if(!data||typeof data.total!=="number"||!Array.isArray(data.lines))throw new Error("Price could not be verified.");
      if(!cancelled){setResult({key,price:data});p.onReady?.(true);}
    }catch(e){if(!cancelled)setResult({key,error:e instanceof Error?e.message:"Pricing unavailable."});}},250);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[key]);
  if(!p.bookingId&&(!p.lessonId||!p.startsAt||!p.endsAt))return <p>Select an activity and valid times to see pricing.</p>;
  if(result?.key!==key)return <p role="status">Checking club pricing…</p>;
  if(result.error)return <p role="alert">{result.error} Booking is unavailable until pricing is configured.</p>;
  const q=result.price!;
  const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:q.currency}).format(n);
  return <div className="price-preview"><strong>{q.awaiting_participants?"Clinic rates configured; each registration is priced separately.":`Estimated total: ${money(q.total)}`}</strong>
    {!q.awaiting_participants&&q.lines.length>1&&<p>{q.lines.map((l,i)=>`Player ${i+1}: ${money(l.amount)}`).join(" · ")}</p>}
    <p>Prices are checked again when saved. Requests are estimates until staff approves. This does not take payment.</p></div>;
}
export function BookingPrice(p:{bookingId:string;userId:string}) {
  const [state,setState]=useState<{key:string;text:string}|null>(null);
  const key=p.bookingId+":"+p.userId;
  useEffect(()=>{let cancelled=false;void(async()=>{try{
    const auth=await supabase.auth.getSession();if(auth.error||auth.data.session?.user.id!==p.userId)throw new Error();
    const {data,error}=await supabase.rpc("get_booking_price",{p_booking_id:p.bookingId});if(error)throw new Error();
    const amount=data?.viewer_share ?? data?.total;
    const text=data?.legacy_unpriced?"Price: not recorded for this earlier booking.":`${data?.viewer_share!=null?"Your current share":"Agreed booking total"}: ${new Intl.NumberFormat("en-US",{style:"currency",currency:data.currency}).format(amount)}`;
    if(!cancelled)setState({key,text});
  }catch{if(!cancelled)setState({key,text:"Price currently unavailable."});}})();return()=>{cancelled=true;};},[key]);
  return <p>{state?.key===key?state.text:"Loading price…"}</p>;
}
