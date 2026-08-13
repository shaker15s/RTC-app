# مسار RTC — البناء الأصلي والنشر على المتاجر (v10)

الويب والموبايل بيشتغلوا من **نفس الكود**. Capacitor بيغلّف مجلد `dist/` في تطبيق أصلي.

- التطبيق على الويب: `https://shaker15s.github.io/RTC-app/`
- معرّف التطبيق: `org.resala.rtc.masar`
- رابط الدخول العميق: `org.resala.rtc.masar://auth`

---

## ١) المتطلبات

| الأداة | الإصدار |
|---|---|
| Node.js | 20 أو أحدث |
| Java JDK | 21 (لأندرويد) |
| Android Studio | Ladybug أو أحدث |
| Xcode | 16 أو أحدث (لـ iOS، على macOS فقط) |
| CocoaPods | `sudo gem install cocoapods` |

```bash
npm install
```

---

## ٢) البناء (الويب)

```bash
npm run build       # ينسخ الملفات المطلوبة إلى dist/
npm run serve:dist  # يشغّل dist/ محلياً للتجربة
```

`scripts/build.js` بينسخ: `index.html`, `app.js`, `sw.js`, `manifest.json`,
`verify.html`, `privacy.html`, `terms.html`, الشعار، الأيقونات (192/512 + maskable + apple-touch)،
ومجلدات `js/` و`icons/` و`assets/` لو موجودة، وبيضيف `.nojekyll` و`build-info.json`.

> `dist/` متجاهَل في Git — مبيتعملوش commit.

---

## ٣) الأيقونات

```bash
npm install sharp --no-save
node generate-icons.js
```

المصدر هو `rtc_app_logo.png` (١٠٢٤×١٠٢٤) — **مش حرف "R"**. بيتولّد:

- `icon-192.png` / `icon-512.png` — شفافة (purpose `any`)
- `icon-maskable-192.png` / `icon-maskable-512.png` — خلفية `#00288e` مع منطقة آمنة ٧٨٪
- `apple-touch-icon.png` — خلفية معتمة (iOS مبيقبلش شفافية)
- `store-assets/play-icon-512.png` — أيقونة Google Play
- `store-assets/appstore-icon-1024.png` — أيقونة App Store
- لو مجلد `android/` أو `ios/` موجود، بيتحدّثوا كمان (mipmap + AppIcon.appiconset)

شغّل السكربت **بعد** `npx cap add` عشان أيقونات المنصّات تتولّد.

---

## ٤) إضافة المنصّات

```bash
npm run build
npx cap add android
npx cap add ios          # macOS فقط
npm run cap:patch        # يضيف الـ deep links
node generate-icons.js   # يملأ أيقونات المنصّتين
npx cap sync
```

`scripts/patch-native.js` idempotent — بيضيف:

- **أندرويد:** `intent-filter` لـ `org.resala.rtc.masar://auth` في `AndroidManifest.xml`
- **iOS:** `CFBundleURLTypes` في `Info.plist`

بعد أي تعديل على الويب:

```bash
npm run cap:sync    # build + npx cap sync
```

---

## ٥) تشغيل وتجربة

```bash
npx cap open android    # ثم Run من Android Studio
npx cap open ios        # ثم Run من Xcode
```

اختبر الدخول العميق:

```bash
adb shell am start -W -a android.intent.action.VIEW -d "org.resala.rtc.masar://auth" org.resala.rtc.masar
```

---

## ٦) إصدار Google Play

1. Android Studio → **Build** → **Generate Signed App Bundle** → `.aab`
2. مفتاح التوقيع: احفظه في مكان آمن — لو ضاع مش هتقدر تحدّث التطبيق.
3. في `android/app/build.gradle` ارفع `versionCode` و`versionName` مع كل إصدار.
4. Play Console → Create app → ارفع الـ `.aab` على Internal testing الأول.

**الأصول المطلوبة:**

| العنصر | المقاس |
|---|---|
| أيقونة | 512×512 (`store-assets/play-icon-512.png`) |
| صورة الغلاف | 1024×500 |
| لقطات الهاتف | ٢ على الأقل، ١٦:٩ أو ٩:١٦ |
| وصف قصير | ٨٠ حرف |
| وصف كامل | ٤٠٠٠ حرف |
| سياسة الخصوصية | `https://shaker15s.github.io/RTC-app/privacy.html` |

في **Data safety** صرّح بـ: الاسم، البريد، صورة الحساب، بيانات الحضور — كلها مستخدمة لتشغيل الخدمة، مشفّرة في النقل، والمستخدم يقدر يطلب الحذف.

---

## ٧) إصدار App Store

1. Xcode → **Product** → **Archive** → Distribute App → App Store Connect
2. Bundle ID: `org.resala.rtc.masar` (سجّله في Apple Developer أولاً)
3. الأيقونة: `store-assets/appstore-icon-1024.png` (بدون شفافية وبدون زوايا مدوّرة)
4. لقطات: iPhone 6.7" و6.5" — ٣ على الأقل
5. **App Privacy**: نفس بنود Play.
6. Sign in with Google شغّال؛ لو ضفت أي تسجيل دخول اجتماعي تاني، Apple بتطلب **Sign in with Apple** كمان.

---

## ٨) قبل كل إصدار — تشيك ليست

- [ ] `npm run build` بينجح والملفات في `dist/`
- [ ] رقم الإصدار متطابق في `package.json` و`js/config.js` و`sw.js`
- [ ] Site URL في Supabase = `https://shaker15s.github.io/RTC-app/`
- [ ] `org.resala.rtc.masar://auth` موجود في Redirect URLs
- [ ] كل ملفات SQL اتشغّلت (شوف `APPLY-SCHEMA.md`)
- [ ] الدخول بـ Google شغّال على الويب وعلى الجهاز
- [ ] بانر «مفيش نت» بيظهر لما تقفل الشبكة
- [ ] زرار الرجوع في أندرويد بيرجّع شاشة بدل ما يقفل التطبيق
- [ ] شاشة البداية (Splash) بتختفي بعد أول شاشة حقيقية
