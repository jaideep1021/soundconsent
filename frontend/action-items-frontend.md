# Teach-It-Back Consent Companion: Frontend Engineering Action Items

*Focus areas: Minimalist UI/UX design, Chat & Voice interfaces, and Coordinator workflows.*

## 1. UI/UX Design & Architecture
- [ ] **Minimalist Design System:** Establish a clean, accessible, and minimalist design language that reduces cognitive load for patients of varying health literacy. The goal is to compete for one of the best UI/UX designs.
- [ ] **Responsive Layouts:** Ensure pixel-perfect responsiveness for both **iPad/Tablet** (in-clinic) and **Mobile** (at-home) form factors.

## 2. Patient Experience (Chat & Voice)
- [ ] **Chat Interface:** Build a smooth, intuitive chat UI for text-based interaction, including typing indicators and clear demarcations between AI and Patient messages.
- [ ] **Voice Interface:** Implement the ElevenLabs Conversational AI client to handle live audio streaming. Add visual indicators for "Listening," "Thinking," and "Speaking."
- [ ] **AI Introduction:** Ensure the initial screen clearly introduces the agent as an AI, not a human doctor, satisfying the compliance requirement.
- [ ] **Section Navigation:** Build the UI to reflect the user's progress through the form's sections without overwhelming them.

## 3. Clinical Coordinator Experience
- [ ] **Document Upload UI:** Create a simple dashboard for coordinators to select, upload, and verify ICF PDFs, handling any validation errors (e.g., outdated version) gracefully.
- [ ] **Understanding Report View:** Build a clear, actionable dashboard view to display the final "Understanding Report." Highlight failed sections and out-of-scope questions prominently so the human nurse can focus their follow-up discussion.
