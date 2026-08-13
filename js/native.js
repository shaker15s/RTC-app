/* ═══════════════════════════════════════════════════════════════════
   RTC v10 — Native bridge (Capacitor)
   ───────────────────────────────────────────────────────────────────
   كل شيء هنا "no-op" آمن على الويب. لا يوجد أي اعتماد صلب على
   Capacitor: لو التطبيق اشتغل في متصفح عادي كل الدوال ترجع بهدوء.
   لا يتم تخزين أي توكن OAuth هنا ولا في أي مكان آخر.
   ═══════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';

  /* الرابط الرسمي المنشور (GitHub Pages) — هو Site URL في Supabase */
  var PUBLIC_URL = 'https://shaker15s.github.io/RTC-app/';
  /* سكيم الرابط العميق للتطبيق الأصلي */
  var APP_SCHEME = 'org.resala.rtc.masar://auth';

  var C = w.Capacitor || null;
  function plugin(name) {
    try { return (C && C.Plugins && C.Plugins[name]) || null; } catch (e) { return null; }
  }
  function isNative() {
    try { return !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform()); } catch (e) { return false; }
  }
  function platform() {
    try { return (C && C.getPlatform && C.getPlatform()) || 'web'; } catch (e) { return 'web'; }
  }

  var _native = isNative();
  var _splashHidden = false;
  var _backHandler = null;
  var _netOnline = true;

  /* ─────────── Haptics ─────────── */
  var IMPACT = { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY' };

  function haptic(style) {
    var s = IMPACT[String(style || 'light').toLowerCase()] || 'LIGHT';
    var H = plugin('Haptics');
    if (H) {
      try { H.impact({ style: s }); return; } catch (e) {}
    }
    try {
      if (w.navigator && w.navigator.vibrate) {
        w.navigator.vibrate(s === 'HEAVY' ? 26 : s === 'MEDIUM' ? 16 : 9);
      }
    } catch (e2) {}
  }

  function notify(type) {
    var H = plugin('Haptics');
    if (H && H.notification) {
      try { H.notification({ type: String(type || 'SUCCESS').toUpperCase() }); return; } catch (e) {}
    }
    try {
      if (w.navigator && w.navigator.vibrate) {
        w.navigator.vibrate(String(type).toUpperCase() === 'ERROR' ? [22, 60, 22] : [12, 45, 12]);
      }
    } catch (e2) {}
  }

  function selection() {
    var H = plugin('Haptics');
    if (H && H.selectionChanged) {
      try { H.selectionChanged(); return; } catch (e) {}
    }
    haptic('light');
  }

  /* ─────────── Status bar ─────────── */
  function applyStatusBar(dark) {
    var SB = plugin('StatusBar');
    if (!SB) return;
    try {
      if (SB.setStyle) SB.setStyle({ style: dark ? 'DARK' : 'LIGHT' });
      if (SB.setBackgroundColor) SB.setBackgroundColor({ color: dark ? '#070b16' : '#f4f7fc' });
      if (SB.setOverlaysWebView) SB.setOverlaysWebView({ overlay: false });
    } catch (e) {}
  }

  function syncStatusBar() {
    try { applyStatusBar(document.documentElement.classList.contains('dark')); } catch (e) {}
  }

  /* ─────────── Splash ─────────── */
  /* تُستدعى بعد أول شاشة حقيقية (onboarding أو الرئيسية) وليس عند التحميل */
  function hideSplash() {
    if (_splashHidden) return;
    _splashHidden = true;
    var SP = plugin('SplashScreen');
    if (!SP || !SP.hide) return;
    try { SP.hide({ fadeOutDuration: 260 }); } catch (e) {}
  }

  /* ─────────── Share ─────────── */
  async function share(opts) {
    opts = opts || {};
    var payload = {
      title: opts.title || 'مسار RTC',
      text: opts.text || '',
      url: opts.url || PUBLIC_URL,
      dialogTitle: opts.dialogTitle || 'مشاركة'
    };
    var S = plugin('Share');
    if (S && S.share) {
      try { await S.share(payload); return true; } catch (e) { return false; }
    }
    if (w.navigator && w.navigator.share) {
      try { await w.navigator.share({ title: payload.title, text: payload.text, url: payload.url }); return true; } catch (e2) { return false; }
    }
    try {
      if (w.navigator && w.navigator.clipboard) {
        await w.navigator.clipboard.writeText((payload.text ? payload.text + ' — ' : '') + payload.url);
        return true;
      }
    } catch (e3) {}
    return false;
  }

  /* ─────────── Network banner ─────────── */
  function ensureBanner() {
    var el = document.getElementById('net-banner');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'net-banner';
    el.className = 'net-banner';
    el.innerHTML = '<i class="ph-fill ph-wifi-slash"></i><span>لا يوجد اتصال بالإنترنت — بعض البيانات قد تكون قديمة</span>';
    var host = document.getElementById('app') || document.body;
    host.appendChild(el);
    return el;
  }

  function setOnline(online) {
    _netOnline = !!online;
    var el = ensureBanner();
    el.classList.toggle('show', !online);
  }

  function isOnline() { return _netOnline; }

  function initNetwork() {
    try { _netOnline = w.navigator ? w.navigator.onLine !== false : true; } catch (e) { _netOnline = true; }
    var N = plugin('Network');
    if (N && N.addListener) {
      try {
        N.getStatus().then(function (s) { setOnline(!!(s && s.connected)); }).catch(function () {});
        N.addListener('networkStatusChange', function (s) { setOnline(!!(s && s.connected)); });
        return;
      } catch (e) {}
    }
    w.addEventListener('online', function () { setOnline(true); });
    w.addEventListener('offline', function () { setOnline(false); });
    setOnline(_netOnline);
  }

  /* ─────────── Android back button ─────────── */
  function onBack(handler) { _backHandler = typeof handler === 'function' ? handler : null; }

  function initBackButton() {
    var A = plugin('App');
    if (!A || !A.addListener) return;
    try {
      A.addListener('backButton', function (ev) {
        var handled = false;
        try { handled = _backHandler ? _backHandler(ev) !== false : false; } catch (e) { handled = false; }
        if (!handled) {
          try { if (A.exitApp) A.exitApp(); } catch (e2) {}
        }
      });
    } catch (e) {}
  }

  /* ─────────── Deep links (OAuth return) ─────────── */
  function handleDeepLink(url) {
    if (!url) return;
    var idx = -1;
    var i = String(url).indexOf('#');
    var q = String(url).indexOf('?');
    idx = i !== -1 ? i : q;
    if (idx === -1) return;
    var frag = String(url).slice(idx + 1);
    if (frag.indexOf('access_token=') === -1 && frag.indexOf('code=') === -1) return;
    try {
      /* نمرّر الجزء للتطبيق ليكمل استرجاع الجلسة عبر supabase-js. */
      w.location.hash = '#' + frag;
      if (w.RTCApi && w.RTCApi.recoverHashSession) {
        w.RTCApi.recoverHashSession().catch(function () {});
      }
    } catch (e) {}
  }

  function initDeepLinks() {
    var A = plugin('App');
    if (!A || !A.addListener) return;
    try {
      A.addListener('appUrlOpen', function (ev) { handleDeepLink(ev && ev.url); });
      if (A.getLaunchUrl) {
        A.getLaunchUrl().then(function (r) { handleDeepLink(r && r.url); }).catch(function () {});
      }
    } catch (e) {}
  }

  /* ─────────── OAuth redirect ─────────── */
  /* على الأصل: سكيم التطبيق. على الويب: رابط GitHub Pages الرسمي.
     استثناء وحيد للتطوير المحلي حتى يظل `npm run dev` قابلاً للاختبار. */
  function oauthRedirect() {
    if (_native) return APP_SCHEME;
    var host = '';
    try { host = String(w.location.hostname || ''); } catch (e) {}
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      var origin = String(w.location.origin || '').replace(/\/$/, '');
      var path = w.location.pathname || '/';
      return path && path !== '/' ? origin + path : origin + '/';
    }
    return PUBLIC_URL;
  }

  /* ─────────── App lifecycle ─────────── */
  function onResume(fn) {
    var A = plugin('App');
    if (!A || !A.addListener || typeof fn !== 'function') return;
    try {
      A.addListener('appStateChange', function (st) { if (st && st.isActive) fn(); });
    } catch (e) {}
  }

  /* ─────────── init ─────────── */
  var _inited = false;
  function init() {
    if (_inited) return;
    _inited = true;
    _native = isNative();
    if (_native) document.documentElement.classList.add('is-native');
    initNetwork();
    initBackButton();
    initDeepLinks();
    syncStatusBar();
  }

  w.RTCNative = {
    PUBLIC_URL: PUBLIC_URL,
    APP_SCHEME: APP_SCHEME,
    init: init,
    isNative: function () { return _native; },
    platform: platform,
    haptic: haptic,
    notify: notify,
    selection: selection,
    applyStatusBar: applyStatusBar,
    syncStatusBar: syncStatusBar,
    hideSplash: hideSplash,
    share: share,
    isOnline: isOnline,
    setOnline: setOnline,
    onBack: onBack,
    onResume: onResume,
    oauthRedirect: oauthRedirect
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window);
