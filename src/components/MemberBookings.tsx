import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { createRequest } from "../lib/createActions";

type Booking = { booking_id: string; starts_at: string; ends_at: string; name: string; status: string | null; location_id: string | null; location_name: string | null; court_name: string | null; pro_name: string | null; registration_status: string | null; waitlist_position: number | null };
export function MemberBookingsPage(props: { apiBase: string; userId: string; clubId: string; locations: { id: string; timezone?: string | null }[] }) {
  const [history, setHistory] = useState(false), [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<Booking[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false, running = false;
    const controller = new AbortController();
    setRows([]); setError(null); setLoading(true);
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
  function when(row: Booking, value: string) {
    const zone = props.locations.find(l => l.id === row.location_id)?.timezone || "UTC";
    return new Date(value).toLocaleString("en-US", { timeZone: zone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  }
  return <section className="members-card">
    <div className="card-heading"><div><p className="card-kicker">MY ACCOUNT</p><h3>My Bookings</h3><p className="card-description">Your rentals, lessons and clinic registrations across this club's locations.</p></div><button className="secondary-button" onClick={() => setRefresh(v => v + 1)} disabled={loading}>Refresh</button></div>
    <label><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)} /> Include past bookings</label>
    <p className="card-description">Requests awaiting staff approval and cancelled bookings are not included in this list.</p>
    {loading && <p role="status">Loading your bookings…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !rows.length && <div className="empty-state">{history ? "No bookings found." : "No upcoming bookings."}</div>}
    {rows.map(row => <article key={row.booking_id} style={{ padding: "18px 0", borderBottom: "1px solid #446551" }}>
      <h4>{row.name}</h4><p>{when(row, row.starts_at)} – {when(row, row.ends_at)}</p>
      <p>{row.location_name || "Location not specified"} · {row.court_name || "Court not assigned"}</p>
      {row.pro_name && <p>Pro: {row.pro_name}</p>}
      <p>Booking: {row.status?.replaceAll("_", " ") || "Unknown"}{row.registration_status && ` · Registration: ${row.registration_status.replaceAll("_", " ")}`}{row.waitlist_position != null && ` · Waitlist position: ${row.waitlist_position}`}</p>
    </article>)}
  </section>;
}
