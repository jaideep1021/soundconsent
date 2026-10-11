# Teach-It-Back backend

This self-contained TypeScript API implements the backend items in `../action-items-backend.md`. No separate Git repository or backend package existed, so the backend lives in this `backend/` package.

## Run locally

Requires Node.js 20.16 or newer. From this directory:

```sh
npm ci
cp .env.example .env
# Configure GEMINI_API_KEY and the two BOOTSTRAP_COORDINATOR_* values.
npm run dev
```

`npm run build` compiles to `dist/`, `npm start` runs the compiled server, and `npm test` runs offline tests. Gemini credentials are required to ingest documents and run RAG, teach-back grading, grounding checks, and recorded-audio transcription. ElevenLabs credentials are used for speech and its Conversational AI agent.

## ElevenLabs Conversational AI

Set `ELEVENLABS_API_KEY`, a random server-only `ELEVENLABS_TOOL_API_KEY` (at least 32 characters), and `PUBLIC_BASE_URL` to a publicly reachable HTTPS URL for this backend. The ElevenLabs service must be able to reach the URL; localhost is not reachable from ElevenLabs. Optionally set `ELEVENLABS_VOICE_ID`.

Sign in through `/auth/login` and save cookies to `coordinator-cookies.txt` (or use Voice setup in the frontend). Provision or update the private voice agent and its authenticated webhook tools:

```sh
curl -X POST http://localhost:3001/agents/provision \
  -b coordinator-cookies.txt -H "Origin: http://localhost:5173"
```

The backend creates/updates two ElevenLabs webhook tools that call Gemini-backed session question answering and teach-back grading. It attaches them to a Gemini `gemini-2.5-flash` Conversational AI agent, enables signed-URL authorization, disables voice recording, and stores the resulting agent/tool IDs in `DATA_DIR/state.json`. To start a voice conversation, first create a review session with `POST /sessions`, then request `GET /sessions/:id/conversation-url`. The response contains `signedUrl` and `dynamicVariables` (`session_id`, short-lived `session_access`, `session_revision`, and the initial disclosed opening message). Pass those dynamic variables when starting the ElevenLabs conversation; never expose either API key to the client.

The webhook endpoints `/elevenlabs/tools/questions` and `/elevenlabs/tools/responses` require both the bearer token configured by `ELEVENLABS_TOOL_API_KEY` and the per-review `sessionAccess` capability populated from `session_access`. Tools also require `requestId` (8–100 letters, digits, underscores or hyphens) and `expectedRevision` (numeric string). Re-provision existing agents after upgrading so their tool schemas include these fields. A retried tool call must reuse its request ID; a revision conflict requires refreshing the review and restarting voice. Logout, expiry, account disablement, and review-access revocation invalidate the corresponding capabilities; calls already authorized and in progress can finish. Treat the signed conversation URL as a short-lived credential. Real ElevenLabs agent provisioning and live voice calls require valid provider credentials and were not exercised by the offline test suite.

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
| `POST` | `/sessions/:id/questions` | Ask a question answered from retrieved consent text or refused |
| `POST` | `/sessions/:id/audio` | Transcribe recorded audio using Gemini audio understanding, then process it as teach-back |
| `POST` | `/sessions/:id/speech` | Return streamed ElevenLabs audio for the latest safe response |
| `POST` | `/elevenlabs/tools/questions` | Authenticated ElevenLabs webhook for Gemini-grounded consent questions |
| `POST` | `/elevenlabs/tools/responses` | Authenticated ElevenLabs webhook for Gemini teach-back grading |
| `GET` | `/sessions/:id/report` | Coordinator-only understanding report |

Teach-back gets one re-explanation; a second failed attempt is flagged and advances to the next section. The report lists failed sections and out-of-scope questions. Completion states that a human must handle the final consent discussion; consent is never recorded as obtained.

## Storage, voice, and safety limitations

Documents, section vectors, and sessions are persisted as local JSON. This is structured vector storage for the demo, not a production vector database. A hash-chained append-only `audit.jsonl` provides tamper evidence for redacted interaction events. `DATA_DIR` must be on persistent, access-controlled storage in a deployment. E-mail addresses, US phone numbers, SSNs, dates of birth, common name disclosures, medical record identifiers, and street addresses are pattern-masked before LLM calls and before being stored in session/audit events. Regex masking is not de-identification. Uploaded audio is sent to Gemini for transcription and discarded by this service.

