# خطة الإصلاح والتحصين والتحسين — مسار RTC v8.0

> **النطاق:** مراجعة كاملة + خطة تنفيذ فقط. لا تعديل على كود التشغيل في هذه المرحلة.
> **تاريخ المراجعة:** 13 أغسطس 2026
> **المراجع:** تدقيق أمني ومعماري ووظيفي وUX على كل ملفات المستودع سطراً بسطر.
> **الملفات المفحوصة:** `app.js` (2293 سطر) · `index.html` (1041 سطر) · `supabase_schema.sql` · `js/supabaseClient.js` · `sw.js` · `manifest.json` · `capacitor.config.json` · `package.json` · `supabase/config.toml` · `supabase/migrations/*` · `generate-icons.js` · `README.md` · `task.md` · `PLAN-MIGRATION.md`

---

## 0) الخلاصة التنفيذية

التطبيق **واجهياً ناضج** (تصميم عربي RTL قوي، شاشات الأدوار الثلاثة، Bottom Sheets، Dark OLED). لكن تحت السطح هو **ليس تطبيقاً إنتاجياً آمناً بعد**.

الجذر الحقيقي ليس «نقص ميزات»، بل **فجوة ثقة بين الواجهة وقاعدة البيانات**:

| الطبقة | التقييم | الحكم |
|---|---|---|
| UI / UX البصري | 8.4 / 10 | جاهز للعرض |
| تدفق المصادقة الحقيقي | 3 / 10 | Google OAuth موجود، لكن يُتجاوز بـ localStorage |
| RLS + صلاحيات السيرفر | 2 / 10 | سياسات ناقصة / خاطئة / تسمح بتصعيد صلاحيات |
| تطابق الكود ↔ السكيمة | 2 / 10 | عشرات الأعمدة والجداول والدوال التي يستدعيها `app.js` غير موجودة |
| PWA / Offline | 1 / 10 | `sw.js` و`manifest.json` موجودان لكن غير مربوطين أصلاً |
| جودة هندسية (اختبارات/CI/أنواع) | 1 / 10 | صفر اختبارات، صفر CI، قفل اعتمادات مُتجاهل |
| الأمان الإنتاجي | **غير صالح للإطلاق** | 7 ثغرات P0 يجب إغلاقها قبل أي مستخدم حقيقي |

**القاعدة الذهبية للإصلاح:** لا تُضَف ميزات جديدة فوق أساس مكسور. الترتيب: **أمان السيرفر → تطابق السكيمة → مصادقة حقيقية → إصلاح حلقة الحضور/النقاط/الشهادات → ثم التحسينات والميزات.**

---

## 1) خريطة النظام كما هو اليوم

```
المتصفح (Vanilla SPA)
  index.html  ──Tailwind CDN──  Phosphor CDN  ── jsPDF CDN
       │
       ├── js/supabaseClient.js   ← مفتاح anon ثابت في المصدر
       ├── app.js                 ← روتر + كل المنطق + كل الاستعلامات
       └── localStorage
             rtc_user_profile     ← يُعامل كجلسة!
             rtc_pref_*           ← تفضيلات

Supabase Cloud (jwhedqmszbdougsqqmhv)
  auth.users
  public.profiles / courses / batches / enrollments
  public.sessions / attendance / points_rules / points_ledger / certs
  ❌ لا notifications  ❌ لا record_attendance()  ❌ لا dark_mode
  ❌ لا badge_ids      ❌ لا sessions_done         ❌ migration فارغة
```

ثلاث حقائق خطرة:

1. **الواجهة تصدّق نفسها.** `CURRENT_PROFILE` من `localStorage` يكفي لدخول لوحة المشرف.
2. **السكيمة لا تطابق الكود.** أغلب كتابات الإنتاج تفشل أو تُكتب في الفراغ.
3. **RLS لا يحمي الأعمدة الحساسة.** أي مستخدم موثّق يقدر يحدّث `role` لنفسه إلى `admin`.

---

## 2) الثغرات الأمنية — مرتبة بالخطورة

### P0 — يجب إغلاقها قبل أي استخدام حقيقي

#### P0-01 · تصعيد صلاحيات عبر RLS (Privilege Escalation)
- **الموقع:** `supabase_schema.sql` سياسة `Users can update their own non-sensitive profile info`
- **الخلل:** السياسة `USING (auth.uid() = id)` بدون `WITH CHECK` وبدون منع عمود `role` / `status` / `points`.
- **الاستغلال:** من DevTools بعد تسجيل دخول طالب:
  ```js
  supabaseClient.from('profiles').update({ role: 'admin', points: 99999 }).eq('id', user.id)
  ```
- **الأثر:** أي طالب يصبح مشرفاً، يرى كل المستخدمين، يصدر شهادات، يحذف كورسات.
- **الإصلاح:**
  1. فصل السياسات: المستخدم يحدّث فقط `full_name, phone, branch, avatar_url, lang, dark_mode`.
  2. منع تحديث `role` و`status` و`points` و`badge_ids` من العميل تماماً.
  3. نقل تغيير الدور إلى دالة `SECURITY DEFINER` يتحقق فيها `auth.uid()` أنه `admin`.
  4. نقل النقاط إلى `points_ledger` فقط عبر دوال سيرفر.
  5. Trigger: `BEFORE UPDATE` يرفض تغيير `role/points/status` إن لم يكن المنفّذ service_role أو دالة معرفة.

#### P0-02 · تجاوز المصادقة عبر localStorage (Auth Bypass)
- **الموقع:** `app.js` تهيئة `DOMContentLoaded` (~سطر 2264)
- **الخلل:** إذا وُجد `rtc_user_profile` فيه اسم ورقم ≥ 10 أرقام يتم `routeToRoleHome()` **بدون جلسة Supabase**.
- **الاستغلال:**
  ```js
  localStorage.setItem('rtc_user_profile', JSON.stringify({
    id:'x', full_name:' grok', phone:'01000000000', role:'admin'
  }))
  location.reload()
  ```
