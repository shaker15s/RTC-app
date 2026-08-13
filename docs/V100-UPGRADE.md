# ترقية مسار RTC إلى v100 — 100 تحسين منفّذ

هذه ليست «زيادة رقم إصدار»؛ القائمة التالية تلخص مائة تغيير فعلي في المصدر والبنية وتجربة الاستخدام.

## الهوية والتجربة البصرية

1. نظام ألوان أحدث بدرجات Navy/Teal/Gold متوافقة مع هوية RTC.
2. توحيد Design Tokens للسطح والنص والحدود والظلال.
3. خلفية تطبيق أهدأ وأكثر وضوحًا.
4. Illustration أصلية محلية لشاشة الترحيب.
5. Hero جديد يشرح رحلة التعلم إلى الأثر.
6. شريط ثقة يعرض سنة البداية ونموذج التطوع وعدد الفروع الرسمي.
7. شارة واضحة أن التعلم مجاني 100%.
8. تحسين Typography العربية وLine Height.
9. تحسين Dark Mode مع `color-scheme` أصلي.
10. دعم High Contrast عبر `prefers-contrast`.

## Onboarding والدخول

11. اختصار التسجيل إلى خطوتين واضحتين.
12. إزالة تعليمات Supabase التقنية من واجهة المستخدم الإنتاجية.
13. حصر Diagnostics في localhost/debug فقط.
14. توضيح أن كلمة مرور Google لا تُخزّن.
15. روابط الخصوصية والشروط و«عن RTC» قبل الدخول.
16. تحويل OAuth من Implicit إلى Authorization Code + PKCE.
17. فتح Google داخل System Browser على الموبايل.
18. تبادل `code` داخل WebView مع التحقق من PKCE verifier.
19. إغلاق متصفح OAuth بعد Deep Link.
20. معالجة خطأ OAuth برسالة مفهومة.

## الرئيسية والرحلة اليومية

21. شبكة إجراءات سريعة للاستكشاف والحضور والتنبيهات والدعم.
22. إزالة نص «جداول يوليو» الثابت.
23. ربط Social Banner بصفحة فرع المستخدم.
24. Sanitization لرابط صفحة الفرع قبل استخدامه.
25. إبقاء بطاقة المحاضرة القادمة مرتبطة ببيانات التسجيل.
26. جدولة Reminder محلي قبل المحاضرة المنظمة بساعة.
27. مسح QR للحضور بالكاميرا على Android وiPhone والويب مع تحقق من صيغة الرمز.
28. فتح PWA Shortcuts أو شاشة Push المستهدفة مباشرة.
29. مزامنة موضع Toast مع Bottom Navigation.
30. تحسين أحجام اللمس للأزرار والعناصر التفاعلية.

## الدعم والفروع والمحتوى

31. استبدال WhatsApp غير الصحيح للخط الساخن بزر اتصال `19450`.
32. إضافة الصفحة المركزية لـ RTC.
33. إضافة رابط النشاط الرسمي لجمعية رسالة.
34. دليل فروع ديناميكي داخل الدعم.
35. أزرار اتصال وفيسبوك واتجاهات لكل فرع عند توفرها.
36. دمج قاعدة البيانات مع Offline fallback محدود.
37. توضيح أن الموقع الرسمي يذكر 17 فرعًا دون اختلاق قائمة.
38. إضافة `data_status` لمراجعة بيانات الفرع.
39. إضافة `source_url` و`verified_at` للمصدر والتاريخ.
40. توثيق البحث والتعارضات في ملف مستقل.

## الوصول والحركة

41. Focus Ring واضح لكل التحكمات.
42. Skip Link إلى المحتوى.
43. `aria-live` للرسائل وحالات التحقق.
44. `role=alert` للأخطاء.
45. `aria-current` للتاب النشط.
46. `aria-expanded` للأسئلة الشائعة.
47. جعل الشاشات غير النشطة `inert` و`aria-hidden`.
48. Focus Trap داخل Bottom Sheets وConfirm dialogs.
49. إغلاق الحوار بزر Escape وإعادة التركيز لمصدره.
50. احترام `prefers-reduced-motion` بما فيه الخلفية المتحركة.

