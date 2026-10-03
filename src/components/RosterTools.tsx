import { PricePreview } from "./PricePreview";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { createRequest, CreateApiError } from "../lib/createActions";
import "./RosterTools.css";

export type PlayerProfile = {
  id?: string; first_name?: string | null; last_name?: string | null;
  email?: string | null; phone?: string | null; membership_type?: string | null;
  skill_level?: string | null; active?: boolean;
};
export type RosterPlayer = {
  enrollment_id: string; display_name: string; status: string; participant_type: string;
  member?: PlayerProfile | null; guest_email?: string | null; guest_phone?: string | null;
  waitlist_position?: number | null; pricing_basis?: string | null;
};
export type PlayerCard = { name: string; profile?: PlayerProfile | null; guestEmail?: string | null; guestPhone?: string | null; kind?: string; status?: string; role?: string | null; clubId: string };
export const rosterCard = (p: RosterPlayer, clubId: string): PlayerCard => ({ name: p.display_name, profile: p.member, guestEmail: p.guest_email, guestPhone: p.guest_phone, kind: p.participant_type, status: p.status, clubId });
export const displayPlayerName = (p: PlayerProfile) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Player";
export function registrationPayload(mode: "member" | "guest", memberId: string, first: string, last: string, email: string, phone: string) {
  if (mode === "member") {
    if (!memberId) throw new Error("Select a member first.");
    return { member_id: memberId };
  }
  if (!first.trim() || !last.trim()) throw new Error("Enter the guest's first and last name.");
  return { guest_first_name: first.trim(), guest_last_name: last.trim(), guest_email: email.trim() || null, guest_phone: phone.trim() || null };
}
export function PlayerInfoButton({ onClick, name }: { onClick: () => void; name: string }) {
  return <button className="player-info-button" type="button" draggable={false} aria-label={`View details for ${name}`} title={`View ${name}'s details`}
    onDragStart={e => { e.preventDefault(); e.stopPropagation(); }} onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}
    onClick={e => { e.stopPropagation(); onClick(); }}>ⓘ</button>;
}
async function sessionToken(userId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) throw new Error("Your session changed. Sign in again.");
  return data.session.access_token;
}
export function PlayerDetails({ player, apiBase, userId, canReadMembers, onClose }: {
  player: PlayerCard; apiBase: string; userId: string; canReadMembers: boolean; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [profile, setProfile] = useState(player.profile);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController(); let cancelled = false;
    async function enrich() {
      if (!canReadMembers || !player.profile?.id) return;
      try {
        const token = await sessionToken(userId);
        const search = (player.profile.last_name || player.profile.first_name || "").replace(/[%,().]/g, " ").trim();
        if (!search) return;
        const data = await createRequest(apiBase, token, `/members?${new URLSearchParams({ club_id: player.clubId, include_inactive: "true", search })}`, { signal: controller.signal });
        const match = Array.isArray(data) ? (data as PlayerProfile[]).find(p => p.id === player.profile?.id) : undefined;
        if (!cancelled && match) setProfile(p => ({ ...p, ...match }));
      } catch { if (!cancelled) setNote("Additional profile details could not be loaded. Showing the available booking details."); }
    }
    void enrich(); return () => { cancelled = true; controller.abort(); };
  }, [player, apiBase, userId, canReadMembers]);
  const values = [
    ["Participant", player.kind ?? "Member"], ["Email", profile?.email ?? player.guestEmail],
    ["Phone", profile?.phone ?? player.guestPhone], ["Membership", profile?.membership_type],
    ["Skill level", profile?.skill_level], ["Profile access", profile?.active === undefined ? undefined : profile.active ? "Active" : "Inactive"],
    ["Booking status", player.status?.replaceAll("_", " ")], ["Participant role", player.role],
  ];
  return <dialog ref={dialog} className="roster-dialog player-details-dialog" onCancel={e => { e.preventDefault(); onClose(); }}>
    <header><h3>{player.name}</h3><button onClick={onClose} aria-label="Close player details">×</button></header>
    <dl>{values.filter(([, value]) => value !== undefined && value !== null && value !== "").map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p>Only details available to your account are shown.</p>{note && <p role="status">{note}</p>}
    <button onClick={onClose}>Close</button>
  </dialog>;
}
type RosterData = { booking_id: string; booking_status?: string; participants: RosterPlayer[]; capacity?: number; enrolled_count?: number; waitlist_count?: number };
type RosterProps = { compact?: boolean; bookingId: string; clubId: string; title: string; apiBase: string; userId: string; canEdit: boolean; onClose: () => void; onChanged: () => void };
export function FullRoster(props: RosterProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const alive = useRef(true), pending = useRef(false);
  const [roster, setRoster] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"member" | "guest">("member");
  const [search, setSearch] = useState(""), [members, setMembers] = useState<PlayerProfile[]>([]), [memberId, setMemberId] = useState("");
  const [searching, setSearching] = useState(false), [searchError, setSearchError] = useState<string | null>(null);
  const [first, setFirst] = useState(""), [last, setLast] = useState(""), [email, setEmail] = useState(""), [phone, setPhone] = useState("");
  const [removing, setRemoving] = useState<RosterPlayer | null>(null);
  const [selected, setSelected] = useState<PlayerCard | null>(null);
  const editable = props.canEdit && !!roster && !["cancelled", "canceled", "completed"].includes(roster.booking_status ?? "");
  async function load() {
    setLoading(true);
    try {
      const token = await sessionToken(props.userId);
      const data = await createRequest(props.apiBase, token, `/bookings/${props.bookingId}/clinic-roster`);
      if (Array.isArray(data) || data.booking_id !== props.bookingId || !Array.isArray(data.participants)) throw new Error("Unable to verify the roster response.");
      if (alive.current) { setRoster(data as RosterData); setUncertain(false); }
    } catch (e) { if (alive.current) { setUncertain(true); setMessage(e instanceof Error ? e.message : "Unable to load roster."); } }
    finally { if (alive.current) setLoading(false); }
  }
  useEffect(() => {
    alive.current = true; dialog.current?.showModal(); void load();
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let cancelled = false;
    setMemberId(""); setMembers([]); setSearchError(null);
    if (!props.canEdit || mode !== "member" || search.trim().length < 2) { setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const token = await sessionToken(props.userId);
        const query = new URLSearchParams({ club_id: props.clubId, search: search.replace(/[%,().]/g, " ").trim() });
        const data = await createRequest(props.apiBase, token, `/members?${query}`, { signal: controller.signal });
        if (!Array.isArray(data)) throw new Error("Unable to load members.");
        if (!cancelled) setMembers(data as PlayerProfile[]);
      } catch (e) { if (!cancelled) setSearchError(e instanceof Error ? e.message : "Unable to search members."); }
      finally { if (!cancelled) setSearching(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [search, mode, props.apiBase, props.clubId, props.userId, props.canEdit]);
  async function mutate(action: "add" | "remove") {
    if (!editable || pending.current || uncertain || loading) return;
    if (action === "add" && mode === "member" && !memberId) { setMessage("Select a member first."); return; }
    if (action === "add" && mode === "guest" && (!first.trim() || !last.trim())) { setMessage("Enter the guest's first and last name."); return; }
    if (action === "remove" && !removing) return;
    pending.current = true; setBusy(true); setMessage(null);
    let sent = false;
    try {
      const token = await sessionToken(props.userId);
      const payload = action === "add" ? registrationPayload(mode, memberId, first, last, email, phone) : undefined;
      sent = true;
      const response = await fetch(`${props.apiBase.replace(/\/$/, "")}${action === "add" ? `/bookings/${props.bookingId}/clinic-enrollments` : `/clinic-enrollments/${removing!.enrollment_id}`}`, {
        method: action === "add" ? "POST" : "DELETE", headers: { Authorization: `Bearer ${token}`, ...(action === "add" ? { "Content-Type": "application/json" } : {}) },
        ...(action === "add" ? { body: JSON.stringify(payload) } : {}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status >= 500) throw new CreateApiError("The change could not be confirmed. Refresh the roster before retrying.", true);
        sent = false; throw new Error(typeof data?.detail === "string" ? data.detail : "The change was rejected. Check the participant and try again.");
      }
      const verified = action === "add" ? typeof data?.enrollment_id === "string" && ["enrolled", "waitlisted"].includes(data.status)
        : data?.enrollment?.id === removing!.enrollment_id && data.enrollment.status === "cancelled";
      if (!verified) throw new CreateApiError("The change could not be confirmed. Refresh the roster before retrying.", true);
      sent = false;
      if (alive.current) {
        setRemoving(null); setMemberId(""); setFirst(""); setLast(""); setEmail(""); setPhone("");
        setMessage(action === "remove" ? "Enrollment cancelled. Any eligible waitlist promotion is reflected below." : [data.status === "waitlisted" ? "Clinic full: player added to the waitlist." : "Player enrolled successfully.", data.pricing_notice].filter(Boolean).join(" "));
        await load(); if (alive.current) props.onChanged();
      }
    } catch (e) { if (alive.current) { setMessage(sent ? "The change could not be confirmed. Refresh the roster before retrying." : e instanceof Error ? e.message : "Unable to update roster."); if (sent) setUncertain(true); } }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  return <dialog ref={dialog} className={`roster-dialog${props.compact?" compact-clinic-roster":""}`} onCancel={e => { e.preventDefault(); if (!pending.current) props.onClose(); }}>
    <header><h3>{props.title} — roster</h3><button disabled={busy} onClick={props.onClose} aria-label="Close roster">×</button></header>
    <p>Enrolled: {roster?.enrolled_count ?? "—"} / {roster?.capacity ?? "—"} · Waitlisted: {roster?.waitlist_count ?? "—"}</p>
    {message && <p role="status">{message}</p>}<button disabled={busy || loading} onClick={() => { setMessage(null); setRemoving(null); void load(); }}>Refresh roster</button>
    {loading && <p role="status">Loading roster…</p>}
    <div className="full-roster-list">{roster?.participants.map(p => <div className="roster-row" key={p.enrollment_id}>
      <div><strong>{p.display_name || "Player"}</strong><PlayerInfoButton name={p.display_name} onClick={() => setSelected(rosterCard(p, props.clubId))} /><br /><small>{p.participant_type} · {p.status.replaceAll("_", " ")}{p.waitlist_position ? ` · Position ${p.waitlist_position}` : ""}</small></div>
      {editable && p.status !== "cancelled" && <button disabled={busy || loading || uncertain} onClick={() => setRemoving(p)}>Remove</button>}
    </div>)}{roster?.participants.length === 0 && <p>No registrations yet.</p>}</div>
    {removing && <div className="roster-confirm" role="group" aria-label="Confirm removal"><p>Remove {removing.display_name}? This cancels their enrollment and promotes a waitlisted player when applicable.</p><button disabled={busy || uncertain} onClick={() => void mutate("remove")}>Confirm removal</button><button disabled={busy} onClick={() => setRemoving(null)}>Keep player</button></div>}
    {editable && <details className="roster-add-participant" open={props.compact?undefined:true}><summary>Add participant</summary><form onSubmit={e => { e.preventDefault(); void mutate("add"); }}><h4>Add player</h4><fieldset disabled={busy || loading || uncertain}>
      <label>Participant type<select value={mode} onChange={e => setMode(e.target.value as "member" | "guest")}><option value="member">Member</option><option value="guest">Guest</option></select></label>
      {mode === "member" ? <><label>Find member<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Enter at least two letters" /></label>{searching && <p>Searching…</p>}{searchError && <p role="alert">{searchError}</p>}
        <label>Select member<select required value={memberId} onChange={e => setMemberId(e.target.value)}><option value="">Select a member</option>{members.filter(m => m.active !== false).map(m => <option key={m.id} value={m.id}>{displayPlayerName(m)}{m.email ? ` (${m.email})` : ""}</option>)}</select></label><p>Search results show up to 50 members. Refine the name if needed.</p></>
        : <><label>First name<input required value={first} onChange={e => setFirst(e.target.value)} /></label><label>Last name<input required value={last} onChange={e => setLast(e.target.value)} /></label><label>Email (optional)<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label><label>Phone (optional)<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label></>}
      {(mode==="guest"||memberId)&&<PricePreview clubId={props.clubId} userId={props.userId} bookingId={props.bookingId} memberIds={mode==="member"?[memberId]:[]} guestCount={mode==="guest"?1:0}/>}
      <button disabled={searching && mode === "member"}>Add player</button><p>When the clinic is full, the backend applies its waitlist rules.</p>
    </fieldset></form></details>}
    <footer><button disabled={busy} onClick={props.onClose}>Close roster</button></footer>
    {selected && <PlayerDetails player={selected} apiBase={props.apiBase} userId={props.userId} canReadMembers={props.canEdit} onClose={() => setSelected(null)} />}
  </dialog>;
}