- **الأثر:** دخول لوحة الإدارة بالكامل على الواجهة. الاستعلامات قد تفشل، لكن أي شاشة محلية تظهر، وأي انطباع أمني ينهار.
- **الإصلاح:**
  - المصدر الوحيد للهوية: `supabase.auth.getSession()` + `onAuthStateChange`.
  - `localStorage` للعرض المؤقت فقط (هيكل عظمي)، ويُرمى إن لم تطابقه جلسة JWT.
  - Route Guard حقيقي قبل `showScreenEl` / `switchTab` / `push`.

#### P0-03 · فك JWT يدوياً دون التحقق من التوقيع
- **الموقع:** `parseGoogleJwtFromHash()` في `app.js`
- **الخلل:** يقرأ `access_token` من الـ hash، يعمل `atob` للـ payload، ويعتبره مستخدماً صالحاً. **لا يمرّر التوكن إلى `supabase.auth.setSession()`**.
- **الأثر المزدوج:**
  1. أمني: أي hash مزوّر الشكل قد يُقبل واجهياً.
  2. وظيفي: `CURRENT_USER` يُضبط لكن عميل Supabase بلا جلسة → كل الاستعلامات 401.
- **الإصلاح:** احذف الدالة بالكامل. اترك `detectSessionInUrl: true` (موجود) + `onAuthStateChange` هما المسار الوحيد.

#### P0-04 · إنشاء الملف الشخصي يسقط إلى «حساب محلي وهمي»
- **الموقع:** `submitProfile()` — إن فشل `upsert` يُنشأ كائن `prof` محلي بـ `role:'student'` و`points:50` ويُعتبر التسجيل ناجحاً.
- **السبب الجذري:** جدول `profiles` **لا يملك سياسة INSERT**. الـ upsert من العميل يفشل دائماً إلا بوجود Trigger على `auth.users`.
- **الأثر:** مستخدم يعتقد أنه مسجّل، بياناته غير موجودة، ثم P0-02 يبقيه «داخل» التطبيق.
- **الإصلاح:**
  - Trigger `on_auth_user_created` ينشئ صف `profiles` (role=`pending`, status=`pending`).
  - العميل يعمل `update` فقط على الحقول المسموحة، لا `upsert`.
  - إن فشل الحفظ: ارفض الدخول ولا تختلق بروفايلاً محلياً.

#### P0-05 · لا حراسة مسارات (Route Guards مفقودة)
- **الموقع:** `push()` / `switchTab()` / `renderScreen()` — لا تتحقق من الدور.
- **الخلل:** `task.md` يدّعي أن الحراسة منتهية. الكود الحالي يسمح من الكونسول بـ `switchTab('a-home')` لأي دور.
- **الإصلاح:** خريطة صلاحيات:
  ```
  student    → s-* فقط
  volunteer  → v-* + s-analytics (أو يُمنع من التحليلات الكاملة)
  admin      → a-* + s-analytics
  pending    → شاشة انتظار موافقة فقط
  ```
  أي مسار مخالف → `routeToRoleHome()` + toast + لا تُرسم البيانات.

#### P0-06 · RLS ناقص على الكتابة — معظم العمليات الإنتاجية غير مسموحة أو مفتوحة خطأ
| الجدول | الموجود | الناقص / الخطر |
|---|---|---|
| `profiles` | SELECT / UPDATE مفتوحان | لا INSERT · UPDATE يسمح بتغيير الدور |
| `courses` | SELECT للكل + ALL للأدمن | ALL بدون WITH CHECK منفصل |
| `batches` | SELECT للكل + ALL لأدمن أو المدرّس | المتطوع لا يستطيع تعيين نفسه (`assignSelfAsInstructor` يفشل) · المدرّس يستطيع DELETE |
| `enrollments` | SELECT فقط | **لا INSERT** → `joinBatch` يفشل |
| `sessions` | SELECT فقط | **لا INSERT** → تسجيل الحضور يفشل |
| `attendance` | SELECT + INSERT للمتطوع/أدمن | لا UPDATE · لا ربط أن المتطوع مدرّس هذه الدفعة |
| `certs` | SELECT فقط | **لا INSERT** → إصدار الشهادات يفشل |
| `points_ledger` | SELECT فقط | **لا INSERT** · النقاط تُكتب على `profiles.points` مباشرة (سباق) |
| `points_rules` | **RLS غير مفعّل** | أي شخص يقرأ/يعدّل قواعد النقاط |
| `notifications` | **الجدول غير موجود** | الشاشة تتكسر |

- **الإصلاح:** إعادة كتابة السياسات جدولاً جدولاً + دوال `SECURITY DEFINER` للعمليات المركّبة (`join_batch`, `record_attendance`, `issue_certificate`, `change_role`).

#### P0-07 · سياسة SELECT على `profiles` تعيد الاستعلام على نفسها (RLS Recursion)
- **الموقع:** `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')`
- **الأثر:** في Postgres هذا النمط يسبب خطأ `infinite recursion detected in policy` أو يمنع الأدمن نفسه من القراءة.
- **الإصلاح الكلاسيكي (معيار Supabase):**
  - دالة `public.is_admin()` / `public.current_role()` بـ `SECURITY DEFINER SET search_path = public`.
  - أو وضع الدور في `auth.users.raw_app_meta_data.role` وقراءته من `auth.jwt()`.
  - **المفضّل:** الدور في `app_metadata` (لا يستطيع المستخدم تعديله) + JWT custom claim.

---

### P1 — أمني مهم قبل الإطلاق العام

#### P1-01 · لا Content-Security-Policy
`index.html` بلا أي CSP. `task.md` يدّعي إضافتها. Tailwind CDN + سكربتات inline تكسر أي CSP صارم، وهذا سبب إضافي لنقل البناء لمحلّي.
**المطلوب (مرحلة البناء):**
```
default-src 'self';
script-src 'self' 'nonce-…';
style-src 'self' 'nonce-…';
img-src 'self' data: https://*.googleusercontent.com https://*.supabase.co;
connect-src 'self' https://*.supabase.co https://accounts.google.com;
frame-src https://accounts.google.com;
base-uri 'self'; form-action 'self'; object-src 'none';
```

