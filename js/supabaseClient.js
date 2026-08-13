/* ═══════════════════════════════════════════════════════════════
   Supabase Client Configuration & Auto-Connection Initializer
   ═══════════════════════════════════════════════════════════════ */
(function initSupabase() {
  // Supabase URL & Public Anon Key for RTC Resala App
  const SUPABASE_URL = "https://jwhedqmszbdougsqqmhv.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGVkcW1zemJkb3Vnc3FxbWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MTc3MDQsImV4cCI6MjEwMTk5MzcwNH0.YqFPCxQBHph6h3yKdxp1Cjo12-ZfcYZdm-fKhuVUxSM";

  if (window.supabase && window.supabase.createClient) {
    try {
      window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      console.log('✓ Supabase Client initialized successfully:', SUPABASE_URL);
    } catch(e) {
      console.warn('Supabase init warning:', e);
    }
  } else {
    console.warn('Supabase SDK script not loaded yet');
  }
})();
