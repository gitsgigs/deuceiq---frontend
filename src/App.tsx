import {clinicRegistrationMessage} from "./lib/clinicRegistration";
import {ChatMessageIndicator,StaffSummaryIndicator} from "./components/ChatMessageIndicator";
import {BookingMessageIndicator} from "./components/BookingMessageIndicator";
import {MemberChat} from "./components/MemberChat";
import {StaffConversations} from "./components/ConversationSummary";

import { OwnerChecklist } from "./components/OwnerChecklist";
import { PlatformAdminLink } from "./components/ClubOnboarding";
import { StaffBookings } from "./components/StaffBookings";
import { NotificationsPage, NotificationIndicator } from "./components/NotificationsPage";
import { HistoryPage } from "./components/HistoryPage";
import { PricePreview } from "./components/PricePreview";
import { ProfileDirectory } from "./components/ProfileDirectory";
import { ClinicSchedule } from "./components/ClinicSchedule";

import { SettingsPage, ProsPage } from "./components/ClubPages";
import { MemberBookingsPage } from "./components/MemberBookings";
import { useEffect, useMemo, useState } from "react";

import type { Session } from "@supabase/supabase-js";



import "./App.css";

import { AvailabilityAction, MemberAvailability, LocationWeather, WeatherSetup } from "./components/MemberHome";

import type { MemberHomeContext } from "./components/MemberHome";

import CalendarBoard from "./components/CalendarBoard";

import QuickCreate from "./components/QuickCreate";

import type { CreateKind } from "./lib/createActions";

import { supabase } from "./lib/supabase";



type ClubUser = { club_id: string; user_id: string; role: string; active: boolean };

type Club = { id: string; name: string };

type Location = {

  id: string;

  club_id: string;

  name: string;

  timezone?: string | null;

};

type Court = {

  id: string;

  location_id: string;

  name: string;

  surface?: string | null;

  court_number?: number | null;

  active?: boolean;

};



type Section =
  | "conversations"

  | "overview"

  | "calendar"

  | "bookings"

  | "history"

  | "notifications"

  | "clinics"

  | "members"

  | "pros"

  | "approvals"

  | "opportunity"

  | "inventory"

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



  booking_participants?: {

    id?: string;

    created_at?: string;

    participant_role?: string | null;

    member_id?: string | null;

    member?: {

      id: string;

      first_name?: string | null;

      last_name?: string | null;

      membership_type?: string | null;

      skill_level?: string | null;

    } | null;

  }[];



  primary_participant?: {

    member_id?: string | null;

    first_name?: string | null;

    last_name?: string | null;

    participant_role?: string | null;

    guest?: boolean;

  } | null;



  is_recurring?: boolean;

  booking_series_name?: string | null;

  outside_normal_pro_schedule?: boolean;

  schedule_warning?: string | null;

  outside_location_operating_hours?: boolean;

  operating_hours_warning?: string | null;

};











