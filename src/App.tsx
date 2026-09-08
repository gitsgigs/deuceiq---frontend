import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import "./App.css";
import { supabase } from "./lib/supabase";

type ClubUser = { club_id: string; user_id: string; role: string; active: boolean };
type Club = { id: string; name: string };
type Location = { id: string; club_id: string; name: string };
type Court = {
  id: string;
  location_id: string;
  name: string;
  surface?: string | null;
  court_number?: number | null;
  active?: boolean;
};

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
  pro?: { id: string; first_name?: string; last_name?: string } | null;
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

type MemberClinic = {
  booking_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  location_id: string | null;
  location_name: string | null;
  pro_id: string | null;
  pro_name: string | null;
  capacity: number;
  enrolled_count: number;
  spots_remaining: number;
  waitlist_count: number;
  is_full: boolean;
  registration_status: "open" | "waitlist";
};

type MemberClinicsResponse = { count: number; clinics: MemberClinic[] };

const API_BASE = import.meta.env.VITE_API_BASE || "https://api.deuceiq.com";
const DEFAULT_SIGNUP_CLUB_ID =
  import.meta.env.VITE_DEFAULT_SIGNUP_CLUB_ID || "";

const navigationItems: {
  id: Section;
  label: string;
  icon: string;
  roles: string[];
}[] = [
  { id: "overview", label: "Overview", icon: "⌂", roles: ["owner", "director", "manager", "front_desk", "pro", "member"] },
  { id: "calendar", label: "Calendar", icon: "▦", roles: ["owner", "director", "manager", "front_desk", "pro"] },
  { id: "bookings", label: "Bookings", icon: "◫", roles: ["owner", "director", "manager", "front_desk", "member"] },
  { id: "clinics", label: "Clinics", icon: "◎", roles: ["owner", "director", "manager", "front_desk", "member"] },
  { id: "members", label: "Members", icon: "♙", roles: ["owner", "director", "manager", "front_desk"] },
  { id: "pros", label: "Pros", icon: "♜", roles: ["owner", "director", "manager", "front_desk", "pro", "member"] },
  { id: "approvals", label: "Approvals", icon: "✓", roles: ["owner", "director", "manager"] },
  { id: "opportunity", label: "Opportunity Center", icon: "✦", roles: ["owner", "director", "manager"] },
  { id: "settings", label: "Settings", icon: "⚙", roles: ["owner", "director", "manager"] },
];

function getTodayInNewYork() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

