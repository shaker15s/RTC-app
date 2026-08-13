/* ═══════════════════════════════════════════════════════════════
   مسار RTC v10.0.1 — محرك الواجهة
   الهوية من JWT فقط. الأدوار من السيرفر. الكتابة الحساسة عبر RPC.
   ═══════════════════════════════════════════════════════════════ */
var CURRENT_USER = null;
var CURRENT_PROFILE = null;
var navStack = [];
var currentScreenId = 'splash';
var _branches = [];
var _currentBatch = null;
var _batchStudents = [];
var _attendanceState = {};
var _currentSession = null;
var _detailCourseId = null;
var _exploreFilterText = '';
var _exploreBranchId = '';
var _authHandled = false;
var _unread = 0;

var BADGES_CATALOG = [
  { id: 'welcome', name: 'أول خطوة', icon: 'ph-fill ph-flag-checkered', color: '#00288e', desc: 'انضممت إلى مسار RTC', unlock: 'أنشئ حسابك' },
  { id: 'firstCourse', name: 'متعلم نشيط', icon: 'ph-fill ph-book-open-text', color: '#00554e', desc: 'انضممت لأول دورة', unlock: 'انضم لمجموعة' },
  { id: 'firstAttend', name: 'حاضر فعلاً', icon: 'ph-fill ph-calendar-check', color: '#0b6e63', desc: 'سُجّل حضورك أول مرة', unlock: 'احضر محاضرة' },
  { id: 'points100', name: 'جامع النقاط', icon: 'ph-fill ph-coins', color: '#d4af37', desc: 'جمعت ١٠٠ نقطة', unlock: 'اجمع ١٠٠ نقطة' },
  { id: 'streak5', name: 'مثابر', icon: 'ph-fill ph-fire', color: '#ba1a1a', desc: 'حضرت ٥ محاضرات متتالية', unlock: 'سلسلة حضور ٥' },
  { id: 'explorer', name: 'مستكشف', icon: 'ph-fill ph-compass', color: '#7a30d8', desc: 'انضممت لـ ٣ دورات', unlock: '٣ كورسات' },
  { id: 'graduate', name: 'خريج معتمد', icon: 'ph-fill ph-certificate', color: '#1e40af', desc: 'أتممت دورة بنجاح', unlock: 'أكمل كورساً' },
  { id: 'social', name: 'نجم سوشيال', icon: 'ph-fill ph-heart', color: '#a8477a', desc: 'شاركت التطبيق', unlock: 'شارك رابط مسار' },
  { id: 'points500', name: 'بطل النقاط', icon: 'ph-fill ph-trophy', color: '#854d0e', desc: 'جمعت ٥٠٠ نقطة', unlock: 'اجمع ٥٠٠ نقطة' }
];

var FAQ = [
  { q: 'هل الكورسات مجانية فعلاً؟', a: 'نعم. دورات مركز رسالة مجانية بالكامل من التسجيل حتى الشهادة.' },
  { q: 'كيف أسجّل حضوري؟', a: 'المتطوع يفتح محاضرة اليوم ويعرض رمز QR. امسحه أو أدخل الرمز من تبويب «تسجيل حضوري». لا يمكن تسجيل حضور نيابةً عن زميل.' },
  { q: 'فاتتني محاضرة، ماذا أفعل؟', a: 'أرسل طلب عذر من حسابك مع السبب. المتطوع يراجعه وقد يحتسب المحاضرة معذورة.' },
  { q: 'كيف أصبح متطوعاً؟', a: 'كل الحسابات تبدأ كطلاب. تواصل مع مشرف المركز لترقيتك من لوحة الإدارة.' },
  { q: 'كيف أتحقق من شهادة؟', a: 'من الشهادات اضغط «تحقق»، أو افتح صفحة التحقق العامة وأدخل الرقم التسلسلي.' }
];

var UI = window.RTCUI;
var API = window.RTCApi;
var SEC = window.RTCSec;
var t = function (k) { return window.RTCi18n ? window.RTCi18n.t(k) : k; };

function toast(m, ty, ic) { UI.toast(m, ty, ic); }
function esc(s) { return SEC.esc(s); }
function setEl(id, v) { UI.setEl(id, v); }

/* ═══════════════ Navigation + guards ═══════════════ */
function showScreenEl(id) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
  var el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');
  currentScreenId = id;
  var body = el && el.querySelector('.scr-body, .scr-body-full');
  if (body) body.scrollTop = 0;
  toggleNavForScreen(id);
  if (id !== 'splash' && window.RTCNative) RTCNative.hideSplash();
}

function toggleNavForScreen(id) {
  var role = CURRENT_PROFILE && CURRENT_PROFILE.role;
  var ns = document.getElementById('nav-student');
  var nv = document.getElementById('nav-volunteer');
  var na = document.getElementById('nav-admin');
  var tabs = {
    student: ['s-home', 's-courses', 's-points', 's-certs', 's-profile'],
    volunteer: ['v-home', 'v-batches', 'v-courses', 's-analytics', 'v-profile'],
    admin: ['a-home', 'a-users', 'a-courses', 's-analytics']
  };
  var mine = tabs[role] || [];
  var onTab = mine.indexOf(id) !== -1;
  if (ns) ns.classList.toggle('hidden', !(role === 'student' && onTab));
  if (nv) nv.classList.toggle('hidden', !(role === 'volunteer' && onTab));
  if (na) na.classList.toggle('hidden', !(role === 'admin' && onTab));
  syncToastPosition();
}

function updateNavActive(id) {
  document.querySelectorAll('.nav-btn').forEach(function (b) {
    var on = b.getAttribute('data-screen') === id;
    b.classList.toggle('active', on);
    var ic = b.querySelector('i');
    var name = b.getAttribute('data-icon');
    if (ic && name) ic.className = (on ? 'ph-fill ' : 'ph ') + name;
  });
}

/* موضع السناك بار: فوق التاب بار لو ظاهر */
function syncToastPosition() {
  var ct = document.getElementById('toast-ct');
  if (!ct) return;
  var navUp = !!document.querySelector('.bottom-nav:not(.hidden)');
  ct.classList.toggle('above-nav', navUp);
}

function guard(id) {
  var role = CURRENT_PROFILE && CURRENT_PROFILE.role;
  if (!SEC.canAccess(id, role)) {
    toast(t('noPermission'), 'err');
    return false;
  }
  if (CURRENT_PROFILE && CURRENT_PROFILE.status === 'inactive') {
    toast('تم إيقاف الحساب. تواصل مع المشرف.', 'err');
    return false;
  }
  return true;
}

function push(id) {
  if (!guard(id)) return;
  if (currentScreenId !== id) {
    navStack.push(currentScreenId);
    showScreenEl(id);
    renderScreen(id);
    try { history.pushState({ screen: id }, '', '#' + id); } catch (e) {}
  }
}

function pop() {
  if (navStack.length) {
    var prev = navStack.pop();
    if (!guard(prev)) { routeToRoleHome(); return; }
    showScreenEl(prev);
    renderScreen(prev);
    updateNavActive(prev);
    try { history.replaceState({ screen: prev }, '', '#' + prev); } catch (e) {}
  } else {
    routeToRoleHome();
  }
}

function switchTab(id) {
  if (!guard(id)) return;
  var role = (CURRENT_PROFILE && CURRENT_PROFILE.role) || 'student';
  var home = role === 'volunteer' ? 'v-home' : role === 'admin' ? 'a-home' : 's-home';
  navStack = id === home ? [] : [home];
  showScreenEl(id);
  renderScreen(id);
  updateNavActive(id);
  maybeHint(id);
  try { history.pushState({ screen: id }, '', '#' + id); } catch (e) {}
}

/* تلميحات أول مرة (مرة واحدة لكل شاشة) */
var SCREEN_HINTS = {
  's-home': { id: 'home', icon: 'ph-hand-waving', msg: 'أهلاً بك! من هنا تتابع كورساتك ونقاطك. اسحب للأسفل لتحديث البيانات.' },
  's-explore': { id: 'explore', icon: 'ph-compass', msg: 'استكشف المجموعات المتاحة. العداد جنب كل مجموعة يوضّح المقاعد المتبقية.' },
  's-checkin': { id: 'checkin', icon: 'ph-qr-code', msg: 'اطلب الرمز من المتطوع وقت المحاضرة، وأدخله هنا لتسجيل حضورك.' },
  's-profile': { id: 'profile', icon: 'ph-user-gear', msg: 'من حسابك تعدّل بياناتك، تفعّل الوضع الليلي، وترسل طلبات الأعذار.' },
  's-certs': { id: 'certs', icon: 'ph-certificate', msg: 'شهاداتك تظهر هنا بعد إتمام الدورة، وتقدر تحمّلها PDF أو تتحقق منها.' }
};
function maybeHint(id) {
  var h = SCREEN_HINTS[id];
  if (h && window.RTCMotion) setTimeout(function () { RTCMotion.hint(h.id, h.msg, { icon: h.icon }); }, 700);
}

window.addEventListener('popstate', function (ev) {
  if (currentScreenId === 'splash' || currentScreenId === 'onboarding') return;
  var target = ev.state && ev.state.screen;
  if (target && guard(target)) {
    showScreenEl(target);
    renderScreen(target);
    updateNavActive(target);
  } else {
    routeToRoleHome();
  }
});

function routeToRoleHome() {
  if (!CURRENT_PROFILE) { showScreenEl('onboarding'); nextOnbStep(1); return; }
  var role = CURRENT_PROFILE.role;
  if (role === 'volunteer') switchTab('v-home');
  else if (role === 'admin') switchTab('a-home');
  else switchTab('s-home');
}

function renderScreen(id) {
  var map = {
    's-home': renderStudentHome, 's-courses': renderStudentCourses,
    's-points': renderPoints, 's-certs': renderCerts, 's-profile': renderProfile,
    's-edit-profile': renderEditProfile, 's-leaderboard': renderLeaderboard,
    's-explore': renderExplore, 's-notifications': renderNotifications,
    's-course-detail': renderCourseDetail, 's-checkin': renderCheckin,
    's-excuse': renderExcuseForm, 's-ledger': renderLedger,
    'support': renderSupport,
    'v-home': renderVolunteerHome, 'v-batches': renderVolunteerBatches,
    'v-courses': renderVolunteerCoursesList, 'v-profile': renderVolunteerProfile,
    'v-excuses': renderStaffExcuses,
    'a-home': renderAdminHome, 'a-users': renderAdminUsers, 'a-courses': renderAdminCourses,
    'a-certs': renderAdminCerts, 'a-settings': renderAdminSettings,
    'a-branches': renderBranchesAdmin, 'a-broadcast': renderBroadcast,
    's-analytics': renderAnalytics
  };
  if (map[id]) map[id]();
}

/* ═══════════════ Prefs / dark / lang ═══════════════ */
function getPref(key, def) {
  try {
    var v = localStorage.getItem('rtc_pref_' + key);
    return v !== null ? JSON.parse(v) : def;
  } catch (e) { return def; }
}
function setPref(key, val) {
  try { localStorage.setItem('rtc_pref_' + key, JSON.stringify(val)); } catch (e) {}
}

function applyDarkMode() {
  var isDark = (CURRENT_PROFILE && CURRENT_PROFILE.dark_mode) || getPref('dark', false);
  document.documentElement.classList.toggle('dark', !!isDark);
}

async function toggleDark() {
  var next = !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', next);
  setPref('dark', next);
  toast(next ? t('dark') + ' 🌙' : t('light') + ' ☀️', 'info');
  SEC.haptic(10);
  if (CURRENT_PROFILE && CURRENT_USER) {
    try {
      CURRENT_PROFILE.dark_mode = next;
      await API.updateMyProfile({ dark_mode: next });
    } catch (e) {}
  }
}

function toggleLang() {
  var next = window.RTCi18n.current() === 'ar' ? 'en' : 'ar';
  window.RTCi18n.setLang(next);
  if (CURRENT_PROFILE) {
    CURRENT_PROFILE.lang = next;
    API.updateMyProfile({ lang: next }).catch(function () {});
  }
  toast(next === 'ar' ? 'تم التحويل للعربية' : 'Switched to English', 'ok');
  renderScreen(currentScreenId);
}

function applyI18nNav() {
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
}
window.applyI18nNav = applyI18nNav;

/* ═══════════════ Auth ═══════════════ */
function nextOnbStep(n) {
  var s1 = document.getElementById('onb-step-1');
  var s2 = document.getElementById('onb-step-2');
  if (s1) s1.classList.toggle('active', n === 1);
  if (s2) s2.classList.toggle('active', n === 2);
  var d1 = document.getElementById('dot-1');
  var d2 = document.getElementById('dot-2');
  if (d1) d1.style.width = n === 1 ? '32px' : '8px';
  if (d2) d2.style.width = n === 2 ? '32px' : '8px';
  if (d1) d1.style.background = n >= 1 ? 'var(--primary)' : 'var(--line)';
  if (d2) d2.style.background = n >= 2 ? 'var(--primary)' : 'var(--line)';
  if (n === 1) tryInitGoogle();
}

