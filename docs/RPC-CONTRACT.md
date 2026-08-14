# Masar RTC — وثيقة عقد واجهة وقاعدة البيانات (RPC Contract & Schema Baseline)

**الإصدار:** 1.0.0  
**التاريخ:** 14 أغسطس 2026  
**النطاق:** Web / PWA + Capacitor Android/iOS + Supabase Database & Storage  
**الحالة:** معتمد كمرجع أساسي موحد للعقد بين الواجهة وقاعدة البيانات لمنع انحراف المخطط (Schema Drift Prevention)

---

## 1. ملخص تنفيذي

تحدد هذه الوثيقة العقد الصارم بين واجهة مسار RTC (Client-side JS/PWA/Capacitor) وقاعدة بيانات Supabase (PostgreSQL + RLS + RPCs + Storage).  
جاء هذا العقد لإنهاء مشاكل انحراف المخطط (مثل أخطاء PostgREST `PGRST202` عند عدم تطابق توقيعات الدوال أو استدعاء دوال بدون معاملات تطابق الكاش مثل `get_leaderboard` و`batch_roster`).

### القواعد الذهبية للعقد:
1. **لا استدعاء RPC بدون توثيق واختبار:** كل استدعاء `client.rpc('name', args)` في الواجهة له دالة SQL مطابقة تماماً في أسماء المعاملات وترتيبها وأنواعها.
2. **SECURITY DEFINER + search_path:** كل دالة حساسة أو تفويضية تنفذ بصلاحيات منضبطة مع `SET search_path = public`، وتفحص هوية المستدعي `auth.uid()` وصلاحياته داخلياً.
3. **Least Privilege & Revoke by Default:** يتم سحب كافة الصلاحيات العامة `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon;` ومنح الصلاحية فقط لـ `authenticated`، باستثناء دالة التحقق من الشهادات `verify_certificate` المتاحة لـ `anon, authenticated`.
4. **حماية البيانات الشخصية (PII Protection):** القراءة المباشرة من جدول `profiles` مقيدة بالأعمدة غير الحساسة، وجلب الملف الكامل للمستخدم الحالي يمر عبر `get_my_profile()`، وجلب الإدارة يمر عبر `admin_list_profiles()`، وعرض الاسم في الشهادة العامة مقنّع عبر `mask_name()`.
5. **تحديث كاش PostgREST:** كل migration تتضمن في نهايتها أمر `NOTIFY pgrst, 'reload schema';`.

---

## 2. جدول فهرس دوال RPC الكامل (26 دالة)

