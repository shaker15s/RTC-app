/* ═══════════════════════════════════════════════════════════════
   مسار RTC — محرك التطبيق الكامل الإصدار 8.0 PRODUCTION
   جمعية رسالة — مركز التدريب والتطوير
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────── كتالوج الشارات ─────────────── */
const BADGES_CATALOG = [
  { id:'welcome',      name:'أول خطوة',         icon:'ph-fill ph-flag-checkered',    color:'#00288e', desc:'انضممت إلى مسار RTC',              unlock:'انضم للتطبيق' },
  { id:'firstCourse',  name:'متعلم نشيط',        icon:'ph-fill ph-book-open-text',    color:'#00554e', desc:'انضممت لأول دورة تدريبية',           unlock:'انضم لأول كورس' },
  { id:'firstAttend',  name:'حاضر فعلاً',        icon:'ph-fill ph-calendar-check',    color:'#0b6e63', desc:'سُجّل حضورك أول مرة',               unlock:'سجّل المتطوع حضورك' },
  { id:'points100',    name:'جامع النقاط',        icon:'ph-fill ph-coins',             color:'#d4af37', desc:'جمعت ١٠٠ نقطة تحفيزية',             unlock:'اجمع ١٠٠ نقطة' },
  { id:'streak5',      name:'مثابر',              icon:'ph-fill ph-fire',              color:'#ba1a1a', desc:'حضرت ٥ محاضرات على التوالي',         unlock:'احضر ٥ محاضرات متتالية' },
  { id:'explorer',     name:'مستكشف',             icon:'ph-fill ph-compass',           color:'#7a30d8', desc:'انضممت لـ ٣ دورات مختلفة',           unlock:'انضم لـ ٣ كورسات' },
  { id:'graduate',     name:'خريج معتمد',         icon:'ph-fill ph-certificate',       color:'#1e40af', desc:'أتممت أول دورة بنجاح',               unlock:'أكمل كورساً كاملاً' },
  { id:'social',       name:'نجم سوشيال',         icon:'ph-fill ph-heart',             color:'#a8477a', desc:'شارك التطبيق مع صديق',              unlock:'اشرح للآخرين عن رسالة' },
  { id:'points500',    name:'بطل النقاط',         icon:'ph-fill ph-trophy',            color:'#854d0e', desc:'جمعت ٥٠٠ نقطة تحفيزية',             unlock:'اجمع ٥٠٠ نقطة' },
];

const FAQ = [
  { q:'هل الكورسات مجانية فعلاً بدون أي مصاريف خفية؟', a:'نعم، جميع الدورات في مركز رسالة مجانية ١٠٠٪ بالكامل من التسجيل وحتى الحصول على الشهادة.' },
  { q:'هل أحصل على شهادة معتمدة بعد إتمام الدورة؟', a:'بمجرد تسجيل المتطوع حضورك في جميع المحاضرات، تُصدر شهادة إتمام معتمدة باسمك تلقائياً.' },
  { q:'ماذا لو فاتتني إحدى المحاضرات؟', a:'تواصل مع المتطوع المسؤول عن مجموعتك لمعرفة إمكانية التعويض في مجموعة أخرى بنفس الفرع.' },
  { q:'كيف يتم تسجيل الحضور؟', a:'المتطوع المسؤول هو من يسجل حضور الطلاب في نهاية كل محاضرة. لا يمكن للطالب تسجيل حضوره بنفسه.' },
  { q:'كيف أغيّر الفرع؟', a:'من "الملف الشخصي" اضغط "تعديل" ثم غيّر الفرع، وسيتم تحديثه في قاعدة البيانات.' },
];

/* ─────────────── الحالة العامة ─────────────── */
let CURRENT_USER = null;       // Supabase auth user
let CURRENT_PROFILE = null;    // profile from public.profiles
let navStack = [];
let currentScreenId = 'splash';
let pendingOAuthRegistration = false;

// Local cache for fetched data
let _coursesCache = null;
let _batchesCache = null;

const STUDENT_TABS   = ['s-home','s-courses','s-points','s-certs','s-profile'];
const VOLUNTEER_TABS = ['v-home','v-batches','v-courses','v-profile','s-analytics'];
const ADMIN_TABS     = ['a-home','a-users','a-courses','a-certs','a-settings','s-analytics'];

/* ═══════════════ XSS Protection ═══════════════ */
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ═══════════════ Toast ═══════════════ */
function toast(msg, type, icon) {
  type = type || 'info';
  const ct = document.getElementById('toast-ct');
  if (!ct) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const ic = icon || (type==='ok'?'ph-check-circle':type==='err'?'ph-x-circle':'ph-info');
  el.innerHTML = `<i class="ph-fill ${ic}"></i><span>${esc(msg)}</span>`;
  ct.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .35s, transform .35s';
    el.style.opacity = '0'; el.style.transform = 'translateY(-10px)';
    setTimeout(() => el.remove(), 350);
  }, 3200);
}

/* ═══════════════ Confirm Modal ═══════════════ */
function showConfirm(title, msg, onYes, opts) {
  opts = opts || {};
  let old = document.getElementById('dyn-confirm'); if (old) old.remove();
  const bg = document.createElement('div');
  bg.id = 'dyn-confirm'; bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal-sheet" style="text-align:center;padding-top:6px">
      <div class="modal-handle"></div>
      <div style="width:60px;height:60px;border-radius:50%;background:rgba(186,26,26,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;color:var(--red);font-size:28px"><i class="ph-fill ph-warning"></i></div>
      <h3 style="font-size:16px;font-weight:800;margin-bottom:6px">${esc(title)}</h3>
      <p style="font-size:12.5px;color:var(--mut);margin-bottom:20px;line-height:1.8">${esc(msg)}</p>
      <div style="display:flex;gap:10px">
        <button class="btn btn-soft btn-mid" style="flex:1" id="dc-cancel">إلغاء</button>
        <button class="btn btn-danger btn-mid" style="flex:1" id="dc-yes">${esc(opts.yesLabel||'تأكيد')}</button>
      </div>
    </div>`;
  document.getElementById('app').appendChild(bg);
  requestAnimationFrame(() => bg.classList.add('open'));
  const close = () => { bg.classList.remove('open'); setTimeout(() => bg.remove(), 300); };
  bg.querySelector('#dc-cancel').onclick = close;
  bg.querySelector('#dc-yes').onclick = () => { close(); onYes(); };
  bg.onclick = e => { if (e.target === bg) close(); };
}

/* ═══════════════ Badge Locked Popup ═══════════════ */
function showBadgeLocked(badge) {
  let old = document.getElementById('dyn-badge'); if (old) old.remove();
  const bg = document.createElement('div');
  bg.id = 'dyn-badge'; bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal-sheet" style="text-align:center;padding-top:6px">
      <div class="modal-handle"></div>
      <div style="width:80px;height:80px;border-radius:24px;background:${esc(badge.color)};display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:36px;filter:grayscale(1);opacity:.5"><i class="${esc(badge.icon)}"></i></div>
      <div style="font-size:12px;color:var(--mut);margin-bottom:4px">🔒 شارة مقفلة</div>
      <h3 style="font-size:18px;font-weight:800;margin-bottom:6px">${esc(badge.name)}</h3>
      <p style="font-size:12.5px;color:var(--mut);margin-bottom:8px">${esc(badge.desc)}</p>
      <div style="background:var(--card-2);border:1px solid var(--line);border-radius:14px;padding:10px 14px;display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--primary)">
        <i class="ph-fill ph-lightbulb"></i> كيف تحصل عليها: ${esc(badge.unlock)}
      </div>
      <button class="btn btn-primary btn-mid w-full mt-4" id="bd-ok">فهمت — سأسعى للحصول عليها!</button>
    </div>`;
  document.getElementById('app').appendChild(bg);
  requestAnimationFrame(() => bg.classList.add('open'));
  const close = () => { bg.classList.remove('open'); setTimeout(() => bg.remove(), 300); };
  bg.querySelector('#bd-ok').onclick = close;
  bg.onclick = e => { if (e.target === bg) close(); };
}

/* ═══════════════ Custom Premium Select Modal Sheet ═══════════════ */
function openCustomSelectPicker({ title, subtitle, items, currentVal, onSelect }) {
  let old = document.getElementById('custom-select-picker'); if (old) old.remove();
  const bg = document.createElement('div');
  bg.id = 'custom-select-picker'; bg.className = 'modal-bg';
  
  bg.innerHTML = `
    <div class="modal-sheet" style="max-height:85vh;display:flex;flex-direction:column;padding-top:10px">
      <div class="modal-handle"></div>
      
      <div class="flex items-center justify-between mb-2 pb-2 border-b border-line">
        <div>
          <h3 class="text-base font-bold text-on-surface flex items-center gap-2">
            <i class="ph-duotone ph-list-dashes text-primary text-xl"></i>
            <span>${esc(title)}</span>
          </h3>
          ${subtitle ? `<p class="text-xs text-muted mt-0.5">${esc(subtitle)}</p>` : ''}
        </div>
        <button class="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center text-muted hover:text-on-surface" id="csp-close">
          <i class="ph-bold ph-x"></i>
        </button>
      </div>

      ${items.length > 5 ? `
      <div class="relative my-2">
        <i class="ph-bold ph-magnifying-glass absolute right-3 top-3 text-muted text-sm"></i>
        <input type="text" id="csp-search" placeholder="ابحث في الخيارات..." class="inp pr-9 text-xs py-2 w-full">
      </div>
      ` : ''}

      <div class="overflow-y-auto flex-1 space-y-2 py-2 pr-1" id="csp-list" style="-webkit-overflow-scrolling:touch">
        ${items.map(item => `
          <div class="csp-item p-3.5 rounded-xl border border-line bg-card hover:border-primary/50 transition-all cursor-pointer flex items-center justify-between ${item.value === currentVal ? 'border-primary bg-primary/10 shadow-sm' : ''}" data-value="${esc(item.value)}" data-label="${esc(item.label)}">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl ${item.value === currentVal ? 'bg-primary text-white' : 'bg-primary/10 text-primary'} flex items-center justify-center text-lg shadow-xs">
                <i class="ph-duotone ${item.icon || 'ph-map-pin'}"></i>
              </div>
              <div>
                <div class="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span>${esc(item.label)}</span>
                  ${item.badge ? `<span class="badge badge-subtle text-[10px] px-2 py-0.5">${esc(item.badge)}</span>` : ''}
                </div>
                ${item.sub ? `<div class="text-xs text-muted mt-0.5">${esc(item.sub)}</div>` : ''}
              </div>
            </div>
            ${item.value === currentVal ? '<i class="ph-fill ph-check-circle text-primary text-xl"></i>' : '<i class="ph-bold ph-caret-left text-muted text-sm"></i>'}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('app').appendChild(bg);
  requestAnimationFrame(() => bg.classList.add('open'));

  const close = () => { bg.classList.remove('open'); setTimeout(() => bg.remove(), 300); };
  bg.querySelector('#csp-close').onclick = close;

  const searchInp = bg.querySelector('#csp-search');
  if (searchInp) {
    searchInp.oninput = () => {
      const q = searchInp.value.trim().toLowerCase();
      bg.querySelectorAll('.csp-item').forEach(el => {
        const txt = el.textContent.toLowerCase();
        el.style.display = txt.includes(q) ? 'flex' : 'none';
      });
    };
  }

  bg.querySelectorAll('.csp-item').forEach(el => {
    el.onclick = () => {
      const val = el.getAttribute('data-value');
      const lbl = el.getAttribute('data-label');
      onSelect(val, lbl);
      close();
    };
  });

  bg.onclick = e => { if (e.target === bg) close(); };
}

const ALL_RTC_BRANCHES_PICKER = [
  { value: 'فرع فيصل — الطوابق (الجيزة)', label: 'فرع فيصل (الجيزة)', sub: '٥ شارع منسى ياسين – الطوابق – أمام بي تك', badge: 'فيصل', icon: 'ph-map-trifold' },
  { value: 'فرع مدينة نصر (القاهرة)', label: 'فرع مدينة نصر (القاهرة)', sub: '٤ شارع زكي رستم – متفرع من عباس العقاد', badge: 'مدينة نصر', icon: 'ph-buildings' },
  { value: 'فرع 6 أكتوبر (الجيزة)', label: 'فرع 6 أكتوبر (الجيزة)', sub: 'الحي السابع – ميدان ماجدة بجوار مسجد الحصري', badge: 'أكتوبر', icon: 'ph-navigation-arrow' },
  { value: 'فرع المعادي (القاهرة)', label: 'فرع المعادي (القاهرة)', sub: '٨/٣د تقسيم اللاسلكي – المعادي الجديدة', badge: 'المعادي', icon: 'ph-compass' },
  { value: 'فرع المقطم (القاهرة)', label: 'فرع المقطم (القاهرة)', sub: 'شارع ٩ – خلف موقف الأتوبيس – الهضبة الوسطى', badge: 'المقطم', icon: 'ph-map-pin' },
  { value: 'فرع الإسكندرية — سموحة', label: 'فرع سموحة (الإسكندرية)', sub: '٤٤ شارع توت عنخ آمون — بجوار كوبري كليوباترا', badge: 'الإسكندرية', icon: 'ph-waves' },
  { value: 'فرع مصدق — الدقي (الجيزة)', label: 'فرع مصدق — الدقي (الجيزة)', sub: 'شارع مصدق — بالقرب من محطة مترو الدقي', badge: 'الدقي', icon: 'ph-map-pin-line' },
  { value: 'فرع حلوان (القاهرة)', label: 'فرع حلوان (القاهرة)', sub: 'شارع راغب — حلوان', badge: 'حلوان', icon: 'ph-storefront' }
];

function openBranchPickerModal(currentVal, onSelect) {
  openCustomSelectPicker({
    title: 'اختر فرع مركز رسالة (RTC)',
    subtitle: 'اختر الفرع الأقرب إليك لعرض كورساته ومجموعاته وتأكيد الحضور فيه',
    items: ALL_RTC_BRANCHES_PICKER,
    currentVal: currentVal || 'فرع فيصل — الطوابق (الجيزة)',
    onSelect: (val, lbl) => {
      onSelect(val, lbl);
    }
  });
}

function openRolePickerModal(currentVal, onSelect) {
  const roles = [
    { value: 'student', label: 'طالب (تسجيل في الكورسات وتلقي الشهادات)', sub: 'الانضمام للمجموعات وحضور الورِش والحصول على الشهادات المعتمدة', badge: 'طالب', icon: 'ph-student' },
    { value: 'volunteer', label: 'متطوع / محاضر (إشراف وتنظيم المجموعات)', sub: 'إدارة المحاضرات وتسجيل حضور الطلاب وتولّي الإشراف', badge: 'إشراف', icon: 'ph-hand-heart' },
    { value: 'admin', label: 'مشرف النظام (إدارة شاملة)', sub: 'إدارة جميع الكورسات والمستخدمين والشهادات والفروع', badge: 'أدمن', icon: 'ph-shield-check' }
  ];
  openCustomSelectPicker({
    title: 'اختر نوع الحساب / الدور',
    subtitle: 'حدد نوع حسابك في تطبيق مسار RTC',
    items: roles,
    currentVal: currentVal || 'student',
    onSelect: (val, lbl) => {
      onSelect(val, lbl);
    }
  });
}

