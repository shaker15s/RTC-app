#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════
   اختبار عقد الـ RPC (node tests/test-rpc-contract.js)

   يمنع أن يستدعي التطبيق دالة غير موجودة في supabase/migrations،
   وهو سبب الخطأ:
     Could not find the function public.X(...) in the schema cache

   الفحوصات:
     1) كل supabase.rpc('name', {...}) في كود الواجهة له دالة مطابقة
        في الـ migrations — بالاسم وبأسماء المعاملات.
     2) لا توجد overloads غامضة (PostgREST لا يستطيع الاختيار بينها).
     3) كل RPC لها GRANT EXECUTE، ولا شيء ممنوح لـ PUBLIC.
     4) كل SECURITY DEFINER تثبّت search_path.
     5) كل جدول/عمود تقرأه الواجهة موجود، وRLS مفعّلة عليه.
     6) أي migration تنشئ أو تعدّل RPC تنتهي بـ NOTIFY pgrst.
   ════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const { analyse, parseMigrations, migrationFiles } = require('../scripts/rpc-contract.js');

const ROOT = path.join(__dirname, '..');
let failures = 0;
function check(name, cond, extra) {
  if (cond) { console.log('  ✔ ' + name); }
  else { failures += 1; console.error('  ✘ ' + name + (extra ? ' — ' + extra : '')); }
}
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }

const { schema, rows, findings } = analyse();

/* ── 1. Every RPC the client calls must exist in the migrations ── */
console.log('\n[RPC] كل دالة يستدعيها التطبيق موجودة في الـ migrations:');
check('تم العثور على استدعاءات RPC في كود الواجهة', rows.length > 0, 'المستخرِج لم يجد أي rpc(...) — تحقق من scripts/rpc-contract.js');

const missing = rows.filter((r) => r.status === 'missing');
check('لا توجد RPC مفقودة', missing.length === 0,
  missing.map((r) => r.name + ' (' + r.sites.map((s) => s.file + ':' + s.line).join(', ') + ')').join(' | '));

const mismatched = rows.filter((r) => r.status === 'signature-mismatch');
check('لا يوجد عدم تطابق في التوقيعات', mismatched.length === 0,
  mismatched.map((r) => r.name + ': ' + r.issues.join(' ; ')).join(' | '));

/* ── 2. Ambiguous overloads break PostgREST resolution ── */
console.log('\n[RPC] لا توجد overloads غامضة:');
const ambiguous = rows.filter((r) => r.issues.some((i) => i.indexOf('غامض') !== -1));
check('كل RPC لها تعريف واحد قابل للاختيار', ambiguous.length === 0,
  ambiguous.map((r) => r.name).join(', '));

/* ── 3. Grants: present, and never PUBLIC ── */
console.log('\n[RPC] الصلاحيات (grants):');
const noGrant = rows.filter((r) => r.defs.length && !r.grants.length);
check('كل RPC لها GRANT EXECUTE صريح', noGrant.length === 0, noGrant.map((r) => r.name).join(', '));

const publicGrant = rows.filter((r) => r.grants.indexOf('public') !== -1);
check('لا توجد RPC ممنوحة لـ PUBLIC', publicGrant.length === 0, publicGrant.map((r) => r.name).join(', '));

/* Only the certificate-verification RPC is meant to be reachable without a
   session; anything else exposed to anon would be a privacy regression. */
const anonExposed = rows.filter((r) => r.grants.indexOf('anon') !== -1).map((r) => r.name).sort();
check('anon مسموح لها فقط بـ verify_certificate',
  JSON.stringify(anonExposed) === JSON.stringify(['verify_certificate']),
  'anon: ' + anonExposed.join(', '));

/* ── 4. SECURITY DEFINER must pin search_path ── */
console.log('\n[RPC] أمان SECURITY DEFINER:');
const unpinned = [];
for (const [name, defs] of schema.functions) {
  for (const d of defs) {
    if (d.dropped) continue;
    if (d.securityDefiner && !d.searchPath) unpinned.push(name + ' (' + d.file + ':' + d.line + ')');
  }
}
check('كل SECURITY DEFINER تثبّت search_path', unpinned.length === 0, unpinned.join(', '));

