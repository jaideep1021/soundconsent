# Teach-It-Back backend

This self-contained TypeScript API implements the backend items in `../action-items-backend.md`. No separate Git repository or backend package existed, so the backend lives in this `backend/` package.

## Run locally

Requires Node.js 24 or newer. The Docker image uses Node.js 24. From this directory:

```sh
npm ci
cp .env.example .env
# Configure GEMINI_API_KEY and the two BOOTSTRAP_COORDINATOR_* values.
npm run dev
```

`npm run build` compiles to `dist/`, `npm start` runs the compiled server, and `npm test` runs offline tests. Gemini credentials are required to ingest documents and run RAG, teach-back grading, grounding checks, and recorded-audio transcription. ElevenLabs credentials are used for speech and its Conversational AI agent.

## Vercel deployment

Use the Fastify framework preset, Root Directory `backend`, Node.js 24.x,
and the default output directory. Do not add a `functions: { "src/app.ts": ... }`
configuration: this project uses automatic Fastify entry-point detection, not an
`api/` function. The existing `src/app.ts` request handler lazily initializes the
shared app; `src/server.ts` remains the local/Docker listener.

Remove `APPROVED_VERSIONS_FILE` from the Vercel environment to use the checked-in
`data/approved-versions.json`. With `VERCEL=1`, a literal module-relative file read
makes the asset traceable independently of the working directory and `DATA_DIR`.
The existing study/version entries are unchanged. Changes require redeployment.
An explicitly configured approval file takes precedence and must exist in the
runtime; missing files, malformed JSON, and invalid shapes stop startup rather
than falling back to another allow-list. Outside Vercel, the existing
`APPROVED_VERSIONS_FILE` or `DATA_DIR/approved-versions.json` behavior is unchanged.
Docker retains its empty default allow-list and read-only configuration mount.

Set `CORS_ORIGIN` to the exact frontend origin (for example `https://frontend.example.com`,
without surrounding quotes or a page path) and `PUBLIC_BASE_URL` to the public
backend URL; configure provider and bootstrap credentials as described below.
The Vercel dashboard settings have to be verified separately from local `.env`.

**Postgres is required on Vercel.** Connect a Postgres database (for example Neon
through Vercel Storage) to the **backend project only**, then verify `DATABASE_URL`
is available to its Production deployment. Use the provider's pooled URL with its
TLS parameters intact; the application does not disable certificate verification.
Never place this URL in the frontend or a `VITE_*` variable. Use a separate database
or branch for Preview rather than sharing production state with preview code.

Keep `BOOTSTRAP_COORDINATOR_EMAIL` and `BOOTSTRAP_COORDINATOR_PASSWORD` configured
for the first database-backed startup. The initial administrator is created only
when the shared account list is empty; concurrent cold starts cannot create duplicates.
After verifying login, remove both bootstrap variables and redeploy. Existing accounts
remain in Postgres. Keep `CORS_ORIGIN=https://soundconsent.vercel.app` for the current
frontend, and `NOTIFICATION_DELIVERY_ENABLED=false` (or unset).

The first startup creates `soundconsent_state` and `soundconsent_audit` if absent,
so the database role needs schema/table creation rights as well as SELECT, INSERT,
UPDATE and sequence usage. Existing tables and records are never cleared at startup.
Accounts, grants, documents, sessions, settings, and notification records use a
shared JSONB snapshot. Audit records retain their hash-chained serialization in a
separate table. Each request locks the shared state row, loads fresh state, and commits
state and audit changes before a successful response is sent. Error responses roll
back. Database failures never fall back to files. Login cookies therefore work across
instances, and logout/revocation takes effect on subsequent requests everywhere.

This first adapter deliberately serializes requests to preserve the existing service
semantics, including revision checks and replay keys. It is intended for a small
prototype: AI calls hold the lock, lock waits are bounded to 15 seconds, and a busy
database returns 503. Larger workloads need normalized tables and narrower transaction
boundaries. Startup verifies the full audit chain; that cost grows with audit history.
Login throttles are still per-process; distributed rate limiting remains separate work.
The in-process external notification worker is rejected in Postgres mode until a
durable scheduled worker is implemented. In-app follow-up notifications still work.

