/* Public runtime config. Anon key is designed to be public; RLS is the lock. */
window.RTC_CONFIG = {
  supabaseUrl: 'https://jwhedqmszbdougsqqmhv.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGVkcW1zemJkb3Vnc3FxbWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MTc3MDQsImV4cCI6MjEwMTk5MzcwNH0.YqFPCxQBHph6h3yKdxp1Cjo12-ZfcYZdm-fKhuVUxSM',
  version: '100.0.0',
  appName: 'مسار RTC',
  debugAuth: false,
  /* Android FCM is ready. iOS APNs is disabled for free Personal Team signing. */
  nativePush: { android: true, ios: false },
  officialUrl: 'https://rtc-kohl.vercel.app/'
};