async function tryInitGoogle() {
  var statusEl = document.getElementById('g-status');
  var mount = document.getElementById('g-btn-mount');
  if (statusEl) statusEl.innerHTML = '<i class="ph-fill ph-info"></i><span>' + esc(t('googleHint')) + '</span>';
  var hint = document.getElementById('oauth-origin-hint');
  if (hint) {
    var origin = location.origin + '/';
    hint.innerHTML = '<div class="text-[11px] text-muted leading-relaxed">أضف هذا الرابط في Supabase → Authentication → Redirect URLs ثم اضغط الدخول من نفس التبويب:</div>' +
      '<button type="button" class="chip text-[11px] mt-1.5 font-mono" id="copy-origin-btn" dir="ltr">' + esc(origin) + '</button>';
    var copyBtn = document.getElementById('copy-origin-btn');
    if (copyBtn) copyBtn.onclick = function () {
      if (navigator.clipboard) navigator.clipboard.writeText(origin).then(function () { toast('تم نسخ الرابط', 'ok'); }).catch(function () {});
    };
  }
  if (!mount) return;
  mount.innerHTML = '';
  var btn = document.createElement('button');
  btn.className = 'btn btn-primary btn-big w-full shadow-lg gap-3';
  btn.innerHTML = '<i class="ph-fill ph-google-logo text-xl"></i><span>' + esc(t('googleCta')) + '</span>';
  btn.onclick = triggerGoogleLogin;
  mount.appendChild(btn);
}

async function triggerGoogleLogin() {
  try {
    toast('جاري فتح نافذة Google...', 'info', 'ph-google-logo');
    await API.signInGoogle();
  } catch (e) {
    toast(UI.humanError(e), 'err');
  }
}

async function hydrateSession(session) {
  if (!session || !session.user) return false;
  CURRENT_USER = session.user;
  try {
    CURRENT_PROFILE = await API.fetchMyProfile();
  } catch (e) {
    console.warn('profile fetch', e);
    CURRENT_PROFILE = null;
  }
  if (!CURRENT_PROFILE) {
    // trigger may still be running — retry once
    await new Promise(function (r) { setTimeout(r, 600); });
    try { CURRENT_PROFILE = await API.fetchMyProfile(); } catch (e2) {}
  }
  if (CURRENT_PROFILE && CURRENT_PROFILE.lang) {
    window.RTCi18n.setLang(CURRENT_PROFILE.lang);
  }
  applyDarkMode();
  try { _branches = await API.fetchBranches(); } catch (e) { _branches = []; }
  refreshUnread();
  return true;
}

function profileComplete(p) {
  return !!(p && p.full_name && p.full_name.trim().split(/\s+/).length >= 2 && p.phone && /^01[0125][0-9]{8}$/.test(p.phone));
}

async function afterAuth(session) {
  _authHandled = true;
  await hydrateSession(session);
  if (window.location.hash && window.location.hash.indexOf('access_token') !== -1) {
    try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
  }
  if (profileComplete(CURRENT_PROFILE)) {
    toast(t('welcomeBack') + ' يا ' + (CURRENT_PROFILE.full_name.split(' ')[0]) + ' 🎉', 'ok');
    routeToRoleHome();
  } else {
    fillOnbFromAuth();
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    var onb = document.getElementById('screen-onboarding');
    if (onb) onb.classList.add('active');
    currentScreenId = 'onboarding';
    nextOnbStep(2);
  }
}

function fillOnbFromAuth() {
  var meta = (CURRENT_USER && CURRENT_USER.user_metadata) || {};
  var name = (CURRENT_PROFILE && CURRENT_PROFILE.full_name) || meta.full_name || meta.name || '';
  var email = (CURRENT_USER && CURRENT_USER.email) || '';
  var n = document.getElementById('onb-name'); if (n && !n.value) n.value = name;
  var e = document.getElementById('onb-email-chip'); if (e) e.value = email;
  if (CURRENT_PROFILE && CURRENT_PROFILE.phone) {
    var p = document.getElementById('onb-phone'); if (p) p.value = CURRENT_PROFILE.phone;
  }
}

function clearFieldError(iid, eid) {
  document.getElementById(iid) && document.getElementById(iid).classList.remove('bad');
  document.getElementById(eid) && document.getElementById(eid).classList.remove('show');
}
function setFieldError(iid, eid) {
  document.getElementById(iid) && document.getElementById(iid).classList.add('bad');
  document.getElementById(eid) && document.getElementById(eid).classList.add('show');
}

function triggerBranchPickerOnb() {
  openBranchPicker(document.getElementById('onb-address') && document.getElementById('onb-address').value, function (id, label) {
    var h = document.getElementById('onb-address'); if (h) h.value = id;
    var tEl = document.getElementById('onb-branch-lbl'); if (tEl) tEl.textContent = label;
  });
}

function openBranchPicker(currentId, onSelect) {
  var items = _branches.map(function (b) {
    return { value: b.id, label: b.name_ar, sub: b.address || b.city, badge: b.city, icon: 'ph-map-pin' };
  });
  UI.openPicker({ title: 'اختر الفرع', subtitle: 'الفرع يحدد كورساتك وإشعاراتك', items: items, currentVal: currentId, onSelect: onSelect });
}

async function submitProfile(el) {
  var nameEl = document.getElementById('onb-name');
  var phoneEl = document.getElementById('onb-phone');
  var branchEl = document.getElementById('onb-address');
  if (!nameEl || !phoneEl) return;
  var name = nameEl.value.trim();
  var phone = phoneEl.value.trim();
  var branchId = (branchEl && branchEl.value) || (_branches[0] && _branches[0].id);
  clearFieldError('onb-name', 'err-name'); clearFieldError('onb-phone', 'err-phone');
  var ok = true;
  if (name.split(/\s+/).filter(Boolean).length < 3 || name.length < 6) { setFieldError('onb-name', 'err-name'); ok = false; }
  if (!/^01[0125][0-9]{8}$/.test(phone)) { setFieldError('onb-phone', 'err-phone'); ok = false; }
  if (!ok) { toast('راجع الاسم الثلاثي ورقم الموبايل', 'err'); return; }
  if (!CURRENT_USER) { toast(t('needLogin'), 'err'); nextOnbStep(1); return; }

  var btn = (el && el.nodeType === 1) ? el : document.querySelector('#onb-step-2 .btn-primary');
  await runBtn(btn, async function () {
    CURRENT_PROFILE = await API.updateMyProfile({ full_name: name, phone: phone, branch_id: branchId || null });
    CURRENT_PROFILE.badge_ids = CURRENT_PROFILE.badge_ids || ['welcome'];
    applyDarkMode();
    UI.fireConfetti();
    toast('تم إنشاء حسابك — أهلاً بك في رسالة 🎉', 'ok');
    routeToRoleHome();
    return true;
  }, 'تم ✓');
}

function askLogout() {
  UI.showConfirm(t('logout') + '؟', 'سيتم إنهاء الجلسة على هذا الجهاز.', async function () {
    try { await API.signOut(); } catch (e) {}
    CURRENT_USER = CURRENT_PROFILE = null;
    API.invalidate();
    location.reload();
  }, { yesLabel: t('logout') });
}

function resetAppData() {
  UI.showConfirm('مسح بيانات الجهاز؟', 'سيتم تسجيل الخروج ومسح التخزين المحلي فقط. بيانات السحابة لن تُحذف.', async function () {
    try { await API.signOut(); } catch (e) {}
    localStorage.clear();
    location.reload();
  }, { yesLabel: 'مسح والخروج' });
}

/* ═══════════════ Student home ═══════════════ */
function getGreeting() {
  var hr = new Date().getHours();
  if (hr >= 5 && hr < 12) return 'صباح الخير والهمة ☀️';
  if (hr >= 12 && hr < 18) return 'مساء الخير والنجاح 🌤️';
  return 'مساء الخير والتطوير 🌙';
}

function branchOf(p) {
  if (!p) return null;
  if (p.branches) return p.branches;
  return _branches.find(function (b) { return b.id === p.branch_id; }) || null;
}

async function refreshUnread() {
  try {
    _unread = await API.unreadCount();
    document.querySelectorAll('#notif-dot').forEach(function (d) {
      d.style.display = _unread ? 'block' : 'none';
    });
  } catch (e) {}
}

async function renderStudentHome() {
  if (!CURRENT_PROFILE) return;
  var p = CURRENT_PROFILE;
  var first = (p.full_name || '').split(' ')[0] || p.full_name;
  setEl('sh-name', first + ' — ' + getGreeting());
  var br = branchOf(p);
  setEl('sh-branch', (br && br.name_ar) || '');
  setEl('sh-level', Math.max(1, Math.floor((p.points || 0) / 150) + 1) + ' ⭐');
  setEl('sh-att', (p.attendance_pct || 0) + '%');
  setEl('sh-pts', p.points || 0);
  setEl('sh-streak', '🔥 ' + (p.streak || 0));
  var av = document.getElementById('home-av'); if (av) av.innerHTML = UI.avatarHTML(p);
  var prog = Math.min(100, Math.round(((p.points || 0) % 150) / 150 * 100));
  var rem = 150 - ((p.points || 0) % 150);
  var lb = document.getElementById('sh-levelbar'); if (lb) lb.style.width = prog + '%';
  var lt = document.getElementById('sh-levelbar-txt'); if (lt) lt.textContent = rem + ' نقطة للمستوى التالي';

  var fbBanner = document.getElementById('sh-fb-banner');
  if (fbBanner) {
    if (br && br.facebook_url) {
      fbBanner.href = br.facebook_url;
      fbBanner.classList.remove('hidden');
      var ft = fbBanner.querySelector('.fb-title'); if (ft) ft.textContent = 'صفحة الفرع على فيسبوك';
      var fd = fbBanner.querySelector('.fb-desc'); if (fd) fd.textContent = 'جداول المقابلات ومواعيد فتح المجموعات';
    } else {
      fbBanner.classList.add('hidden');
    }
  }

  var enrollments = [];
  try { enrollments = await API.fetchMyEnrollments(); } catch (e) {}
  var next = document.getElementById('sh-next-lect');
  if (next) {
    if (!enrollments.length) {
      next.innerHTML = UI.emptyState('ph-calendar-x', 'لا توجد محاضرات مجدولة', 'انضم لمجموعة لتظهر مواعيدك');
    } else {
      var e0 = enrollments[0];
      var b = e0.batches || {};
      var c = b.courses || {};
      next.innerHTML = '<div class="c-card" style="cursor:default">' +
        '<div class="pick-ic" style="background:' + SEC.safeColor(c.color) + '"><i class="' + SEC.safeIcon(c.icon) + '"></i></div>' +
        '<div class="flex-1"><div class="text-sm font-bold">' + esc(c.title || b.name) + '</div>' +
        '<div class="text-[11px] text-muted">' + esc(b.schedule || '') + ' · ' + esc((b.branches && b.branches.name_ar) || '') + '</div></div></div>';
    }
  }
  var list = document.getElementById('sh-courses');
  if (list) {
    list.innerHTML = enrollments.length
      ? enrollments.slice(0, 3).map(enrollmentCardHTML).join('')
      : UI.emptyState('ph-book-open', 'لم تنضم لأي مجموعة', 'ابدأ من الاستكشاف', 'استكشف المجموعات', "push('s-explore')");
  }
  var badgesEl = document.getElementById('sh-badges');
  if (badgesEl) {
    var earned = p.badge_ids || [];
    badgesEl.innerHTML = earned.length ? earned.slice(-6).reverse().map(function (id) {
      var bdg = BADGES_CATALOG.find(function (x) { return x.id === id; });
      if (!bdg) return '';
      return '<div style="min-width:64px" class="flex flex-col items-center gap-1.5"><div class="badge-ic" style="background:' + SEC.safeColor(bdg.color) + '"><i class="' + SEC.safeIcon(bdg.icon) + '"></i></div><div class="text-[9.5px] font-bold text-center">' + esc(bdg.name) + '</div></div>';
    }).join('') : '<div class="text-[11px] text-muted">لا توجد شارات بعد</div>';
  }
}

function enrollmentCardHTML(e) {
  var b = e.batches || {};
  var c = b.courses || {};
  var total = c.sessions_count || 1;
  var done = e.sessions_done || 0;
  var pct = Math.round((done / total) * 100);
  var completed = done >= total;
  var cid = c.id || '';
  return '<div class="c-card" onclick="openCourseDetail(\'' + esc(cid) + '\')">' +
    '<div class="pick-ic" style="background:' + SEC.safeColor(c.color) + '"><i class="' + SEC.safeIcon(c.icon) + '"></i></div>' +
    '<div class="flex-1"><div class="flex items-center justify-between"><div class="text-sm font-bold">' + esc(c.title || b.name) + '</div>' +
    (completed ? '<span class="status-chip st-a">مكتملة ✓</span>' : '') + '</div>' +
    '<div class="text-[11px] mt-0.5 text-muted">' + esc(b.name || '') + ' · ' + esc((b.branches && b.branches.name_ar) || '') + '</div>' +
    '<div class="progress-track mt-2"><div style="width:' + pct + '%;height:100%;background:var(--primary);border-radius:99px"></div></div>' +
    '<div class="text-[10px] mt-1 text-muted">' + done + ' من ' + total + ' محاضرة (' + pct + '%)</div></div></div>';
}

async function renderStudentCourses() {
  var list = document.getElementById('sc-list');
  if (!list) return;
  list.innerHTML = UI.skeleton(3);
  try {
    var enrollments = await API.fetchMyEnrollments();
    list.innerHTML = enrollments.length
      ? enrollments.map(enrollmentCardHTML).join('')
      : UI.emptyState('ph-book-bookmark', 'لا توجد دورات', 'استكشف المجموعات المتاحة', 'استكشف الآن', "push('s-explore')");
  } catch (e) {
    list.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e), t('retry'), 'renderStudentCourses()');
  }
}

