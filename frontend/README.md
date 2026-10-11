# Teach-It-Back Consent Companion — frontend

React, TypeScript, Vite, Tailwind, Base UI and Zustand frontend preview.

## Run and verify

```sh
npm ci
npm run dev
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests also accept `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when using an existing local Chromium. Tests include coordinator → patient → report flows, document editing, invalid routes, mobile layout, transcript scrolling, and axe WCAG 2/2.1 A/AA checks. Automated accessibility checks do not replace manual assistive-technology testing.

## Demo behavior and boundaries

Backend integration is deliberately deferred. There are no active API calls, WebSockets, ElevenLabs connections, PDF extraction requests, or outgoing clinical notifications.

- Coordinator sign-in accepts a sample email and any nonempty demo password. It establishes a local demo login; route guards are navigation controls, not server authorization.
- The patient example at `/session/mock-session-1` uses **Jane Doe**, **1980-05-15**.
- Documents, created sessions, responses, typed signatures, report flags, follow-up reminders and preferences use **sessionStorage**. They survive refresh in the same tab. Use sample data only. Closing the tab clears its storage; session links are not cross-device sharing links.
- Opening another patient session clears the previous verification. Unknown links show a recovery screen. Summary routes require every section to have been reviewed; completed sessions reopen their confirmation.
- Chat accepts multiple responses/questions per section. Only the explicit continue button advances. New responses are **unevaluated / needs review**, never automatically passed by the demo. Signing does not clear clinical review flags.
- PDF selection checks extension, MIME type when available, nonempty size and a 10 MB maximum. Only metadata is saved; a selected PDF creates an empty draft for manual editing. No file bytes are transferred or retained, and no parsing success is fabricated.
- Document changes affect subsequently created sessions. Existing sessions retain their section snapshot.
- Report acknowledgment clears the local coordinator flag without changing section assessments. Follow-up scheduling saves a local reminder, without sending messages or booking appointments. Downloads are plain text; Print / Save PDF uses the browser print dialog.
- Voice is explicitly unavailable with a text fallback. Settings are saved preview preferences; no assessment engine is connected.

## Audit remediation

The original `audit-report.md` is preserved. Findings were checked against the actual source and `design-system.md` before implementation.

### Resolved important frontend issues

- Fixed the duplicate muted-color token, readable secondary text, missing font request (system fallback until the licensed Camera Plain asset is supplied), shared focus colors, inset shadows, status badges, larger touch targets, progress/scrollbar contrast and reduced-motion support.
- Mounted notifications, added application and route error recovery, 404/invalid-record screens, lazy route loading and explicit vendor chunks.
- Added coordinator guards, actual local login/logout state, patient verification/lifecycle guards and stable behavior across reloads and session switches.
- Replaced isolated mock rows with shared local document/session records. Search, sort, status filters, empty states, document options, section editing/reordering, save actions and session creation now work.
- Added shared Zod validation and React Hook Form for login, identity, new-session and settings forms, with associated errors and labels.
- Removed timer-driven fabricated clinical passes and render-time navigation. Chat has an accessible message log, explicit progression, preserved transcripts, conditional auto-scroll and a jump-to-latest action.
- Retained typed signatures with acknowledgment and timestamp. Name comparison ignores case and repeated whitespace, and errors explain mismatches. Unfinished reviews cannot submit.
- Reports use the route's session, show priority review sections, expandable responses/transcripts, radial score, local flag acknowledgment, export/printing and local follow-up reminders.
- Added dashboard skip links, responsive navigation and keyboard access to patient section scrolling. Browser tests also identified and fixed the existing account-menu crash caused by a Base UI group label without a group.
- Removed unused `cn` and `shadcn` generator dependencies; installed the axe Playwright test helper.

### Audit findings corrected or deferred

- The root route already had a designed landing page. It is retained.
- The specification permits a signature pad **or typed name**. A drawing canvas is not required for this remediation.
- The design system explicitly specifies blue input focus rings; they are centralized rather than removed.
- The old initializer accepted every arbitrary ID as a mock session; the actual defect was absent ID validation rather than the claimed invalid-ID loading timeout.
- React 19 supports refs as props. ScrollArea now exposes an explicit viewport ref; `forwardRef` itself is not a requirement.
- The dialog close button's render composition worked in browser testing. The separate account-menu grouping bug was reproducible and repaired.
- API modules, proxy rules, HTTP response handling, TanStack server hooks, WebSocket/polling, real authentication/authorization, PDF parsing and ElevenLabs streaming remain deferred to the integration phase.
- Translation/language selection needs translated content, QR sharing needs a shareable session service, and credential management/notifications need backend behavior. These remain future features.
- Spring modal choreography, additional component extraction, virtualization, offline support, telemetry, full cross-browser/manual accessibility certification and deployment infrastructure remain broader roadmap work.

The frontend preview is not a clinically deployable consent system. Integration must provide authoritative identity/session checks, consent records and clinical assessments before real patient use.
