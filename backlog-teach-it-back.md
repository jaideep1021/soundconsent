# Engineering Backlog: Teach-It-Back Consent Companion

This document translates the PRD into actionable Epics and User Stories for the engineering team.

---

## Epic 1: Document Ingestion & Verification
**Goal:** Ingest the PDF consent form, verify its version, and break it down into logical sections.

* **Story 1.1:** As a Clinical Coordinator, I want to upload an ICF PDF so that the system can process it.
  * *Acceptance Criteria (AC):* Accepts PDF uploads up to 20MB. Successfully extracts text and metadata.
* **Story 1.2:** As the System, I need to verify the uploaded ICF version against a mock "approved versions list" so that outdated forms are rejected.
  * *AC:* If version is outdated, system halts and shows an error to the Coordinator.
* **Story 1.3:** As the System, I need to chunk the ingested document into logical sections (e.g., Purpose, Risks, Alternatives, Withdrawal).
  * *AC:* Text is accurately divided and stored in a vector DB or structured JSON for the LLM to access.

## Epic 2: Core Conversational Agent (LLM Engine)
**Goal:** The underlying intelligence that summarizes text, checks comprehension, and handles strict guardrails.

* **Story 2.1:** As a Patient, I want the agent to explain a specific section of the ICF in plain, easy-to-understand language.
  * *AC:* Reading level target is 6th-8th grade.
* **Story 2.2:** As a Patient, I want the agent to ask me a teach-back question (e.g., "Can you explain this in your own words?") after summarizing a section.
* **Story 2.3:** As the System, I need to grade the patient's teach-back response against the source document.
  * *AC:* Agent determines "Pass" (move to next section) or "Fail" (re-explain once).
* **Story 2.4:** As a Patient who failed a teach-back check twice, I need the agent to politely move me to the next section so I don't get stuck.
  * *AC:* System logs the failure for the final report.
* **Story 2.5 (Guardrails):** As the System, if the patient asks an out-of-scope medical question, I must strictly refuse to answer and instruct them to ask their doctor.
  * *AC:* 0% Hallucination rate on medical advice. Strict prompt engineering required.

## Epic 3: User Interface & Voice Integration
**Goal:** Build the interface where the patient interacts with the agent (Chat and Voice).

* **Story 3.1:** As a Patient, I want a chat interface (accessible on mobile or iPad) to read and type responses to the agent.
* **Story 3.2:** As a Patient, I want the option to speak to the agent using my voice.
  * *AC:* Integrate **ElevenLabs API** for high-quality text-to-speech (TTS) responses. Integrate a speech-to-text (STT) provider for patient input.
* **Story 3.3:** As a Patient, I need the agent to state at the beginning of the interaction that it is an automated AI and not a human doctor.

## Epic 4: The Understanding Report
**Goal:** Provide the clinical team with actionable insights on the patient's comprehension.

* **Story 4.1:** As a Clinical Coordinator, I want a final "Understanding Report" generated at the end of the session.
  * *AC:* Report highlights which sections the patient passed and which sections they failed/struggled with.
* **Story 4.2:** As a Clinical Coordinator, I want the report to list any out-of-scope medical questions the patient asked, so I can address them in person.

---
**Development Notes for Eng:** 
- Use ClinicalTrials.gov API to pull 3-5 sample PDFs for the mock dataset.
- Prioritize evaluating the Prompt Guardrails (Epic 2.5) thoroughly before finalizing the Voice TTS loop.
