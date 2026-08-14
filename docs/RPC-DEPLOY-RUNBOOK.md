# تطبيق إصلاح الـ RPC على قاعدة البيانات الحية

هذه الخطوات لم تُنفَّذ من هذه البيئة: Supabase CLI غير مثبّت، ولا يوجد
`linked project`، والوصول الشبكي إلى `*.supabase.co` محجوب هنا.
لذلك **لم يتم تعديل قاعدة البيانات الحية**، ولا يصح ادّعاء أنها أُصلحت
قبل تنفيذ الخطوة 4 والحصول على نتيجة خضراء.

## 1. تأكّد من المشروع المرتبط قبل أي شيء

```bash
supabase projects list      # أيّها الصحيح؟
supabase link --project-ref <REF>
supabase status             # تأكيد الربط
```

راجع أن الـ `REF` يطابق `supabaseUrl` في `js/config.js`
(`https://<REF>.supabase.co`). لا تكمل إذا اختلفا.

## 2. راجع الفرق قبل الدفع (بدون تنفيذ)

```bash
supabase db diff --linked --schema public
```

## 3. ادفع الـ migrations

```bash
supabase db push
```

الـ migration الجديدة `20260814120000_rpc_contract_guard.sql`:

- **لا** تُنشئ دوال وهمية. إذا كانت دالة متعاقد عليها غائبة فعلًا فهي
  تتوقف بـ `RAISE EXCEPTION` وتطلب تطبيق الـ migrations الأقدم.
- **لا** تحذف أو تعدّل أي بيانات (`DROP TABLE` / `TRUNCATE` / `DELETE` غير
  موجودة فيها إطلاقًا).
- تحذف فقط **تعريفات الدوال المخالفة للعقد** (overloads قديمة أو توقيعات
  منحرفة) — وهي سبب رسالة `not in schema cache` نفسها.
- قابلة لإعادة التشغيل (idempotent) — تم التحقق بتطبيقها مرتين متتاليتين.

> لا تحتاج `service_role key` في أي خطوة.

## 4. تحقّق فعليًا (إلزامي)

```bash
npm run db:verify
```

يستدعي كل دالة في العقد عبر REST بمفتاح `anon` العام فقط، بمعاملات غير
صالحة عمدًا حتى لا تُكتب أي بيانات. الخروج بـ `0` فقط عندما تكون كل دالة
موجودة. لا تعتبر الإصلاح ناجحًا قبل ذلك:

- خروج `1` = دوال ما زالت مفقودة.
- خروج `2` = لم يكتمل الفحص (شبكة/URL) — **ليست نجاحًا**.

## 5. لو بقيت رسالة `schema cache`

PostgREST يخدم من ذاكرة مؤقتة. الـ migration تنتهي بـ
`NOTIFY pgrst, 'reload schema';`، ويمكن تكرارها يدويًا:

```sql
NOTIFY pgrst, 'reload schema';
```

أو من لوحة التحكم: Settings → API → Restart server.

## ما الذي يمنع تكرار المشكلة

`npm test` يشغّل `tests/test-rpc-contract.js` الذي يفشل البناء إذا:

- استدعى التطبيق دالة غير موجودة في `supabase/migrations`،
- أُرسل معامل باسم لا يطابق التوقيع،
- ظهرت overload غامضة،
- مُنحت صلاحية `EXECUTE` لـ `PUBLIC`،
- أو أُضيفت migration تعدّل RPC بدون `NOTIFY pgrst`.
