-- ═══════════════════════════════════════════════════════════════════
--  مسار RTC v10 — عدّاد المقاعد (RPC آمن بلا أي بيانات شخصية)
--  شغّل هذا الملف في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة.
-- ═══════════════════════════════════════════════════════════════════

-- الدالة ترجّع أعداد فقط: batch_id, enrolled, capacity, seats_left
-- لا ترجّع أسماء ولا معرّفات طلاب ⇒ لا تسريب PII للاستكشاف.
DROP FUNCTION IF EXISTS public.batch_seat_counts(uuid[]);

CREATE OR REPLACE FUNCTION public.batch_seat_counts(p_batch_ids uuid[])
RETURNS TABLE (
  batch_id   uuid,
  enrolled   integer,
  capacity   integer,
  seats_left integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    b.id AS batch_id,
    COALESCE(e.cnt, 0)::int AS enrolled,
    COALESCE(c.max_students, 30)::int AS capacity,
    GREATEST(COALESCE(c.max_students, 30) - COALESCE(e.cnt, 0), 0)::int AS seats_left
  FROM public.batches b
  LEFT JOIN public.courses c ON c.id = b.course_id
  LEFT JOIN (
    SELECT en.batch_id, COUNT(*) AS cnt
    FROM public.enrollments en
    WHERE en.batch_id = ANY (p_batch_ids)
    GROUP BY en.batch_id
  ) e ON e.batch_id = b.id
  WHERE b.id = ANY (p_batch_ids)
    AND COALESCE(b.is_active, true) = true;
$$;

REVOKE ALL ON FUNCTION public.batch_seat_counts(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.batch_seat_counts(uuid[]) TO authenticated;

-- فهرس يسرّع العدّ
CREATE INDEX IF NOT EXISTS enrollments_batch_idx ON public.enrollments (batch_id);

-- ═══════════════ تحقق سريع ═══════════════
-- SELECT * FROM public.batch_seat_counts(ARRAY(SELECT id FROM public.batches LIMIT 5));
