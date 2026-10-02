import "./MemberBookings.css";
import {bookingDateRange} from "../lib/bookingDateRange";
import {MyRequestConversations} from "./RequestConversation";
import { BookingPrice } from "./PricePreview";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { createRequest } from "../lib/createActions";

type Booking = { booking_id: string; starts_at: string; ends_at: string; name: string; status: string | null; location_id: string | null; location_name: string | null; court_name: string | null; pro_name: string | null; registration_status: string | null; waitlist_position: number | null };
export function MemberBookingsPage(props: { apiBase: string; userId: string; clubId: string; locations: { id: string; timezone?: string | null }[] }) {
  const [page,setPage]=useState(0);
  const [history, setHistory] = useState(false), [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<Booking[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const listScope=useRef("");
  useEffect(() => {
    let cancelled = false, running = false;
    const controller = new AbortController();
    const nextScope=JSON.stringify([props.userId,props.clubId,history]);if(listScope.current!==nextScope){setRows([]);setPage(0);setLoading(true);listScope.current=nextScope;}setError(null);
    async function load() {
      if (running || document.hidden) return;
      running = true;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session || data.session.user.id !== props.userId) throw new Error("Your session changed. Sign in again.");
        const query = new URLSearchParams({ club_id: props.clubId, include_history: String(history) });
        const result = await createRequest(props.apiBase, data.session.access_token, `/member/bookings?${query}`, { signal: controller.signal });
        if (Array.isArray(result) || !Array.isArray(result.bookings)) throw new Error("Your bookings could not be loaded.");
        if (!cancelled) { setRows(result.bookings as Booking[]); setError(null); }
      } catch (e) { if (!cancelled) { setRows([]); setError(e instanceof Error ? e.message : "Your bookings could not be loaded."); } }
      finally { running = false; if (!cancelled) setLoading(false); }
    }
    void load();
    const focus = () => void load();
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", focus);
    const timer = setInterval(focus, 30000);
    return () => { cancelled = true; controller.abort(); clearInterval(timer); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [props.apiBase, props.userId, props.clubId, history, refresh]);
  const displayRows=history?rows.slice(0,20):rows;
  const pageCount=Math.max(1,Math.ceil(displayRows.length/5));
  const currentPage=Math.min(page,pageCount-1);
  const visibleRows=displayRows.slice(currentPage*5,currentPage*5+5);
  return <section className="members-card compact-my-bookings">
    <div className="card-heading"><div><p className="card-kicker">MY ACCOUNT</p><h3>My Bookings</h3><p className="card-description">Your rentals, lessons and clinic registrations across this club's locations.</p></div><button className="secondary-button" onClick={() => setRefresh(v => v + 1)} disabled={loading}>Refresh</button></div>
    <MyRequestConversations key={`${props.userId}:${props.clubId}`} context={{...props,role:"member"}}/>
    <div role="group" aria-label="Booking view"><button type="button" aria-pressed={!history} onClick={()=>{setHistory(false);setPage(0);}}>Upcoming bookings</button><button type="button" aria-pressed={history} onClick={()=>{setHistory(true);setPage(0);}}>Previous 20 bookings</button></div>
    {history&&<p>Your latest 20 past bookings, newest first. Up to 5 bookings per page.</p>}
    <p className="card-description">Requests awaiting staff approval and cancelled bookings are not included in this list.</p>
    {loading && <p role="status">Loading your bookings…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !rows.length && <div className="empty-state">{history ? "No bookings found." : "No upcoming bookings."}</div>}
    {visibleRows.map(row => <article key={row.booking_id} className="member-reservation">
      <h4>{row.name}</h4><p>{bookingDateRange(row.starts_at,row.ends_at,props.locations.find(l=>l.id===row.location_id)?.timezone||'UTC')}</p>
      <p>{row.location_name || "Location not specified"} · {row.court_name || "Court not assigned"}</p>
      {row.pro_name && <p>Pro: {row.pro_name}</p>}
      <p>Booking: {row.status?.replaceAll("_", " ") || "Unknown"}{row.registration_status && ` · Registration: ${(row.registration_status === "enrolled" ? "confirmed" : row.registration_status.replaceAll("_", " "))}`}{row.waitlist_position != null && ` · Waitlist position: ${row.waitlist_position}`}</p>
      <BookingPrice bookingId={row.booking_id} userId={props.userId}/>
    </article>)}
    {!loading&&!error&&displayRows.length>0&&<nav aria-label="Booking pages" style={{display:'flex',gap:10,alignItems:'center',marginTop:12}}><button type="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous</button><span role="status">Page {currentPage+1} of {pageCount}</span><button type="button" disabled={currentPage+1>=pageCount} onClick={()=>setPage(currentPage+1)}>Next</button></nav>}
  </section>;
}