function filterExploreCourses(text) { _exploreFilterText = (text || '').trim().toLowerCase(); renderExploreListFiltered(); }
function setExploreBranchFilter(id) { _exploreBranchId = id; renderExploreListFiltered(); }

function triggerExploreBranchPickerUI() {
  var items = [{ value: '', label: 'جميع الفروع', sub: 'عرض كل المجموعات', badge: 'الكل', icon: 'ph-globe' }].concat(
    _branches.map(function (b) { return { value: b.id, label: b.name_ar, sub: b.city, icon: 'ph-map-pin' }; })
  );
  UI.openPicker({
    title: 'تصفية حسب الفرع', items: items, currentVal: _exploreBranchId,
    onSelect: function (val, lbl) {
      var txt = document.getElementById('explore-branch-val-txt'); if (txt) txt.textContent = lbl;
      setExploreBranchFilter(val);
    }
  });
}

async function renderExplore() { renderExploreListFiltered(); }

async function renderExploreListFiltered() {
  var list = document.getElementById('explore-list');
  if (!list) return;
  list.innerHTML = UI.skeleton(4);
  try {
    var pack = await Promise.all([API.fetchBatches(true, _exploreBranchId || null), API.fetchMyEnrollments()]);
    var batches = pack[0], myEnroll = pack[1];
    var mine = {};
    myEnroll.forEach(function (e) { mine[e.batch_id] = true; });
    var available = batches.filter(function (b) { return !mine[b.id]; });
    if (_exploreFilterText) {
      available = available.filter(function (b) {
        var c = b.courses || {};
        return [c.title, b.name, (b.branches && b.branches.name_ar), c.category].join(' ').toLowerCase().indexOf(_exploreFilterText) !== -1;
      });
    }
    if (!available.length) {
      list.innerHTML = UI.emptyState('ph-magnifying-glass', 'لا توجد مجموعات مطابقة', 'جرّب فرعاً آخر أو أزل البحث');
      return;
    }
    var seats = {};
    try { seats = await API.seatCounts(available.map(function (b) { return b.id; })); } catch (e) { seats = {}; }

    list.innerHTML = available.map(function (b) {
      var c = b.courses || {};
      return '<div class="c-card" style="align-items:flex-start" data-batch-card="' + esc(b.id) + '">' +
        '<div class="pick-ic" style="background:' + SEC.safeColor(c.color) + '"><i class="' + SEC.safeIcon(c.icon) + '"></i></div>' +
        '<div class="flex-1"><div class="flex items-center justify-between"><div class="text-sm font-bold">' + esc(c.title || b.name) + '</div>' +
        '<span class="chip" style="padding:4px 10px;font-size:9.5px">' + esc(c.category || '') + '</span></div>' +
        '<div class="text-[11px] mt-1 text-teal font-bold">' + esc(b.name) + ' · ' + esc((b.branches && b.branches.name_ar) || '') + '</div>' +
        '<div class="text-[11px] mt-0.5 text-muted"><i class="ph-bold ph-calendar-blank"></i> ' + esc(b.schedule || '') + '</div>' +
        '<div class="text-[11px] mt-0.5 text-muted"><i class="ph-bold ph-chalkboard-teacher"></i> ' + esc((b.profiles && b.profiles.full_name) || 'سيُحدد لاحقاً') + '</div>' +
        seatMeterHTML(seats[b.id], c.max_students) +
        '<div class="flex gap-2 mt-2"><button class="btn btn-primary btn-sm flex-1" data-act="joinBatch" data-arg1="' + esc(b.id) + '" data-busy-label="جاري الانضمام" data-keep-ok="1"><i class="ph-bold ph-plus"></i> انضمام مجاني</button>' +
        '<button class="btn btn-soft btn-sm" data-act="openCourseDetail" data-arg1="' + esc(c.id || '') + '">التفاصيل</button></div></div></div>';
    }).join('');
    if (window.RTCMotion) RTCMotion.stagger(list, '.c-card');
  } catch (e) {
    list.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e), t('retry'), 'renderExplore()');
  }
}

/* غلاف موحّد لأزرار العمليات: سبينر → ✓ أو هزّة خطأ */
function runBtn(el, fn, okLabel) {
  if (el && el.nodeType === 1 && window.RTCMotion) return RTCMotion.withButton(el, fn, okLabel);
  return Promise.resolve(fn()).catch(function (e) { toast(UI.humanError(e), 'err'); return false; });
}

/* عداد المقاعد 12/30 */
function seatMeterHTML(seat, fallbackMax) {
  var cap = (seat && seat.capacity) || fallbackMax || 0;
  if (!cap) return '';
  var used = (seat && typeof seat.enrolled === 'number') ? seat.enrolled : 0;
  var pct = Math.max(0, Math.min(100, Math.round((used / cap) * 100)));
  var cls = pct >= 100 ? 'full' : pct >= 80 ? 'warn' : '';
  var left = Math.max(0, cap - used);
  var label = pct >= 100 ? 'اكتمل العدد — قائمة انتظار' : (left <= 5 ? 'باقي ' + left + ' مقاعد' : 'مقاعد متاحة');
  return '<div class="seat-meter"><i class="ph-bold ph-users-three"></i>' +
    '<span class="seat-num">' + used + '/' + cap + '</span>' +
    '<span class="seat-track"><span class="seat-fill ' + cls + '" style="width:' + pct + '%"></span></span>' +
    '<span>' + label + '</span></div>';
}

async function joinBatch(batchId, el) {
  if (!SEC.isUuid(batchId)) return;
  var btn = (el && el.nodeType === 1) ? el : null;
  var card = btn ? btn.closest('[data-batch-card]') : document.querySelector('[data-batch-card="' + batchId + '"]');
  var MO = window.RTCMotion;

  var run = async function () {
    var r = await API.joinBatch(batchId);
    API.invalidate();
    if (r && r.status === 'waitlisted') { toast(t('waitlisted'), 'warn'); return false; }
    if (r && r.status === 'already') { toast(t('alreadyIn'), 'info'); return false; }
    UI.fireConfetti(30);
    toast(t('joinOk'), 'ok');
    if (CURRENT_PROFILE) { try { CURRENT_PROFILE = await API.fetchMyProfile(); } catch (e) {} }
    return true;
  };

  UI.showConfirm('الانضمام لهذه المجموعة؟', 'سيظهر اسمك في كشف المتطوع، وستُحتسب نقاط الانضمام.', async function () {
    if (btn && MO) {
      var ok = await MO.withButton(btn, run, 'منضم ✓');
      if (ok && card) { MO.flyOut(card, function () { renderExplore(); }); }
      else if (!ok) renderExplore();
      return;
    }
    try { await run(); } catch (e) { toast(UI.humanError(e), 'err'); }
    renderExplore();
  }, { danger: false, yesLabel: 'تأكيد الانضمام' });
}

function openCourseDetail(id) {
  if (!id) return;
  _detailCourseId = id;
  push('s-course-detail');
}

async function renderCourseDetail() {
  var body = document.getElementById('cd-body');
  if (!body) return;
  if (!_detailCourseId) { body.innerHTML = UI.emptyState('ph-book', 'اختر دورة', ''); return; }
  body.innerHTML = UI.skeleton(3);
  try {
    var d = await API.fetchCourseDetail(_detailCourseId);
    var c = d.course;
    var avg = 0;
    if (d.ratings.length) avg = d.ratings.reduce(function (s, r) { return s + r.rating; }, 0) / d.ratings.length;
    body.innerHTML =
      '<div class="grad-hero p-5 rounded-3xl text-white shadow-xl">' +
        '<div class="text-xs text-white/70">' + esc(c.category || '') + ' · ' + esc((c.branches && c.branches.name_ar) || '') + '</div>' +
        '<div class="text-xl font-bold mt-1">' + esc(c.title) + '</div>' +
        '<div class="text-xs text-white/80 mt-2">' + esc(c.description || 'دورة مجانية معتمدة من مركز رسالة.') + '</div>' +
        '<div class="flex gap-2 mt-3 text-xs"><span class="chip bg-white/15 text-white border-white/20">' + (c.sessions_count || 8) + ' محاضرات</span>' +
        '<span class="chip bg-white/15 text-white border-white/20">' + esc(c.level || 'الكل') + '</span>' +
        (avg ? '<span class="chip bg-white/15 text-white border-white/20">★ ' + avg.toFixed(1) + '</span>' : '') + '</div></div>' +
      '<div class="sec-t">المجموعات المتاحة</div>' +
      (d.batches.length ? d.batches.map(function (b) {
        return '<div class="c-card"><div class="flex-1"><div class="text-sm font-bold">' + esc(b.name) + '</div>' +
          '<div class="text-[11px] text-muted">' + esc(b.schedule || '') + ' · ' + esc((b.profiles && b.profiles.full_name) || 'محاضر لاحقاً') + '</div></div>' +
          '<button class="btn btn-primary btn-sm" onclick="joinBatch(\'' + esc(b.id) + '\')">انضمام</button></div>';
      }).join('') : UI.emptyState('ph-users', 'لا مجموعات بعد', 'ترقب الافتتاح')) +
      '<div class="sec-t mt-4">قيّم الدورة</div>' +
      '<div class="card p-3 flex flex-col gap-2"><div class="flex gap-1" id="rate-stars">' +
        [1, 2, 3, 4, 5].map(function (n) { return '<button class="text-2xl" onclick="submitRating(' + n + ')">☆</button>'; }).join('') +
      '</div><textarea class="inp" id="rate-comment" rows="2" placeholder="تعليق اختياري (يظهر للمشرف)"></textarea></div>' +
      (d.ratings.length ? '<div class="sec-t mt-3">آراء الزملاء</div>' + d.ratings.map(function (r) {
        return '<div class="card p-3 mb-2 text-xs"><div class="font-bold">★ ' + r.rating + '/5</div><div class="text-muted mt-1">' + esc(r.comment || '') + '</div></div>';
      }).join('') : '');
  } catch (e) {
    body.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e));
  }
}

async function submitRating(n) {
  try {
    var comment = (document.getElementById('rate-comment') || {}).value || '';
    await API.rateCourse(_detailCourseId, n, comment);
    toast('شكراً لتقييمك ⭐', 'ok');
    renderCourseDetail();
  } catch (e) { toast(UI.humanError(e), 'err'); }
}

async function renderPoints() {
  if (!CURRENT_PROFILE) return;
  try { CURRENT_PROFILE = await API.fetchMyProfile() || CURRENT_PROFILE; } catch (e) {}
  var p = CURRENT_PROFILE;
  setEl('sp-pts', p.points || 0);
  var countEl = document.getElementById('sp-badges-count');
  if (countEl) countEl.textContent = '(' + (p.badge_ids || []).length + ' من ' + BADGES_CATALOG.length + ')';
  var badgesEl = document.getElementById('sp-badges');
  if (badgesEl) {
    badgesEl.innerHTML = BADGES_CATALOG.map(function (b) {
      var earned = (p.badge_ids || []).indexOf(b.id) !== -1;
      return '<div class="badge-tile card p-3 flex flex-col items-center text-center gap-1.5 ' + (earned ? '' : 'opacity-60') + '" onclick="' + (earned ? '' : 'showBadgeLocked(\'' + b.id + '\')') + '">' +
        '<div style="position:relative;width:48px;height:48px"><div style="width:100%;height:100%;border-radius:16px;background:' + SEC.safeColor(b.color) + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;' + (earned ? '' : 'filter:grayscale(.85)') + '"><i class="' + SEC.safeIcon(b.icon) + '"></i></div>' +
        (earned ? '' : '<div class="lock-dot"><i class="ph-fill ph-lock-key"></i></div>') + '</div>' +
        '<div class="font-bold text-xs mt-1">' + esc(b.name) + '</div><div class="text-[10px] text-muted">' + esc(b.desc) + '</div></div>';
    }).join('');
  }
}

function showBadgeLocked(id) {
  var badge = BADGES_CATALOG.find(function (b) { return b.id === id; });
  if (!badge) return;
  UI.openSheet(
    '<div class="modal-sheet text-center" style="padding-top:8px"><div class="modal-handle"></div>' +
    '<div class="badge-ic mx-auto mb-3" style="background:' + SEC.safeColor(badge.color) + ';filter:grayscale(1);opacity:.6"><i class="' + SEC.safeIcon(badge.icon) + '"></i></div>' +
    '<div class="text-xs text-muted mb-1">🔒 شارة مقفلة</div><h3 class="text-lg font-extrabold">' + esc(badge.name) + '</h3>' +
    '<p class="text-xs text-muted mt-1 mb-3">' + esc(badge.desc) + '</p>' +
    '<div class="card p-3 text-xs font-bold text-primary inline-flex gap-2"><i class="ph-fill ph-lightbulb"></i> ' + esc(badge.unlock) + '</div>' +
    '<button class="btn btn-primary btn-mid w-full mt-4" data-close>حسناً</button></div>'
  );
}

