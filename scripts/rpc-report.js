#!/usr/bin/env node
/*
 * Generates docs/RPC-CONTRACT.md from the code + migrations.
 * Run: npm run rpc:report
 *
 * The report is derived, never hand-maintained, so it cannot drift from
 * what the app actually calls.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { analyse, migrationFiles } = require('./rpc-contract.js');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'RPC-CONTRACT.md');

const { schema, rows, orphans } = analyse();

function sig(def) {
  if (!def) return '—';
  const ins = def.params.filter((p) => p.mode !== 'OUT');
  const args = ins.map((p) => `${p.name} ${p.type}${p.hasDefault ? ' DEFAULT' : ''}`).join(', ');
  return `${def.name}(${args})`;
}

function statusLabel(r) {
  if (r.status === 'missing') return '❌ مفقودة';
  if (r.status === 'signature-mismatch') return '❌ توقيع غير مطابق';
  if (r.status === 'no-grant') return '⚠️ بدون GRANT';
  if (r.issues.length) return '⚠️ تحذير';
  return '✅ موجودة';
}

const lines = [];
lines.push('# عقد الـ RPC — مسار RTC');
lines.push('');
lines.push('> ملف مُولَّد آليًا بواسطة `npm run rpc:report`. لا تحرّره يدويًا.');
lines.push('>');
lines.push(`> آخر توليد من: ${migrationFiles().length} migration + كود الواجهة (\`app.js\`, \`js/\`).`);
lines.push('');
lines.push('يقارن هذا التقرير ما يستدعيه التطبيق فعليًا بما تنشئه الـ migrations.');
lines.push('أي صف غير ✅ يعني أن المستخدم سيرى خطأ من نوع:');
lines.push('`Could not find the function public.X(...) in the schema cache`.');
lines.push('');

/* ── Summary ── */
const ok = rows.filter((r) => r.status === 'ok' && !r.issues.length).length;
lines.push('## الملخص');
lines.push('');
lines.push('| المقياس | العدد |');
lines.push('| --- | --- |');
lines.push(`| دوال يستدعيها التطبيق | ${rows.length} |`);
lines.push(`| مطابقة تمامًا | ${ok} |`);
lines.push(`| بها مشكلة | ${rows.length - ok} |`);
lines.push(`| دوال معرّفة في الـ migrations | ${[...schema.functions.keys()].length} |`);
lines.push(`| جداول | ${schema.tables.size} |`);
lines.push(`| سياسات RLS | ${schema.policies.length} |`);
lines.push('');

/* ── Contract table ── */
lines.push('## الدوال المطلوبة من التطبيق');
lines.push('');
lines.push('| الدالة | المعاملات المُرسَلة من الواجهة | التوقيع في الـ migrations | موجودة؟ | الصلاحيات | مكان الاستدعاء |');
lines.push('| --- | --- | --- | --- | --- | --- |');
for (const r of rows) {
  const where = r.sites.map((s) => `\`${s.file}:${s.line}\``).join('<br>');
  const args = r.clientArgs.length ? r.clientArgs.map((a) => `\`${a}\``).join(', ') : '—';
  const def = r.match || r.defs[0];
  const defined = def ? `\`${sig(def)}\`<br><sub>${def.file}</sub>` : '—';
  const grants = r.grants.length ? r.grants.join(', ') : '—';
  lines.push(`| \`${r.name}\` | ${args} | ${defined} | ${statusLabel(r)} | ${grants} | ${where} |`);
}
lines.push('');

/* ── Issues ── */
const problems = rows.filter((r) => r.issues.length);
lines.push('## المشاكل المرصودة');
lines.push('');
if (!problems.length) {
  lines.push('لا توجد مشاكل: كل دالة يستدعيها التطبيق موجودة بتوقيع مطابق وصلاحية صحيحة.');
} else {
  for (const r of problems) {
    lines.push(`- **\`${r.name}\`** — ${r.issues.join(' ؛ ')}`);
  }
}
lines.push('');