## Offline وPWA والأداء

51. Service Worker جديد باسم Cache v100.
52. فصل Navigation strategy عن Static asset strategy.
53. Cache-first مع Background refresh للأصول المحلية.
54. منع تخزين Supabase/Auth responses في Cache Storage.
55. تخزين محلي للبيانات العامة فقط: الفروع والكورسات.
56. Fallback آمن للبيانات العامة عند انقطاع الشبكة.
57. واجهة Install PWA داخل الدعم والحساب.
58. دورة Update تطلب موافقة المستخدم ثم `SKIP_WAITING`.
59. طلب Persistent Storage عندما يدعمه المتصفح.
60. Manifest جديد مع Shortcuts وDisplay Override وMetadata عربية.

## البناء وسلسلة التوريد

61. استخراج CSS من `index.html` إلى مصدر مستقل.
62. تثبيت Tailwind محليًا بدل Runtime CDN.
63. Purge/Minify CSS في Production build.
64. تثبيت Supabase JS محليًا وبنسخة محددة.
65. تثبيت jsPDF محليًا وتحديثه لإصدار أُصلحت فيه الثغرات المعروفة.
66. Bundle محلي لمكتبة QRCode عبر esbuild.
67. تثبيت خطوط IBM Plex Arabic وInter محليًا.
68. تثبيت Phosphor Icons محليًا.
69. تقليل حزمة الأيقونات إلى WOFF2 بدل أصول TTF/SVG القديمة.
70. Build validator يمنع عودة Runtime library CDN.

## Android وiOS

71. إضافة مشروع Android كامل إلى المصدر.
72. إضافة مشروع iOS كامل إلى المصدر.
73. توحيد App ID إلى `org.resala.rtc.masar`.
74. توحيد النسخة إلى `100.0.0 (10000)`.
75. إضافة Native Browser plugin لـ OAuth.
76. إضافة Keyboard plugin وإعداد Resize.
77. إضافة Push Notifications plugin وربط token بالـRPC.
78. إضافة Local Notifications لتذكيرات المحاضرات.
79. إعداد Deep Link للمنصتين.
80. توليد أيقونات أصلية للـPWA وAndroid وApp Store.

## Native hardening

81. منع Cleartext Traffic في Android Manifest.
82. Network Security Config يثق بشهادات النظام فقط.
83. تعطيل Android backup وdevice transfer لبيانات التطبيق.
84. تفعيل R8 وResource Shrinking في Release.
85. تعطيل WebView debugging في الإنتاج.
86. إضافة iOS ATS مع منع Arbitrary Loads.
87. إضافة iOS Push entitlement.
88. إضافة Remote Notification background mode.
89. تخزين جلسة Native مشفّرة في iOS Keychain وAndroid Keystore مع ترحيل الجلسات القديمة.
90. سكربت Native patch idempotent بعد كل `cap sync` مع إبقاء مفاتيح التوقيع خارج Git.

## البيانات والخصوصية والأمان

91. `get_my_profile()` يعيد PII لصاحب الحساب فقط.
92. `admin_list_profiles()` يحصر القائمة الكاملة في المشرف.
93. إلغاء SELECT العام لأعمدة الهاتف والبريد في Profiles.
94. تضييق RLS للمتطوع إلى مجموعاته وطلابها فقط.
95. تقييد Badges/Ledger/Certs/Excuses/Reports/Notes حسب العلاقة.
96. أرقام شهادات جديدة بعشوائية 128-bit.
97. إظهار اسم مقنّع في التحقق العام من الشهادة.
98. فرض MIME والحجم لملفات الصور والأعذار داخل Storage.
99. جدول Push Devices بلا صلاحية قراءة للعميل وRPC تسجيل محدود.
100. تحديث سياسة الخصوصية والشروط واختبارات الأمان ووثائق الإطلاق.
