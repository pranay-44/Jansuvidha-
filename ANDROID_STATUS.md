## Bus-stop display simplified

Removed route lists, route filtering and unknown-route messages from the web and Android source. All 1,173 bus stops remain, with names, addresses and estimated directions. Source route data remains available to the ETL for duplicate matching and research. Rebuild/install the APK after sync to update a device.

## Bus stops update — 19 November 2026

Added 1,173 OpenStreetMap bus stops within the configurable Thane-area research bounding box. The combined app now contains 1,440 amenities. Bus cards display name, address/nearest-road estimate, heading and known routes instead of photos. The Bus stops category has a route selector; highway-proximity and other bus stops use distinct colours. Existing emergency contacts remain intact.

Validation passed: the project test suite, 11 Python pipeline tests and a 615-file Android asset comparison. All 1,193 original OSM stop nodes are accounted for exactly once after 20 merges. Cached inputs, exports and a standalone HTML demo are available; see bus-pipeline/README.md. Browser layout verification was blocked by the in-app browser's local connection failure. Rebuild and install the APK to update an existing device. No hosted deployment or APK installation was performed.

## 19 November 2026 update

The shared web source and Android assets now include 267 amenities (261 mapped, six awaiting coordinates) and 590 photos. This update adds 92 unverified facilities from six PDFs and photos for two existing facilities; the prior 175 owner-verified records retain their verification. The map toolbar now has a wider search and red Emergency contact dropdown with five services and six separate `tel:` links. Hindi and Marathi labels are included.

`npm test` covers this import and menu. `npm run android:sync` passed the byte-for-byte asset check. This updates Android project assets; rebuild/install the APK to update an existing phone installation. A live phone-dialer handoff was not exercised. The in-app browser could not reach the local preview server.

# Android update — 16 November 2026

The Android project uses the same `dist/` source as the web app. Its bundled files have been synced and compared byte-for-byte against that source.

Included in this update:

- 175 verified amenities across medical facilities, public toilets, water points, parks and libraries; 170 mapped, five awaiting coordinates.
- All 395 facility photos, map filters, search, facility names and verification dates.
- Simplified amenity cards with photos, problem-reporting entry point, feedback form and immediate reviews.
- Reviews saved on that installation/device, with English/Hindi/Marathi controls and light/dark themes.
- Current account screens and Google/Facebook integration source. These still need the backend and provider setup described below.

## Keep Android current

Run `npm run android:sync` after web changes. It refreshes the imported dataset and Leaflet assets, copies the web app, updates Capacitor, then runs `android:check` to verify every bundled source file. `npm run android:open` and `npm run android:run` automatically perform this sync first. If Android Studio is already open when you edit the web app, run sync again before building there.

`npm run android:check` detects missing or outdated copied files without modifying them. Generated Android web assets are intentionally ignored by Git: commit the shared source and build scripts, then sync on each checkout.

Build from PowerShell after syncing:

```powershell
$env:JAVA_HOME = 'C:/Program Files/Android/Android Studio2/jbr'
./android/gradlew.bat -p android assembleDebug
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Install it as an update over the same application/signing key to retain local reviews and preferences; uninstalling can remove that local data. Release signing and Play Store publication are not configured.

## Remaining account setup

The standalone Android package has no Node/MySQL server inside it. Its relative `/api` requests currently target the bundled WebView origin, so sign-in and server-backed complaint submission/tracking are not yet operational on a phone. The report button and screens are included, but submission needs the server connection.

Before activating accounts on Android:

1. Provide a reachable HTTPS JanSuvidha backend. The existing production guard still requires staff MFA before public deployment; do not remove it just to expose the server.
2. Configure the Google and Meta credentials using `SOCIAL_AUTH_SETUP.md`.
3. Implement the Android API/session connection and native social-login handoff through the system browser, with verified app links and a one-time authenticated return exchange. The current browser cookie session must not be assumed to transfer into the Android WebView. Do not put secrets or session tokens in app links or web assets.
4. Test first/returning sign-in, logout, complaint ownership, failure/cancel flows and reconnect behavior on a device.

Google/Facebook must not be forced through an embedded WebView login. This update synchronizes the current app; it does not claim that native provider login or a hosted backend is already configured.

The amenity data and photos are bundled. Street-map tiles require internet. Browser reviews and Android reviews are separate device-local storage, not a shared review database.

## Android Studio launcher

`android:open` reads the optional, Git-ignored `.env.android.local`. On this computer it points `CAPACITOR_ANDROID_STUDIO_PATH` to `C:/Program Files/Android/Android Studio2/bin/studio64.exe`. The default `Android Studio` folder has an incomplete installation and cannot launch. On another computer, omit this file to use Capacitor detection, or set the variable to that computer�s working IDE.