#### P1-02 · سكربتات CDN بلا SRI
Tailwind / Supabase JS / jsPDF / Phosphor / Fontsource / Google GIS — أي تسميم CDN = تنفيذ كود على كل المستخدمين.
**الإصلاح:** تثبيت الحزم محلياً + SRI إن بقي أي CDN + حذف `cdn.tailwindcss.com` (ممنوع في الإنتاج رسمياً من Tailwind).

#### P1-03 · مفتاح anon وURL ثابتان في المصدر
المفتاح الـ anon **مصمم ليكون عاماً**، لكن:
- يجب أن يأتي من `.env` / بناء، لا من ملف داخل git بشكل يوحي أنه سر.
- `console.log` لعنوان المشروع في الإنتاج يُحذف.
- أضف `.env.example` (الملف مذكور في `.gitignore` وغير موجود).

#### P1-04 · الشهادات قابلة للتزوير
- الرقم التسلسلي: `Math.random().toString(36).substr(2,8)` — ليس فريداً ضماناً ولا غير قابل للتخمين.
- الـ PDF يطبع تاريخ **اليوم** لا `issued_at`.
- الكود المطبوع هو أول 8 من UUID الشهادة لا `serial_number`.
- لا QR حقيقي.
- `verify_certificate` صحيحة الفكرة لكن بلا `GRANT` ظاهر لـ `anon` (التحقق العام) وبلا معدل طلبات.
**الإصلاح:** `serial_number` من `gen_random_uuid()` أو `RTC-` + Crockford base32 من 10 بايت عشوائي · UNIQUE · QR عبر مكتبة · التحقق العام بدون PII زائد (أو قناع الاسم).

#### P1-05 · الصورة الشخصية تُخزَّن Data-URL داخل الصف
`editAvatar` يقرأ الملف بـ `FileReader.readAsDataURL` ثم `update({ avatar_url })`. صورة 4 ميجا تُكتب في Postgres وتُسحب في كل `select(*)`.
**مخاطر:** DoS تخزيني + XSS كامن إن لم يُتحقق النوع + لا حدود حجم.
**الإصلاح:** رفع إلى Supabase Storage bucket `avatars` (حد 1MB، `image/jpeg|png|webp`) + تحويل سريع على العميل (canvas 256×256) + `avatar_url` رابط عام موقَّع أو عام محدود.

#### P1-06 · ألوان/أيقونات من DB داخل `style` و`class` بدون `safeColor`/`safeIcon`
`esc()` يحمي HTML لا CSS. `background:${color}` يقبل قيماً مثل `#fff;position:fixed` أو `url(...)`.
`task.md` يدّعي وجود `safeColor`/`safeIcon` — **غير موجودين في `app.js` الحالي.**
**الإصلاح:** `HEX_RE = /^#[0-9a-fA-F]{3,8}$/` و`ICON_RE = /^ph(-[a-z0-9]+)+$/` وإسقاط أي قيمة أخرى للافتراضي.

#### P1-07 · تسريب بيانات شخصية (PII)
- كشف المجموعة يعرض رقم هاتف الطالب كاملاً للمتطوع.
- التحليلات (`s-analytics`) متاحة للمتطوع وتعرض **البريد** لكل المستخدمين.
- لوحة الصدارة تطلب كل ملفات الطلاب — سياسة RLS الحالية تمنعها عن الطالب (الميزة تتكسر) أو تُفتح أكثر من اللازم.
**الإصلاح:** عرض هاتف مقنّع `010•••••67` · التحليلات الكاملة للأدمن فقط · لوحة الصدارة عبر View/RPC تُرجع `full_name, points, avatar_url` بلا بريد/هاتف · سياسة SELECT للأسماء العامة فقط.

#### P1-08 · Service Worker يضرب `/api/attendance` بلا مصادقة
المسار غير موجود. إن أُضيف لاحقاً بلا JWT سيكون حقناً مفتوحاً.
**الإصلاح:** إما حذف المزامنة حتى تجهز، أو إرسال `Authorization: Bearer <access_token>` إلى Edge Function.

#### P1-09 · `user-scalable=no` + عدم وجود سياسة خصوصية
مخالفة WCAG / سياسة متاجر Apple. لا يوجد `LICENSE` رغم ادعاء GPL-3 في README. لا صفحة خصوصية ولا شروط — مطلوبة لـ Google OAuth verification ولوحة بيانات شخصية مصرية.

#### P1-10 · إعدادات Auth المحلية لا تطابق التشغيل
`supabase/config.toml`:
- `site_url = http://127.0.0.1:3000` بينما `npm run dev` على **5173**
- لا `additional_redirect_urls` لنطاق الإنتاج / Capacitor (`capacitor://localhost`, `https://localhost`)
- `auth.sms.enable_signup = false` بينما الخطة القديمة كانت Phone OTP
- `minimum_password_length = 6` ضعيف إن أُضيف لاحقاً إيميل
- `enable_confirmations = false`

---

## 3) أعطال وظيفية تكسر المنتج (السكيمة ≠ الكود)

هذه ليست «تحسينات». هذه عمليات يضغط المستخدم زرها فتفشل أو تكذب عليه.

### 3.1 أعمدة يستدعيها `app.js` وغير موجودة في السكيمة

| العمود / الكائن | أين يُستخدم | النتيجة الحالية |
|---|---|---|
| `profiles.dark_mode` | `toggleDark` | فشل التحديث، الوضع لا يُحفظ سحابياً |
| `profiles.badge_ids` | `awardBadge` / الشارات | الشارات لا تُحفظ |
| `profiles.attendance_pct` | الرئيسية | تظهر دائماً `0%` |
| `profiles.streak` | الرئيسية + شارة المثابر | دائماً `0` |
| `profiles.via_google` | الملف الشخصي | يظهر «حساب محلي» رغم Google |
| `batches.sessions_done` | حضور، شهادات، تقدم | السكيمة فيها `lectures_done` فقط |
| `batches.instructor_name` | كل شاشات المجموعات | يعتمد على join `profiles` فقط |
| `enrollments.course_id` | `joinBatch` | insert يُرفض |
| `enrollments.sessions_done` | شريط التقدم + أهلية الشهادة | **دائماً 0 → الشهادات لا تُصدر أبداً** |
| `sessions.session_number` | `saveAttendance` | insert يُرفض |
| `attendance.batch_id` | `saveAttendance` | insert قد يُرفض |
| `certs.batch_id` | `issueCerts` | insert قد يُرفض |
| `certs` UNIQUE `(student_id, course_id)` | `onConflict` | القيد غير موجود → upsert يفشل |
| `courses.description / start_date / interview_date / level / created_by` | إضافة/تعديل كورس | التحديث يفشل أو يُتجاهل |
| جدول `notifications` | الإشعارات + تنبيه التأجيل | الشاشة فارغة / insert يفشل |
| RPC `record_attendance` | بعد حفظ الحضور | استثناء، والحضور قد يكون انكتب نصفياً |
| `supabase/migrations/20260811072913_initial_schema.sql` | ترحيل CLI | **ملف فارغ 0 بايت** — `supabase db push` لا ينشئ شيئاً |
| `supabase/seed.sql` | مذكور في config.toml | **غير موجود** |

