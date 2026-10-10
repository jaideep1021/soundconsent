# Teach-It-Back Consent Companion: Backend Engineering Action Items

*Focus areas: Database management, Gemini API orchestration, ElevenLabs API integration, and Core Backend Infrastructure.*

## 1. Document Ingestion & RAG Pipeline
- [ ] **PDF Processing Service:** Implement an endpoint to accept PDF uploads (up to 20MB). Extract text and metadata robustly.
- [ ] **Version Control:** Create logic to verify the uploaded document's version against a mock "approved versions list." Reject outdated versions.
- [ ] **Document Chunking & Storage:** Parse the ingested document into logical sections (Purpose, Risks, etc.) and store the embeddings in a **Vector Database** (e.g., Pinecone, Weaviate, or Postgres+pgvector).

## 2. Core LLM Orchestration (Gemini API)
- [ ] **Agent Workflow:** Build the conversational orchestrator using the **Gemini API**. Implement the logic to retrieve the relevant section from the Vector DB, summarize it at a 6th-8th grade reading level, and generate teach-back questions.
- [ ] **Response Grading:** Prompt the Gemini API to evaluate patient responses ("Pass" or "Fail") against the source document. Implement the state logic to retry once on failure, then gracefully move to the next section.
- [ ] **Strict Guardrails:** Implement the "Guardrail Evaluator" as a secondary check. Ensure 0% hallucination by overriding any out-of-scope medical advice with the safe fallback ("Please ask your doctor").

## 3. Voice & Streaming Infrastructure
- [ ] **TTS Integration:** Integrate the **ElevenLabs API** for low-latency, high-quality Text-to-Speech generation.
- [ ] **STT Integration:** Integrate a Speech-to-Text service (e.g., Deepgram) for processing patient voice input.
- [ ] **WebRTC Setup:** Set up WebRTC (e.g., LiveKit or Pipecat) to handle bidirectional, low-latency streaming audio (targeting <800ms).

## 4. Middleware & Reporting
- [ ] **Session & State Management:** Build the service to track the patient's progress through the form sections, logging passes, fails, and out-of-scope questions.
- [ ] **Compliance & Privacy:** Implement middleware to strip/mask PII before sending data to external LLMs. Ensure all interactions are immutably logged.
- [ ] **Understanding Report Generation:** Create the logic and endpoint to compile the session logs into the final "Understanding Report" for the Clinical Coordinator.