| # | اسم الدالة | الاستدعاء في الكود | المعاملات | نوع الإرجاع | الأدوار المسموحة | الصلاحيات (Grants) | ملف الـ Migration |
|---|---|---|---|---|---|---|---|
| 1 | `get_my_profile` | `js/api.js:121` | لا توجد | `JSONB` | authenticated (مالك الحساب) | `authenticated` | `20260813190000_v100_platform.sql` |
| 2 | `ensure_my_profile` | `js/api.js:160` | `p_full_name TEXT`, `p_phone TEXT`, `p_branch UUID` | `JSONB` | authenticated (مالك الحساب) | `authenticated` | `20260813190000_v100_platform.sql` |
| 3 | `batch_roster` | `js/api.js:255` | `p_batch_id UUID` | `TABLE (...)` | instructor (مالك الدفعة) / admin | `authenticated` | `20260813120000_production_v9.sql` |
| 4 | `admin_list_profiles` | `js/api.js:276` | لا توجد | `TABLE (...)` | admin فقط | `authenticated` | `20260813190000_v100_platform.sql` |
| 5 | `batch_seat_counts` | `js/api.js:378` | `p_batch_ids UUID[]` | `TABLE (...)` | authenticated | `authenticated` | `20260813190000_v100_platform.sql` |
| 6 | `update_branch_directory` | `js/api.js:487` | `p_branch_id UUID`, `p_payload JSONB` | `JSONB` | admin فقط | `authenticated` | `20260813190000_v100_platform.sql` |
| 7 | `join_batch` | `js/api.js:506` | `p_batch_id UUID` | `JSONB` | authenticated (student) | `authenticated` | `20260813120000_production_v9.sql` |
| 8 | `start_session` | `js/api.js:507` | `p_batch_id UUID`, `p_title TEXT` | `JSONB` | instructor (مالك الدفعة) / admin | `authenticated` | `20260813120000_production_v9.sql` |
| 9 | `student_check_in` | `js/api.js:508` | `p_code TEXT` | `JSONB` | authenticated (student مسجل) | `authenticated` | `20260813120000_production_v9.sql` |
| 10 | `record_session_attendance` | `js/api.js:509` | `p_session_id UUID`, `p_records JSONB` | `JSONB` | instructor (مالك الجلسة) / admin | `authenticated` | `20260813120000_production_v9.sql` |
| 11 | `close_session` | `js/api.js:510` | `p_session_id UUID` | `JSONB` | instructor (مالك الجلسة) / admin | `authenticated` | `20260813120000_production_v9.sql` |
| 12 | `issue_certificates` | `js/api.js:511` | `p_batch_id UUID` | `JSONB` | instructor (مالك الدفعة) / admin | `authenticated` | `20260813190000_v100_platform.sql` |
| 13 | `change_user_role` | `js/api.js:512` | `p_user_id UUID`, `p_role TEXT` | `JSONB` | admin فقط | `authenticated` | `20260813120000_production_v9.sql` |
| 14 | `set_user_status` | `js/api.js:513` | `p_user_id UUID`, `p_status TEXT` | `JSONB` | admin فقط | `authenticated` | `20260813120000_production_v9.sql` |
| 15 | `assign_instructor` | `js/api.js:514` | `p_batch_id UUID`, `p_instructor_id UUID` | `JSONB` | admin فقط | `authenticated` | `20260813120000_production_v9.sql` |
| 16 | `verify_certificate` | `js/api.js:515`, `js/verify.js:35` | `p_serial TEXT` | `TABLE (...)` | عام / للجميع | `anon`, `authenticated` | `20260813190000_v100_platform.sql` |
| 17 | `get_leaderboard` | `js/api.js:516` | لا توجد | `TABLE (...)` | authenticated | `authenticated` | `20260814100000_repair_leaderboard_and_rtc_link.sql` |
| 18 | `submit_excuse` | `js/api.js:517` | `p_batch_id UUID`, `p_session_id UUID`, `p_reason TEXT`, `p_file TEXT` | `UUID` | authenticated (طالب مسجل في الدفعة) | `authenticated` | `20260813190000_v100_platform.sql` |
| 19 | `review_excuse` | `js/api.js:518` | `p_excuse_id UUID`, `p_status TEXT`, `p_note TEXT` | `VOID` | instructor (مالك الدفعة) / admin | `authenticated` | `20260813190000_v100_platform.sql` |
| 20 | `submit_session_report` | `js/api.js:519` | `p_session_id UUID`, `p_summary TEXT`, `p_und INT`, `p_eng INT` | `UUID` | instructor (مالك الجلسة) / admin | `authenticated` | `20260813190000_v100_platform.sql` |
| 21 | `submit_course_rating` | `js/api.js:520` | `p_course_id UUID`, `p_rating INT`, `p_comment TEXT` | `VOID` | authenticated (طالب مسجل في كورس) | `authenticated` | `20260813190000_v100_platform.sql` |
| 22 | `broadcast_notice` | `js/api.js:522` | `p_scope TEXT`, `p_scope_id UUID`, `p_type TEXT`, `p_title TEXT`, `p_message TEXT` | `JSONB` | instructor (لدفعته) / admin (عام/فرع/دفعة) | `authenticated` | `20260813190000_v100_platform.sql` |
| 23 | `add_private_note` | `js/api.js:524` | `p_student_id UUID`, `p_body TEXT` | `UUID` | instructor للطالب المسجل عنده / admin | `authenticated` | `20260813190000_v100_platform.sql` |
| 24 | `claim_social_badge` | `js/api.js:525` | لا توجد | `JSONB` | authenticated | `authenticated` | `20260813120000_production_v9.sql` |
| 25 | `disable_my_push_devices` | `js/api.js:526` | لا توجد | `VOID` | authenticated | `authenticated` | `20260813190000_v100_platform.sql` |
| 26 | `register_push_device` | `js/api.js:528` | `p_token TEXT`, `p_platform TEXT`, `p_version TEXT` | `JSONB` | authenticated | `authenticated` | `20260813190000_v100_platform.sql` |

