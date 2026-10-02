import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import { createRequest, locationTimeToIso } from "../lib/createActions";
import "./CalendarBoard.css";
import { FullRoster, PlayerDetails, PlayerInfoButton, rosterCard, displayPlayerName } from "./RosterTools";
import type { PlayerCard, PlayerProfile, RosterPlayer } from "./RosterTools";

type Court = { id: string; name: string; location_id: string; court_number?: number | null };
type Pro = { id: string; first_name?: string; last_name?: string };
type Lesson = { id: string; name?: string; category?: string; active?: boolean };
type Booking = {
  id: string; club_id: string; starts_at: string; ends_at: string;
  status?: string; notes?: string | null; clinic_registration_capacity?: number | null;
  court?: Court | { id: string; name: string } | null; pro?: Pro | null;
  lesson_type?: Lesson | null; booking_series_id?: string | null;
  primary_participant?: PlayerProfile & { member_id?: string | null; participant_role?: string | null } | null;
  booking_participants?: { id?: string; member_id?: string | null; participant_role?: string | null; member?: PlayerProfile | null }[];
};
type Roster = {
  participants?: RosterPlayer[];
  assigned_court_ids?: string[]; capacity?: number; enrolled_count?: number; waitlist_count?: number;
};
type Assignment = { id: string; pro_id: string; court_id: string; starts_at: string; ends_at: string };
type Detail = { roster?: Roster; assignments?: Assignment[]; pros?: Pro[]; error?: string };
type Props = {
  bookings: Booking[]; courts: Court[]; loading: boolean; error: string | null;
  calendarDate: string; setCalendarDate: (date: string) => void; timeZone: string;
  apiBase: string; userId: string; canEdit: boolean; onUpdated: () => void;
  onCreateRange: (courtId: string, start: string, end: string) => void;
};

