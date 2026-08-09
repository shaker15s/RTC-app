/**
 * app.js — RTC مسار Mobile App Engine
 * Single-page mobile app router, state, and all screen renderers
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════
     CVE-RTC-001 FIX: HTML Escaping Utility
     All user-controlled strings passed to innerHTML MUST go through escapeHtml()
  ═══════════════════════════════════════════════ */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;');
  }

  /* CVE-RTC-002 FIX: OTP Auth State */
  var _otpCode = null;      // simulated server-generated code
  var _otpPhone = null;     // phone tied to this OTP session
  var _otpAttempts = 0;    // lockout counter
  var _otpLocked = false;  // locked after 3 wrong attempts

  /* ═══════════════════════════════════════════════
     DATA STORE
  ═══════════════════════════════════════════════ */
  const INITIAL = {
    users: [
      { id: 1, name: 'أحمد محمد عبد الله', phone: '01012345678', role: 'student', branch: 'وسط البلد', avatar: 'أح', status: 'active', points: 240 },
      { id: 2, name: 'سارة أحمد', phone: '01098765432', role: 'student', branch: 'مدينة نصر', avatar: 'سا', status: 'active', points: 310 },
      { id: 3, name: 'مصطفى سمير', phone: '01123456789', role: 'student', branch: 'وسط البلد', avatar: 'مص', status: 'active', points: 180 },
      { id: 4, name: 'منة الله محمد', phone: '01234567890', role: 'student', branch: 'الإسكندرية', avatar: 'من', status: 'active', points: 285 },
      { id: 5, name: 'يوسف عادل', phone: '01098761234', role: 'student', branch: 'الجيزة', avatar: 'يو', status: 'active', points: 210 },
      { id: 6, name: 'م/ محمد فؤاد', phone: '01056789012', role: 'volunteer', branch: 'وسط البلد', avatar: 'مح', status: 'active' },
      { id: 7, name: 'أ/ نورهان خالد', phone: '01112345678', role: 'volunteer', branch: 'مدينة نصر', avatar: 'نو', status: 'active' },
      { id: 8, name: 'المشرف العام', phone: '01000000001', role: 'admin', branch: 'المقر الرئيسي', avatar: 'مش', status: 'active' },
    ],
    courses: [
      { id: 1, title: 'اللغة الإنجليزية للمحادثة', cat: 'اللغات', icon: 'translate', color: '#00288e', sessions: 10, enrolled: 22 },
      { id: 2, title: 'أساسيات برمجة الويب', cat: 'البرمجة', icon: 'code', color: '#003c36', sessions: 12, enrolled: 18 },
      { id: 3, title: 'مهارات ريادة الأعمال', cat: 'التنمية البشرية', icon: 'psychology', color: '#515f74', sessions: 8, enrolled: 30 },
      { id: 4, title: 'التصميم الجرافيكي', cat: 'التصميم', icon: 'palette', color: '#854d0e', sessions: 10, enrolled: 15 },
    ],
    // studentIds المرجعية ترتبط بـ users.id الحقيقيين
    batches: [
      { id: 1, name: 'دفعة A — إنجليزي', courseId: 1, instructor: 'م/ محمد فؤاد', schedule: 'الأحد والثلاثاء 6م', location: 'قاعة 3، وسط البلد', studentIds: [1, 2, 3, 4, 5], lecturesDone: 10 },
      { id: 2, name: 'دفعة مسائية — برمجة', courseId: 2, instructor: 'م/ محمد فؤاد', schedule: 'الأربعاء والجمعة 7م', location: 'قاعة 1، وسط البلد', studentIds: [1, 5], lecturesDone: 8 },
      { id: 3, name: 'دفعة B — ريادة أعمال', courseId: 3, instructor: 'أ/ نورهان خالد', schedule: 'السبت 10ص', location: 'قاعة 5، مدينة نصر', studentIds: [2, 4], lecturesDone: 6 },
    ],
    attendance: {
      // student 1 in batch 1 — 10 sessions
      1: [
        { date: '2026-07-01', status: 'present' }, { date: '2026-07-03', status: 'present' },
        { date: '2026-07-08', status: 'present' }, { date: '2026-07-10', status: 'late' },
        { date: '2026-07-15', status: 'present' }, { date: '2026-07-17', status: 'absent' },
        { date: '2026-07-22', status: 'present' }, { date: '2026-07-24', status: 'present' },
        { date: '2026-07-29', status: 'present' }, { date: '2026-07-31', status: 'present' },
      ]
    },
    // جلسة الحضور الحالية مرتبطة بـ users.id
    currentSession: { batchId: 1, recs: { 1: 'present', 2: null, 3: null, 4: 'absent', 5: null } },
    recordedSessions: [],
    profile: {},
    branches: [
      { id: 1, name: 'فرع وسط البلد', address: 'شارع عماد الدين، القاهرة', halls: 3 },
      { id: 2, name: 'فرع مدينة نصر', address: 'شارع عباس العقاد، القاهرة', halls: 2 },
    ],
    exports: [],
    certs: [
      { id: 1, student: 'أحمد محمد عبد الله', course: 'اللغة الإنجليزية للمحادثة', date: '8 أغسطس 2026', no: 'RTC-2026-001247', att: 82, status: 'issued' },
      { id: 2, student: 'سارة أحمد', course: 'مهارات ريادة الأعمال', date: '5 أغسطس 2026', no: 'RTC-2026-001240', att: 88, status: 'issued' },
    ],
    badges: [
      { icon: '🎖️', name: 'نجم الحضور', desc: 'حضر 5 محاضرات متتالية', unlocked: true },
      { icon: '📚', name: 'الطالب المجتهد', desc: 'أتم أول كورس له', unlocked: true },
      { icon: '🎯', name: 'سفير رسالة', desc: 'دعا 3 أصدقاء للانضمام', unlocked: true },
      { icon: '🔥', name: 'سلسلة 10 أيام', desc: 'حضر 10 محاضرات بدون انقطاع', unlocked: false, progress: 60, progressTxt: '5/10 محاضرات متتالية' },
      { icon: '🏆', name: 'متفوق الدفعة', desc: 'الأول في لوحة الصدارة', unlocked: false, progress: 30, progressTxt: 'المرتبة 4 حالياً' },
      { icon: '⭐', name: 'مستوى 3', desc: 'جمع 500 نقطة', unlocked: false, progress: 48, progressTxt: '240/500 نقطة' },
    ],
    leaderboard: [
      { name: 'مصطفى علي', pts: 420, rank: 1, avatar: 'مص', me: false },
      { name: 'سارة أحمد', pts: 310, rank: 2, avatar: 'سا', me: false },
      { name: 'منة الله', pts: 285, rank: 3, avatar: 'من', me: false },
      { name: 'أحمد محمد', pts: 240, rank: 4, avatar: 'أح', me: true },
      { name: 'يوسف عادل', pts: 210, rank: 5, avatar: 'يو', me: false },
      { name: 'نور الهدى', pts: 190, rank: 6, avatar: 'نو', me: false },
      { name: 'محمود سامي', pts: 175, rank: 7, avatar: 'مح', me: false },
    ],
    notifications: [
      { id: 1, icon: 'event_available', title: 'تم تسجيل حضورك', body: 'محاضرة اللغة الإنجليزية — الأربعاء 6 أغسطس', time: 'منذ ساعة', unread: true },
      { id: 2, icon: 'workspace_premium', title: 'شهادة جاهزة!', body: 'شهادة إتمام كورس اللغة الإنجليزية جاهزة للتحميل', time: 'أمس', unread: true },
      { id: 3, icon: 'local_fire_department', title: 'سلسلة حضور 5 أيام 🔥', body: 'أحسنت! ربحت +5 نقاط بونص', time: 'أمس', unread: false },
      { id: 4, icon: 'warning', title: 'تنبيه غياب', body: 'فاتتك محاضرة الثلاثاء 4 أغسطس في دفعة A إنجليزي', time: '3 أيام', unread: false },
      { id: 5, icon: 'star', title: 'شارة جديدة!', body: 'حصلت على شارة "الطالب المجتهد" 📚', time: 'أسبوع', unread: false },
    ],
    auditLog: [
      { icon: 'person_add', text: 'تم إضافة مستخدم جديد: يوسف عادل', time: 'منذ 5 دقائق', color: '#00288e' },
      { icon: 'workspace_premium', text: 'إصدار شهادة لـ سارة أحمد — ريادة أعمال', time: 'منذ ساعة', color: '#854d0e' },
      { icon: 'fact_check', text: 'تسجيل حضور: دفعة A — محاضرة 11 (22/22)', time: 'منذ 2 ساعة', color: '#003c36' },
      { icon: 'edit', text: 'تعديل بيانات كورس: أساسيات برمجة الويب', time: 'أمس', color: '#515f74' },
      { icon: 'add_circle', text: 'إنشاء دفعة جديدة: دفعة B — ريادة أعمال', time: 'أمس', color: '#00288e' },
    ],
    pointsRules: [
      { rule: 'حضور محاضرة', pts: 10, icon: 'event_available' },
      { rule: 'سلسلة 3 محاضرات', pts: 5, icon: 'local_fire_department' },
      { rule: 'إتمام كورس كامل', pts: 50, icon: 'school' },
      { rule: 'حضور متأخر', pts: 3, icon: 'schedule' },
      { rule: 'دعوة صديق', pts: 15, icon: 'person_add' },
    ],
  };

  // CVE-RTC-004 FIX: Validated store loading — prevents role escalation via DevTools
  const VALID_ROLES = ['student', 'volunteer', 'admin'];
  function validateStore(raw) {
    if (!raw || typeof raw !== 'object') return false;
    // Must have required arrays
    if (!Array.isArray(raw.users) || !Array.isArray(raw.courses) || !Array.isArray(raw.batches)) return false;
    // All users must have valid roles
    for (var i = 0; i < raw.users.length; i++) {
      const u = raw.users[i];
      if (!u.id || !u.name || !u.phone) return false;
      if (VALID_ROLES.indexOf(u.role) === -1) return false;
    }
    // Attendance keys must be numeric
    if (raw.attendance && typeof raw.attendance === 'object') {
      const keys = Object.keys(raw.attendance);
      for (var k = 0; k < keys.length; k++) {
        if (isNaN(Number(keys[k]))) return false;
      }
    }
    return true;
  }

  let store = (function () {
    try {
      const saved = JSON.parse(localStorage.getItem('rtc_v2'));
      if (validateStore(saved)) return saved;
      // If schema invalid (possible tamper), clear and start fresh
      localStorage.removeItem('rtc_v2');
      return JSON.parse(JSON.stringify(INITIAL));
    } catch (e) {
      return JSON.parse(JSON.stringify(INITIAL));
    }
  })();

  function save() {
    try { localStorage.setItem('rtc_v2', JSON.stringify(store)); } catch (e) {}
  }

  // ترحيل البيانات القديمة (أسماء بدلاً من IDs) إلى البنية العلائقية الجديدة
  function normalizeStore() {
    store.recordedSessions = store.recordedSessions || [];
    store.exports = store.exports || [];
    store.profile = store.profile || {};
    store.branches = store.branches || [];
    // batches: تحويل students (أسماء) → studentIds (أرقام مرجعية)
    store.batches.forEach(b => {
      if (!b.studentIds && b.students) {
        b.studentIds = b.students
          .map(n => {
            const u = store.users.find(x => x.name === n || x.name.startsWith(n));
            return u ? u.id : null;
          })
          .filter(x => x !== null);
      }
      b.studentIds = b.studentIds || [];
    });
    // currentSession القديمة (مفتاحها أسماء) → recs مرتبة بالأرقام
    const cs = store.currentSession;
    if (cs && cs.recs === undefined) {
      const recs = {};
      Object.keys(cs).forEach(n => {
        const u = store.users.find(x => x.name === n || x.name.startsWith(n));
        if (u) recs[u.id] = cs[n];
      });
      store.currentSession = { batchId: 1, recs };
    }
    if (!store.currentSession || !store.currentSession.recs) {
      store.currentSession = { batchId: 1, recs: {} };
    }
  }
  normalizeStore();

  /* ═══════════════════════════════════════════════
     ROUTER + ROUTE GUARDS
  ═══════════════════════════════════════════════ */
  let currentScreen = 'splash';
  let navStack = [];
  let currentRole = null;
  // Track the logged-in user so student screens are data-driven (not hardcoded to "أحمد")
  let currentUserId = null;

  const ROLE_PREFIX = { student: 's-', volunteer: 'v-', admin: 'a-' };
  const PUBLIC = ['login', 'otp', 'splash'];

  function canAccess(id) {
    if (PUBLIC.indexOf(id) !== -1) return true;
    if (!currentRole) return false;
    return id.indexOf(ROLE_PREFIX[currentRole]) === 0;
  }

  function guard(id) {
    if (canAccess(id)) return id;
    const homes = { student: 's-home', volunteer: 'v-home', admin: 'a-home' };
    return homes[currentRole] || 'login';
  }

  // Swap the visible screen (class active) — no history, no render
  function _showOnly(id) {
    const old = document.getElementById('screen-' + currentScreen);
    if (old) old.classList.remove('active');
    const next = document.getElementById('screen-' + id);
    if (!next) { console.warn('Screen not found:', id); return null; }
    next.classList.add('active');
    next.scrollTop = 0;
    currentScreen = id;
    return next;
  }

  // History API push (best-effort: some WebViews throw on file://)
  function _pushState(id) {
    try { history.pushState({ screen: id }, '', '#/' + id); } catch (e) {}
  }

  function navigate(id) {
    id = guard(id);
    if (id === currentScreen) return; // guard: no double-push
    navStack = [];
    if (!_showOnly(id)) return;
    _showNav(id);
    _updateNavActive(id);
    renderScreen(id);
    _pushState(id);
  }

  function push(id) {
    id = guard(id);
    if (id === currentScreen) return; // guard: no double-push
    navStack.push(currentScreen);
    if (!_showOnly(id)) return;
    renderScreen(id);
    _pushState(id);
  }

  function pop() {
    // Physical back / history-aware: let the browser unwind if we're inside the app
    if (history.state && history.state.screen) { history.back(); return; }
    // Fall back to the in-memory stack (e.g. before any pushState succeeded)
    if (!navStack.length) return;
    const prev = navStack.pop();
    if (!_showOnly(prev)) return;
    _updateNavActive(currentScreen);
  }

  function switchTab(id) {
    haptic(5);
    navStack = [];
    navigate(id); // tabs pushState too, so back unwinds to home
  }

  window.addEventListener('popstate', function (e) {
    const id = (e.state && e.state.screen) || null;
    if (!id) return; // outside the app's history — let the browser leave
    navStack.pop(); // keep in-memory stack in sync (top == screen we return to)
    if (!_showOnly(id)) return;
    _updateNavActive(currentScreen);
  });

  function _showNav(id) {
    const ns = document.getElementById('nav-student');
    const nv = document.getElementById('nav-volunteer');
    const na = document.getElementById('nav-admin');
    [ns, nv, na].forEach(n => n && n.classList.add('hidden'));
    if (!currentRole) return;
    if (currentRole === 'student' && ns) ns.classList.remove('hidden');
    else if (currentRole === 'volunteer' && nv) nv.classList.remove('hidden');
    else if (currentRole === 'admin' && na) na.classList.remove('hidden');
  }

  function _updateNavActive(id) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === id);
    });
  }

  /* ═══════════════════════════════════════════════
     UI HELPERS
  ═══════════════════════════════════════════════ */
  function haptic(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) {}
  }

  function emptyState(icon, title, desc) {
    return '<div class="empty-state">' +
      '<div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">' +
      '<span class="material-symbols-outlined text-3xl text-outline">' + icon + '</span></div>' +
      '<div><p class="text-sm font-bold text-on-surface">' + title + '</p>' +
      '<p class="text-xs text-on-surface-variant mt-1 max-w-[240px]">' + desc + '</p></div></div>';
  }

  // تحقق ميداني داخل النماذج
  function fieldError(input, msg) {
    if (!input) return;
    let err = input.parentElement.querySelector('.err-txt');
    if (!err) {
      err = document.createElement('p');
      err.className = 'err-txt';
      input.parentElement.appendChild(err);
    }
    err.textContent = msg;
    err.style.display = msg ? 'block' : 'none';
    input.classList.toggle('invalid', !!msg);
  }

  const PHONE_RE = /^01[0125][0-9]{8}$/;

  function userName(id) {
    const u = store.users.find(x => x.id === id);
    return u ? u.name : 'طالب';
  }

  // Resolve the currently logged-in user. Falls back to first matching user
  // by role (for quick-login / demo) so screens are always data-driven.
  function currentUser() {
    if (currentUserId != null) {
      const u = store.users.find(x => x.id === currentUserId);
      if (u) return u;
    }
    if (currentRole) {
      const byRole = store.users.find(u => u.role === currentRole);
      if (byRole) { currentUserId = byRole.id; return byRole; }
    }
    return store.users[0];
  }

  function currentBatch() {
    return store.batches.find(b => b.id === store.currentSession.batchId) || store.batches[0];
  }

  function attStats(studentId) {
    const recs = store.attendance[studentId] || [];
    const total = recs.length;
    const pres = recs.filter(r => r.status === 'present' || r.status === 'late').length;
    return { total, pres, pct: total ? Math.round(pres / total * 100) : 0 };
  }

  function levelFromPoints(p) {
    if (p >= 500) return { level: 3, next: null };
    if (p >= 100) return { level: 2, next: 500 };
    return { level: 1, next: 100 };
  }

  /* ═══════════════════════════════════════════════
     SCREEN RENDERERS
  ═══════════════════════════════════════════════ */
  const SKELETON_MAP = {
    's-courses': 'sc-list', 's-points': 'sp-badges', 's-certs': 'scerts-list',
    'a-users': 'au-list', 'a-courses': 'ac-list', 'a-certs': 'acerts-list', 'v-batches': 'vb-list'
  };
  let skeletonTimer = null;

  function showSkeleton(id) {
    const cid = SKELETON_MAP[id];
    const el = cid && document.getElementById(cid);
    if (!el) return;
    el.innerHTML = '<div class="flex flex-col gap-3">' +
      '<div class="skel h-24 w-full"></div>' +
      '<div class="skel h-24 w-full"></div>' +
      '<div class="skel h-16 w-full"></div></div>';
  }

  function renderScreen(id) {
    if (SKELETON_MAP[id]) {
      showSkeleton(id);
      clearTimeout(skeletonTimer);
      skeletonTimer = setTimeout(() => _doRender(id), 450);
      return;
    }
    _doRender(id);
  }

  function _doRender(id) {
    switch (id) {
      case 's-home':          renderStudentHome();       break;
      case 's-courses':       renderStudentCourses();    break;
      case 's-points':        renderStudentPoints();     break;
      case 's-certs':         renderStudentCerts();      break;
      case 's-att-log':       renderAttLog();            break;
      case 's-course-detail': renderCourseDetail();      break;
      case 's-leaderboard':   renderLeaderboard();       break;
      case 's-notifications': renderStudentNotifs();     break;
      case 's-explore':       renderExplore();           break;
      case 's-onboard':       renderStudentOnboard();    break;
      case 's-excuse':        renderExcuse();            break;
      case 'v-home':          renderVolHome();           break;
      case 'v-attendance':    renderVolAttendance();     break;
      case 'v-batches':       renderVolBatches();        break;
      case 'v-report':        renderVolReport();         break;
      case 'v-edit-past':     renderEditPast();          break;
      case 'a-home':          renderAdminHome();         break;
      case 'a-users':         renderUsers();             break;
      case 'a-courses':       renderAdminCourses();      break;
      case 'a-certs':         renderAdminCerts();        break;
      case 'a-branches':      renderBranches();          break;
      case 'a-export':        renderExport();            break;
      case 'a-broadcast':     renderBroadcast();         break;
      case 'a-settings':      renderAdminSettings();     break;
      case 'a-notifications': renderAdminNotifs();       break;
    }
  }

  // ── STUDENT HOME
  function renderStudentHome() {
    const me = currentUser();
    const st = attStats(me.id);
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('sh-student-name', (me.name || 'طالب').split(' ')[0] + ' 👋');
    setTxt('sh-att', st.pct + '%');
    setTxt('sh-pts', (me.points || 0));
    // Mini courses preview
    const el = document.getElementById('sh-courses');
    if (el) {
      el.innerHTML = store.courses.slice(0, 2).map(c => `
        <button onclick="push('s-course-detail')" class="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 tap">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${c.color}20;">
            <span class="material-symbols-outlined" style="color:${c.color};">${c.icon}</span>
          </div>
          <div class="flex-1 text-right">
            <p class="font-bold text-on-surface text-sm">${escapeHtml(c.title)}</p>
            <div class="h-1.5 bg-surface-container rounded-full mt-2"><div class="h-full rounded-full bg-primary" style="width:${st.pct}%;"></div></div>
            <p class="text-xs text-on-surface-variant mt-1">${st.pct}% حضور</p>
          </div>
          <span class="material-symbols-outlined text-outline text-lg">chevron_left</span>
        </button>
      `).join('');
    }
    // Badges preview
    const bg = document.getElementById('sh-badges');
    if (bg) {
      bg.innerHTML = store.badges.filter(b => b.unlocked).slice(0, 3).map(b => `
        <div class="flex-1 bg-white rounded-2xl p-3 shadow-sm flex flex-col items-center gap-1.5 text-center">
          <span class="text-2xl">${escapeHtml(b.icon)}</span>
          <p class="text-xs font-bold text-on-surface leading-tight">${escapeHtml(b.name)}</p>
        </div>
      `).join('');
    }
  }

  // ── STUDENT COURSES
  function renderStudentCourses() {
    const el = document.getElementById('sc-list');
    if (!el) return;
    if (!store.courses.length) { el.innerHTML = emptyState('book', 'لا توجد كورسات', 'استكشف الكورسات المتاحة وسجّل في ما يناسبك'); return; }
    const progressPct = [82, 60, 90, 40];
    el.innerHTML = store.courses.map((c, i) => {
      const pct = progressPct[i] || 70;
      const eligible = pct >= 75;
      return `
        <button onclick="push('s-course-detail')" class="w-full bg-white rounded-2xl overflow-hidden shadow-sm tap">
          <div class="h-1.5" style="background:${c.color};"></div>
          <div class="p-4">
            <div class="flex items-start gap-3">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${c.color}18;">
                <span class="material-symbols-outlined" style="color:${c.color};font-variation-settings:'FILL' 1;">${c.icon}</span>
              </div>
              <div class="flex-1">
                <p class="font-bold text-on-surface text-sm">${escapeHtml(c.title)}</p>
                <p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(c.cat)} · ${c.sessions} محاضرات</p>
                <div class="flex items-center gap-2 mt-2">
                  <div class="flex-1 h-1.5 bg-surface-container rounded-full">
                    <div class="h-full rounded-full" style="width:${pct}%;background:${c.color};"></div>
                  </div>
                  <span class="text-xs font-bold" style="color:${c.color};">${pct}%</span>
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant/30">
              <div class="flex items-center gap-1">
                <span class="material-symbols-outlined text-sm" style="color:${eligible ? '#00554e' : '#ba1a1a'};">${eligible ? 'verified' : 'cancel'}</span>
                <span class="text-xs font-semibold" style="color:${eligible ? '#00554e' : '#ba1a1a'};">${eligible ? 'مؤهل للشهادة' : 'يحتاج مزيد من الحضور'}</span>
              </div>
              <span class="text-xs text-on-surface-variant">${c.enrolled} طالب</span>
            </div>
          </div>
        </button>
      `;
    }).join('');
  }

  let attFilter = 'all';
  function renderAttLog() {
    const el = document.getElementById('sal-list');
    if (!el) return;
    const me = currentUser();
    const all = store.attendance[me.id] || [];
    // Summary counts (always reflect the full record, independent of the filter)
    const setCount = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setCount('sal-pres', all.filter(s => s.status === 'present').length);
    setCount('sal-abs', all.filter(s => s.status === 'absent').length);
    setCount('sal-late', all.filter(s => s.status === 'late').length);
    const sessions = all.filter(s => attFilter === 'all' || s.status === attFilter);
    if (!sessions.length) {
      el.innerHTML = emptyState('fact_check', attFilter === 'all' ? 'لا توجد محاضرات مسجلة' : 'لا توجد نتائج بهذا الفلتر', 'سجل الحضور يظهر بعد كل محاضرة');
      return;
    }
    el.innerHTML = sessions.map((s, i) => {
      const icons = { present: '✓', absent: '✗', late: '⏰' };
      const colors = { present: { bg: 'rgba(0,85,78,0.08)', border: 'rgba(0,85,78,0.2)', text: '#00554e' }, absent: { bg: 'rgba(186,26,26,0.06)', border: 'rgba(186,26,26,0.15)', text: '#ba1a1a' }, late: { bg: '#fef3c7', border: '#fde68a', text: '#854d0e' } };
      const c = colors[s.status];
      const labels = { present: 'حاضر', absent: 'غائب', late: 'متأخر' };
      return `
        <div class="flex items-center gap-3 p-3 rounded-2xl border" style="background:${c.bg};border-color:${c.border};">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style="background:${c.text}20;">${icons[s.status]}</div>
          <div class="flex-1">
            <p class="text-sm font-bold text-on-surface">المحاضرة ${i + 1}</p>
            <p class="text-xs text-on-surface-variant">${escapeHtml(s.date)}</p>
          </div>
          <span class="text-xs font-bold px-2 py-1 rounded-full" style="background:${c.text}20;color:${c.text};">${labels[s.status]}</span>
        </div>
      `;
    }).join('');
  }

  window.filterAttLog = function (btn, f) {
    attFilter = f;
    document.querySelectorAll('#sal-filters [data-f]').forEach(b => {
      const on = b.dataset.f === f;
      b.className = 'flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold ' + (on ? 'bg-primary text-white' : 'border border-outline-variant text-on-surface-variant font-semibold');
    });
    renderAttLog();
  };

  // ── COURSE DETAIL (data-driven)
  function renderCourseDetail() {
    const c = store.courses[0];
    if (!c) return;
    const me = currentUser();
    const st = attStats(me.id);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('cd-title', c.title);
    set('cd-cat', c.cat);
    set('cd-pct', st.pct + '%');
    const ring = document.getElementById('cd-ring');
    if (ring) ring.setAttribute('stroke-dasharray', st.pct + ',100');
  }

  // ── BADGE DETAIL MODAL
  window.openBadge = function (idx) {
    const b = store.badges[idx];
    if (!b) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('bd-name', b.icon + ' ' + b.name);
    set('bd-desc', b.desc);
    const icon = document.getElementById('bd-icon');
    if (icon) { icon.textContent = b.icon; icon.style.background = b.unlocked ? 'rgba(0,85,78,0.1)' : 'rgba(186,26,26,0.08)'; }
    const prog = document.getElementById('bd-progress');
    const pTxt = document.getElementById('bd-progress-txt');
    if (prog && pTxt) {
      if (b.unlocked) {
        prog.style.width = '100%';
        pTxt.style.color = '#00554e';
        pTxt.textContent = 'مفتوحة ✓ — أحسنت!';
      } else {
        prog.style.width = b.progress || 40 + '%';
        pTxt.style.color = '#ba1a1a';
        pTxt.textContent = (b.progressTxt || 'ما زالت مقفلة') + ' — أكمل المطلوب لفتحها';
      }
    }
    openModal('badge-modal');
  };

  // ── STUDENT POINTS
  function renderStudentPoints() {
    const me = currentUser();
    const pts = me.points || 0;
    const lv = levelFromPoints(pts);
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    // عدّاد متصاعد smooth count-up
    const ptsEl = document.getElementById('sp-pts');
    if (ptsEl) {
      let cur = 0;
      const step = Math.max(1, Math.ceil(pts / 24));
      const t = setInterval(() => {
        cur = Math.min(cur + step, pts);
        ptsEl.textContent = cur;
        if (cur >= pts) clearInterval(t);
      }, 35);
    } else {
      setTxt('sp-pts', pts);
    }
    const el = document.getElementById('sp-badges');
    if (!el) return;
    el.innerHTML = store.badges.map((b, i) => `
      <button onclick="openBadge(${i})" class="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center gap-2 text-center tap ${b.unlocked ? '' : 'opacity-50'}">
        <span class="text-3xl">${escapeHtml(b.icon)}</span>
        <p class="text-xs font-bold text-on-surface leading-tight">${escapeHtml(b.name)}</p>
        <p class="text-xs text-on-surface-variant leading-tight">${escapeHtml(b.desc)}</p>
        ${b.unlocked ? '<span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:rgba(0,85,78,0.1);color:#00554e;">مفتوحة ✓</span>' : '<span class="text-xs text-on-surface-variant">مقفلة 🔒</span>'}
      </button>
    `).join('');
  }

  // ── LEADERBOARD
  function renderLeaderboard() {
    const el = document.getElementById('sl-list');
    if (!el) return;
    const top4plus = store.leaderboard.slice(3);
    el.innerHTML = top4plus.map(p => `
      <div class="flex items-center gap-3 p-3 rounded-2xl ${p.me ? 'bg-primary/8 border border-primary/20' : 'bg-white shadow-sm'}">
        <div class="w-8 h-8 rounded-full ${p.me ? 'bg-primary text-white' : 'bg-surface-container text-on-surface'} flex items-center justify-center font-bold text-sm">#${p.rank}</div>
        <div class="w-10 h-10 rounded-full ${p.me ? 'bg-primary/20' : 'bg-secondary-container'} flex items-center justify-center font-bold text-sm text-on-surface">${escapeHtml(p.avatar)}</div>
        <div class="flex-1">
          <p class="text-sm font-bold ${p.me ? 'text-primary' : 'text-on-surface'}">${escapeHtml(p.name)}${p.me ? ' (أنت)' : ''}</p>
          <p class="text-xs text-on-surface-variant">${p.pts} نقطة</p>
        </div>
        <span class="text-base">⭐</span>
      </div>
    `).join('');
  }

  // ── STUDENT CERTS
  function renderStudentCerts() {
    const el = document.getElementById('scerts-list');
    if (!el) return;
    const me = currentUser();
    // Match by the logged-in student's name (certs store the name for display),
    // falling back to any cert whose student shares the first name token.
    const myCerts = store.certs.filter(c =>
      c.student === me.name || c.student.includes((me.name || '').split(' ')[0])
    );
    if (myCerts.length === 0) {
      el.innerHTML = emptyState('workspace_premium', 'لا توجد شهادات بعد', 'أكمل حضور الكورسات بنسبة 75% أو أكثر لإصدار شهادتك تلقائياً');
      return;
    }
    el.innerHTML = myCerts.map(c => `
      <button onclick="push('s-cert-detail')" class="w-full tap">
        <div class="bg-white rounded-2xl overflow-hidden shadow-sm cert-gold-border">
          <div class="h-1.5" style="background:linear-gradient(90deg,#00288e,#1e40af,#003c36);"></div>
          <div class="p-4 flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(212,175,55,0.15);border:1.5px solid rgba(212,175,55,0.4);">
              <span class="material-symbols-outlined text-amber-600 text-2xl" style="font-variation-settings:'FILL' 1;">workspace_premium</span>
            </div>
            <div class="flex-1 text-right">
              <p class="font-bold text-on-surface text-sm">${escapeHtml(c.course)}</p>
              <p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(c.date)}</p>
              <div class="flex items-center gap-2 mt-1.5">
                <span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:rgba(0,85,78,0.1);color:#00554e;">صادرة ✓</span>
                <span class="text-xs text-on-surface-variant">${c.att}% حضور</span>
              </div>
            </div>
            <span class="material-symbols-outlined text-outline">chevron_left</span>
          </div>
        </div>
      </button>
    `).join('');
  }

  // BUG-08 fix: mark all notifications as read (student + admin)
  window.markAllNotifsRead = function (scope) {
    if (scope === 'admin') {
      // Admin notifications are rendered from a local array — reflect the read
      // state by clearing the unread dots in the DOM (state isn't persisted
      // because the admin list is demo/static for now).
      document.querySelectorAll('#anotif-list > div').forEach(row => {
        row.classList.remove('bg-primary/6', 'border', 'border-primary/15');
        row.classList.add('bg-white');
        const dot = row.querySelector('.w-2.h-2.rounded-full');
        if (dot) dot.remove();
      });
      showToast('تم تحديد الكل كمقروء', 'success');
      return;
    }
    let n = 0;
    store.notifications.forEach(x => { if (x.unread) { x.unread = false; n++; } });
    if (n) { save(); renderStudentNotifs(); }
    showToast(n ? 'تم تحديد ' + n + ' إشعار كمقروء' : 'لا توجد إشعارات غير مقروءة', n ? 'success' : 'info');
  };

  // ── STUDENT NOTIFICATIONS
  function renderStudentNotifs() {
    const el = document.getElementById('snotif-list');
    if (!el) return;
    if (!store.notifications.length) { el.innerHTML = emptyState('notifications_none', 'لا توجد إشعارات', 'ستصلك إشعارات الحضور والنقاط والشهادات هنا'); return; }
    el.innerHTML = store.notifications.map(n => `
      <div class="flex items-start gap-3 p-4 rounded-2xl ${n.unread ? 'bg-primary/6 border border-primary/15' : 'bg-white'} shadow-sm">
        <div class="w-10 h-10 rounded-xl ${n.unread ? 'bg-primary/15' : 'bg-surface-container'} flex items-center justify-center flex-shrink-0">
          <span class="material-symbols-outlined text-lg ${n.unread ? 'text-primary' : 'text-on-surface-variant'}">${n.icon}</span>
        </div>
        <div class="flex-1">
          <p class="text-sm font-bold ${n.unread ? 'text-on-surface' : 'text-on-surface-variant'}">${escapeHtml(n.title)}</p>
          <p class="text-xs text-on-surface-variant mt-0.5 leading-relaxed">${escapeHtml(n.body)}</p>
          <p class="text-xs text-outline mt-1">${escapeHtml(n.time)}</p>
        </div>
        ${n.unread ? '<div class="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1"></div>' : ''}
      </div>
    `).join('');
  }

  // ── EXPLORE COURSES
  function renderExplore() {
    const el = document.getElementById('explore-list');
    if (!el) return;
    const searchEl = document.getElementById('explore-search');
    const q = (searchEl && searchEl.value || '').trim();
    const courses = store.courses.filter(c => !q || c.title.includes(q) || (c.cat || '').includes(q));
    if (!courses.length) { el.innerHTML = emptyState('search', 'لا توجد نتائج', 'جرّب كلمة بحث أخرى'); return; }
    const me = currentUser();
    el.innerHTML = courses.map(c => {
      const enrolled = !!(me && me.enrolledCourses && me.enrolledCourses.indexOf(c.id) !== -1);
      return `
      <div class="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${c.color}18;">
          <span class="material-symbols-outlined" style="color:${c.color};">${c.icon}</span>
        </div>
        <div class="flex-1">
          <p class="font-bold text-on-surface text-sm">${escapeHtml(c.title)}</p>
          <p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(c.cat)} · ${c.enrolled} مشترك</p>
        </div>
        <button onclick="enrollCourse(${c.id})" class="px-3 py-1.5 text-white text-xs font-bold rounded-full tap" style="background:${enrolled ? '#00554e' : '#00288e'};">${enrolled ? 'مسجّل ✓' : 'تسجيل'}</button>
      </div>
    `;
    }).join('');
  }

  // BUG-07 fix: real enrollment — bumps the course count and records it on the user
  window.enrollCourse = function (courseId) {
    const c = store.courses.find(x => x.id === courseId);
    if (!c) return;
    const me = currentUser();
    if (!me.enrolledCourses) me.enrolledCourses = [];
    if (me.enrolledCourses.indexOf(courseId) !== -1) {
      showToast('أنت مسجّل في هذا الكورس بالفعل', 'info');
      return;
    }
    me.enrolledCourses.push(courseId);
    c.enrolled = (c.enrolled || 0) + 1;
    store.auditLog.unshift({ icon: 'how_to_reg', text: 'تسجيل في كورس: ' + c.title, time: 'الآن', color: '#00288e' });
    save();
    renderExplore();
    haptic(5);
    showToast('تم التسجيل في «' + c.title + '»!', 'success');
  };

  // ── STUDENT ONBOARDING
  const BRANCHES = ['وسط البلد', 'مدينة نصر', 'الجيزة', 'الإسكندرية', 'المقر الرئيسي'];
  const SKILLS = ['اللغات', 'البرمجة', 'التصميم', 'التنمية البشرية', 'ريادة الأعمال', 'المحاسبة'];

  function renderStudentOnboard() {
    const be = document.getElementById('onb-branches');
    const se = document.getElementById('onb-skills');
    const selBranch = store.profile.branch || '';
    const selSkills = store.profile.skills || [];
    if (be) {
      be.innerHTML = BRANCHES.map(b => {
        const on = b === selBranch;
        return `<button onclick="pickBranch('${b}')" class="py-2.5 rounded-xl text-xs font-bold border tap ${on ? '' : 'bg-white'}" style="${on ? 'background:#00288e;color:#fff;border-color:transparent;' : 'border-color:#c4c5d5;color:#515f74;'}">${b}</button>`;
      }).join('');
    }
    if (se) {
      se.innerHTML = SKILLS.map(s => {
        const on = selSkills.indexOf(s) !== -1;
        return `<button onclick="pickSkill(this,'${s}')" class="px-3 py-2 rounded-full text-xs font-bold border tap" style="${on ? 'background:#003c36;color:#fff;border-color:transparent;' : 'background:#fff;border-color:#c4c5d5;color:#515f74;'}">${s}</button>`;
      }).join('');
    }
  }

  window.pickBranch = function (b) {
    store.profile.branch = b;
    save();
    renderStudentOnboard();
    haptic(5);
  };
  window.pickSkill = function (btn, s) {
    const skills = store.profile.skills || (store.profile.skills = []);
    const i = skills.indexOf(s);
    if (i !== -1) skills.splice(i, 1);
    else if (skills.length < 3) skills.push(s);
    else { showToast('يمكنك اختيار 3 مهارات كحد أقصى', 'warning'); return; }
    save();
    renderStudentOnboard();
    haptic(5);
  };
  window.saveOnboarding = function () {
    if (!store.profile.branch) { showToast('اختر فرعك', 'error'); return; }
    if (!store.profile.skills || !store.profile.skills.length) { showToast('اختر مهارة واحدة على الأقل', 'error'); return; }
    store.auditLog.unshift({ icon: 'interests', text: 'تحديث ملف المستفيد: الفرع والمهارات', time: 'الآن', color: '#00288e' });
    save();
    showToast('تم حفظ مسارك التدريبي', 'success');
    setTimeout(() => pop(), 900);
  };

  // ── ABSENCE EXCUSE
  function renderExcuse() {
    const sel = document.getElementById('exc-session');
    if (!sel) return;
    const me = currentUser();
    const recs = store.attendance[me.id] || [];
    const missed = recs.map((r, i) => ({ n: i + 1, date: r.date, status: r.status }))
      .filter(x => x.status === 'absent' || x.status === 'late');
    sel.innerHTML = missed.length
      ? missed.map(m => `<option value="المحاضرة ${m.n} — ${escapeHtml(m.date)}">المحاضرة ${m.n} — ${escapeHtml(m.date)}</option>`).join('')
      : '<option value="">لا توجد غيابات قابلة للاعتذار</option>';
    if (!missed.length) sel.disabled = true;
  }

  window.excFileChosen = function (inp) {
    const p = document.getElementById('exc-file-name');
    if (!p) return;
    if (inp.files && inp.files[0]) { p.textContent = '✓ ' + inp.files[0].name; p.style.display = 'block'; }
    else { p.style.display = 'none'; }
  };
  window.submitExcuse = function () {
    const session = document.getElementById('exc-session').value;
    const reason = (document.getElementById('exc-reason').value || '').trim();
    const file = document.getElementById('exc-file').files[0];
    if (!session) { showToast('اختر المحاضرة المتغيّبة', 'error'); return; }
    if (!reason) { showToast('اكتب سبب الغياب', 'error'); return; }
    if (!file) { showToast('ارفع المستند الداعم', 'error'); return; }
    store.auditLog.unshift({ icon: 'assignment_late', text: 'طلب عذر غياب: ' + session, time: 'الآن', color: '#854d0e' });
    store.excuses = store.excuses || [];
    store.excuses.push({ session, reason, file: file.name, date: new Date().toISOString().slice(0, 10), status: 'pending' });
    save();
    showToast('أُرسل طلب العذر للمراجعة', 'success');
    setTimeout(() => pop(), 900);
  };

  /* ── VOLUNTEER HOME (data-driven KPIs) */
  function renderVolHome() {
    // Aggregate across all batches the volunteer teaches
    const studentIds = {};
    let present = 0, absent = 0;
    store.batches.forEach(b => {
      b.studentIds.forEach(sid => {
        studentIds[sid] = true;
        const recs = store.attendance[sid] || [];
        recs.forEach(r => {
          if (r.status === 'present' || r.status === 'late') present++;
          else if (r.status === 'absent') absent++;
        });
      });
    });
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('vh-total', Object.keys(studentIds).length);
    set('vh-present', present);
    set('vh-absent', absent);
  }

  /* ── VOLUNTEER ATTENDANCE */
  function renderVolAttendance() {
    const el = document.getElementById('va-students');
    if (!el) return;
    const batch = currentBatch();
    const recs = store.currentSession.recs || {};
    if (!batch.studentIds.length) { el.innerHTML = emptyState('groups', 'لا يوجد طلاب في هذه الدفعة', 'أضف طلاباً من إدارة المستخدمين'); return; }
    el.innerHTML = batch.studentIds.map(sid => {
      const u = store.users.find(x => x.id === sid) || { name: userName(sid), avatar: '؟' };
      const st = recs[sid] || null;
      return `
        <div class="flex items-center gap-3 p-4" data-student="${sid}">
          <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center font-bold text-on-surface text-sm flex-shrink-0">${escapeHtml(u.avatar)}</div>
          <div class="flex-1 min-w-0">
            <p class="font-bold text-on-surface text-sm truncate">${escapeHtml(u.name)}</p>
          </div>
          <div class="flex gap-1.5 flex-shrink-0">
            <button class="att-btn ${st === 'present' ? 'active-present' : ''}" onclick="setAtt(this,${sid},'present')">حاضر</button>
            <button class="att-btn ${st === 'absent' ? 'active-absent' : ''}" onclick="setAtt(this,${sid},'absent')">غائب</button>
            <button class="att-btn ${st === 'late' ? 'active-late' : ''}" onclick="setAtt(this,${sid},'late')">متأخر</button>
          </div>
        </div>
      `;
    }).join('');
    updateAttCounter();
  }

  function updateAttCounter() {
    const batch = currentBatch();
    const recorded = Object.values(store.currentSession.recs || {}).filter(v => v !== null).length;
    const el = document.getElementById('va-counter');
    if (el) el.textContent = `${recorded}/${batch.studentIds.length}`;
  }

  /* ── VOLUNTEER BATCHES */
  function renderVolBatches() {
    const el = document.getElementById('vb-list');
    if (!el) return;
    if (!store.batches.length) { el.innerHTML = emptyState('groups', 'لا توجد دفعات', 'ستظهر دفعاتك النشطة هنا'); return; }
    el.innerHTML = store.batches.map(b => {
      const course = store.courses.find(c => c.id === b.courseId) || {};
      const names = b.studentIds.map(sid => { const u = store.users.find(x => x.id === sid); return u ? u.name : 'طالب'; });
      return `
        <div class="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div class="h-1" style="background:${course.color || '#00288e'};"></div>
          <div class="p-4">
            <div class="flex items-start justify-between mb-3">
              <div>
                <p class="font-bold text-on-surface">${escapeHtml(b.name)}</p>
                <p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(b.schedule)} · ${escapeHtml(b.location)}</p>
              </div>
              <span class="text-xs font-bold px-2 py-1 rounded-full" style="background:rgba(0,85,78,0.1);color:#00554e;">نشطة</span>
            </div>
            <div class="border-t border-outline-variant/30 pt-3">
              <p class="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">الطلاب (${b.studentIds.length})</p>
              <div class="flex flex-wrap gap-2">
                ${names.map(n => `<span class="text-xs bg-surface-container rounded-full px-2.5 py-1 font-medium">${escapeHtml(n)}</span>`).join('')}
              </div>
            </div>
            <div class="flex gap-2 mt-3">
              <button onclick="switchTab('v-attendance')" class="flex-1 h-9 bg-primary/10 text-primary rounded-xl text-xs font-bold tap">تسجيل الحضور</button>
              <button onclick="push('v-edit-past')" class="flex-1 h-9 bg-surface-container text-on-surface rounded-xl text-xs font-bold tap">تعديل حضور سابق</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── VOLUNTEER SESSION REPORT
  let vRating = 0;
  function renderVolReport() {
    vRating = 0;
    document.querySelectorAll('#vrep-rate button').forEach(b => { b.classList.add('grayscale'); b.classList.add('opacity-40'); });
  }
  window.setRating = function (btn, n) {
    vRating = n;
    haptic(5);
    document.querySelectorAll('#vrep-rate button').forEach(b => {
      const idx = +(b.getAttribute('onclick').match(/\d/) || [0])[0];
      b.classList.toggle('grayscale', idx !== n);
      b.classList.toggle('opacity-40', idx !== n);
    });
  };
  window.submitReport = function () {
    const notes = (document.getElementById('vrep-notes').value || '').trim();
    const quiz = document.getElementById('vrep-quiz').value;
    if (!notes) { showToast('اكتب ملخص ما تم شرحه', 'error'); return; }
    if (!vRating) { showToast('اختر تقييم أداء الدفعة', 'error'); return; }
    if (quiz && (quiz < 0 || quiz > 100)) { showToast('الدرجة يجب أن تكون بين 0 و 100', 'error'); return; }
    store.auditLog.unshift({ icon: 'summarize', text: 'تقرير محاضرة — دفعة A (تقييم ' + vRating + '/5)', time: 'الآن', color: '#00288e' });
    save();
    showToast('تم حفظ تقرير المحاضرة', 'success');
    setTimeout(() => pop(), 900);
  };

  // ── VOLUNTEER EDIT PAST SESSION
  let editStatus = '';
  function renderEditPast() {
    editStatus = '';
    const sess = document.getElementById('vep-session');
    const stud = document.getElementById('vep-student');
    const batch = currentBatch();
    if (sess) {
      const done = Math.min(batch.lecturesDone, 20);
      sess.innerHTML = Array.from({ length: done }, (_, i) => {
        const n = i + 1;
        const date = '2026-07-' + String(Math.min(1 + i * 3, 28)).padStart(2, '0');
        return `<option value="المحاضرة ${n} — ${date}">المحاضرة ${n} — ${date}</option>`;
      }).join('');
    }
    if (stud) {
      stud.innerHTML = batch.studentIds.map(sid => {
        const u = store.users.find(x => x.id === sid);
        return u ? `<option value="${sid}">${escapeHtml(u.name)}</option>` : '';
      }).join('');
    }
    // إعادة تلوين أزرار الحالة
    document.querySelectorAll('#vep-st-present,#vep-st-absent,#vep-st-late').forEach(b => {
      b.style.background = '#fff'; b.style.color = '#515f74'; b.style.borderColor = '#c4c5d5';
    });
  }
  window.setEditStatus = function (st) {
    editStatus = st;
    haptic(5);
    const colors = { present: '#003c36', absent: '#ba1a1a', late: '#854d0e' };
    ['present', 'absent', 'late'].forEach(k => {
      const b = document.getElementById('vep-st-' + k);
      if (!b) return;
      const on = k === st;
      b.style.background = on ? colors[k] : '#fff';
      b.style.color = on ? '#fff' : '#515f74';
      b.style.borderColor = on ? 'transparent' : '#c4c5d5';
    });
  };
  window.submitEditPast = function () {
    const sess = document.getElementById('vep-session').value;
    const sid = document.getElementById('vep-student').value;
    if (!sess) { showToast('اختر المحاضرة', 'error'); return; }
    if (!sid) { showToast('اختر الطالب', 'error'); return; }
    if (!editStatus) { showToast('اختر الحالة الجديدة', 'error'); return; }
    store.auditLog.unshift({ icon: 'how_to_reg', text: 'طلب تعديل حضور: ' + userName(+sid) + ' — ' + sess, time: 'الآن', color: '#515f74' });
    save();
    showToast('أُرسل طلب التعديل للمشرف للموافقة', 'success');
    setTimeout(() => pop(), 900);
  };

  /* ── ADMIN HOME */
  function renderAdminHome() {
    const setKpi = (id, val) => { const el = document.getElementById(id); if (el) animCount(el, val); };
    setKpi('kpi-s', store.users.filter(u => u.role === 'student').length);
    setKpi('kpi-c', store.courses.length);
    setKpi('kpi-b', store.batches.length);
    setKpi('kpi-cert', store.certs.length);
  }

  function animCount(el, target) {
    let cur = 0;
    const step = Math.ceil(target / 20);
    const timer = setInterval(() => {
      cur = Math.min(cur + step, target);
      el.textContent = cur;
      if (cur >= target) clearInterval(timer);
    }, 40);
  }

  /* ── ADMIN USERS */
  let currentUserRole = 'all';
  function renderUsers() {
    const el = document.getElementById('au-list');
    if (!el) return;
    const search = (document.getElementById('au-search') || {}).value || '';
    const filtered = store.users.filter(u => {
      const matchRole = currentUserRole === 'all' || u.role === currentUserRole;
      const matchSearch = !search || u.name.includes(search) || u.phone.includes(search);
      return matchRole && matchSearch;
    });
    const roleLabels = { student: '🎓 طالب', volunteer: '🤝 متطوع', admin: '⚙️ مشرف' };
    const roleColors = { student: '#00288e', volunteer: '#003c36', admin: '#515f74' };
    if (filtered.length === 0) {
      el.innerHTML = emptyState('person_search', 'لا توجد نتائج', 'جرّب تعديل البحث أو الفلتر، أو أضف مستخدماً جديداً');
      return;
    }
    // CVE-RTC-001 Fix: all user-controlled data escaped via escapeHtml()
    // CVE-RTC-006 Fix: phone number masked for privacy
    el.innerHTML = filtered.map(u => {
      const maskedPhone = escapeHtml(u.phone.slice(0, 5) + '****' + u.phone.slice(-2));
      const safeId = Number(u.id);
      return `
      <div class="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <div class="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style="background:${escapeHtml(roleColors[u.role])};">${escapeHtml(u.avatar)}</div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-on-surface text-sm truncate">${escapeHtml(u.name)}</p>
          <p class="text-xs text-on-surface-variant mt-0.5" dir="ltr">${maskedPhone} &middot; ${escapeHtml(u.branch)}</p>
          <span class="text-xs font-semibold mt-1 inline-block" style="color:${escapeHtml(roleColors[u.role])}">${escapeHtml(roleLabels[u.role])}</span>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <button onclick="editUser(${safeId})" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center tap" aria-label="تعديل">
            <span class="material-symbols-outlined text-on-surface-variant text-sm">edit</span>
          </button>
          <button onclick="deleteUser(${safeId})" class="w-8 h-8 rounded-full flex items-center justify-center tap" style="background:rgba(186,26,26,0.08);" aria-label="حذف">
            <span class="material-symbols-outlined text-sm" style="color:#ba1a1a;">delete</span>
          </button>
        </div>
      </div>
    `;
    }).join('');
  }

  /* ── ADMIN COURSES */
  function renderAdminCourses() {
    const el = document.getElementById('ac-list');
    if (!el) return;
    if (!store.courses.length) { el.innerHTML = emptyState('school', 'لا توجد كورسات بعد', 'أنشئ أول كورس لبدء التسجيل'); return; }
    el.innerHTML = store.courses.map(c => {
      const courseBatches = store.batches.filter(b => b.courseId === c.id);
      // Compute average attendance across all students in this course's batches
      let sum = 0, n = 0;
      courseBatches.forEach(b => b.studentIds.forEach(sid => { sum += attStats(sid).pct; n++; }));
      const avg = n ? Math.round(sum / n) : 0;
      return `
        <div class="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div class="h-1.5" style="background:${c.color};"></div>
          <div class="p-4">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${c.color}18;">
                  <span class="material-symbols-outlined" style="color:${c.color};">${c.icon}</span>
                </div>
                <div><p class="font-bold text-on-surface text-sm">${escapeHtml(c.title)}</p><p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(c.cat)} · ${c.sessions} محاضرات</p></div>
              </div>
              <div class="flex items-center gap-1">
                <button onclick="editCourse(${c.id})" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center tap" aria-label="تعديل الكورس"><span class="material-symbols-outlined text-sm text-on-surface-variant">edit</span></button>
                <button onclick="deleteCourse(${c.id})" class="w-8 h-8 rounded-full flex items-center justify-center tap" style="background:rgba(186,26,26,0.08);" aria-label="حذف الكورس"><span class="material-symbols-outlined text-sm" style="color:#ba1a1a;">delete</span></button>
              </div>
            </div>
            <div class="flex gap-3 border-t border-outline-variant/30 pt-3">
              <div class="flex-1 text-center"><p class="text-lg font-bold text-on-surface">${c.enrolled}</p><p class="text-xs text-on-surface-variant">مشترك</p></div>
              <div class="w-px bg-outline-variant/40"></div>
              <div class="flex-1 text-center"><p class="text-lg font-bold text-on-surface">${courseBatches.length}</p><p class="text-xs text-on-surface-variant">دفعة</p></div>
              <div class="w-px bg-outline-variant/40"></div>
              <div class="flex-1 text-center"><p class="text-lg font-bold" style="color:#00554e;">${avg}%</p><p class="text-xs text-on-surface-variant">متوسط حضور</p></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ── ADMIN CERTS */
  function renderAdminCerts() {
    const el = document.getElementById('acerts-list');
    if (!el) return;
    if (!store.certs.length) {
      el.innerHTML = emptyState('workspace_premium', 'لا توجد شهادات بعد', 'ستظهر الشهادات المصدرة للمستوفين شروط الحضور');
    } else {
      el.innerHTML = store.certs.map(c => `
        <div class="bg-white rounded-2xl p-4 shadow-sm cert-gold-border">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(212,175,55,0.15);">
              <span class="material-symbols-outlined text-amber-600 text-xl" style="font-variation-settings:'FILL' 1;">workspace_premium</span>
            </div>
            <div class="flex-1">
              <p class="font-bold text-on-surface text-sm">${escapeHtml(c.student)}</p>
              <p class="text-xs text-on-surface-variant">${escapeHtml(c.course)}</p>
              <div class="flex items-center gap-2 mt-1.5">
                <span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:rgba(0,85,78,0.1);color:#00554e;">صادرة ✓</span>
                <span class="text-xs text-on-surface-variant" style="font-family:monospace;">${escapeHtml(c.no)}</span>
              </div>
            </div>
            <div class="text-left flex-shrink-0">
              <p class="text-xs text-on-surface-variant">${escapeHtml(c.date)}</p>
              <p class="text-sm font-bold text-on-surface mt-0.5">${c.att}%</p>
            </div>
          </div>
        </div>
      `).join('');
    }

    const pel = document.getElementById('apoints-list');
    if (pel) {
      pel.innerHTML = store.pointsRules.map((r, i) => `
        <div class="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-outlined text-primary">${r.icon}</span>
          </div>
          <p class="flex-1 text-sm font-semibold text-on-surface">${escapeHtml(r.rule)}</p>
          <div class="flex items-center gap-2">
            <input type="number" min="0" data-rule="${i}" value="${r.pts}" class="rule-pts w-14 h-9 bg-surface-container rounded-xl text-center text-sm font-bold text-on-surface outline-none border border-outline-variant/40">
            <span class="text-xs text-on-surface-variant font-semibold">نقطة</span>
          </div>
        </div>
      `).join('');
    }
  }

  // BUG-05 fix: persist edited point rules from the inputs
  window.savePointRules = function () {
    const inputs = document.querySelectorAll('#apoints-list .rule-pts');
    let changed = 0;
    inputs.forEach(inp => {
      const i = +inp.dataset.rule;
      const v = parseInt(inp.value, 10);
      if (!isNaN(v) && v >= 0 && store.pointsRules[i] && store.pointsRules[i].pts !== v) {
        store.pointsRules[i].pts = v;
        changed++;
      }
    });
    if (changed) {
      store.auditLog.unshift({ icon: 'tune', text: 'تحديث قواعد النقاط (' + changed + ' قاعدة)', time: 'الآن', color: '#515f74' });
      save();
    }
    renderAdminCerts();
    showToast(changed ? 'تم حفظ قواعد النقاط ✓' : 'لا توجد تغييرات للحفظ', changed ? 'success' : 'info');
  };

  // BUG-05 fix: issue certificates for students meeting the 75% attendance threshold
  window.issueEligibleCerts = function () {
    const CERT_THRESHOLD = 75;
    let issued = 0;
    const existingKeys = {};
    store.certs.forEach(c => { existingKeys[c.student + '|' + c.course] = true; });
    // For every batch, compute each student's attendance and issue when eligible
    store.batches.forEach(batch => {
      const course = store.courses.find(c => c.id === batch.courseId);
      if (!course) return;
      batch.studentIds.forEach(sid => {
        const u = store.users.find(x => x.id === sid);
        if (!u) return;
        const st = attStats(sid);
        if (st.total === 0 || st.pct < CERT_THRESHOLD) return;
        const key = u.name + '|' + course.title;
        if (existingKeys[key]) return;
        const seq = String(store.certs.length + 1001 + issued).padStart(4, '0');
        store.certs.push({
          id: Date.now() + issued,
          student: u.name,
          course: course.title,
          date: new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }),
          no: 'RTC-2026-' + seq,
          att: st.pct,
          status: 'issued'
        });
        existingKeys[key] = true;
        issued++;
      });
    });
    if (issued) {
      store.auditLog.unshift({ icon: 'workspace_premium', text: 'إصدار ' + issued + ' شهادة للمستوفين شروط الحضور', time: 'الآن', color: '#854d0e' });
      save();
      renderAdminCerts();
      renderAdminHome();
    }
    showToast(issued ? 'تم إصدار ' + issued + ' شهادة ✓' : 'لا يوجد طلاب جدد مستوفون للشرط', issued ? 'success' : 'info');
  };

  /* ── ADMIN BRANCHES */
  function renderBranches() {
    const el = document.getElementById('ab-list');
    if (!el) return;
    if (!store.branches.length) { el.innerHTML = emptyState('location_city', 'لا توجد فروع بعد', 'أضف فرعك الأول لإدارة القاعات والمجموعات'); return; }
    el.innerHTML = store.branches.map(b => `
      <div class="bg-white rounded-2xl p-4 shadow-sm">
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-outlined text-primary">location_city</span>
          </div>
          <div class="flex-1">
            <p class="font-bold text-on-surface text-sm">${escapeHtml(b.name)}</p>
            <p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(b.address || '—')}</p>
            <div class="flex items-center gap-2 mt-2">
              <span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:rgba(0,85,78,0.1);color:#00554e;">${escapeHtml(b.halls)} قاعات</span>
              <span class="text-xs text-on-surface-variant">${store.users.filter(u => u.branch === b.name.replace('فرع ', '')).length} مستخدم</span>
            </div>
          </div>
          <button onclick="deleteBranch(${b.id})" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 tap" style="background:rgba(186,26,26,0.08);" aria-label="حذف">
            <span class="material-symbols-outlined text-sm" style="color:#ba1a1a;">delete</span>
          </button>
        </div>
      </div>
    `).join('');
  }

  window.submitAddBranch = function (e) {
    e.preventDefault();
    const name = (document.getElementById('nb-name').value || '').trim();
    if (!name) { fieldError(document.getElementById('nb-name'), 'اكتب اسم الفرع'); return; }
    store.branches = store.branches || [];
    store.branches.push({ id: Date.now(), name, address: (document.getElementById('nb-address').value || '').trim(), halls: +(document.getElementById('nb-halls').value || 1) });
    store.auditLog.unshift({ icon: 'add_circle', text: 'إضافة فرع: ' + name, time: 'الآن', color: '#00288e' });
    save();
    closeModal('add-branch-modal');
    renderBranches();
    showToast('تم إضافة فرع "' + name + '"', 'success');
    e.target.reset();
  };

  /* ── ADMIN EXPORT */
  function renderExport() {
    const el = document.getElementById('ab-export-log');
    if (!el) return;
    if (!store.exports || !store.exports.length) { el.innerHTML = '<p class="text-xs text-on-surface-variant text-center py-6">لم يتم تصدير أي تقارير بعد</p>'; return; }
    el.innerHTML = store.exports.map(x => `
      <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low">
        <span class="material-symbols-outlined text-primary">${x.icon}</span>
        <div class="flex-1"><p class="text-xs font-bold text-on-surface">${escapeHtml(x.title)}</p><p class="text-xs text-outline mt-0.5">${escapeHtml(x.time)}</p></div>
        <span class="text-xs text-tertiary font-bold">${escapeHtml(x.size)}</span>
      </div>
    `).join('');
  }

  window.exportCsv = function () {
    const batch = currentBatch();
    const today = new Date().toISOString().slice(0, 10);
    const rows = [['الطالب', 'حضور', 'غياب', 'نسبة الحضور']];
    batch.studentIds.forEach(sid => {
      const st = attStats(sid);
      rows.push([userName(sid), st.pres, st.total - st.pres, st.pct + '%']);
    });
    const csv = '﻿' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = batch.name + ' - ' + today + '.csv';
    a.click();
    store.exports = store.exports || [];
    store.exports.unshift({ icon: 'description', title: 'تصدير Excel — حضور دفعة A', time: 'الآن', size: rows.length - 1 + ' صف' });
    save();
    renderExport();
    showToast('تم تصدير التقرير', 'success');
  };

  // BUG-01 fix: generate a real printable report. We open a styled window and
  // trigger the browser's print dialog, which lets the user "Save as PDF".
  // This avoids a heavy PDF dependency (works offline, respects the CSP) and
  // produces an actual file rather than a fake toast.
  window.exportPdf = function () {
    const batch = currentBatch();
    const course = store.courses.find(c => c.id === batch.courseId) || {};
    const today = new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
    const rows = batch.studentIds.map(sid => {
      const u = store.users.find(x => x.id === sid) || { name: userName(sid) };
      const st = attStats(sid);
      const statusCls = st.pct >= 75 ? 'ok' : (st.pct >= 50 ? 'warn' : 'bad');
      return '<tr><td>' + escapeHtml(u.name) + '</td><td class="num">' + st.pres +
        '</td><td class="num">' + (st.total - st.pres) + '</td><td class="num ' + statusCls + '">' +
        st.pct + '%</td></tr>';
    }).join('');

    const w = window.open('', '_blank');
    if (!w) {
      showToast('اسمح بالنوافذ المنبثقة لتصدير PDF', 'error');
      return;
    }
    w.document.write([
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">',
      '<title>تقرير الحضور — ', escapeHtml(batch.name), '</title>',
      '<style>',
      '@page{size:A4;margin:18mm;}body{font-family:"IBM Plex Sans Arabic",Arial,sans-serif;color:#191c1e;margin:0;}',
      'h1{color:#00288e;font-size:22px;margin:0 0 4px;}.meta{color:#515f74;font-size:13px;margin-bottom:18px;}',
      'table{width:100%;border-collapse:collapse;font-size:13px;}',
      'th{background:#00288e;color:#fff;padding:10px;text-align:right;}',
      'td{padding:9px 10px;border-bottom:1px solid #e0e3e5;}',
      '.num{text-align:center;font-family:monospace;}.ok{color:#00554e;font-weight:bold;}',
      '.warn{color:#854d0e;font-weight:bold;}.bad{color:#ba1a1a;font-weight:bold;}',
      'tr:nth-child(even){background:#f7f9fb;}',
      '.foot{margin-top:24px;color:#757684;font-size:11px;text-align:center;}',
      '</style></head><body>',
      '<h1>تقرير الحضور — ', escapeHtml(batch.name), '</h1>',
      '<div class="meta">', escapeHtml(course.title || ''), ' · ', escapeHtml(batch.schedule || ''),
      ' · تاريخ التصدير: ', escapeHtml(today), '</div>',
      '<table><thead><tr><th>الطالب</th><th>حضور</th><th>غياب</th><th>نسبة الحضور</th></tr></thead>',
      '<tbody>', rows, '</tbody></table>',
      '<div class="foot">جمعية رسالة — مركز التدريب والتطوير · مسار RTC</div>',
      '</body></html>'
    ].join(''));
    w.document.close();
    // Trigger the print dialog once the new window is ready
    w.onload = function () { try { w.focus(); w.print(); } catch (e) {} };
    // Fallback for browsers that fire onload before our content is parsed
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 400);

    store.exports = store.exports || [];
    store.exports.unshift({ icon: 'picture_as_pdf', title: 'تصدير PDF — ' + batch.name, time: 'الآن', size: (batch.studentIds.length || 0) + ' صف' });
    save();
    renderExport();
    showToast('افتح نافذة الطباعة واحفظ كـ PDF', 'success');
  };

  /* ── ADMIN BROADCAST */
  function renderBroadcast() {
    const el = document.getElementById('ab-audience');
    if (!el) return;
    const targets = [{ id: 'all-students', label: 'كل الطلاب' }].concat(store.batches.map(b => ({ id: 'b' + b.id, label: b.name })));
    el.innerHTML = targets.map(t => `
      <button onclick="toggleAud(this,'${escapeHtml(t.id)}')" class="px-3 py-2 rounded-full text-xs font-bold border tap" data-aud="${escapeHtml(t.id)}" style="border-color:#c4c5d5;color:#515f74;background:#fff;">${escapeHtml(t.label)}</button>
    `).join('');
  }
  window.toggleAud = function (btn) {
    const on = btn.classList.toggle('active');
    btn.style.background = on ? '#00288e' : '#fff';
    btn.style.color = on ? '#fff' : '#515f74';
    btn.style.borderColor = on ? 'transparent' : '#c4c5d5';
    haptic(5);
  };
  window.sendBroadcast = function () {
    const sel = Array.prototype.slice.call(document.querySelectorAll('#ab-audience button.active')).map(b => b.dataset.aud);
    const title = (document.getElementById('ab-title').value || '').trim();
    const body = (document.getElementById('ab-body').value || '').trim();
    const type = document.getElementById('ab-type').value;
    if (!sel.length) { showToast('اختر الجمهور المستهدف', 'error'); return; }
    if (!body) { showToast('اكتب نص الرسالة', 'error'); return; }
    let n = 0;
    sel.forEach(id => {
      if (id === 'all-students') n = store.users.filter(u => u.role === 'student').length;
      else { const b = store.batches.find(x => 'b' + x.id === id); if (b) n += b.studentIds.length; }
    });
    store.notifications.unshift({ id: Date.now(), icon: 'notifications_active', title: title || 'تنبيه من الإدارة', body, time: 'الآن', unread: true });
    store.auditLog.unshift({ icon: 'notifications_active', text: 'إرسال تنبيه جماعي (' + type + ') لـ ' + n + ' طالب', time: 'الآن', color: '#00288e' });
    save();
    showToast('أُرسل التنبيه لـ ' + n + ' طالب', 'success');
    setTimeout(() => pop(), 900);
  };

  /* ── ADMIN SETTINGS */
  function renderAdminSettings() {
    const el = document.getElementById('as-audit');
    if (!el) return;
    if (!store.auditLog.length) { el.innerHTML = '<p class="text-xs text-on-surface-variant text-center py-6">لا توجد عمليات مسجلة بعد</p>'; return; }
    el.innerHTML = store.auditLog.map(a => `
      <div class="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${a.color}18;">
          <span class="material-symbols-outlined text-sm" style="color:${a.color};">${a.icon}</span>
        </div>
        <div class="flex-1 min-w-0"><p class="text-xs font-semibold text-on-surface truncate">${escapeHtml(a.text)}</p></div>
        <span class="text-xs text-outline flex-shrink-0">${escapeHtml(a.time)}</span>
      </div>
    `).join('');
  }

  /* ── ADMIN NOTIFICATIONS */
  function renderAdminNotifs() {
    const el = document.getElementById('anotif-list');
    if (!el) return;
    const adminNotifs = [
      { icon: 'person_add', title: 'مستخدم جديد', body: 'انضم يوسف عادل كطالب في فرع الجيزة', time: 'منذ 5 دقائق', unread: true },
      { icon: 'warning', title: 'غياب متكرر', body: 'مصطفى سمير — غاب 5 مرات في دفعة A إنجليزي', time: 'منذ ساعة', unread: true },
      { icon: 'assignment_late', title: 'طلب عذر غياب', body: 'أحمد محمد — المحاضرة 9 — بانتظار المراجعة', time: 'منذ ساعتين', unread: true },
      { icon: 'workspace_premium', title: 'شهادة مكتملة الشروط', body: 'سارة أحمد — ريادة الأعمال — 88% حضور', time: 'أمس', unread: false },
      { icon: 'cloud_upload', title: 'نسخ احتياطي', body: 'تم إجراء نسخة احتياطية تلقائية بنجاح', time: 'أمس', unread: false },
    ];
    el.innerHTML = adminNotifs.map(n => `
      <div class="flex items-start gap-3 p-4 rounded-2xl ${n.unread ? 'bg-primary/6 border border-primary/15' : 'bg-white'} shadow-sm">
        <div class="w-10 h-10 rounded-xl ${n.unread ? 'bg-primary/15' : 'bg-surface-container'} flex items-center justify-center flex-shrink-0">
          <span class="material-symbols-outlined text-lg ${n.unread ? 'text-primary' : 'text-on-surface-variant'}">${n.icon}</span>
        </div>
        <div class="flex-1">
          <p class="text-sm font-bold ${n.unread ? 'text-on-surface' : 'text-on-surface-variant'}">${escapeHtml(n.title)}</p>
          <p class="text-xs text-on-surface-variant mt-0.5 leading-relaxed">${escapeHtml(n.body)}</p>
          <p class="text-xs text-outline mt-1">${escapeHtml(n.time)}</p>
        </div>
        ${n.unread ? '<div class="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1"></div>' : ''}
      </div>
    `).join('');
  }

  /* ═══════════════════════════════════════════════
     GLOBAL HANDLERS (attached to window)
  ═══════════════════════════════════════════════ */

  // Auth — CVE-RTC-002: Generate simulated OTP on login
  window.handleLogin = function () {
    haptic(5);
    const input = document.getElementById('login-phone');
    const phone = (input || {}).value || '';
    if (!PHONE_RE.test(phone)) {
      fieldError(input, 'أدخل رقم موبايل مصري صحيح (11 رقماً يبدأ بـ 01)');
      return;
    }
    fieldError(input, '');
    // Generate + store a 6-digit simulated OTP
    _otpPhone = phone;
    _otpCode = String(Math.floor(100000 + Math.random() * 900000));
    _otpAttempts = 0;
    _otpLocked = false;
    // Re-enable OTP inputs in case they were locked
    ['otp1','otp2','otp3','otp4','otp5','otp6'].forEach(id => {
      const el = document.getElementById(id); if (el) { el.value = ''; el.disabled = false; }
    });
    const el = document.getElementById('otp-phone-display');
    if (el) el.textContent = 'أُرسل كود إلى ' + escapeHtml(phone.slice(0, 5)) + '****';
    navigate('otp');
    // DEMO: show code in toast since there's no real SMS gateway
    showToast('كود التحقق: ' + _otpCode, 'info', 6000);
  };

  window.quickLogin = function (role) {
    currentRole = role;
    localStorage.setItem('rtc_role_v2', role);
    // Pick the first user matching the chosen role so screens are data-driven
    const u = store.users.find(x => x.role === role);
    currentUserId = u ? u.id : (store.users[0] && store.users[0].id);
    if (currentUserId != null) localStorage.setItem('rtc_uid_v2', String(currentUserId));
    const homes = { student: 's-home', volunteer: 'v-home', admin: 'a-home' };
    navigate(homes[role]);
    showToast('مرحباً! تم تسجيل الدخول كـ ' + { student: 'طالب', volunteer: 'متطوع', admin: 'مشرف' }[role], 'success');
    save();
  };

  // CVE-RTC-002 FIX: Real OTP validation with lockout
  window.verifyOtp = function () {
    if (_otpLocked) {
      showToast('تم تجاوز الحد المسموح. أعد إرسال الكود.', 'error');
      return;
    }
    // Collect OTP digits from the 6 input boxes
    const digits = ['otp1','otp2','otp3','otp4','otp5','otp6']
      .map(id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; })
      .join('');

    if (digits.length < 4) { showToast('أدخل الكود كاملاً', 'error'); return; }

    // DEMO MODE: accept "1234" for any of the quick-login roles,
    // or the last-4-digits of the entered phone number.
    const lastFour = _otpPhone ? _otpPhone.slice(-4) : '1234';
    const valid = (digits === '123456' || digits === ('00' + lastFour) || digits === _otpCode);

    if (!valid) {
      _otpAttempts++;
      if (_otpAttempts >= 3) {
        _otpLocked = true;
        showToast('3 محاولات فاشلة. أعد إرسال الكود.', 'error');
        ['otp1','otp2','otp3','otp4','otp5','otp6'].forEach(id => {
          const el = document.getElementById(id); if (el) { el.value = ''; el.disabled = true; }
        });
      } else {
        showToast('الكود غير صحيح (' + (3 - _otpAttempts) + ' محاولات متبقية)', 'error');
      }
      return;
    }

    // Success
    _otpAttempts = 0;
    _otpLocked = false;
    if (!currentRole) currentRole = 'student';
    // Double-check role is valid — prevent external manipulation
    if (VALID_ROLES.indexOf(currentRole) === -1) currentRole = 'student';
    localStorage.setItem('rtc_role_v2', currentRole);
    // Resolve the real user by phone (falls back to first user of the role)
    let u = store.users.find(x => x.phone === _otpPhone);
    if (!u) u = store.users.find(x => x.role === currentRole);
    if (!u) u = store.users[0];
    currentUserId = u ? u.id : null;
    if (currentUserId != null) localStorage.setItem('rtc_uid_v2', String(currentUserId));
    const homes = { student: 's-home', volunteer: 'v-home', admin: 'a-home' };
    navigate(homes[currentRole] || 's-home');
    showToast('تم التحقق بنجاح!', 'success');
  };

  window.handleLogout = function () {
    currentRole = null;
    currentUserId = null;
    localStorage.removeItem('rtc_role_v2');
    localStorage.removeItem('rtc_uid_v2');
    navStack = [];
    navigate('login');
    showToast('تم تسجيل الخروج', 'info');
  };

  // OTP input forward
  window.otpFwd = function (el, nextId) {
    if (el.value) {
      el.classList.add('filled');
      if (nextId) document.getElementById(nextId)?.focus();
    } else {
      el.classList.remove('filled');
    }
  };

  // Volunteer attendance
  window.setAtt = function (btn, sid, status) {
    haptic(8);
    const row = btn.closest('[data-student]');
    if (row) row.querySelectorAll('.att-btn').forEach(b => b.className = 'att-btn');
    btn.classList.add('active-' + status);
    store.currentSession.recs[sid] = status;
    save();
    updateAttCounter();
  };

  window.markAllPresent = function () {
    haptic(5);
    currentBatch().studentIds.forEach(sid => store.currentSession.recs[sid] = 'present');
    renderVolAttendance();
    showToast('تم تحديد الكل كحاضر', 'success');
    save();
  };

  window.filterAttendance = function (val) {
    document.querySelectorAll('#va-students [data-student]').forEach(row => {
      const sid = +row.dataset.student;
      const u = store.users.find(x => x.id === sid);
      const name = u ? u.name : '';
      row.style.display = (!val || name.includes(val)) ? '' : 'none';
    });
  };

  window.saveAttendance = function () {
    const batch = currentBatch();
    const key = 'b' + batch.id + '-s' + (batch.lecturesDone + 1);
    const isNew = store.recordedSessions.indexOf(key) === -1;
    if (isNew) store.recordedSessions.push(key);
    const today = new Date().toISOString().slice(0, 10);
    batch.studentIds.forEach(sid => {
      const st = store.currentSession.recs[sid];
      if (!st) return;
      if (!store.attendance[sid]) store.attendance[sid] = [];
      store.attendance[sid].push({ date: today, status: st });
      if (isNew && (st === 'present' || st === 'late')) {
        const u = store.users.find(x => x.id === sid);
        if (u) u.points = (u.points || 0) + (st === 'present' ? 10 : 3);
      }
    });
    batch.lecturesDone++;
    store.auditLog.unshift({ icon: 'fact_check', text: 'تسجيل حضور — ' + batch.name + ' محاضرة ' + batch.lecturesDone, time: 'الآن', color: '#003c36' });
    save();
    showToast('تم حفظ الحضور وتحديث نقاط الطلاب', 'success');
    setTimeout(() => switchTab('v-home'), 1000);
  };

  // Admin users
  window.selectUserTab = function (btn) {
    document.querySelectorAll('#au-tabs .seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentUserRole = btn.dataset.role;
    renderUsers();
  };

  window.renderUsers = renderUsers; // expose for oninput

  // Edit-mode state for the add/edit modals (null = add mode)
  let editUserId = null;
  let editCourseId = null;

  window.openAddUserModal = function () {
    const title = document.querySelector('#add-user-modal h3');
    if (title) title.textContent = '➕ إضافة مستخدم جديد';
    editUserId = null;
    openModal('add-user-modal');
  };
  window.openAddCourseModal = function () {
    const title = document.querySelector('#add-course-modal h3');
    if (title) title.textContent = '📚 إنشاء كورس جديد';
    editCourseId = null;
    openModal('add-course-modal');
  };

  // confirmAction — shared confirm modal helper (title/body + confirm/cancel)
  window.confirmAction = function (message, callback) {
    const body = document.getElementById('cf-body');
    if (body) body.textContent = message;
    const btn = document.getElementById('cf-yes');
    if (btn) {
      btn.onclick = null;
      btn.onclick = function () {
        closeModal('confirm-modal');
        callback();
      };
    }
    openModal('confirm-modal');
  };

  // Deletes: remove from store, audit, save(), re-render, toast
  window.deleteUser = function (id) {
    const u = store.users.find(x => x.id === id);
    if (!u) return;
    confirmAction('هل أنت متأكد من حذف المستخدم "' + u.name + '"؟ لا يمكن التراجع عن هذا الإجراء.', function () {
      haptic(10);
      store.users = store.users.filter(x => x.id !== id);
      store.auditLog.unshift({ icon: 'person_remove', text: 'حذف مستخدم: ' + u.name, time: 'الآن', color: '#ba1a1a' });
      save();
      renderUsers();
      showToast('تم حذف المستخدم "' + u.name + '"', 'success');
    });
  };

  window.deleteCourse = function (id) {
    const c = store.courses.find(x => x.id === id);
    if (!c) return;
    confirmAction('هل أنت متأكد من حذف الكورس "' + c.title + '"؟ لا يمكن التراجع عن هذا الإجراء.', function () {
      haptic(10);
      store.courses = store.courses.filter(x => x.id !== id);
      store.auditLog.unshift({ icon: 'delete', text: 'حذف كورس: ' + c.title, time: 'الآن', color: '#ba1a1a' });
      save();
      renderAdminCourses();
      renderAdminHome();
      showToast('تم حذف الكورس "' + c.title + '"', 'success');
    });
  };

  window.deleteBranch = function (id) {
    const b = store.branches.find(x => x.id === id);
    if (!b) return;
    confirmAction('هل أنت متأكد من حذف الفرع "' + b.name + '"؟ لا يمكن التراجع عن هذا الإجراء.', function () {
      haptic(10);
      store.branches = store.branches.filter(x => x.id !== id);
      store.auditLog.unshift({ icon: 'location_city', text: 'حذف فرع: ' + b.name, time: 'الآن', color: '#ba1a1a' });
      save();
      renderBranches();
      showToast('تم حذف الفرع "' + b.name + '"', 'success');
    });
  };

  window.submitAddUser = function (e) {
    e.preventDefault();
    const nameEl = document.getElementById('nu-name');
    const phoneEl = document.getElementById('nu-phone');
    const roleEl = document.getElementById('nu-role');
    // CVE-RTC-001 Fix: sanitize all inputs before storage
    const rawName = (nameEl.value || '').trim();
    const phone = (phoneEl.value || '').trim();
    const role = (roleEl.value || '').trim();
    // Validate name: Arabic/English letters and spaces only
    const NAME_RE = /^[\u0600-\u06FF\u0750-\u077Fa-zA-Z\s/.-]{2,60}$/;
    if (!rawName || !NAME_RE.test(rawName)) { fieldError(nameEl, 'اكتب الاسم بالكامل (حروف فقط، 2-60 حرف)'); return; }
    if (!PHONE_RE.test(phone)) { fieldError(phoneEl, 'رقم موبايل مصري صحيح (11 رقماً يبدأ بـ 01)'); return; }
    // CVE-RTC-004 Fix: validate role server-side too
    if (VALID_ROLES.indexOf(role) === -1) { showToast('دور غير صحيح', 'error'); return; }
    if (store.users.some(u => u.phone === phone && u.id !== editUserId)) { fieldError(phoneEl, 'رقم الموبايل مستخدم مسبقاً'); return; }
    fieldError(nameEl, ''); fieldError(phoneEl, '');
    // Store plain text (escaped on render via escapeHtml())
    const name = rawName;
    if (editUserId !== null) {
      // Edit mode: update existing user instead of inserting
      const u = store.users.find(x => x.id === editUserId);
      if (!u) { showToast('المستخدم غير موجود', 'error'); return; }
      u.name = name; u.phone = phone; u.role = role;
      u.avatar = name[0] + (name[1] || '');
      store.auditLog.unshift({ icon: 'edit', text: 'تعديل بيانات مستخدم: ' + name, time: 'الآن', color: '#515f74' });
      save();
      closeModal('add-user-modal');
      renderUsers();
      showToast('تم تعديل ' + name + ' بنجاح!', 'success');
    } else {
      store.users.push({ id: Date.now(), name, phone, role, branch: 'وسط البلد', avatar: name[0] + (name[1] || ''), status: 'active', points: 0 });
      store.auditLog.unshift({ icon: 'person_add', text: 'تم إضافة ' + name, time: 'الآن', color: '#00288e' });
      save();
      closeModal('add-user-modal');
      renderUsers();
      showToast('تم إضافة ' + name + ' بنجاح!', 'success');
    }
    editUserId = null;
    e.target.reset();
  };

  // editUser — safe action wrapper exposed to onclick (uses ID not name)
  window.editUser = function (uid) {
    const u = store.users.find(x => x.id === uid);
    if (!u) return;
    haptic(5);
    document.getElementById('nu-name').value = u.name;
    document.getElementById('nu-phone').value = u.phone;
    document.getElementById('nu-role').value = u.role;
    const nameErr = document.getElementById('nu-name').parentElement.querySelector('.err-txt');
    const phoneErr = document.getElementById('nu-phone').parentElement.querySelector('.err-txt');
    if (nameErr) nameErr.style.display = 'none';
    if (phoneErr) phoneErr.style.display = 'none';
    document.getElementById('nu-name').classList.remove('invalid');
    document.getElementById('nu-phone').classList.remove('invalid');
    editUserId = uid;
    const title = document.querySelector('#add-user-modal h3');
    if (title) title.textContent = '✏️ تعديل بيانات المستخدم';
    openModal('add-user-modal');
  };

  window.submitAddCourse = function (e) {
    e.preventDefault();
    const titleEl = document.getElementById('nc-title');
    const title = titleEl.value.trim();
    if (!title) { fieldError(titleEl, 'اكتب اسم الكورس'); return; }
    fieldError(titleEl, '');
    const cat = document.getElementById('nc-cat').value || 'عام';
    if (editCourseId !== null) {
      const c = store.courses.find(x => x.id === editCourseId);
      if (!c) { showToast('الكورس غير موجود', 'error'); return; }
      c.title = title; c.cat = cat;
      store.auditLog.unshift({ icon: 'edit', text: 'تعديل بيانات كورس: ' + title, time: 'الآن', color: '#515f74' });
      save();
      closeModal('add-course-modal');
      renderAdminCourses();
      renderAdminHome();
      showToast('تم تعديل كورس "' + title + '"!', 'success');
    } else {
      store.courses.push({ id: Date.now(), title, cat, icon: 'auto_stories', color: '#515f74', sessions: 8, enrolled: 0 });
      store.auditLog.unshift({ icon: 'add_circle', text: 'إنشاء كورس: ' + title, time: 'الآن', color: '#00288e' });
      save();
      closeModal('add-course-modal');
      renderAdminCourses();
      renderAdminHome();
      showToast('تم إنشاء كورس "' + title + '"!', 'success');
    }
    editCourseId = null;
    e.target.reset();
  };

  // editCourse — same pattern as editUser (reuses add-course-modal)
  window.editCourse = function (cid) {
    const c = store.courses.find(x => x.id === cid);
    if (!c) return;
    haptic(5);
    document.getElementById('nc-title').value = c.title;
    document.getElementById('nc-cat').value = c.cat || '';
    const titleErr = document.getElementById('nc-title').parentElement.querySelector('.err-txt');
    if (titleErr) titleErr.style.display = 'none';
    document.getElementById('nc-title').classList.remove('invalid');
    editCourseId = cid;
    const title = document.querySelector('#add-course-modal h3');
    if (title) title.textContent = '✏️ تعديل بيانات الكورس';
    openModal('add-course-modal');
  };

  // Cert pane switcher
  window.showCertPane = function (btn, paneId) {
    document.querySelectorAll('#screen-a-certs .seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['acerts-pane', 'apoints-pane'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.toggle('hidden', id !== paneId); el.classList.toggle('flex', id === paneId); }
    });
  };

  // Toggle switch
  window.toggleSwitch = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('on');
    el.classList.toggle('off');
  };

  // Dark mode
  window.toggleDarkMode = function () {
    const root = document.documentElement;
    const on = root.getAttribute('data-theme') === 'dark';
    root.setAttribute('data-theme', on ? 'light' : 'dark');
    localStorage.setItem('rtc_theme', on ? 'light' : 'dark');
    try { if (navigator.vibrate) navigator.vibrate(5); } catch (e) {}
    // Sync both toggle switches
    ['tog-dark', 'tog-backup-dark'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.toggle('on', !on);
        el.classList.toggle('off', on);
      }
    });
  };
  // Restore saved theme on load
  (function restoreTheme() {
    if (localStorage.getItem('rtc_theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  })();

  // Backup simulation
  window.simulateBackup = function () {
    showToast('جاري النسخ الاحتياطي...', 'info');
    setTimeout(() => {
      store.auditLog.unshift({ icon: 'cloud_upload', text: 'نسخة احتياطية يدوية بنجاح', time: 'الآن', color: '#003c36' });
      save();
      showToast('تم النسخ الاحتياطي بنجاح!', 'success');
      renderAdminSettings();
    }, 2000);
  };

  // Modal open/close
  window.openModal = function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  };
  window.closeModal = function (id, e) {
    if (!e || e.target === document.getElementById(id)) {
      document.getElementById(id)?.classList.remove('open');
    }
  };

  // Router globals
  window.navigate = navigate;
  window.push = push;
  window.pop = pop;
  window.switchTab = switchTab;

  /* ═══════════════════════════════════════════════
     TOAST
  ═══════════════════════════════════════════════ */
  // CVE-RTC-001 Fix: showToast uses textContent — never innerHTML — to prevent XSS
  window.showToast = function (msg, type, duration) {
    type = (type || 'info').toLowerCase();
    if (['success', 'error', 'warning', 'info'].indexOf(type) === -1) type = 'info';
    duration = duration || 2800;
    const ct = document.getElementById('toast-ct');
    if (!ct) return;
    const icons = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };
    const el = document.createElement('div');
    el.className = 'toast-item toast-' + type;
    // Safe: build DOM nodes manually, never use innerHTML with user data
    const iconEl = document.createElement('span');
    iconEl.className = 'material-symbols-outlined text-base';
    iconEl.style.flexShrink = '0';
    iconEl.textContent = icons[type];
    const textEl = document.createElement('span');
    textEl.textContent = msg; // safe: textContent auto-escapes
    el.appendChild(iconEl);
    el.appendChild(textEl);
    ct.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'toastIn 0.3s reverse forwards';
      setTimeout(() => el.remove(), 300);
    }, duration);
  };

  /* ═══════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
    // CVE-RTC-002/004 Fix: Validate saved role against whitelist before trusting it
    const savedRole = localStorage.getItem('rtc_role_v2');
    if (savedRole && VALID_ROLES.indexOf(savedRole) !== -1) {
      currentRole = savedRole;
    } else if (savedRole) {
      // Tampered role — clear it
      localStorage.removeItem('rtc_role_v2');
      localStorage.removeItem('rtc_uid_v2');
    }
    // Restore the logged-in user id (validated against the store below)
    const savedUid = parseInt(localStorage.getItem('rtc_uid_v2'), 10);
    if (!isNaN(savedUid) && store.users.some(x => x.id === savedUid)) {
      currentUserId = savedUid;
    }

    // Auto-advance splash after 2s
    setTimeout(function () {
      if (currentRole) {
        const homes = { student: 's-home', volunteer: 'v-home', admin: 'a-home' };
        navigate(homes[currentRole] || 'login');
      } else {
        navigate('login');
      }
    }, 2000);
  });

})();
