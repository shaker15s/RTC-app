# مسار RTC v100 — Android وiPhone والمتاجر

الويب وPWA وتطبيقا Android/iOS يستخدمون نفس `dist/` ونفس Supabase. مشاريع المنصات موجودة ومتعقبة في Git؛ مخرجات البناء وملفات التوقيع فقط متجاهلة.

## المتطلبات

| الهدف | المتطلبات |
|---|---|
| Web/PWA | Node.js 20+ |
| Android | JDK 21، Android Studio حديث، Android SDK |
| iOS محلي | macOS، Xcode 16+، Apple ID مجاني (Personal Team) |
| iOS Store/APNs | عضوية Apple Developer Program مدفوعة |

```bash
npm install
npm run build
npm test
npm run audit
```

## مزامنة المنصات

```bash
npm run cap:sync       # build → cap sync → native hardening
npm run icons          # عند تغيير الشعار
```

`cap:patch` يطبّق تلقائيًا وبشكل idempotent:

- PKCE callback `org.resala.rtc.masar://auth` للمنصتين.
- منع HTTP الواضح ونسخ Android الاحتياطية.
- Network Security Config يعتمد شهادات النظام فقط.
- Release R8/shrinkResources ونسخة `100.0.0 (10000)`، وAndroid minSdk 26 لدعم ماسح QR.
- iOS ATS ووصف إذن الكاميرا وإصدار Xcode. الوضع الافتراضي يدعم Personal Team بدون entitlement محظور؛ فعّل APNs لاحقًا بأمر `RTC_IOS_PUSH=1 npm run cap:sync` بعد الاشتراك المدفوع.

## Google OAuth

في Supabase Redirect URLs:

```text
org.resala.rtc.masar://auth
```

التطبيق يفتح OAuth في متصفح النظام بـ Authorization Code + PKCE. اختبر الرجوع على Android:

```bash
adb shell am start -W -a android.intent.action.VIEW \
  -d "org.resala.rtc.masar://auth?code=test" org.resala.rtc.masar
```

الكود الوهمي سيفشل التبادل، لكن يجب أن يفتح التطبيق نفسه.

## Push Notifications

### Android

1. أنشئ تطبيق Android في Firebase بنفس App ID: `org.resala.rtc.masar`.
2. نزّل `google-services.json` إلى `android/app/` محليًا/CI؛ لا ترفعه إلى Git.
3. اربط FCM بخدمة الإرسال الموثوقة أو Supabase Edge Function.
4. اختبر منح الإذن على Android 13+، استقبال foreground/background، والضغط على التنبيه.

### iOS

**بحساب Apple ID مجاني:** اختَر Personal Team في Xcode وشغّل التطبيق على جهازك. Local Notifications وتذكيرات المحاضرات تعمل، لكن APNs وTestFlight وApp Store غير متاحة، والتوقيع المجاني يحتاج تجديدًا دوريًا. إعداد v100 الافتراضي متوافق مع هذا الوضع ولا يطلب APNs entitlement.

**بعد عضوية Apple المدفوعة:** شغّل `RTC_IOS_PUSH=1 npm run cap:sync`، ثم سجّل Bundle ID نفسه، فعّل Push Notifications وBackground Modes، وأنشئ APNs Key واربطه بمزوّد الإرسال. لا تضع مفتاح APNs في Git.

رموز Android FCM أو iOS APNs تُكتب عبر RPC `register_push_device` ولا يستطيع العميل قراءتها بعد التسجيل.

## Android release

```bash
npm run cap:sync
npm run cap:open:android
```

Android Studio → Build → Generate Signed App Bundle. استخدم Play App Signing وخزّن upload key في Secret Manager. لا تضع مسار المفتاح أو كلمة مروره في `build.gradle`.

قائمة Play Console:

- Internal testing قبل Production.
- Data Safety: الاسم، البريد، الهاتف، الصورة، نشاط التطبيق/الحضور، Device ID الخاص بالإشعار.
- Encryption in transit: نعم. Data deletion: عبر إدارة RTC.
- Privacy URL: `https://shaker15s.github.io/RTC-app/privacy.html`.
- Feature graphic: `store-assets/play-feature-1024x500.png`، Icon: `store-assets/play-icon-512.png`، ولقطتا هاتف على الأقل.
- اختبر RTL، الوضع الداكن، Offline banner، Back button وDeep Link.

> بيئة Arena الحالية لا تحتوي JDK/Android SDK، لذلك مصدر Android جاهز لكن إنتاج AAB موقّع يتم على جهاز/CI مجهز.

## iOS release (يتطلب عضوية Apple مدفوعة)

لا يمكن رفع App Store أو TestFlight باستخدام Personal Team المجاني. عند الاشتراك:

```bash
npm run cap:sync
npm run cap:open:ios
```

في Xcode:

1. اختر Team وProvisioning Profile.
2. راجع Bundle ID ونسخة `100.0.0 (10000)`.
3. فعّل Push Notifications للحساب الصحيح.
4. Product → Archive → Validate → App Store Connect.

App Store Privacy يجب أن يطابق سياسة الخصوصية والاستخدام الفعلي. تسجيل Google هو مسار الحساب الوحيد حاليًا؛ راجع سياسة Apple إذا أُضيفت مزوّدات اجتماعية أخرى.

## فحص الإصدار

- [ ] `npm run build && npm test && npm run audit` ناجح.
- [ ] migration v100 مطبق في Staging ثم Production.
- [ ] تسجيل الدخول يعمل على Web/Android/iOS.
- [ ] لا أسرار أو ملفات توقيع في `git status`.
- [ ] الأذونات مطلوبة وقت الحاجة، وليست عند أول فتح.
- [ ] الإشعار يفتح الشاشة الصحيحة.
- [ ] شهادة QR/Serial تتحقق واسم النتيجة مقنّع.
- [ ] فروع وروابط ومواعيد النشر راجعها مسؤول المحتوى.
- [ ] Crash/ANR وAuth errors تحت المراقبة خلال staged rollout.
