import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { MemberTierEditor } from "./MemberTierEditor";
import "./ProfileDirectory.css";

type Kind = "members" | "pros";
type Profile = Record<string, string | number | boolean | null> & {
  id: string; club_id: string; first_name: string; last_name: string;
  email: string | null; phone: string | null; active: boolean;
  membership_type: string | null; notes: string | null;
};
type Context = { apiBase: string; userId: string; clubId: string; role: string; kind: Kind };
type Page = { profiles: Profile[]; has_more: boolean; payments_connected: boolean; legacy?: boolean };
type Field = { key: string; label: string; type?: "email" | "tel" | "number" | "checkbox" | "textarea" | "tier"; required?: boolean; min?: number; step?: string; maxLength?: number };
const common: Field[] = [
  { key: "first_name", label: "First name", required: true, maxLength: 120 },
  { key: "last_name", label: "Last name", required: true, maxLength: 120 },
  { key: "email", label: "Contact email", type: "email", maxLength: 254 },
  { key: "phone", label: "Phone", type: "tel", maxLength: 60 },
];
const memberFields: Field[] = [
  ...common, { key: "membership_type", label: "Pricing tier", type: "tier" },
  { key: "skill_level", label: "Skill level", maxLength: 100 },
  { key: "notes", label: "Staff notes", type: "textarea", maxLength: 4000 },
  { key: "active", label: "Active member profile", type: "checkbox" },
];
const proFields: Field[] = [
  ...common,
  { key: "default_hourly_cost", label: "Default hourly cost", type: "number", min: 0, step: "0.01", required: true },
  { key: "max_lessons_per_day", label: "Maximum lessons per day (blank for no limit)", type: "number", min: 1, step: "1" },
  { key: "required_break_minutes", label: "Required break (minutes)", type: "number", min: 0, step: "1", required: true },
  { key: "fixed_schedule", label: "Uses a fixed schedule", type: "checkbox" },
  { key: "notes", label: "Staff notes", type: "textarea", maxLength: 4000 },
  { key: "active", label: "Active pro profile", type: "checkbox" },
];
const tiers = [["", "Not set"], ["member", "Member"], ["non_member", "Non-member"], ["junior", "Junior"], ["senior", "Senior"]];
function messageFor(error: unknown) { return error instanceof Error ? error.message : "Please refresh and try again."; }

class ProfileHttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }

async function request<T>(p: Context, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== p.userId) throw new Error("Your session changed. Sign in again.");
  const response = await fetch(`${p.apiBase}${path}`, {
    method: body === undefined ? "GET" : "PATCH", signal,
    headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new ProfileHttpError(response.status, typeof result.detail === "string" ? result.detail : "The profile could not be saved or loaded. Refresh before retrying.");
  return result as T;
}

export function ProfileDirectory(p: Context) {
  const [search, setSearch] = useState(""), [query, setQuery] = useState(""), [inactive, setInactive] = useState(false);
  const [offset, setOffset] = useState(0), [revision, setRevision] = useState(0), [editing, setEditing] = useState<Profile | null>(null);
  const [page, setPage] = useState<{ key: string; data?: Page; error?: string } | null>(null);
  const [message, setMessage] = useState("");
  const allowed = (p.kind === "members" ? ["owner", "director", "manager", "front_desk"] : ["owner", "director", "manager"]).includes(p.role);
  const key = JSON.stringify([p.userId, p.clubId, p.kind, query, inactive, offset, revision]);
  const current = page?.key === key ? page : null;
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setOffset(0); }, 250); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    if (!allowed || !p.clubId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ club_id: p.clubId, search: query, include_inactive: String(inactive), offset: String(offset) });
    request<Page>(p, `/staff-profiles/${p.kind}?${params}`, undefined, controller.signal).catch(async error => {
      // Only a missing endpoint permits the older read-only API; never bypass an authorization error.
      if (!(error instanceof ProfileHttpError) || error.status !== 404) throw error;
      const legacyParams = new URLSearchParams({club_id: p.clubId, search: query, include_inactive: String(inactive)});
      const legacy = await request<Record<string, Profile[]>>(p, `/${p.kind}?${legacyParams}`, undefined, controller.signal);
      const rows = legacy[p.kind];
      if (!Array.isArray(rows) || rows.some(row => row.club_id !== p.clubId)) throw new Error("Member records could not be confirmed.");
      const filtered = p.kind === "pros" ? rows.filter(row => `${row.first_name} ${row.last_name}`.toLowerCase().includes(query.toLowerCase())) : rows;
      return {profiles: filtered.slice(offset, offset + 25).map(row => ({...row, active: row.active ?? true})), has_more: filtered.length > offset + 25, payments_connected: false, legacy: true};
    }).then(data => {
      if (!Array.isArray(data.profiles) || data.profiles.some(row => row.club_id !== p.clubId) || typeof data.has_more !== "boolean") throw new Error("Profiles could not be confirmed. Install the backend update and refresh.");
      if (!controller.signal.aborted) setPage({ key, data });
    }).catch(error => { if (!controller.signal.aborted) setPage({ key, error: messageFor(error) }); });
    return () => controller.abort();
  }, [key, allowed, p.apiBase]);
  if (!allowed) return <p>You do not have access to edit these profiles.</p>;
  return <section className={`members-card profile-directory ${p.kind === "members" ? "compact-member-directory" : ""}`}>
    <p className="card-kicker">CLUB DATABASE</p><h3>{p.kind === "members" ? "Members" : "Pros"}</h3>
    <div className="profile-toolbar"><label>Search by name<input disabled={!!editing} type="search" placeholder={`Search ${p.kind}…`} value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label className="profile-check"><input disabled={!!editing || (p.kind === "pros" && current?.data?.legacy)} type="checkbox" checked={inactive} onChange={e => { setInactive(e.target.checked); setOffset(0); }} />Include inactive</label>
      <button disabled={!!editing} onClick={() => setRevision(v => v + 1)}>Refresh</button></div>
    {current?.data?.legacy && <p role="status">Showing available records. Full profile editing{p.kind === "pros" ? " and inactive pro profiles are" : " is"} temporarily unavailable.</p>}
    {message && <p role="status">{message}</p>}
    {!current && <p role="status">Loading profiles…</p>}{current?.error && <p role="alert">{current.error}</p>}
    {current?.data?.profiles.length === 0 && <p>No profiles match your search.</p>}
    {current?.data?.profiles.map(row => <article className="profile-card" key={row.id}>
      <header className="profile-heading"><div className="member-avatar" aria-hidden="true">{row.first_name?.charAt(0)}{row.last_name?.charAt(0)}</div><div><h4>{row.first_name} {row.last_name}</h4><p>{row.email || "No contact email"}</p>{row.phone && <p>{row.phone}</p>}</div><span className="profile-status">{row.active ? "Active" : "Inactive"}</span><button disabled={!!editing || current.data?.legacy} onClick={() => { setEditing(row); setMessage(""); }}>Edit</button></header>
      {p.kind === "members" && <div className="profile-details"><MemberTierEditor key={`${row.id}:${row.membership_type}`} memberId={row.id} initial={row.membership_type} userId={p.userId} apiBase={p.apiBase} disabled={!!editing} onSaved={() => setRevision(v => v + 1)} />
        <div className="profile-payment"><h5>Card on file</h5><strong>Payments not connected</strong><p>Saved card details will appear here when your club connects a payment provider.</p></div></div>}
      {editing?.id === row.id && <ProfileEditor key={row.id} p={p} row={editing} onClose={() => { setEditing(null); setRevision(v => v + 1); }} onSaved={() => { setEditing(null); setRevision(v => v + 1); setMessage("Profile saved. Contact details do not change the account’s sign-in email."); }} />}
    </article>)}
    <div className="profile-pagination"><button disabled={!!editing || offset === 0} onClick={() => setOffset(v => Math.max(0, v - 25))}>Previous</button><span>Page {offset / 25 + 1}</span><button disabled={!!editing || !current?.data?.has_more} onClick={() => setOffset(v => v + 25)}>Next</button></div>
  </section>;
}