The backend provisions the ElevenLabs Conversational AI agent and bridges its authenticated webhooks to Gemini-backed session workflows. The frontend session and patient pages requests signed URLs and starts the ElevenLabs SDK conversation with the returned dynamic variables; a first-party WebRTC client/media worker and measured sub-800ms end-to-end streaming path are not included. Emergency questions trigger a 911 instruction and are reported for follow-up; requests for a person trigger an immediate human-handoff response. This prototype cannot guarantee a zero hallucination rate: it uses source-only generation, a secondary source-grounding check, and fails closed to “Please ask your doctor.” It is not validated for clinical use. Do not use real patient data, deploy, or make clinical decisions without privacy, security, regulatory, accessibility, and clinical validation. Every interaction is preparatory; a human investigator conducts the final consent discussion.

## Frontend integration

See [the frontend integration contract](../frontend/README.md#unified-workflow) for setup, both directions of API requirements, and missing services. The unified dashboard uses account authentication, authorized catalogs, session snapshots, and invitations. Its pages include document versions, study settings, coordinator follow-ups, an optional notification relay, account administration and participant review acknowledgments. Clinical identity proofing and clinical consent signing remain outside this preparatory workflow. `tests/integration-server.ts` is an isolated test fixture with a fake AI provider, never a production entry point.

## Authentication and resumable reviews

Use `BOOTSTRAP_COORDINATOR_EMAIL` and `BOOTSTRAP_COORDINATOR_PASSWORD` (12–256 characters) to initialize the first admin in an empty account store. Bootstrap never resets an existing password. Remove both bootstrap values after creation. Sign in at the frontend `/login` (legacy `/connected` links redirect to the dashboard). There are no default credentials or public registration.

Passwords use salted scrypt (N=32768, r=8, p=1); opaque cookies and invitation tokens are stored only as SHA-256 hashes. Access-code verifiers are scrypt hashes. Coordinator cookies expire after 8 hours, patient cookies after 24 hours, unused invitations after 7 days, and voice capabilities after 1 hour or parent-session expiry/revocation. Cookies are HttpOnly, SameSite=Strict, Path=/, and Secure when `COOKIE_SECURE=true` or `NODE_ENV=production`. Auth/read responses use `Cache-Control: no-store`. Cookies persist across backend restarts. Secrets are never returned by account/list/read APIs.

Use a same-origin `/api` reverse proxy (recommended), or same-site frontend/backend hosts with credentialed CORS. Strict cookies intentionally do not support a cross-site frontend/backend deployment. `CORS_ORIGIN` must list exact trusted frontend origins; cookie-authenticated mutations require an allowed `Origin` header, including requests made with curl. Browser login/redemption also reject untrusted origins. Login and invitation redemption have bounded in-process throttles; deploy this JSON-backed service as a single process. Account creation and disabling are available in the admin workspace. Distributed storage/rate limiting, MFA and password reset/recovery are broader deployment work.

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
| POST | `/sessions/:id/access/revoke` | Coordinator: revoke this review's patient/voice grants and all unused invitations |
| POST | `/sessions/:id/logout` | Revoke this browser's patient grant and child voice grants; clear its cookie |

The coordinator shares `/session/<id>#invite=<token>` and the access code separately. The frontend removes the fragment immediately and sends the token/code only in a POST body. This proves possession of two access credentials; it is not legal/clinical identity verification and collects no patient name or DOB. Coordinators can issue a fresh invitation after expiry or logout. A new invitation alone does not revoke existing patient sessions; use the explicit revoke endpoint for that.

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

For `POST /sessions`, supply `Idempotency-Key` (8–100 letters/digits/underscore/hyphen); creation is deduplicated per coordinator and key. For `/responses`, `/questions`, `/audio` and `/acknowledgment`, send `Idempotency-Key` plus `If-Match: <revision>`. A successful mutation and its replay receipt are persisted together. A repeated key/content returns the saved result without regrading or retranscribing, even after a restart. Reusing a key for different content or submitting a stale revision returns 409. Audio identity uses a byte hash and MIME type. The frontend keeps an uncertain submission's key until success or a conflict; a conflict requires a refresh and intentional new submission. Headerless legacy HTTP callers remain supported but do not receive replay/conflict protection. ElevenLabs tools require equivalent `requestId`/`expectedRevision` body fields.

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
