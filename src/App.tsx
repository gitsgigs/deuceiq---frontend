import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import "./App.css";
import { supabase } from "./lib/supabase";

type Section =
  | "overview"
  | "calendar"
  | "bookings"
  | "clinics"
  | "members"
  | "pros"
  | "approvals" 
  | "opportunity"
  | "settings";

type Member = {
  id: string;
  club_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  membership_type: string | null;
  skill_level: string | null;
  active: boolean;
};
type Booking = {
  id: string;
  club_id: string;
  location_id: string;
  booking_series_id?: string | null;
  clinic_registration_capacity?: number | null;

  starts_at: string;
  ends_at: string;

  status?: string;
  source?: string;

  player_count?: number | null;
  revenue_total?: number | null;
  pro_cost_total?: number | null;

  notes?: string | null;

  court?: {
    id: string;
    name: string;
    surface?: string | null;
    location_id?: string;
    court_number?: number;
  } | null;

  pro?: {
    id: string;
    first_name?: string;
    last_name?: string;
  } | null;

  lesson_type?: {
    id: string;
    name?: string;
    category?: string;
    default_duration_minutes?: number;
  } | null;

  is_recurring?: boolean;
  booking_series_name?: string | null;

  outside_normal_pro_schedule?: boolean;
  schedule_warning?: string | null;

  outside_location_operating_hours?: boolean;
  operating_hours_warning?: string | null;
};
type RoleRequest = {
  id: string;
  club_id: string;
  user_id: string;
  requested_role: string;
  status: string;
  applicant_name: string | null;
  applicant_email: string;
  applicant_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

type BookingsResponse = {
  date: string | null;
  location_id: string | null;
  count: number;
  bookings: Booking[];
};
const API_BASE = "http://127.0.0.1:8000";

const CLUB_ID =
  "0c7bb910-7918-4011-9993-f2836967ba5f";

const LOCATION_ID =
  "2fb95b8c-73a7-464b-b825-1b9906dba718";

const navigationItems: {
  id: Section;
  label: string;
  icon: string;
}[] = [
  {
    id: "overview",
    label: "Overview",
    icon: "⌂",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: "▦",
  },
  {
    id: "bookings",
    label: "Bookings",
    icon: "◫",
  },
  {
    id: "clinics",
    label: "Clinics",
    icon: "◎",
  },
  {
    id: "members",
    label: "Members",
    icon: "♙",
  },
  {
    id: "pros",
    label: "Pros",
    icon: "♜",
  },
  {
  id: "approvals",
  label: "Approvals",
  icon: "✓",
  },
  {
    id: "opportunity",
    label: "Opportunity Center",
    icon: "✦",
  },
  {
    id: "settings",
    label: "Settings",
    icon: "⚙",
  },
];

function App() {
  const [section, setSection] =
    useState<Section>("overview");

  const [session, setSession] =
    useState<Session | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [passwordRecoveryMode, setPasswordRecoveryMode] =
  useState(false);

  const [newPassword, setNewPassword] =
    useState("");

  const [newPasswordConfirm, setNewPasswordConfirm] =
    useState("");

  const [passwordUpdateMessage, setPasswordUpdateMessage] =
    useState<string | null>(null);

  const [loginLoading, setLoginLoading] =
    useState(false);

  const [loginError, setLoginError] =
    useState<string | null>(null);
  const [resetMode, setResetMode] =
    useState(false);

  const [resetLoading, setResetLoading] =
    useState(false);

  const [resetMessage, setResetMessage] =
    useState<string | null>(null);

  const [forgotEmailMessage, setForgotEmailMessage] =
    useState(false);

  const [members, setMembers] =
    useState<Member[]>([]);

  const [memberSearch, setMemberSearch] =
    useState("");

  const [membersLoading, setMembersLoading] =
    useState(false);

  const [membersError, setMembersError] =
    useState<string | null>(null);
  
  const [bookings, setBookings] =
  useState<Booking[]>([]);

  const [roleRequests, setRoleRequests] =
  useState<RoleRequest[]>([]);

const [roleRequestsLoading, setRoleRequestsLoading] =
  useState(false);

const [roleRequestsError, setRoleRequestsError] =
  useState<string | null>(null);

const [bookingsLoading, setBookingsLoading] =
  useState(false);

const [bookingsError, setBookingsError] =
  useState<string | null>(null);
const [approvalActionId, setApprovalActionId] =
  useState<string | null>(null);

const [approvalActionError, setApprovalActionError] =
  useState<string | null>(null);

const [inviteMode, setInviteMode] =
useState(false);

const [inviteModeType, setInviteModeType] =
useState<"new" | "existing" | null>(null);

const [inviteToken, setInviteToken] =
  useState<string | null>(null);

const [invitePassword, setInvitePassword] =
  useState("");

const [invitePasswordConfirm, setInvitePasswordConfirm] =
  useState("");

const [inviteMessage, setInviteMessage] =
  useState<string | null>(null);

const [calendarDate, setCalendarDate] =
  useState(() => {
    const formatter = new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );

    const parts = formatter.formatToParts(
      new Date()
    );

    const year =
      parts.find(
        (part) => part.type === "year"
      )?.value ?? "";

    const month =
      parts.find(
        (part) => part.type === "month"
      )?.value ?? "";

    const day =
      parts.find(
        (part) => part.type === "day"
      )?.value ?? "";

    return `${year}-${month}-${day}`;
  });

  useEffect(() => {
  const url = new URL(window.location.href);

  if (url.pathname === "/invite") {
    setInviteMode(true);

    const token =
      url.searchParams.get("token");

    const mode =
      url.searchParams.get("mode");

    if (token) {
      setInviteToken(token);
    }

    if (
      mode === "new" ||
      mode === "existing"
    ) {
      setInviteModeType(mode);
    }
  }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted) {
        setSession(session);
        setAuthLoading(false);
      }
    }

    loadSession();

        const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setAuthLoading(false);

        if (event === "PASSWORD_RECOVERY") {
          const currentUrl = new URL(
            window.location.href
          );

          if (currentUrl.pathname === "/invite") {
            setInviteMode(true);
            setPasswordRecoveryMode(false);

            const token =
              currentUrl.searchParams.get(
                "token"
              );

            if (token) {
              setInviteToken(token);
            }

            return;
          }

          setPasswordRecoveryMode(true);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const memberSearchUrl = useMemo(() => {
    const params = new URLSearchParams({
      club_id: CLUB_ID,
    });

    if (memberSearch.trim()) {
      params.set(
        "search",
        memberSearch.trim()
      );
    }

    return `${API_BASE}/members?${params.toString()}`;
  }, [memberSearch]);

  useEffect(() => {
    if (
      section !== "members" ||
      !session?.access_token
    ) {
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(
      async () => {
        try {
          setMembersLoading(true);
          setMembersError(null);

          const response = await fetch(
            memberSearchUrl,
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
              signal: controller.signal,
            }
          );

          if (!response.ok) {
            let detail = "";

            try {
              const body = await response.json();

              detail =
                typeof body?.detail === "string"
                  ? body.detail
                  : "";
            } catch {
              // Ignore parsing error.
            }

            throw new Error(
              detail ||
                `Unable to load members. HTTP ${response.status}`
            );
          }

          const data: Member[] =
            await response.json();

          setMembers(data);
        } catch (error) {
          if (
            error instanceof DOMException &&
            error.name === "AbortError"
          ) {
            return;
          }

          setMembersError(
            error instanceof Error
              ? error.message
              : "Unable to load members."
          );
        } finally {
          setMembersLoading(false);
        }
      },
      250
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    section,
    memberSearchUrl,
    session?.access_token,
  ]);

  useEffect(() => {
  if (
    section !== "calendar" ||
    !session?.access_token
  ) {
    return;
  }


  const controller =
    new AbortController();

  async function loadBookings() {
    try {
      setBookingsLoading(true);
      setBookingsError(null);

      const params =
        new URLSearchParams({
          booking_date: calendarDate,
          location_id: LOCATION_ID,
        });

      const response = await fetch(
        `${API_BASE}/bookings?${params.toString()}`,
        {
          headers: {
            Authorization:
              `Bearer ${session?.access_token}`,
          },
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        let detail = "";

        try {
          const body =
            await response.json();

          detail =
            typeof body?.detail === "string"
              ? body.detail
              : "";
        } catch {
          // Ignore parsing errors.
        }

        throw new Error(
          detail ||
            `Unable to load bookings. HTTP ${response.status}`
        );
      }

      const data: BookingsResponse =
        await response.json();

      setBookings(data.bookings);

    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      setBookingsError(
        error instanceof Error
          ? error.message
          : "Unable to load bookings."
      );
    } finally {
      setBookingsLoading(false);
    }
  }

  loadBookings();

  return () => {
    controller.abort();
  };
}, [
  section,
  calendarDate,
  session?.access_token,
]);
useEffect(() => {
  if (
    section !== "approvals" ||
    !session?.access_token
  ) {
    return;
  }

  let cancelled = false;

  async function loadRoleRequests() {
    try {
      setRoleRequestsLoading(true);
      setRoleRequestsError(null);

      const { data, error } =
        await supabase
          .from("club_role_requests")
          .select("*")
          .eq("club_id", CLUB_ID)
          .eq("status", "pending")
          .order("created_at", {
            ascending: true,
          });

      if (error) {
        throw error;
      }

      if (!cancelled) {
        setRoleRequests(
          (data as RoleRequest[]) || []
        );
      }
    } catch (error) {
      if (!cancelled) {
        setRoleRequestsError(
          error instanceof Error
            ? error.message
            : "Unable to load approval requests."
        );
      }
    } finally {
      if (!cancelled) {
        setRoleRequestsLoading(false);
      }
    }
  }

  loadRoleRequests();

  return () => {
    cancelled = true;
  };
}, [
  section,
  session?.access_token,
]);
useEffect(() => {
  if (
    section !== "approvals" ||
    !session?.access_token
  ) {
    return;
  }

  let cancelled = false;

  async function loadRoleRequests() {
    try {
      setRoleRequestsLoading(true);
      setRoleRequestsError(null);

      const { data, error } =
        await supabase
          .from("club_role_requests")
          .select("*")
          .eq("club_id", CLUB_ID)
          .eq("status", "pending")
          .order("created_at", {
            ascending: true,
          });

      if (error) {
        throw error;
      }

      if (!cancelled) {
        setRoleRequests(
          (data as RoleRequest[]) || []
        );
      }
    } catch (error) {
      if (!cancelled) {
        setRoleRequestsError(
          error instanceof Error
            ? error.message
            : "Unable to load approval requests."
        );
      }
    } finally {
      if (!cancelled) {
        setRoleRequestsLoading(false);
      }
    }
  }

  loadRoleRequests();

  return () => {
    cancelled = true;
  };
}, [
  section,
  session?.access_token,
]);
async function handleRoleRequestDecision(
  requestId: string,
  decision: "approve" | "decline"
) {
  try {
    setApprovalActionId(requestId);
    setApprovalActionError(null);

    const functionName =
      decision === "approve"
        ? "approve_club_role_request"
        : "decline_club_role_request";

    const { error } = await supabase.rpc(
      functionName,
      {
        target_request_id: requestId,
        manager_note: null,
      }
    );

    if (error) {
      throw error;
    }

    setRoleRequests((current) =>
      current.filter(
        (request) =>
          request.id !== requestId
      )
    );
  } catch (error) {
    setApprovalActionError(
      error instanceof Error
        ? error.message
        : "Unable to process request."
    );
  } finally {
    setApprovalActionId(null);
  }
}
async function handlePasswordReset(
  event: React.FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  setResetLoading(true);
  setResetMessage(null);

  try {
    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo:
            "https://app.deuceiq.com/reset-password",
        }
      );

    if (error) {
      throw error;
    }

    setResetMessage(
      "Password reset email sent. Check your inbox."
    );
  } catch (error) {
    setResetMessage(
      error instanceof Error
        ? error.message
        : "Unable to send reset email."
    );
  } finally {
    setResetLoading(false);
  }
}
async function handleUpdatePassword(
  event: React.FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  setPasswordUpdateMessage(null);

  if (newPassword.length < 8) {
    setPasswordUpdateMessage(
      "Password must be at least 8 characters."
    );
    return;
  }

  if (newPassword !== newPasswordConfirm) {
    setPasswordUpdateMessage(
      "Passwords do not match."
    );
    return;
  }

  const { error } =
    await supabase.auth.updateUser({
      password: newPassword,
    });

  if (error) {
    setPasswordUpdateMessage(
      error.message
    );
    return;
  }

  setPasswordUpdateMessage(
    "Password updated successfully! Returning to login, Player"
  );

  setNewPassword("");
  setNewPasswordConfirm("");

  await supabase.auth.signOut();

  window.setTimeout(() => {
    setPasswordRecoveryMode(false);
    setPasswordUpdateMessage(null);

    window.history.replaceState(
      {},
      "",
      "/"
    );
  }, 1500);
}

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoginLoading(true);
    setLoginError(null);

    try {
      const { error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        throw error;
      }

      setPassword("");
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : "Unable to sign in."
      );
    } finally {
      setLoginLoading(false);
    }
  }
 async function handleInviteLogin(
  event: React.FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  setInviteMessage(null);

  const { error } =
    await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

  if (error) {
    setInviteMessage(error.message);
    return;
  }

  await handleAcceptInvitation();
}
async function handleInviteSetPassword(
  event: React.FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  setInviteMessage(null);

  if (!inviteToken) {
    setInviteMessage(
      "Invitation token is missing."
    );
    return;
  }

  if (invitePassword.length < 8) {
    setInviteMessage(
      "Password must be at least 8 characters."
    );
    return;
  }

  if (
    invitePassword !==
    invitePasswordConfirm
  ) {
    setInviteMessage(
      "Passwords do not match."
    );
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    setInviteMessage(
      "Your invitation session is not active. Please reopen the invitation email."
    );
    return;
  }

  const { error } =
    await supabase.auth.updateUser({
      password: invitePassword,
    });

  if (error) {
    setInviteMessage(error.message);
    return;
  }

  await handleAcceptInvitation();
}
async function handleAcceptInvitation() {
  if (!inviteToken) {
    setInviteMessage(
      "Invitation token is missing."
    );
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    setInviteMessage(
      "Please sign in or create your account first."
    );
    return;
  }

  const { data, error } =
    await supabase.rpc(
      "accept_club_invitation",
      {
        invitation_token: inviteToken,
      }
    );

  if (error) {
    setInviteMessage(error.message);
    return;
  }

  if (data?.status === "expired") {
    setInviteMessage(
      "This invitation has expired."
    );
    return;
  }

  setInviteMessage(
    "Invitation accepted. Welcome to DeuceIQ."
  );
  window.setTimeout(() => {
  setInviteMode(false);
  setInviteToken(null);

  window.history.replaceState(
    {},
    "",
    "/"
  );
}, 1200);
}

  async function handleLogout() {
    await supabase.auth.signOut();

    setMembers([]);
    setMemberSearch("");
    setMembersError(null);
  }

  if (authLoading) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-logo">
            DIQ
          </div>

          <h1>DeuceIQ</h1>

          <p>Loading staff workspace...</p>
        </div>
      </div>
    );
  }

  if (inviteMode) {
  if (inviteModeType === "existing") {
    return (
      <div className="login-shell">
        <form
          className="login-card"
          onSubmit={handleInviteLogin}
        >
          <div className="login-logo">
            DIQ
          </div>

          <div className="login-heading">
            <h1>Join DeuceIQ</h1>

            <p>
              Sign in to accept your club
              invitation.
            </p>
          </div>

          <label className="form-field">
            <span>Email</span>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              required
            />
          </label>

          <label className="form-field">
            <span>Password</span>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              required
            />
          </label>

          {inviteMessage && (
            <div className="login-help-message">
              {inviteMessage}
            </div>
          )}

          <button
            type="submit"
            className="primary-button login-button"
          >
            Sign in and accept invitation
          </button>
          <button
  type="button"
  className="login-back-button"
  onClick={async () => {
    setInviteMessage(null);

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo:
            "https://app.deuceiq.com/invite"
            + "?token="
            + encodeURIComponent(
                inviteToken ?? ""
              )
            + "&mode=existing",
        }
      );

    if (error) {
      setInviteMessage(error.message);
      return;
    }

    setInviteMessage(
      "Password setup email sent. Open it to continue your invitation."
    );
  }}
>
  Set or reset password
</button>
        </form>
      </div>
    );
  }
  

  return (
    <div className="login-shell">
      <form
        className="login-card"
        onSubmit={handleInviteSetPassword}
      >
        <div className="login-logo">
          DIQ
        </div>

        <div className="login-heading">
          <h1>Join DeuceIQ</h1>

          <p>
            Set a password to finish joining
            your club.
          </p>
        </div>

        <label className="form-field">
          <span>Create password</span>

          <input
            type="password"
            value={invitePassword}
            onChange={(event) =>
              setInvitePassword(
                event.target.value
              )
            }
            autoComplete="new-password"
            required
          />
        </label>

        <label className="form-field">
          <span>Confirm password</span>

          <input
            type="password"
            value={invitePasswordConfirm}
            onChange={(event) =>
              setInvitePasswordConfirm(
                event.target.value
              )
            }
            autoComplete="new-password"
            required
          />
        </label>

        {inviteMessage && (
          <div className="login-help-message">
            {inviteMessage}
          </div>
        )}

        <button
          type="submit"
          className="primary-button login-button"
        >
          Accept invitation
        </button>
      </form>
    </div>
  );
}

  if (passwordRecoveryMode) {
  return (
    <div className="login-shell">
      <form
        className="login-card"
        onSubmit={handleUpdatePassword}
      >
        <div className="login-logo">
          DIQ
        </div>

        <div className="login-heading">
          <h1>Set new password</h1>

          <p>
            Choose a new password for your
            DeuceIQ account.
          </p>
        </div>

        <label className="form-field">
          <span>New password</span>

          <input
            type="password"
            value={newPassword}
            onChange={(event) =>
              setNewPassword(event.target.value)
            }
            autoComplete="new-password"
            required
          />
        </label>

        <label className="form-field">
          <span>Confirm new password</span>

          <input
            type="password"
            value={newPasswordConfirm}
            onChange={(event) =>
              setNewPasswordConfirm(
                event.target.value
              )
            }
            autoComplete="new-password"
            required
          />
        </label>

        {passwordUpdateMessage && (
          <div className="login-help-message">
            {passwordUpdateMessage}
          </div>
        )}

        <button
          type="submit"
          className="primary-button login-button"
        >
          Update password
        </button>
      </form>
    </div>
  );
}

  if (!session) {
    return (
      <div className="login-shell">
                  <form
            className="login-card"
            onSubmit={
              resetMode
                ? handlePasswordReset
                : handleLogin
            }
          >
            <div className="login-logo">
              DIQ
            </div>

            <div className="login-heading">
              <h1>DeuceIQ</h1>

              <p>
                {resetMode
                  ? "Reset your password."
                  : "Tennis intelligence for club management."}
              </p>
            </div>

            <label className="form-field">
              <span>Email</span>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="staff@example.com"
                autoComplete="email"
                required
              />
            </label>

            {!resetMode && (
              <label className="form-field">
                <span>Password</span>

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                />
              </label>
            )}

            {!resetMode && (
              <div className="login-help-row">
                <button
                  type="button"
                  className="login-link"
                  onClick={() => {
                    setResetMode(true);
                    setLoginError(null);
                    setResetMessage(null);
                  }}
                >
                  Forgot password?
                </button>

                <button
                  type="button"
                  className="login-link"
                  onClick={() =>
                    setForgotEmailMessage(
                      (current) => !current
                    )
                  }
                >
                  Forgot email?
                </button>
              </div>
            )}

            {forgotEmailMessage &&
              !resetMode && (
                <div className="login-help-message">
                  Contact your club manager or
                  DeuceIQ support to confirm the
                  email associated with your account.
                </div>
              )}

            {loginError && !resetMode && (
              <div className="login-error">
                {loginError}
              </div>
            )}

            {resetMessage && (
              <div className="login-help-message">
                {resetMessage}
              </div>
            )}

            <button
              type="submit"
              className="primary-button login-button"
              disabled={
                resetMode
                  ? resetLoading
                  : loginLoading
              }
            >
              {resetMode
                ? resetLoading
                  ? "Sending..."
                  : "Send reset email"
                : loginLoading
                  ? "Signing in..."
                  : "Sign in"}
            </button>

            {resetMode && (
              <button
                type="button"
                className="login-back-button"
                onClick={() => {
                  setResetMode(false);
                  setResetMessage(null);
                }}
              >
                Back to sign in
              </button>
            )}
          </form>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            DIQ
          </div>

          <div className="brand-copy">
            <h1>DeuceIQ</h1>
            <p>Montauk Tennis</p>
          </div>
        </div>

        <div className="sidebar-label">
          MANAGEMENT
        </div>

        <nav className="navigation">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                section === item.id
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() =>
                setSection(item.id)
              }
            >
              <span className="nav-icon">
                {item.icon}
              </span>

              <span>
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">
              {session.user.email
                ?.charAt(0)
                .toUpperCase() || "S"}
            </div>

            <div className="user-copy">
              <span>Signed in</span>

              <strong>
                {session.user.email ||
                  "Staff User"}
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              MONTAUK TENNIS
            </p>

            <h2>
              {
                navigationItems.find(
                  (item) =>
                    item.id === section
                )?.label
              }
            </h2>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="secondary-button"
            >
              View Court Sheet
            </button>

            <button
              type="button"
              className="primary-button"
            >
              + Create Booking
            </button>
          </div>
        </header>

        {section === "overview" && (
          <OverviewPage />
        )}

        {section === "calendar" && (
          <CalendarPage 
            bookings={bookings}
            loading={bookingsLoading}
            error={bookingsError}
            calendarDate={calendarDate}
            setCalendarDate={setCalendarDate}
          />
        )}

        {section === "bookings" && (
          <PlaceholderPage
            title="Bookings"
            description="Create, edit and manage lessons, rentals and recurring bookings."
          />
        )}

        {section === "clinics" && (
          <PlaceholderPage
            title="Clinics"
            description="Manage clinic rosters, court capacity, registrations and waitlists."
          />
        )}

        {section === "members" && (
          <MembersPage
            members={members}
            memberSearch={memberSearch}
            setMemberSearch={
              setMemberSearch
            }
            loading={membersLoading}
            error={membersError}
          />
        )}

        {section === "pros" && (
          <PlaceholderPage
            title="Pros"
            description="Manage schedules, location assignments, compensation and availability."
          />
        )}
        {section === "approvals" && (
          <ApprovalsPage
            requests={roleRequests}
            loading={roleRequestsLoading}
            error={
              roleRequestsError ||
              approvalActionError
            }
            actionId={approvalActionId}
            onDecision={
              handleRoleRequestDecision
            }
          />
        )}

        {section === "opportunity" && (
          <PlaceholderPage
            title="Opportunity Center"
            description="Surface openings, member opportunities and intelligent recommendations."
          />
        )}

        {section === "settings" && (
          <PlaceholderPage
            title="Settings"
            description="Manage locations, courts, club rules, pricing and staff configuration."
          />
        )}
      </main>
    </div>
  );
}


