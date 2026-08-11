# خطة تحويل RTC-app إلى تطبيق إنتاجي حقيقي (Supabase + Auth + RLS + i18n)

> **النطاق:** خطة تنفيذ فقط — لا تعديل على الكود قبل موافقتك صراحةً.

## الوضع الحالي (الفحص الموثق)

فحص كامل للمشروع من 4 مصادر مستقلة (3 Explore agents قراءة سطر-بسطر + RTC-MASTER-REPORT.md):

| الخلاصة | النتيجة |
|---|---|
| **الجذر الحقيقي الوحيد** | **لا Backend إطلاقًا (0%)** — كل شيء client-side عبر `localStorage` |
| البنية المعمارية | ناضجة (9.2/10 UI) — روتر + renderers + escapeHtml سليم |
| الأمان | **كل الأمان قابل للتزوير من DevTools** — مصادقة وسلطات وبيانات وهمية |

### أهم الثغرات المؤكدة (بالترتيب)

| # | الثغرة | الموقع | الخطورة | الحسم |
|---|---|---|---|---|
| 1 | `quickLogin('admin')` = دخول أدمن بضغطة واحدة بلا OTP | `app.js:2127`, `index.html:619-630` | 🔴 حرج | بهذه الخطة (حذف/تقييد) |
| 2 | "الجلسة" = نص role مزيّف في `localStorage`؛ `currentStudent()` يرجع "أول مستخدم" | `app.js:2129,2179,576,2920` | 🔴 حرج | بهذه الخطة (JWT + auth.user()) |
| 3 | كل PII + حضور + نقاط + شهادات قابلة للتلاعب | `app.js:124-184` | 🔴 حرج | بهذه الخطة (RLS + UNIQUE) |
| 4 | الشهادات قابلة للتزوير (QR=SVG زخرفي، serial=Math.random) | `app.js:1846,2493` | 🟠 | إصلاح ملحق |
| 5 | CSP فيه `'unsafe-inline'` في script-src | `index.html:9` | 🟠 | إصلاح ملحق |
| 6 | XSS مخزّن عبر `icon`/`color` غير مُهرب | `app.js:1111,2061,1920` | 🟠 | إصلاح ملحق |
| 7 | `fetch('/api/attendance')` ميت في SW بلا Auth | `sw.js:104` | 🟢 | إصلاح ملحق |

---

## القرارات الحاسمة (أجابها المستخدم)

1. **نطاق الترحيل:** MVP حقيقي — Supabase Auth (SMS OTP) + قاعدة بيانات علائقية + RLS، ترحيل عبر قراءة `localStorage` مباشرة.
2. **التعريب:** **عربي + إنجليزي — تثنية كاملة من الصفر** (~12k محرف عربي).
3. **الدور:** توريد ذاتي مؤقت + موافقة إدارية (الدور يبقى `pending` حتى يوافق الأدمن).

---

## البنية المستهدفة

```
RTC-app (إنتاجي)
├── Frontend: Vanilla SPA (الحالي) + الحفاظ على router/_doRender
│   ├── store (كائن حي) — يبقى، يُربط بـ Supabase عبر save()/loadStore()
│   └── Auth: Supabase Auth — Phone OTP (SMS حقيقي)، جلسة JWT
├── Data: Supabase Postgres + RLS
│   ├── جداول: profiles, courses, batches, enrollments, sessions,
│   │         attendance (UNIQUE), points_ledger, points_rules, badges,
│   │         certs (serial فريد) + notifications/audit_log/branches/excuses
│   ├── leaderboard: مشتق (SELECT) لا جدول — الحفاظ على التصميم الحالي
│   └── RLS: student(بياناته) / volunteer(دفعاته) / admin(كامل)
├── i18n: locales/ar.json + en.json + t(key) — كل ~12k محرف عربي
├── Build: Tailwind محلي + minify + SRI  ← مهمة P0 منفصلة
└── Deploy: Supabase Hosting / Netlify
```