---

## 3. المواصفات التفصيلية لكل دالة RPC (العقد والتحقق واختبارات الرفض)

### 1. `get_my_profile()`
- **Call-site:** `js/api.js` (داخل `fetchMyProfile`)
- **Parameters:** بلا معاملات.
- **Return:** `JSONB` يحتوي على بيانات الحساب الشخصي للمستدعي (`id, full_name, role, status, email, phone, branch_id, avatar_url, points, streak, lang, dark_mode, badge_ids, branches`).
- **Authorization:** `SECURITY DEFINER SET search_path = public`. تفحص `auth.uid()`.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** مستخدم مسجل دخول يستدعي الدالة فيحصل على ملفه الشخصي فقط.
- **Negative Test:** مستخدم غير مسجل (`anon`) يستدعي الدالة فيفشل بـ `auth required` أو منع الصلاحية.

### 2. `ensure_my_profile(p_full_name TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL, p_branch UUID DEFAULT NULL)`
- **Call-site:** `js/api.js` (داخل `updateMyProfile` كإصلاح ذاتي للصفوف المفقودة).
- **Parameters:**
  - `p_full_name TEXT` (افتراضي `NULL`)
  - `p_phone TEXT` (افتراضي `NULL`)
  - `p_branch UUID` (افتراضي `NULL`)
- **Return:** `JSONB` بالملف المحدّث أو المنشأ.
- **Authorization:** `SECURITY DEFINER SET search_path = public`. تعمل فقط لـ `auth.uid()`.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** حساب بدون صف في profiles يستدعي الدالة فيتم إنشاء الصف وربطه برقم الهاتف والفرع.
- **Negative Test:** استدعاء بدون جلسة يفشل فوراً.

### 3. `batch_roster(p_batch_id UUID)`
- **Call-site:** `js/api.js` (داخل `fetchBatchStudents`).
- **ملاحظة Schema Drift سابقة:** كان هناك استدعاء خاطئ باسم `patch_roster` في نسخ أولية؛ العقد الصحيح المعتمد هو `batch_roster(p_batch_id UUID)`.
- **Parameters:** `p_batch_id UUID` (مطلوب).
- **Return:** `TABLE (enrollment_id UUID, student_id UUID, full_name TEXT, avatar_url TEXT, phone TEXT, points INT, streak INT, attendance_pct INT, sessions_done INT)`.
- **Authorization:** `is_admin() OR is_instructor(p_batch_id)`.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** مدرب الدفعة يطلب القائمة فيحصل على قائمة الطلاب المسجلين بالدفعة.
- **Negative Test:** طالب أو مدرب لا يملك الدفعة يحصل على خطأ `unauthorized`.

### 4. `admin_list_profiles()`
- **Call-site:** `js/api.js` (داخل `fetchAllProfiles`).
- **Parameters:** بلا معاملات.
- **Return:** `TABLE (id UUID, full_name TEXT, role VARCHAR, status VARCHAR, email VARCHAR, phone TEXT, points INT, branch_id UUID, avatar_url TEXT, created_at TIMESTAMPTZ, branch_name TEXT)`.
- **Authorization:** `is_admin()`.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** المشرف (Admin) يحصل على قائمة كافة الحسابات.
- **Negative Test:** طالب أو متطوع يستدعي الدالة يرفض فوراً بـ `unauthorized`.

