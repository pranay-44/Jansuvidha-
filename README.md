# JanSuvidha foundation

Responsive browser prototype based on the October 2026 PRD. All wards, facilities and scores are fictional sample data. No reports are sent to a public authority.

## Development environment (web and Android)

Use Node.js 24 LTS and npm. Run `npm ci` after cloning to install the locked dependency versions, then `npm start` and open http://127.0.0.1:4173. `npm run dev` restarts the development server when its code changes; refresh the browser to see interface changes.

`dist/` is the editable web source in this project, despite its name. It is also the directory packaged into Android; no frontend compilation step is required. Do not delete it as generated output.

| Command | Purpose |
| --- | --- |
| `npm run check` | ESLint static analysis followed by existing application checks |
| `npm test` | Scoring, filters, languages and theme checks |
| `npm run analyze` | Sample facility count, mean, median and population standard deviation by ward |
| `npm run android:sync` | Copy current web files and plugin configuration into Android |
| `npm run android:open` | Open the native project in Android Studio |
| `npm run android:run` | Deploy to a connected Android device or emulator |

Dependencies: `@capacitor/core` and `@capacitor/android` provide Android packaging; `@capacitor/cli` manages the native project; ESLint, `@eslint/js` and `globals` provide code analysis; `simple-statistics` powers the Node-based sample data report in `analysis.mjs`. The report excludes missing assessments and uses the same rounded scores as the app. It does not read reports saved in browser storage. No Python environment is needed for this setup.

### Android setup

The generated `android/` project uses Capacitor 8, Android SDK 36 and minimum Android API 24. Install Android Studio 2025.2.1 or newer, SDK Platform 36, SDK Build Tools and Platform Tools through its SDK Manager. Use a compatible Gradle JDK (JDK 21 or the compatible JDK bundled with Android Studio). See the [official environment guide](https://capacitorjs.com/docs/getting-started/environment-setup).

Run `npm run android:sync`, then `npm run android:open`. Select an emulator or a USB-debugging-enabled device in Android Studio and run the app. Sync again after every change to `dist/`. The packaged app does not require the development web server.

To build a debug APK from PowerShell with an installed JDK and the default Windows SDK location:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA/Android/Sdk"
./android/gradlew.bat -p android assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. Gradle downloads dependencies on the first build. For a different SDK location, set `ANDROID_HOME` accordingly or configure it in Android Studio. The provisional application ID is `org.jansuvidha.app`; confirm ownership before store publication. Release signing and store submission are not configured.

No API keys or `.env` settings are required for the local prototype. The frontend has no automatic `.env` loader; never put secrets into browser or Android web assets. Web and Android demo storage are separate.

At setup, npm reported eight moderate advisories in transitive development dependencies of ESLint and Capacitor CLI. Compatible `npm audit fix` did not resolve them; the proposed forced fixes downgrade major tools. Recheck with `npm audit` when updating dependencies.

## Implemented

- Light and dark themes, selected in the header and remembered in this browser. Theme labels follow the selected citizen language.

- Citizen language selector: English, Hindi and Marathi, with a remembered browser preference. Citizen map, facility details and complaint controls are translated; entered reports remain in their original language. Staff and analytics copy remains primarily English.

- Suvidha Map screen with a clearly labelled schematic, type/ward/search/usability/access filters, facility details and verification dates.
- Local complaint submission and tracking, staff assignment/priority/status changes and an activity log.
- Resolution blocked until photo evidence support is implemented.
- Analytics, illustrative equal-weight facility scores and CSV export.
- Local ratings and assessment drafts that never overwrite verified status.
- Responsive layout, labelled inputs, keyboard navigation and modal dialogs.

## Files

`dist/index.html` is the app shell; `dist/style.css` holds presentation; `dist/data.js` contains sample fixtures and pure scoring/filtering functions; `dist/app.js` contains the screen workflows. `server.mjs` is a development-only static server.

## Next implementation

Confirm the pilot city, wards, amenity types, scoring methodology. Replace the schematic with Leaflet and real location data. Move records to the PRD's FastAPI/PostgreSQL/PostGIS backend and add authentication, server-side role permissions, evidence uploads and auditing. React/Vite migration can accompany that integration; this first skeleton uses dependency-free browser modules. Add full type-specific checklists, validated scoring/version history, OTP, GPS, notifications, staff-only notes, SLA handling, moderation, PWA/offline support and staff/analytics translations. None of those services are active yet.

Local storage is a single-device demo convenience, not secure multi-user persistence. Do not enter real personal information. Google Fonts is optional; system fonts work if unavailable.