/* ── 5. The repair migration must never weaken the database ── */
console.log('\n[RPC] الـ migration الإصلاحية آمنة:');
const guardFile = migrationFiles().filter((f) => f.indexOf('rpc_contract_guard') !== -1)[0];
check('ملف الـ migration الإصلاحية موجود', !!guardFile, 'لم يُعثر على *_rpc_contract_guard.sql');
if (guardFile) {
  const guard = read(path.join('supabase', 'migrations', guardFile));
  check('لا تعطّل RLS', !/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(guard));
  check('لا تمنح صلاحيات واسعة لـ PUBLIC', !/GRANT\s+[\s\S]{0,80}?\s+TO\s+[^;]*\bPUBLIC\b/i.test(guard));
  check('تسحب صلاحية PUBLIC صراحةً', /REVOKE\s+ALL\s+ON\s+FUNCTION[^;]*FROM\s+PUBLIC/i.test(guard));
  check('لا تنشئ دوال dummy/stub', !/RETURNS\s+\w+[\s\S]{0,120}?(TODO|dummy|stub|placeholder|NOT\s+IMPLEMENTED)/i.test(guard));
  check('ترفض المتابعة لو دالة متعاقد عليها غائبة', /RAISE\s+EXCEPTION[\s\S]{0,200}?RPC contract violated/i.test(guard));
  check('تعيد تحميل schema cache', /NOTIFY\s+pgrst\s*,\s*'reload schema'/i.test(guard));
  check('لا تمسح بيانات حية', !/\b(DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i.test(guard));
  /* The guard hardens helpers used inside RLS; those must be re-granted to
     authenticated or every policy read fails with "permission denied". */
  check('تعيد منح دوال RLS للمستخدم المسجّل',
    /GRANT EXECUTE ON FUNCTION[^;]*\|\|[^;]*TO authenticated/i.test(guard)
      || /is_admin[\s\S]{0,600}?GRANT EXECUTE[\s\S]{0,120}?authenticated/i.test(guard));
}

/* ── 6. Any migration touching RPCs must reload the schema cache ── */
console.log('\n[RPC] إشعار إعادة تحميل الـ schema:');
const notifyByFile = {};
for (const n of schema.notifies) notifyByFile[n.file] = true;
const rpcTouching = [];
for (const f of migrationFiles()) {
  const sql = read(path.join('supabase', 'migrations', f));
  if (/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION|DROP\s+FUNCTION|GRANT\s+EXECUTE/i.test(sql)) rpcTouching.push(f);
}
const withoutNotify = rpcTouching.filter((f) => !notifyByFile[f]);
/* The two historical migrations predate this rule; they are reloaded by the
   guard migration that runs after them. New migrations must comply. */
const LEGACY = ['20260813120000_production_v9.sql', '20260813190000_v100_platform.sql'];
const newOffenders = withoutNotify.filter((f) => LEGACY.indexOf(f) === -1);
check('كل migration جديدة تعدّل RPC تنتهي بـ NOTIFY pgrst', newOffenders.length === 0, newOffenders.join(', '));
check('آخر migration تعيد تحميل الـ schema cache',
  !!notifyByFile[migrationFiles()[migrationFiles().length - 1]]);

/* ── 7. Tables and columns the client reads must exist with RLS ── */
console.log('\n[SCHEMA] الجداول والأعمدة وRLS:');
const apiSrc = read('js/api.js');
const STORAGE_BUCKETS = ['avatars', 'excuses'];
const clientTables = new Set();
const fromRe = /\.from\(\s*'([a-z_]+)'\s*\)/g;
let m;
while ((m = fromRe.exec(apiSrc)) !== null) clientTables.add(m[1]);
/* .storage.from('bucket') is not a table reference. */
const storageRe = /\.storage\s*\.from\(\s*'([a-z_]+)'\s*\)/g;
const buckets = new Set();
while ((m = storageRe.exec(apiSrc)) !== null) buckets.add(m[1]);
for (const b of buckets) clientTables.delete(b);

const missingTables = [...clientTables].filter((t) => !schema.tables.has(t));
check('كل جدول تقرأه الواجهة موجود في الـ migrations', missingTables.length === 0, missingTables.join(', '));

const noRls = [...clientTables].filter((t) => schema.tables.has(t) && !schema.rlsEnabled.has(t));
check('RLS مفعّلة على كل جدول تقرأه الواجهة', noRls.length === 0, noRls.join(', '));

/* Column-level check for the explicit select('a, b, c') lists. */
const badColumns = [];
const selRe = /\.from\(\s*'([a-z_]+)'\s*\)\s*[\s\S]{0,120}?\.select\(\s*'([^']*)'/g;
while ((m = selRe.exec(apiSrc)) !== null) {
  const table = m[1];
  if (!schema.tables.has(table)) continue;
  const cols = schema.tables.get(table);
  /* Drop embedded resources like `courses(title, icon)` and `profiles!fk(x)`. */
  const flat = m[2].replace(/[a-z_]+!?[a-z_]*\s*\([^)]*\)/gi, '');
  for (const raw of flat.split(',')) {
    const col = raw.trim().replace(/!.*$/, '').trim();
    if (!col || col === '*' || col === ')') continue;
    if (!cols.has(col)) badColumns.push(table + '.' + col);
  }
}
check('كل عمود تختاره الواجهة موجود', badColumns.length === 0, [...new Set(badColumns)].join(', '));

