-- ═══════════════════════════════════════════════════════════════════
--  مسار RTC v10 — العلاقات + طلبات الدور + تعيين المشرفين
--  شغّل هذا الملف في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  القواعد الثابتة:
--   • كل مستخدم جديد = طالب.
--   • المشرف المؤسس shakerabdallah66@gmail.com يُثبَّت من SQL فقط.
--   • الواجهة لا تستطيع تعيين مشرف إطلاقاً — التعيين عبر RPC للمشرف فقط.
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════ 1) العلاقات (FKs) اللازمة لـ PostgREST embeds ═══════════════
-- بدون هذه المفاتيح تفشل استعلامات مثل batches?select=courses(...),profiles(...)

-- أولاً: تنظيف أي صفوف يتيمة (تشير لسجل محذوف) وإلا يفشل إنشاء المفتاح.
UPDATE public.batches  b SET course_id     = NULL
  WHERE b.course_id     IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.courses  x WHERE x.id = b.course_id);
UPDATE public.batches  b SET instructor_id = NULL
  WHERE b.instructor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles x WHERE x.id = b.instructor_id);
UPDATE public.batches  b SET branch_id     = NULL
  WHERE b.branch_id     IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.branches x WHERE x.id = b.branch_id);
UPDATE public.profiles p SET branch_id     = NULL
  WHERE p.branch_id     IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.branches x WHERE x.id = p.branch_id);

DELETE FROM public.enrollments e
  WHERE e.batch_id   IS NULL OR NOT EXISTS (SELECT 1 FROM public.batches  x WHERE x.id = e.batch_id);
DELETE FROM public.enrollments e
  WHERE e.student_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles x WHERE x.id = e.student_id);

DO $$
BEGIN
  -- batches.course_id → courses.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batches_course_id_fkey') THEN
    ALTER TABLE public.batches
      ADD CONSTRAINT batches_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
  END IF;

  -- batches.instructor_id → profiles.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batches_instructor_id_fkey') THEN
    ALTER TABLE public.batches
      ADD CONSTRAINT batches_instructor_id_fkey
      FOREIGN KEY (instructor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  -- batches.branch_id → branches.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batches_branch_id_fkey') THEN
    ALTER TABLE public.batches
      ADD CONSTRAINT batches_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
  END IF;

  -- enrollments.batch_id → batches.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_batch_id_fkey') THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_batch_id_fkey
      FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;
  END IF;

  -- enrollments.student_id → profiles.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_student_id_fkey') THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  -- profiles.branch_id → branches.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_branch_id_fkey') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- فهارس العلاقات الأكثر استخداماً
CREATE INDEX IF NOT EXISTS batches_course_idx     ON public.batches (course_id);
CREATE INDEX IF NOT EXISTS batches_branch_idx     ON public.batches (branch_id);
CREATE INDEX IF NOT EXISTS batches_instructor_idx ON public.batches (instructor_id);
CREATE INDEX IF NOT EXISTS enrollments_student_idx ON public.enrollments (student_id);
CREATE INDEX IF NOT EXISTS profiles_branch_idx    ON public.profiles (branch_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx      ON public.profiles (role) WHERE status = 'active';


-- ═══════════════ 2) بوابة ترقية المشرفين ═══════════════
-- الحارس protect_founder يمنع أي كتابة مباشرة تجعل role='admin'.
-- نسمح بالاستثناء فقط داخل RPC موثوق يضبط علم الجلسة rtc.allow_admin_grant.

CREATE OR REPLACE FUNCTION public.protect_founder()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  founder CONSTANT TEXT := 'shakerabdallah66@gmail.com';
  granting BOOLEAN := COALESCE(current_setting('rtc.allow_admin_grant', true), '') = '1';
BEGIN
  -- المؤسس دائماً مشرف نشط، ولا يمكن إنزاله
  IF lower(COALESCE(NEW.email, '')) = founder THEN
    NEW.role := 'admin';
    NEW.status := 'active';
    RETURN NEW;
  END IF;

  IF NEW.role = 'admin' AND NOT granting THEN
    -- لا أحد يصبح مشرفاً عبر كتابة صف مباشرة (ولا من الواجهة)
    IF TG_OP = 'UPDATE' THEN
      NEW.role := CASE WHEN OLD.role = 'admin' THEN 'admin' ELSE OLD.role END;
    ELSE
      NEW.role := 'student';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_founder ON public.profiles;
CREATE TRIGGER trg_protect_founder
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_founder();


-- ═══════════════ 3) مشرف يعيّن مشرفاً (RPC للمشرفين فقط) ═══════════════
DROP FUNCTION IF EXISTS public.grant_admin(uuid);
DROP FUNCTION IF EXISTS public.revoke_admin(uuid);

CREATE OR REPLACE FUNCTION public.grant_admin(p_user_id uuid)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'للمشرف فقط'; END IF;
  SELECT * INTO target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'المستخدم غير موجود'; END IF;
  IF target.status <> 'active' THEN RAISE EXCEPTION 'الحساب غير نشط'; END IF;

  PERFORM set_config('rtc.allow_admin_grant', '1', true);   -- محلي للمعاملة فقط
  UPDATE public.profiles SET role = 'admin' WHERE id = p_user_id;
  PERFORM set_config('rtc.allow_admin_grant', '0', true);

  PERFORM public.write_audit('grant_admin', 'profiles', p_user_id::text,
    jsonb_build_object('from', target.role, 'to', 'admin'));
