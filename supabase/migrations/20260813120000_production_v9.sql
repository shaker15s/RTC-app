-- ═══════════════════════════════════════════════════════════════════
--  مسار RTC v9 — Production Schema, RLS, RPCs, Storage
--  Idempotent: safe on a fresh project AND on the existing v8 cloud DB
--  Founder admin is enforced ONLY here (never in the browser)
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────── Helper: drop every public policy (rebuild clean) ───────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════
--  TABLES
-- ═══════════════════════════════════════════════════════════════════

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
  role            VARCHAR(20) NOT NULL DEFAULT 'student'
                    CHECK (role IN ('student', 'volunteer', 'admin')),
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'pending')),
  full_name       TEXT NOT NULL DEFAULT '',
  phone           TEXT UNIQUE,
  email           TEXT,
  lang            VARCHAR(5) NOT NULL DEFAULT 'ar' CHECK (lang IN ('ar', 'en')),
  dark_mode       BOOLEAN NOT NULL DEFAULT false,
  points          INT NOT NULL DEFAULT 0,
  streak          INT NOT NULL DEFAULT 0,
  attendance_pct  INT NOT NULL DEFAULT 0,
  branch_id       UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role VARCHAR(20);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status VARCHAR(20);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lang VARCHAR(5);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS attendance_pct INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_branch_fk
    FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.student_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id    TEXT NOT NULL,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, badge_id)
);

CREATE TABLE IF NOT EXISTS public.courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  title_ar        TEXT,
  title_en        TEXT,
  category        TEXT DEFAULT 'عام',
  icon            TEXT DEFAULT 'ph-fill ph-book-open',
  color           TEXT DEFAULT '#00288e',
  sessions_count  INT NOT NULL DEFAULT 8,
  max_students    INT NOT NULL DEFAULT 30,
  level           TEXT DEFAULT 'الكل',
  description     TEXT DEFAULT '',
  start_date      TEXT DEFAULT '',
  interview_date  TEXT DEFAULT '',
  branch_id       UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS title_ar TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS cat TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS sessions_count INT DEFAULT 8;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS max_students INT DEFAULT 30;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'الكل';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS start_date TEXT DEFAULT '';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS interview_date TEXT DEFAULT '';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.batches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  instructor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  branch_id        UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  schedule         TEXT DEFAULT '',
  location         TEXT DEFAULT '',
  sessions_done    INT NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS course_id UUID;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS instructor_id UUID;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS instructor_name TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS schedule TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS sessions_done INT DEFAULT 0;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS lectures_done INT DEFAULT 0;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, student_id)
);

ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS course_id UUID;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS sessions_done INT DEFAULT 0;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.waitlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'محاضرة',
  session_number  INT NOT NULL DEFAULT 1,
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  checkin_code    TEXT UNIQUE,
  closed_at       TIMESTAMPTZ,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS session_number INT DEFAULT 1;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS session_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS checkin_code TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS sessions_batch_date_uidx
  ON public.sessions (batch_id, session_date);

