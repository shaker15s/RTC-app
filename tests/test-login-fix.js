/* ════════════════════════════════════════════════════════════════
   اختبار بدون أي تبعيات (node tests/test-login-fix.js)
   يختبر إصلاحات مشكلة «تسجيل الدخول / حفظ البيانات مش بيدخل»:
     1) runBtn لا يبتلع الأخطاء — يظهر toast بدل الفشل الصامت.
     2) humanError: رقم مكرر (23505) / صف مفقود / حساب موقوف.
     3) normalizePhoneDigits: أرقام عربية/فارسية + مسافات → 01XXXXXXXXX.
     4) updateMyProfile: لو مفيش صف في profiles → ensure_my_profile ثم جلب كامل.
   ════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let failures = 0;
function check(name, cond, extra) {
  if (cond) { console.log('  ✔ ' + name); }
  else { failures++; console.error('  ✘ ' + name + (extra ? ' — ' + extra : '')); }
}

/* ── Minimal DOM shims ── */
function makeEl(id) {
  return {
    id: id || '', nodeType: 1, innerHTML: '', textContent: '', value: '', disabled: false,
    style: {}, _attrs: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    removeAttribute(k) { delete this._attrs[k]; },
    appendChild(c) { this.children.push(c); return c; },
    remove() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, getBoundingClientRect() { return { width: 0, height: 0 }; }
  };
}
const toasts = [];
const els = { 'toast-ct': makeEl('toast-ct') };
const documentShim = {
  readyState: 'complete',
  documentElement: makeEl('html'),
  body: makeEl('body'),
  getElementById(id) { return els[id] || null; },
  createElement() { return makeEl(); },
  querySelectorAll() { return []; },
  addEventListener() {},
};
documentShim.body.contains = function () { return true; };

const localStorageShim = { getItem() { return null; }, setItem() {}, clear() {} };
const windowShim = {
  addEventListener() {}, removeEventListener() {},
  navigator: { vibrate() {} },
  location: { origin: 'https://x.test', pathname: '/', hostname: 'x.test', hash: '' },
  matchMedia() { return { matches: true }; },
  RTCNative: null,
};
windowShim.window = windowShim;
windowShim.document = documentShim;
windowShim.localStorage = localStorageShim;

const ctx = vm.createContext(Object.assign(windowShim, {
  console, setTimeout, clearTimeout, requestAnimationFrame(fn) { return 0; },
  performance: { now() { return 0; } },
  URLSearchParams, Promise, JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp, Error, TypeError
}));

function load(rel, appendExport) {
  let code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (appendExport) code += '\n;' + appendExport;
  vm.runInContext(code, ctx, { filename: rel });
}

/* تحميل الملفات الحقيقية بالترتيب كما في index.html */
load('js/security.js');
load('js/i18n.js');
load('js/motion.js');
load('js/ui.js');
load('app.js', `
globalThis.__T = {
  runBtn: runBtn,
  normalizePhoneDigits: normalizePhoneDigits,
  setUI: function (v) { UI = v; },
  setMotion: function (v) { window.RTCMotion = v; }
};`);

/* toast مُسجَّل */
const realToastCode = `
globalThis.__toastSpy = function (m, ty) { globalThis.__toasts.push({ m: m, ty: ty }); };
`;
vm.runInContext(`globalThis.__toasts = [];` + realToastCode, ctx);

/* UI متوافق مع الحقيقي: toast يسجل، وباقي الدوال من ui.js المحمّلة */
vm.runInContext(`
  var __realUI = window.RTCUI;
  __T.setUI({
    toast: function (m, ty) { globalThis.__toasts.push({ m: m, ty: ty }); },
    humanError: __realUI.humanError,
    esc: __realUI.esc,
    setEl: __realUI.setEl,
    showConfirm: __realUI.showConfirm,
    openPicker: function () {},
    fireConfetti: function () {}
  });
`, ctx);