/* ── Grants / RLS requirements ── */
lines.push('## الصلاحيات وRLS المطلوبة');
lines.push('');
lines.push('| الدور | ما يُسمح له |');
lines.push('| --- | --- |');
const anonFns = rows.filter((r) => r.grants.indexOf('anon') !== -1).map((r) => '`' + r.name + '`');
const authFns = rows.filter((r) => r.grants.indexOf('authenticated') !== -1).length;
lines.push(`| \`anon\` | ${anonFns.length ? anonFns.join(', ') : 'لا شيء'} + قراءة \`branches\` العامة |`);
lines.push(`| \`authenticated\` | ${authFns} دالة RPC + قراءة محكومة بـ RLS |`);
lines.push('| `PUBLIC` | لا شيء — مسحوبة صراحةً في migration الحارس |');
lines.push('');
lines.push('### ملاحظة مهمة عن PUBLIC');
lines.push('');
lines.push('`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated`');
lines.push('**لا** يزيل صلاحية `EXECUTE` الممنوحة تلقائيًا لـ `PUBLIC` عند إنشاء أي دالة،');
lines.push('وكل دور يرث `PUBLIC`. لذلك يجب السحب من `PUBLIC` صراحةً لكل دالة،');
lines.push('وهو ما تفعله `20260814120000_rpc_contract_guard.sql`.');
lines.push('');
lines.push('### دوال تُستدعى داخل سياسات RLS');
lines.push('');
lines.push('`is_admin` و`is_staff` و`is_instructor` و`is_instructor_for_student` و`current_role`');
lines.push('تُستدعى داخل تعبيرات RLS. تعبيرات RLS **تتحقق** من صلاحية `EXECUTE` للدور المنفِّذ');
lines.push('(بعكس دوال الـ trigger التي لا تُعاد فيها التحقق). لذا تُسحب من `PUBLIC`/`anon`');
lines.push('ثم تُمنح لـ `authenticated` فقط، وإلا فشلت كل قراءة بـ');
lines.push('`permission denied for function is_instructor`.');
lines.push('');

/* ── Tables ── */
lines.push('## الجداول وRLS');
lines.push('');
lines.push('| الجدول | RLS | عدد السياسات |');
lines.push('| --- | --- | --- |');
const polCount = {};
for (const p of schema.policies) {
  if (p.schema !== 'public') continue;
  polCount[p.table] = (polCount[p.table] || 0) + 1;
}
for (const t of [...schema.tables.keys()].sort()) {
  lines.push(`| \`${t}\` | ${schema.rlsEnabled.has(t) ? '✅' : '❌'} | ${polCount[t] || 0} |`);
}
lines.push('');

/* ── Storage ── */
lines.push('## Storage');
lines.push('');
lines.push('| الحاوية | عام؟ | الحد | السياسات |');
lines.push('| --- | --- | --- | --- |');
lines.push('| `avatars` | نعم | 1 MB — jpeg/png/webp | read (عام), write/update/delete (المالك) |');
lines.push('| `excuses` | لا | 4 MB — pdf/jpeg/png/webp | read (المالك أو staff), write/delete (المالك) |');
lines.push('');
lines.push('كل الكتابة مقيّدة بـ `(storage.foldername(name))[1] = auth.uid()::text`،');
lines.push('أي أن المستخدم لا يكتب إلا داخل مجلده.');
lines.push('');

/* ── Helper functions ── */
lines.push('## دوال داخلية (ليست RPC)');
lines.push('');
lines.push('هذه معرّفة في الـ migrations ولا يستدعيها التطبيق مباشرة:');
lines.push('');
lines.push(orphans.map((o) => '`' + o + '`').join('، '));
lines.push('');

/* ── Enforcement ── */
lines.push('## كيف يُفرَض هذا العقد');
lines.push('');
lines.push('1. `npm test` يشغّل `tests/test-rpc-contract.js` الذي يفشل إذا استدعى');
lines.push('   التطبيق دالة غير موجودة في الـ migrations، أو أرسل معاملًا باسم خاطئ،');
lines.push('   أو ظهرت overload غامضة، أو مُنحت صلاحية لـ `PUBLIC`.');
lines.push('2. `supabase/migrations/20260814120000_rpc_contract_guard.sql` يوفّق قاعدة');
lines.push('   البيانات مع العقد عند كل `db push`، ويرفض المتابعة (`RAISE EXCEPTION`)');
lines.push('   بدلًا من إنشاء دالة وهمية إذا كانت دالة متعاقد عليها غائبة فعلًا.');
lines.push('3. `npm run db:verify` يستدعي كل RPC فعليًا على قاعدة البيانات الحية');
lines.push('   بمفتاح `anon` للتأكد من أن الـ schema cache لم يعد يُرجع الخطأ.');
lines.push('');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log('تم توليد ' + path.relative(ROOT, OUT));
console.log(`  ${rows.length} RPC — ${ok} مطابقة، ${rows.length - ok} بها مشكلة`);
