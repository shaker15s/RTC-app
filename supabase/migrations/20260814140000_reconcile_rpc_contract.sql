-- ═══════════════════════════════════════════════════════════════════
--  Masar RTC v100 — RPC Contract Reconciliation Migration
--  Ensures exact function signatures, SECURITY DEFINER, search_path,
--  strict role checks, explicit grant boundaries, and PostgREST reload.
-- ═══════════════════════════════════════════════════════════════════

-- 0. Ensure all prerequisite tables, columns, and constraints exist idempotently
CREATE TABLE IF NOT EXISTS public.branches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  name_ar       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  city          TEXT NOT NULL,
  address       TEXT,
  facebook_url  TEXT,
  whatsapp      TEXT,
  hotline       TEXT DEFAULT '19450',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL DEFAULT 'student',
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  full_name       TEXT NOT NULL DEFAULT 'طالب جديد',
  email           VARCHAR,
  phone           TEXT,
  branch_id       UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  avatar_url      TEXT,
  points          INT NOT NULL DEFAULT 0,
  streak          INT NOT NULL DEFAULT 0,
  attendance_pct  INT NOT NULL DEFAULT 0,
  lang            VARCHAR(10) NOT NULL DEFAULT 'ar',
  dark_mode       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT 'طالب جديد';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email VARCHAR;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS attendance_pct INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lang VARCHAR(10) DEFAULT 'ar';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  category        TEXT NOT NULL,
  icon            TEXT NOT NULL DEFAULT 'ph-book-open',
  color           TEXT NOT NULL DEFAULT '#00288e',
  sessions_count  INT NOT NULL DEFAULT 6,
  max_students    INT NOT NULL DEFAULT 25,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  branch_id       UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  schedule        TEXT,
  location        TEXT,
  sessions_done   INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS schedule TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS sessions_done INT DEFAULT 0;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS public.enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'enrolled',
  sessions_done   INT NOT NULL DEFAULT 0,
  attendance_pct  INT NOT NULL DEFAULT 0,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, student_id)
);

ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'enrolled';
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS sessions_done INT NOT NULL DEFAULT 0;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS attendance_pct INT NOT NULL DEFAULT 0;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  session_number  INT NOT NULL,
  title           TEXT NOT NULL,
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  checkin_code    TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS checkin_code TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS session_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS session_number INT DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'present',
  checkin_method  VARCHAR(20) NOT NULL DEFAULT 'qr',
  notes           TEXT,
  verified_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.certs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial          TEXT UNIQUE NOT NULL,
  student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  batch_id        UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  qr_code_url     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.excuses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  batch_id        UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  session_id      UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  file_path       TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewer_note   TEXT,
  reviewed_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.session_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID UNIQUE NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  instructor_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  summary               TEXT NOT NULL,
  understanding_score   INT NOT NULL,
  engagement_score      INT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_ratings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT '',
  message         TEXT NOT NULL DEFAULT '',
  type            TEXT NOT NULL DEFAULT 'announcement',
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.private_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token           TEXT UNIQUE NOT NULL,
  platform        TEXT NOT NULL,
  app_version     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waitlist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  entity          TEXT NOT NULL,
  entity_id       TEXT,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_badges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id        VARCHAR(40) NOT NULL,
  awarded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, badge_id)
);

CREATE TABLE IF NOT EXISTS public.points_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(50) UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  amount          INT NOT NULL DEFAULT 10,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.points_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rule_id         UUID REFERENCES public.points_rules(id) ON DELETE SET NULL,
  amount          INT NOT NULL,
  reason          TEXT NOT NULL,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1. Safely drop any legacy drift signatures if they ever existed in schema cache
DROP FUNCTION IF EXISTS public.patch_roster(uuid, uuid);
DROP FUNCTION IF EXISTS public.patch_roster(uuid);

-- 2. Helper validation functions (used across RLS policies — preserve return types)
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'anon'; END IF;
  SELECT role::TEXT INTO r FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(r, 'student');
END $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
END $$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','volunteer') AND status = 'active'
  );
END $$;

CREATE OR REPLACE FUNCTION public.is_instructor(_batch UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR _batch IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.batches WHERE id = _batch AND instructor_id = auth.uid()
  );
END $$;

CREATE OR REPLACE FUNCTION public.is_instructor_for_student(_student UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR _student IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.enrollments e
      JOIN public.batches b ON b.id = e.batch_id
     WHERE e.student_id = _student
       AND b.instructor_id = auth.uid()
  );