function OverviewPage() {
  return (
    <section className="overview">
      <div className="overview-grid">
        <div className="weather-card">
          <div className="card-heading">
            <div>
              <p className="card-kicker">
                WEATHER MONITOR
              </p>

              <h3>
                Montauk, New York
              </h3>
            </div>

            <span className="weather-status">
              Outdoor Play
            </span>
          </div>

          <div className="weather-main">
            <div className="weather-temp">
              72°
            </div>

            <div className="weather-description">
              <strong>
                Partly cloudy
              </strong>

              <span>
                Court conditions look
                favorable
              </span>
            </div>
          </div>

          <div className="weather-details">
            <div>
              <span>Rain</span>
              <strong>12%</strong>
            </div>

            <div>
              <span>Wind</span>
              <strong>9 mph</strong>
            </div>

            <div>
              <span>Humidity</span>
              <strong>61%</strong>
            </div>

            <div>
              <span>Sunset</span>
              <strong>7:24 PM</strong>
            </div>
          </div>

          <div className="weather-note">
            Weather data will be connected
            to the live weather service in
            the next pass.
          </div>
        </div>

        <div className="quick-actions-card">
          <div className="card-heading">
            <div>
              <p className="card-kicker">
                QUICK ACTIONS
              </p>

              <h3>
                Start something
              </h3>
            </div>
          </div>

          <div className="quick-actions">
            <button>
              <span>＋</span>
              Create Booking
            </button>

            <button>
              <span>◎</span>
              Create Clinic
            </button>

            <button>
              <span>♙</span>
              Add Member
            </button>

            <button>
              <span>▦</span>
              View Calendar
            </button>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard
          label="Today's Bookings"
          value="0"
          detail="Scheduled"
        />

        <MetricCard
          label="Clinics"
          value="0"
          detail="Active today"
        />

        <MetricCard
          label="Waitlisted"
          value="0"
          detail="Players waiting"
        />

        <MetricCard
          label="Open Courts"
          value="11"
          detail="Available now"
        />
      </div>

      <div className="schedule-card">
        <div className="card-heading schedule-heading">
          <div>
            <p className="card-kicker">
              CLUB SCHEDULE
            </p>

            <h3>
              Today's Court Activity
            </h3>
          </div>

          <button
            type="button"
            className="secondary-button"
          >
            Open Full Calendar
          </button>
        </div>

        <div className="schedule-placeholder">
          <div className="time-column">
            <span>8 AM</span>
            <span>10 AM</span>
            <span>12 PM</span>
            <span>2 PM</span>
            <span>4 PM</span>
            <span>6 PM</span>
          </div>

          <div className="court-grid">
            {[
              "Court 1",
              "Court 2",
              "Court 3",
              "Court 4",
            ].map((court) => (
              <div
                className="court-column"
                key={court}
              >
                <strong>
                  {court}
                </strong>

                <div className="court-slot"></div>
                <div className="court-slot booked">
                  Private
                </div>
                <div className="court-slot"></div>
                <div className="court-slot clinic">
                  Clinic
                </div>
                <div className="court-slot"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CalendarPage({
  bookings,
  loading,
  error,
  calendarDate,
  setCalendarDate,
}: {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  calendarDate: string;
  setCalendarDate: (date: string) => void;
}) {
  const courts = [
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "H7",
    "H8",
    "H9",
    "H10",
    "H11",
  ];

  const timeSlots: string[] = [];

  for (let hour = 6; hour <= 18; hour++) {
    timeSlots.push(
      String(hour).padStart(2, "0") + ":00"
    );

    if (hour < 18) {
      timeSlots.push(
        String(hour).padStart(2, "0") + ":30"
      );
    }
  }

  function changeDate(days: number) {
    const date = new Date(
      calendarDate + "T12:00:00"
    );

    date.setDate(
      date.getDate() + days
    );

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    setCalendarDate(
      year + "-" + month + "-" + day
    );
  }

  function formatTime(
    isoString: string
  ) {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).format(
      new Date(isoString)
    );
  }

  function getBookingForCell(
    courtName: string,
    slot: string
  ) {
    return bookings.find(
      (booking) => {
        if (
          booking.court?.name !==
          courtName
        ) {
          return false;
        }

        const start =
          formatTime(
            booking.starts_at
          );

        const end =
          formatTime(
            booking.ends_at
          );

        return (
          slot >= start &&
          slot < end
        );
      }
    );
  }

  function getBookingClass(
    booking: Booking
  ) {
    const category =
      booking.lesson_type
        ?.category;

    if (category === "clinic") {
      return "calendar-booking clinic-booking";
    }

    if (
      category ===
      "semi_private"
    ) {
      return "calendar-booking semi-booking";
    }

    if (category === "rental") {
      return "calendar-booking rental-booking";
    }

    if (booking.is_recurring) {
      return "calendar-booking recurring-booking";
    }

    return "calendar-booking private-booking";
  }

  function getProName(
    booking: Booking
  ) {
    return [
      booking.pro?.first_name,
      booking.pro?.last_name,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return (
    <section className="schedule-card full-calendar">
      <div className="card-heading calendar-header">
        <div>
          <p className="card-kicker">
            COURT SHEET
          </p>

          <h3>
            Daily Calendar
          </h3>
        </div>

        <div className="calendar-controls">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              changeDate(-1)
            }
          >
            ←
          </button>

          <input
            type="date"
            value={calendarDate}
            onChange={(event) =>
              setCalendarDate(
                event.target.value
              )
            }
          />

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              changeDate(1)
            }
          >
            →
          </button>
        </div>
      </div>

      {loading && (
        <div className="calendar-message">
          Loading court schedule...
        </div>
      )}

      {error && (
        <div className="calendar-message error">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="court-sheet-scroll">
          <div
            className="court-sheet-grid"
            style={{
              gridTemplateColumns:
                "72px repeat(" +
                courts.length +
                ", minmax(120px, 1fr))",
            }}
          >
            <div className="court-sheet-corner">
              Time
            </div>

            {courts.map((court) => (
              <div
                key={court}
                className="court-header-cell"
              >
                {court}
              </div>
            ))}

            {timeSlots.map((slot) => (
              <div
                key={slot}
                className="court-sheet-row"
                style={{
                  display: "contents",
                }}
              >
                <div className="time-cell">
                  {new Date(
                    "2026-01-01T" +
                      slot +
                      ":00"
                  ).toLocaleTimeString(
                    "en-US",
                    {
                      hour: "numeric",
                      minute: "2-digit",
                    }
                  )}
                </div>

                {courts.map(
                  (court) => {
                    const booking =
                      getBookingForCell(
                        court,
                        slot
                      );

                    if (!booking) {
                      return (
                        <div
                          key={
                            court +
                            "-" +
                            slot
                          }
                          className="court-cell open-cell"
                        >
                          <span>
                            Open
                          </span>
                        </div>
                      );
                    }

                    const start =
                      formatTime(
                        booking.starts_at
                      );

                    if (
                      start !== slot
                    ) {
                      return (
                        <div
                          key={
                            court +
                            "-" +
                            slot
                          }
                          className="court-cell booking-continuation"
                        />
                      );
                    }

                    return (
                      <div
                        key={
                          court +
                          "-" +
                          slot
                        }
                        className="court-cell"
                      >
                        <div
                          className={
                            getBookingClass(
                              booking
                            )
                          }
                        >
                          <strong>
                            {booking
                              .lesson_type
                              ?.name ||
                              "Booking"}
                          </strong>

                          <span>
                            {getProName(
                              booking
                            ) ||
                              "No pro"}
                          </span>

                          <small>
                            {new Date(
                              booking.starts_at
                            ).toLocaleTimeString(
                              "en-US",
                              {
                                timeZone:
                                  "America/New_York",
                                hour:
                                  "numeric",
                                minute:
                                  "2-digit",
                              }
                            )}

                            {" - "}

                            {new Date(
                              booking.ends_at
                            ).toLocaleTimeString(
                              "en-US",
                              {
                                timeZone:
                                  "America/New_York",
                                hour:
                                  "numeric",
                                minute:
                                  "2-digit",
                              }
                            )}
                          </small>

                          {booking.is_recurring && (
                            <em>
                              Recurring
                            </em>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric-card">
      <span>{label}</span>

      <strong>{value}</strong>

      <small>{detail}</small>
    </div>
  );
}

function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="placeholder-card">
      <p className="card-kicker">
        DEUCEIQ
      </p>

      <h3>{title}</h3>

      <p>{description}</p>

      <div className="placeholder-orbit">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </section>
  );
}

function MembersPage({
  members,
  memberSearch,
  setMemberSearch,
  loading,
  error,
}: {
  members: Member[];
  memberSearch: string;
  setMemberSearch: (
    value: string
  ) => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="members-card">
      <div className="card-heading">
        <div>
          <p className="card-kicker">
            CLUB DATABASE
          </p>

          <h3>Members</h3>

          <p className="card-description">
            Search players by first or
            last name.
          </p>
        </div>

        <span className="member-count">
          {members.length} shown
        </span>
      </div>

      <div className="member-search">
        <span>⌕</span>

        <input
          type="text"
          value={memberSearch}
          onChange={(event) =>
            setMemberSearch(
              event.target.value
            )
          }
          placeholder="Search members..."
        />
      </div>

      {loading && (
        <div className="member-message">
          Loading members...
        </div>
      )}

      {error && (
        <div className="member-message error">
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        members.length === 0 && (
          <div className="empty-state">
            No members found.
          </div>
        )}

      {!loading &&
        !error &&
        members.length > 0 && (
          <div className="member-list">
            {members.map((member) => (
              <button
                type="button"
                className="member-row"
                key={member.id}
              >
                <div className="member-avatar">
                  {member.first_name
                    .charAt(0)
                    .toUpperCase()}

                  {member.last_name
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="member-main">
                  <strong>
                    {member.first_name}{" "}
                    {member.last_name}
                  </strong>

                  <span>
                    {member.email ||
                      "No email"}
                  </span>
                </div>

                <div className="member-meta">
                  <span>
                    {member.membership_type ||
                      "No membership type"}
                  </span>

                  <span>
                    {member.skill_level
                      ? `Level ${member.skill_level}`
                      : "No level"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
    </section>
  );
}
function ApprovalsPage({
  requests,
  loading,
  error,
  actionId,
  onDecision,
}: {
  requests: RoleRequest[];
  loading: boolean;
  error: string | null;
  actionId: string | null;
  onDecision: (
    requestId: string,
    decision: "approve" | "decline"
  ) => Promise<void>;
}) {
  return (
    <section className="members-card">
      <div className="card-heading">
        <div>
          <p className="card-kicker">
            ACCESS CONTROL
          </p>

          <h3>
            Pending Approvals
          </h3>

          <p className="card-description">
            Review new account requests
            before granting club access.
          </p>
        </div>

        <span className="member-count">
          {requests.length} pending
        </span>
      </div>

      {loading && (
        <div className="member-message">
          Loading approval requests...
        </div>
      )}

      {error && (
        <div className="member-message error">
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        requests.length === 0 && (
          <div className="approval-empty">
            <div className="approval-empty-icon">
              ✓
            </div>

            <h3>
              No pending requests
            </h3>

            <p>
              New pro, member, or guest
              requests will appear here.
            </p>
          </div>
        )}

      {!loading &&
        !error &&
        requests.length > 0 && (
          <div className="approval-list">
            {requests.map(
              (request) => (
                <div
                  key={request.id}
                  className="approval-card"
                >
                  <div className="approval-person">
                    <div className="approval-avatar">
                      {request.applicant_name
                        ?.charAt(0)
                        .toUpperCase() ||
                        request.applicant_email
                          .charAt(0)
                          .toUpperCase()}
                    </div>

                    <div>
                      <strong>
                        {request.applicant_name ||
                          "Unnamed applicant"}
                      </strong>

                      <span>
                        {request.applicant_email}
                      </span>
                    </div>
                  </div>

                  <div className="approval-details">
                    <div>
                      <span>
                        Requested role
                      </span>

                      <strong>
                        {request.requested_role}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Requested
                      </span>

                      <strong>
                        {new Date(
                          request.created_at
                        ).toLocaleDateString()}
                      </strong>
                    </div>
                  </div>

                  {request.applicant_note && (
                    <div className="approval-note">
                      <span>
                        Applicant note
                      </span>

                      <p>
                        {request.applicant_note}
                      </p>
                    </div>
                  )}

                  <div className="approval-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        actionId === request.id
                      }
                      onClick={() =>
                        onDecision(
                          request.id,
                          "decline"
                        )
                      }
                    >
                      {actionId === request.id
                        ? "Processing..."
                        : "Decline"}
                    </button>

                    <button
                      type="button"
                      className="primary-button"
                      disabled={
                        actionId === request.id
                      }
                      onClick={() =>
                        onDecision(
                          request.id,
                          "approve"
                        )
                      }
                    >
                      {actionId === request.id
                        ? "Processing..."
                        : "Accept"}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
    </section>
  );
}

export default App;