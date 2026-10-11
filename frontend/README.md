# Teach-It-Back frontend

One React/TypeScript application using the backend for accounts, documents, reviews, assessments and follow-ups. The original dashboard and patient layouts now host all supported workflows. There are no browser-stored demo records or alternate demo login.

## Run

1. Install dependencies with `npm ci` in both `backend/` and `frontend/`.
2. Configure the backend using its `.env.example`. Set Gemini credentials and the initial `BOOTSTRAP_COORDINATOR_EMAIL` / `BOOTSTRAP_COORDINATOR_PASSWORD` (12–256 characters), then run `npm run dev` in `backend/`. Bootstrap creates an administrator only in an empty account store; remove bootstrap credentials after initialization.
3. Run `npm run dev` in `frontend/` and open the URL Vite prints. Sign in at `/login` with the backend account.

The default API base is `/api`; Vite proxies it to `http://127.0.0.1:3001`. `API_PROXY_TARGET` overrides the proxy target. Deploy behind a same-origin `/api` reverse proxy, or same-site hosts with credentialed CORS and exact trusted origins in backend `CORS_ORIGIN`. `VITE_API_URL` can override the public API base. HttpOnly SameSite=Strict cookies do not support unrelated cross-site domains. Never put provider secrets, account passwords or coordinator keys in `VITE_*` variables.

## Unified workflow

| Page | Backend functionality |
|---|---|
| `/dashboard` | Actual session/document counts, recent reviews and scoped follow-up inbox |
| `/dashboard/documents` | Authorized document catalog, search and PDF upload |
| `/dashboard/documents/:id` | Source text, new draft versions, section editing, admin publication and archive |
| `/dashboard/sessions` | Search/filter saved reviews and resume them |
| `/dashboard/sessions/new` | Create a review from a published document |
| `/dashboard/sessions/:id` | Review progress, text/audio/voice interaction and patient invitations/revocation |
| `/dashboard/sessions/:id/report` | Understanding report, JSON download, follow-up assignment/status/due dates/history and optional external alerts |
| `/dashboard/settings` | Current account, study settings, admin account management and voice provisioning |
| `/patient` | Instructions for opening a coordinator-issued invitation |
| `/session/:id` | Invitation/code access, then saved overview or completion summary |
| `/session/:id/overview` | Document/disclosure and text or voice choice |
| `/session/:id/chat` and `/session/:id/voice` | Shared saved transcript, grading and server-controlled advancement |
| `/session/:id/summary` | Final assessments, escalations and participant completion acknowledgment |

Homepage and sidebar links use these same routes. **Sign out** appears at the top right throughout the coordinator workspace and revokes the server session. Old `/connected` links redirect to `/dashboard`; `?session=<id>` redirects to that saved session. Old `/review/:id#invite=<token>` links preserve the invitation while redirecting to `/session/:id`. `/demo-login` redirects to real sign-in.

### Coordinator to patient

1. Upload an approved PDF under Documents (maximum 20 MiB), supplying its study ID and optionally the expected version. The backend extracts the version and checks the configured allow-list; the supplied version cannot override the PDF. Historical sample PDFs are test material, not evidence of current clinical approval.
2. Create a session from a published document. The backend snapshots its content and current attempt/reminder policy.
3. In the session, select **Create patient invitation**. Share the private link and separate code through your organization's approved channels. The UI does not send invitations automatically.
4. The patient opens `/session/<id>#invite=<token>` in their browser, enters the code, chooses text or voice and continues. The frontend removes the token fragment immediately and retains it only in memory until redemption. Refreshing before redemption requires reopening the original unused link.
5. Questions and teach-back use separate endpoints. Server grading advances after a pass or the configured attempt limit. Reload and switching text/voice preserve the same review, transcript and attempts. Completed reviews open their summary; participants may explicitly acknowledge completion.
6. The coordinator opens **View Report** to inspect outcomes, download JSON, assign or resolve follow-ups and see their history. Resolving a flag does not alter the original assessment.

Access uses browser-managed HttpOnly cookies; application records and credentials are not written to sessionStorage/localStorage. Coordinator access expires after eight hours, patient access after 24 hours and unused invitations after seven days. Invitations are single-use. A new invitation replaces unused invitations without revoking existing patient sessions; **Revoke patient access** invalidates those sessions too. Patients cannot read coordinator catalogs/reports or other reviews. Invitation access verifies possession of credentials, not clinical identity.

### Document, policy and provider behavior

Published sources are immutable. Create a new draft version, edit/save its sections, then have an administrator publish it. Its version must also be in the backend approved-version configuration. Archive prevents new reviews while preserving existing snapshots.

Study settings control total attempts (1–3), default follow-up days (1–30), and inbox/external alert enablement. Attempts and reminder days apply to new reviews. Account administration creates scoped coordinators or administrators and disables accounts. There are no local-only grading preferences or fabricated patient identity/signature steps.

Configure ElevenLabs and a publicly reachable backend webhook URL, then provision the agent under Settings → Voice setup. Existing agents must be re-provisioned for scoped capabilities and revision-aware tools. Visible conversations poll progress every 2.5 seconds and refresh after voice ends. Tool interactions are saved; raw live provider transcript messages are transient. Provider failures offer errors and text fallback.

The coordinator inbox needs no external provider. External notification delivery is disabled by default and requires the backend's explicit webhook configuration. Queued/retried delivery is shown alongside follow-ups; relay acceptance does not prove clinician receipt. See the [backend contract](../backend/README.md#optional-external-notifications).

## Integration contracts

The API client validates backend responses. Authentication uses `/auth/login`, `/auth/me`, `/auth/logout` and cookies. Catalogs/read/resume use `/documents`, `/documents/:id`, `/sessions` and `/sessions/:id`. The snapshot includes the authenticated access role so only participants see the completion acknowledgment action; the backend enforces that restriction independently.

Review creation and response/question/audio/acknowledgment writes use durable idempotency keys; review writes also send `If-Match` revisions. Text drafts retain their starting revision. Concurrent advancement produces a conflict and requires refresh, rather than grading an old answer against a new section. Document edits, follow-ups and settings use their own revision checks. Reload reads persisted state without calling the AI or regrading. Legacy sessions with incomplete history display that limitation without fabricating a transcript.

See the [backend README](../backend/README.md) for all endpoint bodies, roles, Origin requirements, cookie lifetimes, storage constraints and deployment limitations. Review completion and participant acknowledgment do **not** obtain participation consent; clinical identity proofing and final consent remain outside this preparatory workflow.

## Verify

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run test:integration` is an alias for the same unified browser suite. Both launch a real Fastify backend with temporary state/audit files and a deterministic AI provider, plus Vite on ports 3002/4174. Install backend dependencies first. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing Chromium binary.

Coverage includes upload/version validation, auth/deep links, document lifecycle, grading and redaction, reports, recorded audio/provider failures, invitation redemption/reload/revocation, concurrent progress/stale drafts, participant acknowledgment, follow-up history, settings, accounts and mobile accessibility. Tests never load the real backend `.env` or send external notifications. Live Gemini quality, ElevenLabs microphone behavior and real webhook delivery require configured provider smoke tests. Automated accessibility checks do not replace manual assistive-technology testing.
