import { AvailabilityGrid } from "./AvailabilityGrid";
import { PricePreview, PricingChoice } from "./PricePreview";
import type { PricingMode } from "./PricePreview";
import { useEffect, useRef, useState } from "react";

import { supabase } from "../lib/supabase";

import { createRequest, CreateApiError } from "../lib/createActions";

import "./MemberHome.css";

export type MemberHomeContext = { apiBase: string; userId: string; clubId: string; locationId: string | null; locationName: string | null; timeZone: string };

type Context = MemberHomeContext;

type Slot = { court_id: string; court_name: string; starts_at: string; ends_at: string };

type Lesson = { id: string; name: string; category: string };

type Availability = { location_id: string; checked_at: string; slots: Slot[]; lesson_types: Lesson[]; court_status?: {total:number;unavailable:string[]} };

type Pro = { id: string; first_name: string; last_name: string };

async function token(userId: string) {

  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session || data.session.user.id !== userId) throw new Error("Your session changed. Sign in again.");

  return data.session.access_token;

}

const localDay = (zone: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const sameSlot = (a: Slot, b: Slot) => a.court_id === b.court_id && a.starts_at === b.starts_at && a.ends_at === b.ends_at;

export function AvailabilityAction({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {

  return <button className="member-availability-callout" onClick={onClick} disabled={disabled}><span>COURT AVAILABILITY</span><strong>Find a time to play →</strong><p>Check open courts and request a rental or lesson. Requests require staff approval.</p></button>;

}

export function MemberAvailability(props: Context & { onClose: () => void }) {

  const dialog = useRef<HTMLDialogElement>(null), alive = useRef(true), pending = useRef(false);

  const [date, setDate] = useState(localDay(props.timeZone)), [duration, setDuration] = useState("60");

  const [data, setData] = useState<Availability | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Slot | null>(null), [typeId, setTypeId] = useState(""), [proId, setProId] = useState("");

  const [pros, setPros] = useState<Pro[]>([]), [proLoading, setProLoading] = useState(false), [proError, setProError] = useState<string | null>(null);

  const [first, setFirst] = useState(""), [last, setLast] = useState(""), [email, setEmail] = useState("");

  const [saving, setSaving] = useState(false), [uncertain, setUncertain] = useState(false), [message, setMessage] = useState<string | null>(null);

  const [courtFilter, setCourtFilter] = useState("");
  const [priceReady,setPriceReady]=useState(false);
  const [pricingMode,setPricingMode]=useState<PricingMode>("split");

  const lesson = data?.lesson_types.find(t => t.id === typeId);

  const query = () => new URLSearchParams({ club_id: props.clubId, location_id: props.locationId!, availability_date: date, duration_minutes: duration });

  const format = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: props.timeZone, hour: "numeric", minute: "2-digit" });

  async function getAvailability(auth: string, signal?: AbortSignal) {

    const result = await createRequest(props.apiBase, auth, `/member/court-availability?${query()}`, { signal });

    if (Array.isArray(result) || result.location_id !== props.locationId || !Array.isArray(result.slots) || !Array.isArray(result.lesson_types)) throw new Error("Availability could not be verified.");

    return result as Availability;

  }

  const [refresh, setRefresh] = useState(0);

  useEffect(() => { alive.current = true; dialog.current?.showModal(); return () => { alive.current = false; }; }, []);

  useEffect(() => {

    let cancelled = false, running = false;

    const controller = new AbortController();

    setSelected(null); setCourtFilter(""); setData(null); setError(null); setLoading(true);

    async function load() {

      if (running || pending.current || document.hidden) return;

      running = true;

      try {

        const result = await getAvailability(await token(props.userId), controller.signal);

        if (!cancelled) { setData(result); setError(null); setCourtFilter(current => result.slots.some(s => s.court_id === current && Date.parse(s.starts_at) > Date.now()) ? current : ""); setSelected(current => current && result.slots.some(s => sameSlot(s, current)) ? current : null); }

      } catch (e) { if (!cancelled) { setError(e instanceof Error ? e.message : "Availability unavailable."); setData(null); setSelected(null); } }

      finally { running = false; if (!cancelled) setLoading(false); }

    }

    void load(); const interval = setInterval(() => void load(), 30000);

    const focus = () => { if (!document.hidden) void load(); };

    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", focus);

    return () => { cancelled = true; controller.abort(); clearInterval(interval); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };

  }, [props.clubId, props.locationId, props.userId, props.apiBase, date, duration, refresh]);

  useEffect(() => {

    let cancelled = false; const controller = new AbortController(); setPros([]); setProId(""); setProError(null);

    if (!selected || !lesson || lesson.category === "rental") { setProLoading(false); return; }

    setProLoading(true);

    async function load() {

      try {

        const auth = await token(props.userId);

        const q = new URLSearchParams({ club_id: props.clubId, location_id: props.locationId!, starts_at: selected!.starts_at, ends_at: selected!.ends_at });

        const response = await createRequest(props.apiBase, auth, `/member/available-pros?${q}`, { signal: controller.signal });

        if (Array.isArray(response) || !Array.isArray(response.pros)) throw new Error("Pro availability could not be verified.");

        if (!cancelled) setPros(response.pros as Pro[]);

      } catch (e) { if (!cancelled) setProError(e instanceof Error ? e.message : "Pro availability unavailable."); }

      finally { if (!cancelled) setProLoading(false); }

    }

    void load(); return () => { cancelled = true; controller.abort(); };

  }, [selected, lesson?.id, props.clubId, props.locationId, props.userId, props.apiBase]);

  async function request(event: React.FormEvent) {

    event.preventDefault(); if (!selected || !lesson || pending.current || uncertain || !data || error) return;

    pending.current = true; setSaving(true); setMessage(null);

    let submitted = false;

    try {

      const auth = await token(props.userId);

      const fresh = await getAvailability(auth);
      if (alive.current) setData(fresh);

      if (!fresh.slots.some(s => sameSlot(s, selected))) { setData(fresh); setSelected(null); throw new Error("That slot is no longer available. Choose another time."); }

      if (!fresh.lesson_types.some(t => t.id === lesson.id && t.category === lesson.category)) throw new Error("This lesson type is no longer available.");

      if (lesson.category !== "rental") {

        const q = new URLSearchParams({ club_id: props.clubId, location_id: props.locationId!, starts_at: selected.starts_at, ends_at: selected.ends_at });

        const available = await createRequest(props.apiBase, auth, `/member/available-pros?${q}`);

        if (Array.isArray(available) || !Array.isArray(available.pros) || !(available.pros as Pro[]).some(p => p.id === proId)) throw new Error("That pro is no longer available. Select the time again to refresh pros.");

      }

      const payload = { pricing_mode: pricingMode, club_id: props.clubId, location_id: props.locationId, court_id: selected.court_id, lesson_type_id: lesson.id,

        starts_at: selected.starts_at, ends_at: selected.ends_at, pro_id: lesson.category === "rental" ? null : proId,

        ...(lesson.category === "semi_private" ? { guest_first_name: first.trim(), guest_last_name: last.trim(), guest_email: email.trim() || null } : {}) };

      submitted = true;

      const result = await createRequest(props.apiBase, auth, "/member/bookings", { payload });

      if (Array.isArray(result) || !result.request || typeof result.request !== "object" || !("id" in result.request)) throw new CreateApiError("Request status could not be confirmed. Check with front desk before retrying.", true);

      if (alive.current) { setMessage("Request sent for staff approval. This is not a confirmed reservation."); setSelected(null); setRefresh(v => v + 1); }

    } catch (e) { if (alive.current) { setMessage(e instanceof Error ? e.message : "Request failed."); if (submitted && (!(e instanceof CreateApiError) || e.uncertain)) setUncertain(true); } }

    finally { pending.current = false; if (alive.current) setSaving(false); }

  }

  const status = data?.court_status;
  const statusValid = Boolean(status && Number.isInteger(status.total) && status.total >= 0 && Array.isArray(status.unavailable) && status.unavailable.every(v=>typeof v==="string") && status.unavailable.length<=status.total);
  const unavailableNames = statusValid ? new Intl.ListFormat("en", {style:"long",type:"conjunction"}).format(status!.unavailable) : "";
  const statusMessage = !statusValid ? "Court status could not be confirmed. Refresh to try again."
    : status!.total === 0 ? "No courts are configured at this location yet."
    : status!.unavailable.length === 0 ? "All courts are active."
    : `${unavailableNames} ${status!.unavailable.length===1?"isn't":"aren't"} available at the moment.`;

  const openSlots = (data?.slots ?? []).filter(s => Date.parse(s.starts_at) > Date.now());
  const courts = [...new Map(openSlots.map(s => [s.court_id, s.court_name])).entries()];
  const effectiveCourtFilter = courts.some(([id]) => id === courtFilter) ? courtFilter : "";
  const slots = openSlots.filter(s => !effectiveCourtFilter || s.court_id === effectiveCourtFilter);

  return <dialog ref={dialog} className="member-availability-dialog" onCancel={e => { e.preventDefault(); if (!pending.current) props.onClose(); }}>

    <header><h3>Open court times — {props.locationName}</h3><button disabled={saving} onClick={props.onClose} aria-label="Close availability">×</button></header>

    <p>Times in {props.timeZone}. Availability refreshes every 30 seconds while visible and is checked again when you request. A slot is not held until staff approves.</p>

    {data && <aside className="member-court-status" role="status"><strong>{statusMessage}</strong><p>Open times below also account for existing bookings.</p></aside>}

    <fieldset disabled={saving || uncertain}><label>Date<input type="date" required min={localDay(props.timeZone)} value={date} onChange={e => { if (e.target.value) setDate(e.target.value); }} /></label>

      <label>Duration<select value={duration} onChange={e => setDuration(e.target.value)}>{[30,45,60,90,120].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>

      <label>Request type<select value={typeId} onChange={e => { setTypeId(e.target.value); }}><option value="">Select rental or lesson</option>{data?.lesson_types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>

      <label>Available courts<select disabled={loading || courts.length === 0} value={effectiveCourtFilter} onChange={e => { setCourtFilter(e.target.value); setSelected(null); }}><option value="">{courts.length ? "All available courts" : "No courts available"}</option>{courts.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>

    </fieldset><button disabled={saving} onClick={() => setRefresh(v => v + 1)}>Refresh availability</button>

    {data && <p>Last checked: {new Date(data.checked_at).toLocaleTimeString()}</p>}{loading && <p role="status">Checking courts…</p>}{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}

    {!loading && data && slots.length === 0 && <p>No open slots for this date, duration and court.</p>}

    <AvailabilityGrid slots={slots} selected={selected} disabled={saving || uncertain} duration={duration} format={format} onSelect={setSelected}/>

    {selected && !lesson && <p role="status"><strong>{selected.court_name} · {format(selected.starts_at)} – {format(selected.ends_at)}</strong> selected. Choose a request type above to continue.</p>}
    {data && data.lesson_types.length === 0 && <p role="status">No rental or lesson types are available for requests. Please contact the front desk.</p>}
    {selected && lesson && <form onSubmit={request}><h4>{selected.court_name} · {format(selected.starts_at)} – {format(selected.ends_at)}</h4><fieldset disabled={saving || uncertain}>

      {lesson.category !== "rental" && <><label>Available pro<select required value={proId} onChange={e => setProId(e.target.value)}><option value="">Select a pro</option>{pros.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></label>{proLoading && <p>Checking pros…</p>}{proError && <p role="alert">{proError}</p>}{!proLoading && !proError && !pros.length && <p>No pros are available for this time. Select another slot.</p>}</>}

      {lesson.category === "semi_private" && <><p>Second participant (guest)</p><label>First name<input required value={first} onChange={e => setFirst(e.target.value)} /></label><label>Last name<input required value={last} onChange={e => setLast(e.target.value)} /></label><label>Email (optional)<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label></>}

      {(lesson.category==="rental"||lesson.category==="semi_private")&&<PricingChoice value={pricingMode} onChange={setPricingMode}/>}
      <PricePreview clubId={props.clubId} userId={props.userId} lessonId={lesson.id} startsAt={selected.starts_at} endsAt={selected.ends_at} guestCount={lesson.category==="semi_private"?1:0} mode={pricingMode} onReady={setPriceReady}/>
      <button disabled={!priceReady || proLoading || (lesson.category !== "rental" && !proId)}>Request this court</button>

    </fieldset></form>}

  </dialog>;

}

type Forecast = { zip_code?: string | null; updated_at: string | null; periods: { startTime: string; temperature: number; temperatureUnit: string; shortForecast: string; windSpeed: string; windDirection: string; probabilityOfPrecipitation?: { value?: number | null } }[] };

export function LocationWeather(props: Context) {

  const [data,setData]=useState<Forecast|null>(null), [error,setError]=useState<string|null>(null);

  useEffect(() => {

    let cancelled=false, running=false; const controller=new AbortController(); setData(null); setError(null);

    async function load() {

      if (!props.locationId || running || document.hidden) return; running=true;

      try { const auth=await token(props.userId); const result=await createRequest(props.apiBase,auth,`/locations/${props.locationId}/weather?club_id=${props.clubId}`,{signal:controller.signal});

        if (Array.isArray(result) || !Array.isArray(result.periods) || !result.periods.length) throw new Error("Weather forecast unavailable.");

        if (!cancelled) {setData(result as Forecast);setError(null);} }

      catch(e) {if(!cancelled){setData(null);setError(e instanceof Error?e.message:"Weather unavailable.");}} finally {running=false;}

    }

    void load();const timer=setInterval(()=>void load(),600000);const focus=()=>void load();window.addEventListener("focus",focus);

    return()=>{cancelled=true;controller.abort();clearInterval(timer);window.removeEventListener("focus",focus);};

  },[props.apiBase,props.clubId,props.locationId,props.userId]);

  const current=data?.periods[0];

  return <div className="weather-card member-weather"><p className="card-kicker">LOCAL WEATHER</p><h3>{props.locationName ?? "Select a location"}</h3>

    {error && <p role="status">{error}</p>}{props.locationId && !data && !error && <p>Loading forecast…</p>}

    {data?.zip_code && <p>ZIP area {data.zip_code}</p>}

    {current && <><strong className="weather-temperature">{current.temperature}°{current.temperatureUnit}</strong><p>{current.shortForecast}</p><p>Wind {current.windDirection} {current.windSpeed}{current.probabilityOfPrecipitation?.value != null ? ` · Rain chance ${current.probabilityOfPrecipitation.value}%` : ""}</p><p>Hourly forecast for {new Date(current.startTime).toLocaleTimeString("en-US",{timeZone:props.timeZone,hour:"numeric",minute:"2-digit"})}</p></>}

    <p><a href="https://www.weather.gov/" target="_blank" rel="noreferrer">National Weather Service</a>{data?.updated_at ? ` · Updated ${new Date(data.updated_at).toLocaleString("en-US",{timeZone:props.timeZone})}` : ""}</p>

  </div>;

}

export function WeatherSetup(props: Context) {

  const [zip,setZip]=useState(""),[message,setMessage]=useState<string|null>(null),[busy,setBusy]=useState(false);

  const pending=useRef(false);

  async function save(e:React.FormEvent){e.preventDefault();if(pending.current||!props.locationId)return;pending.current=true;setBusy(true);setMessage(null);

    try {const auth=await token(props.userId);const response=await fetch(`${props.apiBase.replace(/\/$/,"")}/locations/${props.locationId}/weather-zip-code?club_id=${props.clubId}`,{method:"PUT",headers:{Authorization:`Bearer ${auth}`,"Content-Type":"application/json"},body:JSON.stringify({zip_code:zip.trim()})});const body=await response.json().catch(()=>null);if(!response.ok||body?.weather_configured!==true)throw new Error(typeof body?.detail==="string"?body.detail:"Weather settings could not be confirmed.");setMessage(`Weather saved for ${body.area || body.zip_code} (${body.zip_code}).`);}catch(e){setMessage(e instanceof Error?e.message:"Unable to save weather location.");}finally{pending.current=false;setBusy(false);}}

  return <details className="weather-setup"><summary>Set weather location for {props.locationName}</summary><form onSubmit={save}><p>Enter this facility's five-digit US ZIP code. Weather is shown for that ZIP area and saved separately for each club location.</p><fieldset disabled={busy||!props.locationId}><label>ZIP code<input type="text" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}" maxLength={5} required value={zip} onChange={e=>setZip(e.target.value.replace(/[^0-9]/g,""))} placeholder="e.g. 11954" /></label><button>Save weather location</button></fieldset>{message&&<p role="status">{message}</p>}</form></details>;

}
