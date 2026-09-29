import { GeneralPricing } from "./GeneralPricing";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { WeatherSetup } from "./MemberHome";
import "./ClubPages.css";
type Context = { apiBase: string; userId: string; clubId: string; role: string };
type Row = Record<string, unknown> & { id: string };
const managers = ["owner", "director", "manager"];
async function sessionToken(userId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) throw new Error("Your session changed. Sign in again.");
  return data.session.access_token;
}
async function api(p: Context, path: string, method = "GET", payload?: unknown, signal?: AbortSignal) {
  const token = await sessionToken(p.userId);
  const response = await fetch(`${p.apiBase.replace(/\/$/, "")}${path}`, { method, signal, headers: { Authorization: `Bearer ${token}`, ...(payload ? { "Content-Type": "application/json" } : {}) }, body: payload ? JSON.stringify(payload) : undefined });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status >= 500 ? "Service temporarily unavailable. Refresh to verify any attempted changes." : typeof body?.detail === "string" ? body.detail : "Request could not be completed.");
  if (!body || typeof body !== "object") throw new Error("The response could not be confirmed. Refresh before retrying.");
  return body;
}
const string = (value: unknown) => typeof value === "string" ? value : "";
type Field = { key: string; label: string; type?: string; required?: boolean };
function Editor({ row, fields, onSave, onClose }: { row: Row; fields: Field[]; onSave: (values: Record<string, string>) => Promise<void>; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(f => [f.key, string(row[f.key])])));
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null), [attempted, setAttempted] = useState(false);
  const pending = useRef(false);
  return <form className="club-editor" onSubmit={async e => { e.preventDefault(); if (pending.current || attempted) return; pending.current = true; setBusy(true); setAttempted(true); try { await onSave(values); } catch (e) { setMessage(e instanceof Error ? e.message : "Save could not be confirmed."); } finally { pending.current = false; setBusy(false); } }}>
    <fieldset disabled={busy || attempted}>{fields.map(f => <label key={f.key}>{f.label}<input type={f.type || "text"} required={f.required} value={values[f.key]} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} /></label>)}<button type="submit">Save changes</button></fieldset>
    {message && <p role="alert">{message} Close this editor and refresh before trying again.</p>}
    <button type="button" disabled={busy} onClick={onClose}>Close editor</button>
  </form>;
}
export function ProsPage(p: Context) {
  const [rows, setRows] = useState<Row[]>([]), [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0), [editing, setEditing] = useState<string | null>(null);
  useEffect(() => { const c = new AbortController(); setLoading(true); setRows([]); setError(null); setEditing(null);
    api(p, `/pros?club_id=${encodeURIComponent(p.clubId)}`, "GET", undefined, c.signal).then(b => { if (!Array.isArray(b.pros)) throw new Error("Unexpected pro list."); if (!c.signal.aborted) setRows(b.pros); }).catch(e => { if (!c.signal.aborted) setError(e.message); }).finally(() => { if (!c.signal.aborted) setLoading(false); }); return () => c.abort();
  }, [p.apiBase, p.clubId, p.userId, refresh]);
  return <section className="members-card club-pages"><h3>Pros</h3><p>Active professionals across this club.</p><button disabled={loading || !!editing} onClick={() => setRefresh(v => v + 1)}>Refresh</button>
    {loading && <p role="status">Loading pros...</p>}{error && <p role="alert">{error}</p>}{!loading && !error && !rows.length && <p>No active pros found.</p>}
    {rows.map(row => <article key={row.id}><h4>{string(row.first_name)} {string(row.last_name)}</h4>{row.email ? <p>Email: {string(row.email)}</p> : null}{row.phone ? <p>Phone: {string(row.phone)}</p> : null}
      {managers.includes(p.role) && <button disabled={!!editing} onClick={() => setEditing(row.id)}>Edit profile</button>}
      {editing === row.id && <Editor row={row} fields={[{ key: "first_name", label: "First name", required: true }, { key: "last_name", label: "Last name", required: true }, { key: "email", label: "Email", type: "email" }, { key: "phone", label: "Phone", type: "tel" }]} onClose={() => setEditing(null)} onSave={async values => { const result = await api(p, `/pros/${row.id}`, "PATCH", Object.fromEntries(Object.entries(values).map(([k,v]) => [k,v.trim()]))); if (!result.pro) throw new Error("Save could not be confirmed."); setEditing(null); setRefresh(v => v + 1); }} />}
    </article>)}
  </section>;
}
function CourtSummary({ courts }: { courts: Row[] }) {
  const groups = new Map<string, number>();
  for (const court of courts) {
    const label = `${string(court.surface).trim() || "Surface unspecified"} / ${court.indoor === true ? "Indoor" : court.indoor === false ? "Outdoor" : "Environment unspecified"}`;
    groups.set(label, (groups.get(label) || 0) + 1);
  }
  return <div className="court-summary"><strong>{courts.length} active courts</strong><ul>{[...groups].map(([label, count]) => <li key={label}>{label}: {count}</li>)}</ul></div>;
}
export function SettingsPage(p: Context) {
  const [rows, setRows] = useState<Row[]>([]), [allowed, setAllowed] = useState<boolean | null>(null), [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0), [editing, setEditing] = useState<string | null>(null), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const [courts, setCourts] = useState<Row[]>([]), [clubName, setClubName] = useState("");
  const pending = useRef(false);
  useEffect(() => { const c = new AbortController(); if (!managers.includes(p.role)) return;
    setLoading(true); setError(null); setRows([]); setAllowed(null); setCourts([]); setClubName(""); setEditing(null); setUncertain(false);
    async function load() { try {
      const locations = await api(p, `/locations?club_id=${encodeURIComponent(p.clubId)}`, "GET", undefined, c.signal);
      const courtData = await api(p, `/courts?club_id=${encodeURIComponent(p.clubId)}`, "GET", undefined, c.signal);
      if (!Array.isArray(courtData.courts)) throw new Error("Court totals could not be loaded.");
      await sessionToken(p.userId);
      const club = await supabase.from("clubs").select("name,allow_unassigned_pro_bookings").eq("id", p.clubId).single();
      if (club.error || typeof club.data?.allow_unassigned_pro_bookings !== "boolean" || !Array.isArray(locations.locations)) throw new Error("Club settings could not be loaded.");
      if (!c.signal.aborted) { setRows(locations.locations); setCourts(courtData.courts); setClubName(club.data.name); setAllowed(club.data.allow_unassigned_pro_bookings); }
    } catch (e) { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Settings unavailable."); } finally { if (!c.signal.aborted) setLoading(false); } }
    void load(); return () => c.abort();
  }, [p.apiBase, p.clubId, p.userId, p.role, refresh]);
  if (!managers.includes(p.role)) return <p>You do not have access to club settings.</p>;
  return <section className="members-card club-pages compact-settings"><h3>Settings</h3><button disabled={loading || busy || !!editing} onClick={() => setRefresh(v => v + 1)}>Refresh settings</button>{loading && <p role="status">Loading settings...</p>}{error && <p role="alert">{error}</p>}
    {!loading && !error && <details className="general-settings" open><summary>General Settings</summary><h4>{clubName}</h4>
      <CourtSummary courts={courts} />
      {courts.some(c => !c.location_id) && <p>{courts.filter(c => !c.location_id).length} courts not assigned to a location.</p>}
      <GeneralPricing {...p} clubName={clubName} />
    </details>}
    {allowed !== null && <article><h4>Booking rules</h4><p>Allow bookings without an assigned pro: <strong>{allowed ? "Yes" : "No"}</strong></p><button disabled={busy || uncertain} onClick={async () => {
      if (pending.current) return; pending.current = true; setBusy(true); setError(null);
      try { const result = await api(p, `/clubs/${p.clubId}/settings`, "PATCH", { allow_unassigned_pro_bookings: !allowed }); if (typeof result.club?.allow_unassigned_pro_bookings !== "boolean") throw new Error("Save could not be confirmed."); setAllowed(result.club.allow_unassigned_pro_bookings); }
      catch (e) { setUncertain(true); setError((e instanceof Error ? e.message : "Save could not be confirmed.") + " Refresh settings before retrying."); } finally { pending.current = false; setBusy(false); }
    }}>{busy ? "Saving..." : allowed ? "Require an assigned pro" : "Allow unassigned pro bookings"}</button></article>}
    {rows.map(row => <article key={row.id}><h4>{string(row.name)}</h4><CourtSummary courts={courts.filter(c => c.location_id === row.id)} /><p>{[row.city,row.state,row.country].filter(Boolean).join(", ")}</p><p>{string(row.timezone)} | {string(row.opening_time)} - {string(row.closing_time)}</p><button disabled={!!editing} onClick={() => setEditing(row.id)}>Edit location</button>
      {editing === row.id && <Editor row={row} fields={[{key:"name",label:"Location name",required:true},{key:"city",label:"City"},{key:"state",label:"State"},{key:"country",label:"Country"},{key:"timezone",label:"Time zone (e.g. America/New_York)",required:true},{key:"opening_time",label:"Opening time",type:"time",required:true},{key:"closing_time",label:"Closing time",type:"time",required:true}]} onClose={() => setEditing(null)} onSave={async values => { const result = await api(p, `/locations/${row.id}`, "PATCH", values); if (!result.location) throw new Error("Save could not be confirmed."); setEditing(null); setRefresh(v => v + 1); }} />}
      <WeatherSetup {...p} locationId={row.id} locationName={string(row.name)} timeZone={string(row.timezone) || "UTC"} />
    </article>)}
  </section>;
}
