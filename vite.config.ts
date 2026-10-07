import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === "mobile") {
    const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
    const api = new URL(env.VITE_API_BASE || "https://api.deuceiq.com");
    if (api.protocol !== "https:" || ["localhost", "127.0.0.1", "::1", "[::1]"].includes(api.hostname) || api.username || api.password) throw new Error("Mobile builds require a remote HTTPS API.");
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) throw new Error("Missing public Supabase mobile configuration.");
  }
  return {
  plugins: [react()],

  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: [
      "app.deuceiq.com",
    ],
  },
};
});