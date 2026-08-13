# تطبيق السكيمة + دخول Google

## أ) SQL — شغّل بالترتيب

1. `supabase/FIX-verify-then-rerun.sql`
2. `supabase/migrations/20260813120000_production_v9.sql`

## ب) ليه ظهر `Sandbox Not Found`؟

ده **مش** مشكلة Git ولا برانش. التغييرات مرفوعة على:

`https://github.com/shaker15s/RTC-app/tree/arena/019ffa07-rtc-app`

الرسالة دي من استضافة Arena/e2b: Google رجّع المتصفح على رابط معاينة **قديم** (`…iw7robcdzs7qk9o0gai7g…`) بعد ما الساندبوكس اتقفل.

روابط `*.e2b.app` مؤقتة. متخلّيهاش Site URL دائم في Supabase.

### اعمل كده الآن

1. افتح التطبيق من المكان اللي هتستخدمه فعلاً:
   - تشغيل محلي: `http://localhost:5173`
   - أو أي استضافة ثابتة عندك
2. انسخ الرابط من **شريط عنوان المتصفح** (نفس التبويب اللي فيه التطبيق).
3. Supabase → **Authentication** → **URL Configuration**:
   - **Site URL** = الرابط ده (مثلاً `http://localhost:5173`)
   - **Redirect URLs** أضف:
     ```
     http://localhost:5173
     http://localhost:5173/
     http://127.0.0.1:5173
     http://127.0.0.1:5173/
     http://localhost:3000
     http://localhost:3000/
     ```
     ولو هتفتح من معاينة Arena، أضف رابط المعاينة **الحالي من شريط العنوان** (مش الرابط القديم).
4. احفظ، ارجع لنفس تبويب التطبيق، سجّل بـ Google من هناك.

على شاشة الدخول التطبيق بيعرض الرابط المطلوب نسخه لـ Redirect URLs.

## ج) المشرف

بعد SQL، دخول `shakerabdallah66@gmail.com` يثبّته أدمن. الباقي طلاب.