async function renderLedger() {
  var el = document.getElementById('ledger-list');
  if (!el) return;
  el.innerHTML = UI.skeleton(4);
  try {
    var rows = await API.fetchLedger();
    el.innerHTML = rows.length ? rows.map(function (r) {
      var title = (r.points_rules && r.points_rules.title) || r.reason || 'حركة نقاط';
      var sign = r.amount >= 0 ? '+' : '';
      return '<div class="card p-3 mb-2 flex justify-between items-center"><div><div class="text-sm font-bold">' + esc(title) + '</div>' +
        '<div class="text-[10px] text-muted">' + new Date(r.created_at).toLocaleString('ar-EG') + '</div></div>' +
        '<div class="font-extrabold" style="color:var(--teal)">' + sign + r.amount + '</div></div>';
    }).join('') : UI.emptyState('ph-coins', 'لا حركات بعد', 'سجّل حضورك لتبدأ النقاط');
  } catch (e) { el.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e)); }
}

async function renderCerts() {
  var list = document.getElementById('scerts-list');
  if (!list) return;
  list.innerHTML = UI.skeleton(2);
  try {
    var data = await API.fetchCerts(true);
    if (!data.length) {
      list.innerHTML = UI.emptyState('ph-certificate', 'لا شهادات بعد', 'أكمل حضور الدورة ليصدر المتطوع شهادتك');
      return;
    }
    list.innerHTML = data.map(function (cert) {
      var c = cert.courses || {};
      return '<div class="card p-4 flex items-center gap-3"><div class="pick-ic" style="background:linear-gradient(135deg,' + SEC.safeColor(c.color) + ',#d4af37)"><i class="ph-fill ph-certificate"></i></div>' +
        '<div class="flex-1"><div class="text-sm font-bold">' + esc(c.title || 'دورة') + '</div>' +
        '<div class="text-[11px] text-muted">شهادة إتمام — مركز رسالة</div>' +
        '<div class="text-[10px] mt-0.5 text-muted" dir="ltr"># ' + esc(cert.serial_number) + '</div></div>' +
        '<button class="btn btn-teal btn-sm" data-act="downloadCertificate" data-arg1="' + esc(cert.serial_number) + '" data-arg2="' + esc(c.title || '') + '" data-arg3="' + (cert.issued_at || '') + '" data-busy-label="تجهيز"><i class="ph-bold ph-download-simple"></i> PDF</button></div>';
    }).join('');
  } catch (e) { list.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e)); }
}

function downloadCertificate(serial, title, issued, el) {
  if (!CURRENT_PROFILE) return;
  return runBtn(el, function () {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        try { generateCertificatePDF(title, CURRENT_PROFILE.full_name, serial, issued); resolve(true); }
        catch (e) { toast(UI.humanError(e), 'err'); reject(e); }
      }, 220);
    });
  }, 'جاهزة ✓');
}

function generateCertificatePDF(courseTitle, studentName, serial, issued) {
  var W = 1600, H = 1131;
  var cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H;
  var ctx = cvs.getContext('2d');
  var grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#001a6b'); grad.addColorStop(0.55, '#00288e'); grad.addColorStop(1, '#003c36');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  var pad = 46;
  ctx.fillStyle = '#fbfcff'; roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 26); ctx.fill();
  ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 4; roundRect(ctx, pad + 18, pad + 18, W - pad * 2 - 36, H - pad * 2 - 36, 18); ctx.stroke();
  ctx.textAlign = 'center'; ctx.direction = 'rtl';
  ctx.beginPath(); ctx.arc(W / 2, 168, 54, 0, Math.PI * 2);
  var lg = ctx.createLinearGradient(W / 2 - 54, 120, W / 2 + 54, 220); lg.addColorStop(0, '#00288e'); lg.addColorStop(1, '#00554e');
  ctx.fillStyle = lg; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '800 46px Inter,sans-serif'; ctx.fillText('R', W / 2, 185);
  ctx.fillStyle = '#0f1420'; ctx.font = '700 30px "IBM Plex Sans Arabic",sans-serif'; ctx.fillText('مركز رسالة للتنمية والتطوير', W / 2, 262);
  ctx.font = '800 62px "IBM Plex Sans Arabic",sans-serif'; ctx.fillStyle = '#00288e'; ctx.fillText('شهادة إتمام دورة تدريبية', W / 2, 360);
  ctx.font = '400 26px "IBM Plex Sans Arabic",sans-serif'; ctx.fillStyle = '#667085'; ctx.fillText('تشهد إدارة مركز رسالة للتنمية والتطوير بأن الطالب/ة', W / 2, 460);
  ctx.font = '800 54px "IBM Plex Sans Arabic",sans-serif'; ctx.fillStyle = '#0f1420'; ctx.fillText(studentName, W / 2, 540);
  ctx.font = '400 26px "IBM Plex Sans Arabic",sans-serif'; ctx.fillStyle = '#667085'; ctx.fillText('قد أتم / أتمت بنجاح متطلبات دورة', W / 2, 610);
  ctx.font = '700 40px "IBM Plex Sans Arabic",sans-serif'; ctx.fillStyle = '#00554e'; ctx.fillText(courseTitle || '—', W / 2, 668);
  var dateStr = issued ? new Date(issued).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.font = '400 22px "IBM Plex Sans Arabic",sans-serif'; ctx.fillStyle = '#667085'; ctx.fillText('بتاريخ ' + dateStr, W / 2, 712);
  ctx.font = '600 18px monospace'; ctx.fillStyle = '#667085'; ctx.fillText(serial || '', W / 2, H - 64);
  var verifyUrl = location.origin + location.pathname.replace(/index\.html$/, '') + 'verify.html?s=' + encodeURIComponent(serial || '');
  if (window.QRCode && QRCode.toCanvas) {
    var qrc = document.createElement('canvas');
    QRCode.toCanvas(qrc, verifyUrl, { width: 140, margin: 0 }, function () {
      ctx.drawImage(qrc, W / 2 - 380, H - 230, 120, 120);
      finishCert(cvs, courseTitle);
    });
  } else {
    finishCert(cvs, courseTitle);
  }
}

function finishCert(cvs, courseTitle) {
  var W = cvs.width, H = cvs.height;
  if (window.jspdf && window.jspdf.jsPDF) {
    var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'px', format: [W, H] });
    doc.addImage(cvs.toDataURL('image/png'), 'PNG', 0, 0, W, H);
    doc.save('شهادة - ' + (courseTitle || 'RTC') + '.pdf');
    toast('تم تحميل الشهادة ✓', 'ok');
  } else {
    var a = document.createElement('a'); a.href = cvs.toDataURL('image/png'); a.download = 'شهادة.png'; a.click();
    toast('تم استخراج الشهادة ✓', 'ok');
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function openVerifyCertModal() {
  UI.openSheet(
    '<div class="modal-sheet text-right max-w-md mx-auto flex flex-col gap-4" style="border-radius:28px"><div class="modal-handle"></div>' +
    '<div class="flex items-center gap-3 border-b border-line pb-3"><div class="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center"><i class="ph-bold ph-shield-check"></i></div>' +
    '<div><h3 class="text-base font-bold">التحقق من الشهادة</h3><p class="text-xs text-muted">أدخل الرقم التسلسلي — بلا بيانات حساسة أخرى</p></div></div>' +
    '<input class="inp font-mono" id="vc-code" dir="ltr" placeholder="RTC-XXXXXXXXXX" style="text-align:left">' +
    '<div id="vc-result"></div>' +
    '<div class="flex gap-2"><button class="btn btn-soft btn-mid flex-1" data-close>إغلاق</button>' +
    '<button class="btn btn-primary btn-mid flex-1" onclick="verifyCertCode()"><i class="ph-bold ph-magnifying-glass"></i> تحقق</button></div></div>',
    'modal-verify-cert'
  );
}

async function verifyCertCode() {
  var code = (document.getElementById('vc-code') || {}).value;
  var res = document.getElementById('vc-result');
  if (!code || !res) { toast('أدخل كود الشهادة', 'err'); return; }
  res.innerHTML = '<div class="text-xs text-muted text-center py-2">جارٍ التحقق...</div>';
  try {
    var data = await API.verifyCert(code.trim());
    if (data && data.length && data[0].is_valid) {
      var v = data[0];
      res.innerHTML = '<div class="card p-3 text-xs" style="border-color:rgba(0,85,78,.3)"><div class="font-bold text-sm" style="color:var(--teal)">شهادة موثقة ✓</div>' +
        '<div class="mt-1"><b>الاسم:</b> ' + esc(v.student_name) + '</div><div><b>الدورة:</b> ' + esc(v.course_title) + '</div>' +
        '<div><b>تاريخ الإصدار:</b> ' + new Date(v.issued_date).toLocaleDateString('ar-EG') + '</div></div>';
    } else {
      res.innerHTML = '<div class="card p-3 text-xs font-bold" style="color:var(--red)">الكود غير مسجّل</div>';
    }
  } catch (e) { res.innerHTML = '<div class="text-xs" style="color:var(--red)">' + esc(UI.humanError(e)) + '</div>'; }
}

async function renderProfile() {
  if (!CURRENT_PROFILE) return;
  try { CURRENT_PROFILE = await API.fetchMyProfile() || CURRENT_PROFILE; } catch (e) {}
  var p = CURRENT_PROFILE;
  var br = branchOf(p);
  var av = document.getElementById('pf-av'); if (av) av.innerHTML = UI.avatarHTML(p);
  setEl('pf-name', p.full_name);
  setEl('pf-branch', (br && br.name_ar) || '');
  setEl('pf-phone', p.phone || '—');
  setEl('pf-branch2', (br && br.name_ar) || '');
  setEl('pf-email', p.email || '—');
  setEl('pf-google', 'موثق عبر Google ✓');
  setEl('pf-cloud', window.supabaseClient ? 'متزامن مع السحابة ✓' : 'غير متصل');
  var cardBox = document.getElementById('pf-smart-card');
  if (!cardBox) {
    var pfBody = document.querySelector('#screen-s-profile .scr-body');
    if (pfBody) {
      var div = document.createElement('div');
      div.id = 'pf-smart-card'; div.className = 'mb-3';
      pfBody.insertBefore(div, pfBody.firstChild);
      cardBox = div;
    }
  }
  if (cardBox) {
    cardBox.innerHTML = '<div class="p-4 rounded-3xl text-white shadow-xl" style="background:linear-gradient(135deg,#001a6b,#00288e 55%,#00554e)">' +
      '<div class="flex justify-between"><div><div class="text-[10px] text-white/70">جمعية رسالة — مركز التدريب</div>' +
      '<div class="text-base font-bold mt-1">' + esc(p.full_name) + '</div><div class="text-xs text-white/80">' + esc((br && br.name_ar) || '') + '</div></div>' +
      '<div class="avatar w-11 h-11 text-xs border-2 border-white/30">' + UI.avatarHTML(p) + '</div></div>' +
      '<div class="flex justify-between mt-4 pt-3 border-t border-white/20 text-xs">' +
      '<div><div class="text-[9px] text-white/60">العضوية</div><div class="font-mono font-bold" dir="ltr">RTC-' + esc(String(p.id || '').slice(0, 8).toUpperCase()) + '</div></div>' +
      '<div><div class="text-[9px] text-white/60">المستوى</div><div class="font-bold">' + Math.max(1, Math.floor((p.points || 0) / 150) + 1) + ' ⭐</div></div>' +
      '<div><div class="text-[9px] text-white/60">النقاط</div><div class="font-bold">' + (p.points || 0) + '</div></div></div></div>';
  }
}

function renderEditProfile() {
  if (!CURRENT_PROFILE) return;
  var p = CURRENT_PROFILE;
  var av = document.getElementById('ep-av');
  if (av) av.innerHTML = UI.avatarHTML(p) + '<span class="av-cam"><i class="ph-bold ph-camera"></i></span>';
  var n = document.getElementById('ep-name'); if (n) n.value = p.full_name || '';
  var ph = document.getElementById('ep-phone'); if (ph) ph.value = p.phone || '';
  var br = document.getElementById('ep-branch'); if (br) br.value = p.branch_id || '';
  var txt = document.getElementById('ep-branch-val-txt');
  var b = branchOf(p);
  if (txt) txt.textContent = (b && b.name_ar) || 'اختر الفرع';
}

function triggerEditProfileBranchPickerUI() {
  openBranchPicker(document.getElementById('ep-branch') && document.getElementById('ep-branch').value, function (id, label) {
    var h = document.getElementById('ep-branch'); if (h) h.value = id;
    var tEl = document.getElementById('ep-branch-val-txt'); if (tEl) tEl.textContent = label;
  });
}

async function editAvatar(event) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    toast('جارٍ رفع الصورة...', 'info');
    var url = await API.uploadAvatar(file);
    CURRENT_PROFILE.avatar_url = url;
    var av = document.getElementById('ep-av');
    if (av) av.innerHTML = '<img src="' + esc(url) + '" alt=""><span class="av-cam"><i class="ph-bold ph-camera"></i></span>';
    toast('تم تحديث الصورة', 'ok');
  } catch (e) { toast(UI.humanError(e), 'err'); }
}