**مبدأ جوهري:** الحفاظ على الروتر والـ renderers المعتمدة. استبدال فقط مكان القراءة/الكتابة. **لا إعادة كتابة.**

---

## خارطة الطريق (مرتبة — MVP أولاً)

### P0 — أساس التطبيق الحقيقي (الحرج: يحسم الثغرات 1-3)

| # | المهمة | التفصيل |
|---|---|---|
| **P0.1** | خطة Supabase العلائقية | إنشاء جداول من `INITIAL` (انظر §DB). الـ store الحالي علائقي أصلاً بمعرّفات → ترحيل جداول مباشر |
| **P0.2** | ربط `save()`/`loadStore()` | استبدال `localStorage.setItem('rtc_v2')` ← upsert Supabase؛ الهجرة تقرأ JSON. **لا طبقة repository ضخمة** — نبقي `store` ككائن ونستخدم `save()` كـ upsert |
| **P0.3** | Auth حقيقي (SMS OTP) | Supabase Auth Phone. استبدال `_otp*` + **إزالة `quickLogin`** + `rtc_role_v2` ← جلسة + `app_metadata.role`. `onAuthStateChange` |
| **P0.4** | RLS | policies لكل جدول. student→بياناته، volunteer→دفعاته، admin→كامل |
| **P0.5** | الأدوار + موافقة + دور `pending` | التسجيل الذاتي يبقى `pending` حتى يوافق الأدمن |
| **P0.6** | ترحيل البيانات old→new | قراءة `localStorage['rtc_v2']` → إدراج في Supabase (دفعة واحدة مع تجاهل صحيح) |

### P1 — إصلاحات الأمان المؤجلة + أغلفة الحلقة

