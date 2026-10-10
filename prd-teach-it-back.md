# Product Requirements Document (PRD): Teach-It-Back Consent Companion

## 1. Overview & Mission
Patients often sign informed consent forms (ICFs) for clinical trials without fully understanding the risks, procedures, or their right to withdraw. The **Teach-It-Back Consent Companion** is an AI-powered agent (accessible via Voice and Chat) that walks patients through approved consent forms section by section, verifies understanding using the AHRQ "teach-back" method, and generates an "Understanding Report" for the research team. 

**Core Rule:** The AI never persuades, takes consent itself, or offers medical advice. It only explains and checks comprehension. A human investigator always conducts the final consent discussion.

## 2. Target Personas
* **The Patient:** Diverse health literacy levels. Might be accessing the companion at home via a secure link (SMS/Email) or in the clinic waiting room via an iPad. May misunderstand complex terms (e.g., randomization) or confuse research with standard care.
* **The Clinical Coordinator / Nurse:** Overworked, runs consent processes. Needs to know *exactly* which parts of the 20-page form the patient did not understand so they can focus the in-person conversation on those specific gaps.

## 3. Core User Journey
1. **Initiation:** The Clinical Coordinator selects the current IRB-approved ICF and sends a link to the patient (or hands them a clinic tablet).
2. **Introduction:** The AI introduces itself, clearly stating it is an automated assistant designed to help explain the form, and that a human doctor/nurse will answer medical questions and take their final signature.
3. **Section-by-Section Review:** 
   * The AI summarizes a section in plain language.
   * The AI asks a teach-back question (e.g., "In your own words, can you explain what happens if you decide to leave the study early?").
   * **Success:** If the patient answers correctly, the AI moves to the next section.
   * **Failure/Fallback:** If the patient fails to demonstrate understanding, the AI will attempt to re-explain once. If the patient still struggles, the AI will **flag the issue for the human nurse but move on to the next section** to ensure the patient completes the review.
4. **Conclusion & Handoff:** The AI concludes the session and generates an "Understanding Report."
5. **Human Intervention:** The Coordinator reviews the report, noting the flagged sections, and conducts a targeted, highly efficient final consent discussion.

## 4. MVP Scope ("Good" to "Best" Milestones)
* **Modality:** Full support for both **Voice** (closer to real human conversation) and **Chat** (text-based) simultaneously.
* **Context:** Must be responsive and secure for both at-home mobile use and in-clinic tablet use.
* **Version Control:** The system must verify the ICF version being used matches the currently approved list to prevent outdated consents.

## 5. Technical Constraints & Guardrails
* **Zero Hallucination Tolerance:** The AI must only use the provided ICF as its source of truth. If a patient asks a question not explicitly covered in the text (e.g., specific drug interactions, personal medical advice), the AI must **strictly refuse to answer**, instruct the patient to discuss it with the investigator/doctor, and flag the question in the Understanding Report.
* **Tech Stack Decisions:**
  * **Voice Provider:** ElevenLabs API will be used for all Voice generation (TTS) due to its high quality and latency performance. 
  * **Core Engine:** Left to engineering discretion (e.g., standard LangChain/OpenAI architecture), provided it can integrate with ElevenLabs and handle complex PDF ingestion.

## 6. Success Metrics (KPIs)
1. **0% Hallucination Rate (Critical MVP Goal):** Absolute adherence to the source document. The agent must never invent facts or provide unverified medical advice.
2. **Teach-Back Accuracy:** The agent must accurately grade patient responses as pass/fail compared to a human benchmark.
3. **Completion Rate:** High percentage of patients completing the section-by-section review without dropping off.