### 5. `batch_seat_counts(p_batch_ids UUID[])`
- **Call-site:** `js/api.js` (داخل `seatCounts`).
- **Parameters:** `p_batch_ids UUID[]` (مصفوفة معرّفات الدفعات).
- **Return:** `TABLE (batch_id UUID, enrolled INT, capacity INT, seats_left INT)`.
- **Authorization:** متاحة لجميع المستخدمين المسجلين لمعرفة المقاعد الشاغرة دون كشف أي PII.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** تمرير مصفوفة دفعات يعيد عدد المسجلين والسعة والمقاعد المتبقية بدقة.
- **Negative Test:** مستخدم غير مسجل (`anon`) يُمنع من التنفيذ.

### 6. `update_branch_directory(p_branch_id UUID, p_payload JSONB)`
- **Call-site:** `js/api.js` (داخل `updateBranch`).
- **Parameters:** `p_branch_id UUID`, `p_payload JSONB`.
- **Return:** `JSONB`.
- **Authorization:** `is_admin()`. تفحص صحة روابط `facebook_url` و`whatsapp` وتفرض `https://`. تسجل العملية في `audit_log`.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** المشرف يعدل بيانات الفرع بنجاح مع تسجيل في الـ audit log.
- **Negative Test:** متطوع أو طالب يحصل على `unauthorized`؛ روابط غير آمنة `http://` ترفض.

### 7. `join_batch(p_batch_id UUID)`
- **Call-site:** `js/api.js:506`.
- **Parameters:** `p_batch_id UUID`.
- **Return:** `JSONB` (`{ success: true, status: 'enrolled' | 'waitlist' }`).
- **Authorization:** `auth.uid() IS NOT NULL`. تفحص السعة، تمنع التسجيل المزدوج، وتضيف قائمة انتظار إن اكتملت المقاعد.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** طالب ينضم لدفعة بها مقاعد شاغرة فيصبح مسجلاً، أو ينضم لدفعة مكتملة فيدخل في الـ waitlist.
- **Negative Test:** مستخدم موقوف (`suspended`) أو غير مسجل يفشل.

### 8. `start_session(p_batch_id UUID, p_title TEXT DEFAULT NULL)`
- **Call-site:** `js/api.js:507`.
- **Parameters:** `p_batch_id UUID`, `p_title TEXT DEFAULT NULL`.
- **Return:** `JSONB` يحتوي على بيانات الجلسة المنشأة ورمز الحضور `checkin_code`.
- **Authorization:** `is_admin() OR is_instructor(p_batch_id)`.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** مدرب الدفعة يفتح الجلسة فيتولد رمز حضور فريد ويسجل وقت البدء.
- **Negative Test:** طالب يستدعي فتح الجلسة يرفض فوراً بـ `unauthorized`.

### 9. `student_check_in(p_code TEXT)`
- **Call-site:** `js/api.js:508`.
- **Parameters:** `p_code TEXT`.
- **Return:** `JSONB` (`{ success: true, message: '...' }`).
- **Authorization:** الطالب المسجل في الدفعة التابعة للجلسة النشطة ذات الرمز `p_code`.
- **Anti-Fraud:** يمنع تسجيل الحضور بعد انتهاء الجلسة أو إغلاقها، ويمنع التكرار (Idempotent). يمنح الطالب نقاط الحضور ويحدث الـ streak.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** طالب مسجل يمرر رمز الجلسة فيسجل حضوره ويحصل على النقاط.
- **Negative Test:** طالب غير مسجل بالدفعة، أو رمز جلسة منتهية الصلاحية يرفض.

### 10. `record_session_attendance(p_session_id UUID, p_records JSONB)`
- **Call-site:** `js/api.js:509`.
- **Parameters:** `p_session_id UUID`, `p_records JSONB` (مصفوفة `{ student_id, status, notes }`).
- **Return:** `JSONB` (`{ success: true, count: N }`).
- **Authorization:** `is_admin() OR is_instructor(v_batch_id)`.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** مدرب الجلسة يرسل كشف الحضور كاملاً فيتم حفظه وتحديث إحصائيات الطلاب.
- **Negative Test:** طالب أو مدرب آخر يرفض بـ `unauthorized`.

