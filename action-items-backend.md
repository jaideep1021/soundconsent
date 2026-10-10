# Teach-It-Back Consent Companion: Backend Engineering Action Items

*Focus areas: Database management, Gemini API orchestration, ElevenLabs API integration, and Core Backend Infrastructure.*

## 1. Document Ingestion & RAG Pipeline
- [x] **PDF Processing Service:** Implement an endpoint to accept PDF uploads (up to 20MB). Extract text and metadata robustly.
- [x] **Version Control:** Create logic to verify the uploaded document's version against a mock "approved versions list." Reject outdated versions.
- [x] **Document Chunking & Storage:** Parse the ingested document into logical sections (Purpose, Risks, etc.) and store the embeddings in a **Vector Database** (e.g., Pinecone, Weaviate, or Postgres+pgvector). The demo uses JSON-backed vector storage and cosine-similarity retrieval.

## 2. Core LLM Orchestration (Gemini API)
- [x] **Agent Workflow:** Build the conversational orchestrator using the **Gemini API**. Implement the logic to retrieve the relevant section from the Vector DB, summarize it at a 6th-8th grade reading level, and generate teach-back questions.
- [x] **Response Grading:** Prompt the Gemini API to evaluate patient responses ("Pass" or "Fail") against the source document. Implement the state logic to retry once on failure, then gracefully move to the next section.
- [ ] **Strict Guardrails:** Implement the "Guardrail Evaluator" as a secondary check. Ensure 0% hallucination by overriding any out-of-scope medical advice with the safe fallback ("Please ask your doctor"). A secondary source-grounding evaluator and fail-closed fallback are implemented, but an absolute 0% hallucination rate is not established and remains incomplete.

## 3. Voice & Streaming Infrastructure
- [x] **TTS Integration:** Integrate the **ElevenLabs API** for low-latency, high-quality Text-to-Speech generation.
- [x] **STT Integration:** Integrate a Speech-to-Text service (e.g., Deepgram) for processing patient voice input.
- [ ] **WebRTC Setup:** Set up WebRTC (e.g., LiveKit or Pipecat) to handle bidirectional, low-latency streaming audio (targeting <800ms). The backend issues LiveKit room credentials, but the frontend client and streaming media worker are not included; end-to-end streaming and latency remain incomplete.

## 4. Middleware & Reporting
- [x] **Session & State Management:** Build the service to track the patient's progress through the form sections, logging passes, fails, and out-of-scope questions.
- [ ] **Compliance & Privacy:** Implement middleware to strip/mask PII before sending data to external LLMs. Ensure all interactions are immutably logged. Pattern-based redaction and a tamper-evident hash chain are implemented; complete de-identification and immutable/WORM audit storage remain incomplete.
- [x] **Understanding Report Generation:** Create the logic and endpoint to compile the session logs into the final "Understanding Report" for the Clinical Coordinator.

**Prototype limitations:** A secondary LLM check and fail-closed fallback reduce risk but cannot prove the PRD's absolute 0% hallucination KPI. Clinical, privacy, security, and regulatory validation are required before real-world use. LiveKit credentials are provided, but the frontend client, bidirectional media worker, measured sub-800ms streaming, complete PII de-identification, and immutable audit storage remain outstanding.
