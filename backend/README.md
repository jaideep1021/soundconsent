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

`npm run build` compiles to `dist/`, `npm start` runs the compiled server, and `npm test` runs offline tests. Gemini credentials are required to ingest and review documents. Voice credentials are optional until their routes are used.

The bundled sample consent PDFs originate from ClinicalTrials.gov; consult the corresponding study records at `https://clinicaltrials.gov/study/<NCT_ID>`. The checked-in approved-version list contains only a synthetic demo entry; the historical sample PDFs are not treated as currently IRB-approved.

## Approved versions

`data/approved-versions.json` is a mock allow-list keyed by study ID. The checked-in `demo-study: 1.0` entry is demo configuration, not an actual IRB approval. Replace it with an institution-controlled list before real use. Uploaded PDFs must include a recognizable version string; an optional multipart `version` field is checked against the version extracted from the PDF and cannot override it. Missing, mismatched, and unapproved versions are rejected.

## API

Coordinator routes require the bearer token configured by `COORDINATOR_API_KEY`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/documents` | Multipart PDF upload (`file`, `studyId`, optional `version`), maximum 20 MiB |
| `POST` | `/sessions` | Start review (`documentId`) and return automated-agent disclosure plus first section |
| `POST` | `/sessions/:id/responses` | Submit typed teach-back |
| `POST` | `/sessions/:id/questions` | Ask a question answered from retrieved consent text or refused |
| `POST` | `/sessions/:id/audio` | Transcribe recorded audio using Deepgram, then process it as teach-back |
| `POST` | `/sessions/:id/livekit-token` | Issue a 15-minute LiveKit WebRTC room token |
| `POST` | `/sessions/:id/speech` | Return streamed ElevenLabs audio for the latest safe response |
| `GET` | `/sessions/:id/report` | Coordinator-only understanding report |

Teach-back gets one re-explanation; a second failed attempt is flagged and advances to the next section. The report lists failed sections and out-of-scope questions. Completion states that a human must handle the final consent discussion; consent is never recorded as obtained.

## Storage, voice, and safety limitations

Documents, section vectors, and sessions are persisted as local JSON. This is structured vector storage for the demo, not a production vector database. A hash-chained append-only `audit.jsonl` provides tamper evidence for redacted interaction events. `DATA_DIR` must be on persistent, access-controlled storage in a deployment. E-mail addresses, US phone numbers, SSNs, dates of birth, common name disclosures, medical record identifiers, and street addresses are pattern-masked before LLM calls and before being stored in session/audit events. Regex masking is not de-identification. Recorded audio is sent to Deepgram and discarded by this service.

The LiveKit route issues client connection credentials; the WebRTC client and an audio worker connecting streaming STT/TTS are not included. The recorded-audio Deepgram path is not a sub-800ms streaming pipeline, and latency has not been measured. Emergency questions trigger a 911 instruction and are reported for follow-up; requests for a person trigger an immediate human-handoff response. This prototype cannot guarantee a zero hallucination rate: it uses source-only generation, a secondary source-grounding check, and fails closed to “Please ask your doctor.” It is not validated for clinical use. Do not use real patient data, deploy, or make clinical decisions without privacy, security, regulatory, accessibility, and clinical validation. Every interaction is preparatory; a human investigator conducts the final consent discussion.
