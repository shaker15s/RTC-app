/* XSS + route + sanitizers */
(function (w) {
  var HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  var ICON = /^ph(-[a-z0-9]+)+$/;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeColor(c, fallback) {
    var v = String(c || '').trim();
    return HEX.test(v) ? v : (fallback || '#00288e');
  }

  function safeIcon(c, fallback) {
    var v = String(c || '').trim();
    var parts = v.split(/\s+/);
    if (parts.length && parts.every(function (p) { return ICON.test(p); })) return parts.join(' ');
    return fallback || 'ph-fill ph-book-open';
  }

  function isUuid(v) { return UUID.test(String(v || '')); }

  function safeUrl(value, fallback) {
    try {
      var raw = String(value || '').trim();
      if (!raw) return fallback || '';
      if (/^tel:\+?[0-9]{3,15}$/.test(raw)) return raw;
      var u = new URL(raw, w.location && w.location.origin ? w.location.origin : 'https://rtc.invalid');
      var localHttp = u.protocol === 'http:' && /^(localhost|127\.0\.0\.1|::1)$/.test(u.hostname);
      if (u.protocol !== 'https:' && !localHttp) return fallback || '';
      /* Never allow credentials or lookalike control characters in public links. */
      if (u.username || u.password || /[\u0000-\u001f\u007f]/.test(raw)) return fallback || '';
      return u.href;
    } catch (e) { return fallback || ''; }
  }

  function maskPhone(p) {
    var s = String(p || '');
    if (s.length < 7) return '—';
    return s.slice(0, 3) + '••••' + s.slice(-2);
  }

  var STUDENT = { prefix: ['s-', 'support'], extra: ['support'] };
  var VOLUNTEER = { prefix: ['v-', 's-analytics', 'support', 's-notifications', 's-edit-profile'] };
  var ADMIN = { prefix: ['a-', 's-analytics', 'support', 's-notifications', 's-edit-profile'] };
  var PUBLIC = ['splash', 'onboarding', 'verify'];

  function canAccess(screenId, role) {
    if (!screenId) return false;
    if (PUBLIC.indexOf(screenId) !== -1) return true;
    if (!role) return false;
    var allow = role === 'admin' ? ADMIN : role === 'volunteer' ? VOLUNTEER : STUDENT;
    if (allow.extra && allow.extra.indexOf(screenId) !== -1) return true;
    return allow.prefix.some(function (p) {
      return screenId === p || screenId.indexOf(p) === 0;
    });
  }

  function haptic(ms) {
    /* الجسر الأصلي أولاً (v100)، وإلا اهتزاز الويب */
    try {
      if (w.RTCNative && typeof w.RTCNative.haptic === 'function') {
        w.RTCNative.haptic((ms || 12) >= 28 ? 'medium' : 'light');
        return;
      }
    } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (e2) {}
  }

  w.RTCSec = { esc: esc, safeColor: safeColor, safeIcon: safeIcon, safeUrl: safeUrl, isUuid: isUuid, maskPhone: maskPhone, canAccess: canAccess, haptic: haptic };
})(window);