function triggerExploreBranchPickerUI() {
  openCustomSelectPicker({
    title: 'تصفية الكورسات حسب الفرع',
    subtitle: 'اختر فرع رسالة لعرض دوراته المتاحة',
    items: [
      { value: 'الكل', label: '🌐 جميع الفروع المتاحة', sub: 'عرض كافة كورسات المركز بجميع المحافظات', badge: 'الكل', icon: 'ph-globe' },
      ...ALL_RTC_BRANCHES_PICKER
    ],
    currentVal: document.getElementById('explore-branch-select')?.value || 'الكل',
    onSelect: (val, lbl) => {
      const inp = document.getElementById('explore-branch-select');
      const txt = document.getElementById('explore-branch-val-txt');
      if (inp) inp.value = val;
      if (txt) txt.textContent = lbl;
      setExploreBranchFilter(val);
    }
  });
}

function triggerEditProfileBranchPickerUI() {
  openBranchPickerModal(
    document.getElementById('ep-branch')?.value || 'فرع فيصل — الطوابق (الجيزة)',
    (val, lbl) => {
      const inp = document.getElementById('ep-branch');
      const txt = document.getElementById('ep-branch-val-txt');
      if (inp) inp.value = val;
      if (txt) txt.textContent = lbl;
    }
  );
}

function triggerVolunteerBranchPickerUI() {
  openCustomSelectPicker({
    title: 'تصفية كورسات الإشراف حسب الفرع',
    subtitle: 'اختر الفرع لعرض الدورات المتاحة للتطوع والإشراف',
    items: [
      { value: 'الكل', label: '🌐 جميع الفروع المتاحة', sub: 'عرض كافّة الدورات بجميع الفروع', badge: 'الكل', icon: 'ph-globe' },
      ...ALL_RTC_BRANCHES_PICKER
    ],
    currentVal: document.getElementById('vc-branch-select')?.value || 'الكل',
    onSelect: (val, lbl) => {
      const inp = document.getElementById('vc-branch-select');
      const txt = document.getElementById('vc-branch-val-txt');
      if (inp) inp.value = val;
      if (txt) txt.textContent = lbl;
      renderVolunteerCoursesList();
    }
  });
}

/* ═══════════════ Confetti ═══════════════ */
function fireConfetti(count) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  count = count || 60;
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const clrs = ['#00288e','#00554e','#89f5e7','#d4af37','#ba1a1a','#7a30d8'];
  const particles = Array.from({length:count}, () => ({
    x: canvas.width/2, y: canvas.height/3,
    vx:(Math.random()-.5)*12, vy:(Math.random()-.7)*14,
    size:Math.random()*8+4, color:clrs[Math.floor(Math.random()*clrs.length)],
    rotation:Math.random()*360, rSpeed:(Math.random()-.5)*8, alpha:1
  }));
  const t0 = performance.now();
  (function frame(now) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x+=p.vx; p.y+=p.vy; p.vy+=.35; p.rotation+=p.rSpeed; p.alpha-=.015;
      if (p.alpha > 0) { alive=true; ctx.save(); ctx.globalAlpha=Math.max(0,p.alpha); ctx.translate(p.x,p.y); ctx.rotate(p.rotation*Math.PI/180); ctx.fillStyle=p.color; ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size); ctx.restore(); }
    });
    if (alive && now-t0 < 2200) requestAnimationFrame(frame);
    else { ctx.clearRect(0,0,canvas.width,canvas.height); canvas.style.display='none'; }
  })(t0);
}

/* ═══════════════ Navigation ═══════════════ */
function showScreenEl(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');
  currentScreenId = id;
  const body = el?.querySelector('.scr-body, .scr-body-full');
  if (body) body.scrollTop = 0;
  toggleNavForScreen(id);
}

function toggleNavForScreen(id) {
  const role = CURRENT_PROFILE?.role;
  const ns = document.getElementById('nav-student');
  const nv = document.getElementById('nav-volunteer');
  const na = document.getElementById('nav-admin');
  const isStudTab  = STUDENT_TABS.includes(id);
  const isVolTab   = VOLUNTEER_TABS.includes(id);
  const isAdmTab   = ADMIN_TABS.includes(id);
  // Show nav based on current user role
  if (role === 'student')    { ns?.classList.toggle('hidden', !isStudTab);  nv?.classList.add('hidden'); na?.classList.add('hidden'); }
  else if (role === 'volunteer') { nv?.classList.toggle('hidden', !isVolTab); ns?.classList.add('hidden'); na?.classList.add('hidden'); }
  else if (role === 'admin') { na?.classList.toggle('hidden', !isAdmTab);  ns?.classList.add('hidden'); nv?.classList.add('hidden'); }
  else { ns?.classList.add('hidden'); nv?.classList.add('hidden'); na?.classList.add('hidden'); }
}

function updateNavActive(id) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-screen') === id));
}

function push(id) {
  if (currentScreenId !== id) {
    navStack.push(currentScreenId);
    showScreenEl(id);
    renderScreen(id);
    try { history.pushState({ screen: id }, '', '#' + id); } catch(e) {}
  }
}

function pop() {
  if (navStack.length) {
    const prev = navStack.pop();
    showScreenEl(prev);
    renderScreen(prev);
    updateNavActive(prev);
  } else {
    // If stack is empty on tab pages, return smoothly to user role home
    routeToRoleHome();
  }
}

function switchTab(id) {
  const role = CURRENT_PROFILE?.role || 'student';
  const home = role === 'volunteer' ? 'v-home' : role === 'admin' ? 'a-home' : 's-home';
  if (id !== home) navStack = [home];
  else navStack = [];
  showScreenEl(id);
  renderScreen(id);
  updateNavActive(id);
  try { history.pushState({ screen: id }, '', '#' + id); } catch(e) {}
}

window.addEventListener('popstate', () => {
  if (currentScreenId !== 'splash' && currentScreenId !== 'onboarding') {
    pop();
  }
});

function renderScreen(id) {
  const map = {
    's-home': renderStudentHome, 's-courses': renderStudentCourses,
    's-points': renderPoints, 's-certs': renderCerts, 's-profile': renderProfile,
    's-edit-profile': renderEditProfile, 's-leaderboard': renderLeaderboard,
    's-explore': renderExplore, 's-notifications': renderNotifications,
    'support': renderSupport,
    'v-home': renderVolunteerHome, 'v-batches': renderVolunteerBatches, 'v-courses': renderVolunteerCoursesList, 'v-profile': renderVolunteerProfile,
    'a-home': renderAdminHome, 'a-users': renderAdminUsers, 'a-courses': renderAdminCourses,
    'a-certs': renderAdminCerts, 'a-settings': renderAdminSettings,
    's-analytics': renderAnalytics,
  };
  if (map[id]) map[id]();
}

/* ═══════════════ Avatar helpers ═══════════════ */
function initialsOf(name) {
  if (!name) return '؟';
  const parts = name.trim().split(/\s+/);
  return parts[0]?.[0] || '؟';
}
function avatarHTML(profile) {
  if (profile?.avatar_url) return `<img src="${esc(profile.avatar_url)}" onerror="this.parentElement.textContent='${esc(initialsOf(profile.full_name))}'">`;
  return esc(initialsOf(profile?.full_name || ''));
}

/* ═══════════════ Local DB helpers ═══════════════ */
function getPref(key, def) {
  try { const v = localStorage.getItem('rtc_pref_' + key); return v !== null ? JSON.parse(v) : def; }
  catch(e) { return def; }
}
function setPref(key, val) { try { localStorage.setItem('rtc_pref_' + key, JSON.stringify(val)); } catch(e) {} }
function resetAppData() {
  showConfirm('مسح جميع البيانات؟', 'سيتم تسجيل الخروج وحذف كل البيانات المؤقتة المحفوظة على هذا الجهاز.', async () => {
    if (window.supabaseClient) await window.supabaseClient.auth.signOut();
    localStorage.clear();
    location.reload();
  }, { yesLabel: 'مسح ومسح الخروج' });
}

/* ═══════════════ Dark Mode ═══════════════ */
function applyDarkMode() {
  const isDark = CURRENT_PROFILE?.dark_mode ?? getPref('dark', false);
  document.documentElement.classList.toggle('dark', !!isDark);
}
async function toggleDark() {
  if (CURRENT_PROFILE) {
    CURRENT_PROFILE.dark_mode = !CURRENT_PROFILE.dark_mode;
    applyDarkMode();
    toast(CURRENT_PROFILE.dark_mode ? 'الوضع الليلي 🌙' : 'الوضع النهاري ☀️', 'info');
    if (window.supabaseClient && CURRENT_USER) {
      await window.supabaseClient.from('profiles').update({ dark_mode: CURRENT_PROFILE.dark_mode }).eq('id', CURRENT_USER.id);
    }
  }
}

/* ═══════════════ Empty State ═══════════════ */
function emptyState(icon, title, sub, btnLabel, btnClick) {
  return `<div style="padding:36px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px">
    <i class="ph-duotone ${icon}" style="font-size:46px;color:var(--mut)"></i>
    <div class="font-bold text-sm">${esc(title)}</div>
    <div class="text-xs" style="color:var(--mut)">${esc(sub)}</div>
    ${btnLabel ? `<button class="btn btn-primary btn-sm mt-2" onclick="${btnClick}">${esc(btnLabel)}</button>` : ''}
  </div>`;
}

const ALL_BRANCH_NAMES = [
  'فرع فيصل — الطوابق (الجيزة)',
  'فرع مدينة نصر (القاهرة)',
  'فرع 6 أكتوبر (الجيزة)',
  'فرع المعادي (القاهرة)',
  'فرع المقطم (القاهرة)',
  'فرع الإسكندرية — سموحة',
  'فرع مصدق — الدقي (الجيزة)',
  'فرع حلوان (القاهرة)'
];

const DEMO_COURSES = [];
const DEMO_BATCHES = [];

/* ═══════════════ Supabase: fetch courses ═══════════════ */
async function fetchCourses(force, branchFilter) {
  if (_coursesCache && !force && !branchFilter) return _coursesCache;
  let list = [];
  if (window.supabaseClient) {
    try {
      let q = window.supabaseClient.from('courses').select('*').eq('is_active', true).order('created_at');
      if (branchFilter && branchFilter !== 'الكل') q = q.eq('branch', branchFilter);
      const { data, error } = await q;
      if (!error && data) {
        list = data;
      } else if (error) {
        console.error('fetchCourses error:', error);
      }
    } catch(e) { console.warn('fetchCourses Supabase error:', e); }
  }
  if (!branchFilter || branchFilter === 'الكل') _coursesCache = list;
  return list;
}

/* ═══════════════ Supabase: fetch batches ═══════════════ */
async function fetchBatches(force, branchFilter) {
  if (_batchesCache && !force && !branchFilter) return _batchesCache;
  let list = [];
  if (window.supabaseClient) {
    try {
      let q = window.supabaseClient
        .from('batches')
        .select('*, courses(title, category, icon, color, sessions_count), profiles!instructor_id(full_name)')
        .eq('is_active', true)
        .order('created_at');
      if (branchFilter && branchFilter !== 'الكل') q = q.eq('branch', branchFilter);
      const { data, error } = await q;
      if (!error && data) {
        list = data;
      } else if (error) {
        console.error('fetchBatches error:', error);
      }
    } catch(e) { console.warn('fetchBatches Supabase error:', e); }
  }
  if (!branchFilter || branchFilter === 'الكل') _batchesCache = list;
  return list;
}

/* ═══════════════ Supabase: fetch my enrollments ═══════════════ */
async function fetchMyEnrollments() {
  if (!window.supabaseClient || !CURRENT_USER) return [];
  try {
    const { data, error } = await window.supabaseClient
      .from('enrollments')
      .select('*, batches(name, schedule, branch, sessions_done, courses(title, category, icon, color, sessions_count))')
      .eq('student_id', CURRENT_USER.id);
    if (error) throw error;
    return data || [];
  } catch(e) { console.warn('fetchMyEnrollments error:', e); return []; }
}

/* ═══════════════ Supabase: fetch my batches (volunteer) ═══════════════ */
async function fetchMyBatches() {
  if (!window.supabaseClient || !CURRENT_USER) return [];
  try {
    const { data, error } = await window.supabaseClient
      .from('batches')
      .select('*, courses(title, category, icon, color, sessions_count)')
      .eq('instructor_id', CURRENT_USER.id)
      .eq('is_active', true);
    if (error) throw error;
    return data || [];
  } catch(e) { console.warn('fetchMyBatches error:', e); return []; }
}

/* ═══════════════ Supabase: get batch students ═══════════════ */
async function fetchBatchStudents(batchId) {
  if (!window.supabaseClient) return [];
  try {
    const { data, error } = await window.supabaseClient
      .from('enrollments')
      .select('*, profiles!student_id(id, full_name, avatar_url, phone)')
      .eq('batch_id', batchId);
    if (error) throw error;
    return data || [];
  } catch(e) { console.warn('fetchBatchStudents error:', e); return []; }
}

/* ═══════════════ Supabase: fetch all profiles (admin) ═══════════════ */
async function fetchAllProfiles() {
  if (!window.supabaseClient) return [];
  try {
    const { data, error } = await window.supabaseClient.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch(e) { console.warn('fetchAllProfiles error:', e); return []; }
}

/* ═══════════════ ONBOARDING ═══════════════ */
let regState = { role:'student', name:'', phone:'', branch:'فرع مدينة نصر (القاهرة)', email:'', avatar:null, googleUser:null };

function nextOnbStep(n) {
  const step1 = document.getElementById('onb-step-1');
  const step2 = document.getElementById('onb-step-2');
  if (step1) step1.classList.toggle('active', n===1);
  if (step2) step2.classList.toggle('active', n===2);
  
  if (n===1) tryInitGoogle();
}

function triggerBranchPickerOnb() {
  const select = document.getElementById('onb-address');
  const current = select?.value || regState.branch || 'فرع مدينة نصر (القاهرة)';
  openBranchPickerModal(current, (val, lbl) => {
    regState.branch = val;
    if (select) select.value = val;
    const txt = document.getElementById('onb-branch-lbl');
    if (txt) txt.textContent = val;
  });
}

function clearFieldError(iid, eid) {
  document.getElementById(iid)?.classList.remove('bad');
  document.getElementById(eid)?.classList.remove('show');
}
function setFieldError(iid, eid) {
  document.getElementById(iid)?.classList.add('bad');
  document.getElementById(eid)?.classList.add('show');
}

/* ─── Google OAuth ─── */
async function tryInitGoogle() {
  const statusEl = document.getElementById('g-status');
  const mount    = document.getElementById('g-btn-mount');

  // If already logged in from a previous auth session
  if (window.supabaseClient) {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session?.user) {
      handleAuthSession(session);
      return;
    }
  }

  if (statusEl) { statusEl.className='g-status info'; statusEl.innerHTML='<i class="ph-fill ph-info"></i><span>اضغط الزر لتسجيل الدخول بـ Google</span>'; }
  if (mount) {
    mount.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-big w-full shadow-lg gap-3';
    btn.innerHTML = '<i class="ph-fill ph-google-logo text-xl"></i><span>تسجيل الدخول باستخدام Google</span>';
    btn.onclick = () => triggerGoogleLogin();
    mount.appendChild(btn);
  }
}