### 3.2 حلقة الحضور → النقاط → الشهادة (القلب الميت للتطبيق)

التسلسل الحالي في `saveAttendance`:

1. `insert sessions` (أعمدة غير موجودة + لا سياسة INSERT)
2. `upsert attendance` (عمود `batch_id` غير موجود)
3. لكل طالب حاضر/متأخر: `rpc('record_attendance')` **الدالة غير موجودة**
4. `update batches.sessions_done` والعمود الحقيقي `lectures_done`
5. **لا يتم أبداً تحديث `enrollments.sessions_done`**
6. `issueCerts` يفلتر `e.sessions_done >= total` → القائمة دائماً فارغة
7. النقاط تُزاد على `profiles.points` في `joinBatch` بعملية قراءة-تعديل-كتابة (lost update)

**الإصلاح المعماري (دالة واحدة ذرية):**

```
record_session_attendance(batch_id, map<student_id, status>)
  1. تتحقق: المستخدم admin أو instructor هذه الدفعة
  2. تمنع جلسة مكررة لنفس اليوم (UNIQUE batch_id + session_date)
  3. تُدرج session
  4. تُدرج attendance (UNIQUE session_id + student_id)
  5. تكتب points_ledger من points_rules (لا أرقام ثابتة 10/5 في JS)
  6. تحدّث enrollments.sessions_done = عدد الحاضر/المتأخر
  7. تعيد حساب profiles.streak و attendance_pct من السجل (لا تُخزَّن يدوياً أو تُحسب بـ View)
  8. إن اكتملت المحاضرات: تُصدر cert بـ serial قوي (اختياري تلقائي)
```

كل هذا في Postgres. الواجهة تعرض النتيجة فقط.

### 3.3 أسماء الفروع غير موحّدة (فلاتر صامتة فارغة)

نفس الفرع مكتوب 3 صيغ مختلفة:

| المصدر | النص |
|---|---|
| Picker / `ALL_RTC_BRANCHES_PICKER` | `فرع فيصل — الطوابق (الجيزة)` |
| مودال إضافة مجموعة | `فرع فيصل (الطوابق)` |
| تعديل كورس | `فرع فيصل (الطوابق)` |
| روابط فيسبوك | `فرع سموحة (الإسكندرية)` بينما الـ picker: `فرع الإسكندرية — سموحة` |
| افتراضي السكيمة | `فرع فيصل — الطوابق (الجيزة)` |
| افتراضي onboarding | `فرع مدينة نصر (القاهرة)` |

`eq('branch', …)` لن يطابق. المستخدم يختار فرعه فيرى صفر كورسات.

**الإصلاح:** جدول `branches` (`id, slug, name_ar, name_en, city, address, facebook_url, whatsapp, is_active`) وكل الكيانات تخزّن `branch_id` لا نصاً حراً.

### 3.4 أعطال تدفق المستخدم

| # | العطل | الموقع | الإصلاح |
|---|---|---|---|
| 1 | نقاط onboarding ستة والخطوات اثنتان | `index.html` dots + `nextOnbStep(5)` | احذف النقاط الزائدة أو اجعلها 2 |
| 2 | OAuth return يستدعي `nextOnbStep(5)` → الشاشتان تُخفيان → شاشة بيضاء | `app.js` ~2237 | احذف المسار، اترك `handleAuthSession` |
| 3 | سباق ثلاثي: hash parser + `getSession` + `onAuthStateChange` | init | مسار واحد فقط |
| 4 | `popstate` يستدعي `pop()` بعد أن المتصفح رجع أصلاً → رجوع مزدوج | `app.js` | اقرأ `event.state.screen` وانتقل إليه، لا تنفّذ pop إضافي |
| 5 | شاشة `s-course-detail` موجودة في HTML بلا renderer | `index.html` | اربطها أو احذفها |
| 6 | شارة `social` لا تُمنح أبداً | الكتالوج فقط | اربطها بالمشاركة أو احذفها |
| 7 | `checkBadges` لا يفحص الحضور الفعلي ولا التخرج | `app.js` | اعتمد على بيانات السجل |
| 8 | واتساب الدعم `201000000000` وهمي | الدعم | رقم حقيقي لكل فرع من جدول الفروع |
| 9 | بانر فيسبوك يسقط دائماً لمدينة نصر إن لم يطابق الاسم حرفياً | `renderStudentHome` | عبر `branches.facebook_url` |
| 10 | متطوع يفتح «إضافة كورس» فيفشل بسبب RLS | `v-courses` | أخفِ الزر لغير الأدمن |
| 11 | `assignSelfAsInstructor` تمنعه سياسة «يجب أن تكون المدرّس أصلاً» | RLS batches | سياسة UPDATE خاصة أو RPC |
| 12 | تغيير الدور دورة مغلقة student→volunteer→admin→student | `changeUserRole` | قائمة أدوار + حالة + سبب |
| 13 | لا يمكن تعطيل مستخدم أو الموافقة على `pending` | إدارة المستخدمين | شاشة موافقة |
| 14 | `toggleDark` لا يعمل بدون `CURRENT_PROFILE` ولا يكتب `setPref` | dark mode | اكتب المحلّي دائماً + السحابة إن وُجد العمود |
| 15 | نسخة التطبيق: README 8.0 / HTML 7.0 / package 2.0.0 / SW `rtc-v3` | كل الملفات | رقم واحد `8.1.0` يُحقن من package.json |
| 16 | Google GIS يُحمَّل ولا يُستخدم | `index.html` | احذفه (OAuth عبر Supabase) |
| 17 | Capacitor plugins في package وغير مستدعاة | app.js | اربط أو احذف |
| 18 | أيقونات PWA في `.gitignore` وغير مولَّدة في المستودع | manifest | ولّدها وثبّتها أو لا تتجاهلها |
| 19 | لا `<link rel="manifest">` ولا تسجيل SW | `index.html` | أضفهما بعد إصلاح الكاش |
| 20 | `webDir: "."` يغلّف المستودع كله بما فيه ملفات التطوير | capacitor | ابنِ إلى `dist/` |

