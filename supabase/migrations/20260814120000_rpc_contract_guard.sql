-- ═══════════════════════════════════════════════════════════════════
-- Masar RTC — RPC contract guard
--
-- Purpose: make the database match, exactly, the contract the client in
-- js/api.js + js/verify.js relies on, and keep it matching after any
-- partially-applied v9 / v100 deployment.
--
-- This migration deliberately contains NO business logic and NO new RPCs.
-- Every function the app calls is already defined by the earlier
-- migrations; what was missing was the *reconciliation* around them:
--
--   1. Stale overloads. PostgREST resolves an RPC by name + argument
--      names. If an older deployment left a differently-shaped version of
--      a function behind, the call becomes ambiguous and PostgREST reports
--      it as "Could not find the function public.X(...) in the schema
--      cache" — the same message you get when it is genuinely absent.
--      Verified locally: a duplicate overload makes PostgreSQL itself
--      raise "function ... is not unique".
--
--   2. Argument-name / return-type drift. CREATE OR REPLACE cannot rename
--      an input parameter or change a return type, so a drifted live
--      function silently keeps the OLD signature while the migration
--      appears to succeed. Verified locally: PostgreSQL raises "cannot
--      change name of input parameter" / "cannot change return type of
--      existing function". Dropping only the drifted shapes lets the
--      canonical definition install.
--
--   3. EXECUTE reachable by PUBLIC. `REVOKE ... ON ALL FUNCTIONS IN
--      SCHEMA public FROM anon, authenticated` (v9, line 1057) does NOT
--      remove the built-in grant to PUBLIC, and every role inherits
--      PUBLIC. Verified locally: after that REVOKE, both anon and
--      authenticated could still execute every helper. This closes the
--      hole per-function instead of weakening anything.
--
-- Safety properties:
--   * Idempotent — safe to run repeatedly.
--   * Creates no dummy/placeholder functions. It only drops shapes that
--     are NOT part of the contract, and re-grants existing ones.
--   * Grants nothing broad to PUBLIC; PUBLIC is revoked, then EXECUTE is
--     granted to the narrowest role that needs it.
--   * Never disables RLS and never touches row data.
-- ═══════════════════════════════════════════════════════════════════

-- ───────── 1. The contract, as data ─────────
-- Argument *names* matter: PostgREST matches the JSON body keys against
-- them. These rows are the exact names/types js/api.js sends.
CREATE TEMP TABLE _rtc_contract (
  fn       TEXT NOT NULL,
  identity TEXT NOT NULL,   -- exact pg_get_function_identity_arguments() form
  caller   TEXT NOT NULL    -- role that must hold EXECUTE
) ON COMMIT DROP;

-- `identity` is compared verbatim against
-- pg_get_function_identity_arguments(oid), which renders IN parameters as
-- "name type" and omits OUT/TABLE columns. Comparing that single string
-- catches BOTH argument-type drift and argument-NAME drift in one test.
INSERT INTO _rtc_contract (fn, identity, caller) VALUES
  -- Profile + identity
  ('get_my_profile',            '',                                                                      'authenticated'),
  ('ensure_my_profile',         'p_full_name text, p_phone text, p_branch uuid',                         'authenticated'),
  ('admin_list_profiles',       '',                                                                      'authenticated'),
  -- Enrolment + sessions
  ('join_batch',                'p_batch_id uuid',                                                       'authenticated'),
  ('batch_roster',              'p_batch_id uuid',                                                       'authenticated'),
  ('batch_seat_counts',         'p_batch_ids uuid[]',                                                    'authenticated'),
  ('start_session',             'p_batch_id uuid, p_title text',                                         'authenticated'),
  ('close_session',             'p_session_id uuid',                                                     'authenticated'),
  ('student_check_in',          'p_code text',                                                           'authenticated'),
  ('record_session_attendance', 'p_session_id uuid, p_records jsonb',                                    'authenticated'),
  -- Certificates
  ('issue_certificates',        'p_batch_id uuid',                                                       'authenticated'),
  ('verify_certificate',        'p_serial text',                                                         'anon'),
  -- Administration
  ('change_user_role',          'p_user_id uuid, p_role text',                                           'authenticated'),
  ('set_user_status',           'p_user_id uuid, p_status text',                                         'authenticated'),
  ('assign_instructor',         'p_batch_id uuid, p_instructor_id uuid',                                 'authenticated'),
  ('update_branch_directory',   'p_branch_id uuid, p_payload jsonb',                                     'authenticated'),
  ('broadcast_notice',          'p_scope text, p_scope_id uuid, p_type text, p_title text, p_message text', 'authenticated'),
  -- Engagement
  ('get_leaderboard',           '',                                                                      'authenticated'),
  ('claim_social_badge',        '',                                                                      'authenticated'),
  ('submit_excuse',             'p_batch_id uuid, p_session_id uuid, p_reason text, p_file text',        'authenticated'),
  ('review_excuse',             'p_excuse_id uuid, p_status text, p_note text',                          'authenticated'),
  ('submit_session_report',     'p_session_id uuid, p_summary text, p_und integer, p_eng integer',       'authenticated'),
  ('submit_course_rating',      'p_course_id uuid, p_rating integer, p_comment text',                    'authenticated'),
  ('add_private_note',          'p_student_id uuid, p_body text',                                        'authenticated'),
  -- Devices
  ('register_push_device',      'p_token text, p_platform text, p_version text',                         'authenticated'),
  ('disable_my_push_devices',   '',                                                                      'authenticated');

