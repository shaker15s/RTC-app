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
