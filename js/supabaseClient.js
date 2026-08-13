/* Supabase browser client — anon key only. Never a service_role key. */
(function (w) {
  var _pending = null;

  function hasLib() {
    return !!(w.supabase && typeof w.supabase.createClient === 'function');
  }

  function authStorage() {
    var native = false;
    try { native = !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform()); } catch (e) {}
    var secure = w.RTCSecureStorage && w.RTCSecureStorage.SecureStorage;
    if (!native || !secure) return w.localStorage;
    return {
      getItem: async function (key) {
        var value = await secure.getItem(key);
        /* One-time migration from legacy WebView localStorage (v10 and older). */
        if (value === null && w.localStorage) {
          var legacy = w.localStorage.getItem(key);
          if (legacy !== null) {
            await secure.setItem(key, legacy);
            w.localStorage.removeItem(key);
            return legacy;
          }
        }
        return value;
      },
      setItem: function (key, value) { return secure.setItem(key, value); },
      removeItem: function (key) { return secure.removeItem(key); }
    };
  }

  function build() {
    var url = (w.RTC_CONFIG && w.RTC_CONFIG.supabaseUrl) || '';
    var key = (w.RTC_CONFIG && w.RTC_CONFIG.supabaseAnonKey) || '';
    if (!url || !key) {
      console.warn('RTC: missing supabase config');
      return null;
    }
    if (!hasLib()) {
      console.warn('RTC: supabase-js not loaded');
      return null;
    }
    try {
      w.supabaseClient = w.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          storage: authStorage(),
          autoRefreshToken: true,
          /* The app exchanges PKCE codes explicitly on web and native to avoid callback races. */
          detectSessionInUrl: false,
          flowType: 'pkce'
        }
      });
      return w.supabaseClient;
    } catch (e) {
      console.warn('RTC: supabase init failed');
      return null;
    }
  }

  function ensure() {
    if (w.supabaseClient) return Promise.resolve(w.supabaseClient);
    if (_pending) return _pending;
    _pending = Promise.resolve().then(function () {
      if (!hasLib()) throw new Error('مكتبة الاتصال المحلية غير متاحة. أعد تحميل التطبيق.');
      return build();
    }).then(function (client) {
      if (!client) throw new Error('تعذّر تحميل مكتبة الدخول. تأكد من الإنترنت وجرّب تاني.');
      return client;
    }).catch(function (err) {
      _pending = null;
      throw err;
    });
    return _pending;
  }

  if (hasLib()) build();

  w.RTCSupabase = { ensure: ensure, build: build, hasLib: hasLib };
})(window);