-- ───────── 2. Fail loudly if a contracted RPC is genuinely absent ─────────
-- A missing function is a code/migration bug, not something to paper over
-- with a stub: a dummy would return wrong data and hide the real problem.
DO $$
DECLARE missing TEXT;
BEGIN
  SELECT string_agg(c.fn || '(' || c.identity || ')', ', ' ORDER BY c.fn) INTO missing
  FROM _rtc_contract c
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = c.fn
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'RPC contract violated — these functions are missing from the database: %. Apply the earlier migrations (production_v9 / v100_platform) before this guard.',
      missing;
  END IF;
END $$;

-- ───────── 3. Drop drifted / stale overloads ─────────
-- Only shapes that do NOT match the contract are dropped, so the canonical
-- definition installed by the earlier migrations is left untouched. This is
-- what clears an ambiguous overload and what lets a later CREATE OR REPLACE
-- succeed when a live function drifted in argument names or return type.
DO $$
DECLARE
  r RECORD;
  dropped INT := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig,
           c.fn,
           pg_get_function_identity_arguments(p.oid) AS ident,
           pg_get_function_arguments(p.oid)          AS full_args
    FROM _rtc_contract c
    JOIN pg_proc p       ON p.proname = c.fn
    JOIN pg_namespace n  ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE p.prokind = 'f'
      -- One comparison covers type drift AND argument-name drift.
      AND pg_get_function_identity_arguments(p.oid) IS DISTINCT FROM c.identity
  LOOP
    RAISE NOTICE 'RPC guard: dropping non-contract overload %  (identity: %)', r.sig, r.ident;
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
    dropped := dropped + 1;
  END LOOP;
  IF dropped = 0 THEN
    RAISE NOTICE 'RPC guard: no drifted overloads found — schema already matches the contract.';
  ELSE
    RAISE NOTICE 'RPC guard: dropped % non-contract overload(s).', dropped;
  END IF;
END $$;

-- Re-check: dropping drift must not have removed the only definition.
DO $$
DECLARE missing TEXT;
BEGIN
  SELECT string_agg(c.fn || '(' || c.identity || ')', ', ' ORDER BY c.fn) INTO missing
  FROM _rtc_contract c
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = c.fn
      AND pg_get_function_identity_arguments(p.oid) = c.identity
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'RPC contract violated after drift cleanup — the canonical signature is absent for: %. Re-run the v9/v100 migrations so the correct definition is installed.',
      missing;
  END IF;
END $$;

-- ───────── 4. Exactly one definition per contracted name ─────────
-- Any surviving duplicate would keep PostgREST ambiguous.
DO $$
DECLARE dupes TEXT;
BEGIN
  SELECT string_agg(fn || ' x' || n::text, ', ' ORDER BY fn) INTO dupes
  FROM (
    SELECT c.fn, count(*) AS n
    FROM _rtc_contract c
    JOIN pg_proc p      ON p.proname = c.fn
    JOIN pg_namespace ns ON ns.oid = p.pronamespace AND ns.nspname = 'public'
    WHERE p.prokind = 'f'
    GROUP BY c.fn
    HAVING count(*) > 1
  ) q;
  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION 'RPC contract violated — ambiguous overloads remain: %', dupes;
  END IF;
END $$;

-- ───────── 5. Least-privilege EXECUTE ─────────
-- PUBLIC is revoked first (the built-in grant survives the schema-wide
-- REVOKE in the v9 migration), then EXECUTE is granted to the single role
-- that needs it. anon-callable RPCs also get authenticated, since a signed
-- in user must keep working.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig, c.caller
    FROM _rtc_contract c
    JOIN pg_proc p      ON p.proname = c.fn
                       AND pg_get_function_identity_arguments(p.oid) = c.identity
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || r.sig || ' FROM PUBLIC';
    IF r.caller = 'anon' THEN
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO anon, authenticated';
    ELSE
      EXECUTE 'REVOKE ALL ON FUNCTION ' || r.sig || ' FROM anon';
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO authenticated';
    END IF;
  END LOOP;
