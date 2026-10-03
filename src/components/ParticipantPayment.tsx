import {MemberPaymentRecovery} from "./MemberPaymentRecovery";
import {useEffect,useRef,useState} from 'react';
import {staffApi,type Context} from '../lib/staffApi';
import './ParticipantPayment.css';
type Payment={id:string;amount_cents:number;paid_cents:number;refunded_cents:number;status:string;receipt_url:string|null;channel:string};
type Info={url?:string|null;mode:string;name:string;eligible:boolean;card:string|null;payment:Payment|null;refunds:{id:string;status:string;amount_cents:number}[]};
const dollars=(v:number)=>(v/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
const cents=(v:string)=>/^\d+(\.\d{1,2})?$/.test(v)?Math.round(Number(v)*100):NaN;
export function ParticipantPayment({context:p,bookingId,recordId,name}:{context:Context;bookingId:string;recordId:string;name:string}){
 const [open,setOpen]=useState(false),[data,setData]=useState<Info|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[amount,setAmount]=useState(''),[reason,setReason]=useState(''),[action,setAction]=useState('card'),[review,setReview]=useState(false),[url,setUrl]=useState(''),[revision,setRevision]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),pending=useRef(false);
 const base=`/payments/bookings/${bookingId}/participants/${recordId}`;
 const query=`?club_id=${encodeURIComponent(p.clubId)}`;
 useEffect(()=>{if(!open)return;dialog.current?.showModal();const c=new AbortController();setError('');setData(null);void staffApi<Info>(p,base+query,'GET',undefined,c.signal).then(d=>{if(!c.signal.aborted){setData(d);setAction(d.card?"card":"checkout");if(d.url){const u=new URL(d.url);if(u.protocol==="https:"&&u.hostname==="checkout.stripe.com")setUrl(d.url);}}}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[open,revision,p.clubId,p.userId,base,query]);
 async function submit(){if(pending.current||!data)return;pending.current=true;setBusy(true);setError('');try{
  const refund=!!data.payment;
  const result=await staffApi<{payment:Payment;url?:string;refund_status?:string}>(p,refund?`/payments/records/${data.payment!.id}/refund${query}`:`${base}/charge${query}`,'POST',refund?{amount_cents:cents(amount),baseline_cents:data.payment!.refunded_cents,reason}:{amount_cents:cents(amount),reason,channel:action});
  setData({...data,payment:result.payment});setReview(false);setAmount('');setReason('');
  if(result.url){const u=new URL(result.url);if(u.protocol==='https:'&&u.hostname==='checkout.stripe.com')setUrl(result.url);}
  if(result.refund_status)setError(`Refund status: ${result.refund_status}. DeuceIQ retains its $1 fee.`);
 }catch(e){setError(e instanceof Error?e.message:'Payment result uncertain. Refresh before retrying.');setReview(false);}finally{pending.current=false;setBusy(false);}}
 const pay=data?.payment;const refundable=pay?pay.paid_cents-pay.refunded_cents:0;
 const valid=Number.isFinite(cents(amount))&&cents(amount)>=(pay?1:101)&&cents(amount)<=(pay?refundable:1000000)&&reason.trim().length>0;
 return <><button type="button" className="participant-payment-button" onClick={()=>{setOpen(true);setReview(false);setUrl('');}}>Charge / Refund</button>{open&&<dialog ref={dialog} className="participant-payment-dialog" onCancel={e=>{if(busy)e.preventDefault();else setOpen(false);}}><h3>Payment · {name}</h3><button type="button" disabled={busy} onClick={()=>{dialog.current?.close();setOpen(false);}}>Close</button>
 {error&&<p role="status">{error}</p>}{!data&&!error&&<p>Loading payment details…</p>}
 {data&&<><p><strong>{data.mode==='live'?'Live payments':'Test mode — no real money'}</strong></p>{pay?<><p>Status: <strong>{pay.status.replaceAll('_',' ')}</strong></p><p>Charge: {dollars(pay.amount_cents)} · Paid: {dollars(pay.paid_cents)} · Refunded: {dollars(pay.refunded_cents)}</p>{pay.receipt_url&&<a href={pay.receipt_url} target="_blank" rel="noopener noreferrer">View receipt</a>}{!pay.paid_cents&&<p>This payment is not confirmed as paid. Refresh to check its result. Do not collect a second payment while this one is unresolved.</p>}</>:<p>Saved card: {data.card||'None authorized'}</p>}
 <p>The member pays the entered amount. The club absorbs DeuceIQ’s $1 fee and Stripe fees. DeuceIQ’s $1 is not returned on refunds.</p>
 {((!pay&&data.eligible)||refundable>0)&&<form onSubmit={e=>{e.preventDefault();if(valid)setReview(true);}}>
 {!pay&&<label>Method<select value={action} disabled={busy||review} onChange={e=>setAction(e.target.value)}><option value="card" disabled={!data.card}>Charge saved card</option><option value="checkout">Create secure payment link</option></select></label>}
 <label>{pay?'Refund amount':'Charge amount'} (USD)<input inputMode="decimal" value={amount} disabled={busy||review} onChange={e=>setAmount(e.target.value)} placeholder="0.00" required/></label>
 <label>Reason / booking charge description<input value={reason} maxLength={500} disabled={busy||review} onChange={e=>setReason(e.target.value)} required/></label>
 {!review?<button type="submit" disabled={busy||!valid||(!pay&&action==='card'&&!data.card)}>Review {pay?'refund':'charge'}</button>:<div className="payment-review"><p><strong>{pay?'Refund':action==='card'?'Charge':'Request'} {dollars(cents(amount))} {pay?'to':'from'} {name}</strong></p><p>{reason}</p><p>{pay?'Refund goes to the original payment method. The club absorbs DeuceIQ’s retained $1.':action==='card'?`Payment method: ${data.card}`:'No charge occurs until the payer completes the secure payment link.'}</p><button type="button" disabled={busy} onClick={()=>void submit()}>{busy?'Processing…':pay?'Confirm refund':action==='card'?'Confirm charge':'Create payment link'}</button><button type="button" disabled={busy} onClick={()=>setReview(false)}>Edit</button></div>}
 </form>}{!pay&&!data.eligible&&<p>This participant is not eligible for a charge. Confirm the booking, enrollment and USD currency first.</p>}
 </>}{url&&<p><a href={url} target="_blank" rel="noopener noreferrer">Open secure payment link</a><button type="button" onClick={()=>void navigator.clipboard.writeText(url).then(()=>setError('Payment link copied.')).catch(()=>setError('Open the link and copy it from the address bar.'))}>Copy link for payer</button></p>}
 <button type="button" disabled={busy} onClick={()=>{setReview(false);setRevision(x=>x+1);}}>Refresh payment status</button></dialog>}</>;
}

export function MemberPaymentSettings(p:Context){
 const [open,setOpen]=useState(new URLSearchParams(location.search).has('payment_setup')),[card,setCard]=useState<string|null>(null),[mode,setMode]=useState(''),[agree,setAgree]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const pending=useRef(false),query=`?club_id=${encodeURIComponent(p.clubId)}`;
 useEffect(()=>{if(!open)return;const c=new AbortController();setError('');void staffApi<{card:string|null;mode:string}>(p,'/payments/member/card'+query,'GET',undefined,c.signal).then(r=>{if(!c.signal.aborted){setCard(r.card);setMode(r.mode);}}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[open,revision,p.clubId,p.userId,query]);
 async function act(remove=false){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{const r=await staffApi<{url?:string}>(p,'/payments/member/card'+query,remove?'DELETE':'POST',remove?undefined:{accept:agree});if(remove){setCard(null);setAgree(false);setError('Authorization revoked. This does not reverse charges already submitted.');}else if(r.url){const u=new URL(r.url);if(u.protocol!=='https:'||u.hostname!=='checkout.stripe.com')throw new Error('Invalid payment setup link.');location.assign(r.url);}}catch(e){setError(e instanceof Error?e.message:'Unable to update payment method.');}finally{pending.current=false;setBusy(false);}}
 return <details className="member-payment-settings" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>My payment method</summary><p>{mode==='test'?'Test mode. ':''}{card?`Saved card: ${card}`:'No authorized card saved.'}</p><label><input type="checkbox" checked={agree} disabled={busy} onChange={e=>setAgree(e.target.checked)}/>I authorize this club to save my card and charge it for my bookings at the club prices I agree to, including when I am not signed in. I can revoke authorization here. DeuceIQ adds no fee to my price.</label><div><button disabled={busy||!agree} onClick={()=>void act()}>Save / replace card securely</button><button disabled={busy} onClick={()=>{setRevision(v=>v+1);}}>Refresh card</button>{card&&<button disabled={busy} onClick={()=>void act(true)}>Revoke authorization</button>}</div>{error&&<p role="status">{error}</p>}{open&&<MemberPaymentRecovery {...p}/>}</details>;
}