async function saveEditProfile(el) {
  var name = (document.getElementById('ep-name') || {}).value || '';
  var phone = (document.getElementById('ep-phone') || {}).value || '';
  var branch = (document.getElementById('ep-branch') || {}).value;
  name = name.trim(); phone = phone.trim();
  if (name.split(/\s+/).filter(Boolean).length < 2) { toast(t('invalidName'), 'err'); return; }
  if (!/^01[0125][0-9]{8}$/.test(phone)) { toast(t('invalidPhone'), 'err'); return; }
  await runBtn(el, async function () {
    CURRENT_PROFILE = await API.updateMyProfile({
      full_name: name, phone: phone, branch_id: branch || null,
      avatar_url: CURRENT_PROFILE.avatar_url
    });
    toast('تم حفظ التعديلات ✓', 'ok');
    setTimeout(pop, 420);
    return true;
  }, 'تم الحفظ ✓');
}

async function renderLeaderboard() {
  var el = document.getElementById('lb-list');
  if (!el) return;
  el.innerHTML = UI.skeleton(5);
  try {
    var data = await API.leaderboard();
    if (!data || !data.length) { el.innerHTML = UI.emptyState('ph-trophy', 'لا بيانات بعد', 'سجّل حضوراً ليظهر اسمك'); return; }
    var medals = ['🥇', '🥈', '🥉'];
    el.innerHTML = data.map(function (p, i) {
      var me = CURRENT_USER && p.id === CURRENT_USER.id;
      return '<div class="lb-row card p-3 flex items-center gap-3 mb-2 ' + (me ? 'border-2 border-primary' : '') + '">' +
        '<div class="font-bold text-sm w-6 text-center">' + (medals[i] || (i + 1)) + '</div>' +
        '<div class="avatar w-9 h-9 text-xs">' + UI.avatarHTML(p) + '</div>' +
        '<div class="flex-1 text-sm font-bold">' + esc(p.full_name) + (me ? ' (أنت)' : '') + '</div>' +
        '<div class="text-sm font-bold" style="color:var(--primary)">' + (p.points || 0) + ' ن</div></div>';
    }).join('');
  } catch (e) { el.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e)); }
}

async function renderNotifications() {
  var list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = UI.skeleton(3);
  try {
    var data = await API.fetchNotifications();
    if (!data.length) { list.innerHTML = UI.emptyState('ph-bell-slash', 'لا إشعارات', 'ستظهر هنا التأجيلات والتنبيهات'); return; }
    list.innerHTML = data.map(function (n) {
      var hot = n.type === 'cancelled' || n.type === 'postponed';
      return '<div class="card p-3 mb-2 flex items-start gap-3 ' + (hot ? 'border-2' : '') + '" onclick="ackNotif(\'' + esc(n.id) + '\')">' +
        '<div class="pick-ic" style="background:' + (n.type === 'cancelled' ? 'var(--red)' : n.type === 'postponed' ? 'var(--amber)' : 'var(--primary)') + '"><i class="ph-fill ' + (n.type === 'cancelled' ? 'ph-x-circle' : n.type === 'postponed' ? 'ph-clock-countdown' : 'ph-bell') + '"></i></div>' +
        '<div class="flex-1"><div class="text-sm font-bold">' + esc(n.title) + '</div><div class="text-xs mt-1">' + esc(n.message) + '</div>' +
        '<div class="text-[10px] text-muted mt-1.5">' + new Date(n.created_at).toLocaleString('ar-EG') + (n.read_at ? '' : ' · جديد') + '</div></div></div>';
    }).join('');
    refreshUnread();
  } catch (e) { list.innerHTML = UI.emptyState('ph-bell-slash', 'لا إشعارات', ''); }
}

async function ackNotif(id) {
  try { await API.markNotifRead(id); refreshUnread(); } catch (e) {}
}

function renderSupport() {
  var faqEl = document.getElementById('faq-list');
  if (!faqEl) return;
  faqEl.innerHTML = FAQ.map(function (f, i) {
    return '<div class="faq-item card p-3 mb-2" id="faq-' + i + '"><div class="faq-q font-bold text-sm cursor-pointer flex items-center justify-between" onclick="toggleFaq(' + i + ')"><span>' + esc(f.q) + '</span><i class="ph-bold ph-caret-down faq-caret"></i></div><div class="faq-a text-xs leading-relaxed">' + esc(f.a) + '</div></div>';
  }).join('');
}
function toggleFaq(i) { var el = document.getElementById('faq-' + i); if (el) el.classList.toggle('open'); }

async function shareApp() {
  var url = location.origin + location.pathname;
  var text = 'مسار RTC — كورسات رسالة المجانية';
  try {
    if (navigator.share) await navigator.share({ title: 'مسار RTC', text: text, url: url });
    else { await navigator.clipboard.writeText(url); toast('تم نسخ الرابط', 'ok'); }
    await API.claimSocial();
    if (CURRENT_PROFILE) {
      CURRENT_PROFILE.badge_ids = CURRENT_PROFILE.badge_ids || [];
      if (CURRENT_PROFILE.badge_ids.indexOf('social') === -1) CURRENT_PROFILE.badge_ids.push('social');
    }
  } catch (e) {}
}

/* ═══════════════ Check-in + excuses ═══════════════ */
function renderCheckin() {
  var box = document.getElementById('checkin-box');
  if (!box) return;
  box.innerHTML =
    '<div class="card p-4 flex flex-col gap-3"><p class="text-xs text-muted">أدخل رمز المحاضرة الذي يعرضه المتطوع، أو امسح QR إن وُجد.</p>' +
    '<input class="inp font-mono text-center text-xl tracking-widest" id="ci-code" maxlength="8" dir="ltr" placeholder="ABC123" style="text-transform:uppercase">' +
    '<button class="btn btn-primary btn-big" data-act="doCheckin" data-busy-label="جاري التسجيل"><i class="ph-bold ph-qr-code"></i> تأكيد حضوري</button></div>';
}

async function doCheckin(el) {
  var code = ((document.getElementById('ci-code') || {}).value || '').trim();
  if (code.length < 4) { toast('أدخل الرمز كاملاً', 'err'); return; }
  await runBtn(el, async function () {
    await API.checkIn(code);
    UI.fireConfetti(40);
    toast('تم تسجيل حضورك ✓', 'ok');
    if (CURRENT_PROFILE) CURRENT_PROFILE = await API.fetchMyProfile();
    return true;
  }, 'تم الحضور ✓');
}

async function renderExcuseForm() {
  var box = document.getElementById('excuse-box');
  if (!box) return;
  box.innerHTML = UI.skeleton(2);
  try {
    var enroll = await API.fetchMyEnrollments();
    var mine = await API.fetchExcuses(false);
    var opts = enroll.map(function (e) {
      var b = e.batches || {};
      return '<option value="' + esc(e.batch_id) + '">' + esc(b.name || 'مجموعة') + '</option>';
    }).join('');
    box.innerHTML =
      '<div class="card p-4 flex flex-col gap-3">' +
      '<label class="lbl">المجموعة</label><select class="inp" id="ex-batch">' + opts + '</select>' +
      '<label class="lbl">سبب العذر</label><textarea class="inp" id="ex-reason" rows="3" placeholder="مثال: ظرف صحي طارئ مع تقرير"></textarea>' +
      '<label class="lbl">مرفق اختياري</label><input type="file" id="ex-file" class="inp" style="padding-top:12px">' +
      '<button class="btn btn-primary btn-mid" data-act="submitExcuse" data-busy-label="جاري الإرسال"><i class="ph-bold ph-paper-plane-tilt"></i> إرسال الطلب</button></div>' +
      '<div class="sec-t mt-4">طلباتك السابقة</div>' +
      (mine.length ? mine.map(function (x) {
        return '<div class="card p-3 mb-2"><div class="flex justify-between"><div class="text-sm font-bold">' + esc(x.reason).slice(0, 80) + '</div>' +
          '<span class="status-chip ' + (x.status === 'approved' ? 'st-a' : x.status === 'rejected' ? 'st-r' : 'st-p') + '">' + esc(x.status) + '</span></div>' +
          '<div class="text-[10px] text-muted mt-1">' + new Date(x.created_at).toLocaleDateString('ar-EG') + '</div></div>';
      }).join('') : '<div class="text-xs text-muted">لا طلبات بعد</div>');
  } catch (e) { box.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e)); }
}

async function submitExcuse(el) {
  var batch = (document.getElementById('ex-batch') || {}).value;
  var reason = ((document.getElementById('ex-reason') || {}).value || '').trim();
  var fileEl = document.getElementById('ex-file');
  if (!batch) { toast('اختر المجموعة', 'err'); return; }
  if (reason.length < 8) { toast('اكتب سبباً أوضح', 'err'); return; }
  await runBtn(el, async function () {
    var path = null;
    if (fileEl && fileEl.files && fileEl.files[0]) path = await API.uploadExcuseFile(fileEl.files[0]);
    await API.submitExcuse({ p_batch_id: batch, p_session_id: null, p_reason: reason, p_file: path });
    toast('تم إرسال طلب العذر', 'ok');
    setTimeout(renderExcuseForm, 500);
    return true;
  }, 'تم الإرسال ✓');
}

/* ═══════════════ Volunteer ═══════════════ */
async function renderVolunteerHome() {
  if (!CURRENT_PROFILE) return;
  setEl('vh-name', (CURRENT_PROFILE.full_name || '').split(' ')[0]);
  var br = branchOf(CURRENT_PROFILE);
  setEl('vh-branch', (br && br.name_ar) || '');
  var av = document.getElementById('vh-av'); if (av) av.innerHTML = UI.avatarHTML(CURRENT_PROFILE);
  var el = document.getElementById('vh-batches');
  if (!el) return;
  el.innerHTML = UI.skeleton(2);
  try {
    var mine = await API.fetchMyBatches();
    el.innerHTML = mine.length ? mine.map(batchSummaryCard).join('') :
      UI.emptyState('ph-users-three', 'لا مجموعات بعد', 'أضف مجموعة أو تولَّ إشراف واحدة', 'إضافة مجموعة', 'openAddBatchModal()');
  } catch (e) { el.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e)); }
}

function batchSummaryCard(b) {
  var c = b.courses || {};
  return '<div class="c-card" onclick="openBatchDetail(\'' + esc(b.id) + '\')">' +
    '<div class="pick-ic" style="background:' + SEC.safeColor(c.color) + '"><i class="' + SEC.safeIcon(c.icon) + '"></i></div>' +
    '<div class="flex-1"><div class="text-sm font-bold">' + esc(b.name) + '</div>' +
    '<div class="text-[11px] text-muted">' + esc(c.title || '') + ' · ' + esc((b.branches && b.branches.name_ar) || '') + '</div>' +
    '<div class="text-[11px] text-muted">' + esc(b.schedule || '') + '</div></div><i class="ph-bold ph-caret-left text-muted"></i></div>';
}

async function renderVolunteerBatches() {
  var list = document.getElementById('vb-list');
  if (!list) return;
  list.innerHTML = UI.skeleton(3);
  try {
    var mine = await API.fetchMyBatches();
    list.innerHTML = mine.length ? mine.map(batchSummaryCard).join('') :
      UI.emptyState('ph-users-three', 'لا مجموعات', 'أضف مجموعتك الأولى', 'إضافة', 'openAddBatchModal()');
  } catch (e) { list.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e)); }
}

async function openBatchDetail(batchId) {
  try {
    var mine = await API.fetchMyBatches();
    var all = mine.length ? mine : await API.fetchBatches(true);
    _currentBatch = all.find(function (b) { return b.id === batchId; });
    if (!_currentBatch) { toast('المجموعة غير موجودة', 'err'); return; }
    _batchStudents = await API.fetchBatchStudents(batchId);
    _attendanceState = {};
    _currentSession = null;
    var old = document.getElementById('screen-v-batch-detail'); if (old) old.remove();
    var screen = document.createElement('div');
    screen.id = 'screen-v-batch-detail';
    screen.className = 'screen';
    var c = _currentBatch.courses || {};
    var isStaff = CURRENT_PROFILE && (CURRENT_PROFILE.role === 'admin' || CURRENT_PROFILE.role === 'volunteer');
    screen.innerHTML =
      '<div class="glass-header"><div class="hdr"><button class="icon-btn" onclick="pop()"><i class="ph ph-arrow-right"></i></button>' +
      '<h1 class="text-sm font-bold">' + esc(_currentBatch.name) + '</h1><span class="status-chip st-a">' + _batchStudents.length + ' طالب</span></div></div>' +
      '<div class="scr-body" id="vbd-body">' +
      '<div class="grad-hero p-4 rounded-3xl text-white shadow-xl mb-4"><div class="text-lg font-bold">' + esc(c.title || _currentBatch.name) + '</div>' +
      '<div class="text-xs text-white/80 mt-1">' + esc(_currentBatch.schedule || '') + '</div></div>' +
      '<div class="grid grid-cols-2 gap-2 mb-4">' +
      '<button class="btn btn-primary btn-sm" onclick="startTodaySession()"><i class="ph-bold ph-qr-code"></i> بدء محاضرة اليوم</button>' +
      '<button class="btn btn-soft btn-sm" onclick="exportBatchRosterCSV()"><i class="ph-bold ph-file-csv"></i> تصدير CSV</button>' +
      '<button class="btn btn-amber btn-sm" onclick="openNotifyBatchModal(\'' + esc(_currentBatch.id) + '\')"><i class="ph-bold ph-bell"></i> تنبيه المجموعة</button>' +
      '<button class="btn btn-teal btn-sm" onclick="issueCerts()"><i class="ph-bold ph-certificate"></i> إصدار الشهادات</button></div>' +
      '<div id="session-qr" class="hidden mb-4"></div>' +
      '<div class="sec-t">كشف الطلاب — حضور اليوم</div><div id="vbd-roster">' + rosterHTML(isStaff) + '</div>' +
      (_batchStudents.length ? '<button class="btn btn-teal btn-big w-full mt-3" data-act="saveAttendance" data-busy-label="جاري الحفظ"><i class="ph-bold ph-floppy-disk"></i> حفظ الحضور</button>' +
        '<button class="btn btn-soft btn-mid w-full mt-2" onclick="openReportModal()">تقرير المحاضرة</button>' : '') +
      '</div>';
    document.getElementById('app').appendChild(screen);
    push('v-batch-detail');
  } catch (e) { toast(UI.humanError(e), 'err'); }
}

