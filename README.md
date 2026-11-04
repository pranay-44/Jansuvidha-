# JanSuvidha foundation

Responsive web and Android prototype based on the October 2026 PRD, now using 13 real Thane facility records and 64 supplied photos. Records are photo-documented, not independently field-verified. No reports are sent to a public authority.

## Thane dataset imports

Source CSV: `public/data/thane/Thane_facilities.csv`; source images: `public/data/thane/photos/`. The supplied files were copied from `C:/Users/Pranay/Documents/Codex/2026-10-31/nee/outputs/Thane-facility-dataset`. The original folder is unchanged. No earlier demo dataset is required or imported.

Run `npm run data:import` after editing the CSV/photos. To import a new dataset folder containing the same CSV filename and a `photos/` directory:

```powershell
npm run data:import -- "C:/path/to/dataset-folder"
npm run android:sync
```

The importer validates IDs, coordinates, statuses, photo counts and referenced image files, then upserts into `public/data/thane/facilities.json` by **facility_id**. Existing IDs are replaced with the incoming row; new IDs are added; records absent from an update are retained. Duplicate IDs within one CSV are rejected. Reimporting the same data creates no duplicates. Blank fields in an updated row clear previous values. `id` is an unchanged alias of `facility_id` used by the existing complaint/rating UI. Do not edit generated JSON or `dist/data/thane/facilities.js` manually.

There is no backend database yet. This is a build-time import into a persistent JSON registry and browser ES module. The importer copies images and the latest CSV into `dist/data/thane/` so the same records work on the web and offline inside the Android package. `npm start`, `npm run dev` and `npm run android:sync` automatically run the importer. Static hosting should publish `dist/` after importing. After future imports, rebuild the APK or redeploy the web files.

Unknown wards, hours, accessibility, fees and water availability stay unknown. Scores stay empty until an assessment implementation is added. Photo timestamps are never treated as verification dates. The street map uses real latitude/longitude; photo-stamped facility coordinates remain unconfirmed. Details show all photos, provenance, observations and review notes. Local reports linked to IDs outside the current dataset are excluded from the active UI without deleting stored data during loading.

## Thane street map

Leaflet 1.9.4 is bundled locally in `dist/vendor/leaflet/`, with its licence. `npm run map:assets` refreshes those files from the locked npm dependency; web start and Android sync run this automatically. The initial viewport covers Thane at city scale (it is not an official municipal boundary). Zoom to see roads and mapped building footprints. “Entire Thane” resets the view; “Show facilities” fits the currently filtered pins. Clicking a pin opens its existing facility details, while selecting a list item also focuses its street location.

The interface belongs to this project; base-map data and online tiles are provided by OpenStreetMap, not Google. No API key is required. Street tiles need internet access; the dataset, photos and Leaflet code are packaged locally. Unmapped buildings may not appear. Tile failures show a message without disabling the facility list. A dedicated Android User-Agent suffix identifies JanSuvidha.

Visible attribution and browser caching follow the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/). No tile prefetch or offline city download is implemented. Public tile service availability is best-effort; for production traffic or offline maps, use a suitable hosted or self-hosted tile service and update the URL/attribution in `dist/facility-map.js`.

`map-checks.mjs` tests the map adapter's coordinate mapping, filtered markers, selection, focus, empty results, tile-error messaging and cleanup without fetching tiles. It is not a visual browser test.

Validation: `npm run check` covers repeat imports, ID-based updates, retained rows, CSV quoting, malformed values, unknown assessments and every photo path. `npm run analyze` summarizes the imported records; unassessed scores remain null.

## Development environment (web and Android)

Use Node.js 24 LTS and npm. Run `npm ci` after cloning to install the locked dependency versions, then `npm start` and open http://127.0.0.1:4173. `npm run dev` restarts the development server when its code changes; refresh the browser to see interface changes.

`dist/` is the editable web source in this project, despite its name. It is also the directory packaged into Android; no frontend compilation step is required. Do not delete it as generated output.

| Command | Purpose |
| --- | --- |
| `npm run check` | ESLint static analysis followed by existing application checks |
| `npm test` | Scoring, filters, languages and theme checks |
| `npm run analyze` | Imported facility count, mean, median and population standard deviation by ward |
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

- Thane street map with type/ward/search/usability/access filters, facility details and verification dates.
- Local complaint submission and tracking, staff assignment/priority/status changes and an activity log.
- Resolution blocked until photo evidence support is implemented.
- Analytics and CSV export based on imported facilities; scores remain unavailable without assessments.
- Local ratings and assessment drafts that never overwrite verified status.
- Responsive layout, labelled inputs, keyboard navigation and modal dialogs.

## Files

`dist/index.html` is the app shell; `dist/style.css` holds presentation; `dist/data.js` contains sample fixtures and pure scoring/filtering functions; `dist/app.js` contains the screen workflows. `server.mjs` is a development-only static server.

## Next implementation

Confirm wards, entrance coordinates and scoring methodology for the Thane pilot. Move records to the PRD's FastAPI/PostgreSQL/PostGIS backend and add authentication, server-side role permissions, evidence uploads and auditing. React/Vite migration can accompany that integration; the current interface uses browser modules with bundled Leaflet. Add full type-specific checklists, validated scoring/version history, OTP, GPS, notifications, staff-only notes, SLA handling, moderation, PWA/offline support and staff/analytics translations. None of those services are active yet.

Local storage is a single-device demo convenience, not secure multi-user persistence. Do not enter real personal information. Google Fonts is optional; system fonts work if unavailable.
