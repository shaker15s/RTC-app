# عقد الـ RPC — مسار RTC

> ملف مُولَّد آليًا بواسطة `npm run rpc:report`. لا تحرّره يدويًا.
>
> آخر توليد من: 5 migration + كود الواجهة (`app.js`, `js/`).

يقارن هذا التقرير ما يستدعيه التطبيق فعليًا بما تنشئه الـ migrations.
أي صف غير ✅ يعني أن المستخدم سيرى خطأ من نوع:
`Could not find the function public.X(...) in the schema cache`.

## الملخص

| المقياس | العدد |
| --- | --- |
| دوال يستدعيها التطبيق | 26 |
| مطابقة تمامًا | 26 |
| بها مشكلة | 0 |
| دوال معرّفة في الـ migrations | 42 |
| جداول | 20 |
| سياسات RLS | 54 |

## الدوال المطلوبة من التطبيق

| الدالة | المعاملات المُرسَلة من الواجهة | التوقيع في الـ migrations | موجودة؟ | الصلاحيات | مكان الاستدعاء |
| --- | --- | --- | --- | --- | --- |
| `add_private_note` | `p_body`, `p_student_id` | `add_private_note(p_student_id uuid, p_body text)`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | authenticated | `js/api.js:524` |
| `admin_list_profiles` | — | `admin_list_profiles()`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | authenticated | `js/api.js:276` |
| `assign_instructor` | `p_batch_id`, `p_instructor_id` | `assign_instructor(p_batch_id uuid, p_instructor_id uuid)`<br><sub>20260813120000_production_v9.sql</sub> | ✅ موجودة | authenticated | `js/api.js:514` |
| `batch_roster` | `p_batch_id` | `batch_roster(p_batch_id uuid)`<br><sub>20260813120000_production_v9.sql</sub> | ✅ موجودة | authenticated | `js/api.js:255` |
| `batch_seat_counts` | `p_batch_ids` | `batch_seat_counts(p_batch_ids uuid[])`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | authenticated | `js/api.js:378` |
| `broadcast_notice` | `p_message`, `p_scope`, `p_scope_id`, `p_title`, `p_type` | `broadcast_notice(p_scope text, p_scope_id uuid, p_type text, p_title text, p_message text)`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | authenticated | `js/api.js:522` |
| `change_user_role` | `p_role`, `p_user_id` | `change_user_role(p_user_id uuid, p_role text)`<br><sub>20260813120000_production_v9.sql</sub> | ✅ موجودة | authenticated | `js/api.js:512` |
| `claim_social_badge` | — | `claim_social_badge()`<br><sub>20260813120000_production_v9.sql</sub> | ✅ موجودة | authenticated | `js/api.js:525` |
| `close_session` | `p_session_id` | `close_session(p_session_id uuid)`<br><sub>20260813120000_production_v9.sql</sub> | ✅ موجودة | authenticated | `js/api.js:510` |
| `disable_my_push_devices` | — | `disable_my_push_devices()`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | authenticated | `js/api.js:526` |
| `ensure_my_profile` | `p_branch`, `p_full_name`, `p_phone` | `ensure_my_profile(p_full_name text DEFAULT, p_phone text DEFAULT, p_branch uuid DEFAULT)`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | authenticated | `js/api.js:160` |
| `get_leaderboard` | — | `get_leaderboard()`<br><sub>20260814100000_repair_leaderboard_and_rtc_link.sql</sub> | ✅ موجودة | authenticated | `js/api.js:516` |
| `get_my_profile` | — | `get_my_profile()`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | authenticated | `js/api.js:121` |
| `issue_certificates` | `p_batch_id` | `issue_certificates(p_batch_id uuid)`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | authenticated | `js/api.js:511` |
| `join_batch` | `p_batch_id` | `join_batch(p_batch_id uuid)`<br><sub>20260813120000_production_v9.sql</sub> | ✅ موجودة | authenticated | `js/api.js:506` |
| `record_session_attendance` | `p_records`, `p_session_id` | `record_session_attendance(p_session_id uuid, p_records jsonb)`<br><sub>20260813120000_production_v9.sql</sub> | ✅ موجودة | authenticated | `js/api.js:509` |
| `register_push_device` | `p_platform`, `p_token`, `p_version` | `register_push_device(p_token text, p_platform text, p_version text DEFAULT)`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | authenticated | `js/api.js:528` |
| `review_excuse` | `p_excuse_id`, `p_note`, `p_status` | `review_excuse(p_excuse_id uuid, p_status text, p_note text)`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | authenticated | `js/api.js:518` |
| `set_user_status` | `p_status`, `p_user_id` | `set_user_status(p_user_id uuid, p_status text)`<br><sub>20260813120000_production_v9.sql</sub> | ✅ موجودة | authenticated | `js/api.js:513` |
| `start_session` | `p_batch_id`, `p_title` | `start_session(p_batch_id uuid, p_title text DEFAULT)`<br><sub>20260813120000_production_v9.sql</sub> | ✅ موجودة | authenticated | `js/api.js:507` |
| `student_check_in` | `p_code` | `student_check_in(p_code text)`<br><sub>20260813120000_production_v9.sql</sub> | ✅ موجودة | authenticated | `js/api.js:508` |
| `submit_course_rating` | `p_comment`, `p_course_id`, `p_rating` | `submit_course_rating(p_course_id uuid, p_rating int4, p_comment text)`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | authenticated | `js/api.js:520` |
| `submit_excuse` | `p_batch_id`, `p_file`, `p_reason`, `p_session_id` | `submit_excuse(p_batch_id uuid, p_session_id uuid, p_reason text, p_file text)`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | authenticated | `js/api.js:517` |
| `submit_session_report` | `p_eng`, `p_session_id`, `p_summary`, `p_und` | `submit_session_report(p_session_id uuid, p_summary text, p_und int4, p_eng int4)`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | authenticated | `js/api.js:519` |
| `update_branch_directory` | `p_branch_id`, `p_payload` | `update_branch_directory(p_branch_id uuid, p_payload jsonb)`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | authenticated | `js/api.js:487` |
| `verify_certificate` | `p_serial` | `verify_certificate(p_serial text)`<br><sub>20260813190000_v100_platform.sql</sub> | ✅ موجودة | anon, authenticated | `js/api.js:515`<br>`js/verify.js:35` |

