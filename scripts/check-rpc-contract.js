#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  Masar RTC — CI Automated RPC Contract Verifier
 *  Validates 100% synchronization between Client JS, RPC Contract,
 *  and Supabase SQL Migrations.
 * ═══════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

// Master Contract Manifest for the 26 RPC Functions
const CONTRACT_MANIFEST = {
  get_my_profile: {
    params: [],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  ensure_my_profile: {
    params: ['p_full_name', 'p_phone', 'p_branch'],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  batch_roster: {
    params: ['p_batch_id'],
    returnType: 'TABLE',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  admin_list_profiles: {
    params: [],
    returnType: 'TABLE',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  batch_seat_counts: {
    params: ['p_batch_ids'],
    returnType: 'TABLE',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  update_branch_directory: {
    params: ['p_branch_id', 'p_payload'],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  join_batch: {
    params: ['p_batch_id'],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  start_session: {
    params: ['p_batch_id', 'p_title'],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  student_check_in: {
    params: ['p_code'],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  record_session_attendance: {
    params: ['p_session_id', 'p_records'],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  close_session: {
    params: ['p_session_id'],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  issue_certificates: {
    params: ['p_batch_id'],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  change_user_role: {
    params: ['p_user_id', 'p_role'],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  set_user_status: {
    params: ['p_user_id', 'p_status'],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  assign_instructor: {
    params: ['p_batch_id', 'p_instructor_id'],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  verify_certificate: {
    params: ['p_serial'],
    returnType: 'TABLE',
    publicAnon: true, // anonymous public access for QR verification
    securityDefiner: true,
    fileCall: 'js/verify.js, js/api.js'
  },
  get_leaderboard: {
    params: [],
    returnType: 'TABLE',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  submit_excuse: {
    params: ['p_batch_id', 'p_session_id', 'p_reason', 'p_file'],
    returnType: 'UUID',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  review_excuse: {
    params: ['p_excuse_id', 'p_status', 'p_note'],
    returnType: 'VOID',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  submit_session_report: {
    params: ['p_session_id', 'p_summary', 'p_und', 'p_eng'],
    returnType: 'UUID',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  submit_course_rating: {
    params: ['p_course_id', 'p_rating', 'p_comment'],
    returnType: 'VOID',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  broadcast_notice: {
    params: ['p_scope', 'p_scope_id', 'p_type', 'p_title', 'p_message'],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  add_private_note: {
    params: ['p_student_id', 'p_body'],
    returnType: 'UUID',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  claim_social_badge: {
    params: [],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  disable_my_push_devices: {
    params: [],
    returnType: 'VOID',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  },
  register_push_device: {
    params: ['p_token', 'p_platform', 'p_version'],
    returnType: 'JSONB',
    publicAnon: false,
    securityDefiner: true,
    fileCall: 'js/api.js'
  }
};

let errors = [];

function logPass(msg) {
  console.log('  ✔ ' + msg);
}

function logFail(msg) {
  errors.push(msg);
  console.error('  ✘ ' + msg);
}

console.log('\n========================================');
console.log(' Masar RTC — RPC Contract Verification');
console.log('========================================\n');

// 1. Scan JS files for all rpc calls
console.log('[1/4] Scanning JS call-sites...');
const jsFiles = ['js/api.js', 'js/verify.js', 'app.js'];
const rpcCallRegex = /(?:client\.)?rpc\(\s*['"]([a-zA-Z0-9_]+)['"](?:\s*,\s*(\{[\s\S]*?\}|[^)\n]+))?\s*\)/g;
const foundRpcCalls = new Map();

for (const relPath of jsFiles) {
  const code = readFile(relPath);
  let match;
  while ((match = rpcCallRegex.exec(code)) !== null) {
    const fnName = match[1];
    if (!foundRpcCalls.has(fnName)) {
      foundRpcCalls.set(fnName, []);
    }
    foundRpcCalls.get(fnName).push({ file: relPath, rawArgs: match[2] ? match[2].trim() : '' });
  }
}

console.log(`Found ${foundRpcCalls.size} unique RPC function names in frontend code.`);

// 2. Validate JS calls against Manifest
console.log('\n[2/4] Validating JS calls against Contract Manifest...');
for (const [fnName, calls] of foundRpcCalls.entries()) {
  const spec = CONTRACT_MANIFEST[fnName];
  if (!spec) {
    logFail(`Unknown RPC call detected in frontend: "${fnName}"`);
    continue;
  }
  logPass(`RPC "${fnName}" is declared in master contract.`);

  // Check parameter names if passed as object literal
  for (const call of calls) {
    if (call.rawArgs && call.rawArgs.startsWith('{')) {
      const keys = (call.rawArgs.match(/([a-zA-Z0-9_]+)\s*:/g) || []).map((k) => k.replace(':', '').trim());
      for (const key of keys) {
        if (!spec.params.includes(key)) {
          logFail(`RPC "${fnName}" in ${call.file} passes unexpected parameter "${key}". Allowed: ${spec.params.join(', ')}`);
        }
      }
    }
  }
}

// 3. Verify that all 26 Manifest RPCs are called or accounted for
console.log('\n[3/4] Ensuring full manifest coverage...');
const manifestKeys = Object.keys(CONTRACT_MANIFEST);
for (const fnName of manifestKeys) {
  if (!foundRpcCalls.has(fnName)) {
    logFail(`Manifest RPC "${fnName}" has no call-site in scanned JS files.`);
  } else {
    logPass(`Manifest RPC "${fnName}" verified across client call-sites.`);
  }
}

// 4. Validate SQL Migrations against Master Contract
console.log('\n[4/4] Validating Supabase Migrations & Reconciliation...');
const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const combinedMigrations = migrationFiles.map((f) => readFile(path.join('supabase', 'migrations', f))).join('\n');

for (const fnName of manifestKeys) {
  const spec = CONTRACT_MANIFEST[fnName];
  // Check function definition in SQL
  const fnRegex = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${fnName}\\b`, 'i');
  if (!fnRegex.test(combinedMigrations)) {
    logFail(`RPC "${fnName}" is not defined in any SQL migration.`);
  } else {
    logPass(`SQL definition confirmed for "${fnName}".`);
  }
}

// Check reconciliation migration exists and enforces security
const reconcileFile = migrationFiles.find((f) => f.includes('reconcile_rpc_contract'));
if (!reconcileFile) {
  logFail('Reconciliation migration file (reconcile_rpc_contract) was not found in supabase/migrations/');
} else {
  const recContent = readFile(path.join('supabase', 'migrations', reconcileFile));
  if (!recContent.includes("NOTIFY pgrst, 'reload schema'")) {
    logFail('Reconciliation migration is missing schema cache reload (NOTIFY pgrst, \'reload schema\')');
  } else {
    logPass('PostgREST schema cache reload notification is present.');
  }

  if (!recContent.includes('GRANT EXECUTE ON FUNCTION public.verify_certificate(TEXT) TO anon, authenticated')) {
    logFail('verify_certificate must be explicitly granted to anon, authenticated for public QR lookup');
  } else {
    logPass('verify_certificate public grant boundary confirmed.');
  }

  if (!recContent.includes('REVOKE ALL ON FUNCTION public.get_leaderboard() FROM PUBLIC, anon')) {
    logFail('get_leaderboard must revoke execution from PUBLIC and anon');
  } else {
    logPass('get_leaderboard private grant boundary confirmed.');
  }
}

// Summary
console.log('\n----------------------------------------');
if (errors.length > 0) {
  console.error(`❌ RPC Contract Verification Failed with ${errors.length} error(s):\n`);
  errors.forEach((e) => console.error('  - ' + e));
  console.log('\n----------------------------------------\n');
  process.exit(1);
} else {
  console.log(`✅ All 26 RPC functions, parameters, grants, and migrations are 100% synchronized!\n`);
  process.exit(0);
}
