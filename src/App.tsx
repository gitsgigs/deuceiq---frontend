import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import "./App.css";
import { supabase } from "./lib/supabase";

type Section = "bookings" | "clinics" | "members";

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

const API_BASE = "http://127.0.0.1:8000";

const CLUB_ID =
  "0c7bb910-7918-4011-9993-f2836967ba5f";

function App() {
  const [section, setSection] =
    useState<Section>("bookings");

  const [session, setSession] =
    useState<Session | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loginLoading, setLoginLoading] =
    useState(false);

  const [loginError, setLoginError] =
    useState<string | null>(null);

  const [members, setMembers] =
    useState<Member[]>([]);

  const [memberSearch, setMemberSearch] =
    useState("");

  const [membersLoading, setMembersLoading] =
    useState(false);

  const [membersError, setMembersError] =
    useState<string | null>(null);

  // ============================================================
  // SUPABASE SESSION
  // ============================================================

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
      (_event, newSession) => {
        setSession(newSession);
        setAuthLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ============================================================
  // MEMBER SEARCH URL
  // ============================================================

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

  // ============================================================
  // LOAD MEMBERS
  // ============================================================

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
              method: "GET",
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
                "Content-Type":
                  "application/json",
              },
              signal: controller.signal,
            }
          );

          if (!response.ok) {
            let detail = "";

            try {
              const errorBody =
                await response.json();

              detail =
                typeof errorBody?.detail ===
                "string"
                  ? errorBody.detail
                  : "";
            } catch {
              // Ignore JSON parsing failures.
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

  // ============================================================
  // LOGIN
  // ============================================================

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

  // ============================================================
  // LOGOUT
  // ============================================================

  async function handleLogout() {
    await supabase.auth.signOut();

    setMembers([]);
    setMemberSearch("");
    setMembersError(null);
  }

  // ============================================================
  // AUTH LOADING
  // ============================================================

  if (authLoading) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <h1>DeuceIQ</h1>
          <p>Loading staff workspace...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // LOGIN SCREEN
  // ============================================================

  if (!session) {
    return (
      <div className="login-shell">
        <form
          className="login-card"
          onSubmit={handleLogin}
        >
          <div className="login-brand">
            <div className="brand-mark">D</div>

            <div>
              <h1>DeuceIQ</h1>
              <p>Staff Workspace</p>
            </div>
          </div>

          <div className="login-heading">
            <h2>Sign in</h2>

            <p>
              Use your DeuceIQ staff account.
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

          {loginError && (
            <div className="login-error">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            className="primary-button login-button"
            disabled={loginLoading}
          >
            {loginLoading
              ? "Signing in..."
              : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  // ============================================================
  // STAFF APP
  // ============================================================

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            D
          </div>

          <div>
            <h1>DeuceIQ</h1>
            <p>Montauk Tennis</p>
          </div>
        </div>

        <nav className="navigation">
          <button
            className={
              section === "bookings"
                ? "active"
                : ""
            }
            onClick={() =>
              setSection("bookings")
            }
          >
            Bookings
          </button>

          <button
            className={
              section === "clinics"
                ? "active"
                : ""
            }
            onClick={() =>
              setSection("clinics")
            }
          >
            Clinics
          </button>

          <button
            className={
              section === "members"
                ? "active"
                : ""
            }
            onClick={() =>
              setSection("members")
            }
          >
            Members
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="signed-in-user">
            <span>Signed in</span>

            <strong>
              {session.user.email ||
                "Staff user"}
            </strong>
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
              {section === "bookings" &&
                "Bookings"}

              {section === "clinics" &&
                "Clinics"}

              {section === "members" &&
                "Members"}
            </h2>
          </div>

          <button className="primary-button">
            + Create Booking
          </button>
        </header>

        {section === "bookings" && (
          <section>
            <div className="summary-grid">
              <div className="summary-card">
                <span>
                  Today's Bookings
                </span>
                <strong>0</strong>
              </div>

              <div className="summary-card">
                <span>Clinics</span>
                <strong>0</strong>
              </div>

              <div className="summary-card">
                <span>Waitlisted</span>
                <strong>0</strong>
              </div>

              <div className="summary-card">
                <span>Open Courts</span>
                <strong>11</strong>
              </div>
            </div>

            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h3>
                    Today's Schedule
                  </h3>

                  <p>
                    Bookings from DeuceIQ
                    will appear here.
                  </p>
                </div>
              </div>

              <div className="empty-state">
                <div className="empty-icon">
                  🎾
                </div>

                <h3>
                  No bookings loaded yet
                </h3>

                <p>
                  We will connect this
                  section to the bookings
                  API next.
                </p>
              </div>
            </div>
          </section>
        )}

        {section === "clinics" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>
                  Clinic Management
                </h3>

                <p>
                  Rosters, capacity and
                  waitlists will appear
                  here.
                </p>
              </div>
            </div>

            <div className="empty-state">
              <div className="empty-icon">
                📋
              </div>

              <h3>
                Clinic tools coming next
              </h3>

              <p>
                This will connect to the
                clinic endpoints we
                already built.
              </p>
            </div>
          </section>
        )}

        {section === "members" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Members</h3>

                <p>
                  Search the club database
                  by first or last name.
                </p>
              </div>

              <span className="member-count">
                {members.length} shown
              </span>
            </div>

            <div className="member-search">
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

            {membersLoading && (
              <div className="member-message">
                Loading members...
              </div>
            )}

            {membersError && (
              <div className="member-message error">
                {membersError}
              </div>
            )}

            {!membersLoading &&
              !membersError &&
              members.length === 0 && (
                <div className="empty-state compact">
                  <h3>
                    No members found
                  </h3>

                  <p>
                    Try another name or
                    clear the search.
                  </p>
                </div>
              )}

            {!membersLoading &&
              !membersError &&
              members.length > 0 && (
                <div className="member-list">
                  {members.map(
                    (member) => (
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
                            {
                              member.first_name
                            }{" "}
                            {
                              member.last_name
                            }
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
                    )
                  )}
                </div>
              )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;