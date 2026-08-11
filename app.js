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
  var _otpCode = null;
  var _otpPhone = null;
  var _otpAttempts = 0;
  var _otpLocked = false;

  /* ═══════════════════════════════════════════════
     DATA STORE (ZERO PLACEHOLDERS - REAL DATA ONLY)
  ═══════════════════════════════════════════════ */
  const INITIAL = {
    users: [],
    courses: [
      { id: 1, title: 'اللغة الإنجليزية الشاملة والمحادثة (General English)', cat: 'قسم اللغات', icon: 'translate', color: '#00288e', sessions: 12, enrolled: 0, startDate: '2026-08-15', scheduleText: 'الأحد والثلاثاء 6م', location: 'قاعة 1 — فرع مصدق (الدقي)', description: 'دورة مكثفة لتنمية مهارات النطق والمحادثة والاستماع باللغة الإنجليزية مجاناً 100% بنية العلم النافع.', instructorId: null, maxStudents: 40 },
      { id: 2, title: 'أساسيات البرمجة وتطوير الويب (Web Development)', cat: 'قسم الكمبيوتر والتكنولوجيا', icon: 'code', color: '#003c36', sessions: 16, enrolled: 0, startDate: '2026-08-18', scheduleText: 'الأربعاء والجمعة 7م', location: 'معمل الحاسب — فرع مدينة نصر', description: 'تطبيق عملي لبناء المواقع باستخدام HTML, CSS, JavaScript وربط قواعد البيانات.', instructorId: null, maxStudents: 30 },
      { id: 3, title: 'التصميم الجرافيكي (Photoshop & Illustrator)', cat: 'قسم الكمبيوتر والتكنولوجيا', icon: 'palette', color: '#854d0e', sessions: 10, enrolled: 0, startDate: '2026-08-20', scheduleText: 'السبت 5م', location: 'معمل 2 — فرع 6 أكتوبر', description: 'تعليم قواعد التصميم ومعالجة الصور وإخراج الهويات البصرية للشباب والمتطوعين.', instructorId: null, maxStudents: 30 },
      { id: 4, title: 'الرخصة الدولية للياقة الحاسوبية (ICDL & Office)', cat: 'قسم الكمبيوتر والتكنولوجيا', icon: 'computer', color: '#1e40af', sessions: 10, enrolled: 0, startDate: '2026-08-16', scheduleText: 'الإثنين والخميس 4م', location: 'معمل 1 — فرع فيصل', description: 'شرح برنامج وورد، إكسيل، وباوربوينت لرفع الكفاءة الرقمية للطلاب.', instructorId: null, maxStudents: 45 },
      { id: 5, title: 'اللغة الألمانية للمبتدئين (Deutsch A1)', cat: 'قسم اللغات', icon: 'g_translate', color: '#00554e', sessions: 12, enrolled: 0, startDate: '2026-08-22', scheduleText: 'الأحد والأربعاء 5م', location: 'قاعة 3 — فرع المعادي', description: 'أساسيات قواعد ونطق وتواصل اللغة الألمانية مجاناً بالكامل.', instructorId: null, maxStudents: 25 },
      { id: 6, title: 'إدارة الأعمال والتسويق الرقمي (Digital Marketing)', cat: 'قسم التنمية البشرية والإدارية', icon: 'campaign', color: '#4338ca', sessions: 8, enrolled: 0, startDate: '2026-08-25', scheduleText: 'الجمعة 3عصراً', location: 'قاعة الأنشطة — فرع سموحة الإسكندرية', description: 'استراتيجيات التسويق عبر وسائل التواصل الاجتماعي وإنشاء الحملات الإعلانية الناجحة.', instructorId: null, maxStudents: 35 },
    ],
    batches: [],
    attendance: {},
    currentSession: { batchId: null, recs: {} },
    recordedSessions: [],
    profile: {},
    branches: [
      { id: 1, name: 'فرع مصدق (الدقي)', address: 'شارع مصدق، الدقي، الجيزة (19450)', halls: 5 },
      { id: 2, name: 'فرع فيصل (الطوابق)', address: 'شارع فيصل، محطة الطوابق، الجيزة', halls: 4 },
      { id: 3, name: 'فرع مدينة نصر', address: 'شارع عباس العقاد، مدينة نصر، القاهرة', halls: 6 },
      { id: 4, name: 'فرع المعادي', address: 'شارع النصر، المعادي، القاهرة', halls: 4 },
      { id: 5, name: 'فرع 6 أكتوبر', address: 'الحي المتميز، 6 أكتوبر، الجيزة', halls: 3 },
      { id: 6, name: 'فرع سموحة (الإسكندرية)', address: 'طريق الحرية، سموحة، الإسكندرية', halls: 4 },
    ],
    exports: [],
    certs: [],
    badges: [],
    leaderboard: [],
    notifications: [],
    auditLog: [],
    pointsRules: [
      { rule: 'حضور محاضرة', pts: 10, icon: 'event_available' },
      { rule: 'سلسلة 3 محاضرات', pts: 5, icon: 'local_fire_department' },
      { rule: 'إتمام كورس كامل', pts: 50, icon: 'school' },
      { rule: 'حضور متأخر', pts: 3, icon: 'schedule' },
      { rule: 'دعوة صديق', pts: 15, icon: 'person_add' },
    ],
  };

  const VALID_ROLES = ['student', 'volunteer', 'admin'];
  function validateStore(raw) {
    if (!raw || typeof raw !== 'object') return false;
    if (!Array.isArray(raw.users) || !Array.isArray(raw.courses) || !Array.isArray(raw.batches)) return false;
    return true;
  }

  let store = (function () {
    try {
      const rawV2 = localStorage.getItem('rtc_v2');
      if (rawV2 && (rawV2.includes('أحمد محمد عبد الله') || rawV2.includes('سارة أحمد'))) {
        localStorage.removeItem('rtc_v2');
        localStorage.removeItem('rtc_role_v2');
        localStorage.removeItem('rtc_onboarding_done');
      }

      const saved = JSON.parse(localStorage.getItem('rtc_v3_real'));
      if (saved && validateStore(saved) && Array.isArray(saved.users) && saved.users.length > 0) return saved;
      
      localStorage.removeItem('rtc_v2');
      return JSON.parse(JSON.stringify(INITIAL));
    } catch (e) {
      return JSON.parse(JSON.stringify(INITIAL));
    }
  })();

  function save() {
    try { localStorage.setItem('rtc_v3_real', JSON.stringify(store)); } catch (e) {}
  }

  function normalizeStore() {
    store.recordedSessions = store.recordedSessions || [];
    store.exports = store.exports || [];
    store.profile = store.profile || {};
    store.branches = store.branches || [];
    // rich course fields: default old courses so existing data still renders
    store.courses.forEach(c => {
      if (c.startDate === undefined) c.startDate = '2026-08-10';
      if (c.scheduleText === undefined) c.scheduleText = '';
      if (c.location === undefined) c.location = '';
      if (c.description === undefined) c.description = '';
      if (c.instructorId === undefined) c.instructorId = null;
      if (c.maxStudents === undefined) c.maxStudents = 30;
      if (c.enrolled === undefined) c.enrolled = 0;
      if (c.sessions === undefined) c.sessions = 8;
    });
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

  const ROLE_PREFIX = { student: 's-', volunteer: 'v-', admin: 'a-' };
  const PUBLIC = ['login', 'otp', 'splash'];
  // Shared screens reachable by any logged-in role (not role-prefixed).
  const SHARED_ROLE_SCREENS = ['guide', 'support'];

  function canAccess(id) {
    if (PUBLIC.indexOf(id) !== -1) return true;
    if (!currentRole) return false;
    if (SHARED_ROLE_SCREENS.indexOf(id) !== -1) return true;
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
    const doNav = () => {
      if (!_showOnly(id)) return;
      _showNav(id);
      _updateNavActive(id);
      renderScreen(id);
      _pushState(id);
    };
    if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(doNav);
    } else {
      doNav();
    }
  }

  function push(id) {
    id = guard(id);
    if (id === currentScreen) return; // guard: no double-push
    navStack.push(currentScreen);
    const doPush = () => {
      if (!_showOnly(id)) return;
      renderScreen(id);
      _pushState(id);
    };
    if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(doPush);
    } else {
      doPush();
    }
  }

  function pop() {
    // Fall back to the in-memory stack first (most reliable for SPA)
    if (navStack.length) {
      const prev = navStack.pop();
      const doPop = () => {
        if (!_showOnly(prev)) return;
        _showNav(prev);
        _updateNavActive(currentScreen);
        renderScreen(prev);
        try { history.back(); } catch (e) {}
      };
      if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.startViewTransition(doPop);
      } else {
        doPop();
      }
      return;
    }
    // Physical back if no in-memory stack
    if (history.state && history.state.screen) { history.back(); return; }
  }

  function switchTab(id) {
    haptic(5);
    // Reset navStack but keep a pointer to the tab home so browser-back from
    // a pushed child lands on the tab home, not on a stale pre-tab screen.
    navStack = [];
    navigate(id); // tabs pushState too, so back unwinds to home
  }

  window.addEventListener('popstate', function (e) {
    const id = (e.state && e.state.screen) || null;
    if (!id) return; // outside the app's history — let the browser leave
    // Re-run the route guard: after logout the role is cleared, and browser-back
    // must NOT re-show a protected screen (CVE-RTC-002 hardening).
    if (!canAccess(id)) {
      if (currentRole) {
        const safe = { student: 's-home', volunteer: 'v-home', admin: 'a-home' }[currentRole];
        _showOnly(safe);
        _updateNavActive(safe);
      } else {
        _showOnly('login');
        _showNav('login');
      }
      // Replace the guarded entry so the user doesn't loop on back
      try { history.replaceState({ screen: currentScreen }, '', '#/' + currentScreen); } catch (err) {}
      return;
    }
    // Keep the in-memory stack in sync (top == screen we're returning to).
    // Only pop when the entry we're landing on is still on the stack.
    if (navStack.length && navStack[navStack.length - 1] === id) navStack.pop();
    if (!_showOnly(id)) return;
    _updateNavActive(currentScreen);
    _showNav(id);
    renderScreen(id);
  });

  function _showNav(id) {
    const ns = document.getElementById('nav-student');
    const nv = document.getElementById('nav-volunteer');
    const na = document.getElementById('nav-admin');
    [ns, nv, na].forEach(n => n && n.classList.add('hidden'));
    // Guide is a clean full-screen intro — no bottom nav, regardless of role.
    if (id === 'guide') return;
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

  function hapticPattern(type) {
    try {
      if (!navigator.vibrate) return;
      if (type === 'success') navigator.vibrate([40, 40, 60, 40, 100]);
      else if (type === 'warning') navigator.vibrate([50, 50, 50]);
      else if (type === 'error') navigator.vibrate([100, 30, 100]);
      else navigator.vibrate(10);
    } catch (e) {}
  }

  function triggerCelebration() {
    hapticPattern('success');
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = [];
    const colors = ['#00288e', '#00554e', '#89f5e7', '#fbbf24', '#e0e7ff', '#f43f5e'];
    for (let i = 0; i < 75; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.8) * 16,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 10,
        alpha: 1
      });
    }
    const startTime = performance.now();
    function frame(now) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = false;
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4;
        p.rotation += p.rSpeed;
        p.alpha -= 0.015;
        if (p.alpha > 0) {
          active = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });
      if (active && now - startTime < 2500) {
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
      }
    }
    requestAnimationFrame(frame);
  }

  function formatArabicDate(d) {
    if (!d) d = new Date();
    if (typeof d === 'string') d = new Date(d);
    try {
      return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    } catch (e) {
      return (d instanceof Date ? d : new Date()).toISOString().slice(0, 10);
    }
  }

  // Ripple effect handler
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.ripple, .btn-3d, .btn-primary-3d, .btn-primary');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const circle = document.createElement('span');
    const diameter = Math.max(rect.width, rect.height);
    const radius = diameter / 2;
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - radius}px`;
    circle.style.top = `${e.clientY - rect.top - radius}px`;
    circle.classList.add('ripple-wave');
    const existing = btn.querySelector('.ripple-wave');
    if (existing) existing.remove();
    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
  });

  // Attribute-context sanitizers (style= / class=). escapeHtml alone cannot stop
  // `style="background:x"; onmouseover=...` — these force the value to a safe shape.
  function safeColor(v, fallback) {
    if (typeof v === 'string' && HEX_RE.test(v)) return v;
    return fallback || '#00288e';
  }
  function safeIcon(v) {
    if (typeof v === 'string' && ICON_RE.test(v)) return v;
    return 'auto_stories';
  }

  /* ═══════════════════════════════════════════════
     WHATSAPP DEEP LINKS
     wa.me builds are URL-encoded (encodeURIComponent) so the message
     can never break out of the href attribute (CVE-RTC-001 hardening).
  ═══════════════════════════════════════════════ */
  window.whatsappLink = function (phone, message) {
    const digits = String(phone || '').replace(/\D/g, '');
    return 'https://wa.me/' + digits.replace(/^0/, '20') + '?text=' + encodeURIComponent(message || '');
  };
  function whatsappIcon() {
    return '<svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a7.9 7.9 0 0 1-4.03-1.1l-.29-.17-3.12.82.83-3.04-.19-.3a8.23 8.23 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.01 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29z"/></svg>';
  }

  // Certificate share → WhatsApp (no recipient: opens WhatsApp's share-to-contact picker)
  window.shareCert = function () {
    const c = store.certs[0] || {};
    const msg = 'حصلت على شهادة إتمام كورس ' + (c.course || '') + ' من مسار RTC — جمعية رسالة. رقم التوثيق: ' + (c.no || '');
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  };

  function emptyState(icon, title, desc) {
    return '<div class="empty-state">' +
      '<div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">' +
      '<span class="material-symbols-outlined text-3xl text-outline">' + icon + '</span></div>' +
      '<div><p class="text-sm font-bold text-on-surface">' + title + '</p>' +
      '<p class="text-xs text-on-surface-variant mt-1 max-w-[240px]">' + desc + '</p></div></div>';
  }

  // Reusable loading state: disables a button and swaps its label for a spinner.
  // setBtnLoading(btn, loading, label): loading=true shows the spinner, false restores.
  // When called as setBtnLoading(btn, label) it engages loading and returns a reset() fn.
  function setBtnLoading(btn, loading, label) {
    if (!btn) return function () {};
    if (typeof loading === 'string') { label = loading; loading = true; }
    const origLabel = label || btn.dataset.origLabel || '';
    btn.dataset.origLabel = origLabel;
    if (!loading) {
      btn.disabled = false;
      btn.classList.remove('opacity-60');
      if (btn._btnLoadingOrig !== undefined) btn.innerHTML = btn._btnLoadingOrig;
      return;
    }
    if (btn._btnLoadingOrig === undefined) btn._btnLoadingOrig = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('opacity-60');
    btn.innerHTML = '<span class="material-symbols-outlined anim-spin text-base">progress_activity</span><span>' + escapeHtml(origLabel) + '</span>';
    return function () { setBtnLoading(btn, false); };
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

  // The demo app's "current" user is the first student in the store
  function currentStudent() {
    return store.users.find(u => u.role === 'student') || store.users[0];
  }

  function courseInstructor(c) {
    if (c && c.instructorId != null) {
      const u = store.users.find(x => x.id === c.instructorId);
      if (u) return u.name;
    }
    return '';
  }

  function currentBatch() {
    return store.batches.find(b => b.id === store.currentSession.batchId) || store.batches[0];
  }

  // Current volunteer (the trainer) + the batches they own (instructor name match)
  function currentVolunteer() {
    return store.users.find(u => u.role === 'volunteer') || null;
  }
  function volunteerBatches() {
    const v = currentVolunteer();
    const nm = v ? v.name : '';
    return store.batches.filter(b => b.instructor === nm);
  }

  // Attendance rate across all real student records
  function attendanceRate() {
    let total = 0, pres = 0;
    store.users.forEach(u => {
      if (u.role !== 'student') return;
      const recs = store.attendance[u.id] || [];
      recs.forEach(r => { total++; if (r.status === 'present' || r.status === 'late') pres++; });
    });
    return total ? Math.round(pres / total * 100) : 0;
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

  // Longest current streak of present/late sessions at the tail of attendance history
  function consecutiveStreak(studentId) {
    const recs = store.attendance[studentId] || [];
    let streak = 0;
    for (let i = recs.length - 1; i >= 0; i--) {
      if (recs[i].status === 'present' || recs[i].status === 'late') streak++;
      else break;
    }
    return streak;
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
      case 's-profile':       renderProfile();           break;
      case 's-leaderboard':   renderLeaderboard();       break;
      case 's-notifications': renderStudentNotifs();     break;
      case 's-explore':       renderExplore();           break;
      case 's-onboard':       renderStudentOnboard();    break;
      case 's-excuse':        renderExcuse();            break;
      case 'v-home':          renderVolHome();           break;
      case 'v-attendance':    renderVolAttendance();     break;
      case 'v-batches':       renderVolBatches();        break;
      case 'v-profile':       renderVolProfile();        break;
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
      case 'guide':           renderGuide();             break;
      case 'support':         renderSupport();           break;
      case 's-edit-profile':  renderEditProfile();       break;
      case 'v-edit-profile':  renderVolEditProfile();    break;
    }
  }

  // ── STUDENT HOME
  function renderStudentHome() {
    const me = store.users.find(u => u.role === 'student') || store.users[0];
    const st = attStats(me.id);
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('sh-student-name', (me.name || 'طالب').split(' ')[0] + ' 👋');
    setTxt('sh-att', st.pct + '%');
    setTxt('sh-pts', (me.points || 0));
    // Level from real points
    const lv = levelFromPoints(me.points || 0);
    setTxt('sh-level', lv.level + ' ⭐');
    // Real streak: consecutive present/late records at the tail of attendance history
    const streak = consecutiveStreak(me.id);
    setTxt('sh-streak', '🔥 ' + streak);
    // Attendance progress bar under the hero
    const bar = document.getElementById('sh-att-bar');
    if (bar) bar.style.width = st.pct + '%';
    // Mini courses preview — only enrolled courses
    const el = document.getElementById('sh-courses');
    if (el) {
      const mine = store.courses.filter(c => store.batches.some(b => b.courseId === c.id && b.studentIds.indexOf(me.id) !== -1));
      const list = mine.length ? mine : store.courses.slice(0, 2);
      el.innerHTML = list.map(c => `
        <button onclick="openCourseDetail(${c.id})" class="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 tap">
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
      const unlocked = store.badges.filter(b => b.unlocked).slice(0, 3);
      if (!unlocked.length) {
        bg.innerHTML = '<div class="flex-1 text-center text-xs text-on-surface-variant py-3">🔒 أكمل المحاضرات لفتح شاراتك الأولى</div>';
      } else {
        bg.innerHTML = unlocked.map(b => `
          <div class="flex-1 bg-white rounded-2xl p-3 shadow-sm flex flex-col items-center gap-1.5 text-center">
            <span class="text-2xl">${escapeHtml(b.icon)}</span>
            <p class="text-xs font-bold text-on-surface leading-tight">${escapeHtml(b.name)}</p>
          </div>
        `).join('');
      }
    }
  }

  // ── STUDENT COURSES
  function renderStudentCourses() {
    const el = document.getElementById('sc-list');
    if (!el) return;
    const me = currentStudent();
    // Only courses the current student is actually enrolled in (member of a course batch)
    const mine = store.courses.filter(c => store.batches.some(b => b.courseId === c.id && b.studentIds.indexOf(me.id) !== -1));
    if (!mine.length) { el.innerHTML = emptyState('book', 'لا توجد كورسات مسجلة', 'استكشف الكورسات المتاحة وسجّل في ما يناسبك'); return; }
    el.innerHTML = mine.map(c => {
      const pct = attStats(me.id).pct;
      const eligible = pct >= 75;
      const batch = store.batches.find(b => b.courseId === c.id);
      return `
        <button onclick="openCourseDetail(${c.id})" class="w-full bg-white rounded-2xl overflow-hidden shadow-sm tap">
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
              <span class="text-xs text-on-surface-variant">${batch ? batch.studentIds.length : 0} طالب</span>
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
    const me = store.users.find(u => u.role === 'student') || store.users[0];
    // Summary row counts from real records (unfiltered)
    const all = store.attendance[me.id] || [];
    const cnt = st => all.filter(r => r.status === st).length;
    const setTxt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    setTxt('sal-present', cnt('present'));
    setTxt('sal-absent', cnt('absent'));
    setTxt('sal-late', cnt('late'));
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
  // Global so inline onclick="enrollCourse(_viewCourseId)" can read it
  window._viewCourseId = null;
  window.openCourseDetail = function (courseId) {
    window._viewCourseId = courseId;
    push('s-course-detail');
  };

  function renderCourseDetail() {
    // Selected course (or first as fallback)
    const c = store.courses.find(x => x.id === _viewCourseId) || store.courses[0];
    if (!c) return;
    const me = currentStudent();
    const batch = store.batches.find(b => b.courseId === c.id);
    const enrolled = batch ? batch.studentIds.length : (c.enrolled || 0);
    const max = c.maxStudents || enrolled || 1;
    const isEnrolled = !!batch && batch.studentIds.indexOf(me.id) !== -1;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const inst = courseInstructor(c);
    const att = attStats(me.id);
    const attRecs = store.attendance[me.id] || [];
    const cnt = st => attRecs.filter(r => r.status === st).length;
    set('cd-title', c.title);
    set('cd-cat', c.cat);
    set('cd-pct', att.pct + '%');
    set('cd-sessions-count', cnt('present') + cnt('late'));
    set('cd-sessions-total', c.sessions);
    set('cd-present', '✓ ' + cnt('present') + ' حاضر');
    set('cd-absent', '✗ ' + cnt('absent') + ' غائب');
    set('cd-late', '⏰ ' + cnt('late') + ' متأخر');
    set('cd-start', c.startDate || '—');
    set('cd-schedule', c.scheduleText || '—');
    set('cd-location', c.location || '—');
    set('cd-instructor', inst || '—');
    set('cd-description', c.description || '');
    set('cd-count', enrolled + ' / ' + max);
    const ring = document.getElementById('cd-ring');
    if (ring) ring.setAttribute('stroke-dasharray', att.pct + ',100');
    // Enroll button: enrolled state → gone (opens my courses); free seats → enroll
    const btn = document.getElementById('cd-enroll-btn');
    if (btn) {
      if (isEnrolled) {
        btn.innerHTML = 'مسجّل بالفعل ✓';
        btn.disabled = true;
        btn.className = 'w-full h-12 rounded-2xl font-bold text-sm tap opacity-60 border border-outline-variant/40 bg-surface-container text-on-surface';
      } else if (enrolled >= max) {
        btn.innerHTML = 'العدد مكتمل';
        btn.disabled = true;
        btn.className = 'w-full h-12 rounded-2xl font-bold text-sm tap opacity-60 border border-error/30 bg-error/5 text-error';
      } else {
        btn.innerHTML = '<span class="material-symbols-outlined text-lg">how_to_reg</span><span>سجّل في الكورس</span>';
        btn.disabled = false;
        btn.className = 'w-full h-12 bg-primary text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg tap';
      }
    }
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
    const me = store.users.find(u => u.role === 'student') || store.users[0];
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

  // ── LEADERBOARD (real store.users points, sorted desc)
  function renderLeaderboard() {
    const el = document.getElementById('sl-list');
    if (!el) return;
    const me = currentStudent();
    // All students ranked by real points (ties broken by id for stable order)
    const ranked = store.users
      .filter(u => u.role === 'student')
      .sort((a, b) => (b.points || 0) - (a.points || 0) || a.id - b.id)
      .map((u, i) => ({ u, rank: i + 1, me: u.id === me.id }));
    if (!ranked.length) { el.innerHTML = emptyState('leaderboard', 'لا يوجد طلاب', 'لا توجد بيانات للترتيب بعد'); return; }
    const podium = ranked.slice(0, 3);
    // Podium: [1st on top (center/right in RTL), 2nd, 3rd]
    const medal = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const heights = { 1: 'h-24', 2: 'h-14', 3: 'h-10' };
    const podiumEl = document.getElementById('sl-podium');
    if (podiumEl) {
      const ordered = [podium[1], podium[0], podium[2]].filter(Boolean); // 2,1,3
      podiumEl.innerHTML = ordered.map(p => {
        const r = p.rank;
        const avatarCls = r === 1 ? 'w-16 h-16 text-2xl border-2 border-amber-300 shadow-lg' : 'w-14 h-14 text-xl border-2 border-white/30';
        const avatarBg = r === 1 ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.25)';
        return `
          <div class="flex flex-col items-center gap-2 flex-1">
            <div class="${avatarCls} rounded-full bg-white/25 flex items-center justify-center font-bold text-white" style="background:${avatarBg};">${escapeHtml(p.u.avatar)}</div>
            <p class="text-white text-xs font-bold text-center">${escapeHtml(p.u.name)}</p>
            <p class="text-white/65 text-xs">${p.u.points} ⭐</p>
            <div class="w-full ${heights[r]} bg-white/20 rounded-xl flex items-center justify-center text-2xl">${medal[r]}</div>
          </div>
        `;
      }).join('');
    }
    // List below podium (4th onward) + the me-highlighted card if I'm in top 3
    const below = ranked.slice(3);
    const topMe = ranked.slice(0, 3).filter(p => p.me);
    el.innerHTML = below.concat(topMe).map(p => `
      <div class="flex items-center gap-3 p-3 rounded-2xl ${p.me ? 'border border-primary/20' : 'bg-white shadow-sm'}" style="${p.me ? 'background:rgba(0,40,142,0.06);' : ''}">
        <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style="${p.me ? 'background:#00288e;color:#fff;' : 'background:#eceef0;color:#191c1e;'}">#${p.rank}</div>
        <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm" style="${p.me ? 'background:rgba(0,40,142,0.15);color:#191c1e;' : 'background:#d5e3fc;color:#191c1e;'}">${escapeHtml(p.u.avatar)}</div>
        <div class="flex-1">
          <p class="text-sm font-bold" style="color:${p.me ? '#00288e' : '#191c1e'}">${escapeHtml(p.u.name)}${p.me ? ' (أنت)' : ''}</p>
          <p class="text-xs text-on-surface-variant">${p.u.points} نقطة</p>
        </div>
        <span class="text-base">⭐</span>
      </div>
    `).join('');
    // My rank sticky footer
    const myRow = ranked.find(p => p.me);
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    if (myRow) {
      setTxt('sl-my-rank', '#' + myRow.rank);
      setTxt('sl-my-name', myRow.u.name + ' (أنت)');
      setTxt('sl-my-pts', myRow.u.points + ' نقطة');
      const delta = myRow.rank - 1; // how many are above me
      const deltaEl = document.getElementById('sl-my-delta');
      if (deltaEl) {
        deltaEl.textContent = delta > 0 ? ('تفوق على ' + delta + (delta === 1 ? ' طالب' : ' طلاب')) : 'أنت الأول 🏆';
      }
    }
  }

  // ── STUDENT CERTS
  function renderStudentCerts() {
    const el = document.getElementById('scerts-list');
    if (!el) return;
    const me = currentStudent();
    // Issued certs: match store.certs by course title against the student's courses
    const myCourses = store.courses.filter(c => store.batches.some(b => b.courseId === c.id && b.studentIds.indexOf(me.id) !== -1));
    const myCerts = store.certs.filter(c => myCourses.some(co => co.title === c.course));
    if (myCerts.length === 0) {
      el.innerHTML = emptyState('workspace_premium', 'لا توجد شهادات بعد', 'أكمل حضور الكورسات بنسبة 75% أو أكثر لإصدار شهادتك تلقائياً');
    } else {
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
    // Pending card: enrolled courses still below the 75% cert threshold
    const pendingEl = document.getElementById('scerts-pending');
    if (!pendingEl) return;
    const st = attStats(me.id);
    const pend = myCourses.filter(c => {
      const batch = store.batches.find(b => b.courseId === c.id && b.studentIds.indexOf(me.id) !== -1);
      const done = Math.min((store.attendance[me.id] || []).length, batch ? batch.lecturesDone : c.sessions);
      return done < c.sessions || st.pct < 75;
    }).filter(c => !myCerts.some(x => x.course === c.title));
    if (!pend.length) { pendingEl.innerHTML = ''; return; }
    pendingEl.innerHTML = pend.map(c => {
      const pct = st.pct;
      const batch = store.batches.find(b => b.courseId === c.id);
      const done = Math.min((store.attendance[me.id] || []).length, batch ? batch.lecturesDone : c.sessions);
      const needTotal = Math.ceil(0.75 * c.sessions);
      const needMore = Math.max(0, needTotal - done);
      return `
        <div class="bg-amber-50 rounded-2xl p-4 border border-amber-200">
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-amber-600">info</span>
            <div class="flex-1">
              <p class="text-sm font-bold text-on-surface">${escapeHtml(c.title)}</p>
              <p class="text-xs text-on-surface-variant mt-0.5">حضور: ${pct}% — المطلوب: 75% لإصدار الشهادة</p>
              <div class="h-1.5 bg-amber-200 rounded-full mt-2"><div class="h-full bg-amber-500 rounded-full" style="width:${Math.min(100, pct)}%;"></div></div>
              <p class="text-xs text-amber-700 font-semibold mt-1.5">${needMore > 0 ? 'تحتاج ' + needMore + ' محاضرات إضافية' : 'أكمل المحاضرات المتبقية للوصول للحد الأدنى'}</p>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── STUDENT PROFILE
  function renderProfile() {
    const me = currentStudent();
    if (!me) return;
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    // Enrolled course count = distinct courses in batches I belong to
    const enrolledCourses = store.courses.filter(c => store.batches.some(b => b.courseId === c.id && b.studentIds.indexOf(me.id) !== -1));
    setTxt('sp-courses', enrolledCourses.length);
    setTxt('sp-points', me.points || 0);
    const unlocked = store.badges.filter(b => b.unlocked).length;
    setTxt('sp-badges-count', unlocked);
    // Header name/branch/avatar (profile header ids added in index.html)
    setTxt('pf-name', me.name || 'طالب');
    setTxt('pf-branch', (me.branch || '') + (store.profile.branch ? ' — ' + store.profile.branch : ''));
    setTxt('pf-branch-detail', (me.branch || '') + ' — القاهرة');
    const avatar = document.getElementById('pf-avatar');
    if (avatar) avatar.textContent = me.avatar || (me.name || 'ط')[0];
    const phone = document.getElementById('pf-phone');
    if (phone) phone.textContent = me.phone || '';
  }

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
    const me = currentStudent();
    el.innerHTML = store.courses.map(c => {
      const batch = store.batches.find(b => b.courseId === c.id);
      const enrolled = batch ? batch.studentIds.length : (c.enrolled || 0);
      const max = c.maxStudents || enrolled || 1;
      const inst = courseInstructor(c);
      return `
      <div class="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${c.color}18;">
          <span class="material-symbols-outlined" style="color:${c.color};">${c.icon}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-on-surface text-sm">${escapeHtml(c.title)}</p>
          <p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(c.cat)} · ${c.sessions} محاضرات · يبدأ ${escapeHtml(c.startDate || '—')}</p>
          <p class="text-xs text-on-surface-variant mt-0.5 truncate">${escapeHtml(inst ? inst + ' · ' : '')}${escapeHtml(c.location || '')}</p>
          <p class="text-xs font-semibold mt-0.5" style="color:${c.color};">${enrolled} / ${max} مشترك</p>
        </div>
        <button onclick="openCourseDetail(${c.id})" class="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-full tap flex-shrink-0">التفاصيل</button>
      </div>
    `;
    }).join('');
  }

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
    const me = store.users.find(u => u.role === 'student') || store.users[0];
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

  // ── VOLUNTEER HOME (real stats + dynamic absence alert)
  function renderVolHome() {
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    // طلابي/حضروا/غائبون from this volunteer's batches (currentSession recs)
    const myBatches = volunteerBatches();
    const students = {};
    myBatches.forEach(b => b.studentIds.forEach(sid => { students[sid] = true; }));
    const ids = Object.keys(students).map(Number);
    let pres = 0, abs = 0;
    const recs = store.currentSession.recs || {};
    ids.forEach(sid => {
      if (recs[sid] === 'present' || recs[sid] === 'late') pres++;
      else if (recs[sid] === 'absent') abs++;
    });
    setTxt('vh-mine', ids.length);
    setTxt('vh-present', pres);
    setTxt('vh-absent', abs);
    // Absence alert (most-absent student across recorded sessions)
    const el = document.getElementById('vh-absence');
    if (!el) return;
    let worst = null, worstAbs = 0;
    store.users.forEach(u => {
      if (u.role !== 'student') return;
      const a = store.attendance[u.id] || [];
      const c = a.filter(r => r.status === 'absent').length;
      if (c > worstAbs) { worstAbs = c; worst = u; }
    });
    if (!worst || worstAbs === 0) { el.style.display = 'none'; return; }
    el.style.display = '';
    const nameEl = document.getElementById('vh-absence-name');
    if (nameEl) nameEl.textContent = worst.name + ' — غاب ' + worstAbs + ' مرات · دفعة A إنجليزي';
    const btn = document.getElementById('vh-absence-link');
    if (btn) btn.href = whatsappLink(worst.phone, 'مرحباً ' + worst.name + '، لاحظنا غيابك عن ' + worstAbs + ' محاضرات في دفعة A — نتمنى معرفة سبب الغياب ودعمك للمتابعة. فريق مسار RTC');
  }

  // ── VOLUNTEER PROFILE (dynamic — mirrors data from store)
  function renderVolProfile() {
    const v = currentVolunteer();
    if (!v) return;
    const batches = volunteerBatches();
    const totalStudents = batches.reduce((sum, b) => sum + b.studentIds.length, 0);
    const totalLectures = batches.reduce((sum, b) => sum + (b.lecturesDone || 0), 0);
    // Name / branch
    const nameEl = document.getElementById('vp-name');
    if (nameEl) nameEl.textContent = v.name;
    const branchEl = document.getElementById('vp-branch');
    if (branchEl) branchEl.textContent = v.branch || 'فرع وسط البلد';
    const avatarEl = document.getElementById('vp-avatar');
    if (avatarEl) avatarEl.textContent = v.avatar || v.name[0];
    // Stats
    const batchEl = document.getElementById('vp-batches');
    if (batchEl) batchEl.textContent = batches.length;
    const stuEl = document.getElementById('vp-students');
    if (stuEl) stuEl.textContent = totalStudents;
    const lctEl = document.getElementById('vp-lectures');
    if (lctEl) lctEl.textContent = totalLectures;
  }

  /* ── PROFILE EDIT (student + volunteer) */
  const AVATAR_CHOICES = ['أح', 'سا', 'مص', 'من', 'يو', 'نو', 'رك', 'لي', 'ها', 'رم'];
  const AVATAR_PALETTE = ['#00288e', '#1e40af', '#003c36', '#00554e', '#515f74', '#854d0e', '#7b1fa2', '#b45309', '#9d174d', '#0f766e'];
  const PROFILE_NAME_RE = /^[؀-ۿݐ-ݿa-zA-Z\s/.-]{2,60}$/;
  let pendingAvatar = '';

  function renderAvatarPicker(listId, currentAvatar) {
    const el = document.getElementById(listId);
    if (!el) return;
    pendingAvatar = currentAvatar || AVATAR_CHOICES[0];
    el.innerHTML = AVATAR_CHOICES.map((a, i) =>
      `<button type="button" class="avatar-opt ${a === pendingAvatar ? 'sel' : ''}" style="background:${AVATAR_PALETTE[i % AVATAR_PALETTE.length]};" data-av="${a}" onclick="pickAvatar(this,'${a}')" aria-pressed="${a === pendingAvatar}" aria-label="اختيار الصورة الرمزية ${a}">${a}</button>`).join('');
  }
  window.pickAvatar = function (btn, a) {
    haptic(5);
    pendingAvatar = a;
    const wrap = btn.closest('div');
    if (wrap) {
      wrap.querySelectorAll('.avatar-opt').forEach(b => {
        const on = b === btn;
        b.classList.toggle('sel', on);
        b.setAttribute('aria-pressed', String(on));
      });
    }
  };

  function renderEditProfile() {
    const me = currentStudent();
    if (!me) return;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('se-name', me.name || '');
    setVal('se-phone', me.phone || '');
    setVal('se-branch', me.branch || 'وسط البلد');
    renderAvatarPicker('se-avatars', me.avatar || 'أح');
  }
  window.saveProfileEdit = function () {
    const me = currentStudent();
    if (!me) return;
    const nameEl = document.getElementById('se-name');
    const phoneEl = document.getElementById('se-phone');
    const name = (nameEl.value || '').trim();
    const phone = (phoneEl.value || '').trim();
    const branch = (document.getElementById('se-branch').value || '').trim();
    if (!PROFILE_NAME_RE.test(name)) { fieldError(nameEl, 'اكتب الاسم بالكامل (حروف فقط، 2-60 حرف)'); return; }
    if (!PHONE_RE.test(phone)) { fieldError(phoneEl, 'رقم موبايل مصري صحيح (11 رقماً يبدأ بـ 01)'); return; }
    fieldError(nameEl, ''); fieldError(phoneEl, '');
    me.name = name; me.phone = phone; me.branch = branch;
    me.avatar = pendingAvatar || (name[0] + (name[1] || ''));
    store.auditLog.unshift({ icon: 'edit', text: 'تحديث الملف الشخصي (طالب): ' + name, time: 'الآن', color: '#00288e' });
    save();
    showToast('تم حفظ تعديلات ملفك', 'success');
    hapticPattern('success');
    setTimeout(() => pop(), 600);
  };

  function renderVolEditProfile() {
    const v = currentVolunteer();
    if (!v) return;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('ve-name', v.name || '');
    setVal('ve-phone', v.phone || '');
    setVal('ve-branch', v.branch || 'وسط البلد');
    renderAvatarPicker('ve-avatars', v.avatar || 'مح');
  }
  window.saveVolProfileEdit = function () {
    const v = currentVolunteer();
    if (!v) return;
    const nameEl = document.getElementById('ve-name');
    const phoneEl = document.getElementById('ve-phone');
    const name = (nameEl.value || '').trim();
    const phone = (phoneEl.value || '').trim();
    const branch = (document.getElementById('ve-branch').value || '').trim();
    if (!PROFILE_NAME_RE.test(name)) { fieldError(nameEl, 'اكتب الاسم بالكامل (حروف فقط، 2-60 حرف)'); return; }
    if (!PHONE_RE.test(phone)) { fieldError(phoneEl, 'رقم موبايل مصري صحيح (11 رقماً يبدأ بـ 01)'); return; }
    fieldError(nameEl, ''); fieldError(phoneEl, '');
    v.name = name; v.phone = phone; v.branch = branch;
    v.avatar = pendingAvatar || (name[0] + (name[1] || ''));
    // Batches taught by this volunteer keep their instructor name in sync
    store.batches.forEach(b => { if (b.instructor === v.name || !b.instructor) b.instructor = name; });
    store.auditLog.unshift({ icon: 'edit', text: 'تحديث الملف الشخصي (متطوع): ' + name, time: 'الآن', color: '#00554e' });
    save();
    showToast('تم حفظ تعديلات ملفك', 'success');
    hapticPattern('success');
    setTimeout(() => pop(), 600);
  };

  /* ── VOLUNTEER ATTENDANCE */
  function renderVolAttendance() {
    const el = document.getElementById('va-students');
    if (!el) return;
    const batch = currentBatch();
    const recs = store.currentSession.recs || {};
    if (!batch.studentIds.length) { el.innerHTML = emptyState('groups', 'لا يوجد طلاب في هذه الدفعة', 'أضف طلاباً من إدارة المستخدمين'); return; }
    el.innerHTML = batch.studentIds.map(sid => {
      const u = store.users.find(x => x.id === sid) || { name: userName(sid), avatar: '؟', phone: '' };
      const st = recs[sid] || null;
      const waHref = whatsappLink(u.phone, 'مرحباً ' + u.name + '، هذه رسالة من مدربك بخصوص دفعتك وحضورك في مسار RTC.');
      return `
        <div class="flex items-center gap-3 p-4" data-student="${sid}">
          <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center font-bold text-on-surface text-sm flex-shrink-0">${escapeHtml(u.avatar)}</div>
          <div class="flex-1 min-w-0">
            <p class="font-bold text-on-surface text-sm truncate">${escapeHtml(u.name)}</p>
          </div>
          <a href="${waHref}" target="_blank" rel="noopener" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 tap" style="background:rgba(0,136,63,0.1);" aria-label="تواصل واتساب">
            ${whatsappIcon()}
          </a>
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
  // Open the "إنشاء دفعة" modal (courses + student checkboxes populated on open)
  window.openAddBatchModal = function () {
    const sel = document.getElementById('nb-b-course');
    if (sel) {
      sel.innerHTML = '<option value="">اختر الكورس...</option>' + store.courses.map(c =>
        '<option value="' + c.id + '">' + escapeHtml(c.title) + '</option>').join('');
    }
    const st = document.getElementById('nb-b-students');
    if (st) {
      st.innerHTML = store.users.filter(u => u.role === 'student').map(u => `
        <label class="flex items-center gap-3 bg-surface-container-low rounded-xl px-3 py-2.5">
          <input type="checkbox" value="${u.id}" class="accent-primary w-4 h-4">
          <span class="text-sm font-medium text-on-surface">${escapeHtml(u.name)}</span>
        </label>`).join('');
    }
    openModal('add-batch-modal');
  };

  window.submitAddBatch = function (e) {
    e.preventDefault();
    const courseId = +(document.getElementById('nb-b-course').value);
    const name = (document.getElementById('nb-b-name').value || '').trim();
    const schedule = (document.getElementById('nb-b-schedule').value || '').trim();
    const location = (document.getElementById('nb-b-location').value || '').trim();
    if (!courseId) { showToast('اختر الكورس', 'error'); return; }
    if (!name) { showToast('اكتب اسم الدفعة', 'error'); return; }
    const boxes = document.querySelectorAll('#nb-b-students input:checked');
    if (!boxes.length) { showToast('اختر طالباً واحداً على الأقل', 'error'); return; }
    const studentIds = Array.prototype.map.call(boxes, b => +b.value);
    const course = store.courses.find(c => c.id === courseId);
    const v = currentVolunteer();
    store.batches.push({
      id: Date.now(), name, courseId, instructor: v ? v.name : '', schedule, location,
      studentIds, lecturesDone: 0
    });
    store.auditLog.unshift({ icon: 'add_circle', text: 'إنشاء دفعة جديدة: ' + name + (course ? ' (' + course.title + ')' : ''), time: 'الآن', color: '#00288e' });
    save();
    closeModal('add-batch-modal');
    renderVolBatches();
    showToast('تم إنشاء الدفعة "' + name + '"', 'success');
    e.target.reset();
  };

  function renderVolBatches() {
    const el = document.getElementById('vb-list');
    if (!el) return;
    if (!store.batches.length) { el.innerHTML = emptyState('groups', 'لا توجد دفعات', 'اضغط "إنشاء دفعة" لبدء أول دفعة'); return; }
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
    const batch = currentBatch();
    const el = document.getElementById('vrep-header');
    if (el) {
      const name = document.getElementById('vrep-batch-name');
      if (name) name.textContent = batch.name;
      const meta = document.getElementById('vrep-meta');
      if (meta) meta.textContent = 'المحاضرة ' + (batch.lecturesDone + 1) + ' · ' + new Date().toDateString();
    }
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
    const batch = currentBatch();
    store.auditLog.unshift({ icon: 'summarize', text: 'تقرير محاضرة — ' + batch.name + ' محاضرة ' + (batch.lecturesDone + 1) + ' (تقييم ' + vRating + '/5)', time: 'الآن', color: '#00288e' });
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
    const setKpi = (id, val, suffix) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (suffix) {
        // For percentage values, animate number then append suffix
        animCount(el, val, 850, suffix);
      } else {
        animCount(el, val);
      }
    };
    setKpi('kpi-s', store.users.filter(u => u.role === 'student').length);
    setKpi('kpi-c', store.courses.length);
    setKpi('kpi-b', store.batches.length);
    setKpi('kpi-cert', store.certs.length);
    setKpi('kpi-att', attendanceRate(), '%');
  }

  function animCount(el, target, duration, suffix) {
    if (!el) return;
    duration = duration || 850;
    suffix = suffix || '';
    const start = performance.now();
    const initialVal = 0;
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(initialVal + (target - initialVal) * eased) + suffix;
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
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
    const roleIcon = { student: 'school', volunteer: 'handshake', admin: 'settings' };
    const roleLabels = { student: 'طالب', volunteer: 'متطوع', admin: 'مشرف' };
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
      const waHref = whatsappLink(u.phone, 'مرحباً ' + u.name + '، رسالة من إدارة مسار RTC.');
      return `
      <div class="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <div class="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style="background:${escapeHtml(roleColors[u.role])};">${escapeHtml(u.avatar)}</div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-on-surface text-sm truncate">${escapeHtml(u.name)}</p>
          <p class="text-xs text-on-surface-variant mt-0.5" dir="ltr">${maskedPhone} &middot; ${escapeHtml(u.branch)}</p>
          <span class="text-xs font-semibold mt-1 inline-flex items-center gap-1" style="color:${escapeHtml(roleColors[u.role])}"><span class="material-symbols-outlined text-[13px]" aria-hidden="true">${roleIcon[u.role] || 'person'}</span>${escapeHtml(roleLabels[u.role])}</span>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <a href="${waHref}" target="_blank" rel="noopener" class="w-8 h-8 rounded-full flex items-center justify-center tap" style="background:rgba(0,136,63,0.1);" aria-label="تواصل واتساب">
            ${whatsappIcon()}
          </a>
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
      const cbs = store.batches.filter(b => b.courseId === c.id);
      const enrolled = cbs.reduce((n, b) => n + b.studentIds.length, 0) || (c.enrolled || 0);
      const max = c.maxStudents || enrolled || 1;
      const inst = courseInstructor(c);
      return `
        <div class="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div class="h-1.5" style="background:${c.color};"></div>
          <div class="p-4">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${c.color}18;">
                  <span class="material-symbols-outlined" style="color:${c.color};">${c.icon}</span>
                </div>
                <div><p class="font-bold text-on-surface text-sm">${escapeHtml(c.title)}</p><p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(c.cat)} · ${c.sessions} محاضرات</p>
                <p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(inst ? inst + ' · ' : '')}${escapeHtml(c.location || '')}</p></div>
              </div>
              <div class="flex items-center gap-1">
                <button onclick="editCourse(${c.id})" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center tap"><span class="material-symbols-outlined text-sm text-on-surface-variant">edit</span></button>
                <button onclick="deleteCourse(${c.id})" class="w-8 h-8 rounded-full flex items-center justify-center tap" style="background:rgba(186,26,26,0.08);"><span class="material-symbols-outlined text-sm" style="color:#ba1a1a;">delete</span></button>
              </div>
            </div>
            <div class="flex gap-3 border-t border-outline-variant/30 pt-3">
              <div class="flex-1 text-center"><p class="text-lg font-bold text-on-surface">${enrolled}<span class="text-xs font-semibold text-on-surface-variant">/${max}</span></p><p class="text-xs text-on-surface-variant">مسجل / سعة</p></div>
              <div class="w-px bg-outline-variant/40"></div>
              <div class="flex-1 text-center"><p class="text-lg font-bold text-on-surface">${escapeHtml((c.startDate || '').slice(0, 10))}</p><p class="text-xs text-on-surface-variant">بداية</p></div>
              <div class="w-px bg-outline-variant/40"></div>
              <div class="flex-1 text-center"><p class="text-lg font-bold text-on-surface">${cbs.length}</p><p class="text-xs text-on-surface-variant">دفعة</p></div>
            </div>
            <div class="flex gap-2 mt-3">
              <button onclick="openCourseBatches(${c.id})" class="flex-1 h-9 bg-primary/10 text-primary rounded-xl text-xs font-bold tap">دفعات (${cbs.length})</button>
              <button onclick="editCourse(${c.id})" class="flex-1 h-9 bg-surface-container text-on-surface rounded-xl text-xs font-bold tap">تعديل</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── ADMIN COURSE BATCHES (view/edit the batches of a course)
  window.openCourseBatches = function (courseId) {
    const c = store.courses.find(x => x.id === courseId);
    if (!c) return;
    haptic(5);
    const t = document.getElementById('cbm-title');
    if (t) t.textContent = 'دفعات الكورس — ' + c.title;
    const list = document.getElementById('cbm-list');
    const cbs = store.batches.filter(b => b.courseId === courseId);
    if (!cbs.length) { list.innerHTML = emptyState('groups', 'لا توجد دفعات', 'لم تُنشأ أي دفعة لهذا الكورس بعد'); openModal('course-batches-modal'); return; }
    list.innerHTML = cbs.map(b => `
      <div class="bg-white rounded-2xl p-4 shadow-sm">
        <div class="flex items-start justify-between">
          <div>
            <p class="font-bold text-on-surface text-sm">${escapeHtml(b.name)}</p>
            <p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(b.schedule)} · ${escapeHtml(b.location)}</p>
            <p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(b.instructor)}</p>
          </div>
          <span class="text-xs font-bold px-2 py-1 rounded-full" style="background:rgba(0,85,78,0.1);color:#00554e;">${b.studentIds.length} طالب</span>
        </div>
        <div class="flex gap-2 mt-3">
          <button onclick="viewBatchStudents(${b.id})" class="flex-1 h-9 bg-primary/10 text-primary rounded-xl text-xs font-bold tap">عرض الطلاب</button>
          <button onclick="editBatch(${b.id})" class="flex-1 h-9 bg-surface-container text-on-surface rounded-xl text-xs font-bold tap">تعديل</button>
        </div>
      </div>
    `).join('');
    openModal('course-batches-modal');
  };

  window.viewBatchStudents = function (id) {
    const b = store.batches.find(x => x.id === id);
    if (!b) return;
    const names = b.studentIds.map(sid => { const u = store.users.find(x => x.id === sid); return u ? u.name : 'طالب'; });
    showToast(b.name + ': ' + names.join('، '), 'info', 4000);
  };

  // Edit a batch's roster/schedule via a reused prompt-style mini form in the same modal
  window.editBatch = function (id) {
    const b = store.batches.find(x => x.id === id);
    if (!b) return;
    const list = document.getElementById('cbm-list');
    const opts = store.users.filter(u => u.role === 'student').map(u =>
      '<label class="flex items-center gap-2 px-2 py-1"><input type="checkbox" class="cbm-chk accent-primary" value="' + u.id + '"' + (b.studentIds.indexOf(u.id) !== -1 ? ' checked' : '') + '><span class="text-xs font-medium text-on-surface">' + escapeHtml(u.name) + '</span></label>').join('');
    list.innerHTML = `
      <div class="bg-white rounded-2xl p-4 shadow-sm">
        <p class="font-bold text-on-surface text-sm">تعديل دفعة — ${escapeHtml(b.name)}</p>
        <div class="flex flex-col gap-2 mt-3 max-h-56 overflow-y-auto">${opts}</div>
        <button onclick="saveBatchEdit(${b.id})" class="mt-4 w-full h-11 bg-primary text-white font-bold text-sm rounded-xl tap">حفظ التعديل</button>
      </div>`;
  };

  window.saveBatchEdit = function (id) {
    const b = store.batches.find(x => x.id === id);
    if (!b) return;
    b.studentIds = Array.prototype.map.call(document.querySelectorAll('#cbm-list .cbm-chk:checked'), c => +c.value);
    store.auditLog.unshift({ icon: 'edit', text: 'تعديل دفعة: ' + b.name, time: 'الآن', color: '#515f74' });
    save();
    const course = store.courses.find(c => c.id === b.courseId);
    if (course) openCourseBatches(course.id); else closeModal('course-batches-modal');
    showToast('تم حفظ تعديل الدفعة', 'success');
  };

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
            <div class="text-left flex-shrink-0 flex items-center gap-2">
              <div>
                <p class="text-xs text-on-surface-variant">${escapeHtml(c.date)}</p>
                <p class="text-sm font-bold text-on-surface mt-0.5">${c.att}%</p>
              </div>
              <button onclick="deleteCert(${c.id})" class="w-8 h-8 rounded-full flex items-center justify-center tap" style="background:rgba(186,26,26,0.08);" aria-label="إلغاء الشهادة">
                <span class="material-symbols-outlined text-sm" style="color:#ba1a1a;">delete</span>
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }

    const pel = document.getElementById('apoints-list');
    if (pel) {
      pel.innerHTML = store.pointsRules.map(r => `
        <div class="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-outlined text-primary">${r.icon}</span>
          </div>
          <p class="flex-1 text-sm font-semibold text-on-surface">${r.rule}</p>
          <div class="flex items-center gap-2">
            <input type="number" value="${r.pts}" class="w-14 h-9 bg-surface-container rounded-xl text-center text-sm font-bold text-on-surface outline-none border border-outline-variant/40">
            <span class="text-xs text-on-surface-variant font-semibold">نقطة</span>
          </div>
        </div>
      `).join('');
    }
  }

  window.deleteCert = function (id) {
    const c = store.certs.find(x => x.id === id);
    if (!c) return;
    confirmAction('هل أنت متأكد من إلغاء/حذف الشهادة رقم "' + c.no + '" لـ ' + c.student + '؟', function () {
      haptic(10);
      store.certs = store.certs.filter(x => x.id !== id);
      store.auditLog.unshift({ icon: 'delete', text: 'إلغاء شهادة: ' + c.no + ' — ' + c.student, time: 'الآن', color: '#ba1a1a' });
      save();
      renderAdminCerts();
      showToast('تم إلغاء الشهادة', 'success');
    });
  };

  window.issueCertsForEligible = function () {
    let count = 0;
    store.users.filter(u => u.role === 'student').forEach(u => {
      const stats = attStats(u.id);
      if (stats.pct >= 75) {
        store.courses.forEach(course => {
          const isEnrolled = store.batches.some(b => b.courseId === course.id && b.studentIds.indexOf(u.id) !== -1);
          if (isEnrolled) {
            const existing = store.certs.find(c => c.student === u.name && c.course === course.title);
            if (!existing) {
              const certNo = 'RTC-' + new Date().getFullYear() + '-' + String(Math.floor(100000 + Math.random() * 900000));
              store.certs.push({
                id: Date.now() + Math.random(),
                student: u.name,
                course: course.title,
                date: formatArabicDate(new Date()),
                no: certNo,
                att: stats.pct,
                status: 'issued'
              });
              count++;
            }
          }
        });
      }
    });
    if (count > 0) {
      triggerCelebration();
      save();
      renderAdminCerts();
      showToast('تم إصدار ' + count + ' شهادة جديدة للمستوفين الشروط 🎉', 'success');
    } else {
      showToast('لا يوجد طلاب مستوفين الجدد ينقصهم شهادات حالياً', 'info');
    }
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
    if (!store.exports || !store.exports.length) { el.innerHTML = emptyState('description', 'لا توجد تقارير مصدّرة بعد', 'صدّر تقرير حضور أو شهادات وستظهر نسخه هنا'); return; }
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

  window.exportPdf = function () {
    const batch = currentBatch();
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text("RTC Masar - Attendance Report", 14, 20);
        doc.setFontSize(11);
        doc.text("Batch: " + (batch.name || 'General'), 14, 30);
        doc.text("Instructor: " + (batch.instructor || 'N/A'), 14, 37);
        doc.text("Date: " + today, 14, 44);
        doc.text("Total Students: " + batch.studentIds.length, 14, 51);
        
        let y = 65;
        doc.setFontSize(10);
        doc.text("Student ID / Name", 14, y);
        doc.text("Attended", 110, y);
        doc.text("Total", 145, y);
        doc.text("Rate (%)", 175, y);
        doc.line(14, y + 2, 195, y + 2);
        
        y += 10;
        batch.studentIds.forEach(sid => {
          const st = attStats(sid);
          const name = userName(sid);
          doc.text(String(name), 14, y);
          doc.text(String(st.pres), 110, y);
          doc.text(String(st.total), 145, y);
          doc.text(st.pct + "%", 175, y);
          y += 8;
          if (y > 270) { doc.addPage(); y = 20; }
        });
        doc.save("Attendance-Report-" + batch.id + "-" + today + ".pdf");
        showToast('تم إصداره وتنزيله كملف PDF بنجاح! 📄', 'success');
      } else {
        window.print();
        showToast('تم فتح نافذة الطباعة / التصدير 📄', 'info');
      }
    } catch (e) {
      showToast('تم إنشاء نسخة التقرير', 'info');
    }
    store.exports = store.exports || [];
    store.exports.unshift({ icon: 'picture_as_pdf', title: 'تصدير PDF — ' + batch.name, time: 'الآن', size: batch.studentIds.length + ' صف' });
    save();
    renderExport();
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
  window.sendBroadcast = function (btn) {
    const sel = Array.prototype.slice.call(document.querySelectorAll('#ab-audience button.active')).map(b => b.dataset.aud);
    const title = (document.getElementById('ab-title').value || '').trim();
    const body = (document.getElementById('ab-body').value || '').trim();
    const type = document.getElementById('ab-type').value;
    if (!sel.length) { showToast('اختر الجمهور المستهدف', 'error'); return; }
    if (!body) { showToast('اكتب نص الرسالة', 'error'); return; }
    const reset = setBtnLoading(btn, 'إرسال التنبيه');
    // Resolve the selected audience to real student phones
    const targets = [];
    sel.forEach(id => {
      if (id === 'all-students') {
        store.users.forEach(u => { if (u.role === 'student') targets.push(u); });
      } else {
        const b = store.batches.find(x => 'b' + x.id === id);
        if (b) b.studentIds.forEach(sid => {
          const u = store.users.find(x => x.id === sid);
          if (u) targets.push(u);
        });
      }
    });
    // Deduplicate by phone (a student can be in several selected batches)
    const seen = {};
    const audience = targets.filter(u => { const k = u.phone; return seen[k] ? false : (seen[k] = true); });
    if (type === 'whatsapp') {
      audience.forEach(u => window.open(whatsappLink(u.phone, body), '_blank', 'noopener'));
      store.auditLog.unshift({ icon: 'notifications_active', text: 'إرسال واتساب جماعي لـ ' + audience.length + ' طالب', time: 'الآن', color: '#00288e' });
      save();
      reset();
      showToast('تم فتح ' + audience.length + ' محادثة واتساب', 'success');
      setTimeout(() => pop(), 900);
      return;
    }
    const n = audience.length;
    store.notifications.unshift({ id: Date.now(), icon: 'notifications_active', title: title || 'تنبيه من الإدارة', body, time: 'الآن', unread: true });
    store.auditLog.unshift({ icon: 'notifications_active', text: 'إرسال تنبيه جماعي (' + type + ') لـ ' + n + ' طالب', time: 'الآن', color: '#00288e' });
    save();
    reset();
    showToast('أُرسل التنبيه لـ ' + n + ' طالب', 'success');
    setTimeout(() => pop(), 900);
  };

  /* ── ADMIN SETTINGS */
  function renderAdminSettings() {
    const el = document.getElementById('as-audit');
    if (!el) return;
    if (!store.auditLog.length) { el.innerHTML = emptyState('history', 'لا توجد عمليات مسجلة بعد', 'ستظهر كل العمليات والإجراءات هنا'); return; }
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
    ['o1','o2','o3','o4','o5','o6'].forEach(id => {
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
    const homes = { student: 's-home', volunteer: 'v-home', admin: 'a-home' };
    // First-run: route through the guide (3-slide intro + role + consent) before home
    if (!onboardingDone()) {
      navigate('guide');
      showToast('مرحباً! اطّلع على دليل التطبيق', 'info');
      return;
    }
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
    // Collect OTP digits from the 6 input boxes (ids are o1..o6 in index.html)
    const digits = ['o1','o2','o3','o4','o5','o6']
      .map(id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; })
      .join('');

    if (digits.length < 4) { showToast('أدخل الكود كاملاً', 'error'); return; }

    // OTP verification: only the server-generated code is valid.
    // No master codes, no last-4-digits fallback (CVE-RTC-002 fix).
    const valid = !!_otpCode && digits === _otpCode;

    if (!valid) {
      _otpAttempts++;
      if (_otpAttempts >= 3) {
        _otpLocked = true;
        showToast('3 محاولات فاشلة. أعد إرسال الكود.', 'error');
        ['o1','o2','o3','o4','o5','o6'].forEach(id => {
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
    const homes = { student: 's-home', volunteer: 'v-home', admin: 'a-home' };
    // First-run: guide explains the app before entering the portal (role stays as chosen)
    if (!onboardingDone()) {
      navigate('guide');
      showToast('تم التحقق بنجاح!', 'success');
      return;
    }
    navigate(homes[currentRole] || 's-home');
    showToast('تم التحقق بنجاح!', 'success');
  };

  window.handleLogout = function () {
    currentRole = null;
    localStorage.removeItem('rtc_role_v2');
    localStorage.removeItem('rtc_onboarding_done');
    navStack = [];
    navigate('onboarding');
    showToast('تم تسجيل الخروج', 'info');
  };

  // ═══════════════════════════════════════════════
  // ONBOARDING / FIRST-RUN GUIDE (3-slide intro)
  // Shown once after first login. Guide explains the app
  // (attendance / points & badges / privacy) with icons,
  // lets the user confirm their role, and takes consent.
  // ═══════════════════════════════════════════════
  function onboardingDone() {
    try { return localStorage.getItem('rtc_onboarded_v2') === '1'; } catch (e) { return true; }
  }
  function markOnboardingDone() {
    try { localStorage.setItem('rtc_onboarded_v2', '1'); } catch (e) {}
  }

  const GUIDE_SLIDES = [
    { icon: 'event_available', iconBg: 'rgba(0,40,142,0.12)', iconColor: '#00288e', title: 'تابِع حضورك بسهولة', body: 'سجّل حضور المحاضرات وشاهد نسب حضورك ومحاضراتك الجارية من مكان واحد. المتطوعون دوّنوا الحضور فورياً.' },
    { icon: 'workspace_premium', iconBg: 'rgba(0,85,78,0.12)', iconColor: '#00554e', title: 'اجمع النقاط والشارات', body: 'نقاطك تتراكم تلقائياً مع كل حضور. اربح شارات وأُصب متفوقاً على لوحة الصدارة، ثم انهِ كورسك لنيل الشهادة.' },
    { icon: 'verified_user', iconBg: 'rgba(134,77,14,0.12)', iconColor: '#854d0e', title: 'خصوصيتك أولوية', body: 'بياناتك آمنة ولن تشارك إلا مع مدربيك. يمكنك طلب عذر الغياب والإبلاغ عن أي مشكلة من شاشة الدعم.' },
  ];
  let guideSlideIndex = 0;

  function renderGuide() {
    guideSlideIndex = 0; // always open the guide at the first slide
    const wrap = document.getElementById('guide-slider');
    if (!wrap) return;
    wrap.innerHTML = GUIDE_SLIDES.map((s, i) => `
      <div class="guide-slide ${i === guideSlideIndex ? 'active' : ''}" data-slide="${i}">
        <div class="guide-icon"><span class="material-symbols-outlined" style="color:${s.iconColor};font-size:44px;">${s.icon}</span></div>
        <h2 class="text-xl font-bold text-on-surface mt-6 animate-pop">${escapeHtml(s.title)}</h2>
        <p class="text-on-surface-variant text-sm leading-relaxed mt-3 px-2">${escapeHtml(s.body)}</p>
      </div>
    `).join('');
    const dots = document.getElementById('guide-dots');
    if (dots) dots.innerHTML = GUIDE_SLIDES.map((_, i) =>
      `<span class="guide-dot ${i === guideSlideIndex ? 'on' : ''}" data-dot="${i}"></span>`).join('');
    // Prefill the role/consent states
    const roleName = { student: 'طالب', volunteer: 'متطوع', admin: 'مشرف' }[currentRole] || 'طالب';
    const roleEl = document.getElementById('guide-role');
    if (roleEl && roleEl.textContent !== roleName) roleEl.textContent = roleName;
    const c1 = document.getElementById('guide-consent');
    if (c1) { c1.checked = false; }
    // Reset the slideshow to the first slide with a fresh CTA state
    guideSlideIndex = 0;
    const card = document.getElementById('guide-consent-card');
    if (card) card.classList.add('hidden');
    const cta = guideCta();
    if (cta) { cta.textContent = 'التالي'; cta.classList.remove('guide-cta-finish'); cta.classList.remove('opacity-50'); }
    const hint = guideHint();
    if (hint) hint.textContent = 'مرّروا للاطلاع على الدليل';
  }

  function guideCta() { return document.getElementById('guide-cta'); }
  function guideHint() { return document.getElementById('guide-hint'); }

  window.goToSlide = function (i) {
    haptic(8);
    const n = GUIDE_SLIDES.length;
    guideSlideIndex = Math.max(0, Math.min(i, n - 1));
    const wrap = document.getElementById('guide-slider');
    if (wrap) {
      Array.prototype.slice.call(wrap.children).forEach((el, idx) => {
        el.classList.toggle('active', idx === guideSlideIndex);
      });
    }
    const dots = document.getElementById('guide-dots');
    if (dots) {
      Array.prototype.slice.call(dots.children).forEach((el, idx) => {
        el.classList.toggle('on', idx === guideSlideIndex);
      });
    }
    // Consent card + CTA tune by slide
    const card = document.getElementById('guide-consent-card');
    const cta = guideCta();
    const hint = guideHint();
    if (guideSlideIndex < n - 1) {
      if (card) card.classList.add('hidden');
      if (cta) { cta.textContent = 'التالي'; cta.classList.remove('guide-cta-finish'); }
      if (hint) hint.textContent = 'مرّروا للاطلاع على الدليل';
    } else {
      if (card) card.classList.remove('hidden');
      if (cta) { cta.textContent = 'بدء الرحلة'; cta.classList.add('guide-cta-finish'); }
      if (hint) hint.textContent = 'وافق على الخصوصية لبدء التجربة';
    }
  };
  window.toggleConsent = function (chk) {
    const on = !!chk && chk.checked;
    // Visually brighten the final CTA once consent is given (guideNext guards the click).
    const cta = guideCta();
    if (cta && cta.textContent.trim() === 'بدء الرحلة') cta.classList.toggle('opacity-50', !on);
    haptic(on ? 6 : 3);
  };
  window.guideNext = function () {
    const n = GUIDE_SLIDES.length;
    const cta = guideCta();
    if (guideSlideIndex < n - 1) {
      window.goToSlide(guideSlideIndex + 1);
    } else {
      // On the last slide the CTA is "بدء الرحلة" — require consent then enter.
      const c1 = document.getElementById('guide-consent');
      if (!c1 || !c1.checked) {
        showToast('يرجى الموافقة على سياسة الخصوصية أولاً', 'warning');
        hapticPattern('warning');
        return;
      }
      markOnboardingDone();
      const homes = { student: 's-home', volunteer: 'v-home', admin: 'a-home' };
      navigate(homes[currentRole] || 's-home');
      showToast('أهلاً بك في مسار RTC 🎉', 'success');
      hapticPattern('success');
    }
  };
  window.guideSkip = function () {
    markOnboardingDone();
    const homes = { student: 's-home', volunteer: 'v-home', admin: 'a-home' };
    navigate(homes[currentRole] || 's-home');
    showToast('أتممت الدليل', 'success');
    haptic(10);
  };

  // ═══════════════════════════════════════════════
  // SUPPORT — HELP + FAQ + REPORT A PROBLEM
  // Shared screen for every role.
  // ═══════════════════════════════════════════════
  const FAQ_ITEMS = [
    { q: 'كيف أحسب نسبة حضوري؟', a: 'نسبة الحضور تُحسب تلقائياً من سجل محاضراتك (حاضر/متأخر/غائب). تجدها في الصفحة الرئيسية وتفاصيل كل كورس.' },
    { q: 'كيف أحصل على الشهادة؟', a: 'أكمل 75% حضوراً على الأقل في الكورس. تظهر شهادتك جاهزة في صفحة "الشهادات" مع رمز تحقق QR قابلاً للتحميل.' },
    { q: 'كيف أطلب عذر غياب؟', a: 'من بروفايلك اضغط "طلب عذر غياب"، اختر المحاضرة المتغيّبة وارفع المستند الداعم. تتم مراجعته من المتطوع.' },
    { q: 'الوضع الليلي لا يعمل؟', a: 'افتح بروفايلك وفعّل "الوضع الليلي". يُحفظ اختيارك ويُطبّق تلقائياً في الزيارات التالية.' },
    { q: 'كيف أتواصل مع مدربي؟', a: 'من شاشة الحضور لدى المتطوع، أو عبر زر واتساب في الزاوية أعلى شاشة الدعم هذه للتواصل الفوري.' },
    { q: 'بياناتي في غير مكانها؟', a: 'اطلب من المتطوع تعديل ملفك، أو أرسل إلينا بلاغاً من تبويب "إبلاغ عن مشكلة" وسنصححها.' },
  ];

  function renderSupport() {
    // Reset the accordion + tabs every time it's opened
    window.supTab && supTab('help');
    const faq = document.getElementById('faq-list');
    if (faq) {
      faq.innerHTML = FAQ_ITEMS.map((f, i) => `
        <div class="faq-item" data-faq="${i}">
          <button type="button" class="faq-q tap" onclick="supFaq(this)">
            <span>${escapeHtml(f.q)}</span>
            <span class="material-symbols-outlined text-outline faq-chev">expand_more</span>
          </button>
          <div class="faq-a">${escapeHtml(f.a)}</div>
        </div>`).join('');
    }
    // Reset the report form to a fresh state
    const form = document.getElementById('report-form');
    const success = document.getElementById('report-success');
    if (form) form.classList.remove('hidden');
    if (success) success.classList.add('hidden');
    const desc = document.getElementById('rp-desc');
    if (desc) desc.value = '';
    const type = document.getElementById('rp-type');
    if (type) type.selectedIndex = 0;
  }

  window.supTab = function (tab) {
    haptic(5);
    const help = document.getElementById('sup-help');
    const report = document.getElementById('sup-report');
    const tHelp = document.getElementById('sup-tab-help');
    const tRep = document.getElementById('sup-tab-report');
    if (tab === 'report') {
      if (help) help.classList.add('hidden');
      if (report) report.classList.remove('hidden');
      if (tHelp) { tHelp.classList.remove('active'); tHelp.classList.add('text-on-surface-variant'); }
      if (tRep) { tRep.classList.add('active'); tRep.classList.remove('text-on-surface-variant'); }
    } else {
      if (report) report.classList.add('hidden');
      if (help) help.classList.remove('hidden');
      if (tRep) { tRep.classList.remove('active'); tRep.classList.add('text-on-surface-variant'); }
      if (tHelp) { tHelp.classList.add('active'); tHelp.classList.remove('text-on-surface-variant'); }
    }
  };

  window.supFaq = function (btn) {
    haptic(5);
    const item = btn.closest('.faq-item');
    const wasOpen = item.classList.contains('open');
    // Close all, then open the tapped one (single-open accordion)
    document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
    if (!wasOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    } else {
      btn.setAttribute('aria-expanded', 'false');
    }
  };

  window.submitReport = function () {
    const typeEl = document.getElementById('rp-type');
    const descEl = document.getElementById('rp-desc');
    const type = typeEl ? typeEl.value : '';
    const desc = descEl ? (descEl.value || '').trim() : '';
    if (!desc) { showToast('اكتب وصف المشكلة', 'error'); fieldError(descEl, 'يرجى كتابة وصف للمشكلة'); return; }
    if (desc.length < 10) { showToast('وصف المشكلة قصير جداً', 'warning'); return; }
    const me = currentStudent() || {};
    store.reports = store.reports || [];
    store.reports.unshift({
      id: Date.now(), type, desc, from: me.name || 'مستخدم',
      date: new Date().toISOString().slice(0, 10), status: 'pending'
    });
    store.auditLog.unshift({ icon: 'support_agent', text: 'بلاغ جديد: ' + type, time: 'الآن', color: '#0077ed' });
    save();
    // Haptic + animate the success state
    hapticPattern('success');
    fieldError(descEl, '');
    const form = document.getElementById('report-form');
    const success = document.getElementById('report-success');
    if (form) form.classList.add('hidden');
    if (success) { success.classList.remove('hidden'); success.classList.add('od-success-in'); }
    showToast('أُرسل بلاغك لفريق مركز رسالة', 'success');
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

  window.saveAttendance = function (btn) {
    const reset = setBtnLoading(btn, 'إغلاق المحاضرة وحفظ الحضور');
    const batch = currentBatch();
    const key = 'b' + batch.id + '-s' + (batch.lecturesDone + 1);
    const isNew = store.recordedSessions.indexOf(key) === -1;
    if (isNew) store.recordedSessions.push(key);
    const today = new Date().toISOString().slice(0, 10);
    let celebrationsTriggered = false;

    batch.studentIds.forEach(sid => {
      const st = store.currentSession.recs[sid];
      if (!st) return;
      if (!store.attendance[sid]) store.attendance[sid] = [];
      store.attendance[sid].push({ date: today, status: st });
      
      const u = store.users.find(x => x.id === sid);
      if (u) {
        if (isNew && (st === 'present' || st === 'late')) {
          const ptsEarned = st === 'present' ? 10 : 3;
          u.points = (u.points || 0) + ptsEarned;

          // Streak bonus rule (3+ consecutive present/late sessions)
          const streak = consecutiveStreak(sid);
          if (streak >= 3) {
            u.points += 5; // Bonus
            store.notifications.unshift({
              id: Date.now() + Math.random(),
              icon: 'local_fire_department',
              title: 'بونص سلسلة حضور! 🔥',
              body: 'حصلت على +5 نقاط بونص للحضور المتتالي (' + streak + ' جلسات)',
              time: 'الآن',
              unread: true
            });
          }
        }

        // PRD Certificate Rule Check: attendance rate >= 75%
        const stats = attStats(sid);
        const course = store.courses.find(c => c.id === batch.courseId);
        if (course && stats.pct >= 75) {
          const existingCert = store.certs.find(c => c.student === u.name && c.course === course.title);
          if (!existingCert) {
            const certNo = 'RTC-' + new Date().getFullYear() + '-' + String(Math.floor(100000 + Math.random() * 900000));
            store.certs.push({
              id: Date.now() + Math.random(),
              student: u.name,
              course: course.title,
              date: formatArabicDate(new Date()),
              no: certNo,
              att: stats.pct,
              status: 'issued'
            });
            celebrationsTriggered = true;
            store.notifications.unshift({
              id: Date.now() + Math.random(),
              icon: 'workspace_premium',
              title: 'مبروك! حصلت على شهادة معتمدة 🎉',
              body: 'صدرت شهادتك في كورس ' + course.title + ' برقم توثيق ' + certNo,
              time: 'الآن',
              unread: true
            });
          }
        }
      }
    });

    batch.lecturesDone++;
    store.auditLog.unshift({ icon: 'fact_check', text: 'تسجيل حضور — ' + batch.name + ' محاضرة ' + batch.lecturesDone, time: 'الآن', color: '#003c36' });
    save();
    reset();

    if (celebrationsTriggered) {
      triggerCelebration();
      showToast('🎉 تهانينا! تم إصدار شهادات جديدة للطلاب المستوفين للشروط!', 'success', 4000);
    } else {
      hapticPattern('success');
      showToast('تم حفظ الحضور وتحديث نقاط الطلاب بنجاح', 'success');
    }
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
    if (title) title.innerHTML = '<span class="material-symbols-outlined text-xl text-primary">person_add</span> إضافة مستخدم جديد';
    editUserId = null;
    const branchSel = document.getElementById('nu-branch');
    if (branchSel) {
      const branches = Array.from(new Set(store.users.map(x => x.branch).filter(Boolean).concat(['وسط البلد', 'مدينة نصر', 'الجيزة', 'الإسكندرية', 'المقر الرئيسي'])));
      branchSel.innerHTML = branches.map(b => '<option value="' + escapeHtml(b) + '">' + escapeHtml(b) + '</option>').join('');
      branchSel.value = 'وسط البلد';
    }
    openModal('add-user-modal');
  };
  window.openAddCourseModal = function () {
    const title = document.querySelector('#add-course-modal h3');
    if (title) title.innerHTML = '<span class="material-symbols-outlined text-xl text-primary">menu_book</span> إنشاء كورس جديد';
    editCourseId = null;
    const sel = document.getElementById('nc-instructor');
    if (sel) {
      sel.innerHTML = '<option value="">— اختر المدرب —</option>' + store.users
        .filter(u => u.role === 'volunteer')
        .map(u => '<option value="' + u.id + '">' + escapeHtml(u.name) + '</option>')
        .join('');
    }
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
      // Data integrity: remove the deleted user from every batch roster + attendance
      store.batches.forEach(bt => {
        bt.studentIds = bt.studentIds.filter(s => s !== id);
      });
      if (store.attendance[id]) delete store.attendance[id];
      if (store.currentSession && store.currentSession.recs) delete store.currentSession.recs[id];
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
      // Data integrity: detach batches that referenced this course
      store.batches.forEach(bt => { if (bt.courseId === id) bt.courseId = null; });
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
    const branch = (document.getElementById('nu-branch') || {}).value || 'وسط البلد';
    // Validate name: Arabic/English letters and spaces only
    const NAME_RE = /^[\u0600-\u06FF\u0750-\u077Fa-zA-Z\s/.-]{2,60}$/;
    if (!rawName || !NAME_RE.test(rawName)) { fieldError(nameEl, 'اكتب الاسم بالكامل (حروف فقط، 2-60 حرف)'); return; }
    if (!PHONE_RE.test(phone)) { fieldError(phoneEl, 'رقم موبايل مصري صحيح (11 رقماً يبدأ بـ 01)'); return; }
    // CVE-RTC-004 Fix: validate role server-side too
    if (VALID_ROLES.indexOf(role) === -1) { showToast('دور غير صحيح', 'error'); return; }
    if (store.users.some(u => u.phone === phone && u.id !== editUserId)) { fieldError(phoneEl, 'رقم الموبايل مستخدم مسبقاً'); return; }
    fieldError(nameEl, ''); fieldError(phoneEl, '');
    const reset = setBtnLoading(e.submitter || e.target.querySelector('[type="submit"]'), 'حفظ المستخدم');
    // Store plain text (escaped on render via escapeHtml())
    const name = rawName;
    if (editUserId !== null) {
      // Edit mode: update existing user instead of inserting
      const u = store.users.find(x => x.id === editUserId);
      if (!u) { reset(); showToast('المستخدم غير موجود', 'error'); return; }
      u.name = name; u.phone = phone; u.role = role; u.branch = branch;
      u.avatar = name[0] + (name[1] || '');
      store.auditLog.unshift({ icon: 'edit', text: 'تعديل بيانات مستخدم: ' + name, time: 'الآن', color: '#515f74' });
      save();
      reset();
      closeModal('add-user-modal');
      renderUsers();
      showToast('تم تعديل ' + name + ' بنجاح!', 'success');
    } else {
      store.users.push({ id: Date.now(), name, phone, role, branch, avatar: name[0] + (name[1] || ''), status: 'active', points: 0 });
      store.auditLog.unshift({ icon: 'person_add', text: 'تم إضافة ' + name, time: 'الآن', color: '#00288e' });
      save();
      reset();
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
    const branchSel = document.getElementById('nu-branch');
    if (branchSel) {
      const branches = Array.from(new Set(store.users.map(x => x.branch).filter(Boolean).concat(['وسط البلد', 'مدينة نصر', 'الجيزة', 'الإسكندرية', 'المقر الرئيسي'])));
      branchSel.innerHTML = branches.map(b => '<option value="' + escapeHtml(b) + '">' + escapeHtml(b) + '</option>').join('');
      branchSel.value = u.branch || '';
    }
    const nameErr = document.getElementById('nu-name').parentElement.querySelector('.err-txt');
    const phoneErr = document.getElementById('nu-phone').parentElement.querySelector('.err-txt');
    if (nameErr) nameErr.style.display = 'none';
    if (phoneErr) phoneErr.style.display = 'none';
    document.getElementById('nu-name').classList.remove('invalid');
    document.getElementById('nu-phone').classList.remove('invalid');
    editUserId = uid;
    const title = document.querySelector('#add-user-modal h3');
    if (title) title.innerHTML = '<span class="material-symbols-outlined text-xl text-primary">edit</span> تعديل بيانات المستخدم';
    openModal('add-user-modal');
  };

  window.submitAddCourse = function (e) {
    e.preventDefault();
    const titleEl = document.getElementById('nc-title');
    const title = titleEl.value.trim();
    if (!title) { fieldError(titleEl, 'اكتب اسم الكورس'); return; }
    fieldError(titleEl, '');
    const reset = setBtnLoading(e.submitter || e.target.querySelector('[type="submit"]'), 'إنشاء الكورس');
    const cat = document.getElementById('nc-cat').value.trim() || 'عام';
    const sessions = +(document.getElementById('nc-sessions').value || 8) || 8;
    const startDate = document.getElementById('nc-start').value || '2026-08-10';
    const scheduleText = document.getElementById('nc-schedule').value.trim() || '';
    const location = document.getElementById('nc-location').value.trim() || '';
    const description = document.getElementById('nc-desc').value.trim() || '';
    const instructorId = +(document.getElementById('nc-instructor').value) || null;
    const maxStudents = +(document.getElementById('nc-max').value || 30) || 30;
    const data = { title, cat, sessions, startDate, scheduleText, location, description, instructorId, maxStudents };
    if (editCourseId !== null) {
      const c = store.courses.find(x => x.id === editCourseId);
      if (!c) { reset(); showToast('الكورس غير موجود', 'error'); return; }
      Object.assign(c, data);
      store.auditLog.unshift({ icon: 'edit', text: 'تعديل بيانات كورس: ' + title, time: 'الآن', color: '#515f74' });
      save();
      reset();
      closeModal('add-course-modal');
      renderAdminCourses();
      renderAdminHome();
      showToast('تم تعديل كورس "' + title + '"!', 'success');
    } else {
      store.courses.push(Object.assign({ id: Date.now(), icon: 'auto_stories', color: '#515f74', enrolled: 0 }, data));
      store.auditLog.unshift({ icon: 'add_circle', text: 'إنشاء كورس: ' + title, time: 'الآن', color: '#00288e' });
      save();
      reset();
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
    document.getElementById('nc-sessions').value = c.sessions || 8;
    document.getElementById('nc-start').value = c.startDate || '';
    document.getElementById('nc-schedule').value = c.scheduleText || '';
    document.getElementById('nc-location').value = c.location || '';
    document.getElementById('nc-desc').value = c.description || '';
    const sel = document.getElementById('nc-instructor');
    if (sel) {
      sel.innerHTML = '<option value="">— اختر المدرب —</option>' + store.users
        .filter(u => u.role === 'volunteer')
        .map(u => '<option value="' + u.id + '">' + escapeHtml(u.name) + '</option>')
        .join('');
      sel.value = c.instructorId || '';
    }
    document.getElementById('nc-max').value = c.maxStudents || 30;
    const titleErr = document.getElementById('nc-title').parentElement.querySelector('.err-txt');
    if (titleErr) titleErr.style.display = 'none';
    document.getElementById('nc-title').classList.remove('invalid');
    editCourseId = cid;
    const title = document.querySelector('#add-course-modal h3');
    if (title) title.innerHTML = '<span class="material-symbols-outlined text-xl text-primary">edit</span> تعديل بيانات الكورس';
    openModal('add-course-modal');
  };

  // Real enrollment: add the current student to the course's batch, update counters
  window.enrollCourse = function (courseId) {
    haptic(8);
    const c = store.courses.find(x => x.id === courseId);
    if (!c) { showToast('الكورس غير موجود', 'error'); return; }
    const me = currentStudent();
    let batch = store.batches.find(b => b.courseId === courseId);
    if (!batch) {
      const id = Math.max(0, ...store.batches.map(b => b.id)) + 1;
      batch = { id, name: 'دفعة — ' + c.title, courseId, instructor: courseInstructor(c), schedule: c.scheduleText || '', location: c.location || '', studentIds: [], lecturesDone: 0 };
      store.batches.push(batch);
    }
    if (batch.studentIds.indexOf(me.id) !== -1) { showToast('أنت مسجّل بالفعل في هذا الكورس', 'warning'); return; }
    const max = c.maxStudents || 30;
    if (batch.studentIds.length >= max) { showToast('اكتمل العدد في هذا الكورس', 'error'); return; }
    batch.studentIds.push(me.id);
    c.enrolled = batch.studentIds.length;
    store.auditLog.unshift({ icon: 'person_add', text: 'تسجيل ' + me.name + ' في كورس: ' + c.title, time: 'الآن', color: '#00288e' });
    store.notifications.unshift({ id: Date.now(), icon: 'how_to_reg', title: 'تم التسجيل في الكورس ✓', body: 'سجّلت في "' + c.title + '" — يبدأ ' + (c.startDate || 'قريباً'), time: 'الآن', unread: true });
    save();
    _viewCourseId = courseId;
    renderCourseDetail();
    showToast('تم تسجيلك في "' + c.title + '"!', 'success');
    setTimeout(() => switchTab('s-courses'), 1200);
  };

  // Cert pane switcher
  window.showCertPane = function (btn, paneId) {
    document.querySelectorAll('#screen-a-certs .seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['acerts-pane', 'apoints-pane'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        // Create primary user in local store
        const user = {
          id: Date.now(),
          name: name,
          phone: phone,
          role: role,
          branch: address,
          avatar: _uploadedAvatarBase64 || name.substring(0, 2),
          status: 'active',
          points: 100
        };
        store.users.push(user);
        el.classList.toggle('hidden', id !== paneId); el.classList.toggle('flex', id === paneId);
      }
    });
  };

  // Toggle switch
  window.toggleSwitch = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    const wasOn = el.classList.contains('on');
    el.classList.toggle('on', !wasOn);
    el.classList.toggle('off', wasOn);
    haptic(8);
    if (el.getAttribute('role') === 'switch') {
      el.setAttribute('aria-checked', wasOn ? 'false' : 'true');
    }
  };

  function _syncDarkToggles(isDark) {
    ['tog-dark', 'tog-backup-dark'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.toggle('on', isDark);
        el.classList.toggle('off', !isDark);
        if (el.getAttribute('role') === 'switch') el.setAttribute('aria-checked', isDark ? 'true' : 'false');
      }
    });
  }

  // Dark mode
  window.toggleDarkMode = function () {
    const root = document.documentElement;
    const on = root.getAttribute('data-theme') === 'dark';
    const next = !on;
    root.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('rtc_theme', next ? 'dark' : 'light');
    haptic(8);
    _syncDarkToggles(next);
  };
  // Restore saved theme on load
  (function restoreTheme() {
    if (localStorage.getItem('rtc_theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      _syncDarkToggles(true);
    } else {
      _syncDarkToggles(false);
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
  window.setBtnLoading = setBtnLoading;

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

  window.resetAppData = function() {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch(e) {}
    window.location.reload();
  };

  /* ═══════════════════════════════════════════════
     NEW ONBOARDING ENGINE
  ═══════════════════════════════════════════════ */
  let _uploadedAvatarBase64 = null;
  let _selectedCourseIds = [];
  let _regSelectedRole = 'student';

  window.selectRegistrationRole = function(role) {
    _regSelectedRole = role;
    const roles = ['student', 'volunteer', 'admin'];
    roles.forEach(r => {
      const btn = document.getElementById('role-btn-' + r);
      if (btn) {
        if (r === role) {
          btn.className = 'flex-1 py-2.5 rounded-xl border-2 border-primary bg-primary text-white text-xs font-bold flex flex-col items-center justify-center gap-1 tap';
        } else {
          btn.className = 'flex-1 py-2.5 rounded-xl border-2 border-outline-variant bg-white text-on-surface text-xs font-bold flex flex-col items-center justify-center gap-1 tap';
        }
      }
    });
  };

  window.nextOnbStep = function(step) {
    haptic(5);
    if (step === 4) {
      const name = (document.getElementById('onb-name')?.value || document.getElementById('reg-name')?.value || '').trim();
      const phone = (document.getElementById('onb-phone')?.value || document.getElementById('reg-phone')?.value || '').trim();
      if (!name || name.split(/\s+/).length < 2) {
        showToast('يرجى إدخال اسمك الرباعي للمتابعة', 'error');
        return;
      }
      if (!PHONE_RE.test(phone)) {
        showToast('يرجى إدخال رقم موبايل مصري صحيح (11 رقماً)', 'error');
        return;
      }
      renderOnbCourses();
    }

    if (step === 5) {
      const name = (document.getElementById('onb-name')?.value || document.getElementById('reg-name')?.value || '').trim();
      const titleEl = document.getElementById('onb-welcome-title') || document.getElementById('g-name');
      if (titleEl && name) {
        titleEl.textContent = 'أهلاً بك، ' + name.split(' ')[0] + '! 🎉';
      }
    }

    document.querySelectorAll('.onb-step').forEach(el => {
      el.classList.add('hidden');
      el.classList.remove('active');
    });

    const target = document.getElementById('onb-step-' + step) || document.querySelector('.onb-step[data-step="' + step + '"]');
    if (target) {
      target.classList.remove('hidden');
      target.classList.add('active');
    }

    for (let i = 1; i <= 5; i++) {
      const dot = document.getElementById('dot-' + i);
      if (dot) {
        if (i === step) {
          dot.className = 'w-8 h-2 rounded-full bg-primary transition-all duration-300 onb-dot on';
        } else {
          dot.className = 'w-2 h-2 rounded-full bg-outline-variant transition-all duration-300 onb-dot';
        }
      }
    }
  };

  window.toggleOnbTerms = window.termsChanged = function(cb) {
    const isChecked = typeof cb === 'boolean' ? cb : (cb && cb.checked);
    const btn = document.getElementById('btn-onb-step2') || document.getElementById('btn-onb2');
    const err = document.getElementById('terms-err');
    if (btn) {
      btn.disabled = !isChecked;
      btn.classList.toggle('opacity-50', !isChecked);
      btn.classList.toggle('cursor-not-allowed', !isChecked);
    }
    if (err) err.classList.toggle('show', !isChecked);
  };

  window.regAvatar = window.previewUserAvatar = function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      _uploadedAvatarBase64 = e.target.result;
      const img = document.getElementById('onb-avatar-preview');
      const avBig = document.getElementById('reg-av');
      if (img) img.src = _uploadedAvatarBase64;
      if (avBig) {
        avBig.style.backgroundImage = 'url(' + _uploadedAvatarBase64 + ')';
        avBig.style.backgroundSize = 'cover';
        avBig.textContent = '';
      }
      showToast('تم رفع صورتك الشخصية بنجاح!', 'success');
    };
    reader.readAsDataURL(file);
  };

  window.pickRole = function(btn) {
    haptic(5);
    document.querySelectorAll('.role-c').forEach(b => b.classList.remove('sel'));
    btn.classList.add('sel');
    _regSelectedRole = btn.dataset.role || 'student';
  };

  window.submitReg = function() {
    const nameInput = document.getElementById('onb-name') || document.getElementById('reg-name');
    const phoneInput = document.getElementById('onb-phone') || document.getElementById('reg-phone');
    const nameErr = document.getElementById('err-name');
    const phoneErr = document.getElementById('err-phone');

    const name = (nameInput?.value || '').trim();
    const phone = (phoneInput?.value || '').trim();

    let valid = true;
    if (!name || name.split(/\s+/).length < 2) {
      if (nameErr) nameErr.classList.add('show');
      if (nameInput) nameInput.classList.add('bad');
      valid = false;
    } else {
      if (nameErr) nameErr.classList.remove('show');
      if (nameInput) nameInput.classList.remove('bad');
    }

    if (!PHONE_RE.test(phone)) {
      if (phoneErr) phoneErr.classList.add('show');
      if (phoneInput) phoneInput.classList.add('bad');
      valid = false;
    } else {
      if (phoneErr) phoneErr.classList.remove('show');
      if (phoneInput) phoneInput.classList.remove('bad');
    }

    if (!valid) {
      showToast('يرجى التأكد من كتابة الاسم الرباعي ورقم الموبايل الصحيح', 'error');
      return;
    }

    nextOnbStep(4);
  };

  window.renderOnbCourses = function() {
    const list = document.getElementById('pick-grid') || document.getElementById('onb-courses-list');
    if (!list) return;
    list.innerHTML = store.courses.map(c => `
      <div class="pick-c sel" data-id="${c.id}" onclick="toggleCoursePick(this, ${c.id})">
        <div class="pick-ic" style="background:${c.color || 'var(--primary)'}">
          <i class="ph-duotone ph-${c.icon === 'code' ? 'code' : c.icon === 'translate' ? 'translate' : 'graduation-cap'}"></i>
        </div>
        <div style="flex:1;text-align:right">
          <h4 style="font-size:13px;font-weight:700">${escapeHtml(c.title)}</h4>
          <p style="font-size:10.5px;color:var(--mut);margin-top:2px">${escapeHtml(c.cat)} • ${c.sessions || 10} محاضرات • مجاني 100%</p>
        </div>
        <div class="pick-chk"><i class="ph-bold ph-check"></i></div>
      </div>
    `).join('');
    _selectedCourseIds = store.courses.map(c => c.id);
    const txt = document.getElementById('pick-count-txt');
    const btn = document.getElementById('btn-onb4');
    if (txt) txt.textContent = `متابعة (${_selectedCourseIds.length} كورسات مختارة)`;
    if (btn) btn.disabled = false;
  };

  window.toggleCoursePick = function(el, cid) {
    haptic(5);
    el.classList.toggle('sel');
    const idx = _selectedCourseIds.indexOf(cid);
    if (idx !== -1) _selectedCourseIds.splice(idx, 1);
    else _selectedCourseIds.push(cid);

    const txt = document.getElementById('pick-count-txt');
    const btn = document.getElementById('btn-onb4');
    if (txt) txt.textContent = _selectedCourseIds.length > 0 ? `متابعة (${_selectedCourseIds.length} كورسات مختارة)` : 'اختر كورساً للمتابعة';
    if (btn) btn.disabled = _selectedCourseIds.length === 0;
  };

  window.updateSelectedOnbCourses = function() {
    _selectedCourseIds = Array.from(document.querySelectorAll('.pick-c.sel')).map(el => parseInt(el.dataset.id));
  };

  window.completeRegistrationFinal = function() {
    const role = _regSelectedRole || 'student';
    const name = (document.getElementById('onb-name')?.value || document.getElementById('reg-name')?.value || '').trim() || 'طالب جديد';
    const phone = (document.getElementById('onb-phone')?.value || document.getElementById('reg-phone')?.value || '').trim() || '01000000000';
    const address = (document.getElementById('onb-address')?.value || document.getElementById('reg-branch')?.value || '').trim() || 'فرع مصدق (الدقي)';

    const user = {
      id: Date.now(),
      name: name,
      phone: phone,
      role: role,
      branch: address,
      avatar: _uploadedAvatarBase64 || name.substring(0, 2),
      status: 'active',
      points: 100
    };
    store.users.push(user);

    if (_selectedCourseIds.length > 0 && role === 'student') {
      _selectedCourseIds.forEach(cid => {
        let b = store.batches.find(x => x.courseId === cid);
        if (b && b.studentIds.indexOf(user.id) === -1) {
          b.studentIds.push(user.id);
        }
      });
    }

    currentRole = role;
    localStorage.setItem('rtc_role_v2', role);
    localStorage.setItem('rtc_onboarding_done', 'true');
    save();

    if (window.supabaseClient) {
      window.supabaseClient.from('profiles').upsert({
        id: 'user_' + user.id,
        full_name: name,
        phone_number: phone,
        address: address,
        avatar_url: _uploadedAvatarBase64 || '',
        role: role
      }).then(({ error }) => {
        if (error) console.warn('Supabase sync note:', error.message);
      });
    }

    const homes = { student: 's-home', volunteer: 'v-home', admin: 'a-home' };
    navigate(homes[role]);
    showToast('أهلاً بك يا ' + name.split(' ')[0] + '! تم التسجيل بنجاح 🎉', 'success');
  };

  window.finishReg = function(isGoogle) {
    if (isGoogle) signInWithGoogleOnboarding();
    else completeRegistrationFinal();
  };

  window.openGoogle = function() {
    signInWithGoogleOnboarding();
  };

  window.skipOnb = function() {
    nextOnbStep(3);
  };

  window.toggleDark = function() {
    const current = document.documentElement.getAttribute('data-theme') || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('rtc_theme', next);
    showToast(next === 'dark' ? 'تم تفعيل الوضع الليلي' : 'تم تفعيل الوضع النهارى', 'info');
  };

  window.signInWithGoogleOnboarding = function() {
    const name = (document.getElementById('onb-name')?.value || document.getElementById('reg-name')?.value || '').trim() || 'طالب جديد';
    const phone = (document.getElementById('onb-phone')?.value || document.getElementById('reg-phone')?.value || '').trim() || '01000000000';
    const address = (document.getElementById('onb-address')?.value || document.getElementById('reg-branch')?.value || '').trim() || 'فرع مصدق (الدقي)';
    const role = _regSelectedRole || 'student';

    sessionStorage.setItem('rtc_pending_reg', JSON.stringify({
      name, phone, address, avatar: _uploadedAvatarBase64, courses: _selectedCourseIds, role
    }));

    if (window.supabaseClient) {
      window.supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
      }).catch(err => {
        showToast('خطأ في الاتصال بـ Google: ' + err.message, 'error');
        completeRegistrationFinal();
      });
    } else {
      showToast('جاري الدخول بحسابك المحلي...', 'info');
      completeRegistrationFinal();
    }
  };

  /* ═══════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
    const savedRole = localStorage.getItem('rtc_role_v2');
    if (savedRole && VALID_ROLES.indexOf(savedRole) !== -1) {
      currentRole = savedRole;
    } else if (savedRole) {
      localStorage.removeItem('rtc_role_v2');
    }

    const pendingJson = sessionStorage.getItem('rtc_pending_reg');
    if (pendingJson) {
      try {
        const pending = JSON.parse(pendingJson);
        sessionStorage.removeItem('rtc_pending_reg');
        if (pending.name) {
          const user = store.users.find(u => u.role === 'student') || store.users[0];
          if (user) {
            user.name = pending.name;
            user.phone = pending.phone;
            user.branch = pending.address;
            if (pending.avatar) user.avatar = pending.avatar;
            save();
          }
        }
      } catch(e) {}
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.documentElement.classList.contains('dark');
    ['tog-dark', 'tog-backup-dark'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('on', isDark);
      el.classList.toggle('off', !isDark);
    });

    setTimeout(function () {
      const onboarded = localStorage.getItem('rtc_onboarding_done');
      if (onboarded && currentRole && store.users && store.users.length > 0) {
        const homes = { student: 's-home', volunteer: 'v-home', admin: 'a-home' };
        navigate(homes[currentRole] || 'onboarding');
      } else {
        navigate('onboarding');
      }
    }, 1500);
  });

  window.resetAppData = function() {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch(e) {}
    showToast('تم مسح الذاكرة المؤقتة!', 'info');
    setTimeout(() => window.location.reload(), 300);
  };

})();