### 11. `close_session(p_session_id UUID)`
- **Call-site:** `js/api.js:510`.
- **Parameters:** `p_session_id UUID`.
- **Return:** `JSONB`.
- **Authorization:** `is_admin() OR is_instructor(v_batch_id)`.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** المدرب يغلق الجلسة فيتوقف قبول الرموز وتحدث `sessions_done`.
- **Negative Test:** غير المالك يرفض بـ `unauthorized`.

### 12. `issue_certificates(p_batch_id UUID)`
- **Call-site:** `js/api.js:511`.
- **Parameters:** `p_batch_id UUID`.
- **Return:** `JSONB` (`{ success: true, issued: N }`).
- **Authorization:** `is_admin() OR is_instructor(p_batch_id)`.
- **Implementation:** توليد أرقام تسلسلية عشوائية صعبة التخمين بنمط UUID، ومنح شارة التخرج للطلاب المؤهلين بنسبة حضور ≥ 75%.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** مدرب يطلب إصدار الشهادات عند نهاية الدفعة فتصدر للطلاب المستحقين فقط.
- **Negative Test:** طالب يستدعي إصدار الشهادات يرفض.

### 13. `change_user_role(p_user_id UUID, p_role TEXT)`
- **Call-site:** `js/api.js:512`.
- **Parameters:** `p_user_id UUID`, `p_role TEXT`.
- **Return:** `JSONB`.
- **Authorization:** `is_admin()`. تحمي حساب المؤسس (Founder Protection) من التعديل أو سحب الصلاحيات.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** المشرف يرقي طالباً إلى متطوع.
- **Negative Test:** محاولة ترقية أو خفض دور مستخدم من غير المشرف ترفض فوراً.

### 14. `set_user_status(p_user_id UUID, p_status TEXT)`
- **Call-site:** `js/api.js:513`.
- **Parameters:** `p_user_id UUID`, `p_status TEXT`.
- **Return:** `JSONB`.
- **Authorization:** `is_admin()`.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** المشرف يعطل أو ينشط حساب مستخدم.
- **Negative Test:** متطوع أو طالب يحصل على `unauthorized`.

### 15. `assign_instructor(p_batch_id UUID, p_instructor_id UUID)`
- **Call-site:** `js/api.js:514`.
- **Parameters:** `p_batch_id UUID`, `p_instructor_id UUID`.
- **Return:** `JSONB`.
- **Authorization:** `is_admin()`.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** المشرف يعين متطوعاً كمدرب لدفعة.
- **Negative Test:** مستخدم عادي يرفض.

### 16. `verify_certificate(p_serial TEXT)`
- **Call-site:** `js/verify.js:35`, `js/api.js:515`.
- **Parameters:** `p_serial TEXT` (الرقم التسلسلي للشهادة).
- **Return:** `TABLE (is_valid BOOLEAN, student_name TEXT, course_title TEXT, issued_date DATE, serial TEXT)`.
- **Privacy Enforcement:** اسم الطالب مقنّع عبر `mask_name()` (مثل `أحمد م*** ع***`) لحماية الخصوصية ومنع كشف الأسماء الكاملة أو أرقام الهواتف أو الإيميلات في الاستعلام العام.
- **Grants:** `GRANT EXECUTE TO anon, authenticated;`
- **Positive Test:** استعلام برقم شهادة صحيح يعيد بيانات الدورة وتاريخ الإصدار والاسم المقنع.
- **Negative Test:** استعلام برقم وهمي يعيد `is_valid = false` دون أي أخطاء SQL أو كشف بيانات.

