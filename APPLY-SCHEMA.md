# تطبيق قاعدة بيانات مسار RTC v100

## 1) مشروع Supabase جديد

من **SQL Editor** شغّل الملف الكامل:

```text
supabase_schema.sql
```

الملف idempotent قدر الإمكان ويحتوي الجداول، العلاقات، RLS، RPCs، Storage، بيانات البداية وتحسينات v100.

## 2) مشروع v9/v10 قائم

بعد التأكد أن migration الإنتاج السابقة مطبقة، شغّل:

```text
supabase/migrations/20260813190000_v100_platform.sql
```

Migration v100 تدمج إصلاح `ensure_my_profile` و`batch_seat_counts`، لذلك لا تحتاج تشغيل ملفات الإصلاح المنفصلة على مشروع محدث. خذ نسخة احتياطية واختبر في Staging أولًا.

### أهم تغييرات v100

- أعمدة مصدر/حالة مراجعة بيانات الفروع.
- مواعيد منظمة وحقول Online/Offline للمجموعات.
- `get_my_profile()` و`admin_list_profiles()` لمنع كشف PII عبر SELECT مباشر.
- تضييق RLS للمتطوع إلى طلاب ومجموعات إشرافه فقط.
- نتيجة شهادة عامة باسم مقنّع، وأرقام جديدة بعشوائية 128-bit.
- `push_devices` و`register_push_device()` بدون منح العميل قراءة الرموز.
- حدود MIME والحجم مفروضة في Storage، لا في الواجهة فقط.

## 3) Google OAuth + PKCE

### Supabase → Authentication → URL Configuration

**Site URL**

```text
https://shaker15s.github.io/RTC-app/
```

**Redirect URLs**

```text
https://shaker15s.github.io/RTC-app/
org.resala.rtc.masar://auth
```

أضف رابط localhost أو بيئة Staging إلى Redirect URLs وقت الاختبار فقط، ولا تغيّر Site URL إلى رابط معاينة مؤقت.

### Google Cloud Console

Authorized redirect URI الخاص بمشروع Supabase:

```text
https://jwhedqmszbdougsqqmhv.supabase.co/auth/v1/callback
```

التطبيق يستخدم Authorization Code + PKCE. على Android/iOS يفتح Google داخل متصفح النظام ثم يرجع عبر Deep Link؛ لا تمر Access Tokens داخل الرابط.

## 4) التحقق بعد التطبيق

نفّذ السيناريوهات التالية بحسابات اختبار منفصلة:

1. طالب جديد → صف Profile تلقائي ودور `student`.
2. تعديل الهاتف والفرع → يعمل، ومحاولة تعديل `role`/`points` مباشرة تفشل.
3. متطوع → يرى Roster مجموعته فقط، ولا يقرأ هاتفًا كاملًا أو مجموعة متطوع آخر.
4. طالب ينضم → عداد المقاعد يتغير بدون كشف قائمة الطلاب.
5. حضور → Ledger يتحدث مرة واحدة مع منع التكرار.
6. شهادة → Serial جديد بطول قوي، و`verify.html` يعرض اسمًا مقنّعًا.
7. Admin → قائمة المستخدمين الكاملة تعمل عبر RPC فقط.
8. رفع عذر بصيغة غير PDF/JPG/PNG/WEBP أو أكبر من 4MB → يرفضه Storage.

## 5) إعداد Push بعد قاعدة البيانات

`register_push_device` يجمع رمز الجهاز بعد موافقة المستخدم. الإرسال نفسه يجب أن يتم من Supabase Edge Function أو خادم موثوق بمفتاح FCM/APNs؛ لا ترسل من المتصفح ولا تضع Service Account في المشروع.

راجع [`docs/STORE-AND-NATIVE.md`](docs/STORE-AND-NATIVE.md) لملفات Firebase وApple capabilities.
