import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { createRequest } from "../lib/createActions";
import "./PlayerPicker.css";

export type PickedPlayer = { id: string; first_name: string; last_name: string };
type Props = { apiBase: string; clubId: string; userId: string; selected: PickedPlayer[]; onChange: (players: PickedPlayer[]) => void; max: number };
type Results = { key: string; rows: PickedPlayer[]; error?: string };

export function PlayerPicker(p: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Results | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const query = search.trim();
  const key = JSON.stringify([p.apiBase, p.clubId, p.userId, query]);
  const current = result?.key === key ? result : null;
  const searching = Boolean(query && !current);
  const available = (current?.rows ?? []).filter(m => !p.selected.some(s => s.id === m.id));
  const full = p.selected.length >= p.max;

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const auth = await supabase.auth.getSession();
        if (auth.error || auth.data.session?.user.id !== p.userId) throw new Error("Sign in again to find players.");
        const params = new URLSearchParams({ club_id: p.clubId, search: query, include_inactive: "false" });
        const data = await createRequest(p.apiBase, auth.data.session.access_token, `/members?${params}`, { signal: controller.signal });
        if (!Array.isArray(data)) throw new Error("Player search is unavailable.");
        const rows = (data as (PickedPlayer & {active?: boolean})[]).filter(m => m.active !== false);
        if (!cancelled) setResult({ key, rows });
      } catch (e) {
        if (!cancelled) setResult({ key, rows: [], error: e instanceof Error ? e.message : "Unable to find players." });
      }
    }, 250);
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [key, query, p.apiBase, p.clubId, p.userId]);

  function add(member: PickedPlayer) {
    if (full || p.selected.some(s => s.id === member.id)) return;
    p.onChange([...p.selected, member]);
    input.current?.focus();
  }
  function focusResult(index: number) {
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    if (buttons?.length) buttons[Math.max(0, Math.min(index, buttons.length - 1))].focus();
  }

  return <div className="player-picker">
    <label htmlFor={id}>Assign players</label>
    <input id={id} ref={input} type="search" autoComplete="off" value={search}
      placeholder="Type any part of a first or last name"
      aria-controls={`${id}-results`} aria-describedby={`${id}-hint`}
      onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); }}
      onKeyDown={e => {
        if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); focusResult(0); }
        if (e.key === "Enter") { e.preventDefault(); if (open && available[0]) add(available[0]); }
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); }
      }} />
    <p id={`${id}-hint`} className="player-picker-hint">{full ? `Player limit reached (${p.max}). Remove a player to select another.` : "Matches appear as you type. Scroll the list and select Add."}</p>
    {open && query && <div className="player-picker-dropdown">
      <p className="player-picker-hint" role="status">{searching ? "Searching members…" : current?.error ? "" : available.length ? `${available.length} matching players available` : "No unselected members match this name."}</p>
      {current?.error && <p className="player-picker-hint" role="alert">{current.error}</p>}
      <ul id={`${id}-results`} ref={list} className="player-picker-results" aria-label="Matching members" aria-busy={searching}>
        {available.map((member, index) => <li key={member.id}>
          <button type="button" className="player-picker-option" disabled={full}
            aria-label={`Add ${member.first_name} ${member.last_name}`} onClick={() => add(member)}
            onKeyDown={e => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); focusResult(index + (e.key === "ArrowDown" ? 1 : -1)); }
              if (e.key === "Home" || e.key === "End") { e.preventDefault(); focusResult(e.key === "Home" ? 0 : available.length - 1); }
              if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); input.current?.focus(); setOpen(false); }
            }}><span>{member.first_name} {member.last_name}</span><span className="player-picker-add">+ Add</span></button>
        </li>)}
      </ul>
      {(current?.rows.length ?? 0) >= 50 && <p className="player-picker-hint">Showing the first 50 matches. Type more letters to narrow the list.</p>}
    </div>}
    {p.selected.length > 0 && <ul className="player-picker-selected" aria-label="Selected players">
      {p.selected.map(member => <li key={member.id}><span>{member.first_name} {member.last_name}</span>
        <button type="button" aria-label={`Remove ${member.first_name} ${member.last_name}`} onClick={() => p.onChange(p.selected.filter(s => s.id !== member.id))}>Remove</button></li>)}
    </ul>}
  </div>;
}