async function triggerGoogleLogin() {
  if (!window.supabaseClient) { toast('Supabase غير متصل — تحقق من الإعدادات', 'err'); return; }
  toast('جاري فتح نافذة Google...', 'info', 'ph-google-logo');
  const { error } = await window.supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: 'select_account' } }
  });
  if (error) { toast('خطأ في الاتصال بـ Google: ' + error.message, 'err'); }
}

async function handleAuthSession(session) {
  if (!session?.user) return;
  _authHandled = true;
  CURRENT_USER = session.user;
  const meta = session.user.user_metadata || {};
  const email = session.user.email || '';
  const name  = meta.full_name || meta.name || email.split('@')[0] || '';
  const pic   = meta.avatar_url || meta.picture || null;

  regState.googleUser = { email, name, picture: pic };
  regState.email = email;
  if (!regState.name || regState.name === '—') regState.name = name;
  if (pic && !regState.avatar) regState.avatar = pic;

  const nameInp  = document.getElementById('onb-name');  if (nameInp) nameInp.value = regState.name;
  const emailInp = document.getElementById('onb-email-chip'); if (emailInp) emailInp.value = email;

  // Clean URL hash
  if (window.location.hash && window.location.hash.includes('access_token')) {
    try { history.replaceState(null, '', window.location.pathname); } catch(e) {}
  }

  // Check profile
  if (window.supabaseClient) {
    try {
      const { data: prof } = await window.supabaseClient.from('profiles').select('*').eq('id', CURRENT_USER.id).maybeSingle();
      if (prof && prof.full_name && prof.phone && prof.phone.trim().length >= 10) {
        CURRENT_PROFILE = prof;
        try { localStorage.setItem('rtc_user_profile', JSON.stringify(CURRENT_PROFILE)); } catch(e) {}
        applyDarkMode();
        toast('أهلاً بعودتك يا ' + prof.full_name + '! 🎉', 'ok');
        routeToRoleHome();
        return;
      }
    } catch(e) { console.warn('Profile check error:', e); }
  }

  // New or incomplete -> Show Step 2
  toast('تم التوثيق بـ Google — يرجى إكمال رقم الموبايل والفرع 📝', 'info', 'ph-check-circle');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const onbScreen = document.getElementById('screen-onboarding');
  if (onbScreen) onbScreen.classList.add('active');
  currentScreenId = 'onboarding';
  nextOnbStep(2);
}

/* ─── Step 2: Profile submission ─── */
async function submitProfile() {
  const nameEl   = document.getElementById('onb-name');
  const phoneEl  = document.getElementById('onb-phone');
  const branchEl = document.getElementById('onb-address');
  if (!nameEl || !phoneEl || !branchEl) return;

  const name   = nameEl.value.trim();
  const phone  = phoneEl.value.trim();
  const branch = branchEl.value || 'فرع مدينة نصر (القاهرة)';

  clearFieldError('onb-name','err-name'); clearFieldError('onb-phone','err-phone');
  let ok = true;
  if (name.split(/\s+/).filter(Boolean).length < 3 || name.length < 6) { setFieldError('onb-name','err-name'); ok=false; }
  if (!/^01[0125][0-9]{8}$/.test(phone)) { setFieldError('onb-phone','err-phone'); ok=false; }
  if (!ok) { toast('يرجى مراجعة البيانات — الاسم ثلاثي ورقم موبايل صحيح','err'); return; }

  regState.name = name; regState.phone = phone; regState.branch = branch;

  const btn = document.querySelector('#onb-step-2 .btn-primary');
  if (btn) { btn.disabled=true; btn.innerHTML='<i class="ph-duotone ph-spinner" style="animation:spin 1s linear infinite"></i> جارٍ الحفظ...'; }

  if (!CURRENT_USER || !CURRENT_USER.email) {
    toast('خطأ: يلزم توثيق الحساب عبر Google أولاً','err');
    if (btn) { btn.disabled=false; btn.innerHTML='حفظ وبدء الاستخدام'; }
    nextOnbStep(1);
    return;
  }

  const emailVal  = CURRENT_USER.email;
  const avatarVal = CURRENT_USER.user_metadata?.avatar_url || CURRENT_USER.user_metadata?.picture || null;

  try {
    let prof = null;
    if (window.supabaseClient) {
      const payload = {
        id: CURRENT_USER.id,
        full_name: regState.name,
        email: emailVal,
        phone: regState.phone,
        branch: branch,
        role: 'student', // All new users are students
        avatar_url: avatarVal,
        status: 'active'
      };
      const { data, error } = await window.supabaseClient.from('profiles').upsert(payload, { onConflict: 'id' }).select().single();
      if (!error && data) prof = data;
    }

    if (!prof) {
      prof = {
        id: CURRENT_USER.id,
        full_name: regState.name,
        phone: regState.phone,
        email: emailVal,
        branch: branch,
        role: 'student',
        avatar_url: avatarVal,
        points: 50,
        status: 'active',
        badge_ids: ['welcome']
      };
    }

    CURRENT_PROFILE = prof;
    try { localStorage.setItem('rtc_user_profile', JSON.stringify(prof)); } catch(e) {}

    await awardBadge('welcome');
    applyDarkMode();
    fireConfetti();
    toast('تم إنشاء حسابك بنجاح — أهلاً بك في رسالة! 🎉','ok');
    routeToRoleHome();
  } catch(err) {
    console.error('submitProfile error:', err);
    toast('حدث خطأ أثناء التسجيل: ' + (err.message||''), 'err');
    if (btn) { btn.disabled=false; btn.innerHTML='حفظ وبدء الاستخدام'; }
  }
}

/* ─── Route to role home ─── */
function routeToRoleHome() {
  if (!CURRENT_PROFILE) { showScreenEl('onboarding'); nextOnbStep(1); return; }
  const role = CURRENT_PROFILE.role;
  if (role === 'student')    switchTab('s-home');
  else if (role === 'volunteer') switchTab('v-home');
  else switchTab('a-home');
}

/* ═══════════════ Badges ═══════════════ */
async function awardBadge(badgeId) {
  if (!CURRENT_PROFILE || !CURRENT_USER) return;
  const existing = CURRENT_PROFILE.badge_ids || [];
  if (existing.includes(badgeId)) return;
  const updated = [...existing, badgeId];
  CURRENT_PROFILE.badge_ids = updated;
  const meta = BADGES_CATALOG.find(b => b.id === badgeId);
  if (meta) toast('🏅 شارة جديدة: ' + meta.name, 'ok', 'ph-medal');
  if (window.supabaseClient && CURRENT_USER) {
    await window.supabaseClient.from('profiles').update({ badge_ids: updated }).eq('id', CURRENT_USER.id);
  }
}

async function checkBadges() {
  if (!CURRENT_PROFILE) return;
  const p = CURRENT_PROFILE;
  const enrollments = await fetchMyEnrollments();
  if (enrollments.length >= 1) await awardBadge('firstCourse');
  if (enrollments.length >= 3) await awardBadge('explorer');
  if (p.points >= 100) await awardBadge('points100');
  if (p.points >= 500) await awardBadge('points500');
  if (p.streak >= 5) await awardBadge('streak5');
}

function getGreeting() {
  const hr = new Date().getHours();
  if (hr >= 5 && hr < 12) return 'صباح الخير والهمة ☀️';
  if (hr >= 12 && hr < 18) return 'مساء الخير والنجاح 🌤️';
  return 'مساء الخير والتطوير 🌙';
}

/* ═══════════════ STUDENT HOME ═══════════════ */
async function renderStudentHome() {
  if (!CURRENT_PROFILE) return;
  const p = CURRENT_PROFILE;
  setEl('sh-name', (p.full_name.split(' ')[0] || p.full_name) + ' — ' + getGreeting());
  setEl('sh-branch', p.branch || '');
  setEl('sh-level', Math.max(1, Math.floor((p.points||0)/150)+1) + ' ⭐');
  setEl('sh-att', (p.attendance_pct||0) + '%');
  setEl('sh-pts', p.points||0);
  setEl('sh-streak', '🔥 ' + (p.streak||0));
  const av = document.getElementById('home-av'); if (av) av.innerHTML = avatarHTML(p);
  const lv = Math.max(1, Math.floor((p.points||0)/150)+1);
  const prog = Math.min(100, Math.round(((p.points||0)%150)/150*100));
  const rem  = 150 - ((p.points||0)%150);
  const lb = document.getElementById('sh-levelbar'); if (lb) lb.style.width = prog+'%';
  const lt = document.getElementById('sh-levelbar-txt'); if (lt) lt.textContent = rem + ' نقطة للمستوى التالي';

  // Dynamic Facebook Page link for user's branch
  const BRANCH_FB_LINKS = {
    'فرع مدينة نصر (القاهرة)': { name: 'فيسبوك فرع مدينة نصر 📢', desc: 'تابع جداول شهر يوليو ومواعيد المقابلات الشخصية', url: 'https://www.facebook.com/RTC.Nasrcity/?locale=ar_AR' },
    'فرع مصدق — الدقي (الجيزة)': { name: 'فيسبوك فرع مصدق (الدقي) 📢', desc: 'مواعيد فتح المجموعات والإنترفيو لفرع الدقي', url: 'https://www.facebook.com/RTC.Dokki/' },
    'فرع فيصل — الطوابق (الجيزة)': { name: 'فيسبوك فرع فيصل (الطوابق) 📢', desc: 'مواعيد الدورات والخدمات المجانية بفرع فيصل', url: 'https://www.facebook.com/RTC.Faisal/' },
    'فرع 6 أكتوبر (الجيزة)': { name: 'فيسبوك فرع 6 أكتوبر 📢', desc: 'ورش العمل ومواعيد التدريب لفرع 6 أكتوبر', url: 'https://www.facebook.com/RTC.October/' },
    'فرع سموحة (الإسكندرية)': { name: 'فيسبوك فرع سموحة (الإسكندرية) 📢', desc: 'صفحة فرع الإسكندرية لمتابعة الدورات المتاحة', url: 'https://www.facebook.com/RTC.Alex/' },
    'فرع الجيزة — نصر الدين (الجيزة)': { name: 'فيسبوك فرع الجيزة (نصر الدين) 📢', desc: 'مواعيد الدورات بفرع عمارات نصر الدين بالجيزة', url: 'https://www.facebook.com/RTC.Giza/' }
  };
  const fbInfo = BRANCH_FB_LINKS[p.branch] || BRANCH_FB_LINKS['فرع مدينة نصر (القاهرة)'];
  const fbBanner = document.getElementById('sh-fb-banner');
  if (fbBanner) {
    fbBanner.href = fbInfo.url;
    const fbTitle = fbBanner.querySelector('.fb-title'); if (fbTitle) fbTitle.textContent = fbInfo.name;
    const fbDesc = fbBanner.querySelector('.fb-desc'); if (fbDesc) fbDesc.textContent = fbInfo.desc;
  }

  // Load enrollments
  const enrollments = await fetchMyEnrollments();
  const next = document.getElementById('sh-next-lect');
  if (next) {
    if (!enrollments.length) {
      next.innerHTML = emptyState('ph-calendar-x','لا توجد محاضرات مجدولة','انضم لمجموعة تدريبية لتظهر مواعيدك هنا');
    } else {
      const e = enrollments[0];
      const b = e.batches || {};
      const c = b.courses || {};
      next.innerHTML = `<div class="c-card" style="cursor:default">
        <div class="pick-ic" style="background:${esc(c.color||'#00288e')}"><i class="${esc(c.icon||'ph-fill ph-book-open')}"></i></div>
        <div class="flex-1">
          <div class="text-sm font-bold">${esc(c.title||b.name||'—')}</div>
          <div class="text-[11px]" style="color:var(--mut)">${esc(b.schedule||'')} · ${esc(b.branch||'')}</div>
        </div>
      </div>`;
    }
  }

  const list = document.getElementById('sh-courses');
  if (list) {
    if (!enrollments.length) {
      list.innerHTML = emptyState('ph-book-open','لم تنضم لأي مجموعة بعد','استكشف المجموعات المتاحة وابدأ رحلتك', 'استكشف المجموعات', "push('s-explore')");
    } else {
      list.innerHTML = enrollments.slice(0,3).map(e => enrollmentCardHTML(e)).join('');
    }
  }

  // Badges
  const badgesEl = document.getElementById('sh-badges');
  if (badgesEl) {
    const earned = (p.badge_ids||[]);
    if (!earned.length) {
      badgesEl.innerHTML = '<div class="text-[11px]" style="color:var(--mut)">لا توجد شارات بعد — ابدأ رحلتك!</div>';
    } else {
      badgesEl.innerHTML = earned.slice(-6).reverse().map(id => {
        const b = BADGES_CATALOG.find(x => x.id===id);
        if (!b) return '';
        return `<div style="min-width:64px" class="flex flex-col items-center gap-1.5">
          <div class="badge-ic" style="background:${esc(b.color)}"><i class="${esc(b.icon)}"></i></div>
          <div class="text-[9.5px] font-bold text-center">${esc(b.name)}</div>
        </div>`;
      }).join('');
    }
  }
}

function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function enrollmentCardHTML(e) {
  const b = e.batches || {};
  const c = b.courses || {};
  const total = c.sessions_count || 1;
  const done  = e.sessions_done || 0;
  const pct   = Math.round((done/total)*100);
  const completed = done >= total;
  return `<div class="c-card" style="align-items:flex-start;cursor:default">
    <div class="pick-ic" style="background:${esc(c.color||'#00288e')}"><i class="${esc(c.icon||'ph-fill ph-book-open')}"></i></div>
    <div class="flex-1">
      <div class="flex items-center justify-between">
        <div class="text-sm font-bold">${esc(c.title||b.name||'—')}</div>
        ${completed?'<span class="status-chip st-a">مكتملة ✓</span>':''}
      </div>
      <div class="text-[11px] mt-0.5" style="color:var(--mut)">${esc(b.name||'')} · ${esc(b.branch||'')}</div>
      <div class="progress-track mt-2" style="height:6px;background:var(--line);border-radius:99px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:var(--primary);border-radius:99px;transition:width .9s cubic-bezier(.16,1,.3,1)"></div>
      </div>
      <div class="text-[10px] mt-1" style="color:var(--mut)">${done} من ${total} محاضرة (${pct}%)</div>
    </div>
  </div>`;
}

/* ═══════════════ STUDENT COURSES ═══════════════ */
async function renderStudentCourses() {
  const list = document.getElementById('sc-list');
  if (!list) return;
  list.innerHTML = emptyState('ph-spinner','جارٍ التحميل...','');
  const enrollments = await fetchMyEnrollments();
  if (!enrollments.length) {
    list.innerHTML = emptyState('ph-book-bookmark','لا توجد دورات مسجلة','اضغط استكشف للانضمام لمجموعة تدريبية','استكشف الآن',"push('s-explore')");
    return;
  }
  list.innerHTML = enrollments.map(e => enrollmentCardHTML(e)).join('');
}

let _exploreFilterText = '';
let _exploreBranchFilter = '';

function filterExploreCourses(text) {
  _exploreFilterText = (text || '').trim().toLowerCase();
  renderExploreListFiltered();
}