END $$;

-- ───────── 6. Internal helpers: revoke PUBLIC, keep RLS working ─────────
-- These are not RPCs and must never be callable from the Data API. But
-- is_admin / is_staff / is_instructor / is_instructor_for_student /
-- current_role are evaluated *inside* RLS policies, and — unlike trigger
-- functions — RLS expressions DO enforce EXECUTE against the querying
-- role. Verified locally: revoking them without re-granting turned every
-- read of enrollments/sessions/attendance/certs/excuses/waitlist into
-- "permission denied for function is_instructor". So they are revoked from
-- PUBLIC and anon, then granted back to authenticated only.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE p.proname IN ('is_admin', 'is_staff', 'is_instructor',
                        'is_instructor_for_student', 'current_role')
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || r.sig || ' FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO authenticated';
  END LOOP;
END $$;

-- Pure private helpers: no client, no RLS policy, no Data API surface.
-- They run inside SECURITY DEFINER RPCs (which execute as the owner) and
-- inside triggers (which do not re-check EXECUTE at fire time — verified
-- locally: join_batch and the updated_at trigger still work after this).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE p.proname IN ('apply_rule', 'award_badge', 'refresh_student_stats',
                        'refresh_enrollment_progress', 'write_audit',
                        'sync_points_from_ledger', 'touch_updated_at',
                        'protect_founder', 'handle_new_user',
                        'mask_phone', 'mask_name')
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || r.sig || ' FROM PUBLIC, anon, authenticated';
  END LOOP;
END $$;

-- Stop future functions in this schema from being world-executable by
-- default, so a new RPC has to opt in to exposure explicitly.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ───────── 7. Schema/RLS invariants the client depends on ─────────
-- Columns the client selects but that only ever existed via ALTER ... ADD
-- COLUMN IF NOT EXISTS in an older migration. Re-asserted so a database
-- that skipped a migration cannot produce a column-level schema error.
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS course_id     UUID;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS sessions_done INT DEFAULT 0;
ALTER TABLE public.attendance  ADD COLUMN IF NOT EXISTS batch_id      UUID;
ALTER TABLE public.batches     ADD COLUMN IF NOT EXISTS sessions_done INT DEFAULT 0;

-- Every table the client reads must have RLS on. Enabling is idempotent
-- and never disables anything.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'branches', 'courses', 'batches', 'enrollments', 'waitlist',
    'sessions', 'attendance', 'points_rules', 'points_ledger', 'certs',
    'notifications', 'student_badges', 'excuses', 'session_reports',
    'course_ratings', 'private_notes', 'audit_log', 'push_devices',
    'volunteer_committees'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- An RLS-enabled table with no policy silently returns zero rows, which
-- looks like missing data rather than a permission error. Surface it.
DO $$
DECLARE bare TEXT;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO bare
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE c.relkind = 'r' AND c.relrowsecurity
    AND NOT EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = c.oid)
    AND c.relname <> 'push_devices';  -- intentionally server-only; no client access at all
  IF bare IS NOT NULL THEN
    RAISE WARNING 'RLS enabled but no policy (reads will return nothing): %', bare;
  END IF;
END $$;

-- ───────── 8. Storage: buckets + owner-scoped policies ─────────
-- The client uploads avatars and excuse attachments. Missing bucket rows
-- or missing policies fail at runtime the same way a schema error does.
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('excuses', 'excuses', false)
ON CONFLICT (id) DO NOTHING;

-- Server-side limits mirror the client-side checks in js/api.js.
UPDATE storage.buckets
   SET file_size_limit = 1048576,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'avatars';
UPDATE storage.buckets
   SET file_size_limit = 4194304,
       allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'excuses';

DROP POLICY IF EXISTS avatars_read   ON storage.objects;
DROP POLICY IF EXISTS avatars_write  ON storage.objects;
DROP POLICY IF EXISTS avatars_update ON storage.objects;
DROP POLICY IF EXISTS avatars_delete ON storage.objects;
DROP POLICY IF EXISTS excuses_read   ON storage.objects;
DROP POLICY IF EXISTS excuses_write  ON storage.objects;
DROP POLICY IF EXISTS excuses_delete ON storage.objects;

-- avatars is a public bucket: read stays open, writes stay owner-scoped.
CREATE POLICY avatars_read ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY avatars_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- excuses is private: owner or staff may read, only the owner may write.
CREATE POLICY excuses_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'excuses' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR public.is_staff()
  ));
CREATE POLICY excuses_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'excuses' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY excuses_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'excuses' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ───────── 9. Reload the PostgREST schema cache ─────────
-- Without this, PostgREST keeps serving the stale cache and continues to
-- report the very "could not find the function ... in the schema cache"
-- error this migration repairs.
NOTIFY pgrst, 'reload schema';
