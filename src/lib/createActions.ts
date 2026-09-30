export type CreateKind = "booking" | "clinic" | "member";

export function canCreate(role: string | null) {
  return role !== null && ["owner", "director", "manager", "front_desk"].includes(role);
}

// A datetime-local value has no offset. Resolve against the selected location,
// never the staff computer's timezone. Reject DST gaps and repeated clock times.
export function locationTimeToIso(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a complete date and time.");
  const [, y, m, d, h, minute] = match.map(Number);
  const wall = Date.UTC(y, m - 1, d, h, minute);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const matches: number[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = wall + offset * 60_000;
    const parts = Object.fromEntries(formatter.formatToParts(candidate).map(p => [p.type, p.value]));
    if (`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` === value) matches.push(candidate);
  }
  if (!matches.length) throw new Error("That local time does not exist. Choose another time.");
  if (matches.length > 1) throw new Error("That time occurs twice when daylight saving ends. Choose an unambiguous time.");
  return new Date(matches[0]).toISOString();
}

export class CreateApiError extends Error {
  uncertain: boolean;
  constructor(message: string, uncertain = false) {
    super(message); this.uncertain = uncertain;
  }
}

export async function createRequest(
  apiBase: string, token: string, path: string,
  options: { payload?: unknown; signal?: AbortSignal; method?: "PATCH" } = {},
): Promise<Record<string, unknown> | unknown[]> {
  let response: Response;
  const writing = options.payload !== undefined;
  try {
    response = await fetch(`${apiBase.replace(/\/$/, "")}${path}`, {
      method: options.method ?? (writing ? "POST" : "GET"),
      headers: { Authorization: `Bearer ${token}`, ...(writing ? { "Content-Type": "application/json" } : {}) },
      body: writing ? JSON.stringify(options.payload) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new CreateApiError(writing
      ? "The save could not be confirmed. Close this form and check the list before trying again."
      : "Unable to load choices. Close this form and try again.", writing);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status >= 500) throw new CreateApiError(writing
      ? "The save could not be confirmed. Check the list before trying again."
      : "The service is temporarily unavailable.", writing);
    if (response.status === 401) throw new CreateApiError("Your session expired. Sign in again.");
    if (response.status === 403) throw new CreateApiError("You don't have permission to perform this action.");
    const detail = typeof body?.detail === "string" ? body.detail : null;
    throw new CreateApiError(detail || (response.status === 422
      ? "Please check the form values and try again." : "The request could not be completed."));
  }
  if (!body || typeof body !== "object") throw new CreateApiError(
    writing ? "The save response was incomplete. Check the list before trying again." : "Unexpected response while loading choices.", writing);
  return body;
}
