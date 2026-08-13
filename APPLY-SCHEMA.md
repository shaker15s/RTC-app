# تطبيق السكيمة + دخول Google (v10)

## أ) SQL — شغّل بالترتيب

من Supabase → **SQL Editor** → New query → Run، واحد ورا التاني:

1. `supabase/FIX-verify-then-rerun.sql`
2. `supabase/migrations/20260813120000_production_v9.sql`
3. `supabase/FIX-v10-seats.sql` — دالة `batch_seat_counts` (عدّاد المقاعد `12/30` بدون أي بيانات شخصية)
4. `supabase/FIX-relations-and-roles.sql` — العلاقات (FKs) + طلبات ترقية الدور + «مشرف يعيّن مشرف»
5. `supabase/FIX-ensure-my-profile.sql` — **إصلاح شاشة «حفظ وبدء الاستخدام» العالقة (v10.0.2)**: دالة `ensure_my_profile` + تعبئة أي صف ناقص في `profiles` لحسابات اتسجّلت قبل تفعيل الـ trigger

> **ملاحظة v10:** ملف الميجريشن الكبير كان بيفشل لو سياسة `avatars_update` موجودة من تشغيلة سابقة.
> اتصلّح دلوقتي بإضافة `DROP POLICY IF EXISTS avatars_update` قبل الإنشاء، فالملف بقى آمن للتشغيل أكتر من مرة.

الملفات ٣ و٤ و٥ كمان idempotent — تقدر تعيد تشغيلها من غير قلق.

> **عرَض «حفظ… ومش بيدخل» (v10.0.2):** لو مستخدم بيضغط «حفظ وبدء الاستخدام» والزر بيرجع من غير ما يفتح،
> كان السبب غالباً رقم موبايل مكرر (عمود `phone` UNIQUE) أو صف ناقص في `profiles`.
> بعد خطوة ٥ + نشر الواجهة الجديدة، الصف الناقص بيتعمل ذاتياً ورسالة واضحة بتظهر لو الرقم مكرر.

---

## ب) روابط الدخول (Google OAuth)

التطبيق المنشور على:

```
https://shaker15s.github.io/RTC-app/
```

Supabase → **Authentication** → **URL Configuration**:

- **Site URL**
  ```
  https://shaker15s.github.io/RTC-app/
  ```
- **Redirect URLs** — أضف الاتنين:
  ```
  https://shaker15s.github.io/RTC-app/
  org.resala.rtc.masar://auth
  ```

قواعد مهمة:

- **متحطّش** روابط معاينة مؤقتة (`*.e2b.app`) ولا `localhost` في **Site URL**. دي روابط بتموت مع الساندبوكس،
  ولما Google يرجّع عليها بعد ما تقفل هتشوف `Sandbox Not Found`. لو محتاج تجرب محلياً، ضيف الرابط
  في **Redirect URLs** بس وسيب Site URL على رابط Pages.
- السطر `org.resala.rtc.masar://auth` هو اللي بيخلّي الدخول يرجّع جوّه التطبيق الأصلي (أندرويد/iOS).
- التطبيق **مش** بيخزّن توكنات OAuth بنفسه؛ مكتبة Supabase هي اللي بتتولى الجلسة.

في Google Cloud Console → OAuth client، تأكد إن الـ redirect URI بتاع Supabase موجود:

```
https://jwhedqmszbdougsqqmhv.supabase.co/auth/v1/callback
```

---

## ج) الأدوار والمشرف

- كل حساب جديد = **طالب** افتراضياً.
- المشرف الوحيد اللي بيتثبّت من SQL: `shakerabdallah66@gmail.com`.
  أول ما يسجّل دخول يبقى `admin` تلقائياً، ومحدش يقدر يعطّله أو ينزّل صلاحيته.
- **الواجهة عمرها ما بتعيّن أدمن.** زرار الدور في لوحة الإدارة بيبدّل بين طالب ومتطوع بس.
- لو محتاج مشرف إضافي: المشرف الحالي يستخدم RPC `grant_admin(user_id)`
  (موجود في `FIX-relations-and-roles.sql`)، وحارس `protect_founder` بيمنع أي كتابة مباشرة لدور `admin`.
- الطالب يقدر يطلب ترقية لمتطوع عبر `request_role_upgrade(reason)`، والمشرف يراجع بـ `review_role_request(id, approve, note)`.

---

## د) بعد النشر

النشر بيحصل تلقائياً من GitHub Actions عند أي push على `main`.
بعد أي إصدار جديد امسح كاش المتصفح أو اعمل Hard Reload، لأن الـ Service Worker
بيتحدّث لنسخة جديدة (`rtc-v10.0.0`).

للبناء الأصلي (Android / iOS) راجع `docs/STORE-AND-NATIVE.md`.