function rosterHTML(isStaff) {
  if (!_batchStudents.length) return UI.emptyState('ph-users', 'لا طلاب بعد', 'ادعُ الطلاب للانضمام');
  return _batchStudents.map(function (e) {
    var prof = e.profiles || {};
    var phone = (CURRENT_PROFILE && CURRENT_PROFILE.role === 'admin') ? (prof.phone || '—') : SEC.maskPhone(prof.phone);
    return '<div class="card p-3 flex items-center gap-3 mb-2"><div class="avatar w-10 h-10 text-sm cursor-pointer" onclick="openStudentFile(\'' + esc(prof.id) + '\')">' + UI.avatarHTML(prof) + '</div>' +
      '<div class="flex-1"><div class="text-sm font-bold">' + esc(prof.full_name || '—') + '</div>' +
      '<div class="text-[11px] text-muted" dir="ltr">' + esc(phone) + ' · ' + (e.sessions_done || 0) + ' محاضرة</div></div>' +
      '<div class="flex gap-1.5">' +
      '<button class="roster-chk" id="att-p-' + esc(prof.id) + '" onclick="setAttendance(\'' + esc(prof.id) + '\',\'present\')"><i class="ph-bold ph-check"></i></button>' +
      '<button class="roster-chk" id="att-l-' + esc(prof.id) + '" onclick="setAttendance(\'' + esc(prof.id) + '\',\'late\')">⏰</button>' +
      '<button class="roster-chk" id="att-a-' + esc(prof.id) + '" onclick="setAttendance(\'' + esc(prof.id) + '\',\'absent\')"><i class="ph-bold ph-x" style="color:var(--red)"></i></button>' +
      '<button class="roster-chk" id="att-e-' + esc(prof.id) + '" onclick="setAttendance(\'' + esc(prof.id) + '\',\'excused\')"><i class="ph-bold ph-first-aid"></i></button>' +
      '</div></div>';
  }).join('');
}

function setAttendance(studentId, status) {
  _attendanceState[studentId] = status;
  ['present', 'late', 'absent', 'excused'].forEach(function (s) {
    var el = document.getElementById('att-' + s[0] + '-' + studentId);
    if (el) el.classList.toggle('on', s === status);
  });
  SEC.haptic(8);
}

async function startTodaySession() {
  if (!_currentBatch) return;
  try {
    _currentSession = await API.startSession(_currentBatch.id);
    toast(_currentSession.reuse ? 'محاضرة اليوم مفتوحة' : 'تم بدء المحاضرة', 'ok');
    var box = document.getElementById('session-qr');
    if (!box) return;
    box.classList.remove('hidden');
    var code = _currentSession.checkin_code || '';
    var payload = location.origin + location.pathname + '#s-checkin';
    box.innerHTML = '<div class="card p-4 text-center"><div class="text-xs text-muted mb-2">امسح أو أدخل الرمز</div>' +
      '<canvas id="qr-canvas" class="mx-auto"></canvas>' +
      '<div class="text-3xl font-black tracking-[0.3em] mt-3" dir="ltr">' + esc(code) + '</div>' +
      '<div class="text-[10px] text-muted mt-1">محاضرة رقم ' + (_currentSession.session_number || '') + '</div></div>';
    if (window.QRCode && QRCode.toCanvas) {
      QRCode.toCanvas(document.getElementById('qr-canvas'), 'RTC-CHECKIN:' + code + '|' + payload, { width: 196, margin: 1 });
    }
  } catch (e) { toast(UI.humanError(e), 'err'); }
}

async function saveAttendance(el) {
  if (!_currentBatch) return;
  var keys = Object.keys(_attendanceState);
  var missing = _batchStudents.length - keys.length;
  var go = function () {
    return runBtn(el, async function () {
      if (!_currentSession) _currentSession = await API.startSession(_currentBatch.id);
      var records = keys.map(function (sid) { return { student_id: sid, status: _attendanceState[sid] }; });
      await API.saveAttendance(_currentSession.id, records);
      UI.fireConfetti(36);
      toast(t('attendanceSaved') + ' · ' + keys.length + ' طالب', 'ok');
      API.invalidate();
      setTimeout(pop, 460);
      return true;
    }, 'تم الحفظ ✓');
  };
  if (!keys.length) { toast('حدّد حالة طالب واحد على الأقل', 'err'); return; }
  if (missing > 0) {
    UI.showConfirm('طلاب بلا حالة', missing + ' طالب بلا تحديد. حفظ الحالات المحددة فقط؟', go, { danger: false, yesLabel: 'حفظ' });
  } else go();
}

async function issueCerts() {
  if (!_currentBatch) return;
  UI.showConfirm('إصدار الشهادات؟', 'ستصدر فقط للطلاب الذين أكملوا عدد محاضرات الدورة.', async function () {
    try {
      var r = await API.issueCerts(_currentBatch.id);
      var n = (r && r.issued) || 0;
      if (n) { UI.fireConfetti(70); toast('تم إصدار ' + n + ' شهادة 🎓', 'ok'); }
      else toast('لا طلاب مستحقين بعد', 'info');
    } catch (e) { toast(UI.humanError(e), 'err'); }
  }, { danger: false, yesLabel: 'إصدار' });
}

function openNotifyBatchModal(batchId) {
  UI.openSheet(
    '<div class="modal-sheet flex flex-col gap-3"><div class="modal-handle"></div><h3 class="text-base font-bold">تنبيه طلاب المجموعة</h3>' +
    '<select class="inp" id="nb-type"><option value="postponed">تأجيل</option><option value="cancelled">إلغاء</option><option value="announcement">إعلان</option></select>' +
    '<input class="inp" id="nb-title" value="تنبيه هام بشأن المحاضرة">' +
    '<textarea class="inp" id="nb-msg" rows="3" placeholder="التفاصيل والموعد البديل"></textarea>' +
    '<div class="flex gap-2"><button class="btn btn-soft btn-mid flex-1" data-close>إلغاء</button>' +
    '<button class="btn btn-primary btn-mid flex-1" onclick="sendBatchNotice(\'' + esc(batchId) + '\')">إرسال</button></div></div>',
    'modal-notify-batch'
  );
}

async function sendBatchNotice(batchId) {
  var type = (document.getElementById('nb-type') || {}).value;
  var title = ((document.getElementById('nb-title') || {}).value || '').trim();
  var msg = ((document.getElementById('nb-msg') || {}).value || '').trim();
  if (!msg) { toast('اكتب نص التنبيه', 'err'); return; }
  try {
    var n = await API.broadcast('batch', batchId, type, title, msg);
    document.getElementById('modal-notify-batch') && document.getElementById('modal-notify-batch').remove();
    toast('تم إرسال التنبيه لـ ' + n + ' طالب', 'ok');
  } catch (e) { toast(UI.humanError(e), 'err'); }
}

function openReportModal() {
  if (!_currentSession) { toast('ابدأ محاضرة اليوم أولاً', 'info'); return; }
  UI.openSheet(
    '<div class="modal-sheet flex flex-col gap-3"><div class="modal-handle"></div><h3 class="font-bold">تقرير المحاضرة</h3>' +
    '<textarea class="inp" id="rp-sum" rows="3" placeholder="ملخص ما تم شرحه"></textarea>' +
    '<label class="lbl">مستوى الفهم (1-5)</label><input class="inp" id="rp-und" type="number" min="1" max="5" value="4">' +
    '<label class="lbl">التفاعل (1-5)</label><input class="inp" id="rp-eng" type="number" min="1" max="5" value="4">' +
    '<div class="flex gap-2"><button class="btn btn-soft flex-1" data-close>إلغاء</button>' +
    '<button class="btn btn-primary flex-1" onclick="saveReport()">حفظ التقرير</button></div></div>'
  );
}

async function saveReport() {
  try {
    await API.submitReport(_currentSession.id, (document.getElementById('rp-sum') || {}).value, parseInt((document.getElementById('rp-und') || {}).value, 10), parseInt((document.getElementById('rp-eng') || {}).value, 10));
    document.querySelector('.modal-bg') && document.querySelector('.modal-bg').remove();
    toast('تم حفظ التقرير', 'ok');
  } catch (e) { toast(UI.humanError(e), 'err'); }
}

function openStudentFile(id) {
  var e = _batchStudents.find(function (x) { return (x.profiles || {}).id === id || x.student_id === id; });
  if (!e) return;
  var p = e.profiles || {};
  var phone = CURRENT_PROFILE.role === 'admin' ? (p.phone || '—') : SEC.maskPhone(p.phone);
  UI.openSheet(
    '<div class="modal-sheet flex flex-col gap-3"><div class="modal-handle"></div>' +
    '<div class="flex items-center gap-3"><div class="avatar w-14 h-14">' + UI.avatarHTML(p) + '</div><div><div class="font-bold">' + esc(p.full_name) + '</div>' +
    '<div class="text-xs text-muted" dir="ltr">' + esc(phone) + '</div><div class="text-xs">' + (p.points || 0) + ' نقطة · سلسلة ' + (p.streak || 0) + '</div></div></div>' +
    '<textarea class="inp" id="pn-body" rows="3" placeholder="ملاحظة خاصة (لا يراها الطالب)"></textarea>' +
    '<button class="btn btn-primary btn-mid" onclick="saveNote(\'' + esc(p.id) + '\')">حفظ الملاحظة</button></div>'
  );
}

async function saveNote(sid) {
  try {
    await API.addNote(sid, (document.getElementById('pn-body') || {}).value);
    toast('حُفظت الملاحظة', 'ok');
  } catch (e) { toast(UI.humanError(e), 'err'); }
}

function exportToCSV(filename, headers, rows) {
  var csv = '\uFEFF' + headers.join(',') + '\n';
  rows.forEach(function (row) {
    csv += row.map(function (val) { return '"' + String(val || '').replace(/"/g, '""') + '"'; }).join(',') + '\n';
  });
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  toast('تم تصدير CSV', 'ok');
}

function exportBatchRosterCSV() {
  if (!_currentBatch || !_batchStudents.length) { toast('لا بيانات', 'err'); return; }
  var admin = CURRENT_PROFILE && CURRENT_PROFILE.role === 'admin';
  exportToCSV('حضور_' + _currentBatch.name + '.csv', ['الاسم', 'الهاتف', 'المحاضرات'], _batchStudents.map(function (e) {
    var p = e.profiles || {};
    return [p.full_name || '—', admin ? (p.phone || '—') : SEC.maskPhone(p.phone), e.sessions_done || 0];
  }));
}

async function openAddBatchModal() {
  var courses = [];
  try { courses = await API.fetchCourses(); } catch (e) {}
  var cOpts = courses.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.title) + '</option>'; }).join('');
  var bOpts = _branches.map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.name_ar) + '</option>'; }).join('');
  UI.openSheet(
    '<div class="modal-sheet flex flex-col gap-3"><div class="modal-handle"></div><h3 class="font-bold">مجموعة جديدة</h3>' +
    '<select class="inp" id="nb-course">' + cOpts + '</select>' +
    '<input class="inp" id="nb-title" placeholder="اسم المجموعة">' +
    '<select class="inp" id="nb-branch">' + bOpts + '</select>' +
    '<div class="grid grid-cols-2 gap-2"><input class="inp" id="nb-schedule" placeholder="الأيام"><input class="inp" id="nb-time" placeholder="الوقت"></div>' +
    '<div class="flex gap-2"><button class="btn btn-soft flex-1" data-close>إلغاء</button><button class="btn btn-teal flex-1" onclick="saveNewBatch()">إنشاء</button></div></div>',
    'modal-add-batch'
  );
}

async function saveNewBatch() {
  var courseId = (document.getElementById('nb-course') || {}).value;
  var title = ((document.getElementById('nb-title') || {}).value || '').trim();
  var branch = (document.getElementById('nb-branch') || {}).value;
  var sched = [((document.getElementById('nb-schedule') || {}).value || '').trim(), ((document.getElementById('nb-time') || {}).value || '').trim()].filter(Boolean).join(' — ');
  if (!title || title.length < 3) { toast('اكتب اسم المجموعة', 'err'); return; }
  if (!courseId) { toast('اختر الكورس', 'err'); return; }
  try {
    await API.createBatch({ course_id: courseId, name: title, instructor_id: CURRENT_USER.id, branch_id: branch || null, schedule: sched });
    document.getElementById('modal-add-batch') && document.getElementById('modal-add-batch').remove();
    UI.fireConfetti(28);
    toast('تم إنشاء المجموعة', 'ok');
    renderScreen(currentScreenId);
  } catch (e) { toast(UI.humanError(e), 'err'); }
}