`DATA_DIR` is ignored for mutable storage in Postgres mode. Local/Docker deployments
without `DATABASE_URL` retain their existing single-process file storage and approval
mount. Vercel refuses to start without `DATABASE_URL` so it cannot silently return to
instance-local sessions. The approved-version allow-list remains separate and unchanged.

**Migration:** this creates a new empty database store; it does not import temporary
Vercel files or local Docker records. Existing temporary cookies will require a new
sign-in. If old records must be preserved, stop writers and back up the state and audit
files together before arranging an explicit migration. Do not expect `/tmp` records
to be recoverable across instances. Configure provider backups for the new database.

### Postgres verification

`npm run typecheck`, `npm test`, and `npm run build` cover local behavior. To include
the real database integration test, set `POSTGRES_TEST_URL` to a **dedicated disposable
local test database whose name ends in `_test`**, then run `npm test`. That test resets
its SoundConsent tables and checks concurrent bootstrap, cross-instance cookies,
concurrent writes, stale revisions, transaction rollback, logout, cold starts and audit
tampering. Never point it at application data. Without the variable it is skipped.

After deployment check `/health`, then sign in through the frontend and refresh the
dashboard several times. `/api/auth/me`, `/api/documents`, and `/api/sessions` should
remain 200 while signed in. Sign out and confirm the previous session is rejected.

After committing the changes, redeploy the new commit (redeploying an older commit
will not include this fix). Verify `/health` and a synthetic end-to-end flow.

