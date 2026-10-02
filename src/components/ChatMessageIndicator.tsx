import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
import "./RequestConversation.css";
export function useChatUnread(clubId:string,userId:string,staff=false){
 const [rooms,setRooms]=useState<string[]>([]);
 useEffect(()=>{let stopped=false,running=false;setRooms([]);async function refresh(){if(running||document.hidden)return;running=true;try{const auth=await supabase.auth.getSession();if(auth.data.session?.user.id!==userId)return;const {data,error}=await supabase.rpc(staff?"staff_summary_unread":"chat_unread",{p_club:clubId});if(!stopped&&!error&&Array.isArray(data))setRooms(data);}finally{running=false;}}void refresh();const timer=setInterval(()=>void refresh(),10000);const update=()=>void refresh();window.addEventListener("chat-read",update);document.addEventListener("visibilitychange",update);return()=>{stopped=true;clearInterval(timer);window.removeEventListener("chat-read",update);document.removeEventListener("visibilitychange",update);};},[clubId,userId,staff]);
 return rooms;
}
export function ChatMessageIndicator({clubId,userId}:{clubId:string;userId:string}){const rooms=useChatUnread(clubId,userId);return rooms.length?<span className="request-unread-dot" role="img" aria-label="Unread chat messages" title="New chat messages"/>:null;}

export function StaffSummaryIndicator({clubId,userId}:{clubId:string;userId:string}){const rows=useChatUnread(clubId,userId,true);return rows.length?<span className="request-unread-dot" role="img" aria-label="Unread conversation summaries" title="New conversation summaries"/>:null;}
