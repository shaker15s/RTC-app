/* Supabase browser client — anon key only. Never a service_role key. */
(function (w) {
  var _pending = null;

  function hasLib() {
    return !!(w.supabase && typeof w.supabase.createClient === 'function');
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
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'implicit'
        }
      });
      return w.supabaseClient;
    } catch (e) {
      console.warn('RTC: supabase init failed');
      return null;
    }
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = w.document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { reject(new Error('failed to load ' + src)); };
      (w.document.head || w.document.documentElement).appendChild(s);
    });
  }

  function ensure() {
    if (w.supabaseClient) return Promise.resolve(w.supabaseClient);
    if (_pending) return _pending;
    _pending = Promise.resolve().then(function () {
      if (hasLib()) return build();
      return loadScript('https://unpkg.com/@supabase/supabase-js@2.49.8/dist/umd/supabase.js')
        .catch(function () {
          return loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/dist/umd/supabase.js');
        })
        .then(function () { return build(); });
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
