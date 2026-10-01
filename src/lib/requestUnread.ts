import {useEffect,useState} from "react";
import {staffApi,type Context} from "./staffApi";
type Store={ids:Set<string>;listeners:Set<()=>void>;timer?:ReturnType<typeof setInterval>;loading:boolean;refresh:()=>void};
const stores=new Map<string,Store>();
const key=(p:Context)=>JSON.stringify([p.apiBase,p.userId,p.clubId]);
function get(p:Context){const k=key(p);let s=stores.get(k);if(!s){const store:Store={ids:new Set(),listeners:new Set(),loading:false,refresh:()=>{}};store.refresh=()=>{if(store.loading||document.hidden)return;store.loading=true;void staffApi<{club_id:string;request_ids:string[]}>(p,`/request-conversations/unread?club_id=${encodeURIComponent(p.clubId)}`).then(d=>{if(d.club_id!==p.clubId||!Array.isArray(d.request_ids))return;store.ids=new Set(d.request_ids);store.listeners.forEach(fn=>fn());}).catch(()=>{}).finally(()=>{store.loading=false;});};stores.set(k,store);s=store;}return s;}
export function refreshRequestUnread(p:Context){get(p).refresh();}
export function useRequestUnread(p:Context,requestId:string){const [,render]=useState(0);const k=key(p);const s=get(p);
 useEffect(()=>{const fn=()=>render(v=>v+1);s.listeners.add(fn);if(s.listeners.size===1){s.refresh();s.timer=setInterval(s.refresh,15000);window.addEventListener("focus",s.refresh);document.addEventListener("visibilitychange",s.refresh);window.addEventListener("deuceiq-notifications-refresh",s.refresh);}return()=>{s.listeners.delete(fn);if(!s.listeners.size){clearInterval(s.timer);window.removeEventListener("focus",s.refresh);document.removeEventListener("visibilitychange",s.refresh);window.removeEventListener("deuceiq-notifications-refresh",s.refresh);stores.delete(k);}};},[k,s]);return s.ids.has(requestId);
}
