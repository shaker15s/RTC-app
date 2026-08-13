#!/usr/bin/env node
/* Masar RTC v100 — idempotent native hardening after `npx cap sync`. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SCHEME = 'org.resala.rtc.masar';
const HOST = 'auth';
const VERSION = '100.0.0';
const BUILD = '10000';

function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }
function write(file, content) { ensure(path.dirname(file)); fs.writeFileSync(file, content); }
function log(ok, message) { console.log(`  ${ok ? '✓' : '•'} ${message}`); }

function patchAndroid() {
  const base = path.join(ROOT, 'android', 'app', 'src', 'main');
  const manifest = path.join(base, 'AndroidManifest.xml');
  if (!fs.existsSync(manifest)) { log(false, 'Android is not added'); return; }
  let xml = fs.readFileSync(manifest, 'utf8');
  xml = xml.replace('android:allowBackup="true"', 'android:allowBackup="false"');
  if (!xml.includes('android:usesCleartextTraffic=')) {
    xml = xml.replace('android:allowBackup="false"', 'android:allowBackup="false"\n        android:usesCleartextTraffic="false"\n        android:networkSecurityConfig="@xml/network_security_config"\n        android:fullBackupContent="@xml/backup_rules"\n        android:dataExtractionRules="@xml/data_extraction_rules"');
  }
  if (!xml.includes('android:windowSoftInputMode=')) {
    xml = xml.replace('android:exported="true">', 'android:exported="true"\n            android:windowSoftInputMode="adjustResize">');
  }
  if (!xml.includes('android.permission.CAMERA')) {
    xml = xml.replace('    <uses-permission android:name="android.permission.INTERNET" />', '    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera.any" android:required="false" />\n    <uses-permission android:name="android.permission.INTERNET" />');
  }
  if (!xml.includes(`android:scheme="${SCHEME}"`)) {
    const filter = `
            <intent-filter android:autoVerify="false">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${SCHEME}" android:host="${HOST}" />
            </intent-filter>`;
    const activityEnd = xml.indexOf('\n        </activity>');
    if (activityEnd < 0) throw new Error('Android activity closing tag not found');
    xml = xml.slice(0, activityEnd) + filter + xml.slice(activityEnd);
  }
  fs.writeFileSync(manifest, xml);

  write(path.join(base, 'res', 'xml', 'network_security_config.xml'), `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors><certificates src="system" /></trust-anchors>
    </base-config>
</network-security-config>\n`);
  write(path.join(base, 'res', 'xml', 'backup_rules.xml'), `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content><exclude domain="root" path="." /></full-backup-content>\n`);
  write(path.join(base, 'res', 'xml', 'data_extraction_rules.xml'), `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup disableIfNoEncryptionCapabilities="true"><exclude domain="root" path="." /></cloud-backup>
    <device-transfer><exclude domain="root" path="." /></device-transfer>
</data-extraction-rules>\n`);
  write(path.join(base, 'res', 'drawable', 'ic_stat_rtc.xml'), `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF" android:pathData="M12,3L1.8,8.4 12,13.8 20,9.56V16h2V8.5L12,3zM5,12.2V17c2.9,3 11.1,3 14,0v-4.8L12,16 5,12.2z" />
</vector>\n`);

  const gradle = path.join(ROOT, 'android', 'app', 'build.gradle');
  let g = fs.readFileSync(gradle, 'utf8');
  g = g.replace(/versionCode\s+\d+/, `versionCode ${BUILD}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${VERSION}"`)
    .replace('minifyEnabled false', 'minifyEnabled true\n            shrinkResources true');
  fs.writeFileSync(gradle, g);
  const variables = path.join(ROOT, 'android', 'variables.gradle');
  if (fs.existsSync(variables)) {
    let vars = fs.readFileSync(variables, 'utf8').replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 26');
    fs.writeFileSync(variables, vars);
  }
  log(true, `Android hardened + camera QR + PKCE deep link (${VERSION}/${BUILD})`);
}

function patchIOS() {
  const app = path.join(ROOT, 'ios', 'App', 'App');
  const plist = path.join(app, 'Info.plist');
  if (!fs.existsSync(plist)) { log(false, 'iOS is not added'); return; }
  let xml = fs.readFileSync(plist, 'utf8');
  if (!xml.includes(SCHEME)) {
    const block = `\t<key>CFBundleURLTypes</key>
\t<array><dict>
\t\t<key>CFBundleURLName</key><string>${SCHEME}</string>
\t\t<key>CFBundleURLSchemes</key><array><string>${SCHEME}</string></array>
\t</dict></array>
`;
    xml = xml.replace('\n</dict>\n</plist>', `\n${block}</dict>\n</plist>`);
  }
  if (!xml.includes('<key>ITSAppUsesNonExemptEncryption</key>')) {
    const security = `\t<key>ITSAppUsesNonExemptEncryption</key><false/>
\t<key>NSAppTransportSecurity</key>
\t<dict><key>NSAllowsArbitraryLoads</key><false/><key>NSAllowsLocalNetworking</key><false/></dict>
\t<key>UIBackgroundModes</key><array><string>remote-notification</string></array>
\t<key>CFBundleLocalizations</key><array><string>ar</string><string>en</string></array>
`;
    xml = xml.replace('\n</dict>\n</plist>', `\n${security}</dict>\n</plist>`);
  }
  if (!xml.includes('<key>NSCameraUsageDescription</key>')) {
    xml = xml.replace('\n</dict>\n</plist>', '\n\t<key>NSCameraUsageDescription</key><string>نستخدم الكاميرا فقط لمسح رمز QR الخاص بحضور المحاضرة.</string>\n</dict>\n</plist>');
  }
  fs.writeFileSync(plist, xml);

  write(path.join(app, 'App.entitlements'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>aps-environment</key><string>$(APS_ENVIRONMENT)</string></dict></plist>\n`);

  const project = path.join(ROOT, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
  let pbx = fs.readFileSync(project, 'utf8');
  pbx = pbx.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${BUILD};`)
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${VERSION};`);
  if (!pbx.includes('CODE_SIGN_ENTITLEMENTS = App/App.entitlements;')) {
    pbx = pbx.replace(/CODE_SIGN_STYLE = Automatic;/g, 'CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\tCODE_SIGN_STYLE = Automatic;');
  }
  if (!pbx.includes('APS_ENVIRONMENT = ')) {
    let configIndex = 0;
    pbx = pbx.replace(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g, (line) => {
      configIndex += 1;
      return line + `\n\t\t\t\tAPS_ENVIRONMENT = ${configIndex === 1 ? 'development' : 'production'};`;
    });
  }
  fs.writeFileSync(project, pbx);
  log(true, `iOS hardened + push entitlement + PKCE deep link (${VERSION}/${BUILD})`);
}

console.log('\n▶ Hardening native projects (Masar RTC v100)\n');
patchAndroid();
patchIOS();
console.log(`
  Required console setup (not stored in Git):
   • Supabase redirect URL: ${SCHEME}://${HOST}
   • Android push: android/app/google-services.json
   • iOS push: enable the Push Notifications capability for the signing team
   • Signing keys/profiles stay in Play Console, Xcode or CI secret storage
`);