## المشاكل المرصودة

لا توجد مشاكل: كل دالة يستدعيها التطبيق موجودة بتوقيع مطابق وصلاحية صحيحة.

## الصلاحيات وRLS المطلوبة

| الدور | ما يُسمح له |
| --- | --- |
| `anon` | `verify_certificate` + قراءة `branches` العامة |
| `authenticated` | 26 دالة RPC + قراءة محكومة بـ RLS |
| `PUBLIC` | لا شيء — مسحوبة صراحةً في migration الحارس |

### ملاحظة مهمة عن PUBLIC

`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated`
**لا** يزيل صلاحية `EXECUTE` الممنوحة تلقائيًا لـ `PUBLIC` عند إنشاء أي دالة،
وكل دور يرث `PUBLIC`. لذلك يجب السحب من `PUBLIC` صراحةً لكل دالة،
وهو ما تفعله `20260814120000_rpc_contract_guard.sql`.

### دوال تُستدعى داخل سياسات RLS

`is_admin` و`is_staff` و`is_instructor` و`is_instructor_for_student` و`current_role`
تُستدعى داخل تعبيرات RLS. تعبيرات RLS **تتحقق** من صلاحية `EXECUTE` للدور المنفِّذ
(بعكس دوال الـ trigger التي لا تُعاد فيها التحقق). لذا تُسحب من `PUBLIC`/`anon`
ثم تُمنح لـ `authenticated` فقط، وإلا فشلت كل قراءة بـ
`permission denied for function is_instructor`.

## الجداول وRLS

| الجدول | RLS | عدد السياسات |
| --- | --- | --- |
| `attendance` | ✅ | 2 |
| `audit_log` | ✅ | 1 |
| `batches` | ✅ | 4 |
| `branches` | ✅ | 1 |
| `certs` | ✅ | 2 |
| `course_ratings` | ✅ | 1 |
| `courses` | ✅ | 4 |
| `enrollments` | ✅ | 2 |
| `excuses` | ✅ | 2 |
| `notifications` | ✅ | 2 |
| `points_ledger` | ✅ | 2 |
| `points_rules` | ✅ | 1 |
| `private_notes` | ✅ | 2 |
| `profiles` | ✅ | 2 |
| `push_devices` | ✅ | 0 |
| `session_reports` | ✅ | 2 |
| `sessions` | ✅ | 2 |
| `student_badges` | ✅ | 2 |
| `volunteer_committees` | ✅ | 4 |
| `waitlist` | ✅ | 2 |

## Storage

| الحاوية | عام؟ | الحد | السياسات |
| --- | --- | --- | --- |
| `avatars` | نعم | 1 MB — jpeg/png/webp | read (عام), write/update/delete (المالك) |
| `excuses` | لا | 4 MB — pdf/jpeg/png/webp | read (المالك أو staff), write/delete (المالك) |

كل الكتابة مقيّدة بـ `(storage.foldername(name))[1] = auth.uid()::text`،
أي أن المستخدم لا يكتب إلا داخل مجلده.

## دوال داخلية (ليست RPC)

هذه معرّفة في الـ migrations ولا يستدعيها التطبيق مباشرة:

`apply_rule`، `award_badge`، `current_role`، `handle_new_user`، `is_admin`، `is_instructor`، `is_instructor_for_student`، `is_staff`، `mask_name`، `mask_phone`، `protect_founder`، `refresh_enrollment_progress`، `refresh_student_stats`، `sync_points_from_ledger`، `touch_updated_at`، `write_audit`

## كيف يُفرَض هذا العقد

1. `npm test` يشغّل `tests/test-rpc-contract.js` الذي يفشل إذا استدعى
   التطبيق دالة غير موجودة في الـ migrations، أو أرسل معاملًا باسم خاطئ،
   أو ظهرت overload غامضة، أو مُنحت صلاحية لـ `PUBLIC`.
2. `supabase/migrations/20260814120000_rpc_contract_guard.sql` يوفّق قاعدة
   البيانات مع العقد عند كل `db push`، ويرفض المتابعة (`RAISE EXCEPTION`)
   بدلًا من إنشاء دالة وهمية إذا كانت دالة متعاقد عليها غائبة فعلًا.
3. `npm run db:verify` يستدعي كل RPC فعليًا على قاعدة البيانات الحية
   بمفتاح `anon` للتأكد من أن الـ schema cache لم يعد يُرجع الخطأ.