END $$;

CREATE OR REPLACE FUNCTION public.revoke_admin(p_user_id uuid)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'للمشرف فقط'; END IF;
  SELECT * INTO target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'المستخدم غير موجود'; END IF;
  IF lower(COALESCE(target.email, '')) = 'shakerabdallah66@gmail.com' THEN
    RAISE EXCEPTION 'لا يمكن سحب صلاحية المشرف المؤسس';
  END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'لا يمكنك سحب صلاحيتك بنفسك'; END IF;

  PERFORM set_config('rtc.allow_admin_grant', '1', true);
  UPDATE public.profiles SET role = 'volunteer' WHERE id = p_user_id;
  PERFORM set_config('rtc.allow_admin_grant', '0', true);

  PERFORM public.write_audit('revoke_admin', 'profiles', p_user_id::text,
    jsonb_build_object('from', 'admin', 'to', 'volunteer'));
END $$;

REVOKE ALL ON FUNCTION public.grant_admin(uuid)  FROM public;
REVOKE ALL ON FUNCTION public.revoke_admin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.grant_admin(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin(uuid) TO authenticated;


-- ═══════════════ 4) طلبات ترقية الدور (طالب → متطوع) ═══════════════
CREATE TABLE IF NOT EXISTS public.role_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested    TEXT NOT NULL DEFAULT 'volunteer' CHECK (requested IN ('volunteer')),
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_note  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS role_requests_user_idx   ON public.role_requests (user_id);
CREATE INDEX IF NOT EXISTS role_requests_status_idx ON public.role_requests (status);
-- طلب معلّق واحد فقط لكل مستخدم
CREATE UNIQUE INDEX IF NOT EXISTS role_requests_one_pending_uidx
  ON public.role_requests (user_id) WHERE status = 'pending';

ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_requests_read_own   ON public.role_requests;
DROP POLICY IF EXISTS role_requests_read_admin ON public.role_requests;
DROP POLICY IF EXISTS role_requests_insert_own ON public.role_requests;
DROP POLICY IF EXISTS role_requests_no_update  ON public.role_requests;

CREATE POLICY role_requests_read_own ON public.role_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY role_requests_read_admin ON public.role_requests FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY role_requests_insert_own ON public.role_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
-- التحديث عبر RPC فقط (لا سياسة UPDATE ⇒ ممنوع من الواجهة)

DROP FUNCTION IF EXISTS public.request_role_upgrade(text);
CREATE OR REPLACE FUNCTION public.request_role_upgrade(p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'سجّل الدخول أولاً'; END IF;
  IF length(COALESCE(trim(p_reason), '')) < 10 THEN RAISE EXCEPTION 'اكتب سبباً أوضح (١٠ أحرف على الأقل)'; END IF;
  IF public.current_role() <> 'student' THEN RAISE EXCEPTION 'الطلاب فقط يمكنهم طلب الترقية'; END IF;
  IF EXISTS (SELECT 1 FROM public.role_requests WHERE user_id = auth.uid() AND status = 'pending') THEN
    RAISE EXCEPTION 'لديك طلب قيد المراجعة بالفعل';
  END IF;

  INSERT INTO public.role_requests (user_id, requested, reason)
  VALUES (auth.uid(), 'volunteer', trim(p_reason))
  RETURNING id INTO new_id;

  RETURN new_id;
END $$;

DROP FUNCTION IF EXISTS public.review_role_request(uuid, boolean, text);
CREATE OR REPLACE FUNCTION public.review_role_request(p_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req public.role_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'للمشرف فقط'; END IF;
  SELECT * INTO req FROM public.role_requests WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'تمت مراجعة الطلب من قبل'; END IF;

  UPDATE public.role_requests
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = auth.uid(), review_note = p_note, reviewed_at = now()
   WHERE id = p_id;

  IF p_approve THEN
    -- ترقية لمتطوع فقط. المشرف لا يُمنح من هنا إطلاقاً.
    UPDATE public.profiles SET role = 'volunteer' WHERE id = req.user_id;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (req.user_id, 'تمت ترقيتك 🎉', 'صرت متطوعاً في مسار RTC. شكراً لعطائك.', 'announcement');
  ELSE
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (req.user_id, 'بخصوص طلب الترقية',
            COALESCE(NULLIF(trim(p_note), ''), 'لم يُقبل الطلب حالياً.'), 'announcement');
  END IF;

  PERFORM public.write_audit('review_role_request', 'role_requests', p_id::text,
    jsonb_build_object('approved', p_approve));
END $$;

REVOKE ALL ON FUNCTION public.request_role_upgrade(text) FROM public;
REVOKE ALL ON FUNCTION public.review_role_request(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.request_role_upgrade(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_role_request(uuid, boolean, text) TO authenticated;


-- ═══════════════ 5) تثبيت المؤسس (المصدر الوحيد لصلاحية الأدمن) ═══════════════
UPDATE public.profiles
   SET role = 'admin', status = 'active'
 WHERE lower(COALESCE(email, '')) = 'shakerabdallah66@gmail.com';


-- ═══════════════ تحقق ═══════════════
-- SELECT email, role, status FROM public.profiles WHERE role = 'admin';
-- SELECT conname FROM pg_constraint WHERE conname LIKE 'batches_%_fkey';
