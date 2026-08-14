#!/usr/bin/env node
/*
 * Verifies the LIVE database against the RPC contract.
 * Run: npm run db:verify
 *
 * Why this exists: applying a migration is not proof that the error is gone.
 * PostgREST answers from a cached schema, so the only honest check is to
 * call each RPC over the real Data API and confirm it no longer reports
 * "Could not find the function ... in the schema cache".
 *
 * Security posture:
 *   - Uses ONLY the public anon key already shipped in js/config.js.
 *     It never asks for, reads, or accepts a service_role key.
 *   - Sends deliberately invalid arguments so nothing is created, updated
 *     or deleted. A permission/validation error is a PASS: it proves the
 *     function was found and its guards ran.
 *   - Read-only by construction; it never touches live rows.
 *
 * Exit code 0 only when every contracted RPC is resolvable.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { analyse } = require('./rpc-contract.js');

const ROOT = path.resolve(__dirname, '..');

/* Read the public config the app itself uses. */
function loadConfig() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8'), sandbox);
  return sandbox.window.RTC_CONFIG || {};
}

const cfg = loadConfig();
const URL_BASE = process.env.SUPABASE_URL || cfg.supabaseUrl;
const ANON = process.env.SUPABASE_ANON_KEY || cfg.supabaseAnonKey;

if (!URL_BASE || !ANON) {
  console.error('لا يوجد supabaseUrl/anonKey. حدّد SUPABASE_URL و SUPABASE_ANON_KEY أو js/config.js');
  process.exit(2);
}
if (/service_role/i.test(ANON)) {
  console.error('رُفض: هذا المفتاح يبدو service_role. هذا السكربت يعمل بمفتاح anon العام فقط.');
  process.exit(2);
}

/* A representative, harmless argument for each parameter type. */
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
function sampleArg(type) {
  switch (type) {
    case 'uuid': return ZERO_UUID;
    case 'uuid[]': return [];
    case 'jsonb': case 'json': return {};
    case 'int4': case 'int2': case 'int8': return 0;
    case 'bool': return false;
    default: return '';
  }
}

/* PostgREST's "function not found" signature. Everything else — 401, 403,
   a raised exception from inside the function — means the function EXISTS,
   which is exactly what we are verifying. */
function isMissing(status, body) {
  const msg = (body && (body.message || body.hint || body.details)) || '';
  if (status === 404) return true;
  if (/PGRST202/.test((body && body.code) || '')) return true;
  return /Could not find the function/i.test(msg)
      || /schema cache/i.test(msg);
}

async function callRpc(name, args) {
  const res = await fetch(`${URL_BASE.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'apikey': ANON,
      'Authorization': `Bearer ${ANON}`,
      'Content-Type': 'application/json',
      'Prefer': 'params=single-object, count=none'
    },
    body: JSON.stringify(args)
  });
  let body = null;
  try { body = await res.json(); } catch (e) { body = null; }
  return { status: res.status, body };
}

(async function main() {
  const { rows } = analyse();
  console.log(`\nالتحقق من ${rows.length} RPC على: ${URL_BASE}`);
  console.log('(بمفتاح anon العام فقط — بدون أي كتابة على البيانات)\n');

  let missing = 0;
  let reachable = 0;
  let unreachable = 0;
  const notFound = [];
  const errored = [];

  for (const r of rows) {
    const def = r.match || r.defs[0];
    const args = {};
    if (def) {
      for (const p of def.params.filter((x) => x.mode !== 'OUT')) {
        if (p.name) args[p.name] = sampleArg(p.type);
      }
    } else {
      for (const a of r.clientArgs) args[a] = '';
    }

    let out;
    try {
      out = await callRpc(r.name, args);
    } catch (e) {
      /* A network failure proves nothing either way. It must never be
         reported as success — that would be exactly the false "the live
         database is fixed" claim this script exists to prevent. */
      unreachable += 1;
      errored.push(`${r.name} (${e.message})`);
      console.log(`  ؟ ${r.name} — تعذّر الاتصال: ${e.message}`);
      continue;
    }

    if (isMissing(out.status, out.body)) {
      missing += 1;
      notFound.push(r.name);
      const msg = (out.body && out.body.message) || `HTTP ${out.status}`;
      console.log(`  ✘ ${r.name} — غير موجودة في الـ schema cache :: ${msg}`);
    } else {
      reachable += 1;
      const note = out.status >= 400
        ? `مرفوضة كما هو متوقع (${out.status})`
        : `استجابت (${out.status})`;
      console.log(`  ✔ ${r.name} — موجودة، ${note}`);
    }
  }

  console.log(`\nالنتيجة: ${reachable} موجودة، ${missing} مفقودة، ${unreachable} تعذّر الوصول إليها — من أصل ${rows.length}.`);

  if (unreachable) {
    console.error('\n⚠️  لم يكتمل التحقق: تعذّر الوصول إلى قاعدة البيانات.');
    console.error('    لا يمكن التأكيد بأن قاعدة البيانات الحية سليمة أو معطوبة.');
    console.error('    أمثلة: ' + errored.slice(0, 3).join(' | '));
    console.error('    تأكد من الشبكة/الـ URL ثم أعد التشغيل.');
    process.exit(2);
  }
  if (missing) {
    console.error('\nالدوال المفقودة: ' + notFound.join(', '));
    console.error('طبّق الـ migrations ثم شغّل:  NOTIFY pgrst, \'reload schema\';');
    process.exit(1);
  }
  if (!reachable) {
    console.error('\nلم تُفحص أي دالة — لا نتيجة يُعتد بها.');
    process.exit(2);
  }
  console.log('كل الدوال المتعاقد عليها موجودة على قاعدة البيانات الحية ✅\n');
})();
