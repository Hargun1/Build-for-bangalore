# Medical and wellness website redesign

Approved direction: clean medical website structure with a softer wellness palette. The owner's selection of the light references supersedes the earlier dark-only design instruction for this release.

## Changes

- White navigation and tool surfaces, cool-grey page backgrounds, blue primary controls, and separate mint, lilac, rose, peach and aqua metric accents.
- Consistent forms, dialogs, alerts, status badges, loading states, auth screens and chart tooltips. Clinical status colours remain distinct from categorical chart colours.
- Desktop-first dashboard with daily metrics in the main column and real active reminders, upcoming visits and recent reports in the care column. Smaller screens stack the same content; no features are hidden.
- The care column reuses the existing authenticated API helpers. Empty, loading and independent request-failure states are shown honestly. Paused reminders are excluded.
- Light body-explorer workspace with stronger reference-skeleton contrast. Anatomy, organ interactions and safety interpretation are unchanged.
- Removed the duplicated dark-style overrides from the shared stylesheet. No new production dependencies or changes to scoring, authentication, medical safety, APIs or persistence.

## Verification

- Production Vite build passed. Existing large lazy-loaded 3D bundle warning remains.
- 8 client tests passed, including new native-light-theme and 4.5:1 text-contrast checks across the white and pastel surfaces.
- 52 Jest tests and 91 pytest tests passed.
- 59 main browser checks passed: all 12 authenticated routes at 1920, 1440, 390 and 320 px; navigation focus, page search, daily-log persistence, food tabs, reminder CRUD, synthetic PDF preview, cancelled keyboard SOS and chat account isolation.
- New care-column checks persisted synthetic reminder, appointment and lab records through the local APIs and verified their display. A simulated reminders outage did not hide successful appointment/report sections.
- Desktop/mobile canvas-pixel checks and selection, focus, isolation, rotation, back view and female regions passed. No uncaught page errors, failed visual assets or horizontal overflow were recorded.
- 10 auth checks passed, including four pages at desktop/320 px, password visibility and a real invalid-login API response.

## Evidence and handoff

- Local preview: http://localhost:3000/ with a temporary local database. These test accounts and synthetic reports are not production user records.
- Browser evidence: `output/wellness-redesign-2026-10-26/`. Runners: `tmp/wellness-ui-check.cjs` and `tmp/wellness-auth-check.cjs`.
- Full-page Chrome captures can omit fixed sidebar children; viewport captures confirmed that navigation and branding render correctly.
- Hosted app: https://pranexusai-client.onrender.com. The release keeps the existing Render static-site/backend/AI topology and production configuration.
- Live AI/vision, email delivery, Google OAuth, Bluetooth hardware and actual phone push delivery were not re-audited in this UI pass. Existing Google connection work and dependency/security findings remain separate.
