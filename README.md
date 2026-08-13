# مسار RTC v100

منصة موحّدة لمراكز رسالة للتدريب تعمل من قاعدة كود واحدة على **الويب وPWA وAndroid وiPhone/iPad**. تدير رحلة الطالب من اكتشاف الكورس والانضمام، إلى الحضور والنقاط والأعذار والشهادات الموثّقة، مع لوحات منفصلة للمتطوع والإدارة.

> خدمات RTC التدريبية مجانية وقائمة على المتطوعين. المرجع العام: [صفحة النشاط الرسمية لجمعية رسالة](https://resala.org/resala-training-centers). البيانات التشغيلية داخل التطبيق تُدار من قاعدة البيانات لأن المواعيد والفروع تتغير.

## ما الذي تغيّر في v100؟

- تجربة بصرية جديدة RTL، Onboarding مصوّر، إجراءات سريعة، دليل فروع ودعم قابل للتنفيذ.
- نفس الواجهة والميزات في Web/PWA وAndroid وiOS، مع مشاريع Native فعلية في `android/` و`ios/`.
- OAuth Google بنمط **PKCE** داخل متصفح النظام، وجلسة Native مشفّرة في iOS Keychain / Android Keystore، مع Deep Links وQR بالكاميرا وHaptics وإشعارات.
- أصول وخطوط ومكتبات محلية بالكامل؛ لا Tailwind أو Supabase أو jsPDF من CDN وقت التشغيل.
- Offline App Shell وتخزين مؤقت للبيانات العامة فقط، مع دورة تحديث آمنة للـ Service Worker.
- حدود PII أقوى: RPC خاص لملف المستخدم، قراءة أعمدة عامة محدودة، ونطاق المتطوع يقتصر على مجموعاته.
- أرقام شهادات 128-bit، ونتيجة التحقق العام تعرض اسمًا مقنّعًا.
- نموذج بيانات أحدث للمواعيد المنظمة، نمط الحضور، مصادر بيانات الفروع، وتسجيل أجهزة الإشعارات.
- تحسينات وصول: Focus واضح، حوارات محجوزة التركيز، `aria-live`، `inert` للشاشات غير النشطة، دعم Reduced Motion وHigh Contrast.
- Build إنتاجي محلي مع Tailwind purge، فحص سلامة، `npm audit` نظيف، وإصدارات موحّدة `100.0.0`.

التفاصيل في [`docs/V100-UPGRADE.md`](docs/V100-UPGRADE.md) وبحث RTC في [`docs/RTC-RESEARCH-2026-08-13.md`](docs/RTC-RESEARCH-2026-08-13.md).

## التشغيل

```bash
npm install
npm run dev
# http://localhost:5173
```

أوامر الجودة:

```bash
npm run build
npm test
npm run audit
```

## قاعدة البيانات

- مشروع جديد: شغّل [`supabase_schema.sql`](supabase_schema.sql) مرة واحدة.
- مشروع v9/v10 قائم: شغّل migration رقم `20260813190000_v100_platform.sql` بعد migration الإنتاج السابق.
- التعليمات الكاملة: [`APPLY-SCHEMA.md`](APPLY-SCHEMA.md).

قاعدة الأمان: العميل غير موثوق. الهوية من جلسة Supabase، والدور والحضور والنقاط والشهادات والعمليات الإدارية تُحسم في PostgreSQL/RLS/RPC، وليس في JavaScript.

## تطبيقات الموبايل

```bash
npm run cap:sync
npm run cap:open:android
npm run cap:open:ios       # يحتاج macOS + Xcode
```

- App ID: `org.resala.rtc.masar`
- OAuth callback: `org.resala.rtc.masar://auth`
- دليل البناء والمتاجر: [`docs/STORE-AND-NATIVE.md`](docs/STORE-AND-NATIVE.md)
- Firebase Android وiOS المجاني: [`docs/FIREBASE-AND-FREE-IOS.md`](docs/FIREBASE-AND-FREE-IOS.md)

مفاتيح التوقيع و`google-services.json` وملفات Apple provisioning **لا تدخل Git**.

## البنية

```text
index.html                 هيكل الشاشات
styles/app.css             Design system + Tailwind source
app.js                     Router + feature renderers
js/                        API, security, native, motion, PWA, i18n, UI
supabase_schema.sql        Fresh production schema
supabase/migrations/       Incremental cloud migrations
android/ + ios/            Native Capacitor projects
scripts/build.js           Deterministic production bundle
```

## الأدوار

| الدور | الصلاحية |
|---|---|
| طالب | كورساته، الحضور، النقاط، الأعذار، الشهادات والملف الشخصي |
| متطوع | مجموعاته وطلابها فقط، الحضور والتقارير والأعذار |
| مشرف | إدارة المستخدمين والكورسات والفروع والبث والتحليلات والتدقيق |

## الرخصة

GNU GPL v3 — انظر [`LICENSE`](LICENSE).