### 17. `get_leaderboard()`
- **Call-site:** `js/api.js:516`.
- **ملاحظة:** تم إصلاحها لتعمل بدون معاملات عبر `DROP FUNCTION IF EXISTS public.get_leaderboard(); CREATE FUNCTION public.get_leaderboard() RETURNS TABLE (...)`.
- **Parameters:** لا توجد.
- **Return:** `TABLE (id UUID, full_name TEXT, points INT, avatar_url TEXT, rank INT)`.
- **Authorization:** للمستخدمين المسجلين فقط، وتعيد الطلاب النشطين فقط مرتبين تنازلياً حسب النقاط.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** مستخدم مسجل يطلب المتصدرين فيحصل على أعلى 20 طالباً.
- **Negative Test:** مستخدم غير مسجل (`anon`) يمنع من التنفيذ.

### 18. `submit_excuse(p_batch_id UUID, p_session_id UUID DEFAULT NULL, p_reason TEXT, p_file TEXT DEFAULT NULL)`
- **Call-site:** `js/api.js:517`.
- **Parameters:** `p_batch_id UUID`, `p_session_id UUID`, `p_reason TEXT`, `p_file TEXT`.
- **Return:** `UUID` (معرف طلب العذر المنشأ).
- **Authorization:** الطالب المسجل في الدفعة، مع فحص طول السبب (8 إلى 1500 حرف)، ومطابقة مسار الملف لمجلد المستخدم `auth.uid()/[0-9]+\.(pdf|jpg|png|webp)`.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** طالب مسجل يرفع عذراً مع ملف مرفق بمجلده فيتم قبول العذر.
- **Negative Test:** طالب غير مسجل بالدفعة، أو تمرير مسار ملف يتبع مستخدماً آخر يفشل بـ `مسار الملف غير صالح`.

### 19. `review_excuse(p_excuse_id UUID, p_status TEXT, p_note TEXT DEFAULT '')`
- **Call-site:** `js/api.js:518`.
- **Parameters:** `p_excuse_id UUID`, `p_status TEXT`, `p_note TEXT`.
- **Return:** `VOID`.
- **Authorization:** `is_admin() OR is_instructor(batch_id)`.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** مدرب الدفعة يقبل أو يرفض العذر مع إضافة ملاحظة.
- **Negative Test:** طالب يحاول مراجعة عذره أو عذر زميله يرفض بـ `unauthorized`.

### 20. `submit_session_report(p_session_id UUID, p_summary TEXT, p_und INT, p_eng INT)`
- **Call-site:** `js/api.js:519`.
- **Parameters:** `p_session_id UUID`, `p_summary TEXT`, `p_und INT`, `p_eng INT`.
- **Return:** `UUID`.
- **Authorization:** `is_admin() OR is_instructor(batch_id)`. تفرض قيود الدرجات بين 1 و 5.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** مدرب يقدم تقرير المحاضرة بدرجات ملائمة فيتم حفظه في `session_reports`.
- **Negative Test:** قيم درجات خارج النطاق 1..5 ترفض بـ validation error.

### 21. `submit_course_rating(p_course_id UUID, p_rating INT, p_comment TEXT DEFAULT '')`
- **Call-site:** `js/api.js:520`.
- **Parameters:** `p_course_id UUID`, `p_rating INT`, `p_comment TEXT`.
- **Return:** `VOID`.
- **Authorization:** الطالب المسجل في دفعة من هذا الكورس. التقييم بين 1 و 5.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** طالب مسجل يقيّم الدورة بنجاح.
- **Negative Test:** طالب لم ينضم لأي دفعة من الدورة يرفض بـ `لست مسجلًا في هذا الكورس`.

### 22. `broadcast_notice(p_scope TEXT, p_scope_id UUID DEFAULT NULL, p_type TEXT, p_title TEXT, p_message TEXT)`
- **Call-site:** `js/api.js:522`.
- **Parameters:** `p_scope TEXT`, `p_scope_id UUID`, `p_type TEXT`, `p_title TEXT`, `p_message TEXT`.
- **Return:** `JSONB` (`{ success: true, count: N }`).
- **Authorization:** المدرب يمكنه الإرسال فقط لـ `batch` يملكه؛ المشرف يمكنه الإرسال لـ `all` أو `branch` أو `batch`. تفحص نطاق نص الرسالة وتمنع التنبيهات الفارغة.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** مدرب يرسل تنبيهاً لدفعته فيصل إشعار لكل الطلاب المسجلين.
- **Negative Test:** مدرب يحاول الإرسال لدفعة لا يملكها أو إرسال تنبيه عام `all` يرفض بـ `unauthorized`.

