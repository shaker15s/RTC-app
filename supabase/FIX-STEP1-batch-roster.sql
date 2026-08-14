-- ═══════════════════════════════════════════════════════════════════
-- إصلاح: إعادة تركيب batch_roster المفقودة
-- التعريف منسوخ حرفيًا من 20260813120000_production_v9.sql (سطر 1031)
-- آمن: لا يمسح بيانات، وقابل لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.batch_roster(uuid);

CREATE FUNCTION public.batch_roster(p_batch_id UUID)
RETURNS TABLE (
  enrollment_id UUID, student_id UUID, full_name TEXT, avatar_url TEXT,
  phone TEXT, sessions_done INT, points INT, streak INT, attendance_pct INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_instructor(p_batch_id) THEN
    RAISE EXCEPTION 'غير مسموح بكشف هذه المجموعة';
  END IF;
  RETURN QUERY
  SELECT e.id, p.id, p.full_name, p.avatar_url,
         CASE WHEN public.is_admin() THEN p.phone ELSE public.mask_phone(p.phone) END,
         COALESCE(e.sessions_done, 0), p.points, p.streak, p.attendance_pct
  FROM public.enrollments e
  JOIN public.profiles p ON p.id = e.student_id
  WHERE e.batch_id = p_batch_id
  ORDER BY p.full_name;
END $$;

REVOKE ALL ON FUNCTION public.batch_roster(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.batch_roster(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
