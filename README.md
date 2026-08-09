# مسار RTC — نظام متابعة مستفيدي الكورسات المجانية

> تطبيق موبايل عربي متكامل (PWA + Native-ready) لإدارة ومتابعة المستفيدين في جمعية رسالة — من التسجيل، عبر الحضور والنقاط، وصولاً إلى الشهادة المعتمدة.

---

## ✨ المميزات

- **3 أدوار بواجهات منفصلة** — طالب 🎓 / متطوع 🤝 / مشرف ⚙️ مع حماية مسارات (Route Guards)
- **نظام حضور ذكي** — حاضر/غائب/متأخر، زر "الكل حاضر"، عداد حي، نقاط تُحتسب تلقائياً
- **تحفيز مدمج** — نقاط، شرائح إنجاز، سلسلة حضور، لوحة صدارة، مستويات
- **شهادات معتمدة** — إصدار تلقائي عند 75%+ حضور، رقم توثيق، QR، تنزيل/مشاركة
- **لوحة تحكم إدارية** — KPIs حية، رسم بياني، إدارة مستخدمين/كورسات/فروع، سجل عمليات
- **Offline-first** — يعمل بالكامل بدون إنترنت عبر Service Worker
- **عربي أصيل (RTL)** + **وضع ليلي (Dark OLED)**
- **تصدير Excel/CSV** حقيقي + جاهزية PDF

## 🛠️ التقنيات

| الطبقة | التقنية |
|--------|---------|
| الواجهة | Vanilla JS + TailwindCSS + Material 3 (Design System "Academic Core") |
| الأيقونات | Material Symbols Rounded |
| التخزين | localStorage (Prototype) — جاهز للترحيل إلى Supabase |
| PWA | Service Worker + Manifest (Cache-first, Background Sync, Web Push) |
| الموبايل | Capacitor 6 (Android + iOS) |

## 🚀 التشغيل المحلي

```bash
npm install
npm run dev
# افتح http://localhost:5173
```

**دخول سريع للتجربة:** أزرار Quick Login في شاشة الدخول (طالب/متطوع/أدمن).

## 📱 بناء تطبيق الموبايل

```bash
# المتطلبات: Node 18+، Android Studio أو Xcode
npm install
npx cap add android     # أو: npx cap add ios
npm run build:android   # أو: npm run build:ios
```

## 📂 بنية المشروع

```
RTC-app/
├── index.html           # SPA Shell: كل الشاشات + نظام التصميم + CSP
├── app.js               # المحرك: Router + Store + Renderers + Handlers + أمان
├── sw.js                # Service Worker (Offline + Push + Background Sync)
├── manifest.json        # PWA Manifest
├── capacitor.config.json # إعدادات Android/iOS
├── generate-icons.js    # مولّد الأيقونات (Android/iOS/PWA)
├── package.json         # الاعتماديات وأوامر البناء
├── task.md              # سجل المهام والتحقق
└── .gitignore           # استثناءات الرفع
```

## 🔐 الأمان

- **حماية المسارات**: كل مسار يتحقق من الدور — الطالب لا يصل لشاشات الأدمن حتى بكتابة URL
- **Content Security Policy**: Meta CSP يحصر المصادر المسموح بها
- **إخفاء البيانات الحساسة**: أرقام الموبايل تُعرض مقنّعة في واجهة الإدارة
- **تحقق OTP**: قفل تلقائي بعد 3 محاولات فاشلة
- **التحقق من المدخلات**: Regex لأرقام الموبايل المصرية، وأنماط أسماء، وفحص التكرار

> **ملاحظة**: هذا Prototype يعمل محلياً بـ `localStorage`. النقل للإنتاج يتطلب ربط قاعدة بيانات (مثل Supabase) — انظر خطة النقل داخل المشروع.

## 📄 الترخيص

**GNU General Public License v3.0** — مفتوح المصدر لجمعيات التدريب غير الربحية.

---

*مبني بحب لخدمة العمل الخيري 🤍 — جمعية رسالة*
