#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let failures = 0;
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function check(name, value, detail) {
  if (value) console.log('  ✔ ' + name);
  else { failures += 1; console.error('  ✘ ' + name + (detail ? ' — ' + detail : '')); }
}
function noRuntimeCdn(html) {
  const tags = html.match(/<(script|link)\b[^>]+>/gi) || [];
  return tags.every((tag) => !/(src|href)=["']https?:\/\//i.test(tag));
}

console.log('\n[V100] Version + local supply chain:');
const pkg = JSON.parse(read('package.json'));
const config = read('js/config.js');
const index = read('index.html');
const sw = read('sw.js');
check('package version = 100.0.0', pkg.version === '100.0.0');
check('runtime config version matches', config.includes("version: '100.0.0'"));
check('service worker cache version matches', sw.includes("rtc-v100.0.0"));
check('index uses no runtime script/style CDN', noRuntimeCdn(index));
check('legal/verify pages use no runtime CDN', ['verify.html', 'privacy.html', 'terms.html'].every((f) => noRuntimeCdn(read(f))));
check('index has no executable inline script block', !/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(index));
check('CSP separates script elements from inline handlers', index.includes("script-src-elem 'self'") && index.includes("script-src-attr 'unsafe-inline'"));

console.log('\n[V100] OAuth + URL safety:');
const supa = read('js/supabaseClient.js');
const api = read('js/api.js');
const native = read('js/native.js');
check('Supabase auth uses PKCE', supa.includes("flowType: 'pkce'") && !supa.includes("flowType: 'implicit'"));
check('callback exchanges authorization code', api.includes('exchangeCodeForSession(code)'));
check('native OAuth opens system Browser', api.includes('RTCNative.openBrowser') && native.includes("plugin('Browser')"));
check('native callback accepts only the app scheme', native.includes("indexOf(APP_SCHEME) !== 0"));
check('native auth session uses secure storage adapter', supa.includes('RTCSecureStorage.SecureStorage') && supa.includes('secure.setItem'));

const secContext = { window: { location: { origin: 'https://app.example' } }, URL, navigator: {} };
secContext.window.window = secContext.window;
vm.runInNewContext(read('js/security.js'), secContext);
const safeUrl = secContext.window.RTCSec.safeUrl;
check('URL sanitizer permits HTTPS', safeUrl('https://www.facebook.com/RTCPage/').startsWith('https://'));
check('URL sanitizer rejects javascript:', safeUrl('javascript:alert(1)') === '');
check('URL sanitizer rejects embedded credentials', safeUrl('https://user:pass@example.com') === '');
check('URL sanitizer rejects remote cleartext HTTP', safeUrl('http://example.com/path') === '');
check('URL sanitizer permits valid tel:', safeUrl('tel:19450') === 'tel:19450');

console.log('\n[V100] Database privacy boundaries:');
const migration = read('supabase/migrations/20260813190000_v100_platform.sql');
const leaderboardRepair = read('supabase/migrations/20260814100000_repair_leaderboard_and_rtc_link.sql');
check('direct profile SELECT is revoked', migration.includes('REVOKE SELECT ON public.profiles FROM authenticated'));
check('safe profile columns are explicitly granted', migration.includes('GRANT SELECT (id, role, status, full_name, points'));
check('caller-bound profile RPC exists', migration.includes('FUNCTION public.get_my_profile()'));
check('admin-only profile RPC checks role', migration.includes('FUNCTION public.admin_list_profiles()') && migration.includes("IF NOT public.is_admin() THEN"));
check('volunteer scope helper joins owned batches', migration.includes('FUNCTION public.is_instructor_for_student') && migration.includes('b.instructor_id = auth.uid()'));
check('public cert output masks the student name', migration.includes('public.mask_name(p.full_name)'));
check('new certificate serial uses a full UUID', migration.includes("upper(replace(gen_random_uuid()::text, '-', ''))"));
check('push tokens have no client table grants', migration.includes('REVOKE ALL ON public.push_devices FROM anon, authenticated'));
check('sign-out can disable the user device registrations server-side', migration.includes('FUNCTION public.disable_my_push_devices()'));
const seatDrop = migration.indexOf('DROP FUNCTION IF EXISTS public.batch_seat_counts(UUID[])');
const seatCreate = migration.indexOf('CREATE FUNCTION public.batch_seat_counts', seatDrop);
check('seat-count RPC drops unknown legacy OUT signatures before recreation', seatDrop !== -1 && seatCreate > seatDrop);
check('seat-count RPC recreates the stable four-column contract', migration.includes('RETURNS TABLE (batch_id UUID, enrolled INT, capacity INT, seats_left INT)'));
check('upload MIME limits are server-enforced', migration.includes("allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/png','image/webp']"));
check('volunteer committees are reviewable content, not auth roles', migration.includes('CREATE TABLE IF NOT EXISTS public.volunteer_committees') && migration.includes("'secondary_source',false"));
check('private notes enforce instructor/student relationship', migration.includes("public.is_instructor_for_student(p_student_id)"));
check('excuse RPC verifies enrollment and owned upload path', migration.includes("لست مسجلًا في هذه المجموعة") && migration.includes("مسار الملف غير صالح"));
check('broadcast input is bounded and type-whitelisted', migration.includes('length(clean_message) NOT BETWEEN 2 AND 2000') && migration.includes("clean_type NOT IN"));
check('branch edits are admin RPCs with HTTPS validation and audit', migration.includes('FUNCTION public.update_branch_directory') && migration.includes("الروابط يجب أن تبدأ بـ https://") && migration.includes("write_audit('update_branch'"));
check('leaderboard repair installs the no-argument RPC expected by PostgREST', leaderboardRepair.includes('DROP FUNCTION IF EXISTS public.get_leaderboard()') && leaderboardRepair.includes('CREATE FUNCTION public.get_leaderboard()') && leaderboardRepair.includes("NOTIFY pgrst, 'reload schema'"));
check('leaderboard repair exposes only to authenticated users', leaderboardRepair.includes('REVOKE ALL ON FUNCTION public.get_leaderboard() FROM PUBLIC') && leaderboardRepair.includes('GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated'));
check('RTC portal is the configured official link', config.includes("officialUrl: 'https://rtc-kohl.vercel.app/'") && read('js/content.js').includes("website: 'https://rtc-kohl.vercel.app/'") && index.includes('href="https://rtc-kohl.vercel.app/"'));

console.log('\n[V100] Native hardening:');
const android = read('android/app/src/main/AndroidManifest.xml');
const gradle = read('android/app/build.gradle');
const rootGradle = read('android/build.gradle');
const plist = read('ios/App/App/Info.plist');
check('Android backup disabled', android.includes('android:allowBackup="false"'));
check('Android cleartext disabled', android.includes('android:usesCleartextTraffic="false"'));
check('Android camera permission is optional at device level', android.includes('android.permission.CAMERA') && android.includes('android.hardware.camera.any') && android.includes('android:required="false"'));
check('Android OAuth deep link exists', android.includes('android:scheme="org.resala.rtc.masar"') && android.includes('android:host="auth"'));
check('Android release minification enabled', gradle.includes('minifyEnabled true') && gradle.includes('shrinkResources true'));
check('Android version is synchronized', gradle.includes('versionCode 10000') && gradle.includes('versionName "100.0.0"'));
check('Firebase Google Services plugin is current and conditional on config', rootGradle.includes('google-services:4.5.0') && gradle.includes("file('google-services.json')"));
check('Firebase BoM and Analytics are configured once', gradle.includes("firebase-bom:34.17.0") && gradle.includes("firebase-analytics"));
check('FCM notification defaults use the RTC icon and channel', android.includes('default_notification_icon') && android.includes('default_notification_channel_id'));
check('QR scanner raises Android minimum SDK deliberately', read('android/variables.gradle').includes('minSdkVersion = 26'));
check('iOS ATS blocks arbitrary loads', plist.includes('<key>NSAllowsArbitraryLoads</key><false/>'));
check('iOS OAuth scheme exists', plist.includes('<string>org.resala.rtc.masar</string>'));
check('iOS push background mode exists', plist.includes('<string>remote-notification</string>'));
const iosEntitlements = read('ios/App/App/App.entitlements');
check('free iOS signing mode omits restricted APNs entitlement', !iosEntitlements.includes('<key>aps-environment</key>') && config.includes('ios: false'));
const appDelegate = read('ios/App/App/AppDelegate.swift');
check('iOS forwards APNs success and failure to Capacitor', appDelegate.includes('capacitorDidRegisterForRemoteNotifications') && appDelegate.includes('capacitorDidFailToRegisterForRemoteNotifications'));
check('iOS camera permission explains QR-only purpose', plist.includes('<key>NSCameraUsageDescription</key>') && plist.includes('مسح رمز QR'));

console.log('\n[V100] Offline privacy:');
check('service worker excludes Supabase from cache', sw.includes("url.hostname.endsWith('.supabase.co')"));
check('service worker has controlled update handoff', sw.includes("type === 'SKIP_WAITING'"));
check('public cache namespace is explicit', api.includes("PUBLIC_CACHE_PREFIX = 'rtc_public_v100_'"));
check('sensitive profile is not written to public cache', !/writePublicCache\(['"]profile/.test(api));

console.log(failures ? `\nفشل ${failures} فحص v100 ❌\n` : '\nكل فحوصات v100 نجحت ✅\n');
process.exit(failures ? 1 : 0);
