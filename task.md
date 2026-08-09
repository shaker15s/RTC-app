## مهام إعادة البناء الكامل

- [x] حذف styles.css القديم
- [x] كتابة index.html كتطبيق موبايل (Tailwind + Material Symbols)
- [x] كتابة app.js بالروتر والشاشات الكاملة
- [x] التحقق من التشغيل في المتصفح

## تحديث 2026-08-09 — التطبيق المتكامل

### 🔒 الأمان
- [x] حماية المسارات (Route Guards) — كل مسار يتحقق من الدور
- [x] منع الوصول المتقاطع (student → admin محظور)

### 📊 البيانات العلائقية
- [x] ربط الحضور بـ users.id (بدلاً من الأسماء)
- [x] تحديث النقاط تلقائياً عند حفظ الحضور
- [x] ترحيل البيانات القديمة (normalizeStore)

### 🖼️ حالات النظام
- [x] Empty States لكل القوائم
- [x] Skeleton Loaders (شيمر)
- [x] Validation & Error Handling ميداني
- [x] Haptic Feedback (navigator.vibrate)

### 📱 الشاشات الجديدة (9)
- [x] s-onboard — استكمال البيانات (فرع + مهارات)
- [x] s-excuse — طلب عذر غياب (رفع ملف)
- [x] v-report — تقرير المحاضرة (ملخص + تقييم + درجة)
- [x] v-edit-past — تعديل حضور سابق
- [x] a-branches — إدارة الفروع والقاعات
- [x] a-export — تصدير Excel/PDF
- [x] a-broadcast — تنبيهات جماعية
- [x] s-course-detail — تفاصيل ديناميكية من البيانات
- [x] badge-modal — تفاصيل الشارات والمهام المتبقية

### 🎨 التصميم
- [x] Dark Mode (OLED) مع toggle وحفظ التفضيل
- [x] عدّاد متصاعد للنقاط (count-up animation)
- [x] فلترة سجل الحضور (الكل/حاضر/غائب/متأخر)

### 📦 التغليف
- [x] Capacitor config (Android + iOS)
- [x] PWA Manifest + Service Worker + Offline
- [x] Web Push + Background Sync (sw.js)
- [x] README + أيقونات

### ✅ تحقق المتصفح (جميعها ناجحة)
- [x] Student home يظهر اسم الطالب + الكورسات + الشارات
- [x] Onboarding (5 فروع + 6 مهارات)
- [x] Badge modal (قفل + تقدم)
- [x] Route guard يمنع student→admin
- [x] Volunteer attendance (2/5 → 5/5 عند الكل حاضر)
- [x] Admin branches (2 فروع)
- [x] Dark mode toggle يعمل

## تحديث 2026-08-09 — التصليب الأمني (Security Hardening — من REPORT_AR.md)

### 🔴 P0 ثغرات حرجة
- [x] **CVE-001 (Stored XSS)** — `escapeHtml()` على 52 موضع + `NAME_RE` يرفض `<script>`/`<img>` في الأسماء عند الإدخال
- [x] **CVE-002 (Auth Bypass)** — `verifyOtp` الآن يولّد كوداً حقيقياً (6 أرقام)، **حُذف كود `123456` الرئيسي**، قفل بعد 3 محاولات، `validateStore` يرفض roles مفبركة
- [x] **QA-C7 (OTP ID mismatch)** — `verifyOtp` كان يقرأ `otp1-6` بينما المدخلات `o1-6` → أُصلح التطابق، التحقق يعمل فعلياً
- [x] **CVE-003 (CSP)** — Meta CSP يحصر المصادر المسموح بها
- [x] **CVE-004 (Data Tampering)** — `validateStore` المحسّن: HEX_RE للألوان، ICON_RE للأيقونات، isId لـ studentIds، statuses whitelist
- [x] **CVE-005 (Capacitor config)** — `capacitor.config.json` موجود بالاسم الصحيح
- [x] **CVE-006 (Phone exposure)** — أرقام موبايل مقنّعة في واجهة الإدارة

### 🟠 P1 وظيفي
- [x] **QA-C3/C4 (CRUD حقيقي)** — حذف (confirm modal) + تعديل للمستخدمين والكورسات والفروع
- [x] **QA-C2 (تواريخ حقيقية)** — `new Date()` بدل `2026-08-11` الثابتة
- [x] **QA-C6 (زرار الرجوع الفيزيائي)** — History API: pushState + popstate + `guard()` على الرجوع (يمنع logout-bypass)
- [x] **UX2 (Toast variants)** — success/error/warning/info مع أيقونات وألوان مميزة
- [x] **UX3 (CSV filename ديناميكي)** — batch.name + تاريخ اليوم

### 🔍 إصلاحات ما بعد التحقق (من Verifiers)
- [x] `popstate` يعيد تشغيل `guard()` و `renderScreen()` — لا stale DOM ولا كشف بعد logout
- [x] `deleteUser` ينظف orphaned refs (batches.studentIds, attendance, currentSession)
- [x] `deleteCourse` يخصم batches.courseId
- [x] `safeColor()`/`safeIcon()` — sanitizers لـ style/attribute contexts

### ✅ تحقق المتصفح النهائي (كلها نجحت)
- [x] `NAME_RE` يرفض `<img onerror>` عند الإدخال
- [x] الاسم العربي الصحيح يُضاف بنجاح
- [x] Confirm modal يفتح + حذف فعلي من store
- [x] Toast variants نشطة
- [x] History API + route guard يعملان

## تحديث 2026-08-09 — تصميم بصري + توجل بار فيزيائي

### معايير قبول (من معايير الجودة)
- [x] التوجل بار: فيزيائي، Spring Easing، Thumb داخل المسار دائماً، RTL منطقية
- [x] التوجل يتحرك 22px بين الحالتين دون خروج عن البوردر (تحقق في المتصفح)
- [x] ARIA: role="switch" + aria-checked + aria-label على كل التوجلات
- [x] Haptic feedback على التبديل
- [x] نظام أيقونات موحد: `.icon-tile` + حد أدنى لحجم اللمس
- [x] نصوص عربية آمنة: line-height 1.55 (بدون قص الحروف)، break-word
- [x] نظام مسافات (4/8/12/16/24 scale)
- [x] احترام prefers-reduced-motion
- [x] الوضع الليلي: switch يواكب تلقائياً (يُحدّث aria-checked)
- [x] تحقق المتصفح: الأدوار الثلاثة تصل لشاشاتها + dark toggle يعمل + thumb داخل المسار