const T = vm.runInContext('__T', ctx);
const getToasts = () => vm.runInContext('__toasts.slice()', ctx);
const clearToasts = () => vm.runInContext('__toasts.length = 0', ctx);
const humanError = vm.runInContext('window.RTCUI.humanError', ctx);

(async function main() {
  console.log('\n[1] runBtn لا يبتلع الخطأ (الفشل الصامت):');
  /* محاكاة مسار withButton الحقيقي: زر حقيقي العقدة + RTCMotion الحقيقي */
  clearToasts();
  const btn = makeEl('save');
  let caught = null;
  const res = await T.runBtn(btn, async function () {
    const e = new Error('duplicate key value violates unique constraint "profiles_phone_key"');
    e.code = '23505';
    throw e;
  }, 'تم ✓').catch(function (e) { caught = e; return 'PROMISE-REJECTED'; });
  const ts = getToasts();
  check('الوعد لم يُرفض (res === false)', res === false, String(res));
  check('لم يحدث unhandled rejection', caught === null, caught && caught.message);
  check('ظهر toast بخطأ مفهوم للمستخدم', ts.length === 1 && ts[0].ty === 'err', JSON.stringify(ts));
  check('رسالة الرقم المكرر واضحة', ts.length === 1 && /مربوط بحساب تاني/.test(ts[0].m), ts[0] && ts[0].m);

  console.log('\n[2] humanError — ترجمة أخطاء السيرفر:');
  const e1 = new Error('duplicate key value violates unique constraint "profiles_phone_key"'); e1.code = '23505';
  check('23505 phone → رسالة رقم مكرر', /مربوط بحساب تاني/.test(humanError(e1)));
  const e2 = new Error('JSON object requested, multiple (or no) rows returned'); e2.code = 'PGRST116';
  check('PGRST116 → إرشاد واضح', /تعذّر تحديث ملفك/.test(humanError(e2)));
  const e3 = new Error('account inactive');
  check('حساب موقوف', /إيقاف الحساب/.test(humanError(e3)));
  check('profile-missing الداخلية', /تعذّر تحديث ملفك/.test(humanError(new Error('profile-missing'))));
  const e5 = new Error('Failed to fetch');
  check('انقطاع الشبكة', /تحقق من الإنترنت/.test(humanError(e5)));
  const e6 = new Error('new row violates row-level security policy');
  check('RLS', /ليست لديك صلاحية/.test(humanError(e6)));

  console.log('\n[3] normalizePhoneDigits — أرقام عربية/فارسية/مسافات:');
  check('«٠١٠١٢٣٤٥٦٧٨» → 01012345678', T.normalizePhoneDigits('٠١٠١٢٣٤٥٦٧٨') === '01012345678', T.normalizePhoneDigits('٠١٠١٢٣٤٥٦٧٨'));
  check('«۰۱۰۱۲۳۴۵۶۷۸» فارسية', T.normalizePhoneDigits('۰۱۰۱۲۳۴۵۶۷۸') === '01012345678');
  check('«010 1234 5678» مسافات', T.normalizePhoneDigits('010 1234 5678') === '01012345678');
  check('«+20 10-1234-5678» → يقص البادئة لاحقاً عبر regex المستخدم', /^01[0125][0-9]{8}$/.test('0' + T.normalizePhoneDigits('+20 10-1234-5678').slice(-10)));
  check('فارغة آمنة', T.normalizePhoneDigits('') === '' && T.normalizePhoneDigits(null) === '');

  console.log('\n[4] updateMyProfile — الإصلاح الذاتي لصف مفقود:');
  load('js/api.js');
  /* عميل supabase وهمي: update يرجع 0 صفوف، rpc يسجل الاستدعاء، ثم الجلب يرجع الملف */
  vm.runInContext(`
    globalThis.__calls = { rpc: [], updated: false };
    var fakeProfile = { id: 'u-1', full_name: 'أحمد محمد علي', phone: '01012345678', role: 'student', status: 'active' };
    window.supabaseClient = {
      auth: { getSession: async function () { return { data: { session: { user: { id: 'u-1' } } } }; } },
      from: function (table) {
        var chain = {};
        chain.select = function () { return chain; };
        chain.eq = function () { return chain; };
        chain.update = function () { globalThis.__calls.updated = true; return chain; };
        chain.order = function () { return chain; };
        chain.maybeSingle = async function () {
          return { data: table === 'profiles' ? Object.assign({ branches: null }, fakeProfile) : null, error: null };
        };
        chain.single = async function () { return { data: fakeProfile, error: null }; };
        chain.then = function (resolve) {
          /* تحديث يرجع 0 صفوف — صف المستخدم مفقود */
          if (table === 'profiles') return resolve({ data: [], error: null });
          return resolve({ data: [], error: null });
        };
        return chain;
      },
      rpc: async function (name, args) {
        globalThis.__calls.rpc.push({ name: name, args: args });
        return { data: null, error: null };
      }
    };
  `, ctx);
  const RTCApi = vm.runInContext('window.RTCApi', ctx);
  const out = await RTCApi.updateMyProfile({ full_name: 'أحمد محمد علي', phone: '01012345678', branch_id: null, lang: undefined });
  const calls = vm.runInContext('__calls', ctx);
  check('استُدعي ensure_my_profile للإصلاح الذاتي', calls.rpc.length === 1 && calls.rpc[0].name === 'ensure_my_profile', JSON.stringify(calls.rpc));
  check('مرّر الاسم والهاتف صح', calls.rpc.length === 1 && calls.rpc[0].args.p_full_name === 'أحمد محمد علي' && calls.rpc[0].args.p_phone === '01012345678');
  check('أعاد الملف الكامل بعد الجلب', out && out.id === 'u-1' && out.role === 'student', JSON.stringify(out && out.id));

  console.log('\n[5] مسار النجاح العادي (صف موجود) لا يستدعي الـ RPC:');
  vm.runInContext(`
    __calls.rpc = [];
    var p = { id: 'u-1', role: 'student', status: 'active' };
    window.supabaseClient.from = function () {
      var chain = {};
      chain.select = function () { return chain; };
      chain.eq = function () { return chain; };
      chain.update = function () { return chain; };
      chain.then = function (resolve) { return resolve({ data: [p], error: null }); };
      return chain;
    };
  `, ctx);
  const out2 = await RTCApi.updateMyProfile({ full_name: 'أحمد محمد علي' });
  const calls2 = vm.runInContext('__calls', ctx);
  check('لا استدعاء إضافي', calls2.rpc.length === 0);
  check('أعاد الصف المحدّث', out2 && out2.id === 'u-1');

  /* خطأ فريد الهاتف يتصاعد الآن بدل ابتلاعه في الواجهة */
  vm.runInContext(`
    window.supabaseClient.from = function () {
      var chain = {};
      chain.select = function () { return chain; };
      chain.eq = function () { return chain; };
      chain.update = function () { return chain; };
      chain.then = function (resolve) {
        return resolve({ data: null, error: { message: 'duplicate key value violates unique constraint "profiles_phone_key"', code: '23505' } });
      };
      return chain;
    };
  `, ctx);
  let threw = null;
  try { await RTCApi.updateMyProfile({ full_name: 'أحمد محمد علي', phone: '01099999999' }); } catch (e) { threw = e; }
  check('خطأ 23505 يتصاعد حتى تعرضه الواجهة', threw && threw.code === '23505');

  console.log(failures === 0 ? '\nكل الاختبارات نجحت ✅\n' : '\nفشل ' + failures + ' اختبار ❌\n');
  process.exit(failures === 0 ? 0 : 1);
})().catch(function (e) { console.error('خطأ في التشغيل:', e); process.exit(1); });
