# تطبيق السكيمة + إصلاح دخول Google

## أ) خطأ SQL: `cannot change return type of existing function`

الدالة القديمة `verify_certificate` موجودة بشكل مختلف. اعمل بالترتيب:

1. في SQL Editor الصق وشغّل أولاً ملف:
   `supabase/FIX-verify-then-rerun.sql`
   (بيحل خطأ `verify_certificate` وعمود `notifications.read_at` الناقص)
2. بعد نجاحه، شغّل من جديد الملف الكامل:
   `supabase/migrations/20260813120000_production_v9.sql`

لو حابب تختصر: الملف الكامل الآن فيه `DROP FUNCTION` في أوله — يكفي تعيد تشغيله كاملاً بعد ما تضيف السطرين دول لو نسخت نسخة قديمة.

## ب) Google بيرجع على `localhost:3000` (مش التطبيق)

ده إعداد **Site URL** في مشروع Supabase، مش من كود الواجهة.

1. افتح [Supabase Dashboard](https://supabase.com/dashboard) → مشروعك → **Authentication** → **URL Configuration**.
2. غيّر **Site URL** إلى رابط المعاينة الحالي، مثلاً:
   `https://5173-iw7robcdzs7qk9o0gai7g.e2b.app`
3. في **Redirect URLs** أضف **كل** السطور دي (سطر لكل رابط):

```
https://5173-iw7robcdzs7qk9o0gai7g.e2b.app
https://5173-iw7robcdzs7qk9o0gai7g.e2b.app/
http://localhost:5173
http://localhost:5173/
http://127.0.0.1:5173
http://127.0.0.1:5173/
http://localhost:3000
http://localhost:3000/
```

4. احفظ. ارجع للتطبيق واضغط «تسجيل الدخول بـ Google» من **نفس تبويب المعاينة** (مش من ملف محلي).

من غير الخطوة دي، Google هيكمّل وSupabase هيرجعك على `localhost:3000` لأن ده الـ Site URL القديم — وده مش التطبيق.

## ج) حساب المشرف

بعد تطبيق SQL، ادخل بالإيميل `shakerabdallah66@gmail.com`. الـ trigger يثبّته `admin`. باقي الحسابات طلاب. المشرف يرقّي لمتطوع فقط.