| # | المهمة |
|---|---|
| **P1.1** | تسكير `icon`/`color` (XSS #6) — كل `n.icon`/`a.color`/`x.icon` تمر بـ `safeIcon`/`safeColor` |
| **P1.2** | الشهادات الحقيقية (#4) — `qrcode` lib + serial فريد + دالة PG `verify_cert(serial)` عامة (يحتاج قرار: تحقق عام/خاص) |
| **P1.3** | إصلاحات CRUD الحقيقية — `editUser` يعدّل فعلاً، إنجاز Delete مع confirm، "حفظ القواعد" يكتب فعلاً |
| **P1.4** | أغلفة وظيفية — ربط التسجيل بـ `enrolled`، تصدير PDF حقيقي، `simulateBackup` → تصدير JSON حقيقي |
| **P1.5** | إنشاء محاضرة + ملف طالب للمتطوع (شاشة standalone يستبدل toast-only) |

### P2 — التعريب (تثنية كاملة) + بصري

| # | المهمة |
|---|---|
| **P2.1** | `locales/ar.json` + `en.json` + دالة `t(key)` — استنباط كل ~12k محرف عربي |
| **P2.2** | تبديل RTL/LTR حقيقي (`document.documentElement.dir`) + حفظ التفضيل في `profiles.lang` |
| **P2.3** | نص Skeleton/Empty/Error + Toast باللغتين |
| **P2.4** | حذف سطر "اللغة=عربي" الميت + توجيه الأسماء المزدوجة (`title_ar`/`title_en`) |
| **P2.5** | إصلاح `overflow-wrap` + 2-line clamp للأسماء العربية الطويلة |

---

## تصميم قاعدة البيانات Supabase (§DB)

```
profiles   (id uuid PK → auth.users, role, full_name, phone, lang, status)
courses    (id, title, title_ar, title_en, cat, icon, color, sessions, maxStudents)
batches    (id, course_id FK, name, instructor_id FK, schedule, location, lecturesDone)
enrollments(id, batch_id FK, student_id FK, joined_at)          -- UNIQUE(batch_id, student_id)
sessions   (id, batch_id FK, title, date, created_by)
attendance (id, session_id FK, student_id FK, status, note)     -- UNIQUE(session_id, student_id)
points_ledger (id, student_id FK, rule_id FK, amount ±, reason, by_id FK, created_at)
points_rules  (id, code, title, amount)   ← مصدر الحقيقة للقيم (بدل hardcoded في app.js)
badges / student_badges / certs(serial UNIQUE) / notifications / audit_log
branches / excuses / private_notes(student_id, author_id, body)
```

**نقطة حسم:** `pointsRules` يتوقف عن أن يكون عرضًا — **تنتقل قيم النقاط إلى جدول `points_rules`**، ويقرأ `saveAttendance` القيمة من DB بدل `10/3` hardcoded.

---

## الملفات الحرجة للتعديل

- `index.html` — إزالة أزرار `quickLogin` (619-630)، توليد CSP محلي، سطر "اللغة=عربي" الميت
- `app.js` — `save()` (194) + `loadStore` (184) ← async Supabase؛ إزالة `_otp*` (23-27) و`quickLogin` (2127)؛ `currentStudent` (576) ← `auth.user()`؛ إصلاحات P1؛ ربط النقاط (2469)
- `sw.js` — `fetch('/api/attendance')` (104) ← ربط Supabase أو إزالة
- **جديد:** `locales/ar.json`, `locales/en.json`, ملف ربط Supabase (config + دالة `t()`)

**أعيد استخدامها (لا إعادة كتابة):** `escapeHtml` (12-21), `safeColor`/`safeIcon` (496-503), `emptyState` (525), `showSkeleton` (640), `setBtnLoading` (536), `normalizeStore` (199), الراوتر `_doRender` (666), `HAPTIC`.

---

## التحقق (نهاية-ل-نهاية)

**Prep (بدون تنفيذ الآن):**
1. `npm run dev` → `http://localhost:5173` — تحقق أن التطبيق يعمل قبل أي تغيير (baseline).

**بعد P0:**
2. إنشاء مشروع Supabase + `supabase init` + تشغيل SQL الترحيل.
3. تشغيل محليًا — تسجيل دخول OTP فعلي (SMS) يتم، **لا `quickLogin`**.
4. محاولة فتح شاشة أدمن كطالب → **تُرفض** (RLS + route guard).
5. تحرير `localStorage.rtc_role_v2='admin'` يدويًا → **لا أثر** (الهوية من `auth.user()`).

**بعد P1:**
6. إضافة مستخدم كـ `volunteer`/`admin` دعوة يعمل؛ المستخدم الجديد `pending` لا يدخل حتى موافقة.
7. تسجيل حضور → نقطة في `points_ledger`، اللوحة تحدث (مشتق)، وUNIQUE يمنع الدبل.

**بعد P2:**
8. تبديل اللغة → كل النصوص/Skeleton/Toast تُبدّل، `dir` يقلب، التفضيل يُحفظ.

---

## ملاحظات ponytail (تخفيضات متعمدة)

- **لا طبقة repository ضخمة** — نستبدل `save()`/`loadStore()` فقط، نبقي `store` كائن حي. `(ponytail: يعمل بينما حجم store ≤ عدة MB وقراءة once-at-boot؛ عند تجاوز 1000+ مستخدم أضِف per-record upsert.)`
- **`save()` كامل في كل تعديل** — نبقي أنماط الـ eager write الحالية. `(ponytail: getters على مستوى الصف متاحون لاحقًا؛ لا يهم في MVP.)`
- **RTL/LTR مبسط** — `t(key)` + rotate `dir`، دون معرّض لغوي نختبره.

---

## خارج النطاق (مؤجل لما بعد الإطلاق)

- Push Notifications حقيقية (FCM) — مؤجل
- Multi-tenancy للفروع / أدوار فرعية (Super Admin / Branch Manager)
- تقارير تحليلية متقدمة (Cohort / Retention / Funnel)
- WhatsApp Business API حقيقي
- TypeScript تدريجي / اختبارات / CI أوتوماتي