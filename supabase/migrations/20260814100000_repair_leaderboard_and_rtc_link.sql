-- Repair migration: installs the public leaderboard RPC expected by Masar RTC v100.
-- This is safe to apply after partially applied v9/v100 deployments.
-- The no-argument signature deliberately matches PostgREST's RPC lookup.

DROP FUNCTION IF EXISTS public.get_leaderboard();

CREATE FUNCTION public.get_leaderboard()
RETURNS TABLE (id UUID, full_name TEXT, points INT, avatar_url TEXT, rank INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

REVOKE ALL ON FUNCTION public.get_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;

-- Ask PostgREST to reload its schema cache immediately when the extension is available.
NOTIFY pgrst, 'reload schema';
