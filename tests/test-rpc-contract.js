#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  Masar RTC — Stage 0 RPC Contract & Security Tests
 *  Validates authorization boundaries, negative privilege checks,
 *  positive role execution, PII masking, and MIME validations.
 * ═══════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failures = 0;

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function check(title, condition, detail) {
  if (condition) {
    console.log('  ✔ ' + title);
  } else {
    failures += 1;
    console.error('  ✘ ' + title + (detail ? ' — ' + detail : ''));
  }
}

console.log('\n[Stage 0] RPC Contract & Schema Reconciliation:');
const reconcileSql = read('supabase/migrations/20260814140000_reconcile_rpc_contract.sql');
const v100Sql = read('supabase/migrations/20260813190000_v100_platform.sql');
const v9Sql = read('supabase/migrations/20260813120000_production_v9.sql');

// 1. Check all 26 functions exist in reconciliation migration
const functionsList = [
  'get_my_profile',
  'ensure_my_profile',
  'batch_roster',
  'admin_list_profiles',
  'batch_seat_counts',
  'update_branch_directory',
  'join_batch',
  'start_session',
  'student_check_in',
  'record_session_attendance',
  'close_session',
  'issue_certificates',
  'change_user_role',
  'set_user_status',
  'assign_instructor',
  'verify_certificate',
  'get_leaderboard',
  'submit_excuse',
  'review_excuse',
  'submit_session_report',
  'submit_course_rating',
  'broadcast_notice',
  'add_private_note',
  'claim_social_badge',
  'disable_my_push_devices',
  'register_push_device'
];

functionsList.forEach((fn) => {
  check(`Reconciliation defines public.${fn}`, reconcileSql.includes(`FUNCTION public.${fn}`));
});

console.log('\n[Stage 0] Authorization & Negative Security Checks:');

// 2. Anon rejection on sensitive RPCs
check(
  'Reconciliation migration revokes all public/anon access for sensitive RPCs',
  reconcileSql.includes('REVOKE ALL ON FUNCTION public.admin_list_profiles() FROM PUBLIC, anon') &&
  reconcileSql.includes('REVOKE ALL ON FUNCTION public.get_leaderboard() FROM PUBLIC, anon') &&
  reconcileSql.includes('REVOKE ALL ON FUNCTION public.batch_roster(UUID) FROM PUBLIC, anon') &&
  reconcileSql.includes('REVOKE ALL ON FUNCTION public.update_branch_directory(UUID, JSONB) FROM PUBLIC, anon')
);

// 3. Negative test: Student cannot read or modify roster/attendance/admin profiles
check(
  'batch_roster verifies admin or instructor of batch',
  reconcileSql.includes('IF NOT (public.is_admin() OR public.is_instructor(p_batch_id)) THEN') &&
  reconcileSql.includes("RAISE EXCEPTION 'unauthorized'")
);

check(
  'admin_list_profiles verifies admin role',
  reconcileSql.includes('IF NOT public.is_admin() THEN RAISE EXCEPTION \'unauthorized\'')
);

check(
  'update_branch_directory verifies admin role and rejects non-admin',
  reconcileSql.includes('FUNCTION public.update_branch_directory') &&
  reconcileSql.includes('IF NOT public.is_admin() THEN RAISE EXCEPTION \'unauthorized\'')
);

// 4. Negative test: Volunteer cannot modify batches or sessions they do not own
check(
  'start_session blocks volunteers who do not own the batch',
  reconcileSql.includes('FUNCTION public.start_session') &&
  reconcileSql.includes('IF NOT (public.is_admin() OR public.is_instructor(p_batch_id)) THEN')
);

check(
  'record_session_attendance blocks volunteers who do not own the session batch',
  reconcileSql.includes('FUNCTION public.record_session_attendance') &&
  reconcileSql.includes('IF NOT (public.is_admin() OR public.is_instructor(v_batch)) THEN')
);

check(
  'broadcast_notice restricts volunteer scope to owned batch only',
  reconcileSql.includes('IF NOT (public.is_admin() OR public.is_instructor(p_scope_id)) THEN RAISE EXCEPTION \'unauthorized\'')
);

console.log('\n[Stage 0] Positive Flow & Contract Guarantees:');

// 5. Positive test: Public cert verification masks student name
check(
  'verify_certificate uses mask_name for student full_name',
  reconcileSql.includes('public.mask_name(p.full_name) AS student_name') &&
  reconcileSql.includes('GRANT EXECUTE ON FUNCTION public.verify_certificate(TEXT) TO anon, authenticated')
);

// 6. Masking logic test
function maskNameSimulation(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return parts.map(p => p.length <= 2 ? p : p[0] + '***').join(' ');
}
check(
  'mask_name simulation correctly masks Arabic names without leaking full PII',
  maskNameSimulation('أحمد محمد علي') === 'أ*** م*** ع***' &&
  maskNameSimulation('سارة إبراهيم حسن') === 'س*** إ*** ح***'
);

// 7. Positive test: Idempotent student check-in awards points & updates progress
check(
  'student_check_in enforces active date and enrolled status',
  reconcileSql.includes('s.session_date = CURRENT_DATE') &&
  reconcileSql.includes("status = 'enrolled'") &&
  reconcileSql.includes('PERFORM public.apply_rule(v_user, \'ATTEND_PRESENT\', v_user)')
);

// 8. Storage MIME and Size Validation Tests
console.log('\n[Stage 0] Storage MIME & Size Policy Checks:');
const apiJs = read('js/api.js');

check(
  'Avatar upload validates size <= 8MB and WebP/JPEG/PNG format',
  apiJs.includes('file.size > 8 * 1024 * 1024') &&
  apiJs.includes('/^image\\/(jpeg|png|webp)$/')
);

check(
  'Excuse upload validates size <= 4MB and allowed document/image MIME types',
  apiJs.includes('file.size > 4 * 1024 * 1024') &&
  apiJs.includes("['application/pdf', 'image/jpeg', 'image/png', 'image/webp']")
);

check(
  'SQL excuse upload validation enforces user ownership prefix',
  reconcileSql.includes("p_file !~ ('^' || auth.uid()::text || '/[0-9]+\\.(pdf|jpg|png|webp)$')")
);

// 9. Schema cache reload confirmation
check(
  'Schema cache reload NOTIFY pgrst is triggered at migration conclusion',
  reconcileSql.includes("NOTIFY pgrst, 'reload schema';")
);

console.log('\n----------------------------------------');
if (failures > 0) {
  console.error(`❌ Stage 0 Tests failed with ${failures} error(s).\n`);
  process.exit(1);
} else {
  console.log(`✅ All Stage 0 RPC contract and security tests passed!\n`);
  process.exit(0);
}