function setExploreBranchFilter(branch) {
  _exploreBranchFilter = branch;
  renderExploreListFiltered();
}

async function renderExploreListFiltered() {
  const list = document.getElementById('explore-list');
  if (!list) return;
  const targetBranch = _exploreBranchFilter || (CURRENT_PROFILE?.branch || 'الكل');
  const [batches, myEnroll] = await Promise.all([
    fetchBatches(true, targetBranch === 'الكل' ? null : targetBranch),
    fetchMyEnrollments()
  ]);
  const myBatchIds = new Set(myEnroll.map(e => e.batch_id));
  let available = batches.filter(b => !myBatchIds.has(b.id));

  if (_exploreFilterText) {
    available = available.filter(b => {
      const c = b.courses || {};
      const t = (c.title || b.name || '').toLowerCase();
      const br = (b.branch || '').toLowerCase();
      const cat = (c.category || '').toLowerCase();
      return t.includes(_exploreFilterText) || br.includes(_exploreFilterText) || cat.includes(_exploreFilterText);
    });
  }

  if (!available.length) {
    list.innerHTML = emptyState('ph-magnifying-glass', `لم نجد مجموعات مطابقة في ${targetBranch}`, 'اختر فرعاً آخر أو تبديل البحث لعرض كافة الكورسات المتاحة');
    return;
  }

  list.innerHTML = available.map(b => {
    const c = b.courses || {};
    return `<div class="c-card" style="align-items:flex-start;cursor:default">
      <div class="pick-ic" style="background:${esc(c.color||'#00288e')}"><i class="${esc(c.icon||'ph-fill ph-book-open')}"></i></div>
      <div class="flex-1">
        <div class="flex items-center justify-between">
          <div class="text-sm font-bold">${esc(c.title||b.name)}</div>
          <span class="chip" style="padding:4px 10px;font-size:9.5px">${esc(c.category||'')}</span>
        </div>
        <div class="text-[11px] mt-1 text-teal font-bold">${esc(b.name)} · ${esc(b.branch)}</div>
        <div class="text-[11px] mt-0.5" style="color:var(--mut)"><i class="ph-bold ph-calendar-blank"></i> ${esc(b.schedule||'')}</div>
        <div class="text-[11px] mt-0.5" style="color:var(--mut)"><i class="ph-bold ph-chalkboard-teacher"></i> ${esc((b.profiles?.full_name)||b.instructor_name||'سيتم تحديده')}</div>
        <button class="btn btn-primary btn-sm mt-2 w-full" onclick="joinBatch('${esc(b.id)}','${esc(c.id||'')}')"><i class="ph-bold ph-plus"></i> انضمام مجاني للمجموعة</button>
      </div>
    </div>`;
  }).join('');
}

async function renderExplore() {
  renderExploreListFiltered();
}

async function joinBatch(batchId, courseId) {
  if (!window.supabaseClient || !CURRENT_USER) { toast('يجب تسجيل الدخول أولاً','err'); return; }
  try {
    const { error } = await window.supabaseClient.from('enrollments').insert({
      batch_id: batchId, course_id: courseId || null, student_id: CURRENT_USER.id, sessions_done: 0
    });
    if (error) {
      if (error.code === '23505') { toast('أنت منضم بالفعل لهذه المجموعة','info'); return; }
      throw error;
    }
    // Award points
    await window.supabaseClient.from('profiles').update({ points: (CURRENT_PROFILE.points||0) + 5 }).eq('id', CURRENT_USER.id);
    if (CURRENT_PROFILE) CURRENT_PROFILE.points = (CURRENT_PROFILE.points||0) + 5;
    await checkBadges();
    _batchesCache = null;
    toast('تم الانضمام للمجموعة بنجاح 🎉', 'ok');
    renderExplore();
  } catch(e) { toast('خطأ: ' + e.message, 'err'); }
}

/* ═══════════════ POINTS & BADGES ═══════════════ */
async function renderPoints() {
  if (!CURRENT_PROFILE) return;
  // Refresh profile
  if (window.supabaseClient && CURRENT_USER) {
    const { data } = await window.supabaseClient.from('profiles').select('*').eq('id', CURRENT_USER.id).single();
    if (data) CURRENT_PROFILE = data;
  }
  const p = CURRENT_PROFILE;
  setEl('sp-pts', p.points||0);
  const countEl = document.getElementById('sp-badges-count');
  if (countEl) countEl.textContent = `(${(p.badge_ids||[]).length} من ${BADGES_CATALOG.length})`;
  const badgesEl = document.getElementById('sp-badges');
  if (badgesEl) {
    badgesEl.innerHTML = BADGES_CATALOG.map(b => {
      const earned = (p.badge_ids||[]).includes(b.id);
      return `<div class="badge-tile card p-3 flex flex-col items-center text-center gap-1.5 cursor-pointer ${earned?'':'opacity-60'}"
        style="border-radius:18px;position:relative" onclick="${earned?'':'showBadgeLocked(BADGES_CATALOG.find(x=>x.id===\''+b.id+'\'))'}">
        <div style="position:relative;width:48px;height:48px;">
          <div style="width:100%;height:100%;border-radius:16px;background:${esc(b.color)};display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;${earned?'':'filter:grayscale(0.85)'}">
            <i class="${esc(b.icon)}"></i>
          </div>
          ${earned?'':`<div style="position:absolute;top:-5px;right:-5px;width:20px;height:20px;border-radius:50%;background:var(--card);border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.25);z-index:2"><i class="ph-fill ph-lock-key" style="font-size:11px;color:var(--red)"></i></div>`}
        </div>
        <div class="font-bold text-xs mt-1">${esc(b.name)}</div>
        <div class="text-[10px]" style="color:var(--mut)">${esc(b.desc)}</div>
      </div>`;
    }).join('');
  }
}

/* ═══════════════ CERTIFICATES ═══════════════ */
async function renderCerts() {
  const list = document.getElementById('scerts-list');
  if (!list) return;
  list.innerHTML = emptyState('ph-spinner','جارٍ التحميل...','');
  if (!window.supabaseClient || !CURRENT_USER) { list.innerHTML = emptyState('ph-warning','يتطلب تسجيل دخول',''); return; }
  try {
    const { data, error } = await window.supabaseClient
      .from('certs')
      .select('*, courses(title, icon, color)')
      .eq('student_id', CURRENT_USER.id)
      .order('issued_at', { ascending: false });
    if (error) throw error;
    if (!data?.length) {
      list.innerHTML = emptyState('ph-certificate','لا توجد شهادات بعد','يجب تسجيل المتطوع حضورك في جميع محاضرات دورة كاملة لإصدار الشهادة');
      return;
    }
    list.innerHTML = data.map(cert => {
      const c = cert.courses || {};
      return `<div class="card p-4 flex items-center gap-3">
        <div class="pick-ic" style="background:linear-gradient(135deg,${esc(c.color||'#00288e')},#d4af37)"><i class="ph-fill ph-certificate"></i></div>
        <div class="flex-1">
          <div class="text-sm font-bold">${esc(c.title||'دورة تدريبية')}</div>
          <div class="text-[11px]" style="color:var(--mut)">شهادة إتمام معتمدة — مركز رسالة</div>
          <div class="text-[10px] mt-0.5" style="color:var(--mut)" dir="ltr"># ${esc(cert.serial_number)}</div>
        </div>
        <button class="btn btn-teal btn-sm" onclick="downloadCertificate('${esc(cert.id)}','${esc(c.title||'')}')"><i class="ph-bold ph-download-simple"></i> PDF</button>
      </div>`;
    }).join('');
  } catch(e) { list.innerHTML = emptyState('ph-warning','خطأ في تحميل الشهادات',e.message); }
}

function downloadCertificate(certId, courseTitle) {
  if (!CURRENT_PROFILE) return;
  toast('جارٍ تجهيز الشهادة...','info','ph-hourglass-medium');
  setTimeout(() => generateCertificatePDF({ title: courseTitle, id: certId }, CURRENT_PROFILE.full_name), 250);
}

function generateCertificatePDF(course, studentName) {
  const W=1600, H=1131;
  const cvs = document.createElement('canvas'); cvs.width=W; cvs.height=H;
  const ctx = cvs.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0,'#001a6b'); grad.addColorStop(.55,'#00288e'); grad.addColorStop(1,'#003c36');
  ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
  const pad=46;
  ctx.fillStyle='#fbfcff'; roundRect(ctx,pad,pad,W-pad*2,H-pad*2,26); ctx.fill();
  ctx.strokeStyle='#d4af37'; ctx.lineWidth=4; roundRect(ctx,pad+18,pad+18,W-pad*2-36,H-pad*2-36,18); ctx.stroke();
  ctx.textAlign='center'; ctx.direction='rtl';
  ctx.beginPath(); ctx.arc(W/2,168,54,0,Math.PI*2);
  const lg=ctx.createLinearGradient(W/2-54,120,W/2+54,220); lg.addColorStop(0,'#00288e'); lg.addColorStop(1,'#00554e');
  ctx.fillStyle=lg; ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='800 46px Inter,sans-serif'; ctx.fillText('R',W/2,185);
  ctx.fillStyle='#0f1420'; ctx.font='700 30px "IBM Plex Sans Arabic",sans-serif'; ctx.fillText('مركز رسالة للتنمية والتطوير',W/2,262);
  ctx.font='800 62px "IBM Plex Sans Arabic",sans-serif'; ctx.fillStyle='#00288e'; ctx.fillText('شهادة إتمام دورة تدريبية',W/2,360);
  ctx.font='400 26px "IBM Plex Sans Arabic",sans-serif'; ctx.fillStyle='#667085'; ctx.fillText('تشهد إدارة مركز رسالة للتنمية والتطوير بأن الطالب/ة',W/2,460);
  ctx.font='800 54px "IBM Plex Sans Arabic",sans-serif'; ctx.fillStyle='#0f1420'; ctx.fillText(studentName,W/2,540);
  ctx.font='400 26px "IBM Plex Sans Arabic",sans-serif'; ctx.fillStyle='#667085'; ctx.fillText('قد أتم / أتمت بنجاح متطلبات دورة',W/2,610);
  ctx.font='700 40px "IBM Plex Sans Arabic",sans-serif'; ctx.fillStyle='#00554e'; ctx.fillText(course.title,W/2,668);
  ctx.font='400 22px "IBM Plex Sans Arabic",sans-serif'; ctx.fillStyle='#667085';
  const dateStr = new Date().toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'});
  ctx.fillText('بتاريخ ' + dateStr,W/2,712);
  ctx.strokeStyle='#e3e7f0'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(pad+120,H-190); ctx.lineTo(W-pad-120,H-190); ctx.stroke();
  ctx.font='700 24px "IBM Plex Sans Arabic",sans-serif'; ctx.fillStyle='#0f1420';
  ctx.fillText('إدارة مركز رسالة',W/2+380,H-140);
  ctx.font='400 18px "IBM Plex Sans Arabic",sans-serif'; ctx.fillStyle='#667085';
  ctx.fillText('اعتماد الشهادة',W/2+380,H-108);
  ctx.font='400 16px monospace'; ctx.fillStyle='#a3abbf';
  ctx.fillText('RTC-CERT-' + (course.id||'').toString().toUpperCase().slice(0,8),W/2,H-56);

  if (window.jspdf?.jsPDF) {
    const doc = new jspdf.jsPDF({orientation:'landscape',unit:'px',format:[W,H]});
    doc.addImage(cvs.toDataURL('image/png'),'PNG',0,0,W,H);
    doc.save('شهادة - ' + course.title + '.pdf');
    toast('تم تحميل الشهادة ✓','ok','ph-download-simple');
  } else {
    const a = document.createElement('a'); a.href=cvs.toDataURL('image/png'); a.download='شهادة - '+course.title+'.png'; a.click();
    toast('تم استخراج الشهادة ✓','ok','ph-download-simple');
  }
}

function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

/* ═══════════════ PRO TOOLS & HELPERS ═══════════════ */
function exportToCSV(filename, headers, rows) {
  let csvContent = '\uFEFF' + headers.join(',') + '\n';
  rows.forEach(rowArray => {
    let row = rowArray.map(val => `"${String(val||'').replace(/"/g, '""')}"`).join(',');
    csvContent += row + '\n';
  });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast('تم تصدير ملف CSV بنجاح 📊', 'ok', 'ph-file-csv');
}

function exportBatchRosterCSV() {
  if (!_currentBatch || !_batchStudents.length) { toast('لا توجد بيانات للتصدير','err'); return; }
  const headers = ['اسم الطالب', 'رقم الهاتف', 'المحاضرات المنجزة', 'الفرع'];
  const rows = _batchStudents.map(e => [
    (e.profiles||{}).full_name || '—',
    (e.profiles||{}).phone || '—',
    e.sessions_done || 0,
    _currentBatch.branch || '—'
  ]);
  exportToCSV(`حضور_${_currentBatch.name}.csv`, headers, rows);
}

function openVerifyCertModal() {
  let old = document.getElementById('modal-verify-cert'); if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'modal-verify-cert'; modal.className = 'modal-bg open';
  modal.innerHTML = `
    <div class="modal-sheet text-right max-w-md mx-auto flex flex-col gap-4" style="border-radius:28px">
      <div class="modal-handle"></div>
      <div class="flex items-center gap-3 border-b border-line pb-3">
        <div class="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center text-xl font-bold"><i class="ph-bold ph-shield-check"></i></div>
        <div><h3 class="text-base font-bold">التحقق المباشر من صحة الشهادة</h3><p class="text-xs text-muted">أدخل الكود التسلسلي المكتوب على الشهادة</p></div>
      </div>
      <div class="flex flex-col gap-3">
        <div><label class="lbl">كود الشهادة التسلسلي (Serial Number) <b>*</b></label><input class="inp font-mono" id="vc-code" type="text" placeholder="RTC-CERT-XXXXXX" dir="ltr" style="text-align:left"></div>
        <div id="vc-result" class="hidden"></div>
      </div>
      <div class="flex gap-2 mt-2">
        <button class="btn btn-soft btn-mid flex-1" id="vc-close">إغلاق</button>
        <button class="btn btn-primary btn-mid flex-1" onclick="verifyCertCode()"><i class="ph-bold ph-magnifying-glass"></i> تحقق الآن</button>
      </div>
    </div>`;
  document.getElementById('app').appendChild(modal);
  modal.querySelector('#vc-close').onclick = () => modal.remove();
}