References: [Fastify on Vercel](https://vercel.com/docs/frameworks/backend/fastify)
and [files in Vercel Functions](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions).

## Deploy with Docker

Run these commands from `backend/` (or build from the repository root with `docker build -t soundconsent-backend ./backend`). The multi-stage image contains compiled application code and locked production dependencies, runs as UID/GID `1000:1000`, and excludes `.env`, saved state, audit logs, tests, and local dependencies from the final image.

1. Copy `.env.example` to `.env` if you have not configured it already; restrict it with `chmod 600 .env`. Set `GEMINI_API_KEY`, the two first-start `BOOTSTRAP_COORDINATOR_*` values, and `CORS_ORIGIN` to your exact frontend HTTPS origin, for example `https://consent.example.org`. Configure ElevenLabs only if using voice. Keep notification delivery disabled unless you intend to send real notifications.
2. Replace `data/approved-versions.json` with your controlled study/version allow-list. The checked-in entries are examples. Compose mounts this file read-only; the bare image defaults to an empty allow-list and cannot approve uploads until one is supplied.
3. Start the single backend container:

   ```sh
   docker compose up -d --build
   docker compose ps
   curl --fail http://127.0.0.1:3001/health
   docker compose logs --tail=100 backend
   ```

4. Put an HTTPS reverse proxy in front of it. Compose exposes port 3001 only on host loopback. Forward your frontend's `/api/` to `http://127.0.0.1:3001/`, stripping `/api`. Preserve the browser's `Origin` header. A proxy in another container should share a private Docker network and use `backend:3001` instead. Configure `TRUST_PROXY` with only that proxy's IP address or CIDR and have the proxy overwrite forwarded headers; this lets authentication throttles use client IPs. With no trusted proxy configured, requests are throttled using their direct peer IP.
5. Sign in over HTTPS, verify provider-backed document ingestion and any enabled voice workflow, then remove both bootstrap values from `.env` and run `docker compose up -d --force-recreate backend`. Account credentials persist in the volume.

Compose fixes the internal port and data/config paths regardless of local `.env` values, sets `NODE_ENV=production` (Secure cookies), uses a read-only root filesystem, and mounts a writable named volume at `/app/data`. `SameSite=Strict` cookies require a same-origin or same-site frontend; unrelated frontend/backend domains will not work. The HTTP health request above works without authentication; browser authentication must use HTTPS.

For a deployment without Compose:

```sh
docker build --pull -t soundconsent-backend .
docker volume create soundconsent-data
docker run -d --name soundconsent-backend --init --restart unless-stopped \
  --stop-timeout 300 --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --env-file .env -e NODE_ENV=production -e PORT=3001 \
  -e DATA_DIR=/app/data -e APPROVED_VERSIONS_FILE=/app/config/approved-versions.json \
  -p 127.0.0.1:3001:3001 \
  --mount type=volume,source=soundconsent-data,target=/app/data \
  --mount "type=bind,source=$(pwd)/data/approved-versions.json,target=/app/config/approved-versions.json,readonly" \
  soundconsent-backend
```

Operate **one process/replica per data volume**. The JSON store and authentication throttles are not shared across replicas; use stop-then-start updates, not overlapping rolling deployments. New named volumes inherit the image's data-directory ownership. For a host bind mount or restored volume, prepare it as UID/GID `1000:1000` with owner-only access. Existing local `data/state.json` and `data/audit.jsonl` are **not** copied into a new volume: stop all writers, back up and migrate both files together, and set their ownership before starting Docker. Otherwise Docker initializes a separate empty deployment.

Back up the entire data volume and the approved-version configuration while the container is stopped (`docker compose stop backend`), then restart it (`docker compose start backend`). Keep encrypted backups and test restoration to a separate volume. `docker compose down` retains data; `docker compose down -v` deletes it. On updates, back up first and rebuild with `docker compose build --pull`, then `docker compose up -d`. Do not replace a working volume with an empty one when rolling back an image.

`GET /health` is a local liveness check after storage initialization; it does not validate external credentials, provider quotas, or clinical readiness. Docker checks it every 30 seconds. Restart policies recover exited processes, not containers that are merely marked unhealthy; configure your host's monitoring accordingly. Startup and server errors go to stdout/stderr as structured logs (`LOG_LEVEL=info` by default); automatic request logging is disabled to keep request URLs, headers, and cookies out of access logs. Compose rotates these logs. SIGTERM/SIGINT drain requests and the notification worker, with a 270-second application deadline and a 300-second container grace period.

Before publishing an image, run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `npm audit --omit=dev`. The Docker build type-checks and compiles; offline tests run from the repository because PDF ingestion tests use `../sample_icfs`. The container makes this prototype hostable as a single instance; the storage and clinical-use limitations below still apply.

`GEMINI_MODEL` selects the backend text model and defaults to `gemma-4-26b-a4b-it`, hosted through the same Google API key. `GEMINI_TRANSCRIPTION_MODEL` separately defaults to `gemini-3.1-flash-lite` because Gemma 26B does not accept audio. Embeddings retain `GEMINI_EMBEDDING_MODEL`. These settings do not change the ElevenLabs agent's conversational model or voice. Provider limits still apply: short transient failures receive bounded retries, while daily quota exhaustion is reported without repeated requests. Google `RetryInfo` delays are honored alongside `Retry-After` headers.

## ElevenLabs Conversational AI

Set `ELEVENLABS_API_KEY` and optionally `ELEVENLABS_VOICE_ID`. Browser voice uses ElevenLabs client tools, executed by the signed-in app against its normal authenticated backend connection. No public tunnel is needed. The browser generates mutation IDs, serializes turns, and carries forward backend revisions; the language model supplies only the spoken message.

Sign in through `/auth/login` and save cookies to `coordinator-cookies.txt` (or use Voice setup in the frontend). Provision or update the private voice agent and its browser tools:

```sh
curl -X POST http://localhost:3001/agents/provision \
  -b coordinator-cookies.txt -H "Origin: http://localhost:5173"
```

The backend creates/updates two ElevenLabs client tools that use the same Gemma-backed message processing as text chat. Re-provision existing agents once to replace old webhook tools; refresh the app before starting a new voice call. It attaches them to a Gemini `gemini-2.5-flash` Conversational AI agent, enables signed-URL authorization, disables voice recording, and stores the resulting agent/tool IDs in `DATA_DIR/state.json`. To start a voice conversation, first create a review session with `POST /sessions`, then request `GET /sessions/:id/conversation-url`. The response contains `signedUrl` and `dynamicVariables` (`session_id`, short-lived `session_access`, `session_revision`, and the initial disclosed opening message). Pass those dynamic variables when starting the ElevenLabs conversation; never expose either API key to the client.

Legacy server-to-server integrations can still use the webhook endpoints `/elevenlabs/tools/questions` and `/elevenlabs/tools/responses` require both the bearer token configured by `ELEVENLABS_TOOL_API_KEY` and the per-review `sessionAccess` capability populated from `session_access`. Legacy webhook tools also require `requestId` (8–100 letters, digits, underscores or hyphens) and `expectedRevision` (numeric string). These legacy integrations require a reachable `PUBLIC_BASE_URL` and a server-only `ELEVENLABS_TOOL_API_KEY`; browser client tools require neither. A retried tool call must reuse its request ID; a revision conflict requires refreshing the review and restarting voice. Logout, expiry, account disablement, and review-access revocation invalidate the corresponding capabilities; calls already authorized and in progress can finish. Treat the signed conversation URL as a short-lived credential. Real ElevenLabs agent provisioning and live voice calls require valid provider credentials and were not exercised by the offline test suite.

The bundled sample consent PDFs originate from ClinicalTrials.gov; consult the corresponding study records at `https://clinicaltrials.gov/study/<NCT_ID>`. The checked-in approved-version list contains only a synthetic demo entry; the historical sample PDFs are not treated as currently IRB-approved.

## Approved versions

`data/approved-versions.json` is a mock allow-list keyed by study ID. The checked-in `demo-study: 1.0` entry is demo configuration, not an actual IRB approval. `NCT01823991: 10` exists only to smoke-test ingestion with the bundled historical sample PDF; it does not mean that PDF is currently approved for a study. Replace the file with an institution-controlled list before any real use. Uploaded PDFs must include a recognizable version string; an optional multipart `version` field is checked against the version extracted from the PDF and cannot override it. Missing, mismatched, and unapproved versions are rejected.

## API

Coordinator routes require an authenticated HttpOnly session cookie and study permission. Admins can access all studies; coordinators can access only assigned study IDs. The old bearer key is accepted only when `ALLOW_LEGACY_API_KEY=true` is explicitly configured. Patient routes require a cookie scoped to that review or an authorized coordinator.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/agents/provision` | Admin-only create/update of the ElevenLabs Gemini-backed Conversational AI agent |
| `GET` | `/sessions/:id/conversation-url` | Return a private ElevenLabs signed URL and the session's dynamic variables |
| `POST` | `/documents` | Multipart PDF upload (`file`, `studyId`, optional `version`), maximum 20 MiB |
| `POST` | `/sessions` | Start review (`documentId`) and return automated-agent disclosure plus first section |
| `POST` | `/sessions/:id/responses` | Submit typed teach-back |
| `POST` | `/sessions/:id/messages` | Infer intent from a message and review context; answer questions, grade teach-back attempts, or request clarification |
| `POST` | `/sessions/:id/questions` | Ask a question answered from retrieved consent text or refused |
| `POST` | `/sessions/:id/transcription` | Transcribe microphone audio into an editable draft without saving a turn, grading, or advancing the review |
| `POST` | `/sessions/:id/audio` | Transcribe recorded audio using Gemini audio understanding, then process it as teach-back |
| `POST` | `/sessions/:id/speech` | Return streamed ElevenLabs audio for the latest safe response |
| `POST` | `/elevenlabs/tools/questions` | Authenticated ElevenLabs webhook for Gemini-grounded consent questions |
| `POST` | `/elevenlabs/tools/responses` | Authenticated ElevenLabs webhook for Gemini teach-back grading |
| `GET` | `/sessions/:id/report` | Coordinator-only understanding report |

Teach-back gets one re-explanation; a second failed attempt is flagged and advances to the next section. The report lists failed sections and questions requiring clinical follow-up (including sensitive concerns) in `outOfScopeQuestions`. Helpful answers are retained when a concern is flagged; the response also strongly recommends confirming information and decisions with the patient's doctor before acting and confirms that the concern was added to the report. Completion states that a human must handle the final consent discussion; consent is never recorded as obtained.

The voice prompt lives in `src/elevenlabs-agent.ts`; question generation and verification live in `src/gemini.ts`. Voice and text share this answer policy. The assistant answers to the best of its ability, explains uncertainty, and offers useful next steps instead of blanket refusals or referral-only replies. Study facts still require source support; clearly labeled general educational information may go beyond the form. Re-provision an existing ElevenLabs agent from **Settings → Voice setup** after changing the voice prompt, then start a new voice call.

## Storage, voice, and safety limitations

Documents, section vectors, and sessions are persisted as local JSON. This is structured vector storage for the demo, not a production vector database. A hash-chained append-only `audit.jsonl` provides tamper evidence for redacted interaction events. `DATA_DIR` must be on persistent, access-controlled storage in a deployment. E-mail addresses, US phone numbers, SSNs, dates of birth, common name disclosures, medical record identifiers, and street addresses are pattern-masked before LLM calls and before being stored in session/audit events. Regex masking is not de-identification. Uploaded audio is sent to Gemini for transcription and discarded by this service.

The backend provisions the ElevenLabs Conversational AI agent and bridges its authenticated webhooks to Gemini-backed session workflows. The frontend session and patient pages requests signed URLs and starts the ElevenLabs SDK conversation with the returned dynamic variables; a first-party WebRTC client/media worker and measured sub-800ms end-to-end streaming path are not included. Emergency questions trigger a 911 instruction and are reported for follow-up; requests for a person trigger an immediate human-handoff response. This prototype cannot guarantee a zero hallucination rate: guides use source-only generation and a secondary source-grounding check, while question answers receive a separate accuracy and safety check that permits general educational information. Unverified answers are replaced with an honest uncertainty message and an offer to help clarify questions, with doctor confirmation and a report flag. These model-based checks do not independently validate medical facts. It is not validated for clinical use. Do not use real patient data, deploy, or make clinical decisions without privacy, security, regulatory, accessibility, and clinical validation. Every interaction is preparatory; a human investigator conducts the final consent discussion.

## Frontend integration

See [the frontend integration contract](../frontend/README.md#unified-workflow) for setup, both directions of API requirements, and missing services. The unified dashboard uses account authentication, authorized catalogs, session snapshots, and invitations. Its pages include document versions, study settings, coordinator follow-ups, an optional notification relay, account administration and participant review acknowledgments. Clinical identity proofing and clinical consent signing remain outside this preparatory workflow. `tests/integration-server.ts` is an isolated test fixture with a fake AI provider, never a production entry point.

## Authentication and resumable reviews

Use `BOOTSTRAP_COORDINATOR_EMAIL` and `BOOTSTRAP_COORDINATOR_PASSWORD` (12–256 characters) to initialize the first admin in an empty account store. Bootstrap never resets an existing password. Remove both bootstrap values after creation. Sign in at the frontend `/login` (legacy `/connected` links redirect to the dashboard). There are no default credentials or public registration.

Passwords use salted scrypt (N=32768, r=8, p=1); opaque cookies and invitation tokens are stored only as SHA-256 hashes. Access-code verifiers are scrypt hashes. Coordinator cookies expire after 8 hours, patient cookies after 24 hours, unused invitations after 7 days, and voice capabilities after 1 hour or parent-session expiry/revocation. Cookies are HttpOnly, SameSite=Strict, Path=/, and Secure when `COOKIE_SECURE=true` or `NODE_ENV=production`. Auth/read responses use `Cache-Control: no-store`. Cookies persist across backend restarts. Secrets are never returned by account/list/read APIs.

Use a same-origin `/api` reverse proxy (recommended), or same-site frontend/backend hosts with credentialed CORS. Strict cookies intentionally do not support a cross-site frontend/backend deployment. `CORS_ORIGIN` must list exact trusted frontend origins; cookie-authenticated mutations require an allowed `Origin` header, including requests made with curl. Browser login/redemption also reject untrusted origins. Login and invitation redemption have bounded in-process throttles; deploy this JSON-backed service as a single process. Staff account creation and disabling are available in the admin workspace. Patients self-register with a case-insensitive username (3–40 letters, numbers, dots, underscores or hyphens) and a 12–256 character password. Patient accounts are separate from staff accounts and never grant coordinator access. Distributed storage/rate limiting, MFA and password reset/recovery are broader deployment work.

| Method | Path | Access / result |
|---|---|---|
| POST | `/auth/login` | `{email,password}` → user metadata and coordinator cookie; generic credential errors |
| GET | `/auth/me` | Current coordinator profile, role, study IDs |
| POST | `/auth/logout` | Revoke current coordinator session and its voice grants; clear cookie |
| GET / POST | `/auth/accounts` | Admin-only list/create; create body `{email,password,name,role,studyIds}`; role is `admin` or `coordinator` |
| POST | `/auth/accounts/:id/disable` | Admin-only disable; revoke account-issued grants/invitations; cannot disable self |
| GET | `/documents` | Authorized document metadata/section IDs and titles; no vectors |
| GET | `/documents/:id` | Authorized document metadata and extracted section text; no vectors |
| GET | `/sessions` | Authorized review summaries, document titles, progress and follow-up state |
| GET | `/sessions/:id` | Authorized coordinator or patient: saved guide, transcript, section text/status, attempts, results, timestamps and authenticated `accessRole` (`patient` or `coordinator`) |
| POST | `/sessions/:id/invitations` | Authorized coordinator: create one-use invitation and separate code; replaces earlier unused invitations |
| POST | `/sessions/:id/access` | `{invitationToken,accessCode}` → patient cookie for this review; atomic one-use redemption |
| POST | `/sessions/:id/access/revoke` | Coordinator: remove the patient assignment and revoke this review's patient/voice grants and all unused invitations |
| POST | `/sessions/:id/logout` | Revoke this browser's patient grant and child voice grants; clear its cookie |

Patients create an account at `/patient` and give their username to the coordinator. Inviting that username adds the review to the patient's homepage as a new study. Assignments persist across logout, login expiry and server restarts. A review belongs to at most one patient; revoke access before reassigning it. Revoking one review does not affect the patient's other reviews or account.

For a first-time invitation, the coordinator shares `/session/<id>#invite=<token>` and the access code separately. The frontend removes the fragment immediately, signs the patient into an account, and sends the token/code only in a POST body. Redemption permanently connects the review to that account. An already-open legacy review can also be connected using its existing valid cookie. This proves possession of the access credentials; it is not clinical identity verification and collects no patient name or DOB. A login expires after 24 hours, but the patient can sign back in with their password without another invitation. Password recovery is not yet implemented.

| Method | Route | Patient account workflow |
| --- | --- | --- |
| POST | `/patient/register`, `/patient/login` | `{username,password}` → public patient profile and HttpOnly account cookie |
| GET | `/patient/me` | Current patient profile; no password/hash |
| POST | `/patient/logout` | Revoke this account login and child voice grants; retain study assignments |
| GET | `/patient/studies` | Only this patient's assigned reviews, progress and new-study status |
| POST | `/patient/studies/:id/open` | Mark an assigned review as opened |
| POST | `/patient/studies/:id/accept` | Authenticated patient: redeem `{invitationToken,accessCode}` into a durable assignment |
| POST | `/patient/studies/:id/claim` | Connect an existing valid legacy review cookie to the authenticated patient |
| POST | `/sessions/:id/patient-invitation` | Scoped coordinator: assign an existing patient using `{username}` |

Resume is read-only: `GET /sessions/:id` waits for prior in-process session operations and does not call the AI, re-grade, advance, or reset attempts. New sessions persist an immutable document snapshot, the current guide independently of question answers, and redacted patient/assistant transcript entries. Reports now include section IDs and a stable completion timestamp. Existing schema-version-1 data remains readable: accounts default to empty, legacy sessions use the original stored document, and missing historical transcripts/guides are not fabricated. The frontend shows available source text and explicitly marks incomplete history.

The legacy API key is disabled by default. If temporarily enabled it grants administrator authority, so it should remain server-side/CLI-only and be disabled again after migration. Existing unauthenticated patient callers now receive 401; existing ElevenLabs agents must be re-provisioned. An in-flight authorized operation may finish after logout/revocation. Review mutations now support durable idempotency and revision checks, described below.


## Document versions and coordinator workflow

Published documents are immutable. Legacy documents without a lifecycle are treated as published. A coordinator with study access creates a separate draft with a new version, edits its title/sections/order, and saves it. An administrator explicitly approves and publishes the content; the version must also appear in the institution-controlled `APPROVED_VERSIONS_FILE` loaded at server startup. Publication regenerates embeddings. Restart after updating that configuration. Archiving blocks new reviews but preserves catalogs, reports and existing session snapshots. Editing extracted text does not generate a revised PDF or confer institutional approval.

| Method | Path | Body / result |
|---|---|---|
| POST | `/documents/:id/draft` | `{version}` → separate draft, new document ID and parent ID |
| POST | `/documents/:id/edit` | `{revision,title,sections:[{title,text}]}` → saved draft; section IDs regenerated |
| POST | `/documents/:id/publish` | Admin only, `{revision}` → published document after version check and embedding |
| POST | `/documents/:id/archive` | `{revision}` → archived document |
| POST | `/sessions/:id/flags` | Study coordinator, `{description}` → persistent additional follow-up flag |
| GET / POST | `/sessions/:id/follow-ups` | Study coordinator; GET returns flags/history and permitted assignees; POST `{flagId,revision,status,assigneeId,dueAt,note}` |
| GET | `/notifications` | Scoped inbox of unresolved unassigned/own follow-ups, with overdue state |
| GET / POST | `/studies/:studyId/settings` | Scoped GET; admin POST `{revision,maxAttempts,reminderDays,notificationsEnabled}` |
| POST | `/sessions/:id/acknowledgment` | Participant cookie only, completed review, `{accepted:true}` → timestamped completion acknowledgment |

Document, follow-up and settings writes reject stale revisions with 409. Follow-up states are `open`, `acknowledged`, `resolved`; resolving requires a note. Assignments must reference an enabled account with study access. Notes are redacted, and every update retains account ID, time, status, assignee and due date in history. Resolving a flag does not change the original assessment or remove its question from the report. Acknowledged flags remain unresolved and eligible for reminders.

Settings default to two total teach-back attempts (range 1–3), seven days to follow up (range 1–30), and enabled inbox notifications. Attempts and default reminder days are snapshotted at review creation; changes apply to new reviews. Inbox/delivery enablement applies immediately. These controls do not change the clinical grading rubric. The frontend exposes only these server-supported settings.

The participant acknowledgment stores the exact displayed text, timestamp, document version and patient-access actor. Coordinators cannot submit it. It proves an acknowledgment through review access, not verified identity, a clinical signature or participation consent. Repeated acknowledgments retain the original record. Reports always return `consentObtained:false`, preserve unresolved flags and include acknowledgment/follow-up history.

## Request reliability and live progress

`GET /sessions/:id` includes a monotonic `revision`. The browser conversation polls visible reviews every 2.5 seconds, including during voice, and refreshes after a call ends. Only tool interactions form the durable voice transcript. Text drafts retain the revision at which typing began, so a remote advance produces a 409 instead of grading against the next section.

For `POST /sessions`, supply `Idempotency-Key` (8–100 letters/digits/underscore/hyphen); creation is deduplicated per coordinator and key. For `/messages`, `/responses`, `/questions`, `/audio` and `/acknowledgment`, send `Idempotency-Key` plus `If-Match: <revision>`. A successful mutation and its replay receipt are persisted together. A repeated key/content returns the saved result without regrading or retranscribing, even after a restart. Reusing a key for different content or submitting a stale revision returns 409. Audio identity uses a byte hash and MIME type. The frontend keeps an uncertain submission's key until success or a conflict; a conflict requires a refresh and intentional new submission. Headerless legacy HTTP callers remain supported but do not receive replay/conflict protection. ElevenLabs tools require equivalent `requestId`/`expectedRevision` body fields.

Persistence and locks support one server process. Do not run multiple writers against the same JSON data directory. Receipts, transcripts, history and notifications are retained with the state file; production retention, pagination and distributed transactional storage are separate deployment work.

## Optional external notifications

The coordinator inbox works without any external service. To enable actual outbound alerts, an operator must configure `NOTIFICATION_WEBHOOK_URL` (HTTPS, no embedded credentials), `NOTIFICATION_WEBHOOK_SECRET` (at least 32 characters), and explicitly set `NOTIFICATION_DELIVERY_ENABLED=true`. Defaults are disabled. No real notification was sent during implementation/tests.

| Method | Path | Purpose |
|---|---|---|
| GET | `/notifications/delivery` | Scoped persistent delivery records and whether the relay is enabled |
| POST | `/sessions/:id/notifications` | Study coordinator, `{flagId}` → 202 queued alert for an unresolved flag |
| POST | `/notifications/:id/retry` | Study coordinator retries a failed delivery using the original delivery ID |

A worker runs every minute when enabled, queues a reminder for overdue unresolved flags, and processes up to 20 pending deliveries per tick. The persistent outbox deduplicates each flag revision and notification kind. Transient failures back off for 1, 2, 4 and 8 minutes, then stop after five attempts. Failed entries can be retried from the workspace. Resolving a flag, moving its assignee, disabling its assignee or disabling study notifications cancels pending delivery; postponing a due date cancels a pending reminder. A relay request already in flight can finish.

The webhook receives bearer authentication and an `Idempotency-Key`, with JSON `{notificationId,event,studyId,sessionId,flagId,assigneeId,dueAt}`. It receives no transcript, participant name, question text, note or source document. The institution's relay maps account/study IDs to approved recipients and handles email/SMS. It must deduplicate the persistent ID: a crash or lost HTTP response can cause a repeated request. Redirects are rejected, requests time out after ten seconds, and errors shown to clients omit provider responses and secrets. `delivered` means the relay accepted the request with 2xx; it does not prove email/SMS delivery or clinician action. There is no direct vendor-specific email/SMS adapter bundled.

Offline tests cover duplicate concurrency/restart, stale writes, audio replay, document approval/archive/snapshots, scope enforcement, follow-up persistence, settings, patient-only acknowledgment and fake relay retries/cancellation. Real provider delivery and microphone behavior require a configured smoke test.

Dictation uses authenticated `POST /sessions/:id/transcription` with a multipart `file` (audio, maximum 10 MiB). It accepts browser WebM/Opus and MP4 recordings as well as the existing audio formats and returns `{ "text": "..." }`. Raw audio and draft transcripts are not persisted by this endpoint. Completed reviews reject dictation. Submit the reviewed draft explicitly through `/messages`.

WebSocket voice requires `audio`, `interruption`, and `ping` in the ElevenLabs agent’s `conversation_config.conversation.client_events`. Provisioning includes these alongside transcript events. If upgrading an older agent, re-provision it from Voice setup or add these events in its Advanced settings; changing local code alone does not update an already provisioned remote agent. The browser SDK decodes and plays streamed audio directly; transcript polling is not the audio transport. See [ElevenLabs client events](https://elevenlabs.io/docs/eleven-agents/customization/events/client-events).

The unified chat endpoint accepts `{ "message": "..." }` (1–5000 characters). Intent classification uses the active source section, current teach-back guide, and the last six transcript entries, with PII masking. Questions, mixed question/answer messages, and ambiguous messages never consume a teach-back attempt. Only clear attempts are graded. Emergency and human-handoff detection runs before classification. Classification and routing share one session lock, revision check and durable receipt; retries do not classify or grade again. Invalid provider output fails without advancing progress. The explicit `/questions` and `/responses` endpoints remain available for existing voice tools.

### Spoken history

`POST /sessions/:id/voice-transcript` accepts `{messages: [{id, role, content, timestamp}]}` for the authenticated review. Batches contain at most 100 messages; IDs deduplicate retries and content is redacted before storage. Snapshots expose `voiceTranscript` separately from processed `transcript`. Saving observed speech never grades, advances, or changes the review revision, and speech is not used as trusted AI context. The frontend merges both histories and avoids displaying matching processed turns twice. History remains visible after ending voice and reloading the page.

### Troubleshooting startup: CORS_ORIGIN

If runtime logs report `CORS_ORIGIN`, the function reached configuration validation;
this is not the earlier missing approval-file error. In the backend project's Vercel
Environment Variables, replace `CORS_ORIGIN` with the actual frontend origin, such as
`https://frontend.example.com`. Do not paste `CORS_ORIGIN=`, quotation marks, a dashboard
path, or `*` into the value field. Multiple explicitly trusted origins use commas.
A single root slash is accepted and normalized; paths and credentials remain rejected.
If saved as a Secret, Vercel cannot reveal the old value; replace it with the verified
frontend origin. Redeploy after saving environment changes; existing deployments retain
their previous environment. Keep the same-site cookie and durable-storage requirements above.