### 23. `add_private_note(p_student_id UUID, p_body TEXT)`
- **Call-site:** `js/api.js:524`.
- **Parameters:** `p_student_id UUID`, `p_body TEXT`.
- **Return:** `UUID`.
- **Authorization:** `is_admin() OR is_instructor_for_student(p_student_id)`.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** مدرب يضيف ملاحظة خاصة لطالب مسجل في إحدى مجموعاته.
- **Negative Test:** مدرب يضيف ملاحظة لطالب لا يدرسه يرفض بـ `unauthorized`.

### 24. `claim_social_badge()`
- **Call-site:** `js/api.js:525`.
- **Parameters:** لا توجد.
- **Return:** `JSONB`.
- **Authorization:** `auth.uid() IS NOT NULL`. تمنح شارة `social` ونقاط المشاركة لمرة واحدة فقط للمستخدم الحالي.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** مستخدم يشارك التطبيق ويستدعي الدالة فيحصل على الشارة ونقاطها.
- **Negative Test:** تكرار الاستدعاء لا يضاعف الشارة أو النقاط.

### 25. `disable_my_push_devices()`
- **Call-site:** `js/api.js:526`.
- **Parameters:** لا توجد.
- **Return:** `VOID`.
- **Authorization:** `auth.uid() IS NOT NULL`. تعطل كافة أجهزة الإشعارات المسجلة لحساب المستدعي عند تسجيل الخروج (Sign Out).
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** مستخدم يسجل خروج فتصبح جميع توكنات أجهزته `is_active = false`.
- **Negative Test:** مستخدم غير مسجل لا يستطيع تعديل أي جهاز.

