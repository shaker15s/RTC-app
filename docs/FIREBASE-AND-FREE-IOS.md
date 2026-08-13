# Firebase Android + iOS Personal Team — Masar RTC v100

## Android Firebase status

The native project is configured for:

- Application ID: `org.resala.rtc.masar`
- Google Services Gradle plugin: `4.5.0`
- Firebase BoM: `34.17.0`
- Firebase Analytics (Android)
- Firebase Messaging through `@capacitor/push-notifications`
- Notification channel: `rtc_updates`
- Small monochrome icon: `@drawable/ic_stat_rtc`

The environment-specific file must exist locally at:

```text
android/app/google-services.json
```

Validate it without printing API keys:

```bash
npm run firebase:check
```

Then synchronize and build:

```bash
npm run cap:sync
npm run build:android
```

`google-services.json` is intentionally ignored by Git. Firebase Admin service-account JSON must never be added to the mobile app.

For GitHub Actions, paste the complete JSON content into a repository Actions secret named `GOOGLE_SERVICES_JSON`. The manual **Native build verification** workflow restores it only inside the runner and uploads a debug APK artifact.

## iOS without a paid Apple Developer membership

The default source configuration is **Personal Team mode**:

- no restricted `aps-environment` entitlement;
- Local Notifications and scheduled course reminders continue to work;
- APNs registration is disabled in runtime config;
- Google OAuth, QR camera, secure Keychain storage and all Supabase features remain available.

On a Mac:

1. Run `npm run cap:sync && npm run cap:open:ios`.
2. Xcode → Settings → Accounts → add the Apple ID.
3. Target `App` → Signing & Capabilities → Automatically manage signing.
4. Choose the user's **Personal Team**.
5. Connect a physical iPhone, select it and Run.
6. If the bundle ID is unavailable to that Personal Team, use a temporary unique development Bundle ID in Xcode.

Personal Team provisioning is for on-device testing only and expires periodically. It cannot publish to App Store/TestFlight and cannot use APNs Push Notifications.

After joining the paid Apple Developer Program, enable APNs source settings with:

```bash
RTC_IOS_PUSH=1 npm run cap:sync
```

Then select the paid Team and enable Push Notifications in Apple Developer/Xcode.

## Production availability on iPhone without Apple membership

The PWA is the production distribution route that does not require an Apple Developer membership:

1. Open the HTTPS deployment in Safari.
2. Share → Add to Home Screen.
3. Launch **Masar RTC** from the Home Screen.

This provides the complete web app, offline shell and install experience. Native APNs and App Store distribution still require Apple's paid program.
