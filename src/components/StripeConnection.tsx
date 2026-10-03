import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import "./StripeConnection.css";

type Props = { apiBase: string; userId: string; clubId: string; role: string };
type Status = { mode: "test" | "live"; state: "not_connected" | "incomplete" | "needs_information" | "ready"; collection_enabled: boolean };
async function call(p: Props, body?: {accept_fee_policy: boolean}, signal?: AbortSignal) {
  const {data, error} = await supabase.auth.getSession();
  if (error || data.session?.user.id !== p.userId) throw new Error("Your session changed. Sign in again.");
  const route = body ? "onboarding" : "status";
  const response = await fetch(`${p.apiBase.replace(/\/$/, "")}/payments/connect/${route}?club_id=${encodeURIComponent(p.clubId)}`, {
    method: body ? "POST" : "GET", cache: "no-store", signal,
    headers: {Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json"},
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 404 ? "Stripe connection setup is not deployed yet." : typeof result.detail === "string" ? result.detail : "Stripe is temporarily unavailable.");
  if (!["test","live"].includes(result.mode)) throw new Error("Payment mode could not be confirmed.");
  return result;
}

export function StripeConnection(p: Props) {
  const [status, setStatus] = useState<Status | null>(null), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0), [busy, setBusy] = useState(false), [accepted, setAccepted] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    if (p.role !== "owner" || !p.clubId) return;
    const controller = new AbortController(); setStatus(null); setError(""); setAccepted(false);
    call(p, undefined, controller.signal).then(result => {
      if (!["not_connected", "incomplete", "needs_information", "ready"].includes(result.state) || typeof result.collection_enabled !== "boolean") throw new Error("Stripe status could not be confirmed.");
      if (!controller.signal.aborted) setStatus(result);
    }).catch(e => {if (!controller.signal.aborted) setError(e.message);});
    return () => controller.abort();
  }, [p.apiBase, p.userId, p.clubId, p.role, refresh]);
  if (p.role !== "owner") return null;
  const labels = {not_connected: "Not connected", incomplete: "Setup started", needs_information: "Complete Stripe setup", ready: "Account ready"};
  return <article className="stripe-connection">
    <div className="stripe-connection-heading"><h4>Club payments</h4><span>{status?.mode === "live" ? "Live connection" : "Test mode"}</span></div>
    <p>{status ? labels[status.state] : error ? "Connection unavailable" : "Checking Stripe connection..."}</p>
    <p>Connect your club's Stripe account. DeuceIQ's fee is $1 per successful payment and is retained after full or partial refunds. Stripe charges its fees separately to your club.</p>
    <p className="stripe-connection-note">{status?.mode === "live" ? status.collection_enabled ? "Live collection is enabled. Members must authorize their card before staff can charge it." : "Live collection has not been activated yet. Complete the payment deployment steps first." : "Test mode: card setup and payments use test data only. No real money moves."}</p>
    {status?.state === "not_connected" && <label className="stripe-fee-consent"><input type="checkbox" checked={accepted} disabled={busy} onChange={e => setAccepted(e.target.checked)} />I acknowledge the DeuceIQ fee policy for this club.</label>}
    <div className="stripe-connection-actions">
      {status && status.state !== "ready" && <button disabled={busy || (status.state === "not_connected" && !accepted)} onClick={async () => {
        if (pending.current) return; pending.current = true; setBusy(true); setError("");
        try {
          const result = await call(p, {accept_fee_policy: accepted});
          const url = new URL(result.url);
          if (url.protocol !== "https:" || !["connect.stripe.com", "accounts.stripe.com"].includes(url.hostname) || url.username || url.password) throw new Error("Stripe address could not be verified.");
          window.location.assign(url.href);
        } catch (e) {setError(e instanceof Error ? e.message : "Stripe could not be opened.");}
        finally {pending.current = false; setBusy(false);}
      }}>{busy ? "Opening Stripe..." : status.state === "not_connected" ? "Connect Stripe" : "Continue Stripe setup"}</button>}
      <button disabled={busy} onClick={() => setRefresh(v => v + 1)}>Refresh connection</button>
    </div>
    {error && <p role="alert">{error}</p>}
  </article>;
}
