/* ═══════════════════════════════════════════════════════════════════
   RTC v100 — Native bridge (Capacitor)
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

  /* ─────────── Secure system browser (OAuth / trusted public pages) ─────────── */
  async function openBrowser(url) {
    if (!/^https:\/\//i.test(String(url || ''))) throw new Error('رابط غير آمن');
    var B = plugin('Browser');
    if (B && B.open) {
      await B.open({ url: String(url), presentationStyle: 'popover', toolbarColor: '#12358f' });
      return true;
    }
    w.location.assign(String(url));
    return true;
  }

  /* ─────────── QR scanner (native camera, with web fallback) ─────────── */
  async function scanQrCode() {
    var scanner = w.RTCBarcode && w.RTCBarcode.CapacitorBarcodeScanner;
    if (!scanner || !scanner.scanBarcode) throw new Error('ماسح QR غير متاح على هذا الجهاز');
    var result = await scanner.scanBarcode({
      hint: 0,
      scanInstructions: 'وجّه الكاميرا إلى رمز حضور RTC',
      scanButton: false,
      scanText: 'امسح الرمز',
      cameraDirection: 1,
      scanOrientation: 3,
      cancelButtonAccessibilityLabel: 'إلغاء المسح',
      torchButtonOnAccessibilityLabel: 'إطفاء الفلاش',
      torchButtonOffAccessibilityLabel: 'تشغيل الفلاش',
      android: { scanningLibrary: 'zxing' },
      web: { showCameraSelection: true, scannerFPS: 12 }
    });
    return result && result.ScanResult ? String(result.ScanResult) : '';
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
    if (!url || String(url).indexOf(APP_SCHEME) !== 0) return;
    var raw = String(url);
    if (raw.indexOf('code=') === -1 && raw.indexOf('error=') === -1) return;
    try {
      var B = plugin('Browser');
      if (B && B.close) B.close().catch(function () {});
      /* PKCE exchange validates state + verifier inside the original WebView. */
      if (w.RTCApi && w.RTCApi.recoverUrlSession) {
        w.RTCApi.recoverUrlSession(raw).catch(function (err) {
          if (w.RTCUI) w.RTCUI.toast((err && err.message) || 'تعذّر إكمال تسجيل الدخول', 'err');
        });
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
  /* Native returns to the app scheme. Web returns to its current deployment;
     Supabase's Redirect URL allowlist remains the server-side authority. */
  function oauthRedirect() {
    if (_native) return APP_SCHEME;
    var origin = String(w.location.origin || '').replace(/\/$/, '');
    var pathname = String(w.location.pathname || '/');
    if (/\.[a-z0-9]+$/i.test(pathname)) pathname = pathname.replace(/[^/]+$/, '');
    if (!pathname.endsWith('/')) pathname += '/';
    return origin + pathname;
  }

  /* ─────────── Push + local course reminders ─────────── */
  var _pushBound = false;
  async function ensureAndroidPushChannel(P) {
    if (platform() !== 'android' || !P || !P.createChannel) return;
    try {
      await P.createChannel({
        id: 'rtc_updates',
        name: 'تحديثات مسار RTC',
        description: 'مواعيد المحاضرات والتأجيلات والشهادات',
        importance: 4,
        visibility: 1,
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#12358f'
      });
    } catch (e) {}
  }

  function nativePushEnabled() {
    var currentPlatform = platform();
    var flags = w.RTC_CONFIG && w.RTC_CONFIG.nativePush;
    return !flags || flags[currentPlatform] !== false;
  }

  async function registerPushIfAllowed(requestPermission) {
    if (!_native || !nativePushEnabled()) return false;
    var P = plugin('PushNotifications');
    if (!P) return false;
    var perm = await P.checkPermissions();
    if (perm.receive !== 'granted' && requestPermission) perm = await P.requestPermissions();
    if (perm.receive !== 'granted') return false;
    await ensureAndroidPushChannel(P);
    await P.register();
    return true;
  }

  function bindPushListeners() {
    if (_pushBound || !_native) return;
    var P = plugin('PushNotifications');
    if (!P || !P.addListener) return;
    _pushBound = true;
    P.addListener('registration', function (token) {
      if (token && token.value && w.RTCApi && w.RTCApi.registerPushDevice) {
        w.RTCApi.registerPushDevice(token.value, platform()).catch(function () {});
      }
    });
    P.addListener('registrationError', function () {
      if (w.RTCUI) w.RTCUI.toast('تعذّر تفعيل إشعارات الجهاز', 'warn');
    });
    P.addListener('pushNotificationReceived', function (notification) {
      if (w.RTCUI) w.RTCUI.toast((notification && notification.title) || 'لديك تنبيه جديد', 'info', 'ph-bell');
    });
    P.addListener('pushNotificationActionPerformed', function (action) {
      var data = action && action.notification && action.notification.data;
      var screen = data && data.screen;
      if (screen && typeof w.push === 'function') {
        try { w.push(String(screen)); } catch (e) {}
      }
    });
  }

  async function enableNotifications() {
    bindPushListeners();
    var pushGranted = await registerPushIfAllowed(true);
    var localGranted = false;
    var L = plugin('LocalNotifications');
    if (L) {
      var localPerm = await L.checkPermissions();
      if (localPerm.display !== 'granted') localPerm = await L.requestPermissions();
      localGranted = localPerm.display === 'granted';
    }
    return pushGranted || localGranted;
  }

  function reminderId(value) {
    var str = String(value || 'rtc');
    var h = 0;
    for (var i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h || 100001) % 2147483646 + 1;
  }

  async function syncCourseReminders(enrollments) {
    if (!_native) return false;
    var L = plugin('LocalNotifications');
    if (!L) return false;
    var perm = await L.checkPermissions();
    if (perm.display !== 'granted') return false;
    var now = Date.now();
    var notifications = [];
    (enrollments || []).forEach(function (row) {
      var batch = row && row.batches;
      if (!batch || !batch.starts_at) return;
      var starts = new Date(batch.starts_at).getTime();
      var at = starts - 60 * 60 * 1000;
      if (!Number.isFinite(at) || at <= now) return;
      var course = batch.courses || {};
      notifications.push({
        id: reminderId(batch.id),
        title: 'محاضرتك بعد ساعة',
        body: (course.title || batch.name || 'دورة RTC') + (batch.location ? ' — ' + batch.location : ''),
        schedule: { at: new Date(at), allowWhileIdle: true },
        extra: { screen: 's-courses', batchId: batch.id }
      });
    });
    if (notifications.length) {
      notifications = notifications.slice(0, 30);
      try { await L.cancel({ notifications: notifications.map(function (item) { return { id: item.id }; }) }); } catch (e) {}
      await L.schedule({ notifications: notifications });
    }
    return true;
  }

  function initPush() {
    bindPushListeners();
    registerPushIfAllowed(false).catch(function () {});
  }

  async function unregisterPush() {
    var P = plugin('PushNotifications');
    if (_native && P && P.unregister) {
      try { await P.unregister(); } catch (e) {}
    }
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
    openBrowser: openBrowser,
    handleDeepLink: handleDeepLink,
    scanQrCode: scanQrCode,
    initPush: initPush,
    unregisterPush: unregisterPush,
    enableNotifications: enableNotifications,
    syncCourseReminders: syncCourseReminders,
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
