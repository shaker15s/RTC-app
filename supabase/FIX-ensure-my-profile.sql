-- ════════════════════════════════════════════════════════════════
-- FIX: إصلاح «الحفظ من شاشة إكمال البيانات لا يفتح التطبيق»
-- idempotent — آمن للتشغيل أكثر من مرة.
--
-- المشكلة: حسابات اتسجّلت قبل تفعيل trigger «handle_new_user»
-- (أو فشل إنشاء صفها لأي سبب) مفيهاش صف في public.profiles،
-- فتحديث الملف الشخصي كان بيطيّح 0 صفوف والعميل ماكانش بيعرض سبب.
--
-- الحل هنا جزئين:
--   1) RPC «ensure_my_profile»: ينشئ/يحدّث صف المستخدم الحالي
--      بأمان من السيرفر (بدون منح INSERT مباشر على الجدول).
--   2) Backfill: تعبئة أي صف ناقص لكل حسابات Auth الموجودة حالياً.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ensure_my_profile(
  p_full_name TEXT DEFAULT NULL,
  p_phone     TEXT DEFAULT NULL,
  p_branch    UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid   UUID := auth.uid();
  _email TEXT := COALESCE(auth.jwt() ->> 'email', '');
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  -- الحساب الموقوف لا يعدّل ولا ينشئ شيئاً (نفس منطق سياسة التحديث)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND status = 'inactive') THEN
    RAISE EXCEPTION 'account inactive' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, branch_id)
  VALUES (
    _uid,
    NULLIF(_email, ''),
    COALESCE(NULLIF(p_full_name, ''), ''),
    NULLIF(p_phone, ''),
    p_branch
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    phone     = COALESCE(EXCLUDED.phone,  public.profiles.phone),
    branch_id = COALESCE(EXCLUDED.branch_id, public.profiles.branch_id);
  -- الدور والنقاط والحالة لا تُلمس هنا إطلاقاً:
  -- الافتراضيات + trigger «protect_founder» يتكفّلون بها.
END $$;

REVOKE ALL      ON FUNCTION public.ensure_my_profile(TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE   ON FUNCTION public.ensure_my_profile(TEXT, TEXT, UUID) TO authenticated;

-- ── Backfill: صف لكل حساب Auth ناقص — يُصلح الحسابات العالقة فوراً ──
INSERT INTO public.profiles (id, email, full_name, role, status, avatar_url)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(COALESCE(u.email, 'user'), '@', 1)
  ),
  CASE WHEN lower(COALESCE(u.email, '')) = 'shakerabdallah66@gmail.com' THEN 'admin' ELSE 'student' END,
  'active',
  COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