END $$;

CREATE OR REPLACE FUNCTION public.mask_name(value TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  clean TEXT := trim(COALESCE(value, ''));
  parts TEXT[];
  out_parts TEXT[] := ARRAY[]::TEXT[];
  part TEXT;
  first_char TEXT;
BEGIN
  IF clean = '' THEN RETURN 'طالب مسار'; END IF;
  parts := regexp_split_to_array(clean, '\s+');
  IF array_length(parts, 1) IS NULL THEN RETURN 'طالب مسار'; END IF;
  FOREACH part IN ARRAY parts LOOP
    IF length(part) <= 2 THEN
      out_parts := array_append(out_parts, part);
    ELSE
      first_char := substring(part FROM 1 FOR 1);
      out_parts := array_append(out_parts, first_char || '***');
    END IF;
  END LOOP;
  RETURN array_to_string(out_parts, ' ');
END $$;

CREATE OR REPLACE FUNCTION public.apply_rule(_student UUID, _code TEXT, _by UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.points_rules%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.points_rules WHERE code = _code;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.points_ledger (student_id, rule_id, amount, reason, created_by)
  VALUES (_student, r.id, r.amount, r.title, _by);
END $$;

CREATE OR REPLACE FUNCTION public.award_badge(_student UUID, _badge TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.student_badges (student_id, badge_id)
  VALUES (_student, _badge)
  ON CONFLICT (student_id, badge_id) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_enrollment_progress(_batch UUID, _student UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE done INT;
BEGIN
  SELECT COUNT(DISTINCT a.session_id) INTO done
  FROM public.attendance a
  JOIN public.sessions s ON s.id = a.session_id
  WHERE s.batch_id = _batch AND a.student_id = _student
    AND a.status IN ('present', 'late', 'excused');
  UPDATE public.enrollments SET sessions_done = done
   WHERE batch_id = _batch AND student_id = _student;
END $$;

CREATE OR REPLACE FUNCTION public.write_audit(_action TEXT, _entity TEXT, _id TEXT, _meta JSONB DEFAULT '{}'::jsonb)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_log (actor_id, action, entity, entity_id, meta)
  VALUES (auth.uid(), _action, _entity, _id, COALESCE(_meta, '{}'::jsonb));
END $$;

-- 3. The 26 Core Contract RPCs

-- [RPC 1] get_my_profile
DROP FUNCTION IF EXISTS public.get_my_profile();
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.profiles%ROWTYPE;
  b JSONB;
  badges JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT to_jsonb(br) INTO b
    FROM public.branches br
   WHERE br.id = p.branch_id;

  SELECT COALESCE(jsonb_agg(badge_id), '[]'::jsonb) INTO badges
    FROM public.student_badges
   WHERE student_id = auth.uid();

  RETURN jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'role', p.role,
    'status', p.status,
    'email', p.email,
    'phone', p.phone,
    'branch_id', p.branch_id,
    'avatar_url', p.avatar_url,
    'points', COALESCE(p.points, 0),
    'streak', COALESCE(p.streak, 0),
    'lang', COALESCE(p.lang, 'ar'),
    'dark_mode', COALESCE(p.dark_mode, false),
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'branches', b,
    'badge_ids', badges
  );
END $$;

-- [RPC 2] ensure_my_profile
DROP FUNCTION IF EXISTS public.ensure_my_profile(TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.ensure_my_profile(
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_branch UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  usr RECORD;
  clean_name TEXT;
  clean_phone TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT id, email, raw_user_meta_data INTO usr FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found in auth'; END IF;

  clean_name := COALESCE(NULLIF(trim(p_full_name), ''), usr.raw_user_meta_data->>'full_name', usr.raw_user_meta_data->>'name', split_part(usr.email, '@', 1), 'طالب جديد');
  clean_phone := NULLIF(trim(p_phone), '');

  INSERT INTO public.profiles (id, full_name, role, status, email, phone, branch_id, avatar_url)
  VALUES (
    usr.id,
    clean_name,
    'student',
    'active',
    usr.email,
    clean_phone,
    p_branch,
    usr.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = CASE WHEN p_full_name IS NOT NULL AND length(trim(p_full_name)) > 0 THEN clean_name ELSE public.profiles.full_name END,
    phone = CASE WHEN clean_phone IS NOT NULL THEN clean_phone ELSE public.profiles.phone END,
    branch_id = CASE WHEN p_branch IS NOT NULL THEN p_branch ELSE public.profiles.branch_id END,
    updated_at = now();
END $$;

-- [RPC 3] batch_roster
DROP FUNCTION IF EXISTS public.batch_roster(UUID);
CREATE OR REPLACE FUNCTION public.batch_roster(p_batch_id UUID)
RETURNS TABLE (
  enrollment_id UUID,
  student_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  sessions_done INT,
  points INT,
  streak INT,
  attendance_pct INT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_admin() OR public.is_instructor(p_batch_id)) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY
    SELECT e.id AS enrollment_id,
           e.student_id,
           p.full_name,
           p.avatar_url,
           p.phone,
           COALESCE(e.sessions_done, 0)::INT,
           COALESCE(p.points, 0)::INT,
           COALESCE(p.streak, 0)::INT,
           COALESCE(e.attendance_pct, 0)::INT
      FROM public.enrollments e
      JOIN public.profiles p ON p.id = e.student_id
     WHERE e.batch_id = p_batch_id
       AND e.status = 'enrolled'
     ORDER BY p.full_name;
END $$;

-- [RPC 4] admin_list_profiles
DROP FUNCTION IF EXISTS public.admin_list_profiles();
CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'role', p.role,
      'status', p.status,
      'email', p.email,
      'phone', p.phone,
      'points', COALESCE(p.points, 0),
      'branch_id', p.branch_id,
      'avatar_url', p.avatar_url,
      'created_at', p.created_at,
      'branch_name', COALESCE(b.name_ar, b.name_en, '')
    ) ORDER BY p.created_at DESC
  ), '[]'::jsonb) INTO result
  FROM public.profiles p
  LEFT JOIN public.branches b ON b.id = p.branch_id;
  RETURN result;
END $$;

-- [RPC 5] batch_seat_counts
DROP FUNCTION IF EXISTS public.batch_seat_counts(UUID[]);
CREATE FUNCTION public.batch_seat_counts(p_batch_ids UUID[])
RETURNS TABLE (
  batch_id UUID,
  enrolled INT,
  capacity INT,
  seats_left INT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id AS batch_id,
         COUNT(e.id)::INT AS enrolled,
         COALESCE(c.max_students, 25)::INT AS capacity,
         GREATEST(0, COALESCE(c.max_students, 25) - COUNT(e.id)::INT)::INT AS seats_left
    FROM public.batches b
    JOIN public.courses c ON c.id = b.course_id
    LEFT JOIN public.enrollments e ON e.batch_id = b.id AND e.status = 'enrolled'
   WHERE b.id = ANY(p_batch_ids)
   GROUP BY b.id, c.max_students;
$$;

-- [RPC 6] update_branch_directory
DROP FUNCTION IF EXISTS public.update_branch_directory(UUID, JSONB);
CREATE OR REPLACE FUNCTION public.update_branch_directory(p_branch_id UUID, p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name_ar TEXT; v_name_en TEXT; v_city TEXT; v_address TEXT;
  v_fb TEXT; v_wa TEXT; v_hotline TEXT; v_sort INT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  v_name_ar := NULLIF(trim(p_payload->>'name_ar'), '');
  v_name_en := NULLIF(trim(p_payload->>'name_en'), '');
  v_city    := NULLIF(trim(p_payload->>'city'), '');
  v_address := NULLIF(trim(p_payload->>'address'), '');
  v_fb      := NULLIF(trim(p_payload->>'facebook_url'), '');
  v_wa      := NULLIF(trim(p_payload->>'whatsapp'), '');
  v_hotline := COALESCE(NULLIF(trim(p_payload->>'hotline'), ''), '19450');
  v_sort    := COALESCE((p_payload->>'sort_order')::INT, 0);

  IF v_fb IS NOT NULL AND v_fb !~* '^https://' THEN
    RAISE EXCEPTION 'الروابط يجب أن تبدأ بـ https://';
  END IF;

  UPDATE public.branches SET
    name_ar = COALESCE(v_name_ar, name_ar),
    name_en = COALESCE(v_name_en, name_en),
    city = COALESCE(v_city, city),
    address = COALESCE(v_address, address),
    facebook_url = v_fb,
    whatsapp = v_wa,
    hotline = v_hotline,
    sort_order = v_sort
   WHERE id = p_branch_id;

  PERFORM public.write_audit('update_branch', 'branches', p_branch_id::text, p_payload);
END $$;

-- [RPC 7] join_batch
DROP FUNCTION IF EXISTS public.join_batch(UUID);
CREATE OR REPLACE FUNCTION public.join_batch(p_batch_id UUID)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_cap INT;
  v_count INT;
  v_status VARCHAR;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT status INTO v_status FROM public.profiles WHERE id = v_user;
  IF v_status = 'suspended' THEN RAISE EXCEPTION 'الحساب موقوف'; END IF;

  IF EXISTS (SELECT 1 FROM public.enrollments WHERE batch_id = p_batch_id AND student_id = v_user) THEN
    RETURN jsonb_build_object('success', false, 'message', 'مسجل بالفعل في هذه الدفعة');
  END IF;

  SELECT COALESCE(c.max_students, 25) INTO v_cap
    FROM public.batches b JOIN public.courses c ON c.id = b.course_id
   WHERE b.id = p_batch_id;

  SELECT count(*) INTO v_count FROM public.enrollments WHERE batch_id = p_batch_id AND status = 'enrolled';

  IF v_count >= v_cap THEN
    INSERT INTO public.waitlist (batch_id, student_id) VALUES (p_batch_id, v_user)
    ON CONFLICT (batch_id, student_id) DO NOTHING;
    RETURN jsonb_build_object('success', true, 'status', 'waitlist', 'message', 'الدورة ممتلئة — أُضفت لقائمة الانتظار');
  END IF;

  INSERT INTO public.enrollments (batch_id, student_id, status)
  VALUES (p_batch_id, v_user, 'enrolled');

  PERFORM public.apply_rule(v_user, 'JOIN_BATCH', v_user);
  PERFORM public.write_audit('join_batch', 'enrollments', p_batch_id::text, jsonb_build_object('student_id', v_user));

  RETURN jsonb_build_object('success', true, 'status', 'enrolled', 'message', 'تم الانضمام للدفعة بنجاح');
END $$;

-- [RPC 8] start_session
DROP FUNCTION IF EXISTS public.start_session(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.start_session(p_batch_id UUID, p_title TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
  v_code TEXT;
  v_snum INT;
BEGIN
  IF NOT (public.is_admin() OR public.is_instructor(p_batch_id)) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COALESCE(max(session_number), 0) + 1 INTO v_snum
    FROM public.sessions WHERE batch_id = p_batch_id;

  v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));

  INSERT INTO public.sessions (batch_id, session_number, title, session_date, checkin_code, status)
  VALUES (p_batch_id, v_snum, COALESCE(p_title, 'المحاضرة ' || v_snum), CURRENT_DATE, v_code, 'active')
  RETURNING id INTO v_id;

  PERFORM public.write_audit('start_session', 'sessions', v_id::text, jsonb_build_object('batch_id', p_batch_id, 'code', v_code));

  RETURN jsonb_build_object('id', v_id, 'checkin_code', v_code, 'session_number', v_snum);
END $$;

-- [RPC 9] student_check_in
DROP FUNCTION IF EXISTS public.student_check_in(TEXT);
CREATE OR REPLACE FUNCTION public.student_check_in(p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session RECORD;
  v_enroll RECORD;
  v_clean_code TEXT := upper(trim(COALESCE(p_code, '')));
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT s.* INTO v_session FROM public.sessions s
   WHERE s.checkin_code = v_clean_code
     AND s.status = 'active'
     AND s.session_date = CURRENT_DATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'رمز الحضور غير صحيح أو الجلسة مغلقة');
  END IF;

  SELECT * INTO v_enroll FROM public.enrollments
   WHERE batch_id = v_session.batch_id AND student_id = v_user AND status = 'enrolled';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'أنت غير مسجل في هذه المجموعة');
  END IF;

  IF EXISTS (SELECT 1 FROM public.attendance WHERE session_id = v_session.id AND student_id = v_user) THEN
    RETURN jsonb_build_object('success', true, 'message', 'تم تسجيل حضورك مسبقاً في هذه المحاضرة');
  END IF;

  INSERT INTO public.attendance (session_id, student_id, status, checkin_method, verified_at, verified_by)
  VALUES (v_session.id, v_user, 'present', 'qr', now(), v_user);

  PERFORM public.apply_rule(v_user, 'ATTEND_PRESENT', v_user);
  PERFORM public.refresh_enrollment_progress(v_session.batch_id, v_user);

  RETURN jsonb_build_object('success', true, 'message', 'تم تسجيل حضورك بنجاح (+15 نقطة)');
END $$;

-- [RPC 10] record_session_attendance
DROP FUNCTION IF EXISTS public.record_session_attendance(UUID, JSONB);
CREATE OR REPLACE FUNCTION public.record_session_attendance(p_session_id UUID, p_records JSONB)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_batch UUID;
  rec RECORD;
  v_count INT := 0;
  v_status TEXT;
  v_rule TEXT;
BEGIN
  SELECT batch_id INTO v_batch FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF;

  IF NOT (public.is_admin() OR public.is_instructor(v_batch)) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  FOR rec IN SELECT * FROM jsonb_to_recordset(p_records) AS x(student_id UUID, status TEXT, notes TEXT)
  LOOP
    v_status := lower(COALESCE(rec.status, 'absent'));
    IF v_status NOT IN ('present','late','absent','excused') THEN
      v_status := 'absent';
    END IF;

    INSERT INTO public.attendance (session_id, student_id, status, notes, verified_at, verified_by)
    VALUES (p_session_id, rec.student_id, v_status, rec.notes, now(), auth.uid())
    ON CONFLICT (session_id, student_id) DO UPDATE SET
      status = EXCLUDED.status,
      notes = EXCLUDED.notes,
      verified_at = now(),
      verified_by = auth.uid();

    IF v_status = 'present' THEN v_rule := 'ATTEND_PRESENT';
    ELSIF v_status = 'late' THEN v_rule := 'ATTEND_LATE';
    ELSIF v_status = 'excused' THEN v_rule := 'ATTEND_EXCUSED';
    ELSE v_rule := NULL;
    END IF;

    IF v_rule IS NOT NULL THEN
      PERFORM public.apply_rule(rec.student_id, v_rule, auth.uid());
    END IF;

    PERFORM public.refresh_enrollment_progress(v_batch, rec.student_id);
    v_count := v_count + 1;
  END LOOP;

  PERFORM public.write_audit('record_attendance', 'sessions', p_session_id::text, jsonb_build_object('count', v_count));

  RETURN jsonb_build_object('success', true, 'count', v_count);
END $$;

-- [RPC 11] close_session
DROP FUNCTION IF EXISTS public.close_session(UUID);
CREATE OR REPLACE FUNCTION public.close_session(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_batch UUID;
BEGIN
  SELECT batch_id INTO v_batch FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF;

  IF NOT (public.is_admin() OR public.is_instructor(v_batch)) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.sessions SET status = 'closed', checkin_code = NULL WHERE id = p_session_id;
  UPDATE public.batches SET sessions_done = (
    SELECT count(*) FROM public.sessions WHERE batch_id = v_batch AND status = 'closed'
  ) WHERE id = v_batch;

  PERFORM public.write_audit('close_session', 'sessions', p_session_id::text);
END $$;

-- [RPC 12] issue_certificates
DROP FUNCTION IF EXISTS public.issue_certificates(UUID);
CREATE OR REPLACE FUNCTION public.issue_certificates(p_batch_id UUID)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_course UUID;
  v_cid UUID;
  enr RECORD;
  v_issued INT := 0;
  v_serial TEXT;
BEGIN
  IF NOT (public.is_admin() OR public.is_instructor(p_batch_id)) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT course_id INTO v_course FROM public.batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch not found'; END IF;

  FOR enr IN
    SELECT e.student_id, e.attendance_pct
      FROM public.enrollments e
     WHERE e.batch_id = p_batch_id
       AND e.status = 'enrolled'
       AND COALESCE(e.attendance_pct, 0) >= 75
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.certs WHERE student_id = enr.student_id AND course_id = v_course) THEN
      v_serial := 'RTC-' || upper(replace(gen_random_uuid()::text, '-', ''));
      INSERT INTO public.certs (serial, student_id, course_id, batch_id, issued_at, qr_code_url)
      VALUES (v_serial, enr.student_id, v_course, p_batch_id, CURRENT_DATE, 'verify.html?s=' || v_serial)
      RETURNING id INTO v_cid;

      PERFORM public.apply_rule(enr.student_id, 'COURSE_COMPLETE', auth.uid());
      PERFORM public.award_badge(enr.student_id, 'graduate');
      v_issued := v_issued + 1;
    END IF;
  END LOOP;

  PERFORM public.write_audit('issue_certs', 'batches', p_batch_id::text, jsonb_build_object('issued', v_issued));

  RETURN jsonb_build_object('success', true, 'issued', v_issued);
END $$;

-- [RPC 13] change_user_role
DROP FUNCTION IF EXISTS public.change_user_role(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.change_user_role(p_user_id UUID, p_role TEXT)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_role NOT IN ('student','volunteer','admin') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;

  UPDATE public.profiles SET role = p_role, updated_at = now() WHERE id = p_user_id;
  PERFORM public.write_audit('change_role', 'profiles', p_user_id::text, jsonb_build_object('role', p_role));
END $$;

-- [RPC 14] set_user_status
DROP FUNCTION IF EXISTS public.set_user_status(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.set_user_status(p_user_id UUID, p_status TEXT)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_status NOT IN ('active','suspended','inactive') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE public.profiles SET status = p_status, updated_at = now() WHERE id = p_user_id;
  PERFORM public.write_audit('set_status', 'profiles', p_user_id::text, jsonb_build_object('status', p_status));
END $$;

-- [RPC 15] assign_instructor
DROP FUNCTION IF EXISTS public.assign_instructor(UUID, UUID);
CREATE OR REPLACE FUNCTION public.assign_instructor(p_batch_id UUID, p_instructor_id UUID)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;

  UPDATE public.batches SET instructor_id = p_instructor_id WHERE id = p_batch_id;
  PERFORM public.write_audit('assign_instructor', 'batches', p_batch_id::text, jsonb_build_object('instructor_id', p_instructor_id));
END $$;

-- [RPC 16] verify_certificate
DROP FUNCTION IF EXISTS public.verify_certificate(TEXT);
CREATE OR REPLACE FUNCTION public.verify_certificate(p_serial TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  student_name TEXT,
  course_title TEXT,
  issued_date TIMESTAMPTZ,
  serial TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT true,
           public.mask_name(p.full_name) AS student_name,
           c.title AS course_title,
           ct.issued_at AS issued_date,
           ct.serial
      FROM public.certs ct
      JOIN public.profiles p ON p.id = ct.student_id
      JOIN public.courses c ON c.id = ct.course_id
     WHERE upper(ct.serial) = upper(trim(p_serial))
     LIMIT 1;
END $$;

-- [RPC 17] get_leaderboard
DROP FUNCTION IF EXISTS public.get_leaderboard();
CREATE FUNCTION public.get_leaderboard()
RETURNS TABLE (id UUID, full_name TEXT, points INT, avatar_url TEXT, rank INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
         p.full_name,
         COALESCE(p.points, 0)::INT AS points,
         p.avatar_url,
         rank() OVER (ORDER BY COALESCE(p.points, 0) DESC, p.id)::INT AS rank
    FROM public.profiles AS p
   WHERE p.role = 'student'
     AND p.status = 'active'
   ORDER BY COALESCE(p.points, 0) DESC, p.id
   LIMIT 20
$$;

-- [RPC 18] submit_excuse
DROP FUNCTION IF EXISTS public.submit_excuse(UUID, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.submit_excuse(
  p_batch_id UUID,
  p_session_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_file TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id UUID;
  clean_reason TEXT := trim(COALESCE(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF length(clean_reason) NOT BETWEEN 8 AND 1500 THEN RAISE EXCEPTION 'اكتب سببًا أوضح للعذر'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.enrollments WHERE batch_id = p_batch_id AND student_id = auth.uid()) THEN
    RAISE EXCEPTION 'لست مسجلًا في هذه المجموعة';
  END IF;
  IF p_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sessions WHERE id = p_session_id AND batch_id = p_batch_id) THEN
    RAISE EXCEPTION 'المحاضرة لا تتبع المجموعة';
  END IF;
  IF p_file IS NOT NULL AND (p_file !~ ('^' || auth.uid()::text || '/[0-9]+\.(pdf|jpg|png|webp)$')) THEN
    RAISE EXCEPTION 'مسار الملف غير صالح';
  END IF;

  INSERT INTO public.excuses (student_id, batch_id, session_id, reason, file_path)
  VALUES (auth.uid(), p_batch_id, p_session_id, clean_reason, p_file)
  RETURNING id INTO new_id;

  RETURN new_id;
END $$;

-- [RPC 19] review_excuse
DROP FUNCTION IF EXISTS public.review_excuse(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.review_excuse(p_excuse_id UUID, p_status TEXT, p_note TEXT DEFAULT '')
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ex public.excuses%ROWTYPE;
  clean_note TEXT := left(trim(COALESCE(p_note, '')), 1000);
BEGIN
  SELECT * INTO ex FROM public.excuses WHERE id = p_excuse_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT (public.is_admin() OR public.is_instructor(ex.batch_id)) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_status NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE public.excuses SET
    status = p_status,
    reviewer_note = clean_note,
    reviewed_by = auth.uid(),
    reviewed_at = now()
   WHERE id = p_excuse_id;

  IF p_status = 'approved' AND ex.session_id IS NOT NULL THEN
    INSERT INTO public.attendance (session_id, student_id, status, notes, verified_at, verified_by)
    VALUES (ex.session_id, ex.student_id, 'excused', clean_note, now(), auth.uid())
    ON CONFLICT (session_id, student_id) DO UPDATE SET
      status = 'excused', notes = clean_note, verified_at = now(), verified_by = auth.uid();
  END IF;
END $$;

-- [RPC 20] submit_session_report
DROP FUNCTION IF EXISTS public.submit_session_report(UUID, TEXT, INT, INT);
CREATE OR REPLACE FUNCTION public.submit_session_report(p_session_id UUID, p_summary TEXT, p_und INT, p_eng INT)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_batch UUID;
  clean_summary TEXT := trim(COALESCE(p_summary, ''));
BEGIN
  SELECT batch_id INTO v_batch FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF;
  IF NOT (public.is_admin() OR public.is_instructor(v_batch)) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF length(clean_summary) NOT BETWEEN 10 AND 3000 THEN
    RAISE EXCEPTION 'ملخص التقرير قصير جدًا';
  END IF;
  IF p_und NOT BETWEEN 1 AND 5 OR p_eng NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'التقييم يجب أن يكون بين 1 و 5';
  END IF;

  INSERT INTO public.session_reports (session_id, instructor_id, summary, understanding_score, engagement_score)
  VALUES (p_session_id, auth.uid(), clean_summary, p_und, p_eng)
  ON CONFLICT (session_id) DO UPDATE SET
    summary = EXCLUDED.summary,
    understanding_score = EXCLUDED.understanding_score,
    engagement_score = EXCLUDED.engagement_score,
    instructor_id = auth.uid(),
    created_at = now();
END $$;

-- [RPC 21] submit_course_rating
DROP FUNCTION IF EXISTS public.submit_course_rating(UUID, INT, TEXT);
CREATE OR REPLACE FUNCTION public.submit_course_rating(p_course_id UUID, p_rating INT, p_comment TEXT DEFAULT '')
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE clean_comment TEXT := left(trim(COALESCE(p_comment, '')), 1000);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'التقييم من 1 إلى 5'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments e
      JOIN public.batches b ON b.id = e.batch_id
     WHERE b.course_id = p_course_id AND e.student_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'لست مسجلًا في هذا الكورس';
  END IF;

  INSERT INTO public.course_ratings (course_id, student_id, rating, comment)
  VALUES (p_course_id, auth.uid(), p_rating, clean_comment)
  ON CONFLICT (course_id, student_id) DO UPDATE SET
    rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = now();
END $$;

-- [RPC 22] broadcast_notice
DROP FUNCTION IF EXISTS public.broadcast_notice(TEXT, UUID, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.broadcast_notice(
  p_scope TEXT,
  p_scope_id UUID DEFAULT NULL,
  p_type TEXT DEFAULT 'info',
  p_title TEXT DEFAULT 'تنبيه مسار',
  p_message TEXT DEFAULT ''
)
RETURNS INT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  clean_title TEXT := trim(COALESCE(p_title, ''));
  clean_message TEXT := trim(COALESCE(p_message, ''));
  clean_type TEXT := lower(trim(COALESCE(p_type, 'info')));
  inserted_count INT := 0;
BEGIN
  IF length(clean_title) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'عنوان التنبيه غير مناسب'; END IF;
  IF length(clean_message) NOT BETWEEN 2 AND 2000 THEN RAISE EXCEPTION 'نص التنبيه غير مناسب'; END IF;
  IF clean_type NOT IN ('info','warning','urgent','success') THEN clean_type := 'info'; END IF;

  IF p_scope = 'batch' THEN
    IF NOT (public.is_admin() OR public.is_instructor(p_scope_id)) THEN RAISE EXCEPTION 'unauthorized'; END IF;
    INSERT INTO public.notifications (user_id, title, message, type)
      SELECT e.student_id, clean_title, clean_message, clean_type
        FROM public.enrollments e
       WHERE e.batch_id = p_scope_id AND e.status = 'enrolled';
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
  ELSIF p_scope = 'branch' THEN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
    INSERT INTO public.notifications (user_id, title, message, type)
      SELECT p.id, clean_title, clean_message, clean_type
        FROM public.profiles p
       WHERE p.branch_id = p_scope_id AND p.status = 'active';
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
  ELSIF p_scope = 'all' THEN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
    INSERT INTO public.notifications (user_id, title, message, type)
      SELECT p.id, clean_title, clean_message, clean_type
        FROM public.profiles p
       WHERE p.status = 'active';
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'نطاق تنبيه غير معروف';
  END IF;

  RETURN inserted_count;
END $$;

-- [RPC 23] add_private_note
DROP FUNCTION IF EXISTS public.add_private_note(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.add_private_note(p_student_id UUID, p_body TEXT)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID; clean_body TEXT := trim(COALESCE(p_body, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF length(clean_body) NOT BETWEEN 3 AND 2000 THEN RAISE EXCEPTION 'نص الملاحظة غير مناسب'; END IF;
  IF NOT (public.is_admin() OR public.is_instructor_for_student(p_student_id)) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.private_notes (student_id, author_id, body)
  VALUES (p_student_id, auth.uid(), clean_body) RETURNING id INTO new_id;

  RETURN new_id;
END $$;

-- [RPC 24] claim_social_badge
DROP FUNCTION IF EXISTS public.claim_social_badge();
CREATE OR REPLACE FUNCTION public.claim_social_badge()
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  PERFORM public.apply_rule(v_user, 'SOCIAL_SHARE', v_user);
  PERFORM public.award_badge(v_user, 'social');
END $$;

-- [RPC 25] disable_my_push_devices
DROP FUNCTION IF EXISTS public.disable_my_push_devices();
CREATE OR REPLACE FUNCTION public.disable_my_push_devices()
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.push_devices SET is_active = false, updated_at = now() WHERE user_id = auth.uid();
END $$;

-- [RPC 26] register_push_device
DROP FUNCTION IF EXISTS public.register_push_device(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.register_push_device(p_token TEXT, p_platform TEXT, p_version TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  clean_token TEXT := trim(COALESCE(p_token, ''));
  clean_platform TEXT := lower(trim(COALESCE(p_platform, '')));
  clean_version TEXT := left(trim(COALESCE(p_version, '100.0.0')), 20);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF length(clean_token) < 16 THEN RAISE EXCEPTION 'invalid token'; END IF;
  IF clean_platform NOT IN ('android','ios','web') THEN RAISE EXCEPTION 'invalid platform'; END IF;

  INSERT INTO public.push_devices (user_id, token, platform, app_version, is_active, last_seen_at)
  VALUES (auth.uid(), clean_token, clean_platform, clean_version, true, now())
  ON CONFLICT (token) DO UPDATE SET
    user_id = auth.uid(),
    platform = EXCLUDED.platform,
    app_version = EXCLUDED.app_version,
    is_active = true,
    last_seen_at = now(),
    updated_at = now();
END $$;

-- 4. Explicit Grants & Revokes across all 26 Functions

-- Revoke all from PUBLIC and anon for all authenticated RPCs
REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_my_profile(TEXT, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.batch_roster(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_profiles() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.batch_seat_counts(UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_branch_directory(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_batch(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_session(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.student_check_in(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_session_attendance(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_session(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.issue_certificates(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.change_user_role(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_user_status(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_instructor(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_leaderboard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_excuse(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_excuse(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_session_report(UUID, TEXT, INT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_course_rating(UUID, INT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.broadcast_notice(TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_private_note(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_social_badge() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.disable_my_push_devices() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_push_device(TEXT, TEXT, TEXT) FROM PUBLIC, anon;

-- Grant EXECUTE to authenticated
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_roster(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_seat_counts(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_branch_directory(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_batch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_session(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_check_in(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_session_attendance(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_certificates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_instructor(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_excuse(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_excuse(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_session_report(UUID, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_course_rating(UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_notice(TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_private_note(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_social_badge() TO authenticated;
GRANT EXECUTE ON FUNCTION public.disable_my_push_devices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_push_device(TEXT, TEXT, TEXT) TO authenticated;

-- verify_certificate is granted to anon AND authenticated for public QR lookup
GRANT EXECUTE ON FUNCTION public.verify_certificate(TEXT) TO anon, authenticated;

-- Helper functions
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_instructor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_instructor_for_student(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mask_name(TEXT) TO anon, authenticated;

-- 5. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