async function verifyCertCode() {
  const code = document.getElementById('vc-code')?.value.trim();
  const res = document.getElementById('vc-result');
  if (!code) { toast('أدخل كود الشهادة أولاً','err'); return; }
  if (!res) return;
  res.classList.remove('hidden');
  res.innerHTML = '<div class="text-xs text-muted text-center py-2"><i class="ph-bold ph-spinner" style="animation:spin 1s linear infinite"></i> جارٍ التحقق من قاعدة البيانات...</div>';

  if (!window.supabaseClient) {
    res.innerHTML = '<div class="g-status err"><i class="ph-bold ph-x-circle"></i> يتطلب الاتصال بـ Supabase</div>';
    return;
  }
  try {
    const { data, error } = await window.supabaseClient.rpc('verify_certificate', { p_serial: code });
    if (error) throw error;
    if (data && data.length > 0 && data[0].is_valid) {
      const v = data[0];
      res.innerHTML = `
        <div class="card p-3 bg-teal-50 border-teal-200 text-teal-900 flex flex-col gap-1 text-xs">
          <div class="font-bold text-sm text-teal-700 flex items-center gap-1.5"><i class="ph-fill ph-check-circle"></i> شهادة موثقة وصحيحة 100% ✓</div>
          <div><b>اسم الطالب:</b> ${esc(v.student_name)}</div>
          <div><b>الدورة التدريبية:</b> ${esc(v.course_title)}</div>
          <div><b>تاريخ الإصدار:</b> ${new Date(v.issued_date).toLocaleDateString('ar-EG')}</div>
        </div>`;
    } else {
      res.innerHTML = '<div class="card p-3 bg-red-50 border-red-200 text-red-800 text-xs font-bold flex items-center gap-1.5"><i class="ph-fill ph-warning-circle"></i> كود غير صحيح أو لم يظهر في السجلات</div>';
    }
  } catch(e) {
    res.innerHTML = `<div class="card p-3 bg-red-50 text-red-800 text-xs">خطأ: ${esc(e.message)}</div>`;
  }
}

// Network Online/Offline Banner Alerts
window.addEventListener('online', () => toast('تم استعادة الاتصال بالسحابة 🟢', 'ok'));
window.addEventListener('offline', () => toast('انقطع الاتصال — تعمل الآن في وضع الأوفلاين 🟡', 'warn'));

/* ═══════════════ STUDENT PROFILE ═══════════════ */
async function renderProfile() {
  if (!CURRENT_PROFILE) return;
  // Refresh
  if (window.supabaseClient && CURRENT_USER) {
    const { data } = await window.supabaseClient.from('profiles').select('*').eq('id', CURRENT_USER.id).single();
    if (data) CURRENT_PROFILE = data;
  }
  const p = CURRENT_PROFILE;
  const av = document.getElementById('pf-av'); if (av) av.innerHTML = avatarHTML(p);
  setEl('pf-name', p.full_name);
  setEl('pf-branch', p.branch);
  setEl('pf-phone', p.phone || '—');
  setEl('pf-branch2', p.branch);
  setEl('pf-email', p.email || 'غير مسجل بريد');
  setEl('pf-google', p.via_google ? 'موثق عبر Google ✓' : 'حساب محلي');
  setEl('pf-cloud', window.supabaseClient ? 'Supabase متزامن ✓' : 'محلي');

  // Render Smart Digital Student Card if container exists or prepend
  let cardBox = document.getElementById('pf-smart-card');
  if (!cardBox) {
    const pfBody = document.querySelector('#screen-s-profile .scr-body');
    if (pfBody) {
      const div = document.createElement('div');
      div.id = 'pf-smart-card';
      div.className = 'mb-3';
      pfBody.insertBefore(div, pfBody.firstChild);
      cardBox = div;
    }
  }
  if (cardBox) {
    cardBox.innerHTML = `
      <div class="p-4 rounded-3xl text-white shadow-xl relative overflow-hidden" style="background:linear-gradient(135deg,#001a6b 0%,#00288e 55%,#00554e 100%)">
        <div class="flex justify-between items-start">
          <div>
            <div class="text-[10px] text-white/70">جمعية رسالة — مركز التدريب والتطوير</div>
            <div class="text-base font-bold mt-1">${esc(p.full_name)}</div>
            <div class="text-xs text-white/80 mt-0.5">${esc(p.branch||'')}</div>
          </div>
          <div class="avatar w-11 h-11 text-xs border-2 border-white/30 shadow-md">${avatarHTML(p)}</div>
        </div>
        <div class="flex justify-between items-end mt-4 pt-3 border-t border-white/20 text-xs">
          <div><div class="text-[9px] text-white/60">كود العضوية</div><div class="font-mono font-bold" dir="ltr">RTC-${(p.id||'').slice(0,8).toUpperCase()}</div></div>
          <div><div class="text-[9px] text-white/60">المستوى</div><div class="font-bold">${Math.max(1, Math.floor((p.points||0)/150)+1)} ⭐</div></div>
          <div><div class="text-[9px] text-white/60">النقاط</div><div class="font-bold">${p.points||0} ن</div></div>
        </div>
      </div>`;
  }
}

function renderEditProfile() {
  if (!CURRENT_PROFILE) return;
  const p = CURRENT_PROFILE;
  const av = document.getElementById('ep-av');
  if (av) av.innerHTML = avatarHTML(p) + '<span class="av-cam"><i class="ph-bold ph-camera"></i></span>';
  const n = document.getElementById('ep-name'); if (n) n.value = p.full_name;
  const ph = document.getElementById('ep-phone'); if (ph) ph.value = p.phone || '';
  const br = document.getElementById('ep-branch'); if (br) br.value = p.branch || '';
}

function editAvatar(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    if (CURRENT_PROFILE) CURRENT_PROFILE.avatar_url = e.target.result;
    const av = document.getElementById('ep-av');
    if (av) av.innerHTML = `<img src="${e.target.result}"><span class="av-cam"><i class="ph-bold ph-camera"></i></span>`;
  };
  reader.readAsDataURL(file);
}

async function saveEditProfile() {
  if (!CURRENT_PROFILE) return;
  const name  = document.getElementById('ep-name')?.value.trim();
  const phone = document.getElementById('ep-phone')?.value.trim();
  const branch= document.getElementById('ep-branch')?.value;
  if (name.split(/\s+/).filter(Boolean).length < 2) { toast('يرجى إدخال اسم صحيح','err'); return; }
  if (!/^01[0125][0-9]{8}$/.test(phone)) { toast('رقم الهاتف غير صحيح','err'); return; }
  CURRENT_PROFILE.full_name = name; CURRENT_PROFILE.phone = phone; CURRENT_PROFILE.branch = branch;
  if (window.supabaseClient && CURRENT_USER) {
    const { error } = await window.supabaseClient.from('profiles').update({
      full_name: name, phone, branch, avatar_url: CURRENT_PROFILE.avatar_url, updated_at: new Date().toISOString()
    }).eq('id', CURRENT_USER.id);
    if (error) { toast('خطأ في الحفظ: ' + error.message, 'err'); return; }
  }
  toast('تم حفظ التعديلات بنجاح ✓','ok');
  pop();
}

/* ═══════════════ LEADERBOARD (real data) ═══════════════ */
async function renderLeaderboard() {
  const lbEl = document.getElementById('lb-list');
  if (!lbEl) return;
  lbEl.innerHTML = emptyState('ph-spinner','جارٍ التحميل...','');
  if (!window.supabaseClient) { lbEl.innerHTML = emptyState('ph-warning','يتطلب اتصالاً بالإنترنت',''); return; }
  try {
    const { data, error } = await window.supabaseClient
      .from('profiles')
      .select('id, full_name, points, avatar_url, role')
      .eq('role','student')
      .order('points', { ascending: false })
      .limit(20);
    if (error) throw error;
    if (!data?.length) { lbEl.innerHTML = emptyState('ph-trophy','لا توجد بيانات بعد','سجل حضور ليظهر اسمك هنا'); return; }
    const medals = ['🥇','🥈','🥉'];
    lbEl.innerHTML = data.map((p,i) => {
      const isMe = p.id === CURRENT_USER?.id;
      return `<div class="lb-row card p-3 flex items-center gap-3 mb-2 ${isMe?'border-2 border-primary':''}">
        <div class="font-bold text-sm w-6 text-center">${medals[i]||(i+1)}</div>
        <div class="avatar w-9 h-9 text-xs">${avatarHTML(p)}</div>
        <div class="flex-1 text-sm font-bold">${esc(p.full_name)}${isMe?' (أنت)':''}</div>
        <div class="text-sm font-bold" style="color:var(--primary)">${p.points||0} ن</div>
      </div>`;
    }).join('');
  } catch(e) { lbEl.innerHTML = emptyState('ph-warning','خطأ في التحميل',e.message); }
}

/* ═══════════════ NOTIFICATIONS ═══════════════ */
async function renderNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = emptyState('ph-spinner','جارٍ التحميل...','');
  if (!window.supabaseClient || !CURRENT_USER) {
    list.innerHTML = emptyState('ph-bell-slash','لا توجد إشعارات جديدة','ستظهر هنا تحديثات رحلتك التدريبية');
    return;
  }
  try {
    const { data, error } = await window.supabaseClient
      .from('notifications')
      .select('*')
      .eq('user_id', CURRENT_USER.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!data?.length) {
      list.innerHTML = emptyState('ph-bell-slash','لا توجد إشعارات جديدة','ستظهر هنا إشعارات التأجيل والإلغاء والتنبيهات الخاصة بك');
      return;
    }
    list.innerHTML = data.map(n => `
      <div class="card p-3 mb-2 flex items-start gap-3 ${n.type==='cancelled'||n.type==='postponed'?'border-2 border-amber-300 bg-amber-50':''}">
        <div class="pick-ic" style="background:${n.type==='cancelled'?'var(--red)':n.type==='postponed'?'var(--amber)':'var(--primary)'}"><i class="ph-fill ${n.type==='cancelled'?'ph-x-circle':n.type==='postponed'?'ph-clock-countdown':'ph-bell'}"></i></div>
        <div class="flex-1">
          <div class="text-sm font-bold">${esc(n.title)}</div>
          <div class="text-xs mt-1 leading-relaxed">${esc(n.message)}</div>
          <div class="text-[10px] text-muted mt-1.5" dir="ltr">${new Date(n.created_at).toLocaleString('ar-EG')}</div>
        </div>
      </div>`).join('');
  } catch(e) {
    list.innerHTML = emptyState('ph-bell-slash','لا توجد إشعارات حالياً','');
  }
}

/* ═══════════════ SUPPORT ═══════════════ */
function renderSupport() {
  const faqEl = document.getElementById('faq-list');
  if (!faqEl) return;
  faqEl.innerHTML = FAQ.map((f,i) => `
    <div class="faq-item card p-3 mb-2" id="faq-${i}">
      <div class="faq-q font-bold text-sm cursor-pointer flex items-center justify-between" onclick="toggleFaq(${i})">
        <span>${esc(f.q)}</span><i class="ph-bold ph-caret-down text-mut faq-caret"></i>
      </div>
      <div class="faq-a text-xs leading-relaxed">${esc(f.a)}</div>
    </div>`).join('');
}
function toggleFaq(i) { document.getElementById('faq-'+i)?.classList.toggle('open'); }

/* ═══════════════ VOLUNTEER HOME ═══════════════ */
async function renderVolunteerHome() {
  if (!CURRENT_PROFILE) return;
  setEl('vh-name', CURRENT_PROFILE.full_name.split(' ')[0]);
  setEl('vh-branch', CURRENT_PROFILE.branch || '');
  const av = document.getElementById('vh-av'); if (av) av.innerHTML = avatarHTML(CURRENT_PROFILE);
  const myBatches = await fetchMyBatches();
  const vhBatches = document.getElementById('vh-batches');
  if (vhBatches) {
    if (!myBatches.length) {
      vhBatches.innerHTML = emptyState('ph-users-three','لا توجد مجموعات بعد','أضف مجموعتك الأولى لتبدأ الإشراف على الطلاب','إضافة مجموعة','openAddBatchModal()');
    } else {
      vhBatches.innerHTML = myBatches.map(b => batchSummaryCard(b)).join('');
    }
  }
}

function batchSummaryCard(b) {
  const c = b.courses || {};
  return `<div class="c-card" onclick="openBatchDetail('${esc(b.id)}')">
    <div class="pick-ic" style="background:${esc(c.color||'#00288e')}"><i class="${esc(c.icon||'ph-fill ph-book-open')}"></i></div>
    <div class="flex-1">
      <div class="text-sm font-bold">${esc(b.name)}</div>
      <div class="text-[11px]" style="color:var(--mut)">${esc(c.title||'')} · ${esc(b.branch)}</div>
      <div class="text-[11px]" style="color:var(--mut)">${esc(b.schedule||'')}</div>
    </div>
    <i class="ph-bold ph-caret-left" style="color:var(--mut)"></i>
  </div>`;
}

/* ═══════════════ VOLUNTEER BATCHES (تسجيل الحضور) ═══════════════ */
let _currentBatch = null;
let _batchStudents = [];
let _attendanceState = {};

async function renderVolunteerBatches() {
  const list = document.getElementById('vb-list');
  if (!list) return;
  list.innerHTML = emptyState('ph-spinner','جارٍ التحميل...','');
  const myBatches = await fetchMyBatches();
  if (!myBatches.length) {
    list.innerHTML = emptyState('ph-users-three','لا توجد مجموعات','أضف مجموعتك الأولى لتبدأ','إضافة مجموعة','openAddBatchModal()');
    return;
  }
  list.innerHTML = myBatches.map(b => batchSummaryCard(b)).join('');
}

