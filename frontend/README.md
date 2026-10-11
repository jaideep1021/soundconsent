# Teach-It-Back frontend

One React/TypeScript application using the backend for accounts, documents, reviews, assessments and follow-ups. The original dashboard and patient layouts now host all supported workflows. There are no browser-stored demo records or alternate demo login.

## Run

1. Install dependencies with `npm ci` in both `backend/` and `frontend/`.
2. Configure the backend using its `.env.example`. Set Gemini credentials and the initial `BOOTSTRAP_COORDINATOR_EMAIL` / `BOOTSTRAP_COORDINATOR_PASSWORD` (12–256 characters), then run `npm run dev` in `backend/`. Bootstrap creates an administrator only in an empty account store; remove bootstrap credentials after initialization.
3. Run `npm run dev` in `frontend/` and open the URL Vite prints. Sign in at `/login` with the backend account.

The default API base is `/api`; Vite proxies it to `http://127.0.0.1:3001`. `API_PROXY_TARGET` overrides the proxy target. Deploy behind a same-origin `/api` reverse proxy, or same-site hosts with credentialed CORS and exact trusted origins in backend `CORS_ORIGIN`. `VITE_API_URL` can override the public API base. HttpOnly SameSite=Strict cookies do not support unrelated cross-site domains. Never put provider secrets, account passwords or coordinator keys in `VITE_*` variables.

## Vercel deployment

Create a separate Vercel project from the same GitHub repository. Keep the existing
backend project rooted at `backend`.

1. Commit `frontend/vercel.json` and this README and push when ready.
2. In Vercel choose **Add New → Project**, import the soundconsent repository, and
   name the project `soundconsent-frontend` (or another available name).
3. Set **Root Directory** to `frontend`, **Framework Preset** to Vite,
   **Node.js** to 24.x, **Build Command** to `npm run build`, and **Output Directory**
   to `dist`. Install dependencies with `npm ci`.
4. Set the frontend environment variable `VITE_API_URL=/api`. Do not put backend
   API keys, bootstrap passwords, or other secrets in frontend variables.
5. Deploy. The checked-in rewrites forward `/api/*` to
   `https://soundconsent-backend.vercel.app/*` and serve the React app for page URLs
   such as `/login` and `/dashboard`. Browser API requests stay on the frontend
   origin, allowing the backend's host-only HttpOnly cookies to work through the proxy.
6. Copy the actual assigned frontend origin (for example `https://YOUR-PROJECT.vercel.app`).
   In the **backend** project, set `CORS_ORIGIN` to that exact origin and redeploy
   the backend. Even with a same-origin proxy, the backend validates the browser's
   Origin for login and mutations. Use a comma-separated list if retaining localhost;
   do not allow all preview domains with a wildcard.
7. Open the frontend `/api/health`: expect JSON `{"status":"ok"}`. Open `/login`,
   sign in with the configured backend coordinator account, and refresh `/dashboard`
   to verify both client routing and cookie persistence. Test an approved synthetic
   PDF upload and session workflow before considering the deployment verified.

If `/api/health` returns HTML, check the deployed commit includes `vercel.json` and
that the API rewrite precedes the React fallback. If login returns 403, confirm the
backend's deployed `CORS_ORIGIN` matches the frontend address in the browser. A 401
from `/api/auth/me` before signing in is expected. Vercel deployment protection on
the backend can block the proxy; check for a Vercel login page if API responses are
unexpected HTML. Environment changes require a new deployment.

The backend's `/tmp` storage is disposable and can lose accounts and reviews across
instances/restarts. This frontend setup does not resolve that storage limitation.
Use synthetic data until durable storage is implemented.