CREATE TABLE IF NOT EXISTS public.attendance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'excused', 'late')),
  note         TEXT,
  recorded_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS session_id UUID;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS status VARCHAR(20);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS recorded_by UUID;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.points_rules (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code    TEXT UNIQUE NOT NULL,
  title   TEXT NOT NULL,
  amount  INT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.points_ledger (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rule_id     UUID REFERENCES public.points_rules(id) ON DELETE SET NULL,
  amount      INT NOT NULL,
  reason      TEXT,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.certs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id      UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  batch_id       UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  serial_number  TEXT UNIQUE NOT NULL,
  issued_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (student_id, course_id)
);

ALTER TABLE public.certs ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.certs ADD COLUMN IF NOT EXISTS course_id UUID;
ALTER TABLE public.certs ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE public.certs ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE public.certs ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.certs ADD COLUMN IF NOT EXISTS issued_by UUID;

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  message     TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'announcement',
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'announcement';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.excuses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  batch_id     UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  session_id   UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  reason       TEXT NOT NULL,
  file_path    TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_note  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.session_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  summary      TEXT NOT NULL DEFAULT '',
  understanding INT CHECK (understanding IS NULL OR (understanding BETWEEN 1 AND 5)),
  engagement   INT CHECK (engagement IS NULL OR (engagement BETWEEN 1 AND 5)),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.private_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
--  SEED: branches (canonical IDs — never free-text again)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO public.branches (id, slug, name_ar, name_en, city, address, facebook_url, whatsapp, sort_order) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'faisal',
   'فرع فيصل — الطوابق (الجيزة)', 'Faisal — Tawabeq (Giza)', 'الجيزة',
   '٥ شارع منسى ياسين – الطوابق – أمام بي تك',
   'https://www.facebook.com/RTCFaisal/', '19450', 1),
  ('a2222222-2222-2222-2222-222222222222', 'nasr-city',
   'فرع مدينة نصر (القاهرة)', 'Nasr City (Cairo)', 'القاهرة',
   '٤ شارع زكي رستم – متفرع من عباس العقاد',
   'https://www.facebook.com/RTC.Nasrcity/', '19450', 2),
  ('a3333333-3333-3333-3333-333333333333', 'october',
   'فرع 6 أكتوبر (الجيزة)', '6th of October (Giza)', 'الجيزة',
   'الحي السابع – ميدان ماجدة بجوار مسجد الحصري',
   'https://www.facebook.com/groups/RTC.October/', '01113553081', 3),
  ('a4444444-4444-4444-4444-444444444444', 'maadi',
   'فرع المعادي (القاهرة)', 'Maadi (Cairo)', 'القاهرة',
   '٨/٣د تقسيم اللاسلكي – المعادي الجديدة',
   NULL, '19450', 4),
  ('a5555555-5555-5555-5555-555555555555', 'mokattam',
   'فرع المقطم (القاهرة)', 'Mokattam (Cairo)', 'القاهرة',
   'شارع ٩ – خلف موقف الأتوبيس – الهضبة الوسطى',
   NULL, '19450', 5),
  ('a6666666-6666-6666-6666-666666666666', 'smouha',
   'فرع الإسكندرية — سموحة', 'Smouha (Alexandria)', 'الإسكندرية',
   '٤٤ شارع توت عنخ آمون — بجوار كوبري كليوباترا',
   'https://www.facebook.com/RTC.Alex/', '19450', 6),
  ('a7777777-7777-7777-7777-777777777777', 'dokki',
   'فرع مصدق — الدقي (الجيزة)', 'Mosaddeq — Dokki (Giza)', 'الجيزة',
   '١١ شارع مصدق — أمام مستشفى ابن سينا',
   'https://www.facebook.com/RTC.Dokki/', '19450', 7),
  ('a8888888-8888-8888-8888-888888888888', 'helwan',
   'فرع حلوان (القاهرة)', 'Helwan (Cairo)', 'القاهرة',
   '١٦ أ شارع يوسف زكي — أمام رئاسة حي حلوان',
   NULL, '01110640528', 8)
ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
  address = EXCLUDED.address, facebook_url = COALESCE(public.branches.facebook_url, EXCLUDED.facebook_url),
  city = EXCLUDED.city, sort_order = EXCLUDED.sort_order;

INSERT INTO public.points_rules (code, title, amount) VALUES
  ('JOIN_BATCH',           'الانضمام لمجموعة', 5),
  ('ATTENDANCE_PRESENT',   'حضور المحاضرة', 10),
  ('ATTENDANCE_LATE',      'حضور متأخر', 5),
  ('HOMEWORK_SUBMISSION',  'تسليم الواجب', 15),
  ('COURSE_COMPLETE',      'إتمام الدورة', 40)
ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, amount = EXCLUDED.amount;

-- Seed courses (keep stable IDs used by v8)
INSERT INTO public.courses (id, title, title_ar, category, branch_id, icon, color, sessions_count, is_active, description) VALUES
  ('11111111-1111-1111-1111-111111111111',
   'تطوير تطبيقات الويب Full-Stack (JS & React)', 'تطوير تطبيقات الويب Full-Stack (JS & React)',
   'برمجة وتكنولوجيا', 'a1111111-1111-1111-1111-111111111111',
   'ph-fill ph-code', '#00288e', 10, true,
   'مسار عملي لبناء تطبيقات ويب حديثة من الواجهة حتى قاعدة البيانات.'),
  ('22222222-2222-2222-2222-222222222222',
   'التصميم الجرافيكي المتقدم (Photoshop & Illustrator)', 'التصميم الجرافيكي المتقدم',
   'تصميم وفنون', 'a1111111-1111-1111-1111-111111111111',
   'ph-fill ph-palette', '#7a30d8', 8, true,
   'أساسيات الهوية البصرية والتصميم الإعلاني بأدوات أدوبي.'),
  ('33333333-3333-3333-3333-333333333333',
   'التسويق الرقمي وإدارة حملات السوشيال ميديا', 'التسويق الرقمي',
   'تسويق إلكتروني', 'a1111111-1111-1111-1111-111111111111',
   'ph-fill ph-megaphone', '#d4af37', 8, true,
   'تخطيط الحملات، المحتوى، وقياس الأداء لصفحات الجمعية والأنشطة.'),
  ('44444444-4444-4444-4444-444444444444',
   'اللغة الإنجليزية للمحادثة وسوق العمل', 'الإنجليزية للمحادثة وسوق العمل',
   'لغات وتواصل', 'a2222222-2222-2222-2222-222222222222',
   'ph-fill ph-translate', '#ba1a1a', 12, true,
   'محادثة يومية ومقابلات عمل وكتابة سيرة ذاتية باللغة الإنجليزية.'),
  ('55555555-5555-5555-5555-555555555555',
   'الإكسيل المحاسبي المتقدم Advanced Excel', 'الإكسيل المحاسبي المتقدم',
   'محاسبة وماليات', 'a7777777-7777-7777-7777-777777777777',
   'ph-fill ph-microsoft-excel-logo', '#0284c7', 8, true,
   'دوال، جداول محورية، ولوحات متابعة مالية للمتطوعين والموظفين.')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, is_active = true;