---

## 4) خطة إصلاح قاعدة البيانات (المصدر الوحيد للحقيقة)

### 4.1 ملف الترحيل
1. انقل محتوى `supabase_schema.sql` **بعد إصلاحه** إلى `supabase/migrations/20260811072913_initial_schema.sql` (الملف الفارغ حالياً كارثة).
2. لا تعتمد على `CREATE TABLE IF NOT EXISTS` اليدوي كمصدر. كل تغيير = migration جديدة.
3. أضف `supabase/seed.sql` للكورسات التجريبية + فروع + قواعد النقاط (وليس في migration الإنتاج إن أمكن).

### 4.2 السكيمة المستهدفة (متوافقة مع الكود بعد توحيده)

```
branches          id, slug, name_ar, name_en, city, address, facebook_url, whatsapp, is_active
profiles          id→auth.users, role, status, full_name, phone UNIQUE, email,
                  branch_id FK, avatar_url, lang, dark_mode,
                  created_at, updated_at
                  -- points / streak / attendance_pct تُشتق لا تُخزَّن (أو تُحدَّث بـ trigger من الـ ledger)
student_badges    student_id, badge_id, earned_at   UNIQUE(student_id, badge_id)
courses           id, title_ar, title_en, category, icon, color, sessions_count,
                  max_students, level, description, start_date, interview_date,
                  branch_id, is_active, created_by, created_at
batches           id, course_id, name, instructor_id, branch_id,
                  schedule, location, sessions_done, is_active, created_at
enrollments       id, batch_id, student_id, joined_at
                  UNIQUE(batch_id, student_id)
                  -- sessions_done مشتق من attendance
sessions          id, batch_id, title, session_number, session_date, created_by
                  UNIQUE(batch_id, session_date)
attendance        id, session_id, student_id, status, note, recorded_by, created_at
                  UNIQUE(session_id, student_id)
points_rules      id, code UNIQUE, title, amount
points_ledger     id, student_id, rule_id, amount, reason, created_by, created_at
certs             id, student_id, course_id, batch_id, serial_number UNIQUE,
                  issued_at, issued_by
                  UNIQUE(student_id, course_id)
notifications     id, user_id, title, message, type, read_at, created_at
audit_log         id, actor_id, action, entity, entity_id, meta jsonb, created_at
excuses           id, student_id, session_id, reason, file_path, status, reviewed_by
```

### 4.3 دوال السيرفر الإلزامية
- `public.current_role()` / `is_admin()` / `is_staff()`
- `handle_new_user()` trigger على `auth.users`
- `join_batch(batch_id)` — يتحقق السعة والحالة ويمنع التكرار
- `record_session_attendance(...)` — ذرية كما فوق
- `issue_certificates(batch_id)` — للطلاب المكتملي الحضور فقط
- `change_user_role(user_id, role, status)` — أدمن فقط + audit
- `verify_certificate(serial)` — `SECURITY DEFINER` + `GRANT EXECUTE TO anon, authenticated` + لا تُرجع هاتفاً/بريداً
- `award_badge(student_id, badge_id)` — من السيرفر فقط
- Trigger `updated_at`

### 4.4 RLS — المبدأ
- الدور من JWT `app_metadata` لا من جدول يعدّله المستخدم.
- الطالب: صفّه، تسجيلاته، حضوره، شهاداته، إشعاراته.
- المتطوع: دفعاته التي `instructor_id = auth.uid()` وطلاب تلك الدفعات فقط (أسماء + حضور، هاتف مقنّع عبر View).
- الأدمن: كل شيء عبر السياسات أو عبر دوال، مع `audit_log`.
- `anon`: لا شيء إلا `verify_certificate`.

---

## 5) خطة إصلاح الواجهة والمصادقة (بدون إعادة كتابة الروتر)

**مبدأ PLAN-MIGRATION ما زال صحيحاً:** أبقِ `_doRender` / الشاشات / `esc`. استبدل مصادر الحقيقة فقط.

### المرحلة A — أمان الهوية (يوم 1–2)
1. احذف `parseGoogleJwtFromHash` ومسار `cachedProf → routeToRoleHome`.
2. احذف اختلاق البروفايل المحلي في `submitProfile`.
3. أضف `guard(screenId)` في `push/switchTab/showScreenEl/popstate`.
4. `pending` → شاشة «حسابك قيد المراجعة».
5. عالج `popstate` عبر `history.state.screen`.
6. أصلح `nextOnbStep` ونقاط الخطوات.
7. انقل إعدادات Supabase إلى بيئة بناء. أبقِ anon في العميل بعد البناء، لا في git كقيمة وحيدة.

### المرحلة B — طبقة بيانات رفيعة (يوم 2–4)
ملف جديد `js/api.js` (ليس repository ضخماً) يغلّف:
`getMyProfile, updateMyProfile, listCourses, listBatches, joinBatch, myEnrollments, myBatches, batchRoster, saveAttendance, issueCerts, listNotifications, verifyCert, admin.*`
كل دالة تتعامل مع خطأ RLS بشكل مفهوم عربي («ليست لديك صلاحية» لا نص Postgres).