### 26. `register_push_device(p_token TEXT, p_platform TEXT, p_version TEXT DEFAULT NULL)`
- **Call-site:** `js/api.js:528`.
- **Parameters:** `p_token TEXT`, `p_platform TEXT`, `p_version TEXT`.
- **Return:** `JSONB`.
- **Authorization:** `auth.uid() IS NOT NULL`. المنصة محصورة في `android` أو `ios` أو `web`.
- **Grants:** `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
- **Positive Test:** تسجيل رمز FCM/APNs للجهاز الحالي مرتبطاً بـ `auth.uid()`.
- **Negative Test:** محاولة تمرير منصة غير مدعومة ترفض بـ validation error.

---

## 4. فهرس الوصول المباشر للجداول (REST Table Access)

| الجدول | العمليات المسموحة في الكود | الأعمدة المقيدة | سياسة RLS والتفويض |
|---|---|---|---|
| `profiles` | SELECT (محدود للأعمدة العامة), UPDATE (بيانات الحساب فقط) | لا يسمح بقراءة الهاتف أو الإيميل عبر SELECT العام؛ التعديل محصور في `full_name, phone, branch_id, avatar_url, lang, dark_mode` | المالك فقط يعدل حسابه؛ القراءة العامة محصورة عبر `get_my_profile` و`admin_list_profiles` |
| `branches` | SELECT (عام للنشط), UPDATE (عبر RPC) | قراءة الكل للنشط | المشرف فقط يعدل عبر `update_branch_directory` |
| `courses` | SELECT, INSERT, UPDATE | قراءة للنشط | المشرف والمدرب حسب الصلاحيات |
| `batches` | SELECT, INSERT, UPDATE | قراءة للنشط | المشرف والمدرب المالك |
| `enrollments` | SELECT, INSERT | قراءة اشتراكاتي للطالب، واشتراكات الدفعة للمدرب والمشرف | الطالب يرى اشتراكاته فقط؛ التسجيل عبر `join_batch` |
| `notifications` | SELECT, UPDATE (read_at) | المالك فقط | `user_id = auth.uid()` |
| `certs` | SELECT | قراءة شهاداتي للطالب، والكافة للمشرف | إصدار الشهادات محصور في دالة `issue_certificates` |
| `points_ledger` | SELECT | قراءة سجل نقاطي للطالب | الكتابة محصورة بالسيرفر عبر RPCs والقواعد |
| `course_ratings` | SELECT | قراءة تقييمات الكورس للجميع | الإضافة محصورة عبر `submit_course_rating` |
| `excuses` | SELECT | قراءة أعذاري للطالب، وأعذار الدفعة للمدرب والمشرف | الإضافة عبر `submit_excuse` والمراجعة عبر `review_excuse` |
| `attendance` | SELECT | قراءة إحصائيات الحضور | الكتابة محصورة عبر `student_check_in` و`record_session_attendance` |
| `student_badges` | SELECT | قراءة شاراتي للمستخدم | الإسناد محصور بدوال السيرفر |
| `volunteer_committees` | SELECT, UPDATE | قراءة اللجان والمسارات للجميع | التعديل محصور بالإدارة |

---

## 5. فهرس مساحات التخزين (Storage Buckets)

| الـ Bucket | الحالة العامة | الحد الأقصى للحجم | صيغ الملفات المسموحة (MIME Types) | مسار الرفع المعتمد | سياسة التحقق |
|---|---|---|---|---|---|
| `avatars` | Public (قراءة عامة) | 8 ميجابايت (يضغط إلى 256px WebP) | `image/webp`, `image/jpeg`, `image/png` | `${user_id}/avatar.webp` | المالك فقط يرفع في مجلده الخاص |
| `excuses` | Private (خاص للمدرب والمشرف والطالب) | 4 ميجابايت | `application/pdf`, `image/jpeg`, `image/png`, `image/webp` | `${user_id}/${timestamp}.${ext}` | المالك فقط يرفع في مجلده، ويفحص المسار برمجياً داخل `submit_excuse` |

---

## 6. تسلسل وتاريخ الـ Migrations

1. `20260811072913_initial_schema.sql`: هيكل البداية الأولي (تم استبداله بالكامل بالمخطط الإنتاجي).
2. `20260813120000_production_v9.sql`: المخطط الشامل v9 متضمناً الجداول الأساسية، RLS، القيود الفريدة، triggers النقاط والشارات، ودوال الحضور والشهادات.
3. `20260813190000_v100_platform.sql`: ترقية منصة v100: عزل قراءة الـ PII، دوال `get_my_profile` و`admin_list_profiles`، تقنين استعلام السعة `batch_seat_counts`، تقنيع الأسماء في التحقق من الشهادات `mask_name`، دعم الأجهزة والإشعارات `push_devices`، وضبط أذونات التخزين.
4. `20260814100000_repair_leaderboard_and_rtc_link.sql`: إصلاح دالة `get_leaderboard()` لتطابق استدعاء PostgREST بدون معاملات، وربط الرابط الرسمي لـ RTC.
5. `20260814140000_reconcile_rpc_contract.sql`: تسوية شاملة لكافة دوال العقد الـ 26، إسقاط التوقيعات القديمة غير المتطابقة، فرض `SECURITY DEFINER SET search_path = public`، سحب الصلاحيات من `PUBLIC, anon` وتثبيتها لـ `authenticated` (مع استثناء `verify_certificate` للعام)، وإطلاق `NOTIFY pgrst, 'reload schema'`.

---

## 7. فحص العقد الآلي في CI

تم دمج أداة الفحص الآلي `scripts/check-rpc-contract.js` في خط فحص الأكواد:
```bash
npm run contract:check
```
وتعمل ضمن `npm test` للتأكد من:
- مطابقة كل استدعاء `client.rpc(...)` في الواجهة لقائمة العقد.
- مطابقة أسماء المعاملات المرسلة لمعاملات SQL.
- عدم وجود أي دالة جديدة بدون توثيق واختبار.