/* ── 8. Storage buckets and their policies ── */
console.log('\n[STORAGE] الحاويات والسياسات:');
const allMigrations = migrationFiles().map((f) => read(path.join('supabase', 'migrations', f))).join('\n');
for (const b of STORAGE_BUCKETS) {
  check('حاوية ' + b + ' معرّفة', new RegExp("'" + b + "'").test(allMigrations)
    && /INSERT\s+INTO\s+storage\.buckets/i.test(allMigrations));
}
const storagePolicies = schema.policies.filter((p) => p.schema === 'storage');
check('توجد سياسات على storage.objects', storagePolicies.length > 0);
for (const b of STORAGE_BUCKETS) {
  const names = storagePolicies.map((p) => p.name);
  check(b + ' لها سياسات قراءة وكتابة وحذف',
    names.indexOf(b + '_read') !== -1 && names.indexOf(b + '_write') !== -1 && names.indexOf(b + '_delete') !== -1);
}
/* Uploads must stay scoped to the caller's own folder. */
check('الرفع مقيّد بمجلد المستخدم',
  (allMigrations.match(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/g) || []).length >= 4);

/* ── 9. No client call may bypass the audited wrapper ── */
console.log('\n[RPC] لا استدعاءات خارج الطبقة المدققة:');
const strayRpc = [];
for (const file of ['app.js']) {
  const src = read(file);
  if (/\.rpc\s*\(/.test(src)) strayRpc.push(file);
}
check('app.js لا يستدعي supabase.rpc مباشرة', strayRpc.length === 0, strayRpc.join(', '));

/* ── Summary ── */
const errors = findings.filter((f) => f.level === 'error');
console.log('\n[RPC] الملخص:');
console.log('  RPC مستدعاة من الواجهة: ' + rows.length);
console.log('  دوال معرّفة في الـ migrations: ' + [...schema.functions.keys()].length);
console.log('  جداول: ' + schema.tables.size + ' | سياسات: ' + schema.policies.length);
check('لا أخطاء في تحليل العقد', errors.length === 0, errors.map((e) => e.rpc + ': ' + e.message).join(' | '));

console.log(failures ? `\nفشل ${failures} فحص عقد RPC ❌\n` : '\nكل فحوصات عقد RPC نجحت ✅\n');
process.exit(failures ? 1 : 0);
