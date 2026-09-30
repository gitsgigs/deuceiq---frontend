import {supabase} from "./supabase";
export type Context={apiBase:string;userId:string;clubId:string;role:string};
export async function staffApi<T>(p:Context,path:string,method="GET",body?:unknown,signal?:AbortSignal):Promise<T>{
 const auth=await supabase.auth.getSession();
 if(auth.error||auth.data.session?.user.id!==p.userId)throw new Error("Your session changed. Sign in again.");
 let response:Response;
 try{response=await fetch(`${p.apiBase.replace(/\/$/,"")}${path}`,{method,signal,headers:{Authorization:`Bearer ${auth.data.session.access_token}`,...(body!==undefined?{"Content-Type":"application/json"}:{})},body:body===undefined?undefined:JSON.stringify(body)});}
 catch(e){if(signal?.aborted)throw e;throw new Error(method==="GET"?"Unable to load records. Refresh to try again.":"The save could not be confirmed. Refresh and check the record before retrying.");}
 const result=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(response.status>=500?"The service could not confirm the result. Refresh and check the record before retrying.":typeof result?.detail==="string"?result.detail:"The request was rejected. Check your permissions and entered values.");
 if(!result||typeof result!=="object")throw new Error("The response could not be confirmed. Refresh before retrying.");
 return result as T;
}
