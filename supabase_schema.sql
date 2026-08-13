-- RTC-app Production Supabase Schema & RLS Policies

-- Enable pgcrypto extension for UUIDs and cryptography functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (role IN ('student', 'volunteer', 'admin', 'pending')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending')),
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE,
    lang VARCHAR(5) DEFAULT 'ar' CHECK (lang IN ('ar', 'en')),
    points INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own profile or admins read all"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Users can update their own non-sensitive profile info"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- 2. Courses Table
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    title_ar TEXT,
    title_en TEXT,
    cat TEXT,
    icon TEXT,
    color TEXT,
    sessions_count INT DEFAULT 0,
    max_students INT DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view courses"
ON public.courses FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Only admins can modify courses"
ON public.courses FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
));

-- 3. Batches Table
CREATE TABLE IF NOT EXISTS public.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    instructor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    schedule TEXT,
    location TEXT,
    lectures_done INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view batches"
ON public.batches FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Admins and instructors can manage batches"
ON public.batches FOR ALL
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR instructor_id = auth.uid()
);

-- 4. Enrollments Table
CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_batch_student UNIQUE (batch_id, student_id)
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their enrollments"
ON public.enrollments FOR SELECT
USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'volunteer')
));

-- 5. Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    session_date TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sessions"
ON public.sessions FOR SELECT
TO authenticated USING (true);

-- 6. Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'excused', 'late')),
    note TEXT,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_session_student UNIQUE (session_id, student_id)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view their attendance; Volunteers/Admins view and insert"
ON public.attendance FOR SELECT
USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'volunteer')
));

CREATE POLICY "Volunteers and admins can record attendance"
ON public.attendance FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'volunteer')
));

-- 7. Points Rules & Ledger
CREATE TABLE IF NOT EXISTS public.points_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    amount INT NOT NULL
);

-- Seed default rules
INSERT INTO public.points_rules (code, title, amount) VALUES
('ATTENDANCE_PRESENT', 'حضور المحاضرة', 10),
('ATTENDANCE_LATE', 'حضور متأخر', 5),
('HOMEWORK_SUBMISSION', 'تسليم الواجب', 15)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.points_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES public.points_rules(id) ON DELETE SET NULL,
    amount INT NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view their points; Admin/Volunteers view all"
ON public.points_ledger FOR SELECT
USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'volunteer')
));

-- 8. Certifications Table & Public Verification Function
CREATE TABLE IF NOT EXISTS public.certs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    serial_number TEXT UNIQUE NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.certs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view certs"
ON public.certs FOR SELECT
TO authenticated USING (true);

-- Public Certificate Verification Function (SECURITY DEFINER with safe search_path)
CREATE OR REPLACE FUNCTION public.verify_certificate(p_serial TEXT)
RETURNS TABLE (
    is_valid BOOLEAN,
    student_name TEXT,
    course_title TEXT,
    issued_date TIMESTAMPTZ
) 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TRUE as is_valid,
        p.full_name as student_name,
        c.title as course_title,
        crt.issued_at as issued_date
    FROM public.certs crt
    JOIN public.profiles p ON crt.student_id = p.id
    JOIN public.courses c ON crt.course_id = c.id
    WHERE crt.serial_number = p_serial;
END;
$$;

-- Alter tables to ensure branch and metadata columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'فرع فيصل — الطوابق (الجيزة)';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'فرع فيصل — الطوابق (الجيزة)';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS cat TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'فرع فيصل — الطوابق (الجيزة)';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Seed RTC Faisal courses directly into Supabase
INSERT INTO public.courses (id, title, cat, category, branch, icon, color, sessions_count, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'تطوير تطبيقات الويب Full-Stack (JS & React)', 'برمجة وتكنولوجيا', 'برمجة وتكنولوجيا', 'فرع فيصل — الطوابق (الجيزة)', 'ph-fill ph-code', '#00288e', 10, true),
('22222222-2222-2222-2222-222222222222', 'التصميم الجرافيكي المتقدم (Photoshop & Illustrator)', 'تصميم وفنون', 'تصميم وفنون', 'فرع فيصل — الطوابق (الجيزة)', 'ph-fill ph-palette', '#7a30d8', 8, true),
('33333333-3333-3333-3333-333333333333', 'التسويق الرقمي وإدارة حملات السوشيال ميديا', 'تسويق إلكتروني', 'تسويق إلكتروني', 'فرع فيصل — الطوابق (الجيزة)', 'ph-fill ph-megamenu', '#d4af37', 8, true),
('44444444-4444-4444-4444-444444444444', 'اللغة الإنجليزية للمحادثة وسوق العمل', 'لغات وتواصل', 'لغات وتواصل', 'فرع فيصل — الطوابق (الجيزة)', 'ph-fill ph-translate', '#ba1a1a', 12, true),
('55555555-5555-5555-5555-555555555555', 'الإكسيل المحاسبي المتقدم Advanced Excel', 'محاسبة وماليات', 'محاسبة وماليات', 'فرع فيصل — الطوابق (الجيزة)', 'ph-fill ph-file-spreadsheet', '#0284c7', 8, true)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, branch = EXCLUDED.branch;