### المرحلة C — إصلاح الحلقة التدريبية (يوم 4–6)
اربط الأزرار الموجودة بالدوال السيرفرية. حدّث شريط التقدم من عدد جلسات الحضور الحقيقية. اجعل الشهادة تُصدر عندما يستحقها الطالب.

### المرحلة D — PWA حقيقي (يوم 6–7)
- `<link rel="manifest">` + أيقونات مُنتَجة ومُتتبَّعة.
- تسجيل SW بعد أول تفاعل.
- كاش إصدار يتغير مع `package.json` version (`rtc-v8.1.0`).
- لا تكاش `app.js` إلى الأبد بدون `skipWaiting` + رسالة «يتوفر تحديث».
- احذف `/api/attendance` أو اربطه بـ Edge Function.
- لا تكاش استعلامات Supabase (Network-first للـ API).

---

## 6) مشاكل UX / UI / إتاحة — تحسينات على الموجود

التقييم البصري جيد، لكن فيه فجوات «منتج حقيقي» واضحة:

1. **لا هيكل عظمي حقيقي** — الشاشات تضع `emptyState(spinner)` كنص، لا shimmer كما ادّعى `task.md`.
2. **لا حالات خطأ قابلة لإعادة المحاولة** مع زر «حاول مرة أخرى» إلا نادراً.
3. **الوضع الليلي للأدمن/المتطوع بلا مفتاح واضح** (صف فقط) وبلا `role="switch"` رغم ادعاء المهمة.
4. **لا haptic** مربوط بـ Capacitor Haptics رغم وجود الحزمة.
5. **`maximum-scale=1, user-scalable=no`** يمنع تكبير ضعاف البصر — احذفه.
6. **تركيز لوحة المفاتيح / ترتيب التاب** غير مُختبَر داخل الـ sheets.
7. **أسماء عربية طويلة** تُقص في الهيدر (`ellipsis`) بدون title كامل.
8. **لا empty state بعد فلتر فرع** يشرح أن المشكلة غالباً اختلاف التسمية (حتى إصلاح الفروع).
9. **إشعارات: النقطة الحمراء `#notif-dot` لا تُفعَّل أبداً** (`display:none` ثابت).
10. **لا pull-to-refresh** على القوائم الحية.
11. **لا تأكيد قبل الانضمام** لمجموعة (خطأ سهل).
12. **حفظ الحضور بدون تحديد كل الطلاب** مسموح — يجب تنبيه «3 طلاب بلا حالة».
13. **لا تعديل حضور سابق** (كانت في الخطة القديمة `v-edit-past`).
14. ** croud إدارة المستخدمين بلا بحث/فلتر دور/فرع** — تنهار بعد 50 حساباً.
15. **سطح المكتب:** `#app` بعرض 1180 جيد، لكن الـ nav السفلي في المنتصف يضيع مساحة شريط جانبي كلاسيكي للإدارة.
16. **الرسوم المتحركة الخلفية 28 جسيماً + 3 orbs** تعمل حتى على صفحات البيانات — أوقفها بعد تجاوز الـ splash أو احترم البطارية (`Battery API` اختياري + `prefers-reduced-motion` موجود وهذا جيد).

---

## 7) ما ادّعاه المشروع ولم يُنفَّذ (دين توثيق)

`task.md` وREADME يقدّمان التطبيق كمنتهٍ أمنياً ووظيفياً. الواقع:

| الادعاء | الواقع |
|---|---|
| Route Guards | غير موجودة |
| `escapeHtml` على 52 موضعاً + `safeColor/safeIcon` | يوجد `esc` فقط |
| CSP | غير موجود |
| OTP حقيقي / حذف `123456` | لا يوجد OTP أصلاً (Google فقط) |
| CRUD كامل + حذف بـ confirm | الحذف ناعم للكورس فقط · لا حذف مستخدم · لا إدارة فروع |
| شاشات s-excuse / v-report / v-edit-past / a-branches / a-export / a-broadcast | غير موجودة |
| PWA + SW + Offline | الملفات موجودة وغير مربوطة |
| Web Push + Background Sync | مستمعون في SW بلا تسجيل وبلا خادم |
| تكامل حقيقي بلا dummy | fallback محلي + أعمدة ناقصة = بيانات وهمية صامتة |
| GPL-3 | لا ملف LICENSE |

**أثناء الإصلاح:** حدّث README و`task.md` ليطابقا الواقع بعد كل مرحلة. التوثيق الكاذب أخطر من غياب التوثيق.

---

## 8) تحسينات على الميزات الحالية (بعد P0/P1)

### 8.1 التسجيل والملف
- إبقاء Google + إضافة **دخول برقم مصري OTP** (Supabase Phone) كمسار بديل — شريحة كبيرة من مستفيدي رسالة بلا حساب Google مناسب.
- الاسم الثلاثي إلزامي في الشهادة، مع معاينة حية «سيظهر على الشهادة هكذا».
- منع تكرار الهاتف برسالة إنسانية («هذا الرقم مرتبط بحساب آخر»).
- رفع صورة مضغوط + قص دائري في الـ sheet.

### 8.2 استكشاف الكورسات
- بطاقة كورس تفتح `s-course-detail` (الشاشة اليتيمة) فيها: الوصف، المواعيد، المحاضر، العدد المتبقي، زر انضمام، منهج مختصر.
- فلتر تصنيف + فرع + يوم الأسبوع.
- عدّاد مقاعد `max_students - count(enrollments)`.
- قائمة انتظار إن اكتملت المجموعة.

### 8.3 الحضور للمتطوع
- منع حفظ جلسة ثانية في نفس اليوم إلا بـ «جلسة إضافية» صريحة.
- حالات: حاضر / متأخر / غائب / معذور.
- ملخص أعلى الصفحة: 12 حاضر · 2 متأخر · 3 غائب.
- حفظ مسودة محلية (IndexedDB) إن انقطع النت ثم مزامنة موقَّعة.
- تعديل آخر جلسة خلال 24 ساعة (بصلاحية + audit).

### 8.4 النقاط والشارات
- مصدر القيم: `points_rules` فقط.
- صفحة للطالب «كشف حساب نقاط» من `points_ledger`.
- الشارات من جدول لا من ثابت JS (أو ثابت للعرض + منح سيرفري).
- Confetti مرة واحدة لكل شارة (لا تُعاد في كل زيارة).

