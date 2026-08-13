#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   مسار RTC v10 — ترقيع المشاريع الأصلية بعد `npx cap add`
   يضيف deep link ل org.resala.rtc.masar://auth على أندرويد و iOS
   ويضبط إعدادات صغيرة لا يولّدها Capacitor تلقائياً.
   الاستخدام: npm run cap:patch   (بعد cap add / cap sync)
   آمن للتشغيل أكثر من مرة (idempotent).
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCHEME = 'org.resala.rtc.masar';
const HOST = 'auth';

function log(ok, msg) { console.log(`  ${ok ? '✓' : '•'} ${msg}`); }

/* ── أندرويد: intent-filter داخل AndroidManifest.xml ── */
function patchAndroid() {
  const mf = path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(mf)) { log(false, 'أندرويد غير مضاف بعد (شغّل: npx cap add android)'); return; }

  let xml = fs.readFileSync(mf, 'utf8');
  if (xml.indexOf(`android:scheme="${SCHEME}"`) !== -1) { log(true, 'أندرويد: deep link موجود بالفعل'); return; }

  const filter =
`            <intent-filter android:autoVerify="false">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${SCHEME}" android:host="${HOST}" />
            </intent-filter>
`;

  // نحقنه بعد آخر intent-filter داخل الـ activity الرئيسي
  const marker = '</intent-filter>';
  const idx = xml.lastIndexOf(marker);
  if (idx === -1) { log(false, 'أندرويد: تعذر العثور على intent-filter — عدّل يدوياً'); return; }
  const at = idx + marker.length;
  xml = xml.slice(0, at) + '\n\n' + filter + xml.slice(at);
  fs.writeFileSync(mf, xml);
  log(true, `أندرويد: أضيف deep link ${SCHEME}://${HOST}`);
}

/* ── iOS: CFBundleURLTypes داخل Info.plist ── */
function patchIOS() {
  const plist = path.join(ROOT, 'ios', 'App', 'App', 'Info.plist');
  if (!fs.existsSync(plist)) { log(false, 'iOS غير مضاف بعد (شغّل: npx cap add ios)'); return; }

  let xml = fs.readFileSync(plist, 'utf8');
  if (xml.indexOf(SCHEME) !== -1) { log(true, 'iOS: deep link موجود بالفعل'); return; }

  const block =
`	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLName</key>
			<string>${SCHEME}</string>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>${SCHEME}</string>
			</array>
		</dict>
	</array>
`;
  const close = '</dict>\n</plist>';
  const idx = xml.lastIndexOf(close);
  if (idx === -1) { log(false, 'iOS: صيغة Info.plist غير متوقعة — عدّل يدوياً'); return; }
  xml = xml.slice(0, idx) + block + xml.slice(idx);
  fs.writeFileSync(plist, xml);
  log(true, `iOS: أضيف URL scheme ${SCHEME}`);
}

/* ── تذكير بمتطلبات المتجر ── */
function notes() {
  console.log(`
  ملاحظات مهمة:
   - في Supabase → Authentication → URL Configuration:
       Site URL:       https://shaker15s.github.io/RTC-app/
       Redirect URLs:  https://shaker15s.github.io/RTC-app/
                       ${SCHEME}://${HOST}
   - لا تضع روابط معاينة مؤقتة (e2b وغيرها) في Site URL.
   - التوكنات لا تُخزَّن يدوياً؛ مكتبة Supabase تديرها.
`);
}

console.log('\n▶ ترقيع المشاريع الأصلية (v10)\n');
patchAndroid();
patchIOS();
notes();
