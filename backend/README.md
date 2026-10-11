# Teach-It-Back backend

This self-contained TypeScript API implements the backend items in `../action-items-backend.md`. No separate Git repository or backend package existed, so the backend lives in this `backend/` package.

## Run locally

Requires Node.js 20.16 or newer. From this directory:

```sh
npm ci
cp .env.example .env
# Configure GEMINI_API_KEY and replace COORDINATOR_API_KEY.
npm run dev
```

`npm run build` compiles to `dist/`, `npm start` runs the compiled server, and `npm test` runs offline tests. Gemini credentials are required to ingest documents and run RAG, teach-back grading, grounding checks, and recorded-audio transcription. ElevenLabs credentials are used for speech and its Conversational AI agent.

## ElevenLabs Conversational AI

Set `ELEVENLABS_API_KEY`, a random server-only `ELEVENLABS_TOOL_API_KEY` (at least 32 characters), and `PUBLIC_BASE_URL` to a publicly reachable HTTPS URL for this backend. The ElevenLabs service must be able to reach the URL; localhost is not reachable from ElevenLabs. Optionally set `ELEVENLABS_VOICE_ID`.

Provision or update the private voice agent and its authenticated webhook tools:

```sh
curl -X POST http://localhost:3001/agents/provision \
  -H "Authorization: Bearer $COORDINATOR_API_KEY"
```

The backend creates/updates two ElevenLabs webhook tools that call Gemini-backed session question answering and teach-back grading. It attaches them to a Gemini `gemini-2.5-flash` Conversational AI agent, enables signed-URL authorization, disables voice recording, and stores the resulting agent/tool IDs in `DATA_DIR/state.json`. To start a voice conversation, first create a review session with `POST /sessions`, then request `GET /sessions/:id/conversation-url`. The response contains `signedUrl` and `dynamicVariables` (`session_id` and the initial disclosed opening message). Pass those dynamic variables when starting the ElevenLabs conversation; never expose either API key to the client.

The webhook endpoints `/elevenlabs/tools/questions` and `/elevenlabs/tools/responses` require the bearer token configured by `ELEVENLABS_TOOL_API_KEY`. Treat the signed conversation URL as a short-lived credential. Real ElevenLabs agent provisioning and live voice calls require valid provider credentials and were not exercised by the offline test suite.

The bundled sample consent PDFs originate from ClinicalTrials.gov; consult the corresponding study records at `https://clinicaltrials.gov/study/<NCT_ID>`. The checked-in approved-version list contains only a synthetic demo entry; the historical sample PDFs are not treated as currently IRB-approved.

## Approved versions

`data/approved-versions.json` is a mock allow-list keyed by study ID. The checked-in `demo-study: 1.0` entry is demo configuration, not an actual IRB approval. `NCT01823991: 10` exists only to smoke-test ingestion with the bundled historical sample PDF; it does not mean that PDF is currently approved for a study. Replace the file with an institution-controlled list before any real use. Uploaded PDFs must include a recognizable version string; an optional multipart `version` field is checked against the version extracted from the PDF and cannot override it. Missing, mismatched, and unapproved versions are rejected.

## API

Coordinator routes require the bearer token configured by `COORDINATOR_API_KEY`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/agents/provision` | Coordinator-only create/update of the ElevenLabs Gemini-backed Conversational AI agent |
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

The backend provisions the ElevenLabs Conversational AI agent and bridges its authenticated webhooks to Gemini-backed session workflows. The frontend still needs to request signed URLs and start the ElevenLabs conversation with the returned dynamic variables; a first-party WebRTC client/media worker and measured sub-800ms end-to-end streaming path are not included. Emergency questions trigger a 911 instruction and are reported for follow-up; requests for a person trigger an immediate human-handoff response. This prototype cannot guarantee a zero hallucination rate: it uses source-only generation, a secondary source-grounding check, and fails closed to “Please ask your doctor.” It is not validated for clinical use. Do not use real patient data, deploy, or make clinical decisions without privacy, security, regulatory, accessibility, and clinical validation. Every interaction is preparatory; a human investigator conducts the final consent discussion.