### 8.5 الشهادات
- PDF فيه الاسم، الدورة، الفرع، التاريخ الحقيقي، السيريال، QR لمسار `/verify?s=`.
- صفحة تحقق عامة تعمل بدون تسجيل دخول.
- منع إعادة الإصدار العشوائي (نفس السيريال إن وُجد).

### 8.6 الإدارة
- بحث مستخدمين + فلتر دور/فرع/حالة.
- موافقة حسابات `pending`.
- تغيير دور بقائمة لا دورة عمياء.
- تعطيل حساب (يمنع الدخول عبر Trigger على JWT / `banned`).
- إدارة فروع وكورسات ومجموعات في تسلسل واضح.
- تصدير CSV/Excel حقيقي لكشف المجموعة ولكشف الحضور ولقائمة الشهادات.

### 8.7 الإشعارات
- جدول + Realtime subscribe لصف المستخدم.
- نقطة حمراء حية.
- تنبيه تأجيل/إلغاء يُرسل صفاً لكل طالب (موجود منطقياً) + لاحقاً FCM.
- تعليم الكل كمقروء.

---

## 9) ميزات جديدة مقترحة (بعد استقرار الأساس)

مرتبة بالقيمة لجمعية رسالة، لا بالإبهار.

### الموجة 1 — قيمة تشغيلية مباشرة
1. **طلب عذر غياب** مع صورة/PDF على Storage وموافقة المتطوع.
2. **تقرير محاضرة** (ملخص + تقييم فهم + درجة تفاعل) يُحفظ على `sessions`.
3. **جدولة المحاضرات** كتاريخ/وقت حقيقي لا نص حر، مع «المحاضرة القادمة» الصحيحة في الرئيسية.
4. **رمز QR للحضور** يعرضه المتطوع على الشاشة، الطالب يمسحه لتسجيل نفسه (مع سقف زمني وموقع فرع اختياري).
5. **بث إداري** لفرع أو لكل الطلاب (بديل a-broadcast).
6. **رقم واتساب الفرع** من جدول الفروع لا ثابت وهمي.

### الموجة 2 — جودة التدريب
7. **تقييم الدورة** من الطالب بعد آخر محاضرة (1–5 + تعليق) يظهر للأدمن فقط.
8. **محتوى الجلسة** (رابط ملف / فيديو / واجب) مربوط بكل session.
9. **قائمة انتظار + ترقية تلقائية** عند انسحاب طالب.
10. **ملف طالب للمتطوع:** حضور، ملاحظات خاصة (`private_notes`)، أعذار، نقاط.
11. **تذكير يوم المحاضرة** (إشعار محلي Capacitor + لاحقاً Push).

### الموجة 3 — منصة ونضج
12. **i18n عربي/إنجليزي حقيقي** (`locales/ar.json` + `en.json` + `dir`) كما في PLAN-MIGRATION.
13. **لوحة تحليلات حقيقية:** حضور عبر الزمن، تسرب بعد المحاضرة 3، كورسات الأكثر طلباً، فروع — لا مجرد عدّ صفوف.
14. **تعدد صلاحيات أدمن:** Super Admin / مدير فرع / مشرف كورس.
15. **توثيق شهادة علني** على مسار مستقل خفيف (`verify.html`) يفتح من QR.
16. **وضع كiosk للمتطوع** على تابلت القاعة (دخول برمز يومي لا حساب Google).
17. **تصدير نسخ احتياطي أدمن** JSON/CSV موقَّع بالتاريخ (بدل `simulateBackup` القديم).

### موجة لاحقة (لا تبدأ الآن)
- WhatsApp Business API
- FCM Push كامل
- TypeScript التدريجي
- تطبيق iOS/Android متاجر (بعد استقرار PWA + Capacitor `dist`)

---

## 10) جودة هندسية — ما يجعل الإصلاح يبقى

بدون هذا سيُكسر الإصلاح في أول PR.

