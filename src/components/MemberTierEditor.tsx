import {useState,useRef} from "react";
import {supabase} from "../lib/supabase";
import {createRequest} from "../lib/createActions";

export function MemberTierEditor(p:{memberId:string;initial:string|null;userId:string;apiBase:string}) {
  const [tier,setTier]=useState(p.initial||""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const pending=useRef(false);
  async function save(){
    if(pending.current||!["member","non_member","junior","senior"].includes(tier))return;
    pending.current=true;setBusy(true);setMessage("");
    try{
      const {data,error}=await supabase.auth.getSession();
      if(error||data.session?.user.id!==p.userId)throw new Error("Sign in again to save.");
      await createRequest(p.apiBase,data.session.access_token,`/members/${p.memberId}`,{method:"PATCH",payload:{membership_type:tier}});
      setMessage("Tier saved for new bookings. Existing agreed rates stay unchanged.");
    }catch(e){setMessage(e instanceof Error?e.message:"Tier could not be saved.");}
    finally{pending.current=false;setBusy(false);}
  }
  return <div><label>Pricing tier<select disabled={busy} value={tier} onChange={e=>setTier(e.target.value)}>
    {!["member","non_member","junior","senior"].includes(tier)&&<option value={tier}>{tier||"Not set"}</option>}
    <option value="member">Member</option><option value="non_member">Non-member</option><option value="junior">Junior</option><option value="senior">Senior</option>
  </select></label><button type="button" disabled={busy||!tier} onClick={()=>void save()}>Save tier</button>{message&&<p role="status">{message}</p>}</div>;
}