-- ═══════════════════════════════════════════════════════════════════
--  SECURITY DEFINER HELPERS (no RLS recursion)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'volunteer') AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_instructor(_batch UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.batches
    WHERE id = _batch AND instructor_id = auth.uid() AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.mask_phone(p TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL OR length(p) < 7 THEN '—'
    ELSE substr(p, 1, 3) || '••••' || right(p, 2)
  END
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Founder: the only bootstrap admin. Never trust the client with this email.
CREATE OR REPLACE FUNCTION public.protect_founder()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE founder CONSTANT TEXT := 'shakerabdallah66@gmail.com';
BEGIN
  IF lower(COALESCE(NEW.email, '')) = founder THEN
    NEW.role := 'admin';
    NEW.status := 'active';
  ELSIF NEW.role = 'admin' THEN
    -- nobody else may become admin via a row write
    IF TG_OP = 'UPDATE' THEN
      NEW.role := OLD.role;
      IF NEW.role = 'admin' AND lower(COALESCE(OLD.email, '')) <> founder THEN
        NEW.role := 'student';
      END IF;
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

-- Auto-create profile on signup. Everyone is a student. Founder → admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  founder CONSTANT TEXT := 'shakerabdallah66@gmail.com';
  _role TEXT := 'student';
  _name TEXT;
BEGIN
  IF lower(COALESCE(NEW.email, '')) = founder THEN _role := 'admin'; END IF;
  _name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(COALESCE(NEW.email, 'user'), '@', 1)
  );
  INSERT INTO public.profiles (id, email, full_name, role, status, avatar_url)
  VALUES (
    NEW.id, NEW.email, _name, _role, 'active',
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Promote founder if the account already exists
UPDATE public.profiles p
SET role = 'admin', status = 'active', email = COALESCE(p.email, u.email)
FROM auth.users u
WHERE p.id = u.id AND lower(u.email) = 'shakerabdallah66@gmail.com';

-- Points cache: ledger is the source of truth
CREATE OR REPLACE FUNCTION public.sync_points_from_ledger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid UUID;
BEGIN
  sid := COALESCE(NEW.student_id, OLD.student_id);
  UPDATE public.profiles
     SET points = COALESCE((SELECT SUM(amount) FROM public.points_ledger WHERE student_id = sid), 0)
   WHERE id = sid;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_ledger_sync ON public.points_ledger;
CREATE TRIGGER trg_ledger_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.points_ledger
  FOR EACH ROW EXECUTE FUNCTION public.sync_points_from_ledger();

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

CREATE OR REPLACE FUNCTION public.refresh_student_stats(_student UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tot INT; pres INT; pct INT; streak INT := 0; rec RECORD; run INT := 0;
BEGIN
  SELECT COUNT(*) INTO tot FROM public.attendance WHERE student_id = _student;
  SELECT COUNT(*) INTO pres FROM public.attendance
    WHERE student_id = _student AND status IN ('present', 'late', 'excused');
  pct := CASE WHEN tot = 0 THEN 0 ELSE ROUND(pres * 100.0 / tot) END;

  FOR rec IN
    SELECT a.status
    FROM public.attendance a
    JOIN public.sessions s ON s.id = a.session_id
    WHERE a.student_id = _student
    ORDER BY s.session_date DESC, a.created_at DESC
  LOOP
    IF rec.status IN ('present', 'late') THEN run := run + 1; ELSE EXIT; END IF;
  END LOOP;
  streak := run;

  UPDATE public.profiles SET attendance_pct = pct, streak = streak WHERE id = _student;

  IF (SELECT points FROM public.profiles WHERE id = _student) >= 100 THEN
    PERFORM public.award_badge(_student, 'points100');
  END IF;
  IF (SELECT points FROM public.profiles WHERE id = _student) >= 500 THEN
    PERFORM public.award_badge(_student, 'points500');
  END IF;
  IF streak >= 5 THEN
    PERFORM public.award_badge(_student, 'streak5');
  END IF;
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

-- ═══════════════════════════════════════════════════════════════════
--  RPCs (the only way to mutate sensitive state)
--  Drop first: CREATE OR REPLACE cannot change OUT/return row types
-- ═══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.verify_certificate(text);
DROP FUNCTION IF EXISTS public.get_leaderboard();
DROP FUNCTION IF EXISTS public.batch_roster(uuid);

CREATE OR REPLACE FUNCTION public.join_batch(p_batch_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.batches%ROWTYPE;
  c public.courses%ROWTYPE;
  enrolled INT;
  already BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF public.current_role() IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'الطلاب فقط يمكنهم الانضمام للمجموعات';
  END IF;

  SELECT * INTO b FROM public.batches WHERE id = p_batch_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'المجموعة غير متاحة'; END IF;
  SELECT * INTO c FROM public.courses WHERE id = b.course_id AND is_active = true;

  SELECT EXISTS(SELECT 1 FROM public.enrollments WHERE batch_id = p_batch_id AND student_id = auth.uid())
    INTO already;
  IF already THEN RETURN jsonb_build_object('status', 'already'); END IF;

  SELECT COUNT(*) INTO enrolled FROM public.enrollments WHERE batch_id = p_batch_id;
  IF c.max_students IS NOT NULL AND enrolled >= c.max_students THEN
    INSERT INTO public.waitlist (batch_id, student_id) VALUES (p_batch_id, auth.uid())
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('status', 'waitlisted', 'max', c.max_students);
  END IF;

  INSERT INTO public.enrollments (batch_id, student_id, course_id, sessions_done)
  VALUES (p_batch_id, auth.uid(), b.course_id, 0);

  PERFORM public.apply_rule(auth.uid(), 'JOIN_BATCH', auth.uid());
  PERFORM public.award_badge(auth.uid(), 'welcome');
  PERFORM public.award_badge(auth.uid(), 'firstCourse');
  IF (SELECT COUNT(*) FROM public.enrollments WHERE student_id = auth.uid()) >= 3 THEN
    PERFORM public.award_badge(auth.uid(), 'explorer');
  END IF;

  RETURN jsonb_build_object('status', 'joined');
END $$;

CREATE OR REPLACE FUNCTION public.start_session(p_batch_id UUID, p_title TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.batches%ROWTYPE;
  existing public.sessions%ROWTYPE;
  sess public.sessions%ROWTYPE;
  code TEXT;
BEGIN
  IF NOT public.is_instructor(p_batch_id) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية بدء محاضرة لهذه المجموعة';
  END IF;
  SELECT * INTO b FROM public.batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'المجموعة غير موجودة'; END IF;

  SELECT * INTO existing FROM public.sessions
   WHERE batch_id = p_batch_id AND session_date = CURRENT_DATE;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', existing.id, 'checkin_code', existing.checkin_code,
      'session_number', existing.session_number, 'reuse', true
    );
  END IF;

  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  INSERT INTO public.sessions (batch_id, title, session_number, session_date, checkin_code, created_by)
  VALUES (
    p_batch_id,
    COALESCE(NULLIF(p_title, ''), 'محاضرة ' || (b.sessions_done + 1)),
    b.sessions_done + 1,
    CURRENT_DATE,
    code,
    auth.uid()
  ) RETURNING * INTO sess;

  UPDATE public.batches SET sessions_done = sessions_done + 1 WHERE id = p_batch_id;
  PERFORM public.write_audit('start_session', 'sessions', sess.id::text, jsonb_build_object('batch', p_batch_id));

  RETURN jsonb_build_object(
    'id', sess.id, 'checkin_code', sess.checkin_code,
    'session_number', sess.session_number, 'reuse', false
  );
END $$;

CREATE OR REPLACE FUNCTION public.student_check_in(p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sess public.sessions%ROWTYPE;
  enrolled BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO sess FROM public.sessions
   WHERE upper(checkin_code) = upper(trim(p_code)) AND closed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'رمز الحضور غير صحيح أو المحاضرة أُغلقت'; END IF;
  IF sess.session_date <> CURRENT_DATE THEN
    RAISE EXCEPTION 'رمز الحضور منتهٍ';
  END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.enrollments WHERE batch_id = sess.batch_id AND student_id = auth.uid()
  ) INTO enrolled;
  IF NOT enrolled THEN RAISE EXCEPTION 'لست مسجلاً في هذه المجموعة'; END IF;

  INSERT INTO public.attendance (session_id, student_id, status, recorded_by)
  VALUES (sess.id, auth.uid(), 'present', auth.uid())
  ON CONFLICT (session_id, student_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.points_ledger pl
    JOIN public.points_rules pr ON pr.id = pl.rule_id
    WHERE pl.student_id = auth.uid() AND pr.code = 'ATTENDANCE_PRESENT'
      AND pl.created_at::date = CURRENT_DATE
      AND pl.reason LIKE '%' || sess.id::text || '%'
  ) THEN
    INSERT INTO public.points_ledger (student_id, rule_id, amount, reason, created_by)
    SELECT auth.uid(), id, amount, 'حضور المحاضرة · ' || sess.id::text, auth.uid()
    FROM public.points_rules WHERE code = 'ATTENDANCE_PRESENT';
  END IF;

  PERFORM public.award_badge(auth.uid(), 'firstAttend');
  PERFORM public.refresh_enrollment_progress(sess.batch_id, auth.uid());
  PERFORM public.refresh_student_stats(auth.uid());

  RETURN jsonb_build_object('status', 'present', 'session_id', sess.id);
END $$;

CREATE OR REPLACE FUNCTION public.record_session_attendance(p_session_id UUID, p_records JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sess public.sessions%ROWTYPE;
  rec JSONB;
  sid UUID;
  st TEXT;
  rule_code TEXT;
BEGIN
  SELECT * INTO sess FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'المحاضرة غير موجودة'; END IF;
  IF NOT public.is_instructor(sess.batch_id) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية تسجيل الحضور';
  END IF;

  FOR rec IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    sid := (rec->>'student_id')::uuid;
    st := rec->>'status';
    IF st NOT IN ('present', 'absent', 'late', 'excused') THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.enrollments WHERE batch_id = sess.batch_id AND student_id = sid) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.attendance (session_id, batch_id, student_id, status, note, recorded_by)
    VALUES (p_session_id, sess.batch_id, sid, st, rec->>'note', auth.uid())
    ON CONFLICT (session_id, student_id) DO UPDATE
      SET status = EXCLUDED.status, note = EXCLUDED.note, recorded_by = auth.uid();

    rule_code := CASE st WHEN 'present' THEN 'ATTENDANCE_PRESENT' WHEN 'late' THEN 'ATTENDANCE_LATE' ELSE NULL END;
    IF rule_code IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.points_ledger pl
        JOIN public.points_rules pr ON pr.id = pl.rule_id
        WHERE pl.student_id = sid AND pr.code = rule_code
          AND pl.reason LIKE '%' || p_session_id::text || '%'
      ) THEN
        INSERT INTO public.points_ledger (student_id, rule_id, amount, reason, created_by)
        SELECT sid, id, amount, (SELECT title FROM public.points_rules WHERE code = rule_code) || ' · ' || p_session_id::text, auth.uid()
        FROM public.points_rules WHERE code = rule_code;
      END IF;
      PERFORM public.award_badge(sid, 'firstAttend');
    END IF;

    PERFORM public.refresh_enrollment_progress(sess.batch_id, sid);
    PERFORM public.refresh_student_stats(sid);
  END LOOP;

  PERFORM public.write_audit('record_attendance', 'sessions', p_session_id::text, jsonb_build_object('count', jsonb_array_length(p_records)));
  RETURN jsonb_build_object('ok', true, 'count', jsonb_array_length(p_records));
END $$;

CREATE OR REPLACE FUNCTION public.close_session(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sess public.sessions%ROWTYPE;
BEGIN
  SELECT * INTO sess FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'المحاضرة غير موجودة'; END IF;
  IF NOT public.is_instructor(sess.batch_id) THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  UPDATE public.sessions SET closed_at = now() WHERE id = p_session_id;
END $$;

CREATE OR REPLACE FUNCTION public.issue_certificates(p_batch_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.batches%ROWTYPE;
  c public.courses%ROWTYPE;
  e RECORD;
  issued INT := 0;
  serial TEXT;
BEGIN
  IF NOT public.is_instructor(p_batch_id) THEN RAISE EXCEPTION 'غير مسموح بإصدار الشهادات'; END IF;
  SELECT * INTO b FROM public.batches WHERE id = p_batch_id;
  SELECT * INTO c FROM public.courses WHERE id = b.course_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'لا يوجد كورس مرتبط'; END IF;

  FOR e IN
    SELECT * FROM public.enrollments
     WHERE batch_id = p_batch_id AND COALESCE(sessions_done, 0) >= GREATEST(c.sessions_count, 1)
  LOOP
    serial := 'RTC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
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

CREATE OR REPLACE FUNCTION public.change_user_role(p_user_id UUID, p_role TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'للمشرف فقط'; END IF;
  IF p_role NOT IN ('student', 'volunteer') THEN
    RAISE EXCEPTION 'يمكن التعيين كطالب أو متطوع فقط';
  END IF;
  SELECT * INTO target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'المستخدم غير موجود'; END IF;
  IF lower(COALESCE(target.email, '')) = 'shakerabdallah66@gmail.com' THEN
    RAISE EXCEPTION 'لا يمكن تعديل حساب المشرف المؤسس';
  END IF;
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
  PERFORM public.write_audit('change_role', 'profiles', p_user_id::text,
    jsonb_build_object('from', target.role, 'to', p_role));
END $$;

CREATE OR REPLACE FUNCTION public.set_user_status(p_user_id UUID, p_status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'للمشرف فقط'; END IF;
  IF p_status NOT IN ('active', 'inactive') THEN RAISE EXCEPTION 'حالة غير صالحة'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND lower(COALESCE(email,'')) = 'shakerabdallah66@gmail.com'
  ) THEN RAISE EXCEPTION 'لا يمكن تعطيل المشرف المؤسس'; END IF;
  UPDATE public.profiles SET status = p_status WHERE id = p_user_id;
  PERFORM public.write_audit('set_status', 'profiles', p_user_id::text, jsonb_build_object('status', p_status));
END $$;

CREATE OR REPLACE FUNCTION public.assign_instructor(p_batch_id UUID, p_instructor_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_admin() OR auth.uid() = p_instructor_id) THEN
    RAISE EXCEPTION 'غير مسموح';
  END IF;
  IF auth.uid() = p_instructor_id AND public.current_role() NOT IN ('volunteer', 'admin') THEN
    RAISE EXCEPTION 'المتطوعون فقط يمكنهم تولّي الإشراف';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_instructor_id AND role IN ('volunteer', 'admin') AND status = 'active'
  ) THEN RAISE EXCEPTION 'المدرّس يجب أن يكون متطوعاً أو مشرفاً نشطاً'; END IF;

  UPDATE public.batches b
     SET instructor_id = p_instructor_id,
         instructor_name = (SELECT full_name FROM public.profiles WHERE id = p_instructor_id)
   WHERE b.id = p_batch_id;
  PERFORM public.write_audit('assign_instructor', 'batches', p_batch_id::text,
    jsonb_build_object('instructor', p_instructor_id));
END $$;

CREATE OR REPLACE FUNCTION public.verify_certificate(p_serial TEXT)
RETURNS TABLE (is_valid BOOLEAN, student_name TEXT, course_title TEXT, issued_date TIMESTAMPTZ, serial TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT TRUE, p.full_name, COALESCE(c.title_ar, c.title), crt.issued_at, crt.serial_number
  FROM public.certs crt
  JOIN public.profiles p ON p.id = crt.student_id
  JOIN public.courses c ON c.id = crt.course_id
  WHERE upper(crt.serial_number) = upper(trim(p_serial));
END $$;

CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (id UUID, full_name TEXT, points INT, avatar_url TEXT, rank INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.points, p.avatar_url,
         rank() OVER (ORDER BY p.points DESC)::int
  FROM public.profiles p
  WHERE p.role = 'student' AND p.status = 'active'
  ORDER BY p.points DESC
  LIMIT 20
$$;

CREATE OR REPLACE FUNCTION public.submit_excuse(p_batch_id UUID, p_session_id UUID, p_reason TEXT, p_file TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF length(trim(p_reason)) < 8 THEN RAISE EXCEPTION 'اكتب سببًا أوضح للعذر'; END IF;
  INSERT INTO public.excuses (student_id, batch_id, session_id, reason, file_path)
  VALUES (auth.uid(), p_batch_id, p_session_id, trim(p_reason), p_file)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.review_excuse(p_excuse_id UUID, p_status TEXT, p_note TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ex public.excuses%ROWTYPE;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'حالة غير صالحة'; END IF;
  SELECT * INTO ex FROM public.excuses WHERE id = p_excuse_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF NOT public.is_instructor(ex.batch_id) THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  UPDATE public.excuses SET status = p_status, reviewed_by = auth.uid(), review_note = p_note
   WHERE id = p_excuse_id;
  IF p_status = 'approved' AND ex.session_id IS NOT NULL THEN
    INSERT INTO public.attendance (session_id, student_id, status, recorded_by)
    VALUES (ex.session_id, ex.student_id, 'excused', auth.uid())
    ON CONFLICT (session_id, student_id) DO UPDATE SET status = 'excused';
    PERFORM public.refresh_enrollment_progress(ex.batch_id, ex.student_id);
  END IF;
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (ex.student_id,
          CASE WHEN p_status = 'approved' THEN 'تم قبول العذر' ELSE 'تم رفض العذر' END,
          COALESCE(p_note, ''), 'excuse');
END $$;

CREATE OR REPLACE FUNCTION public.submit_session_report(p_session_id UUID, p_summary TEXT, p_und INT, p_eng INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sess public.sessions%ROWTYPE;
BEGIN
  SELECT * INTO sess FROM public.sessions WHERE id = p_session_id;
  IF NOT public.is_instructor(sess.batch_id) THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  INSERT INTO public.session_reports (session_id, author_id, summary, understanding, engagement)
  VALUES (p_session_id, auth.uid(), COALESCE(p_summary, ''), p_und, p_eng)
  ON CONFLICT (session_id) DO UPDATE
    SET summary = EXCLUDED.summary, understanding = EXCLUDED.understanding,
        engagement = EXCLUDED.engagement, author_id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.submit_course_rating(p_course_id UUID, p_rating INT, p_comment TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION 'تقييم غير صالح'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.batches b ON b.id = e.batch_id
    WHERE e.student_id = auth.uid() AND b.course_id = p_course_id
  ) THEN RAISE EXCEPTION 'قيّم دورة التحقت بها فقط'; END IF;
  INSERT INTO public.course_ratings (course_id, student_id, rating, comment)
  VALUES (p_course_id, auth.uid(), p_rating, COALESCE(p_comment, ''))
  ON CONFLICT (course_id, student_id) DO UPDATE
    SET rating = EXCLUDED.rating, comment = EXCLUDED.comment;
END $$;

CREATE OR REPLACE FUNCTION public.broadcast_notice(p_scope TEXT, p_scope_id UUID, p_type TEXT, p_title TEXT, p_message TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT := 0;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  IF length(trim(p_title)) < 2 OR length(trim(p_message)) < 2 THEN
    RAISE EXCEPTION 'العنوان والنص مطلوبان';
  END IF;
  IF p_scope = 'batch' THEN
    IF NOT public.is_instructor(p_scope_id) THEN RAISE EXCEPTION 'غير مسموح لهذه المجموعة'; END IF;
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT e.student_id, p_title, p_message, COALESCE(p_type, 'announcement')
    FROM public.enrollments e WHERE e.batch_id = p_scope_id;
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF p_scope = 'branch' THEN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'بث الفرع للمشرف فقط'; END IF;
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT p.id, p_title, p_message, COALESCE(p_type, 'announcement')
    FROM public.profiles p WHERE p.branch_id = p_scope_id AND p.status = 'active';
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSIF p_scope = 'all' THEN
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'البث العام للمشرف فقط'; END IF;
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT p.id, p_title, p_message, COALESCE(p_type, 'announcement')
    FROM public.profiles p WHERE p.status = 'active';
    GET DIAGNOSTICS n = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'نطاق غير صالح';
  END IF;
  PERFORM public.write_audit('broadcast', p_scope, COALESCE(p_scope_id::text, 'all'),
    jsonb_build_object('count', n, 'type', p_type));
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.add_private_note(p_student_id UUID, p_body TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  IF length(trim(p_body)) < 2 THEN RAISE EXCEPTION 'الملاحظة فارغة'; END IF;
  INSERT INTO public.private_notes (student_id, author_id, body)
  VALUES (p_student_id, auth.uid(), trim(p_body)) RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.claim_social_badge()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  PERFORM public.award_badge(auth.uid(), 'social');
END $$;

CREATE OR REPLACE FUNCTION public.batch_roster(p_batch_id UUID)
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

-- ═══════════════════════════════════════════════════════════════════
--  GRANTS — column-scoped so role/points cannot be written by clients
-- ═══════════════════════════════════════════════════════════════════
GRANT USAGE ON SCHEMA public TO anon, authenticated;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

GRANT SELECT ON public.branches TO anon, authenticated;
GRANT SELECT ON public.courses TO authenticated;
GRANT SELECT ON public.batches TO authenticated;
GRANT SELECT ON public.enrollments TO authenticated;
GRANT SELECT ON public.waitlist TO authenticated;
GRANT SELECT ON public.sessions TO authenticated;
GRANT SELECT ON public.attendance TO authenticated;
GRANT SELECT ON public.points_rules TO authenticated;
GRANT SELECT ON public.points_ledger TO authenticated;
GRANT SELECT ON public.certs TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT SELECT ON public.student_badges TO authenticated;
GRANT SELECT ON public.excuses TO authenticated;
GRANT SELECT ON public.session_reports TO authenticated;
GRANT SELECT ON public.course_ratings TO authenticated;
GRANT SELECT ON public.private_notes TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, phone, branch_id, avatar_url, lang, dark_mode)
  ON public.profiles TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.batches TO authenticated;

GRANT EXECUTE ON FUNCTION public.verify_certificate(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mask_phone(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_batch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_session(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_check_in(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_session_attendance(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_certificates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_instructor(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_excuse(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_excuse(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_session_report(UUID, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_course_rating(UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_notice(TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_private_note(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_social_badge() TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_roster(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
--  RLS
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY branches_read ON public.branches FOR SELECT USING (true);

CREATE POLICY profiles_self_or_staff_select ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin()
    OR (
      public.current_role() = 'volunteer'
      AND EXISTS (
        SELECT 1 FROM public.enrollments e
        JOIN public.batches b ON b.id = e.batch_id
        WHERE e.student_id = profiles.id AND b.instructor_id = auth.uid()
      )
    )
  );

CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() AND status = 'active')
  WITH CHECK (id = auth.uid());

CREATE POLICY badges_own ON public.student_badges FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_staff());

CREATE POLICY courses_read ON public.courses FOR SELECT TO authenticated
  USING (is_active = true OR public.is_staff());
CREATE POLICY courses_admin_ins ON public.courses FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY courses_admin_upd ON public.courses FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY courses_admin_del ON public.courses FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY batches_read ON public.batches FOR SELECT TO authenticated
  USING (is_active = true OR public.is_staff());
CREATE POLICY batches_staff_ins ON public.batches FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() AND instructor_id = auth.uid());
CREATE POLICY batches_manage ON public.batches FOR UPDATE TO authenticated
  USING (public.is_instructor(id)) WITH CHECK (public.is_instructor(id));
CREATE POLICY batches_admin_del ON public.batches FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY enroll_read ON public.enrollments FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_staff());
CREATE POLICY wait_read ON public.waitlist FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_staff());

CREATE POLICY sessions_read ON public.sessions FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.batch_id = sessions.batch_id AND e.student_id = auth.uid())
  );

CREATE POLICY attendance_read ON public.attendance FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_staff());

CREATE POLICY rules_read ON public.points_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY ledger_read ON public.points_ledger FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_staff());

CREATE POLICY certs_read ON public.certs FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_staff());

CREATE POLICY notif_own ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY notif_own_upd ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY audit_admin ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY excuses_read ON public.excuses FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_staff());

CREATE POLICY reports_read ON public.session_reports FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY ratings_read ON public.course_ratings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY notes_staff ON public.private_notes FOR SELECT TO authenticated
  USING (public.is_staff());

-- ═══════════════════════════════════════════════════════════════════
--  STORAGE
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('excuses', 'excuses', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS avatars_read ON storage.objects;
DROP POLICY IF EXISTS avatars_write ON storage.objects;
DROP POLICY IF EXISTS avatars_update ON storage.objects;
DROP POLICY IF EXISTS excuses_read ON storage.objects;
DROP POLICY IF EXISTS excuses_write ON storage.objects;

CREATE POLICY avatars_read ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY avatars_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY excuses_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'excuses' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR public.is_staff()
  ));
CREATE POLICY excuses_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'excuses' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE UNIQUE INDEX IF NOT EXISTS enrollments_batch_student_uidx ON public.enrollments (batch_id, student_id);
CREATE UNIQUE INDEX IF NOT EXISTS certs_student_course_uidx ON public.certs (student_id, course_id);
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_batch_student_uidx ON public.waitlist (batch_id, student_id);