function renderVolunteerProfile() {
  if (!CURRENT_PROFILE) return;
  var p = CURRENT_PROFILE;
  var av = document.getElementById('vp-av'); if (av) av.innerHTML = UI.avatarHTML(p);
  setEl('vp-name', p.full_name);
  var br = branchOf(p);
  setEl('vp-branch', 'متطوع — ' + ((br && br.name_ar) || ''));
  setEl('vp-phone', p.phone || '—');
}

function triggerVolunteerBranchPickerUI() {
  var items = [{ value: '', label: 'كل الفروع', icon: 'ph-globe' }].concat(_branches.map(function (b) {
    return { value: b.id, label: b.name_ar, icon: 'ph-map-pin' };
  }));
  UI.openPicker({
    title: 'تصفية الإشراف', items: items,
    currentVal: (document.getElementById('vc-branch-select') || {}).value,
    onSelect: function (val, lbl) {
      var i = document.getElementById('vc-branch-select'); if (i) i.value = val;
      var tEl = document.getElementById('vc-branch-val-txt'); if (tEl) tEl.textContent = lbl;
      renderVolunteerCoursesList();
    }
  });
}

async function renderVolunteerCoursesList() {
  var listEl = document.getElementById('vc-list');
  if (!listEl) return;
  var selected = (document.getElementById('vc-branch-select') || {}).value || null;
  if (selected === 'الكل' || selected === '') selected = null;
  listEl.innerHTML = UI.skeleton(3);
  try {
    var courses = await API.fetchCourses(true, selected || null);
    var batches = await API.fetchBatches(true, selected || null);
    if (!courses.length) { listEl.innerHTML = UI.emptyState('ph-book-open', 'لا كورسات بهذا الفرع', ''); return; }
    var isAdmin = CURRENT_PROFILE && CURRENT_PROFILE.role === 'admin';
    listEl.innerHTML = courses.map(function (c) {
      var cBatches = batches.filter(function (b) { return b.course_id === c.id; });
      return '<div class="card p-4 mb-3"><div class="flex items-start justify-between gap-3"><div class="flex items-center gap-3">' +
        '<div class="pick-ic" style="background:' + SEC.safeColor(c.color) + '"><i class="' + SEC.safeIcon(c.icon) + '"></i></div>' +
        '<div><div class="text-sm font-bold">' + esc(c.title) + '</div><div class="text-xs text-muted">' + esc(c.category || '') + ' · ' + (c.sessions_count || 8) + ' محاضرات</div></div></div>' +
        (isAdmin ? '<button class="chip text-xs" onclick="openEditCourseModal(\'' + esc(c.id) + '\')">تعديل</button>' : '') + '</div>' +
        '<div class="border-t border-line pt-2 mt-2">' + (cBatches.length ? cBatches.map(function (b) {
          var mine = CURRENT_USER && b.instructor_id === CURRENT_USER.id;
          return '<div class="bg-card-2 p-2.5 rounded-xl flex items-center justify-between mb-1.5"><div><div class="text-xs font-bold">' + esc(b.name) + '</div>' +
            '<div class="text-[11px] text-muted">' + esc(b.schedule || '') + '</div></div>' +
            (mine ? '<span class="chip text-[10px]">أنت المشرف ✓</span>' : '<button class="btn btn-sm btn-teal text-[11px] py-1 h-auto" onclick="assignSelfAsInstructor(\'' + esc(b.id) + '\')">تولّي الإشراف</button>') +
            '</div>';
        }).join('') : '<div class="text-xs text-muted">لا مجموعات — <a class="text-primary font-bold" onclick="openAddBatchModal()">إضافة</a></div>') + '</div></div>';
    }).join('');
  } catch (e) { listEl.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e)); }
}

function assignSelfAsInstructor(batchId) {
  UI.showConfirm('تولّي الإشراف؟', 'ستُسجَّل كمحاضر هذه المجموعة.', async function () {
    try {
      await API.assignInstructor(batchId, CURRENT_USER.id);
      API.invalidate();
      toast('تم تسجيل إشرافك 🎉', 'ok');
      renderVolunteerCoursesList();
    } catch (e) { toast(UI.humanError(e), 'err'); }
  }, { danger: false, yesLabel: 'تأكيد' });
}

async function renderStaffExcuses() {
  var el = document.getElementById('vex-list');
  if (!el) return;
  el.innerHTML = UI.skeleton(3);
  try {
    var rows = await API.fetchExcuses(true);
    el.innerHTML = rows.length ? rows.map(function (x) {
      return '<div class="card p-3 mb-2"><div class="flex justify-between"><div class="text-sm font-bold">' + esc((x.profiles && x.profiles.full_name) || '') + '</div>' +
        '<span class="status-chip ' + (x.status === 'approved' ? 'st-a' : x.status === 'rejected' ? 'st-r' : 'st-p') + '">' + esc(x.status) + '</span></div>' +
        '<div class="text-xs mt-1">' + esc(x.reason) + '</div>' +
        (x.status === 'pending' ? '<div class="flex gap-2 mt-2"><button class="btn btn-teal btn-sm flex-1" onclick="reviewEx(\'' + esc(x.id) + '\',\'approved\')">قبول</button>' +
          '<button class="btn btn-danger btn-sm flex-1" onclick="reviewEx(\'' + esc(x.id) + '\',\'rejected\')">رفض</button></div>' : '') + '</div>';
    }).join('') : UI.emptyState('ph-first-aid', 'لا طلبات عذر', '');
  } catch (e) { el.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e)); }
}

async function reviewEx(id, status) {
  try { await API.reviewExcuse(id, status, ''); toast('تم التحديث', 'ok'); renderStaffExcuses(); }
  catch (e) { toast(UI.humanError(e), 'err'); }
}

/* ═══════════════ Admin ═══════════════ */
async function renderAdminHome() {
  if (!CURRENT_PROFILE) return;
  setEl('ah-name', CURRENT_PROFILE.full_name);
  try {
    var d = await API.fetchAnalyticsBundle();
    var students = d.profs.filter(function (p) { return p.role === 'student'; }).length;
    var vols = d.profs.filter(function (p) { return p.role === 'volunteer'; }).length;
    var kpis = [
      { label: 'الطلاب', value: students, icon: 'ph-fill ph-student', color: 'var(--primary)' },
      { label: 'المتطوعون', value: vols, icon: 'ph-fill ph-hand-heart', color: 'var(--teal)' },
      { label: 'الكورسات', value: d.courses.length, icon: 'ph-fill ph-book-open', color: 'var(--gold)' },
      { label: 'الشهادات', value: d.certs.length, icon: 'ph-fill ph-certificate', color: 'var(--red)' }
    ];
    var statsEl = document.getElementById('ah-stats');
    if (statsEl) statsEl.innerHTML = kpis.map(function (k) {
      return '<div class="kpi-card card p-3"><i class="' + esc(k.icon) + '" style="font-size:22px;color:' + k.color + '"></i><div class="text-xl font-bold mt-2">' + k.value + '</div><div class="text-xs text-muted">' + esc(k.label) + '</div></div>';
    }).join('');
  } catch (e) { console.warn(e); }
}

async function renderAdminUsers() {
  var listEl = document.getElementById('au-list');
  var cntEl = document.getElementById('au-count');
  if (!listEl) return;
  listEl.innerHTML = UI.skeleton(5);
  try {
    var profiles = await API.fetchAllProfiles();
    window._allProfiles = profiles;
    if (cntEl) cntEl.textContent = profiles.length;
    paintUsers(profiles);
  } catch (e) { listEl.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e)); }
}

function filterAdminUsers(q) {
  var all = window._allProfiles || [];
  q = (q || '').trim().toLowerCase();
  var role = (document.getElementById('au-role') || {}).value || '';
  paintUsers(all.filter(function (p) {
    var okQ = !q || [p.full_name, p.email, p.phone].join(' ').toLowerCase().indexOf(q) !== -1;
    var okR = !role || p.role === role;
    return okQ && okR;
  }));
}

function paintUsers(profiles) {
  var listEl = document.getElementById('au-list');
  if (!listEl) return;
  if (!profiles.length) { listEl.innerHTML = UI.emptyState('ph-users', 'لا نتائج', ''); return; }
  var roles = { student: 'طالب', volunteer: 'متطوع', admin: 'مشرف' };
  listEl.innerHTML = profiles.map(function (p) {
    var canEdit = CURRENT_USER && p.id !== CURRENT_USER.id && p.role !== 'admin';
    return '<div class="c-card" style="cursor:default"><div class="avatar w-11 h-11 text-sm">' + UI.avatarHTML(p) + '</div>' +
      '<div class="flex-1"><div class="text-sm font-bold">' + esc(p.full_name) + '</div>' +
      '<div class="text-[11px] text-muted">' + esc(roles[p.role] || p.role) + ' · ' + esc((p.branches && p.branches.name_ar) || '—') + '</div>' +
      '<div class="text-[10px] text-muted" dir="ltr">' + esc(p.email || '') + '</div></div>' +
      '<div class="flex flex-col gap-1 items-end"><span class="status-chip ' + (p.status === 'active' ? 'st-a' : 'st-r') + '">' + esc(p.status === 'active' ? 'نشط' : 'موقوف') + '</span>' +
      (canEdit ? '<button class="chip text-[10px]" data-act="changeUserRole" data-arg1="' + esc(p.id) + '" data-arg2="' + esc(p.full_name) + '" data-arg3="' + esc(p.role) + '">دور</button>' +
        '<button class="chip text-[10px]" onclick="toggleUserStatus(\'' + esc(p.id) + '\',\'' + esc(p.status) + '\')">' + (p.status === 'active' ? 'إيقاف' : 'تفعيل') + '</button>' : '') +
      '</div></div>';
  }).join('');
}

function changeUserRole(userId, userName, currentRole, el) {
  var next = currentRole === 'student' ? 'volunteer' : 'student';
  var labels = { student: 'طالب', volunteer: 'متطوع' };
  UI.showConfirm('تغيير دور «' + userName + '»؟', 'من ' + labels[currentRole] + ' إلى ' + labels[next] + '. لا يمكن تعيين مشرف من الواجهة.', function () {
    return runBtn(el, async function () {
      await API.changeRole(userId, next);
      toast('تم التحديث ✓', 'ok');
      setTimeout(renderAdminUsers, 460);
      return true;
    }, 'تم ✓');
  }, { danger: false, yesLabel: 'تعيين ك' + labels[next] });
}

function toggleUserStatus(id, status) {
  var next = status === 'active' ? 'inactive' : 'active';
  UI.showConfirm(next === 'inactive' ? 'إيقاف الحساب؟' : 'إعادة التفعيل؟', 'لن يستطيع الموقوف استخدام التطبيق.', async function () {
    try { await API.setStatus(id, next); renderAdminUsers(); } catch (e) { toast(UI.humanError(e), 'err'); }
  }, { yesLabel: next === 'inactive' ? 'إيقاف' : 'تفعيل' });
}

async function renderAdminCourses() {
  var listEl = document.getElementById('ac-list');
  if (!listEl) return;
  listEl.innerHTML = UI.skeleton(3);
  try {
    var courses = await API.fetchCourses(true);
    if (!courses.length) { listEl.innerHTML = UI.emptyState('ph-book-open', 'لا كورسات', 'أضف أول دورة', 'إضافة', 'openAddCourseModal()'); return; }
    listEl.innerHTML = courses.map(function (c) {
      return '<div class="card p-3 mb-2 flex items-center gap-3"><div class="pick-ic" style="background:' + SEC.safeColor(c.color) + '"><i class="' + SEC.safeIcon(c.icon) + '"></i></div>' +
        '<div class="flex-1"><div class="text-sm font-bold">' + esc(c.title) + '</div>' +
        '<div class="text-[11px] text-muted">' + esc(c.category || '') + ' · ' + (c.sessions_count || 0) + ' محاضرة · ' + esc((c.branches && c.branches.name_ar) || '') + '</div></div>' +
        '<div class="flex flex-col gap-1"><button class="chip text-[10px] text-primary" onclick="openEditCourseModal(\'' + esc(c.id) + '\')">تعديل</button>' +
        '<button class="chip text-[10px]" style="color:var(--red)" onclick="deleteCourse(\'' + esc(c.id) + '\',\'' + esc(c.title) + '\')">إيقاف</button></div></div>';
    }).join('');
  } catch (e) { listEl.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e)); }
}

function deleteCourse(id, title) {
  UI.showConfirm('إيقاف «' + title + '»؟', 'سيختفي من الاستكشاف دون حذف السجلات التاريخية.', async function () {
    try { await API.softDeleteCourse(id); toast('تم الإيقاف', 'ok'); renderAdminCourses(); }
    catch (e) { toast(UI.humanError(e), 'err'); }
  }, { yesLabel: 'إيقاف' });
}

