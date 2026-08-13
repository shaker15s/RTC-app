-- ═══════════════════════════════════════════════════════════════════
-- Masar RTC v100 — mobile platform, privacy boundaries, verified data
-- Apply after 20260813120000_production_v9.sql. Idempotent.
-- ═══════════════════════════════════════════════════════════════════

-- Public content provenance: never present an old social link as verified.
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS maps_url TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS opening_hours TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS data_status TEXT NOT NULL DEFAULT 'needs_review';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.branches ADD CONSTRAINT branches_data_status_check
    CHECK (data_status IN ('verified', 'needs_review', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_branches_updated ON public.branches;
CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Structured fields preserve the old free-text schedule while enabling reminders.
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS requirements TEXT NOT NULL DEFAULT '';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS learning_outcomes JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS application_deadline TIMESTAMPTZ;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Africa/Cairo';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'offline';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS meeting_url TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS room TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
DO $$ BEGIN
  ALTER TABLE public.batches ADD CONSTRAINT batches_delivery_mode_check
    CHECK (delivery_mode IN ('offline', 'online', 'hybrid'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.batches ADD CONSTRAINT batches_time_range_check
    CHECK (ends_at IS NULL OR (starts_at IS NOT NULL AND ends_at > starts_at));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.batches ADD CONSTRAINT batches_meeting_url_check
    CHECK (meeting_url IS NULL OR meeting_url ~ '^https://');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_courses_updated ON public.courses;
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_batches_updated ON public.batches;
CREATE TRIGGER trg_batches_updated BEFORE UPDATE ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Verified social profiles discovered from each branch's public RTC profile.
UPDATE public.branches SET
  facebook_url = CASE slug
    WHEN 'faisal' THEN 'https://www.facebook.com/RTCFaisal/'
    WHEN 'nasr-city' THEN 'https://www.facebook.com/RTC.Nasrcity/'
    WHEN 'october' THEN 'https://www.facebook.com/rtcoctobercity/'
    WHEN 'maadi' THEN 'https://www.facebook.com/RTCMaadi/'
    WHEN 'helwan' THEN 'https://www.facebook.com/RTC.Helwan.RTC/'
    ELSE facebook_url END,
  data_status = CASE WHEN slug IN ('faisal','nasr-city','october','maadi','helwan') THEN 'verified' ELSE data_status END,
  source_url = CASE WHEN slug IN ('faisal','nasr-city','october','maadi','helwan') THEN
    CASE slug
      WHEN 'faisal' THEN 'https://www.facebook.com/RTCFaisal/'
      WHEN 'nasr-city' THEN 'https://www.facebook.com/RTC.Nasrcity/'
      WHEN 'october' THEN 'https://www.facebook.com/rtcoctobercity/'
      WHEN 'maadi' THEN 'https://www.facebook.com/RTCMaadi/'
      WHEN 'helwan' THEN 'https://www.facebook.com/RTC.Helwan.RTC/' END
    ELSE source_url END,
  verified_at = CASE WHEN slug IN ('faisal','nasr-city','october','maadi','helwan') THEN '2026-08-13T00:00:00Z'::timestamptz ELSE verified_at END;

-- ───────── Caller-bound PII APIs ─────────
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT jsonb_build_object(
    'id', p.id, 'role', p.role, 'status', p.status,
    'full_name', p.full_name, 'phone', p.phone, 'email', p.email,
    'lang', p.lang, 'dark_mode', p.dark_mode,
    'points', p.points, 'streak', p.streak, 'attendance_pct', p.attendance_pct,
    'branch_id', p.branch_id, 'avatar_url', p.avatar_url,
    'created_at', p.created_at, 'updated_at', p.updated_at,
    'badge_ids', COALESCE((SELECT jsonb_agg(sb.badge_id ORDER BY sb.earned_at) FROM public.student_badges sb WHERE sb.student_id = p.id), '[]'::jsonb),
    'branches', CASE WHEN b.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', b.id, 'slug', b.slug, 'name_ar', b.name_ar, 'name_en', b.name_en,
      'city', b.city, 'address', b.address, 'facebook_url', b.facebook_url,
      'whatsapp', b.whatsapp, 'hotline', b.hotline, 'maps_url', b.maps_url,
      'opening_hours', b.opening_hours, 'data_status', b.data_status
    ) END
  ) INTO result
  FROM public.profiles p LEFT JOIN public.branches b ON b.id = p.branch_id
  WHERE p.id = auth.uid();
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'للمشرف فقط'; END IF;
  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT p.created_at, jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'role', p.role, 'status', p.status,
      'email', p.email, 'phone', p.phone, 'points', p.points,
      'branch_id', p.branch_id, 'avatar_url', p.avatar_url, 'created_at', p.created_at,
      'branches', CASE WHEN b.id IS NULL THEN NULL ELSE jsonb_build_object('name_ar', b.name_ar) END
    ) row_data
    FROM public.profiles p LEFT JOIN public.branches b ON b.id = p.branch_id
  ) q;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.is_instructor_for_student(_student UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.enrollments e JOIN public.batches b ON b.id = e.batch_id
    WHERE e.student_id = _student AND b.instructor_id = auth.uid() AND b.is_active = true
  )
$$;

-- Profile table access is safe-column only. Own/admin PII comes from bound RPCs.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, role, status, full_name, points, streak, attendance_pct,
  branch_id, avatar_url, created_at, updated_at) ON public.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_instructor_for_student(UUID) TO authenticated;