async function openBatchDetail(batchId) {
  // Show batch detail screen with real students
  const batches = _batchesCache || await fetchBatches();
  const myBatches = await fetchMyBatches();
  _currentBatch = myBatches.find(b => b.id === batchId) || batches.find(b => b.id === batchId);
  if (!_currentBatch) { toast('لم يتم العثور على المجموعة','err'); return; }

  _batchStudents = await fetchBatchStudents(batchId);
  _attendanceState = {};

  // Create dynamic screen
  let old = document.getElementById('screen-v-batch-detail'); if (old) old.remove();
  const screen = document.createElement('div');
  screen.id = 'screen-v-batch-detail';
  screen.className = 'screen';

  const c = _currentBatch.courses || {};
  const instName = _currentBatch.instructor_name || 'سيتم تحديده من المشرف';
  screen.innerHTML = `
    <div class="glass-header"><div class="hdr">
      <button class="icon-btn" onclick="pop()"><i class="ph ph-arrow-right"></i></button>
      <h1 class="text-sm font-bold">${esc(_currentBatch.name)}</h1>
      <span class="status-chip st-a">${_batchStudents.length} طالب</span>
    </div></div>
    <div class="scr-body" id="vbd-body">
      <div class="grad-hero p-4 rounded-3xl text-white shadow-xl mb-4">
        <div class="flex justify-between items-start">
          <div>
            <div class="text-xs text-white/70">المجموعة التدريبية — فرع مدينة نصر</div>
            <div class="text-lg font-bold mt-1">${esc(c.title||_currentBatch.name)}</div>
            <div class="text-xs text-white/80 mt-0.5"><i class="ph-bold ph-calendar"></i> ${esc(_currentBatch.schedule||'')}</div>
            <div class="text-xs text-white/90 mt-1 font-bold"><i class="ph-bold ph-chalkboard-teacher"></i> المحاضر: ${esc(instName)}</div>
          </div>
          <button class="chip text-xs bg-white/20 text-white border-white/30" onclick="openAssignInstructorModal('${esc(_currentBatch.id)}')"><i class="ph-bold ph-pencil"></i> تعديل</button>
        </div>
      </div>

      <div class="flex gap-2 mb-4">
        <button class="btn btn-soft btn-sm flex-1" onclick="exportBatchRosterCSV()"><i class="ph-bold ph-file-csv"></i> تصدير الكشف (CSV)</button>
        <button class="btn btn-amber btn-sm flex-1" onclick="openNotifyBatchModal('${esc(_currentBatch.id)}')"><i class="ph-bold ph-bell-ringing"></i> إشعار تأجيل / إلغاء</button>
      </div>

      <div class="sec-t flex items-center justify-between mb-3">
        <span>تسجيل حضور اليوم</span>
        <span class="text-xs" style="color:var(--mut)" id="att-date">${new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>
      </div>
      <div id="vbd-roster" class="flex flex-col gap-2 mb-4">
        ${_batchStudents.length ? _batchStudents.map(e => {
          const prof = e.profiles || {};
          return `<div class="card p-3 flex items-center gap-3">
            <div class="avatar w-10 h-10 text-sm">${avatarHTML(prof)}</div>
            <div class="flex-1">
              <div class="text-sm font-bold">${esc(prof.full_name||'—')}</div>
              <div class="text-[11px]" style="color:var(--mut)">${esc(prof.phone||'')}</div>
            </div>
            <div class="flex gap-1.5">
              <button class="roster-chk" id="att-p-${esc(prof.id)}" onclick="setAttendance('${esc(prof.id)}','present')" title="حاضر"><i class="ph-bold ph-check"></i></button>
              <button class="roster-chk" id="att-l-${esc(prof.id)}" onclick="setAttendance('${esc(prof.id)}','late')" title="متأخر" style="font-size:13px;background:var(--card-2)">⏰</button>
              <button class="roster-chk" id="att-a-${esc(prof.id)}" onclick="setAttendance('${esc(prof.id)}','absent')" title="غائب" style="font-size:13px;background:var(--card-2)"><i class="ph-bold ph-x" style="color:var(--red)"></i></button>
            </div>
          </div>`;
        }).join('') : emptyState('ph-users','لا يوجد طلاب مسجلون في هذه المجموعة بعد','قم بدعوة الطلاب للانضمام لهذه المجموعة')}
      </div>
      ${_batchStudents.length ? `<div class="flex gap-2">
        <button class="btn btn-teal btn-big flex-1" onclick="saveAttendance()"><i class="ph-bold ph-floppy-disk"></i> حفظ وتسجيل الحضور</button>
        <button class="btn btn-primary btn-mid" onclick="issueCerts()"><i class="ph-bold ph-certificate"></i> إصدار شهادات</button>
      </div>` : ''}
    </div>`;
  document.getElementById('app').appendChild(screen);
  push('v-batch-detail');
}

function openNotifyBatchModal(batchId) {
  let old = document.getElementById('modal-notify-batch'); if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'modal-notify-batch'; modal.className = 'modal-bg open';
  modal.innerHTML = `
    <div class="modal-sheet text-right max-w-md mx-auto flex flex-col gap-4" style="border-radius:28px">
      <div class="modal-handle"></div>
      <div class="flex items-center gap-3 border-b border-line pb-3">
        <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold"><i class="ph-bold ph-bell-ringing"></i></div>
        <div><h3 class="text-base font-bold">إرسال إشعار بتأجيل أو إلغاء المحاضرة</h3><p class="text-xs text-muted">سيصل هذا التنبيه لجميع الطلاب المسجلين بالمجموعة</p></div>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="lbl">نوع التنبيه <b>*</b></label>
          <select class="inp" id="nb-type">
            <option value="postponed">تأجيل المحاضرة ⏰</option>
            <option value="cancelled">إلغاء المحاضرة 🚫</option>
            <option value="announcement">إعلان هام 📢</option>
          </select>
        </div>
        <div>
          <label class="lbl">عنوان الرسالة <b>*</b></label>
          <input class="inp" id="nb-title" type="text" value="تنبيه هـام بشأن المحاضرة">
        </div>
        <div>
          <label class="lbl">تفاصيل التنبيه والموعد البديل <b>*</b></label>
          <textarea class="inp" id="nb-msg" rows="3" placeholder="مثال: تم تأجيل محاضرة الثلاثاء القادم إلى يوم الخميس في تمام ٥ مساءً بفرع مدينة نصر"></textarea>
        </div>
      </div>
      <div class="flex gap-2 mt-2">
        <button class="btn btn-soft btn-mid flex-1" id="nb-close">إلغاء</button>
        <button class="btn btn-primary btn-mid flex-1" onclick="sendBatchNotice('${esc(batchId)}')"><i class="ph-bold ph-paper-plane-right"></i> إرسال التنبيه للجميع</button>
      </div>
    </div>`;
  document.getElementById('app').appendChild(modal);
  modal.querySelector('#nb-close').onclick = () => modal.remove();
}

async function sendBatchNotice(batchId) {
  const type  = document.getElementById('nb-type')?.value;
  const title = document.getElementById('nb-title')?.value.trim();
  const msg   = document.getElementById('nb-msg')?.value.trim();
  if (!msg) { toast('يرجى كتابة نص التنبيه أولاً','err'); return; }

  // Web Push Notification to device
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body: msg, dir: 'rtl' });
  } else if ('Notification' in window && Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(title, { body: msg, dir: 'rtl' });
    });
  }

  // Insert notification rows for enrolled students in Supabase if online
  if (window.supabaseClient && _batchStudents.length) {
    try {
      const rows = _batchStudents.map(e => ({
        user_id: (e.profiles||{}).id || e.student_id,
        title, message: msg, type
      }));
      await window.supabaseClient.from('notifications').insert(rows);
    } catch(e) { console.warn('Notification store error:', e); }
  }

  document.getElementById('modal-notify-batch')?.remove();
  toast('تم إرسال التنبيه لجميع طلاب المجموعة بنجاح 🔔', 'ok', 'ph-bell-ringing');
}

function openAssignInstructorModal(batchId) {
  let old = document.getElementById('modal-assign-inst'); if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'modal-assign-inst'; modal.className = 'modal-bg open';
  modal.innerHTML = `
    <div class="modal-sheet text-right max-w-md mx-auto flex flex-col gap-4" style="border-radius:28px">
      <div class="modal-handle"></div>
      <div class="flex items-center gap-3 border-b border-line pb-3">
        <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal flex items-center justify-center text-xl font-bold"><i class="ph-bold ph-chalkboard-teacher"></i></div>
        <div><h3 class="text-base font-bold">تعيين أو تعديل اسم المحاضر / المتطوع</h3><p class="text-xs text-muted">اكتب اسم المتطوع المسؤول عن إشراف وتدريس المجموعة</p></div>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="lbl">اسم المحاضر / المتطوع <b>*</b></label>
          <input class="inp" id="ai-name" type="text" placeholder="مثال: أ. أحمد مصطفى" value="${esc(_currentBatch?.instructor_name==='سيتم تحديده من المشرف'?'':_currentBatch?.instructor_name||'')}">
        </div>
      </div>
      <div class="flex gap-2 mt-2">
        <button class="btn btn-soft btn-mid flex-1" id="ai-close">إلغاء</button>
        <button class="btn btn-teal btn-mid flex-1" onclick="saveInstructorName('${esc(batchId)}')"><i class="ph-bold ph-floppy-disk"></i> حفظ اسم المحاضر</button>
      </div>
    </div>`;
  document.getElementById('app').appendChild(modal);
  modal.querySelector('#ai-close').onclick = () => modal.remove();
}

async function saveInstructorName(batchId) {
  const name = document.getElementById('ai-name')?.value.trim() || 'سيتم تحديده من المشرف';
  if (window.supabaseClient) {
    try {
      const { error } = await window.supabaseClient.from('batches').update({ instructor_name: name }).eq('id', batchId);
      if (error) throw error;
    } catch(e) { toast('خطأ: ' + e.message,'err'); return; }
  }
  if (_currentBatch) _currentBatch.instructor_name = name;
  _batchesCache = null;
  document.getElementById('modal-assign-inst')?.remove();
  toast('تم تعديل اسم المحاضر بنجاح ✓','ok');
  openBatchDetail(batchId);
}

function setAttendance(studentId, status) {
  _attendanceState[studentId] = status;
  // Update UI
  ['present','late','absent'].forEach(s => {
    const el = document.getElementById(`att-${s[0]}-${studentId}`);
    if (el) el.classList.toggle('on', s === status);
  });
}

async function saveAttendance() {
  if (!window.supabaseClient || !CURRENT_USER) { toast('يتطلب اتصالاً بالإنترنت','err'); return; }
  if (!Object.keys(_attendanceState).length) { toast('يجب تحديد حالة حضور الطلاب أولاً','err'); return; }

  // Create session first
  try {
    const { data: session, error: sessErr } = await window.supabaseClient.from('sessions').insert({
      batch_id: _currentBatch.id,
      title: 'محاضرة ' + ((_currentBatch.sessions_done||0)+1),
      session_number: (_currentBatch.sessions_done||0)+1,
      session_date: new Date().toISOString().split('T')[0],
      created_by: CURRENT_USER.id
    }).select().single();
    if (sessErr) throw sessErr;

    // Record attendance for each student
    const rows = Object.entries(_attendanceState).map(([sid, status]) => ({
      session_id: session.id, batch_id: _currentBatch.id, student_id: sid, status, recorded_by: CURRENT_USER.id
    }));
    const { error: attErr } = await window.supabaseClient.from('attendance').upsert(rows, { onConflict: 'session_id,student_id', ignoreDuplicates: false });
    if (attErr) throw attErr;

    // Award points to present students
    for (const [sid, status] of Object.entries(_attendanceState)) {
      const pts = status==='present'?10:status==='late'?5:0;
      if (pts > 0) {
        await window.supabaseClient.rpc('record_attendance', {
          p_session_id: session.id, p_batch_id: _currentBatch.id, p_student_id: sid, p_status: status
        });
      }
    }

    // Update batch sessions_done
    await window.supabaseClient.from('batches').update({ sessions_done: (_currentBatch.sessions_done||0)+1 }).eq('id', _currentBatch.id);

    fireConfetti(40);
    toast('تم تسجيل الحضور بنجاح لـ ' + Object.keys(_attendanceState).length + ' طالب ✓','ok');
    _batchesCache = null;
    _attendanceState = {};
    pop();
  } catch(e) { toast('خطأ في تسجيل الحضور: ' + e.message, 'err'); console.error(e); }
}

async function issueCerts() {
  if (!window.supabaseClient || !CURRENT_USER) return;
  const batch = _currentBatch;
  const course = batch.courses || {};
  if (!course.id) { toast('لا يوجد كورس مرتبط بهذه المجموعة','err'); return; }
  const total = course.sessions_count || 1;

  // Find students who completed all sessions
  const eligible = _batchStudents.filter(e => (e.sessions_done||0) >= total);
  if (!eligible.length) { toast('لا يوجد طلاب أكملوا جميع المحاضرات بعد','info'); return; }

  try {
    const rows = eligible.map(e => ({
      student_id: (e.profiles||{}).id || e.student_id,
      course_id: course.id,
      batch_id: batch.id,
      serial_number: 'RTC-' + Math.random().toString(36).substr(2,8).toUpperCase(),
      issued_by: CURRENT_USER.id
    }));
    const { error } = await window.supabaseClient.from('certs').upsert(rows, { onConflict: 'student_id,course_id', ignoreDuplicates: true });
    if (error) throw error;
    fireConfetti(80);
    toast(`تم إصدار ${eligible.length} شهادة بنجاح 🎓`, 'ok');
  } catch(e) { toast('خطأ في إصدار الشهادات: ' + e.message,'err'); }
}