export function localDateTime(iso: string, timeZone: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).map(v => [v.type, v.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function movedTimes(booking: Pick<Booking, "starts_at" | "ends_at">, date: string, minutes: number, zone: string) {
  const start = locationTimeToIso(`${date}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`, zone);
  return { starts_at: start, ends_at: new Date(Date.parse(start) + Date.parse(booking.ends_at) - Date.parse(booking.starts_at)).toISOString() };
}
const person = (p?: Pro | null) => p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.id : "Unassigned";
const mutable = (b: Booking) => !["cancelled", "canceled", "completed"].includes((b.status ?? "").toLowerCase());

export default function CalendarBoard(props: Props) {
  const selection = useRef<{court:string;anchor:number;end:number}|null>(null);
  const [range,setRange] = useState<{court:string;anchor:number;end:number}|null>(null);
  const [rosterBooking, setRosterBooking] = useState<Booking | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerCard | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const [uncertain, setUncertain] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; top: number; left: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [editing, setEditing] = useState<Booking | null>(null);
  const [choices, setChoices] = useState<{ types: Lesson[]; pros: Pro[] } | null>(null);
  const [form, setForm] = useState({ start: "", end: "", court: "", pro: "", type: "", capacity: "", notes: "" });
  const modal = useRef<HTMLDialogElement>(null);
  const detailsPending = useRef(new Set<string>());
  const editorGeneration = useRef(0);
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: props.timeZone, hour: "numeric", minute: "2-digit" });
  const cancelHoverTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const keepHover = () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  const leaveHover = () => { cancelHoverTimer(); keepHover(); hideTimer.current = setTimeout(() => setHover(null), 200); };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancelHoverTimer(); keepHover(); };
  }, []);
  useEffect(() => { setHover(null); setDetails({}); cancelHoverTimer(); }, [props.bookings]);
  useEffect(() => { if (editing && modal.current && !modal.current.open) modal.current.showModal(); }, [editing]);
  useEffect(() => {
    const close = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(".clinic-hover-pair")) return;
      cancelHoverTimer(); setHover(null);
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); };
  }, []);
  async function token() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session || data.session.user.id !== props.userId) throw new Error("Your session changed. Sign in again.");
    return data.session.access_token;
  }
  async function loadDetails(b: Booking) {
    if (details[b.id] || detailsPending.current.has(b.id)) return;
    detailsPending.current.add(b.id);
    try {
      const auth = await token();
      const results = await Promise.allSettled([
        createRequest(props.apiBase, auth, `/bookings/${b.id}/clinic-roster`),
        createRequest(props.apiBase, auth, `/bookings/${b.id}/clinic-pro-assignments`),
        createRequest(props.apiBase, auth, `/pros?club_id=${encodeURIComponent(b.club_id)}`),
      ]);
      const value = (index: number) => results[index].status === "fulfilled" ? results[index].value as Record<string, unknown> : null;
      const roster = value(0), staffing = value(1), pros = value(2);
      if (mounted.current) setDetails(v => ({ ...v, [b.id]: {
        roster: roster as Roster | undefined,
        assignments: staffing?.assignments as Assignment[] | undefined,
        pros: pros?.pros as Pro[] | undefined,
        error: results.some(r => r.status === "rejected") ? "Some details could not be loaded or are not available to your role." : undefined,
      } }));
    } catch { if (mounted.current) setDetails(v => ({ ...v, [b.id]: { error: "Unable to load clinic details." } })); }
    finally { detailsPending.current.delete(b.id); }
  }
  function startHover(b: Booking, element: HTMLElement) {
    keepHover(); cancelHoverTimer();
    if (b.lesson_type?.category !== "clinic" || dragId || editing || rosterBooking || selectedPlayer) return;
    const rect = element.getBoundingClientRect();
    timer.current = setTimeout(() => {
      setHover({ id: b.id, left: Math.max(12, Math.min(rect.left, window.innerWidth - 652)), top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 330)) });
      void loadDetails(b);
    }, 1500);
  }
  async function save(b: Booking, patch: Record<string, unknown>) {
    if (pending.current || !props.canEdit || uncertain) return;
    pending.current = true; setBusy(true); setMessage(null); setHover(null);
    let sent = false;
    try {
      const auth = await token();
      sent = true;
      const response = await fetch(`${props.apiBase.replace(/\/$/, "")}/bookings/${b.id}`, {
        method: "PATCH", headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => null);
      if (!mounted.current) return;
      if (!response.ok) {
        if (response.status >= 500) throw new Error("The update could not be confirmed. Refresh the calendar before trying again.");
        sent = false;
        throw new Error(typeof data?.detail === "string" ? data.detail : response.status === 401 ? "Your session expired. Sign in again." : "The booking could not be updated. Check the selected values.");
      }
      if (data?.booking?.id !== b.id) throw new Error("The update could not be confirmed. Refresh the calendar before trying again.");
      sent = false;
      setEditing(null);
      setMessage(["Booking updated.", data.schedule_warning, data.operating_hours_warning].filter(Boolean).join(" "));
      props.onUpdated();
    } catch (e) {
      if (mounted.current) { setMessage(sent ? "The update could not be confirmed. Refresh the calendar before trying again." : e instanceof Error ? e.message : "Unable to update booking."); if (sent) setUncertain(true); }
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  function openRoster(b: Booking) {
    if (busy) return;
    cancelHoverTimer(); keepHover(); setHover(null); setRosterBooking(b);
  }
  function showPlayer(p: PlayerCard) {
    cancelHoverTimer(); keepHover(); setHover(null); setSelectedPlayer(p);
  }
  function bookingPlayers(b: Booking): PlayerCard[] {
    if (b.lesson_type?.category === "clinic") return (details[b.id]?.roster?.participants ?? []).filter(p => p.status === "enrolled" || p.status === "attended").map(p => rosterCard(p, b.club_id));
    const players = (b.booking_participants ?? []).filter(p => p.member).map(p => ({
      name: displayPlayerName(p.member!), profile: p.member, kind: "member", status: b.status, role: p.participant_role, clubId: b.club_id,
    }));
    if (!players.length && b.primary_participant) return [{ name: displayPlayerName(b.primary_participant), profile: { ...b.primary_participant, id: b.primary_participant.member_id ?? undefined }, kind: "member", status: b.status, role: b.primary_participant.participant_role, clubId: b.club_id }];
    return players;
  }
  function drop(court: Court, minute: number) {
    const b = props.bookings.find(v => v.id === dragId);
    setDragId(null);
    if (!b || busy || props.loading || uncertain || !props.canEdit) return;
    if (court.id !== b.court?.id && b.lesson_type?.category === "clinic") {
      setMessage("Move clinics within their current court column to preserve all assigned courts. Court assignments need a separate edit."); return;
    }
    try {
      const times = movedTimes(b, props.calendarDate, minute, props.timeZone);
      if (Date.parse(times.starts_at) === Date.parse(b.starts_at) && court.id === b.court?.id) return;
      void save(b, { ...times, ...(court.id !== b.court?.id ? { court_id: court.id } : {}) });
    } catch (e) { setMessage(e instanceof Error ? e.message : "Invalid time slot."); }
  }
  async function openEditor(b: Booking) {
    if (!props.canEdit || !mutable(b) || busy || props.loading || uncertain) return;
    const generation = ++editorGeneration.current;
    cancelHoverTimer(); setHover(null); setMessage(null); setChoices(null); setEditing(b);
    setForm({ start: localDateTime(b.starts_at, props.timeZone), end: localDateTime(b.ends_at, props.timeZone), court: b.court?.id ?? "", pro: b.pro?.id ?? "", type: b.lesson_type?.id ?? "", capacity: String(b.clinic_registration_capacity ?? ""), notes: b.notes ?? "" });
    try {
      const auth = await token();
      const [types, pros] = await Promise.all([
        createRequest(props.apiBase, auth, `/lesson-types?club_id=${b.club_id}`),
        createRequest(props.apiBase, auth, `/pros?club_id=${b.club_id}`),
      ]);
      if (!Array.isArray(types) || Array.isArray(pros) || !Array.isArray(pros.pros)) throw new Error("Unable to load edit choices.");
      if (mounted.current && editorGeneration.current === generation) setChoices({ types: (types as Lesson[]).filter(t => t.active !== false && t.category === b.lesson_type?.category), pros: pros.pros as Pro[] });
    } catch (e) { if (mounted.current && editorGeneration.current === generation) setMessage(e instanceof Error ? e.message : "Unable to load edit choices."); }
  }
  function submitEdit(event: React.FormEvent) {
    event.preventDefault(); if (!editing || !choices) return;
    try {
      const starts_at = form.start === localDateTime(editing.starts_at, props.timeZone) ? editing.starts_at : locationTimeToIso(form.start, props.timeZone);
      const ends_at = form.end === localDateTime(editing.ends_at, props.timeZone) ? editing.ends_at : locationTimeToIso(form.end, props.timeZone);
      if (Date.parse(ends_at) <= Date.parse(starts_at)) throw new Error("End time must be after start time.");
      const patch: Record<string, unknown> = {};
      if (starts_at !== editing.starts_at) patch.starts_at = starts_at;
      if (ends_at !== editing.ends_at) patch.ends_at = ends_at;
      if ((form.notes.trim() || null) !== (editing.notes ?? null)) patch.notes = form.notes.trim() || null;
      if (form.court !== (editing.court?.id ?? "")) patch.court_id = form.court || null;
      if (form.pro !== (editing.pro?.id ?? "")) patch.pro_id = form.pro || null;
      if (form.type !== (editing.lesson_type?.id ?? "")) patch.lesson_type_id = form.type || null;
      if (editing.lesson_type?.category === "clinic" && form.capacity !== String(editing.clinic_registration_capacity ?? "")) {
        if (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1) throw new Error("Capacity must be a positive whole number.");
        patch.clinic_registration_capacity = Number(form.capacity);
      }
      if (!Object.keys(patch).length) { setEditing(null); return; }
      void save(editing, patch);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Invalid booking values."); }
  }
  function changeDate(days: number) {
    const date = new Date(`${props.calendarDate}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); props.setCalendarDate(date.toISOString().slice(0, 10));
  }
  const visible = props.bookings.filter(b => !["cancelled", "canceled"].includes((b.status ?? "").toLowerCase()));
  const minutesAt = (iso: string) => { const local = localDateTime(iso, props.timeZone); const dayDelta = (Date.parse(local.slice(0, 10) + "T00:00:00Z") - Date.parse(props.calendarDate + "T00:00:00Z")) / 86400000; return dayDelta * 1440 + Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16)); };
  const min = Math.max(0, Math.min(360, ...visible.map(b => Math.floor(minutesAt(b.starts_at) / 30) * 30)));
  const max = Math.min(1440, Math.max(1140, ...visible.map(b => Math.ceil(minutesAt(b.ends_at) / 30) * 30)));
  const slots = Array.from({ length: (max - min) / 30 }, (_, i) => min + i * 30);
  const rangeLocal = (minutes:number) => { const d=new Date(`${props.calendarDate}T00:00:00Z`);d.setUTCMinutes(minutes);return d.toISOString().slice(0,16); };
  function finishSelection() {
    const value=selection.current;selection.current=null;setRange(null);if(!value||!props.canEdit||props.loading||props.error||busy||uncertain)return;
    const from=Math.min(value.anchor,value.end),to=Math.max(value.anchor,value.end)+30;
    if(visible.some(b=>b.court?.id===value.court&&minutesAt(b.starts_at)<to&&minutesAt(b.ends_at)>from)){setMessage("That selection crosses an existing booking. Choose an empty range.");return;}
    props.onCreateRange(value.court,rangeLocal(from),rangeLocal(to));
  }
  const hoverBooking = props.bookings.find(b => b.id === hover?.id);
  const info = hoverBooking ? details[hoverBooking.id] : undefined;
  return <section className="calendar-board">
    <header className="calendar-toolbar"><h3>Daily Calendar</h3><button disabled={busy} onClick={() => changeDate(-1)} aria-label="Previous day">←</button>
      <input aria-label="Calendar date" type="date" value={props.calendarDate} disabled={busy} onChange={e => { if (e.target.value) props.setCalendarDate(e.target.value); }} />
      <button disabled={busy} onClick={() => changeDate(1)} aria-label="Next day">→</button><button disabled={busy} onClick={() => { setEditing(null); setUncertain(false); setMessage(null); props.onUpdated(); }}>Refresh</button>
      <span>{props.timeZone}</span></header>
    {props.canEdit && <p>Drag over empty time slots to create a booking. Drag an existing block to move it, or select it to edit. The backend checks availability before saving.</p>}
    {message && <p role="status" className="calendar-message">{message}</p>}
    {busy && <p role="status">Checking availability and saving…</p>}
    {props.error && <p role="alert">{props.error}</p>}
    <p>On a phone, swipe across the grid to see every court and tap a booking to open it. Use Create to add a booking.</p>{!props.loading&&!props.courts.length&&<p>No courts are available for this location.</p>}{props.loading ? <p>Loading calendar…</p> : <div className="calendar-board-scroll"><div className="calendar-board-columns" style={{ width: `${76 + props.courts.length * 170}px`, gridTemplateColumns: `76px repeat(${props.courts.length}, 170px)` }}>
      <div><div className="calendar-column-heading">Time</div>{slots.map(m => <div className="calendar-time-label" key={m}>{String(Math.floor(m / 60)).padStart(2, "0")}:{String(m % 60).padStart(2, "0")}</div>)}</div>
      {props.courts.map(c => <div key={c.id}><div className="calendar-column-heading">{c.court_number != null ? `Court ${c.court_number}` : c.name}{c.court_number != null && c.name && <><br/><small>{c.name}</small></>}</div><div className="calendar-lane" style={{ height: slots.length * 48 }}
        onPointerDown={e=>{if(e.pointerType==="touch")return;if(e.button!==0||!props.canEdit||busy||uncertain||props.loading||props.error||!(e.target as HTMLElement).classList.contains("calendar-drop-slot"))return;const m=min+Math.max(0,Math.min(slots.length-1,Math.floor((e.clientY-e.currentTarget.getBoundingClientRect().top)/48)))*30;selection.current={court:c.id,anchor:m,end:m};setRange(selection.current);e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();setHover(null);}}
        onPointerMove={e=>{if(!selection.current||selection.current.court!==c.id)return;const m=min+Math.max(0,Math.min(slots.length-1,Math.floor((e.clientY-e.currentTarget.getBoundingClientRect().top)/48)))*30;selection.current={...selection.current,end:m};setRange(selection.current);}}
        onPointerUp={e=>{if(selection.current){finishSelection();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}}
        onPointerCancel={()=>{selection.current=null;setRange(null);}} onLostPointerCapture={()=>{selection.current=null;setRange(null);}}>
        {slots.map(m => <div className="calendar-drop-slot" key={m} onDragOver={e => { if (dragId && props.canEdit && !busy && !uncertain) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }} onDrop={e => { e.preventDefault(); drop(c, m); }} />)}
        {range?.court===c.id && <div className="calendar-selection" style={{top:(Math.min(range.anchor,range.end)-min)*1.6,height:(Math.abs(range.end-range.anchor)+30)*1.6}}>New booking</div>}
        {visible.filter(b => b.court?.id === c.id && minutesAt(b.ends_at) > min && minutesAt(b.starts_at) < max).map(b => <div key={b.id}
          role="button" tabIndex={0} aria-label={`${b.lesson_type?.name ?? "Booking"}, ${fmt(b.starts_at)} to ${fmt(b.ends_at)}${props.canEdit ? ", select to edit" : ""}`}
          className={`calendar-event ${b.lesson_type?.category === "clinic" ? "is-clinic" : ""}`}
          style={{ top: (Math.max(min, minutesAt(b.starts_at)) - min) * 1.6 + 2, height: Math.max(24, (Math.min(max, minutesAt(b.ends_at)) - Math.max(min, minutesAt(b.starts_at))) * 1.6 - 4) }}
          draggable={props.canEdit && mutable(b) && !busy && !props.loading && !uncertain}
          onDragStart={e => { setDragId(b.id); setHover(null); cancelHoverTimer(); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", b.id); }} onDragEnd={() => setDragId(null)}
          onDragOver={e => { if (dragId && props.canEdit) e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); const lane = e.currentTarget.parentElement!.getBoundingClientRect(); drop(c, min + Math.floor((e.clientY - lane.top) / 48) * 30); }}
          onMouseEnter={e => startHover(b, e.currentTarget)} onMouseLeave={leaveHover} onFocus={e => startHover(b, e.currentTarget)} onBlur={leaveHover}
          onClick={() => { if (props.canEdit) void openEditor(b); else if (b.lesson_type?.category === "clinic") { setHover({ id: b.id, left: 12, top: 100 }); void loadDetails(b); } }}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }}>
          <strong>{b.lesson_type?.name ?? "Booking"}</strong><span>{person(b.pro)}</span>
          <div className="booking-player-list">{bookingPlayers(b).map((p, i) => <div className="booking-player-line" key={p.profile?.id ?? `${p.name}:${i}`}><span>{p.name}</span><PlayerInfoButton name={p.name} onClick={() => showPlayer(p)} /></div>)}</div>
          {b.lesson_type?.category === "clinic" && <button type="button" className="calendar-roster-button" draggable={false} onKeyDown={e => e.stopPropagation()} onDragStart={e => { e.preventDefault(); e.stopPropagation(); }} onClick={e => { e.stopPropagation(); openRoster(b); }}>Roster</button>}
          <small>{fmt(b.starts_at)} – {fmt(b.ends_at)}</small>{b.booking_series_id && <small>Recurring</small>}
        </div>)}
      </div></div>)}
    </div></div>}
    {hover && hoverBooking && createPortal(<div className="clinic-hover-pair" style={{ top: hover.top, left: hover.left }} onMouseEnter={keepHover} onMouseLeave={leaveHover} onFocus={keepHover} onBlur={leaveHover} onKeyDown={e => { if (e.key === "Escape") setHover(null); }}>
      <section aria-label="Clinic roster"><h4>Roster</h4>{!info && <p>Loading…</p>}{info?.roster?.participants?.length === 0 && <p>No registrations yet.</p>}
        {info?.roster?.participants?.slice(0, 4).map(p => <div className="roster-preview-row" key={p.enrollment_id}><div><strong>{p.display_name}</strong><br /><small>{p.status.replaceAll("_", " ")}{p.participant_type === "guest" ? " · Guest" : ""}</small></div><PlayerInfoButton name={p.display_name} onClick={() => showPlayer(rosterCard(p, hoverBooking.club_id))} /></div>)}
        {(info?.roster?.participants?.length ?? 0) > 4 && <p>{info!.roster!.participants!.length - 4} more players</p>}
        {info?.error && <p>{info.error}</p>}
        <div className="roster-preview-actions"><button onClick={() => openRoster(hoverBooking)}>View entire roster</button>{props.canEdit && mutable(hoverBooking) && <button onClick={() => openRoster(hoverBooking)}>Edit roster</button>}</div>
      </section>
      <section aria-label="Clinic details"><button className="hover-close" onClick={() => setHover(null)} aria-label="Close clinic panels">×</button><h4>{hoverBooking.lesson_type?.name ?? "Clinic"}</h4>
        <p>{fmt(hoverBooking.starts_at)} – {fmt(hoverBooking.ends_at)} · {props.timeZone}</p><p>Status: {hoverBooking.status ?? "—"}</p>
        <p>Capacity: {info?.roster?.capacity ?? hoverBooking.clinic_registration_capacity ?? "—"} · Enrolled: {info?.roster?.enrolled_count ?? "—"} · Waitlisted: {info?.roster?.waitlist_count ?? "—"}</p>
        <p>Courts: {(info?.roster?.assigned_court_ids ?? (hoverBooking.court ? [hoverBooking.court.id] : [])).map(id => props.courts.find(c => c.id === id)?.name ?? id).join(", ") || "—"}</p>
        {hoverBooking.pro && <p>Full clinic pro: {person(hoverBooking.pro)}</p>}
        {info?.assignments?.map(a => <p key={a.id}>{person(info.pros?.find(p => p.id === a.pro_id) ?? { id: a.pro_id })} · {props.courts.find(c => c.id === a.court_id)?.name ?? a.court_id}<br />{fmt(a.starts_at)} – {fmt(a.ends_at)}</p>)}
        {info?.assignments?.length === 0 && !hoverBooking.pro && <p>No pro assigned.</p>}
        {hoverBooking.notes && <p>{hoverBooking.notes}</p>}
        {props.canEdit && <button onClick={() => void openEditor(hoverBooking)}>Edit booking</button>}
      </section>
    </div>, document.body)}
    {rosterBooking && <FullRoster key={rosterBooking.id} bookingId={rosterBooking.id} clubId={rosterBooking.club_id} title={rosterBooking.lesson_type?.name ?? "Clinic"}
      apiBase={props.apiBase} userId={props.userId} canEdit={props.canEdit && mutable(rosterBooking)} onClose={() => setRosterBooking(null)}
      onChanged={() => { setDetails({}); props.onUpdated(); }} />}
    {selectedPlayer && <PlayerDetails player={selectedPlayer} apiBase={props.apiBase} userId={props.userId} canReadMembers={props.canEdit} onClose={() => setSelectedPlayer(null)} />}
    {editing && <dialog ref={modal} className="calendar-edit" onCancel={e => { e.preventDefault(); if (!busy) setEditing(null); }}>
      <form onSubmit={submitEdit}><h3>Edit {editing.lesson_type?.name ?? "booking"}</h3><p>Times in {props.timeZone}. {editing.booking_series_id ? "Changes apply only to this occurrence." : ""}</p>
        {message && <p role="alert">{message}</p>}
        {!choices && <p>Loading edit choices…</p>}
        <fieldset disabled={busy || !choices || uncertain}>
          <label>Starts<input type="datetime-local" required value={form.start} onChange={e => setForm(v => ({ ...v, start: e.target.value }))} /></label>
          <label>Ends<input type="datetime-local" required value={form.end} onChange={e => setForm(v => ({ ...v, end: e.target.value }))} /></label>
          <label>Court<select disabled={editing.lesson_type?.category === "clinic"} value={form.court} onChange={e => setForm(v => ({ ...v, court: e.target.value }))}><option value="">Unassigned</option>{props.courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          {editing.lesson_type?.category === "clinic" && <p>Existing clinic court assignments are preserved.</p>}
          <label>Full-booking pro<select value={form.pro} onChange={e => setForm(v => ({ ...v, pro: e.target.value }))}><option value="">Unassigned</option>{editing.pro && !choices?.pros.some(p => p.id === editing.pro?.id) && <option value={editing.pro.id}>{person(editing.pro)} (current)</option>}{choices?.pros.map(p => <option key={p.id} value={p.id}>{person(p)}</option>)}</select></label>
          <label>Lesson type<select value={form.type} onChange={e => setForm(v => ({ ...v, type: e.target.value }))}>{!editing.lesson_type && <option value="">Unassigned</option>}{editing.lesson_type && !choices?.types.some(t => t.id === editing.lesson_type?.id) && <option value={editing.lesson_type.id}>{editing.lesson_type.name} (current)</option>}{choices?.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          {editing.lesson_type?.category === "clinic" && <label>Registration capacity<input type="number" min="1" step="1" value={form.capacity} onChange={e => setForm(v => ({ ...v, capacity: e.target.value }))} placeholder="Default capacity" /></label>}
          <label>Notes<textarea value={form.notes} onChange={e => setForm(v => ({ ...v, notes: e.target.value }))} /></label>
        </fieldset><footer><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button disabled={busy || !choices || uncertain}>Save changes</button></footer>
      </form>
    </dialog>}
  </section>;
}
