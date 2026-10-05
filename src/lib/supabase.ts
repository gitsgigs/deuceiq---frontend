import { createAuthStorage } from "./authStorage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY."
  );
}

const authKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
const authStorage = createAuthStorage(window.localStorage, window.sessionStorage, authKey);
export const setKeepSignedIn = authStorage.setRemember;

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  { auth: { storageKey: authKey, persistSession: true, storage: authStorage.storage } }
);