# PranexusAI UI redesign

Completed locally on 26 October 2026. No deployment or push performed.

## Experience

- Neutral charcoal surfaces with mint primary actions, blue, coral and amber accents. Existing dark-theme convention retained.
- Persistent desktop navigation grouped into Your health, Every day and Care. Mobile bottom navigation and a keyboard-accessible drawer.
- Page search, readable page headings, consistent buttons, Lucide icons, form fields, status badges and charts.
- Overview prioritizes daily metrics and four actions: log a meal, add a report, explore the body and plan a doctor visit.
- Food opens to the diary. Photo, barcode, grocery and questions views are addressable tabs; saving a meal returns to the diary.
- Login and registration are focused forms. Root opens the signed-in overview or sign-in screen, without the former marketing/orb screen.
- Chat uses the shared palette, scrolls within its message area and keeps conversations scoped to an account. Logout clears cached chat content.
- Report uploads, reminders, vitals, profile, goals, environment and care pages share the new workspace. First-aid steps are readable in a vertical sequence, without narrow nested carousels.
- Dialogs trap keyboard focus and restore focus when closed. SOS retains the two-second hold and five-second cancel window, now also operable by keyboard.

## Body explorer

- One shared reference layout for both views: 14 regions in the male view, 17 in the female view.
- Added thyroid, pancreas, spleen, gallbladder and bladder. Female view also includes uterus and both ovaries.
- Corrected patient-left/right placement and relative chest, abdominal and pelvic regions. Kidneys are posterior, with the right kidney slightly lower; pancreas is behind the stomach.
- Replaced the incorrectly reused whole-digestive-system asset for the stomach with an independent simplified stomach. Intestines are independently selectable.
- Extracted the liver mesh from its multi-organ asset and accounted for GLTFLoader name sanitization, which otherwise made the extracted mesh invisible.
- Natural organ colors are default. Optional health colors use linked measurements; missing scores are neutral, not healthy.
- Front/back, zoom, focus, reset, rotation, isolation and skeleton/muscle/organ layers are functional. Orientation markers disappear during free rotation to avoid misleading left/right labels.
- The viewer explicitly states that these are educational reference shapes, not a patient scan or a diagnosis. Both views share the same reference skeleton; new procedural shapes are simplified, not clinically validated anatomy.

Anatomical positioning references: [NCI biliary anatomy](https://training.seer.cancer.gov/biliary/anatomy/review.html), [NCI spleen anatomy](https://training.seer.cancer.gov/anatomy/lymphatic/components/spleen.html), [NCI stomach anatomy](https://training.seer.cancer.gov/ugi/anatomy/stomach.html), [NCI pancreas](https://www.cancer.gov/types/pancreatic/what-is-pancreatic-cancer). These informed the layout, not a medical certification of the 3D meshes.

## Verification

- Client production build: passed. Vite still warns about the large lazy-loaded 3D chunk (about 986 kB before gzip).
- Client anatomy regression tests: 5 passed (`npm --prefix client test`).
- Server: 51 Jest tests passed. AI service: 91 pytest tests passed.
- Main browser suite: 45 checks passed, including all 12 authenticated routes at 1440, 390 and 320 px. No horizontal overflow, uncaught page errors or failed requested visual assets.
- Auth browser suite: 10 checks passed, including four auth pages at desktop and 320 px, password visibility and the real invalid-login error state.
- Real local API/database checks: daily metrics persisted through reload; reminders created, paused, reloaded and deleted. Temporary guest accounts were used.
- PDF upload rendered a synthetic document preview locally without calling an AI provider.
- WebGL screenshots and pixel variance checks confirmed nonblank desktop/mobile rendering. Selection, liver focus, isolation, front/back view, model rotation and the 17-region female view passed.
- Keyboard SOS was cancelled before sending; no SOS request was made. Chat isolation across logout/new guest account passed.
- Screenshots and JSON evidence: `output/ui-redesign-2026-10-26/`. Browser runners: `tmp/ui-redesign-check.cjs` and `tmp/ui-auth-check.cjs` (use this machine's bundled Playwright/Chrome).
- `git diff --check` passed; tracked changes were checked for common secret patterns.

## Limits and handoff

Preview: http://localhost:3000/. Choose Continue as guest when signed out. API runs on port 5001 with a temporary database that resets on restart.

This is a UI completion, not a production-readiness certification. No production account, persistent Atlas connection or deployment was configured. Medical scoring, deterministic emergency detection and server authorization were not weakened or redesigned. Previously reported backend audit findings remain separate work.

AI-generated answers, photo recognition, email delivery, Google OAuth, Bluetooth hardware and phone notification delivery were not end-to-end retested in this UI pass. Mocked server/AI tests are not evidence of live-provider availability. Dependency installation reported 17 audit vulnerabilities; dependency remediation remains separate work.
