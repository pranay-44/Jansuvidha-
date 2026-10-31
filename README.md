# JanSuvidha foundation

Responsive browser prototype based on the October 2026 PRD. All wards, facilities and scores are fictional sample data. No reports are sent to a public authority.

Run with Node.js: `npm start`, then open http://127.0.0.1:4173. Run checks with `npm test`. No package installation or build step is needed.

## Implemented

- Suvidha Map screen with a clearly labelled schematic, type/ward/search/usability/access filters, facility details and verification dates.
- Local complaint submission and tracking, staff assignment/priority/status changes and an activity log.
- Resolution blocked until photo evidence support is implemented.
- Analytics, illustrative equal-weight facility scores and CSV export.
- Local ratings and assessment drafts that never overwrite verified status.
- Responsive layout, labelled inputs, keyboard navigation and modal dialogs.

## Files

`dist/index.html` is the app shell; `dist/style.css` holds presentation; `dist/data.js` contains sample fixtures and pure scoring/filtering functions; `dist/app.js` contains the screen workflows. `server.mjs` is a development-only static server.

## Next implementation

Confirm the pilot city, wards, amenity types, scoring methodology and languages. Replace the schematic with Leaflet and real location data. Move records to the PRD's FastAPI/PostgreSQL/PostGIS backend and add authentication, server-side role permissions, evidence uploads and auditing. React/Vite migration can accompany that integration; this first skeleton uses dependency-free browser modules. Add full type-specific checklists, validated scoring/version history, OTP, GPS, notifications, staff-only notes, SLA handling, moderation, PWA/offline support and translations. None of those services are active yet.

Local storage is a single-device demo convenience, not secure multi-user persistence. Do not enter real personal information. Google Fonts is optional; system fonts work if unavailable.