[Vercel external rewrites](https://vercel.com/docs/routing/rewrites) provide the API proxy.

## Docker deployment

Build from the repository root with **`frontend/` as the build context**:

```sh
docker build --pull -t soundconsent-frontend:latest ./frontend
```

The multi-stage image installs locked dependencies with `npm ci`, type-checks and builds the app using Node 24, then serves only the compiled files using non-root Nginx on port **8080**. Node, source files and `.env` files are not included in the runtime image. Vite's preview server is for local verification, not production hosting ([Vite deployment guide](https://vite.dev/guide/static-deploy)).

Start the frontend with an existing backend reachable from the container. Replace the example backend origin with your actual backend:

```sh
docker run -d --name soundconsent-frontend \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -e API_PROXY_TARGET=https://backend.example.com \
  soundconsent-frontend:latest
```

Open `http://localhost:8080` for a local check. For public hosting, configure your HTTPS reverse proxy/load balancer to forward the frontend domain to port 8080. The loopback binding above works for a proxy on the same host; a containerized proxy should share a Docker network and connect to `soundconsent-frontend:8080`. A managed host should route to container port 8080 directly.

`API_PROXY_TARGET` is a **runtime** variable: an HTTP(S) origin with no path, trailing slash, credentials or query. It defaults to `http://backend:3001`; use `--network <shared-network>` if the backend is another container named `backend`. For a backend running on your Mac/Windows Docker Desktop host, use `http://host.docker.internal:3001`. On Linux, the backend must listen on an interface reachable from the container; `--add-host=host.docker.internal:host-gateway` supplies the host name if needed. `localhost` inside this image means the frontend container itself.

Browser calls stay on the frontend origin at `/api`. Nginx removes that prefix before forwarding to the backend, preserving cookies, `Origin`, query strings, revision and idempotency headers. HTTPS backends use certificate verification. The proxy re-resolves backend DNS, permits 20 MiB PDF uploads plus multipart overhead, and allows 120 seconds for AI responses. Configure any outer ingress with at least the same body limit and timeout.

Before public use:

- Serve the frontend over **HTTPS** for microphone access and secure authentication cookies.
- Set backend `CORS_ORIGIN` to the exact public frontend origin, e.g. `https://consent.example.com`, even with the same-origin proxy. No trailing slash. For local HTTP verification, use `http://localhost:8080` and a development backend with secure cookies disabled.
- Set backend `NODE_ENV=production` or `COOKIE_SECURE=true` for HTTPS deployment. Keep all provider credentials and account bootstrap settings exclusively on the backend.
- Deploy and persist the backend separately according to its [deployment constraints](../backend/README.md). This image hosts the frontend and API proxy only.

Nested URLs such as `/session/:id/chat` work on direct access and refresh. Successful fingerprinted assets get immutable caching; HTML and API responses use `no-store`. Missing assets return 404 instead of application HTML. `/healthz` and the Docker health check verify Nginx availability; `/api/health` checks backend connectivity separately.

```sh
curl --fail http://localhost:8080/healthz
curl --fail http://localhost:8080/api/health
docker inspect --format='{{.State.Health.Status}}' soundconsent-frontend
docker logs soundconsent-frontend
```

Prefer the default `/api` setup. If you specifically need a browser-visible API origin, supply `--build-arg VITE_API_URL=https://api.example.com` when building. This value is public and embedded in JavaScript; changing `docker run -e VITE_API_URL=...` has no effect. A direct API origin must satisfy the backend's same-site cookie and CORS requirements. Local `.env` files are deliberately excluded from Docker builds.

Rebuild with `--pull` regularly to incorporate base-image security updates.

## Unified workflow

| Page | Backend functionality |
|---|---|
| `/dashboard` | Actual session/document counts, recent reviews and scoped follow-up inbox |
| `/dashboard/documents` | Authorized document catalog, search and PDF upload |
| `/dashboard/documents/:id` | Source text, new draft versions, section editing, admin publication and archive |
| `/dashboard/sessions` | Search/filter saved reviews and resume them |
| `/dashboard/sessions/new` | Create a review from a published document |
| `/dashboard/sessions/:id` | Review progress, text, dictation and voice interaction and patient invitations/revocation |
| `/dashboard/sessions/:id/report` | Understanding report, JSON download, follow-up assignment/status/due dates/history and optional external alerts |
| `/dashboard/settings` | Current account, study settings, admin account management and voice provisioning |
| `/patient` | Patient sign in, self-registration and My studies homepage |
| `/session/:id` | Invitation/code access, then saved overview or completion summary |
| `/session/:id/overview` | Document/disclosure and one button to start or continue the review |
| `/session/:id/chat` and `/session/:id/voice` | Shared saved transcript, grading and server-controlled advancement |
| `/session/:id/summary` | Final assessments, escalations and participant completion acknowledgment |

Patient navigation has only **Overview** and **Review**. Review opens the unified chat, or the summary once completed. Legacy voice links remain supported under Review. Homepage and sidebar links use these same routes. **Sign out** appears at the top right throughout the coordinator workspace and revokes the server session. Old `/connected` links redirect to `/dashboard`; `?session=<id>` redirects to that saved session. Old `/review/:id#invite=<token>` links preserve the invitation while redirecting to `/session/:id`. `/demo-login` redirects to real sign-in.

### Coordinator to patient

1. Upload an approved PDF under Documents (maximum 20 MiB), supplying its study ID and optionally the expected version. The backend extracts the version and checks the configured allow-list; the supplied version cannot override the PDF. Historical sample PDFs are test material, not evidence of current clinical approval.
2. Create a session from a published document. The backend snapshots its content and current attempt/reminder policy.
3. Ask the patient to create an account at `/patient` and share their username. In the session, enter **Patient username** and select **Invite to study**. The study appears as **New study** on their homepage (refreshed on window focus and every 30 seconds). No link is required for an existing account.
4. Alternatively, select **Create first-time invitation** and share the private link and code separately. The patient opens `/session/<id>#invite=<token>`, creates an account or signs in, and enters the code once to add the study to their homepage. The frontend removes the token fragment immediately and retains it only in memory until redemption. Refreshing before redemption requires reopening the original unused link. The UI does not send invitations automatically.
5. Chat uses one `/messages` endpoint; Gemini infers whether to answer a question, grade a teach-back attempt, or ask for clarification using the current section and recent conversation. Server grading advances after a pass or the configured attempt limit. Reload and switching text/voice preserve the same review, transcript and attempts. Completed reviews open their summary; participants may explicitly acknowledge completion.
6. The coordinator opens **View Report** to inspect outcomes, download JSON, assign or resolve follow-ups and see their history. Resolving a flag does not alter the original assessment.

Access uses browser-managed HttpOnly cookies; application records and credentials are not written to sessionStorage/localStorage. Coordinator logins expire after eight hours, patient logins after 24 hours and unused invitations after seven days. Patient study assignments persist across logout and expiry: patients sign back in with their username and password to continue. Existing temporary review access can be saved to an account from the review page. **Revoke patient access** removes the assignment, review/voice grants and unused invitations. A review can belong to only one patient account. Patients cannot read coordinator catalogs/reports or other patients' reviews. Invitation access verifies possession of credentials, not clinical identity. Password recovery is not yet implemented.

### Document, policy and provider behavior

Published sources are immutable. Create a new draft version, edit/save its sections, then have an administrator publish it. Its version must also be in the backend approved-version configuration. Archive prevents new reviews while preserving existing snapshots.

Study settings control total attempts (1–3), default follow-up days (1–30), and inbox/external alert enablement. Attempts and reminder days apply to new reviews. Account administration creates scoped coordinators or administrators and disables accounts. There are no local-only grading preferences or fabricated patient identity/signature steps.

Configure ElevenLabs and a publicly reachable backend webhook URL, then provision the agent under Settings → Voice setup. Existing agents must be re-provisioned for scoped capabilities and revision-aware tools. Visible conversations poll progress every 2.5 seconds and refresh after voice ends. Tool interactions are saved; raw live provider transcript messages are transient. Provider failures offer errors and text fallback.

The coordinator inbox needs no external provider. External notification delivery is disabled by default and requires the backend's explicit webhook configuration. Queued/retried delivery is shown alongside follow-ups; relay acceptance does not prove clinician receipt. See the [backend contract](../backend/README.md#optional-external-notifications).

## Integration contracts

The API client validates backend responses. Authentication uses `/auth/login`, `/auth/me`, `/auth/logout` and cookies. Catalogs/read/resume use `/documents`, `/documents/:id`, `/sessions` and `/sessions/:id`. The snapshot includes the authenticated access role so only participants see the completion acknowledgment action; the backend enforces that restriction independently.

Review creation and message/response/question/audio/acknowledgment writes use durable idempotency keys; review writes also send `If-Match` revisions. Text drafts retain their starting revision. Concurrent advancement produces a conflict and requires refresh, rather than grading an old answer against a new section. Document edits, follow-ups and settings use their own revision checks. Reload reads persisted state without calling the AI or regrading. Legacy sessions with incomplete history display that limitation without fabricating a transcript.

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

Coverage includes upload/version validation, auth/deep links, document lifecycle, grading and redaction, reports, dictation drafts and microphone/provider failures, invitation redemption/reload/revocation, concurrent progress/stale drafts, participant acknowledgment, follow-up history, settings, accounts and mobile accessibility. Tests never load the real backend `.env` or send external notifications. Live Gemini quality, ElevenLabs microphone behavior and real webhook delivery require configured provider smoke tests. Automated accessibility checks do not replace manual assistive-technology testing.

### Review chat and microphone controls

The transcript and composer share one chat panel on both review routes. Type a question or explain your understanding in one message field; Enter sends and Shift+Enter adds a line. Questions and mixed answer-plus-question messages are answered without grading. Ambiguous acknowledgments receive a follow-up without consuming an attempt. The microphone records dictation: click once to start and again to stop, transcribe, and append to the editable draft. Dictation never submits automatically. Recordings stop after two minutes and are capped at 10 MiB; microphone access requires HTTPS or localhost. There is no audio-file upload control.

**Voice mode** starts the existing ElevenLabs voice-to-voice conversation directly from the composer, with listening/speaking status and an **End voice mode** button. Typing and dictation pause during voice mode; an existing text draft is preserved. Dictation uses Gemini transcription, and voice mode requires the configured ElevenLabs agent. Browser tests mock microphone capture and provider transport. The playback regression uses the real ElevenLabs SDK and confirms received PCM chunks reach the browser audio worklet; live device playback still needs a configured provider smoke test.

Voice tool calls run through the signed-in browser and the normal message API, so local voice reviews do not depend on a public webhook tunnel. The app serializes tool calls, retains idempotency keys on failed requests, and stops on revision conflicts. Spoken turns are saved separately from processed review turns and merged into the visible history; ending voice mode or reloading does not clear them.