type ClubInvitation = {

  id: string;

  club_id: string;

  invited_email: string;

  invited_role: string;

  invited_by: string;

  status: string;

  expires_at: string;

  accepted_by: string | null;

  accepted_at: string | null;

  revoked_at: string | null;

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



type InventoryItem = {

  id: string;

  club_id: string;

  location_id: string | null;

  name: string;

  category: string;

  sku: string | null;

  unit_label: string;

  inventory_count: number | string;

  unit_price: number | string;

  updated_asset_value: number | string;

  reorder_level: number | string | null;

  active: boolean;

  created_at: string;

  updated_at: string;

};



type InventoryResponse = {

  count: number;

  inventory: InventoryItem[];

};



type InventoryMovement = {

  id: string;

  club_id: string;

  inventory_item_id: string;

  movement_type: string;

  quantity_change: number | string;

  resulting_inventory_count: number | string;

  unit_price: number | string | null;

  asset_value_after: number | string;

  notes: string | null;

  occurred_at: string;

  created_by: string | null;

  created_at: string;

};



type InventoryMovementsResponse = {

  inventory_item: {

    id: string;

    club_id: string;

    name: string;

    active: boolean;

  };

  count: number;

  movements: InventoryMovement[];

};



const API_BASE = import.meta.env.VITE_API_BASE || "https://api.deuceiq.com";

const navigationItems: {

  id: Section;

  label: string;

  icon: string;

  roles: string[];

}[] = [

  { id: "conversations", label: "Conversations", icon: "\u2709", roles: ["member", "manager", "front_desk"] },
  { id: "overview", label: "Overview", icon: "\u2302", roles: ["owner", "director", "manager", "front_desk", "pro", "member"] },

  { id: "calendar", label: "Calendar", icon: "\u25a6", roles: ["owner", "director", "manager", "front_desk", "pro"] },

  { id: "bookings", label: "Booking Requests", icon: "\u25eb", roles: ["owner", "director", "manager", "front_desk", "member"] },

  { id: "notifications", label: "Notifications", icon: "!", roles: ["owner", "director", "manager", "front_desk", "pro", "member", "guest"] },

  { id: "history", label: "History", icon: "\u21ba", roles: ["owner", "director", "manager", "front_desk"] },

  { id: "clinics", label: "Clinics", icon: "\u25ce", roles: ["owner", "director", "manager", "front_desk", "member"] },

  { id: "members", label: "Members", icon: "\u2659", roles: ["owner", "director", "manager", "front_desk"] },

  { id: "pros", label: "Pros", icon: "\u265c", roles: ["owner", "director", "manager", "front_desk", "pro", "member"] },

  { id: "approvals", label: "Invitations", icon: "\u2709", roles: ["owner", "director", "manager", "front_desk"] },

  { id: "opportunity", label: "Opportunity Center", icon: "\u2726", roles: ["owner", "director", "manager"] },

  { id: "inventory", label: "Inventory", icon: "\u25a4", roles: ["owner", "director", "manager"] },

  { id: "settings", label: "Settings", icon: "\u2699", roles: ["owner", "director", "manager"] },

];



function getTodayForTimeZone(timeZone?: string | null) {

  const browserTimeZone =

    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";



  const requestedTimeZone = timeZone || browserTimeZone;



  try {

    const formatter = new Intl.DateTimeFormat("en-US", {

      timeZone: requestedTimeZone,

      year: "numeric",

      month: "2-digit",

      day: "2-digit",

    });



    const parts = formatter.formatToParts(new Date());

    let year = "";

    let month = "";

    let day = "";



    for (const part of parts) {

      if (part.type === "year") year = part.value;

      if (part.type === "month") month = part.value;

      if (part.type === "day") day = part.value;

    }



    return `${year}-${month}-${day}`;

  } catch {

    return new Date().toISOString().slice(0, 10);

  }

}



function App() {

  const [availabilityOpen, setAvailabilityOpen] = useState(false);

  const [createRange,setCreateRange] = useState<{courtId:string;start:string;end:string}|null>(null);
  const [createAction, setCreateAction] = useState<CreateKind | null>(null);

  const [createMessage, setCreateMessage] = useState<string | null>(null);

  const [dataRevision, setDataRevision] = useState(0);

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



  const [inviteMode, setInviteMode] = useState(false);

  const [inviteModeType, setInviteModeType] = useState<"new" | "existing" | null>(null);

  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const [invitePhone, setInvitePhone] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");

  const [invitePasswordConfirm, setInvitePasswordConfirm] = useState("");

  const [inviteMessage, setInviteMessage] = useState<string | null>(null);



  const [members, setMembers] = useState<Member[]>([]);

  const [memberSearch, setMemberSearch] = useState("");

  const [membersLoading, setMembersLoading] = useState(false);

  const [membersError, setMembersError] = useState<string | null>(null);



  const [bookingsScope,setBookingsScope]=useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [bookingsLoading, setBookingsLoading] = useState(false);

  const [bookingsError, setBookingsError] = useState<string | null>(null);



  const [clubInvitations, setClubInvitations] = useState<ClubInvitation[]>([]);

  const [invitationsLoading, setInvitationsLoading] = useState(false);

  const [invitationsError, setInvitationsError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");

  const [inviteRole, setInviteRole] = useState("member");

  const [inviteSending, setInviteSending] = useState(false);

  const [inviteActionMessage, setInviteActionMessage] = useState<string | null>(null);

  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);



  const [availableClinics, setAvailableClinics] = useState<MemberClinic[]>([]);

  const [, setAvailableClinicsLoading] = useState(false);

  const [, setAvailableClinicsError] = useState<string | null>(null);

  const [selectedClinic, setSelectedClinic] = useState<MemberClinic | null>(null);

  const [clinicDecisionMessage, setClinicDecisionMessage] = useState<string | null>(null);

  const [clinicRegistering, setClinicRegistering] = useState(false);



  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const [inventoryLoading, setInventoryLoading] = useState(false);

  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const [inventoryIncludeInactive, setInventoryIncludeInactive] = useState(false);

  const [inventoryCreateOpen, setInventoryCreateOpen] = useState(false);

  const [inventoryCreateSaving, setInventoryCreateSaving] = useState(false);

  const [inventoryCreateMessage, setInventoryCreateMessage] = useState<string | null>(null);



  const [inventoryMovementItem, setInventoryMovementItem] = useState<InventoryItem | null>(null);

  const [inventoryMovementSaving, setInventoryMovementSaving] = useState(false);

  const [inventoryMovementMessage, setInventoryMovementMessage] = useState<string | null>(null);



  const [inventoryInfoItem, setInventoryInfoItem] = useState<InventoryItem | null>(null);

  const [inventoryInfoMovements, setInventoryInfoMovements] = useState<InventoryMovement[]>([]);

  const [inventoryInfoLoading, setInventoryInfoLoading] = useState(false);

  const [inventoryInfoError, setInventoryInfoError] = useState<string | null>(null);



  const [calendarDate, setCalendarDate] = useState(() => getTodayForTimeZone());



  const currentMembership = useMemo(() => {

    if (!Array.isArray(clubMemberships)) {

      return null;

    }



    for (const membership of clubMemberships) {

      if (membership.club_id === currentClubId) {

        return membership;

      }

    }



    return null;

  }, [clubMemberships, currentClubId]);



  const clubRole = currentMembership?.role ?? null;



  const visibleNavigationItems = useMemo(

    () =>

      navigationItems.filter(

        (item) => clubRole !== null && item.roles.includes(clubRole)

      ),

    [clubRole]

  );



  const canManageBookings =

    currentMembership?.active === true && clubRole !== null &&

    ["owner", "director", "manager", "front_desk"].includes(clubRole);



  const canViewCourtSheet =

    clubRole !== null &&

    ["owner", "director", "manager", "front_desk", "pro"].includes(clubRole);



  const canInviteUsers =

    clubRole !== null &&

    ["owner", "director", "manager", "front_desk"].includes(clubRole);



  const canManageInventory =

    clubRole !== null &&

    ["owner", "director", "manager"].includes(clubRole);



  useEffect(() => {

    setCreateAction(null);

    setAvailabilityOpen(false);

    setCreateMessage(null);

  }, [currentClubId, currentLocationId, session?.user.id]);



  const invitableRoles = useMemo(() => {

    if (clubRole === "owner") {

      return ["director", "manager", "front_desk", "pro", "member", "guest"];

    }

    if (clubRole === "director") {

      return ["manager", "front_desk", "pro", "member", "guest"];

    }

    if (clubRole === "manager") {

      return ["front_desk", "pro", "member", "guest"];

    }

    if (clubRole === "front_desk") {

      return ["member", "guest"];

    }

    return [];

  }, [clubRole]);





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



    const controller = new AbortController();



    async function loadLocations() {

      try {

        const params = new URLSearchParams({

          club_id: currentClubId ?? "",

        });



        const response = await fetch(

          `${API_BASE}/locations?${params.toString()}`,

          {

            headers: {

              Authorization: `Bearer ${session?.access_token ?? ""}`,

            },

            signal: controller.signal,

          }

        );



        if (!response.ok) {

          throw new Error(

            `Unable to load locations. HTTP ${response.status}`

          );

        }



        const body = await response.json();

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



        const nextLocationId =

          savedIsValid ? savedLocationId : data[0]?.id ?? null;



        setCurrentLocationId(nextLocationId);



        let nextLocation: Location | null = null;

        for (const location of data) {

          if (location.id === nextLocationId) {

            nextLocation = location;

            break;

          }

        }



        if (nextLocation) {

          setCalendarDate(

            getTodayForTimeZone(nextLocation.timezone)

          );

        }

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



    const controller = new AbortController();



    async function loadCourts() {

      try {

        const params = new URLSearchParams({

          club_id: currentClubId ?? "",

          location_id: currentLocationId ?? "",

        });



        const response = await fetch(

          `${API_BASE}/courts?${params.toString()}`,

          {

            headers: {

              Authorization: `Bearer ${session?.access_token ?? ""}`,

            },

            signal: controller.signal,

          }

        );



        if (!response.ok) {

          throw new Error(

            `Unable to load courts. HTTP ${response.status}`

          );

        }



        const body = await response.json();

        const data: Court[] =

          Array.isArray(body)

            ? body

            : Array.isArray(body?.courts)

              ? body.courts

              : [];



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

    dataRevision,

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

    dataRevision,

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



    const controller = new AbortController();



    async function loadBookings() {

      try {

        setBookingsLoading(true);

        setBookingsError(null);



        const params = new URLSearchParams({

          club_id: currentClubId ?? "",

          booking_date: calendarDate,

          location_id: currentLocationId ?? "",

        });



        const response = await fetch(

          `${API_BASE}/bookings?${params.toString()}`,

          {

            headers: {

              Authorization: `Bearer ${session?.access_token ?? ""}`,

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

        if (!controller.signal.aborted) { setBookings(data.bookings); setBookingsScope(`${session?.user.id}:${currentClubId}:${currentLocationId}:${calendarDate}`); }

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

        if (!controller.signal.aborted) setBookingsLoading(false);

      }

    }



    loadBookings();



    return () => {

      controller.abort();

    };

  }, [

    section,

    calendarDate,

    dataRevision,

    session?.access_token,

    currentClubId,

    currentLocationId,

  ]);



  async function loadInventory(signal?: AbortSignal) {

    if (

      !canManageInventory ||

      !session?.access_token ||

      !currentClubId

    ) {

      return;

    }



    try {

      setInventoryLoading(true);

      setInventoryError(null);



      const params = new URLSearchParams({

        club_id: currentClubId,

        include_inactive: String(inventoryIncludeInactive),

      });



      if (currentLocationId) {

        params.set("location_id", currentLocationId);

      }



      const response = await fetch(

        `${API_BASE}/inventory?${params.toString()}`,

        {

          headers: {

            Authorization: `Bearer ${session.access_token}`,

          },

          signal,

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

          // Keep fallback message below.

        }



        throw new Error(

          detail ||

            `Unable to load inventory. HTTP ${response.status}`

        );

      }



      const body: InventoryResponse = await response.json();



      setInventoryItems(

        Array.isArray(body?.inventory)

          ? body.inventory

          : []

      );

    } catch (error) {

      if (

        error instanceof DOMException &&

        error.name === "AbortError"

      ) {

        return;

      }



      setInventoryError(

        error instanceof Error

          ? error.message

          : "Unable to load inventory."

      );

    } finally {

      setInventoryLoading(false);

    }

  }



  useEffect(() => {

    if (

      section !== "inventory" ||

      !canManageInventory ||

      !session?.access_token ||

      !currentClubId

    ) {

      return;

    }



    const controller = new AbortController();



    loadInventory(controller.signal);



    return () => {

      controller.abort();

    };

  }, [

    section,

    canManageInventory,

    currentClubId,

    currentLocationId,

    inventoryIncludeInactive,

    session?.access_token,

  ]);





  async function loadMemberClinics(signal?: AbortSignal) {

    if (

      clubRole !== "member" ||

      !session?.access_token ||

      !currentClubId

    ) {

      return;

    }



    try {

      setAvailableClinicsLoading(true);

      setAvailableClinicsError(null);



      const params = new URLSearchParams({

        club_id: currentClubId ?? "",

      });



      const response = await fetch(

        `${API_BASE}/member/clinics?${params.toString()}`,

        {

          headers: {

            Authorization: `Bearer ${session?.access_token ?? ""}`,

          },

          signal,

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



      setAvailableClinics(

        Array.isArray(data?.clinics) ? data.clinics : []

      );

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



  useEffect(() => {

    if (

      section !== "clinics" ||

      clubRole !== "member" ||

      !session?.access_token ||

      !currentClubId

    ) {

      return;

    }



    const controller = new AbortController();



    loadMemberClinics(controller.signal);



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

      !currentClubId ||

      !canInviteUsers

    ) {

      return;

    }



    let cancelled = false;



    async function loadInvitations() {

      try {

        setInvitationsLoading(true);

        setInvitationsError(null);



        const { data, error } = await supabase

          .from("club_invitations")

          .select(

            "id,club_id,invited_email,invited_role,invited_by,status,expires_at,accepted_by,accepted_at,revoked_at,created_at"

          )

          .eq("club_id", currentClubId)

          .eq("status", "pending")

          .order("created_at", { ascending: false });



        if (error) throw error;

        if (!cancelled) setClubInvitations((data as ClubInvitation[]) || []);

      } catch (error) {

        if (!cancelled) {

          setInvitationsError(

            error instanceof Error ? error.message : "Unable to load invitations."

          );

        }

      } finally {

        if (!cancelled) setInvitationsLoading(false);

      }

    }



    loadInvitations();

    return () => { cancelled = true; };

  }, [section, session?.access_token, currentClubId, canInviteUsers]);





  async function handleMemberClinicRegistration(

    clinic: MemberClinic,

    friend?: {

      firstName: string;

      lastName: string;

      email: string;

      phone: string;

    }

  ) {

    if (!session?.access_token) {

      setClinicDecisionMessage(

        "Please sign in again before registering."

      );

      return;

    }



    try {

      setClinicRegistering(true);

      setClinicDecisionMessage(null);



      // --------------------------------------------------------

      // 1. Register the signed-in member.

      // A 409 saying they are already registered is acceptable

      // when they are adding a friend to an existing enrollment.

      // --------------------------------------------------------



      const quote = await supabase.rpc("quote_clinic_signup",{p_booking_id:clinic.booking_id,p_guest_count:friend?1:0,p_friend_email:friend?.email.trim()||null});
      if(quote.error) throw new Error(quote.error.code==="PZ001"?quote.error.message:"Pricing could not be verified. Please contact the club.");

      const memberResponse = await fetch(

        `${API_BASE}/member/clinics/${clinic.booking_id}/register`,

        {

          method: "POST",

          headers: {

            Authorization: `Bearer ${session.access_token}`,

          },

        }

      );



      let memberBody: {

        message?: string;

        detail?: string;

        status?: string;

      } = {};



      try {

        memberBody = await memberResponse.json();

      } catch {

        // Keep fallback messages below.

      }



      const memberAlreadyRegistered =

        memberResponse.status === 409 &&

        typeof memberBody?.detail === "string" &&

        memberBody.detail

          .toLowerCase()

          .includes("already registered");



      if (!memberResponse.ok && !memberAlreadyRegistered) {

        throw new Error(

          typeof memberBody?.detail === "string"

            ? memberBody.detail

            : `Unable to register. HTTP ${memberResponse.status}`

        );

      }



      // --------------------------------------------------------

      // 2. If requested, register the friend.

      // The backend decides whether the email belongs to an

      // existing club member or should be treated as a guest.

      // It also performs the schedule-overlap backcheck.

      // --------------------------------------------------------



      if (friend) {

        const friendResponse = await fetch(

          `${API_BASE}/member/clinics/${clinic.booking_id}/register-friend`,

          {

            method: "POST",

            headers: {

              Authorization: `Bearer ${session.access_token}`,

              "Content-Type": "application/json",

            },

            body: JSON.stringify({

              friend_first_name: friend.firstName.trim(),

              friend_last_name: friend.lastName.trim(),

              friend_email: friend.email.trim().toLowerCase(),

              friend_phone: friend.phone.trim() || null,

            }),

          }

        );



        let friendBody: {

          message?: string;

          detail?: string;

          status?: string;

          participant_type?: string;

        } = {};



        try {

          friendBody = await friendResponse.json();

        } catch {

          // Keep fallback message below.

        }



        if (!friendResponse.ok) {

          throw new Error(

            typeof friendBody?.detail === "string"

              ? friendBody.detail

              : `Unable to register friend. HTTP ${friendResponse.status}`

          );

        }



        const memberMessage = memberAlreadyRegistered
          ? "You were already registered."
          : clinicRegistrationMessage(memberBody.status);
        const friendMessage = clinicRegistrationMessage(friendBody.status, true);
        setClinicDecisionMessage(`${memberMessage} ${friendMessage}`);
      } else {
        setClinicDecisionMessage(memberAlreadyRegistered
          ? memberBody.detail ?? "You are already registered for this clinic."
          : clinicRegistrationMessage(memberBody.status));
      }

      await loadMemberClinics();

    } catch (error) {

      setClinicDecisionMessage(

        error instanceof Error

          ? error.message

          : "Unable to complete clinic registration."

      );

    } finally {

      setClinicRegistering(false);

    }

  }



  async function handleOpenInventoryInfo(

    item: InventoryItem

  ) {

    if (

      !session?.access_token ||

      !currentClubId ||

      !canManageInventory

    ) {

      return;

    }



    setInventoryInfoItem(item);

    setInventoryInfoMovements([]);

    setInventoryInfoError(null);



    try {

      setInventoryInfoLoading(true);



      const params = new URLSearchParams({

        club_id: currentClubId,

      });



      const response = await fetch(

        `${API_BASE}/inventory/${item.id}/movements?${params.toString()}`,

        {

          headers: {

            Authorization: `Bearer ${session.access_token}`,

          },

        }

      );



      let body: InventoryMovementsResponse | { detail?: string } = {

        inventory_item: {

          id: item.id,

          club_id: item.club_id,

          name: item.name,

          active: item.active,

        },

        count: 0,

        movements: [],

      };



      try {

        body = await response.json();

      } catch {

        // Keep fallback error below.

      }



      if (!response.ok) {

        throw new Error(

          typeof (body as { detail?: string })?.detail === "string"

            ? (body as { detail?: string }).detail

            : `Unable to load inventory history. HTTP ${response.status}`

        );

      }



      const movementBody = body as InventoryMovementsResponse;



      setInventoryInfoMovements(

        Array.isArray(movementBody?.movements)

          ? movementBody.movements

          : []

      );

    } catch (error) {

      setInventoryInfoError(

        error instanceof Error

          ? error.message

          : "Unable to load inventory history."

      );

    } finally {

      setInventoryInfoLoading(false);

    }

  }





  async function handleCreateInventoryMovement(

    item: InventoryItem,

    values: {

      movementType: string;

      quantity: string;

      unitPrice: string;

      notes: string;

    }

  ) {

    if (

      !session?.access_token ||

      !currentClubId ||

      !canManageInventory

    ) {

      return;

    }



    try {

      setInventoryMovementSaving(true);

      setInventoryMovementMessage(null);

      setInventoryError(null);



      const rawQuantity = Number(values.quantity);



      if (!Number.isFinite(rawQuantity) || rawQuantity <= 0) {

        setInventoryMovementMessage(

          "Enter a quantity greater than zero."

        );

        return;

      }



      const negativeMovementTypes = new Set([

        "used",

        "sold",

        "damaged",

      ]);



      const quantityChange =

        negativeMovementTypes.has(values.movementType)

          ? -rawQuantity

          : rawQuantity;



      const params = new URLSearchParams({

        club_id: currentClubId,

      });



      const response = await fetch(

        `${API_BASE}/inventory/${item.id}/movements?${params.toString()}`,

        {

          method: "POST",

          headers: {

            Authorization: `Bearer ${session.access_token}`,

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            movement_type: values.movementType,

            quantity_change: quantityChange,

            unit_price:

              values.unitPrice.trim()

                ? Number(values.unitPrice)

                : null,

            occurred_at: null,

            notes:

              values.notes.trim() || null,

          }),

        }

      );



      let body: {

        detail?: string;

        movement?: {

          resulting_inventory_count?: number | string;

        };

      } = {};



      try {

        body = await response.json();

      } catch {

        // Keep fallback message below.

      }



      if (!response.ok) {

        throw new Error(

          typeof body?.detail === "string"

            ? body.detail

            : `Unable to record movement. HTTP ${response.status}`

        );

      }



      const resultingCount =

        body?.movement?.resulting_inventory_count;



      setInventoryMovementMessage(

        resultingCount !== undefined

          ? `Movement recorded. Current quantity: ${resultingCount} ${item.unit_label}.`

          : "Movement recorded successfully."

      );



      await loadInventory();

    } catch (error) {

      setInventoryMovementMessage(

        error instanceof Error

          ? error.message

          : "Unable to record inventory movement."

      );

    } finally {

      setInventoryMovementSaving(false);

    }

  }





  async function handleCreateInventoryItem(

    values: {

      name: string;

      category: string;

      sku: string;

      unitLabel: string;

      initialQuantity: string;

      unitPrice: string;

      reorderLevel: string;

      notes: string;

    }

  ) {

    if (

      !session?.access_token ||

      !currentClubId ||

      !canManageInventory

    ) {

      return;

    }



    try {

      setInventoryCreateSaving(true);

      setInventoryCreateMessage(null);

      setInventoryError(null);



      const response = await fetch(

        `${API_BASE}/inventory`,

        {

          method: "POST",

          headers: {

            Authorization: `Bearer ${session.access_token}`,

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            club_id: currentClubId,

            location_id: currentLocationId,

            name: values.name.trim(),

            category:

              values.category.trim() || "other",

            sku:

              values.sku.trim() || null,

            unit_label:

              values.unitLabel.trim() || "unit",

            initial_quantity:

              Number(values.initialQuantity || "0"),

            unit_price:

              Number(values.unitPrice || "0"),

            reorder_level:

              values.reorderLevel.trim()

                ? Number(values.reorderLevel)

                : null,

            received_at: null,

            notes:

              values.notes.trim() || null,

          }),

        }

      );



      let body: {

        detail?: string;

        name?: string;

      } = {};



      try {

        body = await response.json();

      } catch {

        // Keep fallback message below.

      }



      if (!response.ok) {

        throw new Error(

          typeof body?.detail === "string"

            ? body.detail

            : `Unable to create inventory item. HTTP ${response.status}`

        );

      }



      setInventoryCreateMessage(

        `${body?.name || values.name.trim()} was added to inventory.`

      );



      await loadInventory();

    } catch (error) {

      setInventoryCreateMessage(

        error instanceof Error

          ? error.message

          : "Unable to create inventory item."

      );

    } finally {

      setInventoryCreateSaving(false);

    }

  }





  async function refreshInvitations() {

    if (!currentClubId) return;



    const { data, error } = await supabase

      .from("club_invitations")

      .select(

        "id,club_id,invited_email,invited_role,invited_by,status,expires_at,accepted_by,accepted_at,revoked_at,created_at"

      )

      .eq("club_id", currentClubId)

      .eq("status", "pending")

      .order("created_at", { ascending: false });



    if (error) throw error;

    setClubInvitations((data as ClubInvitation[]) || []);

  }



  async function handleCreateInvitation(

    event: React.FormEvent<HTMLFormElement>

  ) {

    event.preventDefault();

    if (!session?.access_token || !currentClubId || !canInviteUsers) return;



    if (!invitableRoles.includes(inviteRole)) {

      setInvitationsError("You cannot assign that role.");

      return;

    }



    try {

      setInviteSending(true);

      setInviteActionMessage(null);

      setInvitationsError(null);



      const response = await fetch(`${API_BASE}/club-invitations`, {

        method: "POST",

        headers: {

          Authorization: `Bearer ${session.access_token}`,

          "Content-Type": "application/json",

        },

        body: JSON.stringify({

          club_id: currentClubId,

          email: inviteEmail.trim().toLowerCase(),

          role: inviteRole,

          expires_in_hours: 72,

        }),

      });



      if (!response.ok) {

        let detail = "Unable to create invitation.";

        try {

          const body = await response.json();

          if (typeof body?.detail === "string") detail = body.detail;

        } catch {

          // Keep default message.

        }

        throw new Error(detail);

      }



      setInviteEmail("");

      setInviteActionMessage("Invitation sent successfully.");

      await refreshInvitations();

    } catch (error) {

      setInvitationsError(

        error instanceof Error ? error.message : "Unable to create invitation."

      );

    } finally {

      setInviteSending(false);

    }

  }



  async function handleRevokeInvitation(invitationId: string) {

    try {

      setRevokingInvitationId(invitationId);

      setInvitationsError(null);

      setInviteActionMessage(null);



      const { error } = await supabase.rpc("revoke_club_invitation", {

        target_invitation_id: invitationId,

        manager_note: null,

      });



      if (error) throw error;



      setClubInvitations((current) =>

        current.filter((invitation) => invitation.id !== invitationId)

      );

      setInviteActionMessage("Invitation revoked.");

    } catch (error) {

      setInvitationsError(

        error instanceof Error ? error.message : "Unable to revoke invitation."

      );

    } finally {

      setRevokingInvitationId(null);

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
    if (!inviteFirstName.trim() || !inviteLastName.trim()) {
      setInviteMessage("Please enter your first and last name.");
      return;
    }
    const nameUpdate = await supabase.auth.updateUser({data: {
      first_name: inviteFirstName.trim(), last_name: inviteLastName.trim(), phone: invitePhone.trim()
    }});
    if (nameUpdate.error) { setInviteMessage(nameUpdate.error.message); return; }


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

    setClubInvitations([]);

    setInvitationsError(null);

    setInviteActionMessage(null);

    setAvailableClinics([]);

    setInventoryItems([]);

    setInventoryError(null);

    setInventoryIncludeInactive(false);

    setInventoryCreateOpen(false);

    setInventoryCreateMessage(null);

    setInventoryMovementItem(null);

    setInventoryMovementMessage(null);

    setInventoryInfoItem(null);

    setInventoryInfoMovements([]);

    setInventoryInfoError(null);

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

    setCurrentLocationId(locationId);



    let selectedLocation: Location | null = null;

    for (const location of locations) {

      if (location.id === locationId) {

        selectedLocation = location;

        break;

      }

    }



    if (selectedLocation) {

      setCalendarDate(

        getTodayForTimeZone(selectedLocation.timezone)

      );

    }



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
<label className="form-field"><span>First name</span><input required maxLength={120} autoComplete="given-name" value={inviteFirstName} onChange={e=>setInviteFirstName(e.target.value)} /></label>
<label className="form-field"><span>Last name</span><input required maxLength={120} autoComplete="family-name" value={inviteLastName} onChange={e=>setInviteLastName(e.target.value)} /></label>
<label className="form-field"><span>Cell-phone number (optional)</span><input type="tel" maxLength={60} autoComplete="tel" value={invitePhone} onChange={e=>setInvitePhone(e.target.value)} placeholder="(555) 123-4567" /></label>


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
<label className="form-field"><span>First name</span><input required maxLength={120} autoComplete="given-name" value={inviteFirstName} onChange={e=>setInviteFirstName(e.target.value)} /></label>
<label className="form-field"><span>Last name</span><input required maxLength={120} autoComplete="family-name" value={inviteLastName} onChange={e=>setInviteLastName(e.target.value)} /></label>
<label className="form-field"><span>Cell-phone number (optional)</span><input type="tel" maxLength={60} autoComplete="tel" value={invitePhone} onChange={e=>setInvitePhone(e.target.value)} placeholder="(555) 123-4567" /></label>


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

          onSubmit={resetMode ? handlePasswordReset : handleLogin}

        >

          <div className="login-logo">DIQ</div>



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

              onChange={(event) => setEmail(event.target.value)}

              placeholder="you@example.com"

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

                onChange={(event) => setPassword(event.target.value)}

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

                onClick={() => setForgotEmailMessage((current) => !current)}

              >

                Forgot email?

              </button>

            </div>

          )}



          {forgotEmailMessage && !resetMode && (

            <div className="login-help-message">

              Contact your club manager or DeuceIQ support to confirm the email

              associated with your account. New users must be invited by an

              authorized club staff member.

            </div>

          )}



          {loginError && !resetMode && (

            <div className="login-error">{loginError}</div>

          )}



          {resetMessage && (

            <div className="login-help-message">{resetMessage}</div>

          )}



          <button

            type="submit"

            className="primary-button login-button"

            disabled={resetMode ? resetLoading : loginLoading}

          >

            {resetMode

              ? resetLoading

                ? "Sending..."

                : "Send reset email"

              : loginLoading

                ? "Signing in..."

                : "Sign in"}

          </button>



          {!resetMode && <a className="login-back-button" href="/register-club">Register your club</a>}

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



  let currentLocation: Location | null = null;

  if (Array.isArray(locations)) {

    for (const location of locations) {

      if (location.id === currentLocationId) {

        currentLocation = location;

        break;

      }

    }

  }



  const selectedTimeZone =

    currentLocation?.timezone ||

    Intl.DateTimeFormat().resolvedOptions().timeZone ||

    "UTC";



  let displayPageTitle = "DeuceIQ";



  if (section === "bookings" && clubRole === "member") {

    displayPageTitle = "My Bookings";

  } else if (section === "clinics" && clubRole === "member") {

    displayPageTitle = "Available Clinics";

  } else {

    for (const item of visibleNavigationItems) {

      if (item.id === section) {

        displayPageTitle = item.id === "conversations" && clubRole === "member" ? "Chat Room" : item.label;

        break;

      }

    }

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

            <p>{clubName}</p>

          </div>

        </div>



        <div className="sidebar-label">

          {clubRole === "member"

            ? "MEMBER"

            : "MANAGEMENT"}

        </div>



        <nav className="navigation">
          <PlatformAdminLink userId={session.user.id} />

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



                <span className="nav-label">

                  {item.id ===

                    "bookings" &&

                  clubRole === "member"

                    ? "My Bookings"

                    : item.id ===

                          "clinics" &&

                        clubRole ===

                          "member"

                      ? "Available Clinics"

                      : item.id === "conversations" && clubRole === "member" ? "Chat Room" : item.label}
                  {item.id === "conversations" && ["manager","front_desk"].includes(clubRole??"") && currentClubId && <StaffSummaryIndicator key={`${session.user.id}:${currentClubId}`} clubId={currentClubId} userId={session.user.id}/>}
                  {item.id === "conversations" && clubRole === "member" && currentClubId && <ChatMessageIndicator key={`${session.user.id}:${currentClubId}`} clubId={currentClubId} userId={session.user.id}/>}
                  {item.id === "bookings" && clubRole === "member" && currentClubId && <BookingMessageIndicator key={`${session.user.id}:${currentClubId}`} context={{apiBase:API_BASE,userId:session.user.id,clubId:currentClubId,role:clubRole}}/>}
                  {item.id === "notifications" && currentClubId && <NotificationIndicator key={`${session.user.id}:${currentClubId}`} apiBase={API_BASE} userId={session.user.id} clubId={currentClubId} role={clubRole ?? ""}/>}

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

                {(clubRole ?? "").replace(

                  "_",

                  " "

                )}

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



            {locations.length > 0 && (

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

                disabled={!currentLocationId}

                onClick={() => { setCreateMessage(null); setCreateAction("booking"); }}

              >

                + Create Booking

              </button>

            )}

          </div>

        </header>



        {createMessage && <p className="quick-action-result" role="status">{createMessage}</p>}



        {createAction && canManageBookings && currentClubId && (

          <QuickCreate

            key={`${session.user.id}:${currentClubId}:${currentLocationId}:${createAction}`}

            initialRange={createRange} kind={createAction} apiBase={API_BASE} clubId={currentClubId} role={clubRole}

            userId={session.user.id} locationId={currentLocationId}

            locationName={currentLocation?.name ?? "No location selected"}

            timeZone={currentLocation?.timezone || "UTC"} date={calendarDate} courts={courts}

            onClose={() => {setCreateAction(null);setCreateRange(null);}}

            onCreated={(kind, date, message) => {

              setCreateAction(null); setCreateRange(null); setCreateMessage(message); setDataRevision(v => v + 1);

              if (kind === "member") { setMemberSearch(""); setSection("members"); }

              else { setCalendarDate(date); setSection("calendar"); }

            }}

          />

        )}



        {availabilityOpen && clubRole === "member" && currentClubId && currentLocationId && (

          <MemberAvailability key={`${session.user.id}:${currentClubId}:${currentLocationId}`}

            apiBase={API_BASE} userId={session.user.id} clubId={currentClubId} locationId={currentLocationId}

            locationName={currentLocation?.name ?? null} timeZone={selectedTimeZone} onClose={() => setAvailabilityOpen(false)} />

        )}

        {section === "overview" && clubRole === "owner" && currentClubId && <OwnerChecklist key={`${session.user.id}:${currentClubId}`} apiBase={API_BASE} userId={session.user.id} clubId={currentClubId} role={clubRole} onNavigate={destination => setSection(destination)} />}
        {section === "overview" && (

          <OverviewPage

            onOpenConversations={()=>setSection("conversations")}
            memberContext={{ apiBase: API_BASE, userId: session.user.id, clubId: currentClubId ?? "", locationId: currentLocationId, locationName: currentLocation?.name ?? null, timeZone: selectedTimeZone }}

            onOpenAvailability={() => setAvailabilityOpen(true)}

            clubRole={clubRole ?? ""}

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

            canCreateAtLocation={Boolean(currentLocationId)}

            onCreateBooking={() => { setCreateMessage(null); setCreateAction("booking"); }}

            onCreateClinic={() => { setCreateMessage(null); setCreateAction("clinic"); }}

            onOpenMembers={() => { setCreateMessage(null); setCreateAction("member"); }}

          />

        )}



        {section === "calendar" && (

          <CalendarBoard

            bookings={bookingsScope===`${session.user.id}:${currentClubId}:${currentLocationId}:${calendarDate}`?bookings:[]}

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

            timeZone={selectedTimeZone}

            apiBase={API_BASE} userId={session.user.id} canEdit={canManageBookings} clubId={currentClubId ?? ""} locationId={currentLocationId ?? ""} onOpenRequests={()=>setSection("bookings")} onCreateRange={(courtId,start,end)=>{setCreateRange({courtId,start,end});setCreateMessage(null);setCreateAction("booking");}}

            key={`${session.user.id}:${currentClubId}:${currentLocationId}:${calendarDate}`}

            onUpdated={() => setDataRevision(v => v + 1)}

          />

        )}



        {section === "bookings" &&

          (clubRole === "member" ? (

            <MemberBookingsPage key={`${session.user.id}:${currentClubId}`} apiBase={API_BASE} userId={session.user.id} clubId={currentClubId ?? ""} locations={locations} />

          ) : (

            <StaffBookings key={`${session.user.id}:${currentClubId}`} apiBase={API_BASE} userId={session.user.id} clubId={currentClubId ?? ""} role={clubRole ?? ""} locations={locations} initialLocation={currentLocationId ?? ""}
              onCreate={() => {setCreateMessage(null);setCreateAction("booking");}}
              onCalendar={(location,date) => {setCurrentLocationId(location);setCalendarDate(date);setSection("calendar");}}
              onChanged={() => setDataRevision(v => v+1)} />

          ))}



        {section === "clinics" && currentClubId && ["owner","director","manager","front_desk","member"].includes(clubRole ?? "") && (
          <ClinicSchedule apiBase={API_BASE} key={`${session.user.id}:${currentClubId}:${dataRevision}`} clubId={currentClubId} userId={session.user.id} role={clubRole ?? ""} canCreate={Boolean(currentLocationId)}
            onCreate={() => { setCreateMessage(null); setCreateAction("clinic"); }}
            onRegister={async id => {
              try {
                const auth = await supabase.auth.getSession();
                if (auth.error || auth.data.session?.user.id !== session.user.id) throw new Error("Your session changed. Sign in again.");
                const response = await fetch(`${API_BASE}/member/clinics?club_id=${encodeURIComponent(currentClubId)}`, { headers: { Authorization: `Bearer ${auth.data.session.access_token}` } });
                if (!response.ok) throw new Error("Clinic availability could not be checked. Please try again.");
                const body = await response.json();
                const clinic = Array.isArray(body.clinics) ? (body.clinics as MemberClinic[]).find(c => c.booking_id === id) : null;
                if (!clinic) throw new Error("This session is no longer available. Refresh the schedule.");
                setClinicDecisionMessage(null); setSelectedClinic(clinic);
              } catch (e) { throw new Error(e instanceof Error ? e.message : "Unable to open clinic registration."); }
            }} />
        )}

        {section === "notifications" && currentClubId && <NotificationsPage key={`${session.user.id}:${currentClubId}`} apiBase={API_BASE} userId={session.user.id} clubId={currentClubId} role={clubRole ?? ""}/>}

        {section === "conversations" && currentClubId && <><MemberChat key={`chat:${session.user.id}:${currentClubId}`} apiBase={API_BASE} userId={session.user.id} clubId={currentClubId} role={clubRole??""}/><StaffConversations key={`summaries:${session.user.id}:${currentClubId}`} context={{apiBase:API_BASE,userId:session.user.id,clubId:currentClubId,role:clubRole??""}}/></>}
        {section === "history" && currentClubId && ["owner","director","manager","front_desk"].includes(clubRole ?? "") && <HistoryPage key={`${session.user.id}:${currentClubId}`} clubId={currentClubId} userId={session.user.id} role={clubRole ?? ""} locations={locations}/>}

        {section === "members" && (

          <MembersPage
            clubId={currentClubId ?? ""} userId={session.user.id} role={clubRole ?? ""}

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



        {section === "pros" && <ProsPage key={`${session.user.id}:${currentClubId}`} apiBase={API_BASE} userId={session.user.id} clubId={currentClubId ?? ""} role={clubRole ?? ""} />}

        {section === "approvals" && canInviteUsers && (

          <InvitationsPage

            invitations={clubInvitations}

            loading={invitationsLoading}

            error={invitationsError}

            email={inviteEmail}

            setEmail={setInviteEmail}

            role={inviteRole}

            setRole={setInviteRole}

            availableRoles={invitableRoles}

            sending={inviteSending}

            actionMessage={inviteActionMessage}

            revokingId={revokingInvitationId}

            onCreate={handleCreateInvitation}

            onRevoke={handleRevokeInvitation}

          />

        )}





        {section === "opportunity" && (

          <PlaceholderPage

            title="Opportunity Center"

            description="Surface openings, member opportunities and intelligent recommendations."

          />

        )}



        {section === "inventory" && canManageInventory && (

          <InventoryPage

            items={inventoryItems}

            locations={locations}

            loading={inventoryLoading}

            error={inventoryError}

            includeInactive={inventoryIncludeInactive}

            setIncludeInactive={setInventoryIncludeInactive}

            onCreateItem={() => {

              setInventoryCreateMessage(null);

              setInventoryCreateOpen(true);

            }}

            onRecordMovement={(item) => {

              setInventoryMovementMessage(null);

              setInventoryMovementItem(item);

            }}

            onMoreInfo={handleOpenInventoryInfo}

          />

        )}



        {clubRole === "owner" && new URLSearchParams(window.location.search).has("stripe_connect") && <div role="status" className="members-card"><p>Returned from Stripe. Open your club's payment settings to check its connection or continue setup.</p><button onClick={() => {setSection("settings"); const url = new URL(window.location.href); url.searchParams.delete("stripe_connect"); url.searchParams.delete("stripe_club"); window.history.replaceState({}, "", url);}}>Open payment settings</button></div>}
        {section === "settings" && <SettingsPage key={`${session.user.id}:${currentClubId}`} apiBase={API_BASE} userId={session.user.id} clubId={currentClubId ?? ""} role={clubRole ?? ""} onChanged={() => setDataRevision(v=>v+1)} />}

        {section === "inventory" &&

          canManageInventory &&

          inventoryInfoItem && (

          <InventoryInfoModal

            item={inventoryInfoItem}

            movements={inventoryInfoMovements}

            loading={inventoryInfoLoading}

            error={inventoryInfoError}

            onClose={() => {

              if (inventoryInfoLoading) return;

              setInventoryInfoItem(null);

              setInventoryInfoMovements([]);

              setInventoryInfoError(null);

            }}

          />

        )}



        {section === "inventory" &&

          canManageInventory &&

          inventoryMovementItem && (

          <InventoryMovementModal

            item={inventoryMovementItem}

            saving={inventoryMovementSaving}

            message={inventoryMovementMessage}

            onClose={() => {

              if (inventoryMovementSaving) return;

              setInventoryMovementItem(null);

              setInventoryMovementMessage(null);

            }}

            onSave={(values) =>

              handleCreateInventoryMovement(

                inventoryMovementItem,

                values

              )

            }

          />

        )}



        {section === "inventory" &&

          canManageInventory &&

          inventoryCreateOpen && (

          <InventoryCreateModal

            locationName={currentLocation?.name ?? null}

            saving={inventoryCreateSaving}

            message={inventoryCreateMessage}

            onClose={() => {

              if (inventoryCreateSaving) return;

              setInventoryCreateOpen(false);

              setInventoryCreateMessage(null);

            }}

            onCreate={handleCreateInventoryItem}

          />

        )}



        {clubRole === "member" && selectedClinic && (

          <ClinicDetailModal
            userId={session.user.id} clubId={currentClubId ?? ""}

            clinic={selectedClinic}

            message={clinicDecisionMessage}

            registering={clinicRegistering}

            onClose={() => {

              if (clinicRegistering) return;

              setSelectedClinic(null);

              setClinicDecisionMessage(null);

            }}

            onAttend={(friend) =>

              handleMemberClinicRegistration(

                selectedClinic,

                friend

              )

            }

          />

        )}

      </main>

    </div>

  );

}



function OverviewPage({

  memberContext,

  onOpenAvailability,

  onOpenConversations,
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

  onCreateBooking,

  onCreateClinic,

  canCreateAtLocation,

}: {

  memberContext: MemberHomeContext;

  onOpenAvailability: () => void;

  onOpenConversations: () => void;
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

  onCreateBooking: () => void;

  onCreateClinic: () => void;

  canCreateAtLocation: boolean;

}) {

  return (

    <section className="overview">

      <div className="overview-grid">
        {["member","manager","front_desk"].includes(clubRole)&&<button className="metric-card" onClick={onOpenConversations} style={{textAlign:"left",color:"inherit"}}><span>{clubRole==="member"?"Chat Room":"Conversations"}</span><strong>Open</strong><small>{clubRole==="member"?"Chat privately with club members":"Review summaries shared by members"}</small></button>}

        <LocationWeather key={memberContext.locationId} {...memberContext} />
        {clubRole !== "member" && <div className="weather-card">

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





        </div>}



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

              <button type="button" disabled={!canCreateAtLocation} onClick={onCreateBooking}>

                <span>&#65291;</span>

                Create Booking

              </button>



              <button type="button" disabled={!canCreateAtLocation} onClick={onCreateClinic}>

                <span>&#9678;</span>

                Create Clinic

              </button>



              <button

                onClick={

                  onOpenMembers

                }

              >

                <span>&#9817;</span>

                Add Member

              </button>



              <button

                onClick={

                  onOpenCalendar

                }

              >

                <span>&#9638;</span>

                View Calendar

              </button>

            </div>

          </div>

        )}

      </div>



      {["owner", "director", "manager"].includes(clubRole) && <WeatherSetup key={memberContext.locationId} {...memberContext} />}

      <div className="metric-grid">
        <PlatformAdminLink userId={memberContext.userId} variant="overview" />

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



            <button className="metric-card" disabled={!memberContext.locationId} onClick={onOpenAvailability} style={{ textAlign: "left", color: "inherit" }}>

              <span>Court Availability</span><strong>Find a time &#8594;</strong><small>Check openings and request a court</small>

            </button>

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

        <AvailabilityAction disabled={!memberContext.locationId} onClick={onOpenAvailability} />

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





function ClinicDetailModal({
  userId, clubId,

  clinic,

  message,

  registering,

  onClose,

  onAttend,

}: {

  userId: string; clubId: string;
  clinic: MemberClinic;

  message: string | null;

  registering: boolean;

  onClose: () => void;

  onAttend: (

    friend?: {

      firstName: string;

      lastName: string;

      email: string;

      phone: string;

    }

  ) => void;

}) {

  const [addFriend, setAddFriend] =

    useState(false);

  const [friendFirstName, setFriendFirstName] =

    useState("");

  const [friendLastName, setFriendLastName] =

    useState("");

  const [friendEmail, setFriendEmail] =

    useState("");

  const [friendPhone, setFriendPhone] =

    useState("");



  const actionLabel =

    clinic.registration_status === "waitlist" ||

    clinic.is_full

      ? "Join Waitlist"

      : "Confirm registration";



  const friendFieldsValid =

    !addFriend ||

    (

      friendFirstName.trim().length > 0 &&

      friendLastName.trim().length > 0 &&

      friendEmail.trim().length > 0

    );



  return (

    <div

      role="presentation"

      onMouseDown={(event) => {

        if (

          event.currentTarget === event.target &&

          !registering

        ) {

          onClose();

        }

      }}

      style={{

        position: "fixed",

        inset: 0,

        zIndex: 1000,

        background: "rgba(8, 14, 24, 0.58)",

        display: "grid",

        placeItems: "center",

        padding: "24px",

      }}

    >

      <section

        role="dialog"

        aria-modal="true"

        aria-labelledby="clinic-detail-title"

        className="members-card"

        style={{

          width: "min(600px, 100%)",

          maxHeight: "88vh",

          overflowY: "auto",

          boxShadow:

            "0 24px 70px rgba(0, 0, 0, 0.28)",

        }}

      >

        <div className="card-heading">

          <div>

            <p className="card-kicker">

              CLINIC DETAILS

            </p>



            <h3 id="clinic-detail-title">

              {clinic.name}

            </h3>
        <PricePreview userId={userId} clubId={clubId} bookingId={clinic.booking_id} guestCount={addFriend?1:0} friendEmail={addFriend?friendEmail:undefined}/>




            <p className="card-description">

              Review the clinic before choosing

              whether to attend.

            </p>

          </div>



          <button

            type="button"

            className="secondary-button"

            onClick={onClose}

            disabled={registering}

          >

            Close

          </button>

        </div>



        <div

          style={{

            display: "grid",

            gap: "14px",

            marginTop: "18px",

          }}

        >

          <div className="member-row">

            <div className="member-main">

              <strong>

                {new Date(

                  clinic.starts_at

                ).toLocaleString(

                  "en-US",

                  {

                    weekday: "long",

                    month: "long",

                    day: "numeric",

                    hour: "numeric",

                    minute: "2-digit",

                  }

                )}

              </strong>



              <span>

                {clinic.location_name ||

                  "Location TBD"}

              </span>



              <span>

                {clinic.pro_name ||

                  "Pro TBD"}

              </span>

            </div>



            <div className="member-meta">

              <span>

                {clinic.spots_remaining > 0

                  ? `${clinic.spots_remaining} spots open`

                  : "Clinic full"}

              </span>



              <span>

                {clinic.enrolled_count}/

                {clinic.capacity} enrolled

              </span>



              {clinic.waitlist_count > 0 && (

                <span>

                  {clinic.waitlist_count} waitlisted

                </span>

              )}

            </div>

          </div>



          {clinic.is_full && (

            <div className="member-message" role="status" aria-live="polite">

              This clinic is full. Continuing

              will place you on the waitlist.

            </div>

          )}



          <label

            style={{

              display: "flex",

              alignItems: "center",

              gap: "10px",

              cursor: registering

                ? "default"

                : "pointer",

            }}

          >

            <input

              type="checkbox"

              checked={addFriend}

              disabled={registering}

              onChange={(event) => {

                setAddFriend(

                  event.target.checked

                );



                if (

                  !event.target.checked

                ) {

                  setFriendFirstName("");

                  setFriendLastName("");

                  setFriendEmail("");

                  setFriendPhone("");

                }

              }}

            />



            <span>

              Add a friend

            </span>

          </label>



          {addFriend && (

            <div

              style={{

                display: "grid",

                gap: "12px",

              }}

            >

              <div

                style={{

                  display: "grid",

                  gridTemplateColumns:

                    "repeat(2, minmax(0, 1fr))",

                  gap: "12px",

                }}

              >

                <label className="form-field">

                  <span>

                    Friend first name

                  </span>



                  <input

                    type="text"

                    value={

                      friendFirstName

                    }

                    onChange={(event) =>

                      setFriendFirstName(

                        event.target.value

                      )

                    }

                    disabled={registering}

                    required

                  />

                </label>



                <label className="form-field">

                  <span>

                    Friend last name

                  </span>



                  <input

                    type="text"

                    value={

                      friendLastName

                    }

                    onChange={(event) =>

                      setFriendLastName(

                        event.target.value

                      )

                    }

                    disabled={registering}

                    required

                  />

                </label>

              </div>



              <label className="form-field">

                <span>

                  Friend email

                </span>



                <input

                  type="email"

                  value={friendEmail}

                  onChange={(event) =>

                    setFriendEmail(

                      event.target.value

                    )

                  }

                  placeholder="friend@example.com"

                  disabled={registering}

                  required

                />

              </label>



              <label className="form-field">

                <span>

                  Friend phone (optional)

                </span>



                <input

                  type="tel"

                  value={friendPhone}

                  onChange={(event) =>

                    setFriendPhone(

                      event.target.value

                    )

                  }

                  disabled={registering}

                />

              </label>



              <div className="member-message" role="status" aria-live="polite">

                DeuceIQ will check the email

                against this club first. If the

                person is already a member, their

                existing member profile will be

                used. DeuceIQ will also check for

                overlapping clinics, lessons, or

                other bookings before adding them.

                If they are not a member, they will

                be handled as a guest.

              </div>

            </div>

          )}



          {message && (

            <div className="member-message" role="status" aria-live="polite">

              {message}

            </div>

          )}



          <div

            style={{

              display: "flex",

              justifyContent: "flex-end",

              gap: "10px",

              marginTop: "8px",

            }}

          >

            <button

              type="button"

              className="secondary-button"

              onClick={onClose}

              disabled={registering}

            >

              Cancel

            </button>



            <button

              type="button"

              className="primary-button"

              disabled={

                registering ||

                !friendFieldsValid

              }

              onClick={() =>

                onAttend(

                  addFriend

                    ? {

                        firstName:

                          friendFirstName,

                        lastName:

                          friendLastName,

                        email:

                          friendEmail,

                        phone:

                          friendPhone,

                      }

                    : undefined

                )

              }

            >

              {registering

                ? "Registering..."

                : addFriend

                  ? `${actionLabel} + Friend`

                  : actionLabel}

            </button>

          </div>

        </div>

      </section>

    </div>

  );

}













function InventoryLineChart({

  title,

  points,

  unit,

  money = false,

}: {

  title: string;

  points: {

    date: string;

    value: number;

  }[];

  unit: string;

  money?: boolean;

}) {

  const width = 680;

  const height = 220;

  const paddingLeft = 58;

  const paddingRight = 18;

  const paddingTop = 24;

  const paddingBottom = 42;



  const validPoints = points.filter(

    (point) =>

      Number.isFinite(point.value) &&

      !Number.isNaN(

        new Date(point.date).getTime()

      )

  );



  if (validPoints.length === 0) {

    return (

      <div className="empty-state">

        No graph data is available yet.

      </div>

    );

  }



  const values = validPoints.map(

    (point) => point.value

  );



  let minValue = Math.min(...values);

  let maxValue = Math.max(...values);



  if (minValue === maxValue) {

    const padding =

      Math.abs(minValue) > 0

        ? Math.abs(minValue) * 0.1

        : 1;



    minValue -= padding;

    maxValue += padding;

  }



  const chartWidth =

    width - paddingLeft - paddingRight;



  const chartHeight =

    height - paddingTop - paddingBottom;



  const denominator =

    validPoints.length > 1

      ? validPoints.length - 1

      : 1;



  const plotted = validPoints.map(

    (point, index) => {

      const x =

        paddingLeft +

        (index / denominator) * chartWidth;



      const normalized =

        (point.value - minValue) /

        (maxValue - minValue);



      const y =

        paddingTop +

        (1 - normalized) * chartHeight;



      return {

        ...point,

        x,

        y,

      };

    }

  );



  const polylinePoints =

    plotted

      .map(

        (point) =>

          `${point.x},${point.y}`

      )

      .join(" ");



  function formatValue(value: number) {

    if (money) {

      return new Intl.NumberFormat(

        "en-US",

        {

          style: "currency",

          currency: "USD",

          maximumFractionDigits: 2,

        }

      ).format(value);

    }



    return `${value} ${unit}`;

  }



  function formatDate(value: string) {

    return new Date(value).toLocaleDateString(

      "en-US",

      {

        month: "short",

        day: "numeric",

      }

    );

  }



  const firstPoint = plotted[0];

  const lastPoint =

    plotted[plotted.length - 1];



  return (

    <div

      style={{

        border: "1px solid rgba(128, 128, 128, 0.24)",

        borderRadius: "12px",

        padding: "16px",

      }}

    >

      <div

        style={{

          display: "flex",

          alignItems: "baseline",

          justifyContent: "space-between",

          gap: "12px",

          marginBottom: "10px",

        }}

      >

        <strong>{title}</strong>



        <span>

          Current:{" "}

          {formatValue(

            lastPoint.value

          )}

        </span>

      </div>



      <div

        style={{

          width: "100%",

          overflowX: "auto",

        }}

      >

        <svg

          viewBox={`0 0 ${width} ${height}`}

          role="img"

          aria-label={title}

          style={{

            display: "block",

            width: "100%",

            minWidth: "520px",

            height: "auto",

          }}

        >

          <line

            x1={paddingLeft}

            y1={paddingTop}

            x2={paddingLeft}

            y2={height - paddingBottom}

            stroke="currentColor"

            opacity="0.25"

          />



          <line

            x1={paddingLeft}

            y1={height - paddingBottom}

            x2={width - paddingRight}

            y2={height - paddingBottom}

            stroke="currentColor"

            opacity="0.25"

          />



          <text

            x="4"

            y={paddingTop + 4}

            fontSize="12"

            fill="currentColor"

            opacity="0.75"

          >

            {formatValue(maxValue)}

          </text>



          <text

            x="4"

            y={height - paddingBottom + 4}

            fontSize="12"

            fill="currentColor"

            opacity="0.75"

          >

            {formatValue(minValue)}

          </text>



          {validPoints.length > 1 && (

            <polyline

              points={polylinePoints}

              fill="none"

              stroke="currentColor"

              strokeWidth="3"

              strokeLinejoin="round"

              strokeLinecap="round"

            />

          )}



          {plotted.map(

            (point, index) => (

              <g

                key={`${point.date}-${index}`}

              >

                <circle

                  cx={point.x}

                  cy={point.y}

                  r="4.5"

                  fill="currentColor"

                >

                  <title>

                    {`${new Date(

                      point.date

                    ).toLocaleString()} \u2022 ${formatValue(

                      point.value

                    )}`}

                  </title>

                </circle>

              </g>

            )

          )}



          <text

            x={paddingLeft}

            y={height - 12}

            fontSize="12"

            fill="currentColor"

            opacity="0.75"

            textAnchor="start"

          >

            {formatDate(

              firstPoint.date

            )}

          </text>



          <text

            x={width - paddingRight}

            y={height - 12}

            fontSize="12"

            fill="currentColor"

            opacity="0.75"

            textAnchor="end"

          >

            {formatDate(

              lastPoint.date

            )}

          </text>

        </svg>

      </div>

    </div>

  );

}





function InventoryInfoModal({

  item,

  movements,

  loading,

  error,

  onClose,

}: {

  item: InventoryItem;

  movements: InventoryMovement[];

  loading: boolean;

  error: string | null;

  onClose: () => void;

}) {

  function asNumber(value: number | string | null) {

    if (value === null) {

      return null;

    }



    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;

  }



  function formatMoney(value: number | string | null) {

    const numericValue = asNumber(value) ?? 0;



    return new Intl.NumberFormat("en-US", {

      style: "currency",

      currency: "USD",

    }).format(numericValue);

  }



  function movementLabel(value: string) {

    return value

      .replaceAll("_", " ")

      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  }



  return (

    <div

      role="presentation"

      onMouseDown={(event) => {

        if (

          event.currentTarget === event.target &&

          !loading

        ) {

          onClose();

        }

      }}

      style={{

        position: "fixed",

        inset: 0,

        zIndex: 1000,

        background: "rgba(8, 14, 24, 0.58)",

        display: "grid",

        placeItems: "center",

        padding: "24px",

      }}

    >

      <section

        role="dialog"

        aria-modal="true"

        aria-labelledby="inventory-info-title"

        className="members-card"

        style={{

          width: "min(760px, 100%)",

          maxHeight: "88vh",

          overflowY: "auto",

          boxShadow:

            "0 24px 70px rgba(0, 0, 0, 0.28)",

        }}

      >

        <div className="card-heading">

          <div>

            <p className="card-kicker">

              INVENTORY DETAILS

            </p>



            <h3 id="inventory-info-title">

              {item.name}

            </h3>



            <p className="card-description">

              Current inventory status and complete

              movement history.

            </p>

          </div>



          <button

            type="button"

            className="secondary-button"

            onClick={onClose}

            disabled={loading}

          >

            Close

          </button>

        </div>



        <div

          className="metric-grid"

          style={{ marginTop: "18px" }}

        >

          <MetricCard

            label="Quantity"

            value={`${item.inventory_count} ${item.unit_label}`}

            detail={item.active ? "Active item" : "Inactive item"}

          />



          <MetricCard

            label="Unit Price"

            value={formatMoney(item.unit_price)}

            detail="Current unit value"

          />



          <MetricCard

            label="Asset Value"

            value={formatMoney(item.updated_asset_value)}

            detail="Current inventory value"

          />



          <MetricCard

            label="Reorder Level"

            value={

              item.reorder_level === null

                ? "Not set"

                : String(item.reorder_level)

            }

            detail="Low-stock threshold"

          />

        </div>



        <div

          className="schedule-card"

          style={{ marginTop: "18px" }}

        >

          <div className="card-heading schedule-heading">

            <div>

              <p className="card-kicker">

                HISTORY

              </p>



              <h3>Inventory Movements</h3>

            </div>



            <span className="member-count">

              {movements.length} movements

            </span>

          </div>



          {loading && (

            <div className="member-message">

              Loading movement history...

            </div>

          )}



          {error && (

            <div className="member-message error">

              {error}

            </div>

          )}



          {!loading &&

            !error &&

            movements.length === 0 && (

              <div className="empty-state">

                No movements have been recorded

                for this item yet.

              </div>

            )}



          {!loading &&

            !error &&

            movements.length > 0 && (

              <div className="member-list">

                {movements.map((movement) => {

                  const change =

                    asNumber(movement.quantity_change) ?? 0;



                  return (

                    <div

                      key={movement.id}

                      className="member-row"

                    >

                      <div className="member-main">

                        <strong>

                          {movementLabel(

                            movement.movement_type

                          )}

                        </strong>



                        <span>

                          {new Date(

                            movement.occurred_at

                          ).toLocaleString()}

                        </span>



                        {movement.notes && (

                          <span>

                            {movement.notes}

                          </span>

                        )}

                      </div>



                      <div className="member-meta">

                        <span>

                          {change > 0 ? "+" : ""}

                          {change} {item.unit_label}

                        </span>



                        <span>

                          Result:{" "}

                          {movement.resulting_inventory_count}

                        </span>



                        <span>

                          Value:{" "}

                          {formatMoney(

                            movement.asset_value_after

                          )}

                        </span>

                      </div>

                    </div>

                  );

                })}

              </div>

            )}

        </div>



        <div

          className="schedule-card"

          style={{ marginTop: "18px" }}

        >

          <div className="card-heading schedule-heading">

            <div>

              <p className="card-kicker">

                TRENDS

              </p>



              <h3>Supply and Value</h3>

            </div>

          </div>



          {!loading &&

            !error &&

            movements.length > 0 && (

              <div

                style={{

                  display: "grid",

                  gap: "20px",

                  marginTop: "16px",

                }}

              >

                <InventoryLineChart

                  title="Supply Over Time"

                  unit={item.unit_label}

                  points={movements.map(

                    (movement) => ({

                      date: movement.occurred_at,

                      value: Number(

                        movement.resulting_inventory_count

                      ),

                    })

                  )}

                />



                <InventoryLineChart

                  title="Asset Value Over Time"

                  unit="USD"

                  money

                  points={movements.map(

                    (movement) => ({

                      date: movement.occurred_at,

                      value: Number(

                        movement.asset_value_after

                      ),

                    })

                  )}

                />

              </div>

            )}



          {!loading &&

            !error &&

            movements.length === 0 && (

              <div className="empty-state">

                Record inventory movements to begin

                building supply and asset-value graphs.

              </div>

            )}

        </div>

      </section>

    </div>

  );

}





function InventoryMovementModal({

  item,

  saving,

  message,

  onClose,

  onSave,

}: {

  item: InventoryItem;

  saving: boolean;

  message: string | null;

  onClose: () => void;

  onSave: (values: {

    movementType: string;

    quantity: string;

    unitPrice: string;

    notes: string;

  }) => void;

}) {

  const [movementType, setMovementType] =

    useState("received");

  const [quantity, setQuantity] =

    useState("");

  const [unitPrice, setUnitPrice] =

    useState("");

  const [notes, setNotes] =

    useState("");



  const quantityNumber = Number(quantity);



  const valid =

    quantity.trim().length > 0 &&

    Number.isFinite(quantityNumber) &&

    quantityNumber > 0 &&

    (

      unitPrice.trim() === "" ||

      (

        Number.isFinite(Number(unitPrice)) &&

        Number(unitPrice) >= 0

      )

    );



  const currentCount = Number(item.inventory_count);



  return (

    <div

      role="presentation"

      onMouseDown={(event) => {

        if (

          event.currentTarget === event.target &&

          !saving

        ) {

          onClose();

        }

      }}

      style={{

        position: "fixed",

        inset: 0,

        zIndex: 1000,

        background: "rgba(8, 14, 24, 0.58)",

        display: "grid",

        placeItems: "center",

        padding: "24px",

      }}

    >

      <section

        role="dialog"

        aria-modal="true"

        aria-labelledby="inventory-movement-title"

        className="members-card"

        style={{

          width: "min(560px, 100%)",

          maxHeight: "88vh",

          overflowY: "auto",

          boxShadow:

            "0 24px 70px rgba(0, 0, 0, 0.28)",

        }}

      >

        <div className="card-heading">

          <div>

            <p className="card-kicker">

              INVENTORY MOVEMENT

            </p>



            <h3 id="inventory-movement-title">

              {item.name}

            </h3>



            <p className="card-description">

              Current quantity:{" "}

              {Number.isFinite(currentCount)

                ? currentCount

                : item.inventory_count}{" "}

              {item.unit_label}

            </p>

          </div>



          <button

            type="button"

            className="secondary-button"

            onClick={onClose}

            disabled={saving}

          >

            Close

          </button>

        </div>



        <div

          style={{

            display: "grid",

            gap: "14px",

            marginTop: "18px",

          }}

        >

          <label className="form-field">

            <span>Movement type</span>



            <select

              value={movementType}

              onChange={(event) =>

                setMovementType(event.target.value)

              }

              disabled={saving}

            >

              <option value="received">

                Received

              </option>

              <option value="used">

                Used

              </option>

              <option value="sold">

                Sold

              </option>

              <option value="damaged">

                Damaged

              </option>

              <option value="returned">

                Returned

              </option>

              <option value="adjustment">

                Adjustment

              </option>

            </select>

          </label>



          <label className="form-field">

            <span>Quantity</span>



            <input

              type="number"

              min="0.01"

              step="0.01"

              value={quantity}

              onChange={(event) =>

                setQuantity(event.target.value)

              }

              placeholder="2"

              disabled={saving}

              required

            />

          </label>



          <label className="form-field">

            <span>

              Unit price (optional)

            </span>



            <input

              type="number"

              min="0"

              step="0.01"

              value={unitPrice}

              onChange={(event) =>

                setUnitPrice(event.target.value)

              }

              placeholder={String(item.unit_price)}

              disabled={saving}

            />

          </label>



          <label className="form-field">

            <span>Notes (optional)</span>



            <textarea

              value={notes}

              onChange={(event) =>

                setNotes(event.target.value)

              }

              rows={3}

              placeholder="Reason for this inventory change"

              disabled={saving}

            />

          </label>



          <div className="member-message">

            Enter the number of units only.

            DeuceIQ automatically treats Used,

            Sold and Damaged as reductions.

            Received and Returned increase stock.

          </div>



          {message && (

            <div className="member-message">

              {message}

            </div>

          )}



          <div

            style={{

              display: "flex",

              justifyContent: "flex-end",

              gap: "10px",

            }}

          >

            <button

              type="button"

              className="secondary-button"

              onClick={onClose}

              disabled={saving}

            >

              Cancel

            </button>



            <button

              type="button"

              className="primary-button"

              disabled={saving || !valid}

              onClick={() =>

                onSave({

                  movementType,

                  quantity,

                  unitPrice,

                  notes,

                })

              }

            >

              {saving

                ? "Recording..."

                : "Record Movement"}

            </button>

          </div>

        </div>

      </section>

    </div>

  );

}





function InventoryCreateModal({

  locationName,

  saving,

  message,

  onClose,

  onCreate,

}: {

  locationName: string | null;

  saving: boolean;

  message: string | null;

  onClose: () => void;

  onCreate: (values: {

    name: string;

    category: string;

    sku: string;

    unitLabel: string;

    initialQuantity: string;

    unitPrice: string;

    reorderLevel: string;

    notes: string;

  }) => void;

}) {

  const [name, setName] = useState("");

  const [category, setCategory] = useState("other");

  const [sku, setSku] = useState("");

  const [unitLabel, setUnitLabel] = useState("unit");

  const [initialQuantity, setInitialQuantity] = useState("0");

  const [unitPrice, setUnitPrice] = useState("0");

  const [reorderLevel, setReorderLevel] = useState("");

  const [notes, setNotes] = useState("");



  const valid =

    name.trim().length > 0 &&

    category.trim().length > 0 &&

    unitLabel.trim().length > 0 &&

    Number(initialQuantity) >= 0 &&

    Number(unitPrice) >= 0 &&

    (

      reorderLevel.trim() === "" ||

      Number(reorderLevel) >= 0

    );



  return (

    <div

      role="presentation"

      onMouseDown={(event) => {

        if (

          event.currentTarget === event.target &&

          !saving

        ) {

          onClose();

        }

      }}

      style={{

        position: "fixed",

        inset: 0,

        zIndex: 1000,

        background: "rgba(8, 14, 24, 0.58)",

        display: "grid",

        placeItems: "center",

        padding: "24px",

      }}

    >

      <section

        role="dialog"

        aria-modal="true"

        aria-labelledby="inventory-create-title"

        className="members-card"

        style={{

          width: "min(620px, 100%)",

          maxHeight: "88vh",

          overflowY: "auto",

          boxShadow:

            "0 24px 70px rgba(0, 0, 0, 0.28)",

        }}

      >

        <div className="card-heading">

          <div>

            <p className="card-kicker">

              INVENTORY

            </p>



            <h3 id="inventory-create-title">

              Create Item

            </h3>



            <p className="card-description">

              Add a product or supply item

              {locationName

                ? ` for ${locationName}.`

                : "."}

            </p>

          </div>



          <button

            type="button"

            className="secondary-button"

            onClick={onClose}

            disabled={saving}

          >

            Close

          </button>

        </div>



        <div

          style={{

            display: "grid",

            gap: "14px",

            marginTop: "18px",

          }}

        >

          <label className="form-field">

            <span>Item name</span>

            <input

              type="text"

              value={name}

              onChange={(event) =>

                setName(event.target.value)

              }

              placeholder="Wilson US Open Tennis Balls"

              disabled={saving}

              required

            />

          </label>



          <div

            style={{

              display: "grid",

              gridTemplateColumns:

                "repeat(2, minmax(0, 1fr))",

              gap: "12px",

            }}

          >

            <label className="form-field">

              <span>Category</span>

              <input

                type="text"

                value={category}

                onChange={(event) =>

                  setCategory(event.target.value)

                }

                placeholder="balls"

                disabled={saving}

                required

              />

            </label>



            <label className="form-field">

              <span>SKU (optional)</span>

              <input

                type="text"

                value={sku}

                onChange={(event) =>

                  setSku(event.target.value)

                }

                placeholder="WIL-USO-001"

                disabled={saving}

              />

            </label>

          </div>



          <div

            style={{

              display: "grid",

              gridTemplateColumns:

                "repeat(2, minmax(0, 1fr))",

              gap: "12px",

            }}

          >

            <label className="form-field">

              <span>Unit label</span>

              <input

                type="text"

                value={unitLabel}

                onChange={(event) =>

                  setUnitLabel(event.target.value)

                }

                placeholder="can"

                disabled={saving}

                required

              />

            </label>



            <label className="form-field">

              <span>Initial quantity</span>

              <input

                type="number"

                min="0"

                step="0.01"

                value={initialQuantity}

                onChange={(event) =>

                  setInitialQuantity(event.target.value)

                }

                disabled={saving}

                required

              />

            </label>

          </div>



          <div

            style={{

              display: "grid",

              gridTemplateColumns:

                "repeat(2, minmax(0, 1fr))",

              gap: "12px",

            }}

          >

            <label className="form-field">

              <span>Unit price</span>

              <input

                type="number"

                min="0"

                step="0.01"

                value={unitPrice}

                onChange={(event) =>

                  setUnitPrice(event.target.value)

                }

                disabled={saving}

                required

              />

            </label>



            <label className="form-field">

              <span>Reorder level (optional)</span>

              <input

                type="number"

                min="0"

                step="0.01"

                value={reorderLevel}

                onChange={(event) =>

                  setReorderLevel(event.target.value)

                }

                disabled={saving}

              />

            </label>

          </div>



          <label className="form-field">

            <span>Notes (optional)</span>

            <textarea

              value={notes}

              onChange={(event) =>

                setNotes(event.target.value)

              }

              placeholder="Initial shipment, supplier notes, etc."

              disabled={saving}

              rows={3}

            />

          </label>



          {message && (

            <div className="member-message">

              {message}

            </div>

          )}



          <div

            style={{

              display: "flex",

              justifyContent: "flex-end",

              gap: "10px",

            }}

          >

            <button

              type="button"

              className="secondary-button"

              onClick={onClose}

              disabled={saving}

            >

              Cancel

            </button>



            <button

              type="button"

              className="primary-button"

              disabled={saving || !valid}

              onClick={() =>

                onCreate({

                  name,

                  category,

                  sku,

                  unitLabel,

                  initialQuantity,

                  unitPrice,

                  reorderLevel,

                  notes,

                })

              }

            >

              {saving

                ? "Creating..."

                : "Create Item"}

            </button>

          </div>

        </div>

      </section>

    </div>

  );

}





function InventoryPage({

  items,

  locations,

  loading,

  error,

  includeInactive,

  setIncludeInactive,

  onCreateItem,

  onRecordMovement,

  onMoreInfo,

}: {

  items: InventoryItem[];

  locations: Location[];

  loading: boolean;

  error: string | null;

  includeInactive: boolean;

  setIncludeInactive: (value: boolean) => void;

  onCreateItem: () => void;

  onRecordMovement: (item: InventoryItem) => void;

  onMoreInfo: (item: InventoryItem) => void;

}) {

  function getLocationName(locationId: string | null) {

    if (!locationId) {

      return "All locations";

    }



    for (const location of locations) {

      if (location.id === locationId) {

        return location.name;

      }

    }



    return "Unknown location";

  }



  function asNumber(value: number | string | null) {

    if (value === null) {

      return null;

    }



    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;

  }



  function formatMoney(value: number | string) {

    const numericValue = asNumber(value) ?? 0;



    return new Intl.NumberFormat("en-US", {

      style: "currency",

      currency: "USD",

    }).format(numericValue);

  }



  return (

    <section className="members-card">

      <div className="card-heading">

        <div>

          <p className="card-kicker">

            CLUB OPERATIONS

          </p>



          <h3>Inventory</h3>



          <p className="card-description">

            Track club supplies, stock levels,

            unit costs and current asset value.

          </p>

        </div>



        <div

          style={{

            display: "flex",

            alignItems: "center",

            gap: "12px",

          }}

        >

          <span className="member-count">

            {items.length} shown

          </span>



          <button

            type="button"

            className="primary-button"

            onClick={onCreateItem}

          >

            + Create Item

          </button>



          <label

            style={{

              display: "flex",

              alignItems: "center",

              gap: "8px",

            }}

          >

            <input

              type="checkbox"

              checked={includeInactive}

              onChange={(event) =>

                setIncludeInactive(event.target.checked)

              }

            />



            <span>Show inactive</span>

          </label>

        </div>

      </div>



      {loading && (

        <div className="member-message">

          Loading inventory...

        </div>

      )}



      {error && (

        <div className="member-message error">

          {error}

        </div>

      )}



      {!loading &&

        !error &&

        items.length === 0 && (

          <div className="empty-state">

            No inventory items are configured

            for this location yet.

          </div>

        )}



      {!loading &&

        !error &&

        items.length > 0 && (

          <div className="member-list">

            {items.map((item) => {

              const inventoryCount =

                asNumber(item.inventory_count) ?? 0;



              const reorderLevel =

                asNumber(item.reorder_level);



              const lowStock =

                reorderLevel !== null &&

                inventoryCount <= reorderLevel;



              return (

                <div

                  key={item.id}

                  className="member-row"

                  style={{

                    alignItems: "center",

                    opacity: item.active ? 1 : 0.65,

                  }}

                >

                  <div className="member-main">

                    <strong>{item.name}</strong>



                    <span>

                      {item.category}

                      {item.sku

                        ? ` \u2022 SKU ${item.sku}`

                        : ""}

                    </span>



                    <span>

                      {getLocationName(item.location_id)}

                    </span>

                  </div>



                  <div className="member-meta">

                    <span>

                      {inventoryCount} {item.unit_label}

                    </span>



                    <span>

                      {formatMoney(item.unit_price)} each

                    </span>



                    <span>

                      {formatMoney(item.updated_asset_value)} value

                    </span>



                    {reorderLevel !== null && (

                      <span>

                        Reorder at {reorderLevel}

                      </span>

                    )}



                    <span>

                      {item.active

                        ? lowStock

                          ? "Low stock"

                          : "Active"

                        : "Inactive"}

                    </span>

                  </div>



                  <div

                    style={{

                      display: "flex",

                      gap: "8px",

                      flexWrap: "wrap",

                    }}

                  >

                    <button

                      type="button"

                      className="primary-button"

                      disabled={!item.active}

                      onClick={() =>

                        onRecordMovement(item)

                      }

                    >

                      Record Movement

                    </button>



                    <button

                      type="button"

                      className="secondary-button"

                      onClick={() =>

                        onMoreInfo(item)

                      }

                    >

                      More Info

                    </button>

                  </div>

                </div>

              );

            })}

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



function MembersPage({userId, role, clubId}: {
  userId: string; role: string; clubId: string; members: Member[];
  memberSearch: string; setMemberSearch: (value: string) => void;
  loading: boolean; error: string | null;
}) {
  return <ProfileDirectory key={`${userId}:${clubId}`} kind="members" apiBase={API_BASE} userId={userId} clubId={clubId} role={role} />;
}

function InvitationsPage({

  invitations,

  loading,

  error,

  email,

  setEmail,

  role,

  setRole,

  availableRoles,

  sending,

  actionMessage,

  revokingId,

  onCreate,

  onRevoke,

}: {

  invitations: ClubInvitation[];

  loading: boolean;

  error: string | null;

  email: string;

  setEmail: (value: string) => void;

  role: string;

  setRole: (value: string) => void;

  availableRoles: string[];

  sending: boolean;

  actionMessage: string | null;

  revokingId: string | null;

  onCreate: (event: React.FormEvent<HTMLFormElement>) => void;

  onRevoke: (invitationId: string) => void;

}) {

  function displayRole(value: string) {

    return value

      .replaceAll("_", " ")

      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  }



  return (

    <section className="members-card">

      <div className="card-heading">

        <div>

          <p className="card-kicker">CLUB ACCESS</p>

          <h3>Invitations</h3>

          <p className="card-description">

            Invite a person by email and assign the club role they will receive

            when they accept.

          </p>

        </div>



        <span className="member-count">{invitations.length} pending</span>

      </div>



      <form className="member-search" onSubmit={onCreate}>

        <input

          type="email"

          value={email}

          onChange={(event) => setEmail(event.target.value)}

          placeholder="person@example.com"

          autoComplete="email"

          required

        />



        <select value={role} onChange={(event) => setRole(event.target.value)} required>

          {availableRoles.map((availableRole) => (

            <option key={availableRole} value={availableRole}>

              {displayRole(availableRole)}

            </option>

          ))}

        </select>



        <button

          type="submit"

          className="primary-button"

          disabled={sending || availableRoles.length === 0}

        >

          {sending ? "Sending..." : "Send Invitation"}

        </button>

      </form>



      {actionMessage && <div className="member-message">{actionMessage}</div>}

      {error && <div className="member-message error">{error}</div>}

      {loading && <div className="member-message">Loading invitations...</div>}



      {!loading && !error && invitations.length === 0 && (

        <div className="approval-empty">

          <div className="approval-empty-icon">&#9993;</div>

          <h3>No pending invitations</h3>

          <p>Send an invitation above to grant someone access to this club.</p>

        </div>

      )}



      {!loading && invitations.length > 0 && (

        <div className="approval-list">

          {invitations.map((invitation) => (

            <div key={invitation.id} className="approval-card">

              <div className="approval-person">

                <div className="approval-avatar">

                  {invitation.invited_email.charAt(0).toUpperCase()}

                </div>

                <div>

                  <strong>{invitation.invited_email}</strong>

                  <span>{displayRole(invitation.invited_role)}</span>

                </div>

              </div>



              <div className="approval-details">

                <div>

                  <span>Role</span>

                  <strong>{displayRole(invitation.invited_role)}</strong>

                </div>

                <div>

                  <span>Expires</span>

                  <strong>{new Date(invitation.expires_at).toLocaleString()}</strong>

                </div>

              </div>



              <div className="approval-actions">

                <button

                  type="button"

                  className="secondary-button"

                  disabled={revokingId === invitation.id}

                  onClick={() => onRevoke(invitation.id)}

                >

                  {revokingId === invitation.id ? "Revoking..." : "Revoke"}

                </button>

              </div>

            </div>

          ))}

        </div>

      )}

    </section>

  );

}



export default App;