/* ─── Add Batch Modal (Volunteer & Admin) ─── */
async function openAddBatchModal() {
  let old = document.getElementById('modal-add-batch'); if (old) old.remove();
  const courses = await fetchCourses();
  const coursesOpts = courses.map(c => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');

  const modal = document.createElement('div');
  modal.id = 'modal-add-batch'; modal.className = 'modal-bg open';
  modal.innerHTML = `
    <div class="modal-sheet text-right max-w-md mx-auto flex flex-col gap-4" style="border-radius:28px">
      <div class="modal-handle"></div>
      <div class="flex items-center gap-3 border-b border-line pb-3">
        <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal flex items-center justify-center text-xl font-bold"><i class="ph-bold ph-users-three"></i></div>
        <div><h3 class="text-base font-bold">إضافة مجموعة تدريبية جديدة</h3><p class="text-xs text-muted">أنشئ مجموعة وربطها بالكورس والفرع</p></div>
      </div>
      <div class="flex flex-col gap-3">
        <div>
          <label class="lbl">الكورس التدريبي <b>*</b></label>
          <select class="inp" id="nb-course">${coursesOpts||'<option value="">لا توجد كورسات — اطلب من المشرف إضافة كورسات</option>'}</select>
        </div>
        <div><label class="lbl">اسم المجموعة <b>*</b></label><input class="inp" id="nb-title" type="text" placeholder="مثال: مجموعة (أ) — السبت"></div>
        <div>
          <label class="lbl">الفرع <b>*</b></label>
          <select class="inp" id="nb-branch">
            <option value="فرع مصدق (الدقي)">فرع مصدق (الدقي) — الجيزة</option>
            <option value="فرع مدينة نصر">فرع مدينة نصر — القاهرة</option>
            <option value="فرع المعادي">فرع المعادي — القاهرة</option>
            <option value="فرع 6 أكتوبر">فرع 6 أكتوبر — الجيزة</option>
            <option value="فرع فيصل (الطوابق)">فرع فيصل (الطوابق) — الجيزة</option>
            <option value="فرع سموحة (الإسكندرية)">فرع سموحة — الإسكندرية</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="lbl">الأيام</label><input class="inp" id="nb-schedule" type="text" placeholder="مثال: السبت والإثنين"></div>
          <div><label class="lbl">الوقت</label><input class="inp" id="nb-time" type="text" placeholder="مثال: ٥:٠٠ م"></div>
        </div>
      </div>
      <div class="flex gap-2 mt-2">
        <button class="btn btn-soft btn-mid flex-1" id="nb-close">إلغاء</button>
        <button class="btn btn-teal btn-mid flex-1" onclick="saveNewBatch()"><i class="ph-bold ph-plus"></i> إنشاء المجموعة</button>
      </div>
    </div>`;
  document.getElementById('app').appendChild(modal);
  modal.querySelector('#nb-close').onclick = () => modal.remove();
}

async function saveNewBatch() {
  if (!window.supabaseClient || !CURRENT_USER) { toast('يتطلب تسجيل الدخول','err'); return; }
  const courseId   = document.getElementById('nb-course')?.value;
  const title      = document.getElementById('nb-title')?.value.trim();
  const branch     = document.getElementById('nb-branch')?.value;
  const schedDay   = document.getElementById('nb-schedule')?.value.trim();
  const schedTime  = document.getElementById('nb-time')?.value.trim();
  if (!title || title.length < 3) { toast('يرجى كتابة اسم المجموعة','err'); return; }
  if (!courseId) { toast('يرجى اختيار الكورس','err'); return; }
  try {
    const { data, error } = await window.supabaseClient.from('batches').insert({
      course_id: courseId,
      name: title,
      instructor_id: CURRENT_USER.id,
      instructor_name: CURRENT_PROFILE?.full_name || '',
      branch,
      schedule: [schedDay, schedTime].filter(Boolean).join(' — '),
    }).select().single();
    if (error) throw error;
    _batchesCache = null;
    document.getElementById('modal-add-batch')?.remove();
    fireConfetti(35);
    toast('تم إنشاء المجموعة بنجاح 🎉','ok','ph-check-circle');
    renderScreen(currentScreenId);
  } catch(e) { toast('خطأ: ' + e.message,'err'); }
}

/* ═══════════════ VOLUNTEER PROFILE ═══════════════ */
function renderVolunteerProfile() {
  if (!CURRENT_PROFILE) return;
  const p = CURRENT_PROFILE;
  const av = document.getElementById('vp-av'); if (av) av.innerHTML = avatarHTML(p);
  setEl('vp-name', p.full_name);
  setEl('vp-branch', 'متطوع بمركز رسالة — ' + (p.branch||''));
  setEl('vp-phone', p.phone||'—');
}

/* ═══════════════ ADMIN HOME ═══════════════ */
async function renderAdminHome() {
  if (!CURRENT_PROFILE) return;
  setEl('ah-name', CURRENT_PROFILE.full_name);
  if (!window.supabaseClient) { return; }
  try {
    const [{ data: profs }, { data: courses }, { data: batches }, { data: certs }] = await Promise.all([
      window.supabaseClient.from('profiles').select('id, role'),
      window.supabaseClient.from('courses').select('id').eq('is_active',true),
      window.supabaseClient.from('batches').select('id').eq('is_active',true),
      window.supabaseClient.from('certs').select('id'),
    ]);
    const students   = (profs||[]).filter(p => p.role==='student').length;
    const volunteers = (profs||[]).filter(p => p.role==='volunteer').length;
    const kpis = [
      { label:'الطلاب المسجلون', value: students, icon:'ph-fill ph-student', color:'var(--primary)' },
      { label:'المتطوعون النشطون', value: volunteers, icon:'ph-fill ph-hand-heart', color:'var(--teal)' },
      { label:'الكورسات النشطة', value: (courses||[]).length, icon:'ph-fill ph-book-open', color:'var(--gold)' },
      { label:'الشهادات الصادرة', value: (certs||[]).length, icon:'ph-fill ph-certificate', color:'var(--red)' },
    ];
    const statsEl = document.getElementById('ah-stats');
    if (statsEl) {
      statsEl.innerHTML = kpis.map(k => `
        <div class="kpi-card card p-3 flex flex-col justify-between" style="border-radius:18px">
          <i class="${esc(k.icon)}" style="font-size:22px;color:${esc(k.color)}"></i>
          <div class="text-xl font-bold mt-2">${k.value}</div>
          <div class="text-xs text-muted">${esc(k.label)}</div>
        </div>`).join('');
    }
  } catch(e) { console.warn('Admin home stats error:', e); }
}

/* ═══════════════ ADMIN USERS ═══════════════ */
async function renderAdminUsers() {
  const cntEl  = document.getElementById('au-count');
  const listEl = document.getElementById('au-list');
  if (!listEl) return;
  listEl.innerHTML = emptyState('ph-spinner','جارٍ تحميل المستخدمين...','');
  const profiles = await fetchAllProfiles();
  if (cntEl) cntEl.textContent = profiles.length;
  if (!profiles.length) { listEl.innerHTML = emptyState('ph-users','لا توجد حسابات مسجلة',''); return; }
  listEl.innerHTML = profiles.map(p => `
    <div class="c-card" style="cursor:default">
      <div class="avatar w-11 h-11 text-sm">${avatarHTML(p)}</div>
      <div class="flex-1">
        <div class="text-sm font-bold">${esc(p.full_name)}</div>
        <div class="text-[11px]" style="color:var(--mut)">${p.role==='student'?'طالب':p.role==='volunteer'?'متطوع':'مشرف'} · ${esc(p.branch||'—')}</div>
        <div class="text-[10px]" style="color:var(--mut)" dir="ltr">${esc(p.email||'')}</div>
      </div>
      <div class="flex flex-col gap-1 items-end">
        <span class="status-chip ${p.status==='active'?'st-a':p.status==='pending'?'st-p':'st-r'}">${p.status==='active'?'نشط':p.status==='pending'?'معلق':'غير نشط'}</span>
        ${p.id !== CURRENT_USER?.id ? `<button class="chip text-[10px] cursor-pointer" onclick="changeUserRole('${esc(p.id)}','${esc(p.full_name)}','${esc(p.role)}')" style="padding:3px 8px"><i class="ph ph-pencil"></i> دور</button>` : ''}
      </div>
    </div>`).join('');
}

async function changeUserRole(userId, userName, currentRole) {
  const roles = { student:'طالب', volunteer:'متطوع', admin:'مشرف' };
  const nextRole = currentRole==='student'?'volunteer':currentRole==='volunteer'?'admin':'student';
  showConfirm(`تغيير دور "${userName}"؟`, `سيتم تغيير الدور من "${roles[currentRole]}" إلى "${roles[nextRole]}".`, async () => {
    if (!window.supabaseClient) return;
    const { error } = await window.supabaseClient.from('profiles').update({ role: nextRole }).eq('id', userId);
    if (error) { toast('خطأ: '+error.message,'err'); return; }
    toast(`تم تغيير دور ${userName} إلى ${roles[nextRole]} ✓`, 'ok');
    renderAdminUsers();
  }, { yesLabel: `تغيير إلى ${roles[nextRole]}` });
}

/* ═══════════════ ADMIN COURSES ═══════════════ */
async function renderAdminCourses() {
  const listEl = document.getElementById('ac-list');
  if (!listEl) return;
  listEl.innerHTML = emptyState('ph-spinner','جارٍ التحميل...','');
  const courses = await fetchCourses(true);
  if (!courses.length) { listEl.innerHTML = emptyState('ph-book-open','لا توجد كورسات','اضغط إضافة لإنشاء أول كورس','إضافة كورس','openAddCourseModal()'); return; }
  listEl.innerHTML = courses.map(c => `
    <div class="card p-3 mb-2 flex items-center gap-3">
      <div class="pick-ic" style="background:${esc(c.color||'#00288e')}"><i class="${esc(c.icon||'ph-fill ph-book-open')}"></i></div>
      <div class="flex-1">
        <div class="text-sm font-bold">${esc(c.title)}</div>
        <div class="text-[11px]" style="color:var(--mut)">${esc(c.category||'')} · ${c.sessions_count||0} محاضرة · ${esc(c.start_date?('بداية '+c.start_date):'')}</div>
      </div>
      <div class="flex flex-col gap-1 items-end">
        <button class="chip text-[10px] text-primary cursor-pointer" onclick="openEditCourseModal('${esc(c.id)}')"><i class="ph ph-pencil"></i> تعديل</button>
        <button class="chip text-[10px] cursor-pointer" onclick="deleteCourse('${esc(c.id)}','${esc(c.title)}')" style="padding:3px 8px;color:var(--red)"><i class="ph ph-trash"></i> حذف</button>
      </div>
    </div>`).join('');
}

async function deleteCourse(courseId, courseTitle) {
  showConfirm(`حذف كورس "${courseTitle}"؟`, 'سيتم حذف الكورس وجميع بياناته المرتبطة. هذا الإجراء لا يمكن التراجع عنه.', async () => {
    if (!window.supabaseClient) return;
    const { error } = await window.supabaseClient.from('courses').update({ is_active: false }).eq('id', courseId);
    if (error) { toast('خطأ: '+error.message,'err'); return; }
    _coursesCache = null;
    toast('تم حذف الكورس ✓','ok');
    renderAdminCourses();
  }, { yesLabel: 'حذف نهائياً' });
}

async function openEditCourseModal(courseId) {
  let old = document.getElementById('modal-edit-course'); if (old) old.remove();
  const courses = _coursesCache || await fetchCourses(true);
  const course = courses.find(c => c.id === courseId);
  if (!course) { toast('لم يتم العثور على الكورس','err'); return; }

  const modal = document.createElement('div');
  modal.id = 'modal-edit-course'; modal.className = 'modal-bg open';
  modal.innerHTML = `
    <div class="modal-sheet text-right max-w-md mx-auto flex flex-col gap-4" style="border-radius:28px">
      <div class="modal-handle"></div>
      <div class="flex items-center gap-3 border-b border-line pb-3">
        <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold"><i class="ph-bold ph-pencil-simple"></i></div>
        <div><h3 class="text-base font-bold">تعديل بيانات الدورة التدريبية</h3><p class="text-xs text-muted">تحديث العنوان، المواعيد، التصنيف، والفرع</p></div>
      </div>
      <div class="flex flex-col gap-3">
        <div><label class="lbl">عنوان الدورة <b>*</b></label><input class="inp" id="ec-title" type="text" value="${esc(course.title)}"></div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="lbl">التصنيف</label><input class="inp" id="ec-cat" type="text" value="${esc(course.category||'عام')}"></div>
          <div><label class="lbl">عدد المحاضرات</label><input class="inp" id="ec-sessions" type="number" value="${course.sessions_count||8}" min="1" max="50"></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="lbl">تاريخ بداية الكورس</label><input class="inp" id="ec-start" type="text" value="${esc(course.start_date||'')}" placeholder="مثال: 7 يوليو"></div>
          <div><label class="lbl">تاريخ الإنترفيو</label><input class="inp" id="ec-interview" type="text" value="${esc(course.interview_date||'')}" placeholder="مثال: 6/7/2026"></div>
        </div>
        <div>
          <label class="lbl">الفرع</label>
          <select class="inp" id="ec-branch">
            <option value="فرع مدينة نصر" ${course.branch==='فرع مدينة نصر'?'selected':''}>فرع مدينة نصر — القاهرة</option>
            <option value="فرع مصدق (الدقي)" ${course.branch==='فرع مصدق (الدقي)'?'selected':''}>فرع مصدق (الدقي) — الجيزة</option>
            <option value="فرع فيصل (الطوابق)" ${course.branch==='فرع فيصل (الطوابق)'?'selected':''}>فرع فيصل (الطوابق) — الجيزة</option>
            <option value="فرع 6 أكتوبر" ${course.branch==='فرع 6 أكتوبر'?'selected':''}>فرع 6 أكتوبر — الجيزة</option>
            <option value="فرع سموحة (الإسكندرية)" ${course.branch==='فرع سموحة (الإسكندرية)'?'selected':''}>فرع سموحة — الإسكندرية</option>
          </select>
        </div>
        <div><label class="lbl">الوصف والمحاور</label><textarea class="inp" id="ec-desc" rows="2">${esc(course.description||'')}</textarea></div>
      </div>
      <div class="flex gap-2 mt-2">
        <button class="btn btn-soft btn-mid flex-1" id="ec-close">إلغاء</button>
        <button class="btn btn-primary btn-mid flex-1" onclick="saveEditCourse('${esc(course.id)}')"><i class="ph-bold ph-floppy-disk"></i> حفظ التعديلات</button>
      </div>
    </div>`;
  document.getElementById('app').appendChild(modal);
  modal.querySelector('#ec-close').onclick = () => modal.remove();
}

async function saveEditCourse(courseId) {
  const title          = document.getElementById('ec-title')?.value.trim();
  const category       = document.getElementById('ec-cat')?.value.trim() || 'عام';
  const sessions_count = parseInt(document.getElementById('ec-sessions')?.value) || 8;
  const start_date     = document.getElementById('ec-start')?.value.trim() || '';
  const interview_date = document.getElementById('ec-interview')?.value.trim() || '';
  const branch         = document.getElementById('ec-branch')?.value || 'فرع مدينة نصر';
  const description    = document.getElementById('ec-desc')?.value.trim() || '';

  if (!title || title.length < 3) { toast('يرجى كتابة عنوان صحيح للدورة','err'); return; }

  if (window.supabaseClient) {
    try {
      const { error } = await window.supabaseClient.from('courses').update({
        title, category, sessions_count, start_date, interview_date, branch, description
      }).eq('id', courseId);
      if (error) throw error;
    } catch(e) { toast('خطأ في حفظ التعديلات: ' + e.message, 'err'); return; }
  }

  _coursesCache = null;
  document.getElementById('modal-edit-course')?.remove();
  toast('تم تحديث بيانات الكورس بنجاح 📚', 'ok');
  renderAdminCourses();
  renderVolunteerCoursesList();
  renderExplore();
}

/* ═══════════════ VOLUNTEER COURSES & SELF-ASSIGNMENT ═══════════════ */
async function renderVolunteerCoursesList() {
  const listEl = document.getElementById('vc-list');
  if (!listEl) return;
  const selectEl = document.getElementById('vc-branch-select');
  const selectedBranch = selectEl ? selectEl.value : (CURRENT_PROFILE?.branch || 'الكل');
  listEl.innerHTML = emptyState('ph-spinner','جارٍ تحميل الكورسات والمجموعات...','');

  const courses = await fetchCourses(true, selectedBranch);
  const batches = await fetchBatches(true, selectedBranch);

  if (!courses.length) {
    listEl.innerHTML = emptyState('ph-book-open','لا توجد كورسات بهذا الفرع','اضغط على زر "+ كورس" لإضافة دورة تدريبية جديدة');
    return;
  }

  listEl.innerHTML = courses.map(c => {
    const cBatches = batches.filter(b => b.course_id === c.id || (b.courses && b.courses.title === c.title));
    return `<div class="card p-4 mb-3 flex flex-col gap-2">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="pick-ic" style="background:${esc(c.color||'#00288e')}"><i class="${esc(c.icon||'ph-fill ph-book-open')}"></i></div>
          <div>
            <div class="text-sm font-bold">${esc(c.title)}</div>
            <div class="text-xs text-muted">${esc(c.category||'عام')} · ${esc(c.branch)} · ${c.sessions_count||8} محاضرات</div>
            ${c.start_date ? `<div class="text-xs text-teal font-bold mt-0.5"><i class="ph-bold ph-calendar"></i> البداية: ${esc(c.start_date)} | المقابلة: ${esc(c.interview_date||'—')}</div>` : ''}
          </div>
        </div>
        <button class="chip text-xs text-primary" onclick="openEditCourseModal('${esc(c.id)}')"><i class="ph ph-pencil"></i> تعديل</button>
      </div>

      <div class="border-t border-line pt-2 mt-1">
        <div class="text-xs font-bold text-muted mb-1.5">المجموعات المتاحة للإشراف والتدريس:</div>
        ${cBatches.length ? cBatches.map(b => {
          const isMyBatch = b.instructor_id === CURRENT_USER?.id;
          return `<div class="bg-card-2 p-2.5 rounded-xl flex items-center justify-between gap-2 mb-1.5">
            <div>
              <div class="text-xs font-bold">${esc(b.name)}</div>
              <div class="text-[11px] text-muted">${esc(b.schedule||'')}</div>
              <div class="text-[11px] font-bold text-primary"><i class="ph-bold ph-chalkboard-teacher"></i> المحاضر: ${esc(b.instructor_name||'سيتم تحديده')}</div>
            </div>
            <div>
              ${isMyBatch ? `<span class="chip text-[10px] bg-teal-50 text-teal border-teal-200">أنت المشرف ✓</span>` : `<button class="btn btn-sm btn-teal text-[11px] py-1 h-auto" onclick="assignSelfAsInstructor('${esc(b.id)}')"><i class="ph-bold ph-hand-pointing"></i> تولّي الإشراف</button>`}
            </div>
          </div>`;
        }).join('') : `<div class="text-xs text-muted">لا توجد مجموعات بعد — <a class="text-primary font-bold" onclick="openAddBatchModal()">إضافة مجموعة</a></div>`}
      </div>
    </div>`;
  }).join('');
}

async function assignSelfAsInstructor(batchId) {
  if (!window.supabaseClient || !CURRENT_USER) return;
  const myName = CURRENT_PROFILE?.full_name || 'متطوع رسالة';
  showConfirm('تولّي إشراف هذه المجموعة؟', `سيتم تسجيلك رسمياً كـ (محاضر/مشرف) لهذه المجموعة باسم "${myName}".`, async () => {
    try {
      const { error } = await window.supabaseClient.from('batches').update({
        instructor_id: CURRENT_USER.id,
        instructor_name: myName
      }).eq('id', batchId);
      if (error) throw error;
      _batchesCache = null;
      toast('تم تسجيلك مشرفاً لهذه المجموعة بنجاح 🎉', 'ok');
      renderVolunteerCoursesList();
      renderVolunteerHome();
    } catch(e) { toast('خطأ: ' + e.message, 'err'); }
  }, { yesLabel: 'تأكيد الإشراف' });
}

function openAddCourseModal() {
  let old = document.getElementById('modal-add-course'); if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'modal-add-course'; modal.className = 'modal-bg open';
  modal.innerHTML = `
    <div class="modal-sheet text-right max-w-md mx-auto flex flex-col gap-4" style="border-radius:28px">
      <div class="modal-handle"></div>
      <div class="flex items-center gap-3 border-b border-line pb-3">
        <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl text-blue-600"><i class="ph-bold ph-book-open"></i></div>
        <div><h3 class="text-base font-bold">إضافة كورس تعليمي جديد</h3></div>
      </div>
      <div class="flex flex-col gap-3">
        <div><label class="lbl">عنوان الدورة <b>*</b></label><input class="inp" id="nc-title" type="text" placeholder="مثال: أساسيات الذكاء الاصطناعي"></div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="lbl">التصنيف</label><input class="inp" id="nc-cat" type="text" placeholder="تقنية / لغات..."></div>
          <div><label class="lbl">عدد المحاضرات</label><input class="inp" id="nc-sessions" type="number" value="8" min="1" max="50"></div>
        </div>
        <div><label class="lbl">المستوى</label>
          <select class="inp" id="nc-level">
            <option value="الكل">الكل</option><option value="مبتدئ">مبتدئ</option><option value="متوسط">متوسط</option><option value="متقدم">متقدم</option>
          </select>
        </div>
        <div><label class="lbl">وصف مبسط</label><textarea class="inp" id="nc-desc" rows="2" placeholder="أدخل تفاصيل ومحاور الدورة..."></textarea></div>
      </div>
      <div class="flex gap-2 mt-2">
        <button class="btn btn-soft btn-mid flex-1" id="nc-close">إلغاء</button>
        <button class="btn btn-primary btn-mid flex-1" onclick="saveNewCourse()"><i class="ph-bold ph-plus"></i> إضافة الكورس</button>
      </div>
    </div>`;
  document.getElementById('app').appendChild(modal);
  modal.querySelector('#nc-close').onclick = () => modal.remove();
}

async function saveNewCourse() {
  if (!window.supabaseClient) { toast('يتطلب اتصالاً بالإنترنت','err'); return; }
  const title    = document.getElementById('nc-title')?.value.trim();
  const cat      = document.getElementById('nc-cat')?.value.trim() || 'عام';
  const sessions = parseInt(document.getElementById('nc-sessions')?.value) || 8;
  const level    = document.getElementById('nc-level')?.value || 'الكل';
  const desc     = document.getElementById('nc-desc')?.value.trim() || '';
  if (!title || title.length < 3) { toast('يرجى كتابة عنوان الكورس','err'); return; }
  const colors = ['#00288e','#00554e','#7a30d8','#d4af37','#1e40af','#ba1a1a','#0b6e63'];
  const { error } = await window.supabaseClient.from('courses').insert({
    title, description: desc, category: cat, icon: 'ph-fill ph-book-open',
    color: colors[Math.floor(Math.random()*colors.length)],
    sessions_count: sessions, level, created_by: CURRENT_USER?.id
  });
  if (error) { toast('خطأ: '+error.message,'err'); return; }
  _coursesCache = null;
  document.getElementById('modal-add-course')?.remove();
  fireConfetti(35);
  toast('تم إضافة الكورس بنجاح 📚','ok','ph-check-circle');
  renderAdminCourses();
}

/* ═══════════════ ADMIN CERTS ═══════════════ */
async function renderAdminCerts() {
  const listEl = document.getElementById('acerts-list');
  if (!listEl) return;
  listEl.innerHTML = emptyState('ph-spinner','جارٍ التحميل...','');
  if (!window.supabaseClient) { listEl.innerHTML = emptyState('ph-warning','يتطلب اتصالاً',''); return; }
  try {
    const { data, error } = await window.supabaseClient
      .from('certs')
      .select('*, profiles!student_id(full_name), courses(title)')
      .order('issued_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    if (!data?.length) { listEl.innerHTML = emptyState('ph-certificate','لا توجد شهادات صادرة بعد',''); return; }
    listEl.innerHTML = data.map(cert => `
      <div class="card p-3 mb-2 flex items-center justify-between">
        <div>
          <div class="text-sm font-bold">${esc((cert.profiles||{}).full_name||'—')}</div>
          <div class="text-[11px]" style="color:var(--mut)">${esc((cert.courses||{}).title||'—')}</div>
          <div class="text-[10px]" style="color:var(--mut)" dir="ltr"># ${esc(cert.serial_number)}</div>
        </div>
        <div class="text-xs font-semibold" style="color:var(--teal)">${new Date(cert.issued_at).toLocaleDateString('ar-EG')}</div>
      </div>`).join('');
  } catch(e) { listEl.innerHTML = emptyState('ph-warning','خطأ في التحميل',e.message); }
}

/* ═══════════════ ADMIN SETTINGS ═══════════════ */
function renderAdminSettings() { /* static page */ }

/* ═══════════════ ANALYTICS DASHBOARD (real data) ═══════════════ */
async function renderAnalytics() {
  const body = document.getElementById('analytics-body');
  if (!body) return;
  body.innerHTML = emptyState('ph-spinner','جارٍ تحميل بيانات حقيقية من Supabase...','');
  if (!window.supabaseClient) { body.innerHTML = emptyState('ph-database','يتطلب الاتصال بقاعدة البيانات',''); return; }
  try {
    const [
      { data: profs  }, { data: courses }, { data: batches },
      { data: certs  }, { data: att     }, { data: enrollments }
    ] = await Promise.all([
      window.supabaseClient.from('profiles').select('id, full_name, role, branch, points, created_at, email').order('created_at', { ascending: false }),
      window.supabaseClient.from('courses').select('*').eq('is_active', true),
      window.supabaseClient.from('batches').select('*').eq('is_active', true),
      window.supabaseClient.from('certs').select('id'),
      window.supabaseClient.from('attendance').select('id, status, created_at'),
      window.supabaseClient.from('enrollments').select('id'),
    ]);

    const allProfs   = profs || [];
    const allCourses = courses || [];
    const allBatches = batches || [];
    const allCerts   = certs || [];
    const allAtt     = att || [];
    const allEnroll  = enrollments || [];

    const students   = allProfs.filter(p => p.role==='student');
    const volunteers = allProfs.filter(p => p.role==='volunteer');
    const present    = allAtt.filter(a => a.status==='present').length;
    const absent     = allAtt.filter(a => a.status==='absent').length;
    const attRate    = allAtt.length ? Math.round(present/allAtt.length*100) : 0;

    body.innerHTML = `
      <div class="flex flex-col gap-4">
        <div class="card p-4 flex items-center justify-between bg-green-50 border-green-200">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-teal flex items-center justify-center text-white text-xl"><i class="ph-bold ph-database"></i></div>
            <div><div class="text-xs font-bold text-muted">حالة قاعدة البيانات</div><div class="text-sm font-bold" style="color:var(--teal)">متصل بـ Supabase — بيانات حية 🟢</div></div>
          </div>
          <button class="btn btn-sm btn-soft" onclick="renderAnalytics()"><i class="ph-bold ph-arrows-clockwise"></i></button>
        </div>

        <div class="grid grid-cols-2 gap-3" id="ah-stats-analytics">
          ${[
            { label:'إجمالي الطلاب', val: students.length, icon:'ph-fill ph-student', color:'var(--primary)' },
            { label:'المتطوعون', val: volunteers.length, icon:'ph-fill ph-hand-heart', color:'var(--teal)' },
            { label:'الكورسات', val: allCourses.length, icon:'ph-fill ph-book-open', color:'var(--gold)' },
            { label:'المجموعات', val: allBatches.length, icon:'ph-fill ph-users-three', color:'#7a30d8' },
            { label:'التسجيلات', val: allEnroll.length, icon:'ph-fill ph-clipboard-text', color:'#0b6e63' },
            { label:'الشهادات', val: allCerts.length, icon:'ph-fill ph-certificate', color:'var(--red)' },
            { label:'جلسات الحضور', val: allAtt.length, icon:'ph-fill ph-calendar-check', color:'#1e40af' },
            { label:'معدل الحضور', val: attRate+'%', icon:'ph-fill ph-chart-line-up', color:'#854d0e' },
          ].map(k=>`<div class="kpi-card card p-3 flex flex-col"><i class="${esc(k.icon)}" style="font-size:20px;color:${esc(k.color)}"></i><div class="text-xl font-bold mt-2">${esc(String(k.val))}</div><div class="text-xs text-muted">${esc(k.label)}</div></div>`).join('')}
        </div>

        <div>
          <div class="sec-t">أحدث المستخدمين المسجلين (${allProfs.length} حساب)</div>
          <div class="card overflow-hidden">
            ${allProfs.slice(0,15).map(p=>`
              <div class="p-3 flex items-center justify-between text-xs border-b border-line last:border-0">
                <div class="flex items-center gap-2">
                  <div class="avatar w-8 h-8 text-xs">${avatarHTML(p)}</div>
                  <div>
                    <div class="font-bold text-sm">${esc(p.full_name||'—')}</div>
                    <div class="text-[10px] text-muted">${esc(p.branch||'')} · ${esc(p.email||'')}</div>
                  </div>
                </div>
                <div class="flex flex-col items-end gap-1">
                  <span class="status-chip ${p.role==='student'?'st-a':p.role==='volunteer'?'st-p':'st-r'}">${p.role==='student'?'طالب':p.role==='volunteer'?'متطوع':'مشرف'}</span>
                  <span class="text-[10px] text-muted">${p.points||0} نقطة</span>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <div>
          <div class="sec-t">الكورسات والمجموعات النشطة</div>
          <div class="card overflow-hidden">
            ${allBatches.slice(0,10).map(b=>`
              <div class="p-3 flex items-center justify-between border-b border-line last:border-0">
                <div>
                  <div class="text-sm font-bold">${esc(b.name)}</div>
                  <div class="text-[11px] text-muted">${esc(b.branch)} · ${esc(b.schedule||'')}</div>
                </div>
                <span class="status-chip st-a">${b.sessions_done||0} محاضرة</span>
              </div>`).join('') || '<div class="p-4 text-center text-xs text-muted">لا توجد مجموعات بعد</div>'}
          </div>
        </div>
      </div>`;
  } catch(e) { body.innerHTML = emptyState('ph-warning','خطأ في تحميل البيانات',e.message); }
}

/* ═══════════════ DARK MODE & LOGOUT ═══════════════ */
function askLogout() {
  showConfirm('تسجيل الخروج؟', 'هل أنت متأكد من تسجيل الخروج؟', async () => {
    if (window.supabaseClient) await window.supabaseClient.auth.signOut();
    CURRENT_USER = null; CURRENT_PROFILE = null;
    _coursesCache = null; _batchesCache = null;
    localStorage.clear();
    location.reload();
  }, { yesLabel: 'تسجيل الخروج' });
}

function parseGoogleJwtFromHash() {
  try {
    if (!window.location.hash || !window.location.hash.includes('access_token')) return null;
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const token = hashParams.get('access_token');
    if (!token) return null;

    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    const payload = JSON.parse(jsonPayload);

    if (payload && payload.sub && payload.email) {
      const meta = payload.user_metadata || {};
      const user = {
        id: payload.sub,
        email: payload.email,
        user_metadata: {
          full_name: meta.full_name || meta.name || payload.email.split('@')[0],
          name: meta.full_name || meta.name || payload.email.split('@')[0],
          avatar_url: meta.avatar_url || meta.picture || null,
          picture: meta.avatar_url || meta.picture || null
        }
      };
      return { user, access_token: token, rawPayload: payload };
    }
  } catch(e) {
    console.warn('Error parsing Google OAuth hash token:', e);
  }
  return null;
}

/* ═══════════════ APP INIT ═══════════════ */
let _authHandled = false;

document.addEventListener('DOMContentLoaded', async () => {
  applyDarkMode();

  // 1. Direct parsing of Google OAuth return token from URL Hash
  const directOAuth = parseGoogleJwtFromHash();
  if (directOAuth?.user) {
    _authHandled = true;
    CURRENT_USER = directOAuth.user;
    await handleAuthSession({ user: directOAuth.user });
    return;
  }

  const isOAuthReturn = window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('token_type'));
  if (isOAuthReturn) {
    _authHandled = true;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const onbScreen = document.getElementById('screen-onboarding');
    if (onbScreen) onbScreen.classList.add('active');
    currentScreenId = 'onboarding';
    nextOnbStep(5);
  }

  if (!window.supabaseClient) {
    console.warn('Supabase client not available');
    setTimeout(() => { if (!_authHandled) { showScreenEl('onboarding'); nextOnbStep(1); } }, 1200);
    return;
  }

  // Listen to auth state changes (handles OAuth redirect)
  window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
      _authHandled = true;
      CURRENT_USER = session.user;
      await handleAuthSession(session);
    } else if (event === 'SIGNED_OUT') {
      CURRENT_USER = null; CURRENT_PROFILE = null;
      try { localStorage.removeItem('rtc_user_profile'); } catch(e) {}
    }
  });

  // Check existing session or cached profile
  try {
    let cachedProf = null;
    try {
      const stored = localStorage.getItem('rtc_user_profile');
      if (stored) cachedProf = JSON.parse(stored);
    } catch(e) {}

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session?.user) {
      _authHandled = true;
      CURRENT_USER = session.user;
      await handleAuthSession(session);
      return;
    }

    if (cachedProf && cachedProf.full_name && cachedProf.phone && cachedProf.phone.trim().length >= 10) {
      _authHandled = true;
      CURRENT_PROFILE = cachedProf;
      applyDarkMode();
      routeToRoleHome();
      return;
    }
  } catch(e) { console.warn('Session check error:', e); }

  // Only route to onboarding step 1 if no auth handling has occurred
  setTimeout(() => {
    if (!_authHandled) {
      showScreenEl('onboarding');
      nextOnbStep(1);
    }
  }, 1000);
});

/* CSS animation for spinner */
const style = document.createElement('style');
style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
document.head.appendChild(style);