-- ───────── Least-privilege row scopes for volunteers ─────────
DROP POLICY IF EXISTS badges_own ON public.student_badges;
CREATE POLICY badges_own ON public.student_badges FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.is_admin() OR public.is_instructor_for_student(student_id));

DROP POLICY IF EXISTS enroll_read ON public.enrollments;
CREATE POLICY enroll_read ON public.enrollments FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.is_admin() OR public.is_instructor(batch_id));

DROP POLICY IF EXISTS wait_read ON public.waitlist;
CREATE POLICY wait_read ON public.waitlist FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.is_admin() OR public.is_instructor(batch_id));

DROP POLICY IF EXISTS sessions_read ON public.sessions;
CREATE POLICY sessions_read ON public.sessions FOR SELECT TO authenticated USING (
  public.is_admin() OR public.is_instructor(batch_id)
  OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.batch_id = sessions.batch_id AND e.student_id = auth.uid())
);

DROP POLICY IF EXISTS attendance_read ON public.attendance;
CREATE POLICY attendance_read ON public.attendance FOR SELECT TO authenticated USING (
  student_id = auth.uid() OR public.is_admin()
  OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = attendance.session_id AND public.is_instructor(s.batch_id))
);

DROP POLICY IF EXISTS ledger_read ON public.points_ledger;
CREATE POLICY ledger_read ON public.points_ledger FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.is_admin() OR public.is_instructor_for_student(student_id));

DROP POLICY IF EXISTS certs_read ON public.certs;
CREATE POLICY certs_read ON public.certs FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.is_admin() OR (batch_id IS NOT NULL AND public.is_instructor(batch_id)));

DROP POLICY IF EXISTS excuses_read ON public.excuses;
CREATE POLICY excuses_read ON public.excuses FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.is_admin() OR (batch_id IS NOT NULL AND public.is_instructor(batch_id)));

DROP POLICY IF EXISTS reports_read ON public.session_reports;
CREATE POLICY reports_read ON public.session_reports FOR SELECT TO authenticated USING (
  public.is_admin() OR author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_reports.session_id AND public.is_instructor(s.batch_id))
);

DROP POLICY IF EXISTS notes_staff ON public.private_notes;
CREATE POLICY notes_staff ON public.private_notes FOR SELECT TO authenticated
USING (public.is_admin() OR author_id = auth.uid());

