/* Supabase browser client — anon key only. Never a service_role key. */
(function initSupabase() {
  var url = (window.RTC_CONFIG && window.RTC_CONFIG.supabaseUrl) || '';
  var key = (window.RTC_CONFIG && window.RTC_CONFIG.supabaseAnonKey) || '';
  if (!url || !key) {
    console.warn('RTC: missing supabase config');
    return;
  }
  if (!window.supabase || !window.supabase.createClient) {
    console.warn('RTC: supabase-js not loaded');
    return;
  }
  try {
    window.supabaseClient = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit'
      }
    });
  } catch (e) {
    console.warn('RTC: supabase init failed');
  }
})();