| البند | المطلوب |
|---|---|
| قفل الاعتمادات | **لا تتجاهل** `package-lock.json` (حالياً في `.gitignore`) |
| بيئة | `.env.example` بـ `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |
| بناء | Vite أو ما يعادله: Tailwind محلي + minify + تقسيم `api.js` / `ui.js` / `app.js` |
| Capacitor | `webDir: "dist"` |
| أيقونات | `npm run icons` يولّد PWA في جذر متتبَّع |
| ترخيص | ملف `LICENSE` GPL-3 فعلاً أو غيّر README |
| خصوصية | `privacy.html` + `terms.html` عربي مبسّط |
| Lint | `eslint` + قواعد منع `innerHTML` إلا عبر دالة `html\` مُهرَّبة |
| اختبارات عقد السكيمة | يتأكد أن كل عمود يستدعيه `api.js` موجود (حتى SQL snapshot) |
| اختبارات RLS | مستخدم student لا يقرأ كل `profiles` ولا يحدّث `role` |
| اختبارات تدفق | join → attend → points → cert (على Supabase محلي) |
| CI | GitHub Actions: lint + `supabase db lint` + فحص أن migration غير فارغة |
| إصدار | رقم واحد في package / manifest / SW cache / HTML title |
| سجلات | لا `console.log` لأسرار أو JWT في الإنتاج |
| مراقبة | Sentry خفيف أو على الأقل جدول `audit_log` |

`http-server` يكفي للديمو. للإطلاق: استضافة ثابتة (Netlify/Cloudflare Pages/Supabase Hosting) مع HTTPS إجباري وredirects لـ SPA.

---

## 11) خارطة الطريق الزمنية المقترحة

افتراض فريق صغير (1–2 مطور يعرفون السكيمة الحالية):

### الأسبوع 0 — تجميد سلوك كاذب (نصف يوم)
- إخفاء أزرار تُكسر حالياً خلف رسالة «قريباً» إن لم تُصلح فوراً: إصدار شهادات، التحليلات للمتطوع، الانضمام إن فشل insert.
- لا تُطلِق على مستفيدين حقيقيين قبل نهاية الأسبوع 1.

### الأسبوع 1 — P0 أمني + سكيمة (حرج)
- [ ] إعادة كتابة RLS + دوال الدور
- [ ] Trigger إنشاء profile
- [ ] منع تحديث role/points من العميل
- [ ] حذف auth bypass وJWT parser والبروفايل المحلي
- [ ] Route guards
- [ ] ترحيل غير فارغ + أعمدة ناقصة + جدول notifications + جدول branches
- [ ] توحيد أسماء الفروع إلى IDs
- [ ] RPC `record_session_attendance` + `join_batch` + `issue_certificates`
- **بوابة خروج الأسبوع:** طالب حقيقي لا يستطيع أن يصبح أدمن من الكونسول. جلسة مزيفة في localStorage لا تدخل.

### الأسبوع 2 — الحلقة التدريبية تعمل نهاية-ل-نهاية
- [ ] انضمام لمجموعة بسعة
- [ ] حضور يكتب ledger ويحدّث التقدم
- [ ] شارات تُحفظ في `student_badges`
- [ ] شهادة بسيريال قوي + PDF بتاريخ صحيح + تحقق
- [ ] إشعارات تأجيل تصل لجدول الطالب
- [ ] لوحة صدارة عبر RPC آمن
- **بوابة:** سيناريو «أحمد ينضم → يُسجَّل حاضر 8 مرات → تُصدر شهادة → يتحقق منها ضيف» ينجح على مشروع Supabase محلي.

### الأسبوع 3 — منتج المشرف والمتطوع
- [ ] موافقة pending
- [ ] إدارة مستخدمين قابلة للبحث
- [ ] صلاحيات زر إضافة كورس للأدمن فقط
- [ ] تعيين مدرّس يعمل
- [ ] تصدير كشف CSV
- [ ] إعدادات غير فارغة (فروع، قواعد نقاط، واتساب)
- [ ] Dark mode يُحفظ
- [ ] إصلاح history/back

### الأسبوع 4 — PWA + جودة + تلميع UX
- [ ] Vite + Tailwind محلي + CSP + SRI
- [ ] manifest + SW بإصدار
- [ ] أيقونات
- [ ] هيكل عظمي / أخطاء قابلة لإعادة المحاولة / نقطة إشعارات
- [ ] حذف `user-scalable=no`
- [ ] LICENSE + privacy
- [ ] CI أساسي
- [ ] مزامنة Capacitor من `dist`

### الأسبوع 5+ — ميزات الموجة 1
أعذار، تقرير محاضرة، جدول زمني حقيقي، QR حضور، بث إداري.

---

## 12) معايير قبول نهائية (Definition of Done)

لا يُعلن «v9 إنتاج» إلا إذا نجحت **كلها**:

**أمن**
1. تعديل `localStorage.rtc_user_profile.role='admin'` ثم إعادة التحميل → لا لوحة مشرف.
2. `update({role:'admin'})` من طالب → رفض RLS أو trigger.
3. طالب يفتح `#a-users` يدوياً → يُعاد للرئيسية.
4. متطوع لا يرى إلا طلاب دفعاته، وهواتفهم مقنّعة.
5. لا `unsafe-eval` / لا Tailwind CDN في build الإنتاج.
6. `verify_certificate` لا تسرّب هاتفاً أو بريداً.

**وظيفة**
7. تسجيل Google لمستخدم جديد ينشئ صفاً في `profiles` (pending أو student حسب القرار) بلا fallback محلي.
8. الانضمام يفشل بلطف عند اكتمال العدد أو التكرار.
9. حفظ حضور يوم → صف session + N حضور + قيود ledger + تقدم الطالب يزيد.
10. بعد إكمال العدد تُصدر شهادة واحدة فقط لنفس (طالب، كورس).
11. فلتر فرع يُظهر كورسات ذلك الفرع فقط (IDs لا نصوص).
12. الوضع الليلي يبقى بعد إعادة الفتح.

**منصة**
13. `supabase/migrations` غير فارغة وتُطبَّق على DB نظيف.
14. Lighthouse PWA: manifest مربوط، أيقونات 192/512 موجودة.
15. الرجوع الفيزيائي لا يخرج من الحساب ولا يضاعف الرجوع.
16. README يصف ما يعمل فعلاً، لا ما كان مخططاً في أغسطس.

---

## 13) قرارات تحتاج موافقتك قبل التنفيذ

هذه ليست أخطاء، هذه سياسات منتج. لا تُكتب في الكود قبل حسمها:

1. **الدور الافتراضي بعد Google:** `student/active` مباشرة أم `pending` حتى موافقة مشرف؟ (PLAN-MIGRATION اختار pending — الكود الحالي يضع student/active).
2. **هل المتطوع يضيف كورسات أم الأدمن فقط؟** الواجهة تسمح، RLS تمنع.
3. **هل الشهادة تُصدر تلقائياً أم بزر متطوع؟** الزر موجود والمنطق التلقائي مذكور في FAQ.
4. **التحقق من الشهادة:** عام بلا تسجيل (أفضل للتوظيف) أم لمستخدم مسجّل فقط؟
5. **مسار الدخول الثاني:** Phone OTP مصري أم نكتفي بـ Google في v9؟
6. **اللغة:** عربي فقط في v9 أم نبدأ مفاتيح i18n من الآن؟
7. **النقاط على `profiles.points` مخزّنة ومحدَّثة بـ trigger، أم View دائماً؟** (الأول أسرع للوحة الصدارة).

---

## 14) ما لن نلمسه في الإصلاح الأول (عن قصد)

- إعادة كتابة الإطار إلى React/Vue.
- طبقة repository ضخمة فوق كل جدول.
- FCM / واتساب بيزنس / تحليلات cohort.
- تصميم بصري جديد من الصفر — النظام الحالي كافٍ.
- تحويل كل شيء TypeScript دفعة واحدة.

نحافظ على روح التطبيق: Vanilla + شاشات عربية + Supabase. نغيّر **مكان الحقيقة** و**من يملك القلم**.

---

*نهاية خطة التدقيق. التنفيذ يبدأ فقط بعد موافقتك على الترتيب والقرارات السبعة في §13.*