-- ───────── Profile self-heal + privacy-safe public certificate result ─────────
CREATE OR REPLACE FUNCTION public.ensure_my_profile(p_full_name TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL, p_branch UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u auth.users%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO u FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.profiles (id, email, full_name, phone, branch_id, avatar_url, role, status)
  VALUES (u.id, u.email,
    COALESCE(NULLIF(trim(p_full_name), ''), u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
    NULLIF(trim(p_phone), ''), p_branch,
    COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'), 'student', 'active')
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(trim(p_full_name), ''), public.profiles.full_name),
    phone = COALESCE(NULLIF(trim(p_phone), ''), public.profiles.phone),
    branch_id = COALESCE(p_branch, public.profiles.branch_id),
    email = COALESCE(public.profiles.email, EXCLUDED.email);
END $$;
REVOKE ALL ON FUNCTION public.ensure_my_profile(TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile(TEXT, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.mask_name(value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN trim(COALESCE(value,'')) = '' THEN '—'
    WHEN array_length(regexp_split_to_array(trim(value), '\s+'), 1) = 1 THEN left(trim(value), 1) || '•••'
    ELSE split_part(trim(value), ' ', 1) || ' ' || left((regexp_split_to_array(trim(value), '\s+'))[array_length(regexp_split_to_array(trim(value), '\s+'),1)], 1) || '•••'
  END
$$;

CREATE OR REPLACE FUNCTION public.verify_certificate(p_serial TEXT)
RETURNS TABLE (is_valid BOOLEAN, student_name TEXT, course_title TEXT, issued_date TIMESTAMPTZ, serial TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF length(trim(COALESCE(p_serial,''))) < 10 OR length(p_serial) > 80 THEN RETURN; END IF;
  RETURN QUERY
  SELECT TRUE, public.mask_name(p.full_name), COALESCE(c.title_ar, c.title), crt.issued_at, crt.serial_number
  FROM public.certs crt JOIN public.profiles p ON p.id = crt.student_id
  JOIN public.courses c ON c.id = crt.course_id
  WHERE upper(crt.serial_number) = upper(trim(p_serial));
END $$;

-- Aggregate seat counts without exposing the enrollment roster.
-- OUT signatures varied across v10 deployments; PostgreSQL requires a drop first.
DROP FUNCTION IF EXISTS public.batch_seat_counts(UUID[]);
CREATE FUNCTION public.batch_seat_counts(p_batch_ids UUID[])
RETURNS TABLE (batch_id UUID, enrolled INT, capacity INT, seats_left INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF COALESCE(array_length(p_batch_ids, 1), 0) > 100 THEN RAISE EXCEPTION 'too many batches'; END IF;
  RETURN QUERY
  SELECT
    b.id,
    COUNT(e.id)::INT,
    COALESCE(c.max_students, 30)::INT,
    GREATEST(COALESCE(c.max_students, 30) - COUNT(e.id)::INT, 0)::INT
  FROM public.batches b
  JOIN public.courses c ON c.id = b.course_id
  LEFT JOIN public.enrollments e ON e.batch_id = b.id
  WHERE b.id = ANY(p_batch_ids) AND b.is_active = true AND c.is_active = true
  GROUP BY b.id, c.max_students;
END $$;
REVOKE ALL ON FUNCTION public.batch_seat_counts(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.batch_seat_counts(UUID[]) TO authenticated;

-- ───────── Push token registration (delivery remains server/Edge Function only) ─────────
CREATE TABLE IF NOT EXISTS public.push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios','web')),
  app_version TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_devices FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_push_device(p_token TEXT, p_platform TEXT, p_version TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_platform NOT IN ('android','ios','web') OR length(trim(p_token)) < 20 OR length(p_token) > 4096 THEN
    RAISE EXCEPTION 'invalid device registration';
  END IF;
  INSERT INTO public.push_devices (user_id, token, platform, app_version)
  VALUES (auth.uid(), trim(p_token), p_platform, left(p_version, 40))
  ON CONFLICT (token) DO UPDATE SET user_id = auth.uid(), platform = EXCLUDED.platform,
    app_version = EXCLUDED.app_version, enabled = true, last_seen_at = now();
END $$;
REVOKE ALL ON FUNCTION public.register_push_device(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_device(TEXT, TEXT, TEXT) TO authenticated;

-- Storage enforces the same restrictions as the client (the server is authoritative).
UPDATE storage.buckets SET file_size_limit = 1048576,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id = 'avatars';
UPDATE storage.buckets SET file_size_limit = 4194304,
  allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/png','image/webp']
WHERE id = 'excuses';
DROP POLICY IF EXISTS avatars_delete ON storage.objects;
CREATE POLICY avatars_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS excuses_delete ON storage.objects;
CREATE POLICY excuses_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'excuses' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Certificate serials now carry 128 random bits (legacy serials remain valid).
CREATE OR REPLACE FUNCTION public.issue_certificates(p_batch_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.batches%ROWTYPE; c public.courses%ROWTYPE; e RECORD;
  issued INT := 0; serial TEXT;
BEGIN
  IF NOT public.is_instructor(p_batch_id) THEN RAISE EXCEPTION 'غير مسموح بإصدار الشهادات'; END IF;
  SELECT * INTO b FROM public.batches WHERE id = p_batch_id;
  SELECT * INTO c FROM public.courses WHERE id = b.course_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'لا يوجد كورس مرتبط'; END IF;
  FOR e IN SELECT * FROM public.enrollments WHERE batch_id = p_batch_id
    AND COALESCE(sessions_done, 0) >= GREATEST(c.sessions_count, 1)
  LOOP
    serial := 'RTC-' || upper(replace(gen_random_uuid()::text, '-', ''));
    INSERT INTO public.certs (student_id, course_id, batch_id, serial_number, issued_by)
    VALUES (e.student_id, c.id, p_batch_id, serial, auth.uid())
    ON CONFLICT (student_id, course_id) DO NOTHING;
    IF FOUND THEN
      issued := issued + 1;
      PERFORM public.apply_rule(e.student_id, 'COURSE_COMPLETE', auth.uid());
      PERFORM public.award_badge(e.student_id, 'graduate');
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (e.student_id, 'شهادة جديدة 🎓', 'تم إصدار شهادة إتمام دورة ' || c.title, 'certificate');
    END IF;
  END LOOP;
  PERFORM public.write_audit('issue_certs', 'batches', p_batch_id::text, jsonb_build_object('issued', issued));
  RETURN jsonb_build_object('issued', issued);
END $$;

-- Volunteer committees are content records, not authorization roles.
CREATE TABLE IF NOT EXISTS public.volunteer_committees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'ph-hand-heart',
  description TEXT NOT NULL DEFAULT '',
  roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  is_accepting BOOLEAN NOT NULL DEFAULT false,
  application_url TEXT,
  source_url TEXT,
  data_status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (data_status IN ('verified','secondary_source','needs_review','archived')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.volunteer_committees ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'ph-hand-heart';
DO $$ BEGIN
  ALTER TABLE public.volunteer_committees ADD CONSTRAINT volunteer_committees_application_url_check
    CHECK (application_url IS NULL OR application_url ~ '^https://');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.volunteer_committees ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_volunteer_committees_updated ON public.volunteer_committees;
CREATE TRIGGER trg_volunteer_committees_updated BEFORE UPDATE ON public.volunteer_committees
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP POLICY IF EXISTS volunteer_committees_read ON public.volunteer_committees;
DROP POLICY IF EXISTS volunteer_committees_admin_insert ON public.volunteer_committees;
DROP POLICY IF EXISTS volunteer_committees_admin_update ON public.volunteer_committees;
DROP POLICY IF EXISTS volunteer_committees_admin_delete ON public.volunteer_committees;
CREATE POLICY volunteer_committees_read ON public.volunteer_committees FOR SELECT TO authenticated
USING (is_active = true OR public.is_admin());
CREATE POLICY volunteer_committees_admin_insert ON public.volunteer_committees FOR INSERT TO authenticated
WITH CHECK (public.is_admin());
CREATE POLICY volunteer_committees_admin_update ON public.volunteer_committees FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY volunteer_committees_admin_delete ON public.volunteer_committees FOR DELETE TO authenticated
USING (public.is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.volunteer_committees TO authenticated;

INSERT INTO public.volunteer_committees (id, slug, name_ar, icon, description, roles, source_url, data_status, is_accepting) VALUES
('b1111111-1111-1111-1111-111111111111','organization','لجنة التنظيم','ph-calendar-check','تنسيق رحلة الكورس ومتابعة المجموعات والحضور.', '["تنظيم المواعيد","متابعة الحضور","إنشاء ومتابعة المجموعات","مساعدة المدربين"]', 'https://egyincs.com/opportunities/resala-training-centre-rtc-volunteer/','secondary_source',false),
('b2222222-2222-2222-2222-222222222222','training','لجنة التدريب','ph-chalkboard-teacher','تقديم العلم وإعداد المحتوى والتقييمات.', '["كمبيوتر","لغات","تنمية بشرية","تدريب أونلاين"]', 'https://egyincs.com/opportunities/resala-training-centre-rtc-volunteer/','secondary_source',false),
('b3333333-3333-3333-3333-333333333333','marketing','لجنة التسويق','ph-megaphone','التعريف بالفرص وإدارة المحتوى الرقمي.', '["تصميم","كتابة محتوى","متابعة الصفحات"]', 'https://egyincs.com/opportunities/resala-training-centre-rtc-volunteer/','secondary_source',false),
('b4444444-4444-4444-4444-444444444444','reception','لجنة الاستقبال','ph-handshake','استقبال المستفيدين وشرح المجالات والإجراءات.', '["استقبال المستفيدين","شرح إجراءات التسجيل"]', 'https://egyincs.com/opportunities/resala-training-centre-rtc-volunteer/','secondary_source',false),
('b5555555-5555-5555-5555-555555555555','people','الموارد البشرية','ph-users-three','اختيار المتطوعين وتوجيههم ومتابعة نموهم.', '["اختيار وتوجيه المتطوعين","التدريب والمتابعة"]', 'https://accountantssociety.com/التطوع-في-rtc/','secondary_source',false)
ON CONFLICT (slug) DO UPDATE SET
  name_ar = EXCLUDED.name_ar, icon = EXCLUDED.icon, description = EXCLUDED.description, roles = EXCLUDED.roles,
  source_url = EXCLUDED.source_url, data_status = EXCLUDED.data_status;

-- Defense-in-depth input bounds and relationship checks for SECURITY DEFINER RPCs.
CREATE OR REPLACE FUNCTION public.broadcast_notice(p_scope TEXT, p_scope_id UUID, p_type TEXT, p_title TEXT, p_message TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT := 0; clean_title TEXT := trim(COALESCE(p_title,'')); clean_message TEXT := trim(COALESCE(p_message,'')); clean_type TEXT := COALESCE(p_type,'announcement');
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  IF length(clean_title) NOT BETWEEN 2 AND 120 OR length(clean_message) NOT BETWEEN 2 AND 2000 THEN
    RAISE EXCEPTION 'راجع طول عنوان ونص التنبيه';
  END IF;
  IF clean_type NOT IN ('announcement','postponed','cancelled','reminder','certificate') THEN RAISE EXCEPTION 'نوع غير صالح'; END IF;
  IF p_scope = 'batch' THEN
    IF p_scope_id IS NULL OR NOT public.is_instructor(p_scope_id) THEN RAISE EXCEPTION 'غير مسموح لهذه المجموعة'; END IF;
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT e.student_id, clean_title, clean_message, clean_type FROM public.enrollments e WHERE e.batch_id = p_scope_id;
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF p_scope = 'branch' THEN
    IF p_scope_id IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'بث الفرع للمشرف فقط'; END IF;
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT p.id, clean_title, clean_message, clean_type FROM public.profiles p WHERE p.branch_id = p_scope_id AND p.status = 'active';
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF p_scope = 'all' THEN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'البث العام للمشرف فقط'; END IF;
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT p.id, clean_title, clean_message, clean_type FROM public.profiles p WHERE p.status = 'active';
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSE RAISE EXCEPTION 'نطاق غير صالح'; END IF;
  PERFORM public.write_audit('broadcast', p_scope, COALESCE(p_scope_id::text,'all'), jsonb_build_object('count',n,'type',clean_type));
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.add_private_note(p_student_id UUID, p_body TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID; clean_body TEXT := trim(COALESCE(p_body,''));
BEGIN
  IF NOT (public.is_admin() OR public.is_instructor_for_student(p_student_id)) THEN RAISE EXCEPTION 'غير مسموح لهذا الطالب'; END IF;
  IF length(clean_body) NOT BETWEEN 2 AND 2000 THEN RAISE EXCEPTION 'راجع طول الملاحظة'; END IF;
  INSERT INTO public.private_notes (student_id, author_id, body)
  VALUES (p_student_id, auth.uid(), clean_body) RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.submit_excuse(p_batch_id UUID, p_session_id UUID, p_reason TEXT, p_file TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID; clean_reason TEXT := trim(COALESCE(p_reason,''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF length(clean_reason) NOT BETWEEN 8 AND 1500 THEN RAISE EXCEPTION 'اكتب سببًا أوضح للعذر'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.enrollments WHERE batch_id = p_batch_id AND student_id = auth.uid()) THEN RAISE EXCEPTION 'لست مسجلًا في هذه المجموعة'; END IF;
  IF p_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sessions WHERE id = p_session_id AND batch_id = p_batch_id) THEN RAISE EXCEPTION 'المحاضرة لا تتبع المجموعة'; END IF;
  IF p_file IS NOT NULL AND (p_file !~ ('^' || auth.uid()::text || '/[0-9]+\.(pdf|jpg|png|webp)$')) THEN RAISE EXCEPTION 'مسار الملف غير صالح'; END IF;
  INSERT INTO public.excuses (student_id, batch_id, session_id, reason, file_path)
  VALUES (auth.uid(), p_batch_id, p_session_id, clean_reason, p_file) RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.review_excuse(p_excuse_id UUID, p_status TEXT, p_note TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ex public.excuses%ROWTYPE; clean_note TEXT := left(trim(COALESCE(p_note,'')),1000);
BEGIN
  IF p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'حالة غير صالحة'; END IF;
  SELECT * INTO ex FROM public.excuses WHERE id = p_excuse_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF NOT public.is_instructor(ex.batch_id) THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  UPDATE public.excuses SET status = p_status, reviewed_by = auth.uid(), review_note = clean_note WHERE id = p_excuse_id;
  IF p_status = 'approved' AND ex.session_id IS NOT NULL THEN
    INSERT INTO public.attendance (session_id, batch_id, student_id, status, recorded_by)
    VALUES (ex.session_id, ex.batch_id, ex.student_id, 'excused', auth.uid())
    ON CONFLICT (session_id, student_id) DO UPDATE SET status = 'excused', recorded_by = auth.uid();
    PERFORM public.refresh_enrollment_progress(ex.batch_id, ex.student_id);
    PERFORM public.refresh_student_stats(ex.student_id);
  END IF;
  PERFORM public.write_audit('review_excuse','excuses',p_excuse_id::text,jsonb_build_object('status',p_status));
END $$;

CREATE OR REPLACE FUNCTION public.submit_session_report(p_session_id UUID, p_summary TEXT, p_und INT, p_eng INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sess public.sessions%ROWTYPE; clean_summary TEXT := trim(COALESCE(p_summary,''));
BEGIN
  SELECT * INTO sess FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND OR NOT public.is_instructor(sess.batch_id) THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  IF length(clean_summary) > 3000 OR p_und NOT BETWEEN 1 AND 5 OR p_eng NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'راجع بيانات التقرير'; END IF;
  INSERT INTO public.session_reports (session_id, author_id, summary, understanding, engagement)
  VALUES (p_session_id, auth.uid(), clean_summary, p_und, p_eng)
  ON CONFLICT (session_id) DO UPDATE SET summary = EXCLUDED.summary, understanding = EXCLUDED.understanding,
    engagement = EXCLUDED.engagement, author_id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.submit_course_rating(p_course_id UUID, p_rating INT, p_comment TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE clean_comment TEXT := trim(COALESCE(p_comment,''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_rating NOT BETWEEN 1 AND 5 OR length(clean_comment) > 1000 THEN RAISE EXCEPTION 'تقييم غير صالح'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.enrollments e JOIN public.batches b ON b.id=e.batch_id WHERE e.student_id=auth.uid() AND b.course_id=p_course_id) THEN RAISE EXCEPTION 'قيّم دورة انضممت لها فقط'; END IF;
  INSERT INTO public.course_ratings (course_id,student_id,rating,comment)
  VALUES (p_course_id,auth.uid(),p_rating,clean_comment)
  ON CONFLICT (course_id,student_id) DO UPDATE SET rating=EXCLUDED.rating, comment=EXCLUDED.comment, created_at=now();
END $$;

-- Admin-only branch directory editor with provenance and bounded public fields.
CREATE OR REPLACE FUNCTION public.update_branch_directory(p_branch_id UUID, p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT := trim(COALESCE(p_payload->>'name_ar',''));
  v_city TEXT := trim(COALESCE(p_payload->>'city',''));
  v_address TEXT := trim(COALESCE(p_payload->>'address',''));
  v_facebook TEXT := NULLIF(trim(COALESCE(p_payload->>'facebook_url','')), '');
  v_maps TEXT := NULLIF(trim(COALESCE(p_payload->>'maps_url','')), '');
  v_source TEXT := NULLIF(trim(COALESCE(p_payload->>'source_url','')), '');
  v_whatsapp TEXT := NULLIF(regexp_replace(COALESCE(p_payload->>'whatsapp',''),'[^0-9+]','','g'), '');
  v_hotline TEXT := NULLIF(regexp_replace(COALESCE(p_payload->>'hotline',''),'[^0-9+]','','g'), '');
  v_hours TEXT := left(trim(COALESCE(p_payload->>'opening_hours','')),300);
  v_status TEXT := COALESCE(p_payload->>'data_status','needs_review');
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'للمشرف فقط'; END IF;
  IF length(v_name) NOT BETWEEN 3 AND 160 OR length(v_city) > 100 OR length(v_address) > 500 THEN RAISE EXCEPTION 'راجع اسم وعنوان الفرع'; END IF;
  IF v_status NOT IN ('verified','needs_review','archived') THEN RAISE EXCEPTION 'حالة بيانات غير صالحة'; END IF;
  IF (v_facebook IS NOT NULL AND v_facebook !~ '^https://') OR (v_maps IS NOT NULL AND v_maps !~ '^https://') OR (v_source IS NOT NULL AND v_source !~ '^https://') THEN RAISE EXCEPTION 'الروابط يجب أن تبدأ بـ https://'; END IF;
  IF length(COALESCE(v_facebook,'')) > 500 OR length(COALESCE(v_maps,'')) > 1000 OR length(COALESCE(v_source,'')) > 1000 THEN RAISE EXCEPTION 'الرابط أطول من المسموح'; END IF;
  UPDATE public.branches SET name_ar=v_name, city=v_city, address=v_address,
    facebook_url=v_facebook, maps_url=v_maps, source_url=v_source,
    whatsapp=v_whatsapp, hotline=COALESCE(v_hotline,'19450'), opening_hours=v_hours,
    data_status=v_status, verified_at=CASE WHEN v_status='verified' THEN now() ELSE verified_at END
  WHERE id=p_branch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفرع غير موجود'; END IF;
  PERFORM public.write_audit('update_branch','branches',p_branch_id::text,jsonb_build_object('status',v_status));
END $$;
REVOKE ALL ON FUNCTION public.update_branch_directory(UUID,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_branch_directory(UUID,JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.disable_my_push_devices()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.push_devices SET enabled=false, last_seen_at=now() WHERE user_id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.disable_my_push_devices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.disable_my_push_devices() TO authenticated;