function ProfileEditor({ p, row, onClose, onSaved }: { p: Context; row: Profile; onClose: () => void; onSaved: () => void }) {
  const fields = p.kind === "members" ? memberFields : proFields;
  const initial = Object.fromEntries(fields.map(field => [field.key, field.type === "checkbox" ? row[field.key] === true : String(row[field.key] ?? "")]));
  const [values, setValues] = useState<Record<string, string | boolean>>(initial), [busy, setBusy] = useState(false), [error, setError] = useState(""), [uncertain, setUncertain] = useState(false);
  const pending = useRef(false);
  const changed = fields.some(field => values[field.key] !== initial[field.key]);
  return <form className="profile-editor" onSubmit={async e => {
    e.preventDefault(); if (pending.current || uncertain || !changed) return;
    const changes: Record<string, unknown> = {};
    for (const field of fields) {
      const value = values[field.key];
      if (value === initial[field.key]) continue;
      changes[field.key] = field.type === "checkbox" ? value : field.type === "number" ? (value === "" ? null : Number(value)) : String(value).trim() || null;
    }
    pending.current = true; setBusy(true); setError("");
    try { const result = await request<{ profile: Profile }>(p, `/staff-profiles/${p.kind}/${row.id}?club_id=${encodeURIComponent(p.clubId)}`, changes); if (result.profile?.id !== row.id || result.profile.club_id !== p.clubId) throw new Error("Save could not be confirmed."); onSaved(); }
    catch (e) { setError(messageFor(e)); setUncertain(true); }
    finally { pending.current = false; setBusy(false); }
  }}>
    <h4>Edit {p.kind === "members" ? "member" : "pro"}</h4><p>Contact email is separate from sign-in email. Profile status does not change sign-in access.</p>
    <fieldset disabled={busy || uncertain}><div className="profile-form-grid">{fields.map(field => <label key={field.key} className={field.type === "checkbox" ? "profile-check" : field.type === "textarea" ? "profile-full" : ""}>
      {field.type !== "checkbox" && field.label}
      {field.type === "checkbox" ? <><input type="checkbox" checked={values[field.key] === true} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.checked }))} />{field.label}</> : field.type === "textarea" ? <textarea maxLength={field.maxLength} value={String(values[field.key])} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} /> : field.type === "tier" ? <select value={String(values[field.key])} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}>{!tiers.some(([value]) => value === values[field.key]) && <option value={String(values[field.key])}>{String(values[field.key])}</option>}{tiers.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select> : <input type={field.type || "text"} required={field.required} min={field.min} step={field.step} maxLength={field.maxLength} value={String(values[field.key])} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} />}
    </label>)}</div><button type="submit" disabled={!changed}>{busy ? "Saving…" : "Save changes"}</button></fieldset>
    {error && <p role="alert">{error} Close the editor to reload the current record before retrying.</p>}
    <button type="button" disabled={busy} onClick={onClose}>{uncertain ? "Close and refresh" : "Cancel"}</button>
  </form>;
}