async function openEditCourseModal(courseId) {
  var courses = [];
  try { courses = await API.fetchCourses(true); } catch (e) {}
  var course = courses.find(function (c) { return c.id === courseId; });
  if (!course) { toast('الكورس غير موجود', 'err'); return; }
  var bOpts = _branches.map(function (b) {
    return '<option value="' + esc(b.id) + '"' + (course.branch_id === b.id ? ' selected' : '') + '>' + esc(b.name_ar) + '</option>';
  }).join('');
  UI.openSheet(
    '<div class="modal-sheet flex flex-col gap-3"><div class="modal-handle"></div><h3 class="font-bold">تعديل الدورة</h3>' +
    '<input class="inp" id="ec-title" value="' + esc(course.title) + '">' +
    '<div class="grid grid-cols-2 gap-2"><input class="inp" id="ec-cat" value="' + esc(course.category || '') + '"><input class="inp" id="ec-sessions" type="number" value="' + (course.sessions_count || 8) + '"></div>' +
    '<select class="inp" id="ec-branch">' + bOpts + '</select>' +
    '<textarea class="inp" id="ec-desc" rows="2">' + esc(course.description || '') + '</textarea>' +
    '<div class="flex gap-2"><button class="btn btn-soft flex-1" data-close>إلغاء</button><button class="btn btn-primary flex-1" onclick="saveEditCourse(\'' + esc(course.id) + '\')">حفظ</button></div></div>',
    'modal-edit-course'
  );
}

async function saveEditCourse(id) {
  try {
    await API.updateCourse(id, {
      title: (document.getElementById('ec-title') || {}).value,
      category: (document.getElementById('ec-cat') || {}).value,
      sessions_count: parseInt((document.getElementById('ec-sessions') || {}).value, 10) || 8,
      branch_id: (document.getElementById('ec-branch') || {}).value || null,
      description: (document.getElementById('ec-desc') || {}).value
    });
    document.getElementById('modal-edit-course') && document.getElementById('modal-edit-course').remove();
    toast('تم التحديث', 'ok');
    renderAdminCourses();
  } catch (e) { toast(UI.humanError(e), 'err'); }
}

function openAddCourseModal() {
  if (!CURRENT_PROFILE || CURRENT_PROFILE.role !== 'admin') { toast('إضافة الكورسات للمشرف فقط', 'err'); return; }
  var bOpts = _branches.map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.name_ar) + '</option>'; }).join('');
  UI.openSheet(
    '<div class="modal-sheet flex flex-col gap-3"><div class="modal-handle"></div><h3 class="font-bold">كورس جديد</h3>' +
    '<input class="inp" id="nc-title" placeholder="عنوان الدورة">' +
    '<div class="grid grid-cols-2 gap-2"><input class="inp" id="nc-cat" placeholder="التصنيف"><input class="inp" id="nc-sessions" type="number" value="8"></div>' +
    '<select class="inp" id="nc-branch">' + bOpts + '</select>' +
    '<textarea class="inp" id="nc-desc" rows="2" placeholder="وصف مختصر"></textarea>' +
    '<div class="flex gap-2"><button class="btn btn-soft flex-1" data-close>إلغاء</button><button class="btn btn-primary flex-1" onclick="saveNewCourse()">إضافة</button></div></div>',
    'modal-add-course'
  );
}

async function saveNewCourse() {
  var title = ((document.getElementById('nc-title') || {}).value || '').trim();
  if (title.length < 3) { toast('اكتب عنواناً', 'err'); return; }
  var colors = ['#00288e', '#00554e', '#7a30d8', '#d4af37', '#1e40af', '#ba1a1a'];
  try {
    await API.createCourse({
      title: title, category: (document.getElementById('nc-cat') || {}).value || 'عام',
      sessions_count: parseInt((document.getElementById('nc-sessions') || {}).value, 10) || 8,
      branch_id: (document.getElementById('nc-branch') || {}).value || null,
      description: (document.getElementById('nc-desc') || {}).value || '',
      icon: 'ph-fill ph-book-open', color: colors[Math.floor(Math.random() * colors.length)],
      created_by: CURRENT_USER && CURRENT_USER.id
    });
    document.getElementById('modal-add-course') && document.getElementById('modal-add-course').remove();
    UI.fireConfetti(28);
    toast('تمت إضافة الكورس', 'ok');
    renderAdminCourses();
  } catch (e) { toast(UI.humanError(e), 'err'); }
}

async function renderAdminCerts() {
  var listEl = document.getElementById('acerts-list');
  if (!listEl) return;
  listEl.innerHTML = UI.skeleton(4);
  try {
    var data = await API.fetchCerts(false);
    listEl.innerHTML = data.length ? data.map(function (cert) {
      return '<div class="card p-3 mb-2 flex justify-between"><div><div class="text-sm font-bold">' + esc((cert.profiles && cert.profiles.full_name) || '—') + '</div>' +
        '<div class="text-[11px] text-muted">' + esc((cert.courses && cert.courses.title) || '') + '</div>' +
        '<div class="text-[10px] text-muted" dir="ltr"># ' + esc(cert.serial_number) + '</div></div>' +
        '<div class="text-xs" style="color:var(--teal)">' + new Date(cert.issued_at).toLocaleDateString('ar-EG') + '</div></div>';
    }).join('') : UI.emptyState('ph-certificate', 'لا شهادات صادرة', '');
  } catch (e) { listEl.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e)); }
}

function renderAdminSettings() { /* static + wired buttons in HTML */ }

async function renderBranchesAdmin() {
  var el = document.getElementById('ab-list');
  if (!el) return;
  try {
    _branches = await API.fetchBranches(true);
    el.innerHTML = _branches.map(function (b) {
      return '<div class="card p-3 mb-2"><div class="font-bold text-sm">' + esc(b.name_ar) + '</div>' +
        '<div class="text-xs text-muted mt-1">' + esc(b.address || '') + '</div>' +
        '<div class="text-[11px] mt-1">خط ساخن ' + esc(b.hotline || '19450') + (b.whatsapp ? ' · واتساب ' + esc(b.whatsapp) : '') + '</div>' +
        (b.facebook_url ? '<a class="text-xs text-primary" href="' + esc(b.facebook_url) + '" target="_blank" rel="noopener">صفحة فيسبوك</a>' : '') + '</div>';
    }).join('');
  } catch (e) { el.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e)); }
}

function renderBroadcast() {
  var el = document.getElementById('bc-box');
  if (!el) return;
  var bOpts = _branches.map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.name_ar) + '</option>'; }).join('');
  el.innerHTML =
    '<div class="card p-4 flex flex-col gap-3">' +
    '<select class="inp" id="bc-scope" onchange="document.getElementById(\'bc-branch-wrap\').classList.toggle(\'hidden\', this.value!==\'branch\')">' +
    '<option value="all">كل المستخدمين النشطين</option><option value="branch">فرع محدد</option></select>' +
    '<div id="bc-branch-wrap" class="hidden"><select class="inp" id="bc-branch">' + bOpts + '</select></div>' +
    '<select class="inp" id="bc-type"><option value="announcement">إعلان</option><option value="postponed">تأجيل عام</option></select>' +
    '<input class="inp" id="bc-title" placeholder="العنوان">' +
    '<textarea class="inp" id="bc-msg" rows="3" placeholder="نص الرسالة"></textarea>' +
    '<button class="btn btn-primary btn-mid" data-act="sendBroadcast" data-busy-label="جاري الإرسال">إرسال البث</button></div>';
}

async function sendBroadcast(el) {
  var scope = (document.getElementById('bc-scope') || {}).value;
  var sid = scope === 'branch' ? (document.getElementById('bc-branch') || {}).value : null;
  await runBtn(el, async function () {
    var n = await API.broadcast(scope, sid, (document.getElementById('bc-type') || {}).value, (document.getElementById('bc-title') || {}).value, (document.getElementById('bc-msg') || {}).value);
    toast('وصل إلى ' + n + ' مستخدم', 'ok');
    return true;
  }, 'تم البث ✓');
}

async function renderAnalytics() {
  var body = document.getElementById('analytics-body');
  if (!body) return;
  body.innerHTML = UI.skeleton(4);
  try {
    var d = await API.fetchAnalyticsBundle();
    var students = d.profs.filter(function (p) { return p.role === 'student'; });
    var vols = d.profs.filter(function (p) { return p.role === 'volunteer'; });
    var present = d.att.filter(function (a) { return a.status === 'present'; }).length;
    var attRate = d.att.length ? Math.round(present / d.att.length * 100) : 0;
    var light = CURRENT_PROFILE && CURRENT_PROFILE.role === 'volunteer';
    body.innerHTML =
      '<div class="grid grid-cols-2 gap-3">' +
      [{ l: 'الطلاب', v: students.length, i: 'ph-fill ph-student', c: 'var(--primary)' },
        { l: 'المتطوعون', v: vols.length, i: 'ph-fill ph-hand-heart', c: 'var(--teal)' },
        { l: 'الكورسات', v: d.courses.length, i: 'ph-fill ph-book-open', c: 'var(--gold)' },
        { l: 'المجموعات', v: d.batches.length, i: 'ph-fill ph-users-three', c: '#7a30d8' },
        { l: 'التسجيلات', v: d.enroll.length, i: 'ph-fill ph-clipboard-text', c: '#0b6e63' },
        { l: 'الشهادات', v: d.certs.length, i: 'ph-fill ph-certificate', c: 'var(--red)' },
        { l: 'سجلات الحضور', v: d.att.length, i: 'ph-fill ph-calendar-check', c: '#1e40af' },
        { l: 'معدل الحضور', v: attRate + '%', i: 'ph-fill ph-chart-line-up', c: '#854d0e' }
      ].map(function (k) {
        return '<div class="kpi-card card p-3"><i class="' + k.i + '" style="font-size:20px;color:' + k.c + '"></i><div class="text-xl font-bold mt-2">' + k.v + '</div><div class="text-xs text-muted">' + k.l + '</div></div>';
      }).join('') + '</div>' +
      (light ? '<p class="text-[11px] text-muted mt-3">عرض تشغيلي. التفاصيل الشخصية الكاملة للمشرف فقط.</p>' : '') +
      '<div class="sec-t mt-4">أحدث الحسابات</div><div class="card overflow-hidden">' +
      d.profs.slice(0, 12).map(function (p) {
        return '<div class="p-3 flex items-center justify-between border-b border-line last:border-0"><div class="flex items-center gap-2"><div class="avatar w-8 h-8 text-xs">' + UI.avatarHTML(p) + '</div>' +
          '<div><div class="font-bold text-sm">' + esc(p.full_name || '—') + '</div>' +
          '<div class="text-[10px] text-muted">' + esc(p.role) + (CURRENT_PROFILE.role === 'admin' ? ' · ' + esc(p.email || '') : '') + '</div></div></div>' +
          '<span class="text-[10px] text-muted">' + (p.points || 0) + ' ن</span></div>';
      }).join('') + '</div>';
  } catch (e) { body.innerHTML = UI.emptyState('ph-warning', 'تعذر التحميل', UI.humanError(e), t('retry'), 'renderAnalytics()'); }
}

/* ═══════════════ Native shell wiring ═══════════════ */
function wireNativeShell() {
  if (window.RTCNative) {
    /* زر الرجوع في أندرويد: pop داخل التطبيق، أو خروج من الشاشة الرئيسية */
    RTCNative.onBack(function () {
      var sheet = document.querySelector('.modal-bg.open');
      if (sheet) { sheet.classList.remove('open'); setTimeout(function () { sheet.remove(); }, 280); return true; }
      if (navStack.length) { pop(); return true; }
      var role = (CURRENT_PROFILE && CURRENT_PROFILE.role) || 'student';
      var home = role === 'volunteer' ? 'v-home' : role === 'admin' ? 'a-home' : 's-home';
      if (currentScreenId !== home && currentScreenId !== 'onboarding' && currentScreenId !== 'splash') { routeToRoleHome(); return true; }
      return false; /* اخرج من التطبيق */
    });
    RTCNative.onResume(function () { API.invalidate(); renderScreen(currentScreenId); });
    RTCNative.syncStatusBar();
  }

  /* سحب للتحديث على كل شاشة لها جسم قابل للتمرير */
  if (window.RTCMotion) {
    document.querySelectorAll('.scr-body, .scr-body-full').forEach(function (sc) {
      RTCMotion.bindPTR(sc, async function () {
        API.invalidate();
        if (CURRENT_USER) { try { CURRENT_PROFILE = await API.fetchMyProfile(); } catch (e) {} }
        renderScreen(currentScreenId);
      });
    });
  }
}

/* ═══════════════ Init ═══════════════ */
window.addEventListener('online', function () { toast(t('online'), 'ok'); });
window.addEventListener('offline', function () { toast(t('offline'), 'warn'); });

document.addEventListener('DOMContentLoaded', async function () {
  applyDarkMode();
  applyI18nNav();
  wireNativeShell();

  if (!window.supabaseClient) {
    setTimeout(function () { if (!_authHandled) { showScreenEl('onboarding'); nextOnbStep(1); } }, 900);
    return;
  }

  window.supabaseClient.auth.onAuthStateChange(function (event, session) {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session && session.user) {
      if (event !== 'TOKEN_REFRESHED' || !CURRENT_PROFILE) afterAuth(session);
    } else if (event === 'SIGNED_OUT') {
      CURRENT_USER = CURRENT_PROFILE = null;
    }
  });

  try {
    var recovered = null;
    try { recovered = await API.recoverHashSession(); } catch (e0) { console.warn(e0); }
    var session = recovered || await API.getSession();
    if (session && session.user) {
      await afterAuth(session);
      return;
    }
  } catch (e) { console.warn(e); }

  setTimeout(function () {
    if (!_authHandled) { showScreenEl('onboarding'); nextOnbStep(1); }
  }, 800);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=10.0.0').catch(function () {});
  }
});
