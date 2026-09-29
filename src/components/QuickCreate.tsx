import { PlayerPicker } from "./PlayerPicker";
import type { PickedPlayer } from "./PlayerPicker";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { canCreate, createRequest, CreateApiError, locationTimeToIso } from "../lib/createActions";
import type { CreateKind } from "../lib/createActions";
import "./QuickCreate.css";

type Choice = { id: string; name?: string; first_name?: string; last_name?: string; category?: string; active?: boolean };
type Props = {
  initialRange?: {courtId:string;start:string;end:string}|null;
  kind: CreateKind; apiBase: string; clubId: string; role: string | null;
  userId: string; locationId: string | null; locationName: string; timeZone: string;
  date: string; courts: { id: string; name: string; location_id: string; active?: boolean }[];
  onClose: () => void; onCreated: (kind: CreateKind, date: string, message: string) => void;
};

export default function QuickCreate(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const alive = useRef(false);
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(props.kind !== "member");
  const [ready, setReady] = useState(props.kind === "member");
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [types, setTypes] = useState<Choice[]>([]);
  const [pros, setPros] = useState<Choice[]>([]);
  const [typeId, setTypeId] = useState("");
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDuration, setNewTypeDuration] = useState("60");
  const [typeMessage, setTypeMessage] = useState<string | null>(null);
  const isClinic = types.find(t => t.id === typeId)?.category === "clinic";
  const canManageTypes = ["owner", "director", "manager"].includes(props.role ?? "");
  const [courtId, setCourtId] = useState(props.initialRange?.courtId || "");
  const [proId, setProId] = useState("");
  const [start, setStart] = useState(props.initialRange?.start || `${props.date}T09:00`);
  const [end, setEnd] = useState(props.initialRange?.end || `${props.date}T10:00`);
  const [recurring, setRecurring] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState("");
  const [savedSeries, setSavedSeries] = useState<string | null>(null);
  const anniversary = (day: string) => { const [y,m,d] = day.split("-").map(Number); return `${y+1}-${String(m).padStart(2,"0")}-${String(Math.min(d,new Date(Date.UTC(y+1,m,0)).getUTCDate())).padStart(2,"0")}`; };
  const [pickedPlayers,setPickedPlayers] = useState<PickedPlayer[]>([]);
  const [extraPros,setExtraPros] = useState<{id:string;start:string;end:string}[]>([]);
  const category = types.find(t=>t.id===typeId)?.category;
  const [players, setPlayers] = useState("1");
  const [capacity, setCapacity] = useState("6");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const title = props.kind === "member" ? "Add Member" : props.kind === "clinic" ? "Create Clinic" : "Create Booking";

  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (props.kind === "member") return;
    const controller = new AbortController();
    let cancelled = false;
    async function load() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session || data.session.user.id !== props.userId) throw new Error("Sign in again to continue.");
        const token = data.session.access_token;
        const query = `?${new URLSearchParams({ club_id: props.clubId })}`;
        const [lessons, professionals] = await Promise.all([
          createRequest(props.apiBase, token, `/lesson-types${query}`, { signal: controller.signal }),
          createRequest(props.apiBase, token, `/pros${query}`, { signal: controller.signal }),
        ]);
        if (cancelled) return;
        if (!Array.isArray(lessons) || Array.isArray(professionals) || !Array.isArray(professionals.pros)) throw new Error("Unable to load booking choices.");
        const available = (lessons as Choice[]).filter(t => t.active !== false && (props.kind !== "clinic" || t.category === "clinic"));
        setTypes(available); setTypeId(available[0]?.id ?? "");
        setPros(professionals.pros as Choice[]);
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load choices.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [props.apiBase, props.clubId, props.kind, props.userId]);

  async function saveClinicType() {
    if (pending.current || uncertain || !canManageTypes) return;
    const name = newTypeName.trim();
    const duration = Number(newTypeDuration);
    if (!name || !Number.isInteger(duration) || duration <= 0) {
      setError("Enter a clinic type name and a positive whole-number duration."); return;
    }
    if (types.some(t => t.name?.trim().toLowerCase() === name.toLowerCase())) {
      setError("That lesson type name is already available. Select it from the list."); return;
    }
    pending.current = true; setSaving(true); setError(null); setTypeMessage(null);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session || data.session.user.id !== props.userId) throw new Error("Your session changed. Sign in again.");
      const result = await createRequest(props.apiBase, data.session.access_token, "/lesson-types", {
        payload: { club_id: props.clubId, name, category: "clinic", default_duration_minutes: duration,
          pricing_method: "per_player", member_price: null, non_member_price: null,
          minimum_players: 1, maximum_players: null, active: true },
      });
      const saved = !Array.isArray(result) ? result.lesson_type as Choice & { club_id?: string } | undefined : undefined;
      if (!saved || typeof saved.id !== "string" || saved.category !== "clinic" || saved.club_id !== props.clubId) {
        throw new CreateApiError("The clinic type save could not be confirmed. Close and reopen this form to check the list before retrying.", true);
      }
      if (alive.current) {
        setTypes(previous => [...previous, saved]); setTypeId(saved.id);
        setNewTypeOpen(false); setNewTypeName("");
        setTypeMessage(`Clinic type “${name}” saved and selected. It will remain available for future bookings.`);
      }
    } catch (e) {
      if (alive.current) {
        setError(e instanceof Error ? e.message : "Unable to save clinic type.");
        if (e instanceof CreateApiError && e.uncertain) setUncertain(true);
      }
    } finally { pending.current = false; if (alive.current) setSaving(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || uncertain || newTypeOpen || !ready || !canCreate(props.role)) return;
    pending.current = true; setSaving(true); setError(null);
    try {
      let payload: Record<string, unknown>;
      if (props.kind === "member") {
        if (!first.trim() || !last.trim()) throw new Error("First and last name are required.");
        payload = { club_id: props.clubId, first_name: first.trim(), last_name: last.trim(),
          email: email.trim() || null, phone: phone.trim() || null, notes: notes.trim() || null, active: true };
      } else {
        if (!props.locationId || !courtId || !typeId) throw new Error("Select a location, court and lesson type.");
        if (!props.courts.some(c => c.id === courtId && c.location_id === props.locationId && c.active !== false)) throw new Error("Select a court at this location.");
        const startsAt = locationTimeToIso(start, props.timeZone);
        const endsAt = locationTimeToIso(end, props.timeZone);
        if (endsAt <= startsAt) throw new Error("End time must be after start time.");
        const count = isClinic ? 0 : pickedPlayers.length || Number(players);
        const max = isClinic ? Number(capacity) : null;
        if (!Number.isInteger(count) || count < (isClinic ? 0 : 1)) throw new Error("Enter a valid player count.");
        if (max !== null && (!Number.isInteger(max) || max < 1 || max > 6)) throw new Error("A single-court clinic can have 1–6 registration spots.");
        payload = { club_id: props.clubId, location_id: props.locationId, court_id: courtId,
          lesson_type_id: typeId, pro_id: proId || null, starts_at: startsAt, ends_at: endsAt,
          player_count: count, clinic_registration_capacity: max, status: "confirmed", source: "staff", notes: notes.trim() || null };
      }
      if (isClinic && recurring && (pickedPlayers.length || extraPros.length)) throw new Error("Create the recurring clinics first, then assign players and additional pros to each dated session.");
      if (isClinic && pickedPlayers.length > Number(capacity)) throw new Error("Selected players exceed the clinic capacity.");
      for (const pro of extraPros) {
        const a=locationTimeToIso(pro.start,props.timeZone), b=locationTimeToIso(pro.end,props.timeZone);
        if(!pro.id||pro.id===proId||a<String(payload.starts_at)||b>String(payload.ends_at)||b<=a)throw new Error("Additional pro times must be within the clinic, and pros must be distinct.");
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session || data.session.user.id !== props.userId) throw new Error("Your session changed. Sign in again.");
      if (isClinic && recurring && props.kind !== "member") {
        const firstDate = start.slice(0,10);
        if (!repeatUntil || repeatUntil < firstDate || repeatUntil > anniversary(firstDate)) throw new Error("Choose an end date within one year of the first clinic.");
        if (start.slice(0,10) !== end.slice(0,10)) throw new Error("Recurring clinics must start and end on the same local day.");
        if (Date.parse(String(payload.starts_at)) <= Date.now()) throw new Error("Choose a future first clinic.");
        const minutes = (Date.parse(String(payload.ends_at)) - Date.parse(String(payload.starts_at))) / 60000;
        if (!Number.isInteger(minutes) || minutes <= 0) throw new Error("Choose a valid whole-minute duration.");
        const weekday = ["SU","MO","TU","WE","TH","FR","SA"][new Date(`${firstDate}T12:00:00Z`).getUTCDay()];
        const result = await createRequest(props.apiBase, data.session.access_token, "/booking-series", { payload: {
          club_id: props.clubId, name: types.find(t => t.id === typeId)?.name || "Recurring clinic", lesson_type_id: typeId,
          pro_id: proId || null, default_location_id: props.locationId, default_court_id: courtId,
          recurrence_rule: `FREQ=WEEKLY;BYDAY=${weekday}`, timezone: props.timeZone,
          starts_on: firstDate, ends_on: repeatUntil, start_time: start.slice(11), duration_minutes: minutes,
          clinic_registration_capacity: Number(capacity), notes: notes.trim() || null, active: true
        }});
        const series = !Array.isArray(result) ? result.booking_series as {id?: string} : null;
        if (!series?.id) throw new CreateApiError("Series creation could not be confirmed. Check with staff before retrying.", true);
        if (alive.current) setSavedSeries(series.id);
        try {
          const generated = await createRequest(props.apiBase, data.session.access_token, `/booking-series/${series.id}/generate`, {payload: {}});
          if (Array.isArray(generated) || typeof generated.created_count !== "number" || !Array.isArray(generated.conflicts) || !Array.isArray(generated.skipped)) throw new Error("Incomplete generation response.");
          const conflicts = (generated.conflicts as {date:string;reason:string}[]).map(c => `${c.date}: ${c.reason.replaceAll("_"," ")}`).join("; ");
          if (alive.current) props.onCreated(props.kind, firstDate, `Recurring clinic: ${generated.created_count} created, ${generated.skipped.length} already generated, ${generated.conflicts.length} not created.${conflicts ? " Unavailable dates: " + conflicts : ""}`);
        } catch { throw new CreateApiError(`Series ${series.id} was saved, but occurrence generation could not be confirmed. Some dates may have been created. Check saved clinics before attempting another series.`, true); }
        return;
      }
      const result = await createRequest(props.apiBase, data.session.access_token,
        props.kind === "member" ? "/members" : "/bookings", { payload });
      const record = props.kind === "member" ? result : (result as Record<string, unknown>).booking;
      if (!record || typeof record !== "object" || !("id" in record) || typeof record.id !== "string") throw new CreateApiError("The save response was incomplete. Check the list before trying again.", true);
      let assigned=0;
      try {
        if (isClinic && extraPros.length && proId) {
          await createRequest(props.apiBase,data.session.access_token,`/bookings/${record.id}/clinic-pro-assignments`,{payload:{pro_id:proId,court_id:courtId,starts_at:payload.starts_at,ends_at:payload.ends_at}});
        }
        for (const pro of extraPros) {
          await createRequest(props.apiBase,data.session.access_token,`/bookings/${record.id}/clinic-pro-assignments`,{payload:{pro_id:pro.id,court_id:courtId,starts_at:locationTimeToIso(pro.start,props.timeZone),ends_at:locationTimeToIso(pro.end,props.timeZone)}});
        }
        for (const member of pickedPlayers) {
          await createRequest(props.apiBase,data.session.access_token,isClinic?`/bookings/${record.id}/clinic-enrollments`:`/bookings/${record.id}/participants`,{payload:isClinic?{member_id:member.id}:{member_id:member.id,participant_role:assigned===0?"organizer":"player"}});assigned++;
        }
      } catch(e) {
        throw new CreateApiError(`Booking ${record.id} was created; ${assigned} player assignments confirmed. Some assignments were not completed or could not be confirmed. Close this form and check the booking/roster before adding the remaining players or pros. ${e instanceof Error?e.message:""}`,true);
      }
      const warnings = ["schedule_warning", "operating_hours_warning"].map(k => (result as Record<string, unknown>)[k]).filter(v => typeof v === "string");
      if (alive.current) props.onCreated(props.kind, start.slice(0, 10), `${title === "Add Member" ? "Member added" : isClinic ? "Clinic created" : "Booking created"} successfully.${warnings.length ? " " + warnings.join(" ") : ""}`);
    } catch (e) {
      if (alive.current) {
        setError(e instanceof Error ? e.message : "Unable to save.");
        if (e instanceof CreateApiError && e.uncertain) setUncertain(true);
      }
    } finally { pending.current = false; if (alive.current) setSaving(false); }
  }

  return <dialog className="quick-create" ref={dialog} aria-labelledby="quick-create-title" onCancel={e => { e.preventDefault(); if (!pending.current) props.onClose(); }}>
    <form onSubmit={submit}>
      <header><h2 id="quick-create-title">{title}</h2><button type="button" aria-label="Close form" disabled={saving} onClick={props.onClose}>×</button></header>
      {props.kind !== "member" && <p>{props.locationName} · Times in {props.timeZone}</p>}
      {error && <p role="alert" className="quick-create-error">{error}</p>}
      {typeMessage && <p role="status">{typeMessage}</p>}
      {loading && <p role="status">Loading booking choices…</p>}
      <fieldset disabled={saving || loading || uncertain}>
        {props.kind === "member" ? <>
          <label>First name<input autoFocus required value={first} onChange={e => setFirst(e.target.value)} /></label>
          <label>Last name<input required value={last} onChange={e => setLast(e.target.value)} /></label>
          <label>Email (optional)<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Phone (optional)<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
          <p>This creates a member profile. It does not send an invitation or create a login.</p>
        </> : <>
          <label>Lesson type<select autoFocus required value={typeId} onChange={e => {setTypeId(e.target.value);setPickedPlayers([]);setExtraPros([]);}}>
            <option value="">Select a lesson type</option>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></label>
          {!loading && ready && !types.length && <p>No active {props.kind === "clinic" ? "clinic" : ""} lesson types are available.</p>}
          {canManageTypes && <button type="button" onClick={() => setNewTypeOpen(v => !v)}>
            {newTypeOpen ? "Cancel new type" : "+ New clinic type"}
          </button>}
          {newTypeOpen && <div className="new-clinic-type">
            <label>New clinic type name<input value={newTypeName} onChange={e => setNewTypeName(e.target.value)} /></label>
            <label>Default duration (minutes)<input type="number" min="1" step="1" value={newTypeDuration} onChange={e => setNewTypeDuration(e.target.value)} /></label>
            <p>Saved for this club with per-player pricing; prices remain unset. Booking times below stay unchanged.</p>
            <button type="button" onClick={() => void saveClinicType()}>Save clinic type</button>
          </div>}
          <label>Court<select required value={courtId} onChange={e => setCourtId(e.target.value)}>
            <option value="">Select a court</option>{props.courts.filter(c => c.location_id === props.locationId && c.active !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
          <label>Pro<select value={proId} onChange={e => setProId(e.target.value)}><option value="">Unassigned (if permitted by club settings)</option>
            {pros.map(p => <option key={p.id} value={p.id}>{[p.first_name, p.last_name].filter(Boolean).join(" ")}</option>)}
          </select></label>
          {isClinic && <label><input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} /> Repeat weekly</label>}
          {isClinic && recurring && <p>Choose the first clinic's date and time below. It repeats on that weekday at the same local time.</p>}
          <label>Starts<input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} /></label>
          <label>Ends<input type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)} /></label>
          {isClinic && recurring && <label>Repeat through (maximum one year)<input type="date" required min={start.slice(0,10)} max={anniversary(start.slice(0,10))} value={repeatUntil} onChange={e=>setRepeatUntil(e.target.value)} /></label>}
          {isClinic && recurring && <p>Dates with court or pro conflicts are skipped and listed in the result. Each clinic has its own roster.</p>}
          {savedSeries && <p>Saved series reference: {savedSeries}</p>}
          {!(isClinic && recurring) && <PlayerPicker apiBase={props.apiBase} clubId={props.clubId} userId={props.userId} selected={pickedPlayers} onChange={setPickedPlayers} max={category==="private"?1:category==="semi_private"?2:isClinic?Number(capacity):100} />}
          {isClinic && !recurring && <div><h4>Additional clinic pros</h4>{extraPros.map((p,i)=><div key={i}><label>Pro<select required value={p.id} onChange={e=>setExtraPros(v=>v.map((x,j)=>j===i?{...x,id:e.target.value}:x))}><option value="">Select a pro</option>{pros.filter(x=>x.id!==proId&&!extraPros.some((y,j)=>j!==i&&y.id===x.id)).map(x=><option key={x.id} value={x.id}>{x.first_name} {x.last_name}</option>)}</select></label><label>Starts<input required type="datetime-local" value={p.start} onChange={e=>setExtraPros(v=>v.map((x,j)=>j===i?{...x,start:e.target.value}:x))}/></label><label>Ends<input required type="datetime-local" value={p.end} onChange={e=>setExtraPros(v=>v.map((x,j)=>j===i?{...x,end:e.target.value}:x))}/></label><button type="button" onClick={()=>setExtraPros(v=>v.filter((_,j)=>j!==i))}>Remove pro</button></div>)}<button type="button" onClick={()=>setExtraPros(v=>[...v,{id:"",start,end}])}>Add pro</button></div>}
          {isClinic ? <label>Registration capacity<input type="number" min="1" max="6" step="1" required value={capacity} onChange={e => setCapacity(e.target.value)} /></label>
            : <label>Player count<input type="number" min="1" step="1" required value={players} onChange={e => setPlayers(e.target.value)} /></label>}
          <p>{isClinic ? "Creates a single-court clinic. Selected players will be registered after creation." : "Selected players will be linked after the booking is created."}</p>
        </>}
        <label>Notes (optional)<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} /></label>
      </fieldset>
      <footer><button type="button" disabled={saving} onClick={props.onClose}>Cancel</button>
        <button className="primary-button" type="submit" disabled={saving || loading || !ready || uncertain || newTypeOpen || !canCreate(props.role)}>{saving ? "Saving…" : title}</button></footer>
    </form>
  </dialog>;
}