function App() {
  const [section, setSection] = useState<Section>("overview");
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [clubMemberships, setClubMemberships] = useState<ClubUser[]>([]);
  const [currentClubId, setCurrentClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState("DeuceIQ Club");
  const [clubRoleLoading, setClubRoleLoading] = useState(false);
  const [clubRoleError, setClubRoleError] = useState<string | null>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordUpdateMessage, setPasswordUpdateMessage] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [forgotEmailMessage, setForgotEmailMessage] = useState(false);

  const [signupMode, setSignupMode] = useState(false);
  const [signupFirstName, setSignupFirstName] = useState("");
  const [signupLastName, setSignupLastName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupMessage, setSignupMessage] = useState<string | null>(null);

  const [inviteMode, setInviteMode] = useState(false);
  const [inviteModeType, setInviteModeType] = useState<"new" | "existing" | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invitePassword, setInvitePassword] = useState("");
  const [invitePasswordConfirm, setInvitePasswordConfirm] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([]);
  const [roleRequestsLoading, setRoleRequestsLoading] = useState(false);
  const [roleRequestsError, setRoleRequestsError] = useState<string | null>(null);
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null);
  const [approvalActionError, setApprovalActionError] = useState<string | null>(null);

  const [availableClinics, setAvailableClinics] = useState<MemberClinic[]>([]);
  const [availableClinicsLoading, setAvailableClinicsLoading] = useState(false);
  const [availableClinicsError, setAvailableClinicsError] = useState<string | null>(null);

  const [calendarDate, setCalendarDate] = useState(() => getTodayInNewYork());

  const signupClubId = useMemo(() => {
    const url = new URL(window.location.href);
    return url.searchParams.get("club_id") || DEFAULT_SIGNUP_CLUB_ID;
  }, []);

  const currentMembership = useMemo(
    () => clubMemberships.find((membership) => membership.club_id === currentClubId) ?? null,
    [clubMemberships, currentClubId]
  );

  const clubRole = currentMembership?.role ?? null;

  const visibleNavigationItems = useMemo(
    () =>
      navigationItems.filter(
        (item) => clubRole !== null && item.roles.includes(clubRole)
      ),
    [clubRole]
  );

  const canManageBookings =
    clubRole !== null &&
    ["owner", "director", "manager", "front_desk"].includes(clubRole);

  const canViewCourtSheet =
    clubRole !== null &&
    ["owner", "director", "manager", "front_desk", "pro"].includes(clubRole);


  useEffect(() => {
    const url = new URL(window.location.href);

    if (url.pathname === "/invite") {
      setInviteMode(true);

      const token = url.searchParams.get("token");
      const mode = url.searchParams.get("mode");

      if (token) {
        setInviteToken(token);
      }

      if (mode === "new" || mode === "existing") {
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
          const currentUrl = new URL(window.location.href);

          if (currentUrl.pathname === "/invite") {
            setInviteMode(true);
            setPasswordRecoveryMode(false);

            const token = currentUrl.searchParams.get("token");

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

  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    const userId =
      session.user.id;

    const metadata = session.user.user_metadata;

    if (metadata?.signup_intent !== "member") {
      return;
    }

    const targetClubId = metadata?.signup_club_id;

    if (typeof targetClubId !== "string" || !targetClubId) {
      return;
    }

    const sessionEmail = session.user.email ?? "";
    let cancelled = false;

    async function finishMemberSignup() {
      try {
        const firstName =
          typeof metadata.first_name === "string" ? metadata.first_name : "";

        const lastName =
          typeof metadata.last_name === "string" ? metadata.last_name : "";

        const applicantName = [firstName.trim(), lastName.trim()]
          .filter(Boolean)
          .join(" ");

        const { data: existingAccess, error: accessError } =
          await supabase
            .from("club_users")
            .select("club_id,role,active")
            .eq("user_id", userId)
            .eq("club_id", targetClubId)
            .eq("active", true)
            .maybeSingle();

        if (accessError) {
          throw accessError;
        }

        if (!existingAccess) {
          const { error } =
            await supabase.rpc(
              "request_member_access",
              {
                target_club_id:
                  targetClubId,
                applicant_name:
                  applicantName,
                applicant_email:
                  sessionEmail,
                applicant_note: null,
              }
            );

          if (error) {
            throw error;
          }
        }

        const { error: metadataError } =
          await supabase.auth.updateUser({
            data: {
              signup_intent: "complete",
            },
          });

        if (metadataError) {
          throw metadataError;
        }

        if (!cancelled) {
          setSignupMessage(
            "Your member request has been sent to the club for approval."
          );
        }
      } catch (error) {
        if (!cancelled) {
          setSignupMessage(
            error instanceof Error
              ? error.message
              : "Unable to finish member signup."
          );
        }
      }
    }

    finishMemberSignup();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) {
      setClubMemberships([]);
      setCurrentClubId(null);
      setClubRoleError(null);
      return;
    }

    const userId = session.user.id;
    let cancelled = false;

    async function loadMemberships() {
      try {
        setClubRoleLoading(true);
        setClubRoleError(null);

        const { data, error } = await supabase
          .from("club_users")
          .select("club_id,user_id,role,active")
          .eq("user_id", userId)
          .eq("active", true);

        if (error) {
          throw error;
        }

        if (cancelled) {
          return;
        }

        const memberships = (data as ClubUser[]) || [];
        setClubMemberships(memberships);

        const savedClubId = window.localStorage.getItem(
          "deuceiq_current_club_id"
        );

        const savedIsValid =
          savedClubId !== null &&
          memberships.some(
            (membership) => membership.club_id === savedClubId
          );

        const nextClubId = savedIsValid
          ? savedClubId
          : memberships[0]?.club_id ?? null;

        setCurrentClubId(nextClubId);
      } catch (error) {
        if (!cancelled) {
          setClubMemberships([]);
          setCurrentClubId(null);

          setClubRoleError(
            error instanceof Error
              ? error.message
              : "Unable to load club access."
          );
        }
      } finally {
        if (!cancelled) {
          setClubRoleLoading(false);
        }
      }
    }

    loadMemberships();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!currentClubId) {
      setClubName("DeuceIQ Club");
      return;
    }

    let cancelled = false;

    async function loadClub() {
      try {
        const { data, error } = await supabase
          .from("clubs")
          .select("id,name")
          .eq("id", currentClubId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!cancelled) {
          const club = data as Club | null;
          setClubName(club?.name ?? "DeuceIQ Club");
        }
      } catch {
        if (!cancelled) {
          setClubName("DeuceIQ Club");
        }
      }
    }

    loadClub();

    return () => {
      cancelled = true;
    };
  }, [currentClubId]);

  useEffect(() => {
    if (!session?.access_token || !currentClubId) {
      setLocations([]);
      setCurrentLocationId(null);
      return;
    }

    const accessToken =
      session.access_token;

    const clubId =
      currentClubId;

    const controller = new AbortController();

    async function loadLocations() {
      try {
        const params = new URLSearchParams({
          club_id: clubId,
        });

        const response = await fetch(
          `${API_BASE}/locations?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load locations. HTTP ${response.status}`
          );
        }

        const body =
          await response.json();

        const data: Location[] =
          Array.isArray(body)
            ? body
            : Array.isArray(body?.locations)
              ? body.locations
              : [];

        setLocations(data);

        const savedLocationId = window.localStorage.getItem(
          `deuceiq_location_${currentClubId}`
        );

        const savedIsValid =
          savedLocationId !== null &&
          data.some(
            (location) => location.id === savedLocationId
          );

        setCurrentLocationId(
          savedIsValid ? savedLocationId : data[0]?.id ?? null
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setLocations([]);
        setCurrentLocationId(null);
      }
    }

    loadLocations();

    return () => {
      controller.abort();
    };
  }, [currentClubId, session?.access_token]);

  useEffect(() => {
    if (
      !session?.access_token ||
      !currentClubId ||
      !currentLocationId
    ) {
      setCourts([]);
      return;
    }

    const accessToken =
      session.access_token;

    const clubId =
      currentClubId;

    const locationId =
      currentLocationId;

    const controller = new AbortController();

    async function loadCourts() {
      try {
        const params = new URLSearchParams({
          club_id: clubId,
          location_id: locationId,
        });

        const response = await fetch(
          `${API_BASE}/courts?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load courts. HTTP ${response.status}`
          );
        }

        const data: Court[] = await response.json();

        setCourts(
          data.filter(
            (court) => court.active !== false
          )
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setCourts([]);
      }
    }

    loadCourts();

    return () => {
      controller.abort();
    };
  }, [
    currentClubId,
    currentLocationId,
    session?.access_token,
  ]);

  useEffect(() => {
    if (
      !clubRole ||
      visibleNavigationItems.some(
        (item) => item.id === section
      )
    ) {
      return;
    }

    setSection("overview");
  }, [clubRole, section, visibleNavigationItems]);

  const memberSearchUrl = useMemo(() => {
    if (!currentClubId) {
      return null;
    }

    const params = new URLSearchParams({
      club_id: currentClubId,
    });

    if (memberSearch.trim()) {
      params.set("search", memberSearch.trim());
    }

    return `${API_BASE}/members?${params.toString()}`;
  }, [memberSearch, currentClubId]);

  useEffect(() => {
    if (
      section !== "members" ||
      !session?.access_token ||
      !memberSearchUrl
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
                Authorization: `Bearer ${session.access_token}`,
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

          const data: Member[] = await response.json();
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
      !session?.access_token ||
      !currentClubId ||
      !currentLocationId
    ) {
      return;
    }
    
    const accessToken =
      session.access_token;

    const clubId =
      currentClubId;

    const locationId =
      currentLocationId;

    const controller = new AbortController();

    async function loadBookings() {
      try {
        setBookingsLoading(true);
        setBookingsError(null);

        const params = new URLSearchParams({
          club_id: clubId,
          booking_date: calendarDate,
          location_id: locationId,
        });

        const response = await fetch(
          `${API_BASE}/bookings?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
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
              `Unable to load bookings. HTTP ${response.status}`
          );
        }

        const data: BookingsResponse = await response.json();
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
    currentClubId,
    currentLocationId,
  ]);

  useEffect(() => {
    if (
      section !== "clinics" ||
      clubRole !== "member" ||
      !session?.access_token ||
      !currentClubId
    ) {
      return;
    }

    const accessToken =
      session.access_token;

    const clubId =
      currentClubId;

    const controller = new AbortController();

    async function loadMemberClinics() {
      try {
        setAvailableClinicsLoading(true);
        setAvailableClinicsError(null);

        const params = new URLSearchParams({
          club_id: clubId,
        });

        const response = await fetch(
          `${API_BASE}/member/clinics?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
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
              `Unable to load clinics. HTTP ${response.status}`
          );
        }

        const data: MemberClinicsResponse =
          await response.json();

        setAvailableClinics(data.clinics);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setAvailableClinicsError(
          error instanceof Error
            ? error.message
            : "Unable to load clinics."
        );
      } finally {
        setAvailableClinicsLoading(false);
      }
    }

    loadMemberClinics();

    return () => {
      controller.abort();
    };
  }, [
    section,
    clubRole,
    currentClubId,
    session?.access_token,
  ]);

  useEffect(() => {
    if (
      section !== "approvals" ||
      !session?.access_token ||
      !currentClubId
    ) {
      return;
    }

    let cancelled = false;

    async function loadRoleRequests() {
      try {
        setRoleRequestsLoading(true);
        setRoleRequestsError(null);

        const { data, error } = await supabase
          .from("club_role_requests")
          .select("*")
          .eq("club_id", currentClubId)
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
    currentClubId,
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
          (request) => request.id !== requestId
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
              `${window.location.origin}/reset-password`,
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
      "Password updated successfully. Returning to sign in."
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

  async function handleMemberSignup(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSignupLoading(true);
    setSignupMessage(null);

    try {
      if (!signupClubId) {
        throw new Error(
          "This signup page is not connected to a club."
        );
      }

      if (signupPassword.length < 8) {
        throw new Error(
          "Password must be at least 8 characters."
        );
      }

      if (
        signupPassword !==
        signupPasswordConfirm
      ) {
        throw new Error(
          "Passwords do not match."
        );
      }

      const { data, error } =
        await supabase.auth.signUp({
          email: email.trim(),
          password: signupPassword,
          options: {
            emailRedirectTo:
              window.location.origin,
            data: {
              first_name:
                signupFirstName.trim(),
              last_name:
                signupLastName.trim(),
              phone:
                signupPhone.trim() ||
                null,
              signup_intent:
                "member",
              signup_club_id:
                signupClubId,
            },
          },
        });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error(
          "Member account could not be created."
        );
      }

      if (!data.session) {
        setSignupMessage(
          "Account created. Check your email to confirm your account, then sign in to finish joining the club."
        );
        return;
      }

      const applicantName = [
        signupFirstName.trim(),
        signupLastName.trim(),
      ]
        .filter(Boolean)
        .join(" ");

      const { error: requestError } =
        await supabase.rpc(
          "request_member_access",
          {
            target_club_id:
              signupClubId,
            applicant_name:
              applicantName,
            applicant_email:
              email.trim(),
            applicant_note: null,
          }
        );

      if (requestError) {
        throw requestError;
      }

      const { error: metadataError } =
        await supabase.auth.updateUser({
          data: {
            signup_intent:
              "complete",
          },
        });

      if (metadataError) {
        throw metadataError;
      }

      setSignupMessage(
        "Account created. Your member request has been sent to the club for approval."
      );
    } catch (error) {
      setSignupMessage(
        error instanceof Error
          ? error.message
          : "Unable to create member account."
      );
    } finally {
      setSignupLoading(false);
    }
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
          invitation_token:
            inviteToken,
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

    setClubMemberships([]);
    setCurrentClubId(null);
    setLocations([]);
    setCurrentLocationId(null);
    setCourts([]);
    setMembers([]);
    setMemberSearch("");
    setMembersError(null);
    setRoleRequests([]);
    setAvailableClinics([]);
    setSection("overview");
  }

  function handleClubChange(
    clubId: string
  ) {
    setCurrentClubId(clubId);

    window.localStorage.setItem(
      "deuceiq_current_club_id",
      clubId
    );

    setCurrentLocationId(null);
    setSection("overview");
  }

  function handleLocationChange(
    locationId: string
  ) {
    setCurrentLocationId(
      locationId
    );

    if (currentClubId) {
      window.localStorage.setItem(
        `deuceiq_location_${currentClubId}`,
        locationId
      );
    }
  }

  if (authLoading) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-logo">
            DIQ
          </div>

          <h1>DeuceIQ</h1>
          <p>Loading workspace...</p>
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
                Sign in to accept your
                club invitation.
              </p>
            </div>

            <label className="form-field">
              <span>Email</span>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
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
                  setPassword(
                    event.target.value
                  )
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
                        `${window.location.origin}/invite?token=${encodeURIComponent(
                          inviteToken ?? ""
                        )}&mode=existing`,
                    }
                  );

                if (error) {
                  setInviteMessage(
                    error.message
                  );
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
          onSubmit={
            handleInviteSetPassword
          }
        >
          <div className="login-logo">
            DIQ
          </div>

          <div className="login-heading">
            <h1>Join DeuceIQ</h1>
            <p>
              Set a password to finish
              joining your club.
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
              value={
                invitePasswordConfirm
              }
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
          onSubmit={
            handleUpdatePassword
          }
        >
          <div className="login-logo">
            DIQ
          </div>

          <div className="login-heading">
            <h1>Set new password</h1>
            <p>
              Choose a new password
              for your DeuceIQ account.
            </p>
          </div>

          <label className="form-field">
            <span>New password</span>

            <input
              type="password"
              value={newPassword}
              onChange={(event) =>
                setNewPassword(
                  event.target.value
                )
              }
              autoComplete="new-password"
              required
            />
          </label>

          <label className="form-field">
            <span>
              Confirm new password
            </span>

            <input
              type="password"
              value={
                newPasswordConfirm
              }
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
            signupMode
              ? handleMemberSignup
              : resetMode
                ? handlePasswordReset
                : handleLogin
          }
        >
          <div className="login-logo">
            DIQ
          </div>

          <div className="login-heading">
            <h1>
              {signupMode
                ? "Create member account"
                : "DeuceIQ"}
            </h1>

            <p>
              {signupMode
                ? "Join your club as a member."
                : resetMode
                  ? "Reset your password."
                  : "Tennis intelligence for club management."}
            </p>
          </div>

          {signupMode && (
            <>
              <label className="form-field">
                <span>First name</span>
                <input
                  type="text"
                  value={
                    signupFirstName
                  }
                  onChange={(event) =>
                    setSignupFirstName(
                      event.target.value
                    )
                  }
                  autoComplete="given-name"
                  required
                />
              </label>

              <label className="form-field">
                <span>Last name</span>
                <input
                  type="text"
                  value={
                    signupLastName
                  }
                  onChange={(event) =>
                    setSignupLastName(
                      event.target.value
                    )
                  }
                  autoComplete="family-name"
                  required
                />
              </label>
            </>
          )}

          <label className="form-field">
            <span>Email</span>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          {signupMode && (
            <label className="form-field">
              <span>
                Phone number (optional)
              </span>

              <input
                type="tel"
                value={signupPhone}
                onChange={(event) =>
                  setSignupPhone(
                    event.target.value
                  )
                }
                autoComplete="tel"
              />
            </label>
          )}

          {signupMode && (
            <>
              <label className="form-field">
                <span>Password</span>

                <input
                  type="password"
                  value={
                    signupPassword
                  }
                  onChange={(event) =>
                    setSignupPassword(
                      event.target.value
                    )
                  }
                  autoComplete="new-password"
                  required
                />
              </label>

              <label className="form-field">
                <span>
                  Confirm password
                </span>

                <input
                  type="password"
                  value={
                    signupPasswordConfirm
                  }
                  onChange={(event) =>
                    setSignupPasswordConfirm(
                      event.target.value
                    )
                  }
                  autoComplete="new-password"
                  required
                />
              </label>
            </>
          )}

          {!resetMode &&
            !signupMode && (
              <label className="form-field">
                <span>Password</span>

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                />
              </label>
            )}

          {!resetMode &&
            !signupMode && (
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
                      (current) =>
                        !current
                    )
                  }
                >
                  Forgot email?
                </button>
              </div>
            )}

          {forgotEmailMessage &&
            !resetMode &&
            !signupMode && (
              <div className="login-help-message">
                Contact your club manager or
                DeuceIQ support to confirm the
                email associated with your account.
              </div>
            )}

          {loginError &&
            !resetMode &&
            !signupMode && (
              <div className="login-error">
                {loginError}
              </div>
            )}

          {resetMessage && (
            <div className="login-help-message">
              {resetMessage}
            </div>
          )}

          {signupMessage && (
            <div className="login-help-message">
              {signupMessage}
            </div>
          )}

          <button
            type="submit"
            className="primary-button login-button"
            disabled={
              signupMode
                ? signupLoading
                : resetMode
                  ? resetLoading
                  : loginLoading
            }
          >
            {signupMode
              ? signupLoading
                ? "Creating account..."
                : "Create member account"
              : resetMode
                ? resetLoading
                  ? "Sending..."
                  : "Send reset email"
                : loginLoading
                  ? "Signing in..."
                  : "Sign in"}
          </button>

          {!resetMode && (
            <button
              type="button"
              className="login-back-button"
              onClick={() => {
                setSignupMode(
                  (current) =>
                    !current
                );
                setLoginError(null);
                setResetMessage(null);
                setSignupMessage(null);
              }}
            >
              {signupMode
                ? "Back to sign in"
                : "Create member account"}
            </button>
          )}

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


  if (clubRoleLoading) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-logo">
            DIQ
          </div>

          <h1>DeuceIQ</h1>
          <p>Loading club access...</p>
        </div>
      </div>
    );
  }

  if (
    !currentMembership ||
    !currentClubId
  ) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-logo">
            DIQ
          </div>

          <div className="login-heading">
            <h1>
              Club access pending
            </h1>

            <p>
              Your account is signed in,
              but it does not yet have
              active access to a club.
            </p>
          </div>

          {signupMessage && (
            <div className="login-help-message">
              {signupMessage}
            </div>
          )}

          {clubRoleError && (
            <div className="login-error">
              {clubRoleError}
            </div>
          )}

          <button
            type="button"
            className="login-back-button"
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const activeClubRole =
  currentMembership.role;

  const currentLocation =
  Array.isArray(locations)
    ? locations.find(
        (location) =>
          location.id ===
          currentLocationId
      ) ?? null
    : null;

  const displayPageTitle =
    section === "bookings" &&
    clubRole === "member"
      ? "My Bookings"
      : section === "clinics" &&
          clubRole === "member"
        ? "Available Clinics"
        : visibleNavigationItems.find(
            (item) =>
              item.id === section
          )?.label ?? "DeuceIQ";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            DIQ
          </div>

          <div className="brand-copy">
            <h1>DeuceIQ</h1>
            <p>{clubName}</p>
          </div>
        </div>

        <div className="sidebar-label">
          {clubRole === "member"
            ? "MEMBER"
            : "MANAGEMENT"}
        </div>

        <nav className="navigation">
          {visibleNavigationItems.map(
            (item) => (
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
                  {item.id ===
                    "bookings" &&
                  clubRole === "member"
                    ? "My Bookings"
                    : item.id ===
                          "clinics" &&
                        clubRole ===
                          "member"
                      ? "Available Clinics"
                      : item.label}
                </span>
              </button>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">
              {session.user.email
                ?.charAt(0)
                .toUpperCase() ||
                "U"}
            </div>

            <div className="user-copy">
              <span>
                {clubRole?.replace(
                  "_",
                  " "
                ) ?? "user"}
              </span>

              <strong>
                {session.user.email ||
                  "DeuceIQ User"}
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
              {clubName.toUpperCase()}
            </p>

            <h2>{displayPageTitle}</h2>
          </div>

          <div className="topbar-actions">
            {clubMemberships.length >
              1 && (
              <select
                value={currentClubId}
                onChange={(event) =>
                  handleClubChange(
                    event.target.value
                  )
                }
              >
                {clubMemberships.map(
                  (membership) => (
                    <option
                      key={
                        membership.club_id
                      }
                      value={
                        membership.club_id
                      }
                    >
                      {
                        membership.club_id
                      }
                    </option>
                  )
                )}
              </select>
            )}

            {locations.length > 1 && (
              <select
                value={
                  currentLocationId ??
                  ""
                }
                onChange={(event) =>
                  handleLocationChange(
                    event.target.value
                  )
                }
              >
                {locations.map(
                  (location) => (
                    <option
                      key={location.id}
                      value={location.id}
                    >
                      {location.name}
                    </option>
                  )
                )}
              </select>
            )}

            {canViewCourtSheet && (
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setSection("calendar")
                }
              >
                View Court Sheet
              </button>
            )}

            {canManageBookings && (
              <button
                type="button"
                className="primary-button"
              >
                + Create Booking
              </button>
            )}
          </div>
        </header>

        {section === "overview" && (
          <OverviewPage
            clubRole={activeClubRole}
            clubName={clubName}
            locationName={
              currentLocation?.name ??
              null
            }
            locationsCount={
              locations.length
            }
            courts={courts}
            availableClinicsCount={
              availableClinics.length
            }
            canManageBookings={
              canManageBookings
            }
            onOpenCalendar={() =>
              setSection("calendar")
            }
            onOpenClinics={() =>
              setSection("clinics")
            }
            onOpenMembers={() =>
              setSection("members")
            }
          />
        )}

        {section === "calendar" && (
          <CalendarPage
            bookings={bookings}
            courts={courts}
            loading={
              bookingsLoading
            }
            error={bookingsError}
            calendarDate={
              calendarDate
            }
            setCalendarDate={
              setCalendarDate
            }
          />
        )}

        {section === "bookings" &&
          (clubRole === "member" ? (
            <MemberBookingsPage />
          ) : (
            <PlaceholderPage
              title="Bookings"
              description="Create, edit and manage lessons, rentals and recurring bookings."
            />
          ))}

        {section === "clinics" &&
          (clubRole === "member" ? (
            <MemberClinicsPage
              clinics={
                availableClinics
              }
              loading={
                availableClinicsLoading
              }
              error={
                availableClinicsError
              }
            />
          ) : (
            <PlaceholderPage
              title="Clinics"
              description="Manage clinic rosters, court capacity, registrations and waitlists."
            />
          ))}

        {section === "members" && (
          <MembersPage
            members={members}
            memberSearch={
              memberSearch
            }
            setMemberSearch={
              setMemberSearch
            }
            loading={
              membersLoading
            }
            error={
              membersError
            }
          />
        )}

        {section === "pros" &&
          (clubRole === "member" ? (
            <PlaceholderPage
              title="Pros"
              description="Browse club professionals and lesson options."
            />
          ) : (
            <PlaceholderPage
              title="Pros"
              description="Manage schedules, location assignments, compensation and availability."
            />
          ))}

        {section === "approvals" && (
          <ApprovalsPage
            requests={roleRequests}
            loading={
              roleRequestsLoading
            }
            error={
              roleRequestsError ||
              approvalActionError
            }
            actionId={
              approvalActionId
            }
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

function OverviewPage({
  clubRole,
  clubName,
  locationName,
  locationsCount,
  courts,
  availableClinicsCount,
  canManageBookings,
  onOpenCalendar,
  onOpenClinics,
  onOpenMembers,
}: {
  clubRole: string;
  clubName: string;
  locationName: string | null;
  locationsCount: number;
  courts: Court[];
  availableClinicsCount: number;
  canManageBookings: boolean;
  onOpenCalendar: () => void;
  onOpenClinics: () => void;
  onOpenMembers: () => void;
}) {
  return (
    <section className="overview">
      <div className="overview-grid">
        <div className="weather-card">
          <div className="card-heading">
            <div>
              <p className="card-kicker">
                CLUB OVERVIEW
              </p>

              <h3>{clubName}</h3>
            </div>

            {locationName && (
              <span className="weather-status">
                {locationName}
              </span>
            )}
          </div>

          <div className="weather-main">
            <div className="weather-description">
              <strong>
                {locationsCount}
                {locationsCount === 1
                  ? " location"
                  : " locations"}
              </strong>

              <span>
                {courts.length}
                {courts.length === 1
                  ? " active court"
                  : " active courts"}
              </span>
            </div>
          </div>

          <div className="weather-note">
            Live weather will appear here
            once the weather integration is
            connected. No placeholder weather
            values are being shown.
          </div>
        </div>

        {canManageBookings && (
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

              <button
                onClick={
                  onOpenMembers
                }
              >
                <span>♙</span>
                Add Member
              </button>

              <button
                onClick={
                  onOpenCalendar
                }
              >
                <span>▦</span>
                View Calendar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="metric-grid">
        {clubRole === "member" ? (
          <>
            <MetricCard
              label="My Bookings"
              value="View"
              detail="Upcoming reservations"
            />

            <MetricCard
              label="Available Clinics"
              value={String(
                availableClinicsCount
              )}
              detail="Future signup opportunities"
            />

            <MetricCard
              label="Club Courts"
              value={String(
                courts.length
              )}
              detail="At selected location"
            />

            <MetricCard
              label="Court Availability"
              value="Next"
              detail="Member booking availability endpoint"
            />
          </>
        ) : (
          <>
            <MetricCard
              label="Locations"
              value={String(
                locationsCount
              )}
              detail="Active workspace"
            />

            <MetricCard
              label="Courts"
              value={String(
                courts.length
              )}
              detail="Selected location"
            />

            <MetricCard
              label="Clinics"
              value="Open"
              detail="Manage programs"
            />

            <MetricCard
              label="Opportunity Center"
              value="AI"
              detail="Operational intelligence"
            />
          </>
        )}
      </div>

      {clubRole === "member" ? (
        <div className="schedule-card">
          <div className="card-heading schedule-heading">
            <div>
              <p className="card-kicker">
                COURT STATUS
              </p>

              <h3>
                Court Availability
              </h3>
            </div>
          </div>

          <div className="empty-state">
            <strong>
              {courts.length}
              {courts.length === 1
                ? " court"
                : " courts"}{" "}
              configured
            </strong>

            <p>
              Live open and occupied time
              will appear here through the
              member-safe booking availability
              endpoint. Internal booking details
              will not be exposed.
            </p>
          </div>
        </div>
      ) : (
        <div className="schedule-card">
          <div className="card-heading schedule-heading">
            <div>
              <p className="card-kicker">
                CLUB SCHEDULE
              </p>

              <h3>
                Court Activity
              </h3>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={
                onOpenCalendar
              }
            >
              Open Full Calendar
            </button>
          </div>

          <div className="empty-state">
            Use the full calendar to view
            live booking activity for the
            selected location.
          </div>
        </div>
      )}

      {clubRole === "member" &&
        availableClinicsCount > 0 && (
          <div className="schedule-card">
            <div className="card-heading schedule-heading">
              <div>
                <p className="card-kicker">
                  CLINICS
                </p>

                <h3>
                  Upcoming Opportunities
                </h3>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={
                  onOpenClinics
                }
              >
                View Clinics
              </button>
            </div>
          </div>
        )}
    </section>
  );
}


function CalendarPage({
  bookings,
  courts,
  loading,
  error,
  calendarDate,
  setCalendarDate,
}: {
  bookings: Booking[];
  courts: Court[];
  loading: boolean;
  error: string | null;
  calendarDate: string;
  setCalendarDate: (
    date: string
  ) => void;
}) {
  const courtNames =
    courts.map(
      (court) => court.name
    );

  const timeSlots: string[] = [];

  for (
    let hour = 6;
    hour <= 18;
    hour++
  ) {
    timeSlots.push(
      String(hour).padStart(
        2,
        "0"
      ) + ":00"
    );

    if (hour < 18) {
      timeSlots.push(
        String(hour).padStart(
          2,
          "0"
        ) + ":30"
      );
    }
  }

  function changeDate(
    days: number
  ) {
    const date = new Date(
      calendarDate +
        "T12:00:00"
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
      year +
        "-" +
        month +
        "-" +
        day
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

    if (
      category === "clinic"
    ) {
      return "calendar-booking clinic-booking";
    }

    if (
      category ===
      "semi_private"
    ) {
      return "calendar-booking semi-booking";
    }

    if (
      category === "rental"
    ) {
      return "calendar-booking rental-booking";
    }

    if (
      booking.is_recurring
    ) {
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
            value={
              calendarDate
            }
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

      {!loading &&
        !error &&
        courtNames.length ===
          0 && (
          <div className="empty-state">
            No courts are configured
            for this location.
          </div>
        )}

      {!loading &&
        !error &&
        courtNames.length > 0 && (
          <div className="court-sheet-scroll">
            <div
              className="court-sheet-grid"
              style={{
                gridTemplateColumns:
                  "72px repeat(" +
                  courtNames.length +
                  ", minmax(120px, 1fr))",
              }}
            >
              <div className="court-sheet-corner">
                Time
              </div>

              {courtNames.map(
                (court) => (
                  <div
                    key={court}
                    className="court-header-cell"
                  >
                    {court}
                  </div>
                )
              )}

              {timeSlots.map(
                (slot) => (
                  <div
                    key={slot}
                    className="court-sheet-row"
                    style={{
                      display:
                        "contents",
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
                          hour:
                            "numeric",
                          minute:
                            "2-digit",
                        }
                      )}
                    </div>

                    {courtNames.map(
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
                          start !==
                          slot
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
                )
              )}
            </div>
          </div>
        )}
    </section>
  );
}

function MemberBookingsPage() {
  return (
    <section className="members-card">
      <div className="card-heading">
        <div>
          <p className="card-kicker">
            MY ACCOUNT
          </p>

          <h3>
            My Bookings
          </h3>

          <p className="card-description">
            Your upcoming court rentals,
            lessons and clinic registrations
            will appear here.
          </p>
        </div>
      </div>

      <div className="empty-state">
        The member-safe My Bookings backend
        endpoint is the next connection for
        this page. The internal staff booking
        feed is intentionally not used.
      </div>
    </section>
  );
}

function MemberClinicsPage({
  clinics,
  loading,
  error,
}: {
  clinics: MemberClinic[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="members-card">
      <div className="card-heading">
        <div>
          <p className="card-kicker">
            UPCOMING CLINICS
          </p>

          <h3>
            Available Clinics
          </h3>

          <p className="card-description">
            Browse future clinics,
            available spots and waitlist
            status.
          </p>
        </div>

        <span className="member-count">
          {clinics.length} available
        </span>
      </div>

      {loading && (
        <div className="member-message">
          Loading clinics...
        </div>
      )}

      {error && (
        <div className="member-message error">
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        clinics.length === 0 && (
          <div className="empty-state">
            No upcoming clinics are
            available right now.
          </div>
        )}

      {!loading &&
        !error &&
        clinics.length > 0 && (
          <div className="member-list">
            {clinics.map(
              (clinic) => (
                <div
                  className="member-row"
                  key={
                    clinic.booking_id
                  }
                >
                  <div className="member-main">
                    <strong>
                      {clinic.name}
                    </strong>

                    <span>
                      {new Date(
                        clinic.starts_at
                      ).toLocaleString(
                        "en-US",
                        {
                          timeZone:
                            "America/New_York",
                          weekday:
                            "short",
                          month:
                            "short",
                          day:
                            "numeric",
                          hour:
                            "numeric",
                          minute:
                            "2-digit",
                        }
                      )}
                    </span>

                    <span>
                      {clinic.location_name ||
                        "Location TBD"}
                      {clinic.pro_name
                        ? ` • ${clinic.pro_name}`
                        : ""}
                    </span>
                  </div>

                  <div className="member-meta">
                    <span>
                      {clinic.spots_remaining >
                      0
                        ? `${clinic.spots_remaining} spots open`
                        : "Waitlist"}
                    </span>

                    <span>
                      {clinic.enrolled_count}/
                      {clinic.capacity} enrolled
                    </span>

                    {clinic.waitlist_count >
                      0 && (
                      <span>
                        {
                          clinic.waitlist_count
                        }{" "}
                        waitlisted
                      </span>
                    )}
                  </div>
                </div>
              )
            )}
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
            Search players by first
            or last name.
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
              )
            )}
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
    decision:
      | "approve"
      | "decline"
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
              New pro, member or guest
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
                        {
                          request.applicant_email
                        }
                      </span>
                    </div>
                  </div>

                  <div className="approval-details">
                    <div>
                      <span>
                        Requested role
                      </span>

                      <strong>
                        {
                          request.requested_role
                        }
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
                        {
                          request.applicant_note
                        }
                      </p>
                    </div>
                  )}

                  <div className="approval-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        actionId ===
                        request.id
                      }
                      onClick={() =>
                        onDecision(
                          request.id,
                          "decline"
                        )
                      }
                    >
                      {actionId ===
                      request.id
                        ? "Processing..."
                        : "Decline"}
                    </button>

                    <button
                      type="button"
                      className="primary-button"
                      disabled={
                        actionId ===
                        request.id
                      }
                      onClick={() =>
                        onDecision(
                          request.id,
                          "approve"
                        )
                      }
                    >
                      {actionId ===
                      request.id
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
