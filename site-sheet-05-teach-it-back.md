# TEACH IT BACK
### Patients often say they understand when they don't. Build the consent companion that checks understanding in the patient's own words before they sign up for a trial.

---

## 1. The problem, in one breath

Before joining a trial, every patient goes through **informed consent**: a conversation and a long document explaining the study's purpose, procedures, risks, benefits, alternatives, and the right to quit at any time. Consent forms are long and technical, and visits are rushed. Patients may sign without truly understanding.

AHRQ notes that when patients are asked "Do you understand?" they often say yes when they may not, and recommends **teach-back**, asking people to explain in their own words ([AHRQ](https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/teachback.html)). AHRQ's toolkit even includes teach-back questions specifically for informed consent ([AHRQ toolkit, 3rd ed.](https://www.ahrq.gov/sites/default/files/publications2/files/health-literacy-universal-precautions-toolkit-3rd-edition.pdf)).

## 2. Your mission

**Build a consent companion (voice and/or chat) that walks a patient through an approved consent form section by section, answers questions from the form only, runs teach-back checks, and gives the research team a clear report of what the patient understood and what needs a human conversation.**

- **Input:** An approved consent form (ICF) and the patient's spoken or typed responses.
- **Output:** Section-by-section understanding results, open questions for the research team, and the version of the form used.
- **User:** A research nurse or coordinator conducting consent, and the patient.

## 3. Clinical trials in 90 seconds

- **Site agents** work for the hospital or clinic's research team, not the drug company. They run inside the hospital's own systems, especially its **electronic health record (EHR)**, and often reuse agents the hospital already runs for everyday care (the "hospital twin").
- Consent is a *process*, not a signature. The investigator or delegate must hold the actual consent discussion.
- Consent forms have **versions**. Patients must use the currently IRB-approved version.
- The agent explains and checks understanding. It never pressures, persuades, or takes consent itself.

## 4. Words you'll need

| Term | Meaning |
|---|---|
| Informed consent / ICF | The process / the document patients sign |
| Teach-back | Asking someone to explain in their own words |
| Comprehension check | Verifying key points were understood |
| Voluntariness | Joining freely, with the right to stop any time |
| ICF version | Which approved edition of the form is in use |
| Delegate | Staff authorized by the investigator to obtain consent |

## 5. How it's done today

**Who:** Investigators, research nurses, and coordinators, with interpreters when needed.

**Steps:** Read the form with the patient, answer questions, and sign. Understanding is rarely checked systematically.

**Example tools:**

| Job | Examples | Notes |
|---|---|---|
| Voice agent frameworks (open source) | [Pipecat (open-source voice agents)](https://github.com/pipecat-ai/pipecat), LiveKit Agents | Speech in, reasoning and tool calls, speech out |
| Telephony | Twilio Voice and similar programmable phone APIs | Use trial accounts and your own phones only |
| Patient education agents | Hospital pre-visit preparation tools (e.g., Epic Emmie) | Hospital twin: pre-visit preparation calls and patient education |
| eConsent platforms | Various eConsent vendors | Digital forms and signatures |

**Where it breaks:** Rushed explanations. "Any questions?" instead of real checks. No record of which points were unclear. Version mix-ups.

## 6. Data you can get (all free)

| Source | What's in it | How to use it |
|---|---|---|
| [ClinicalTrials.gov API](https://clinicaltrials.gov/data-api/about-api) | Many studies attach the **consent form PDF** in `documentSection.largeDocumentModule` | Your source documents |
| [AHRQ: the teach-back method](https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/teachback.html) · [AHRQ Health Literacy Toolkit, 3rd ed. (PDF; includes teach-back questions for informed consent)](https://www.ahrq.gov/sites/default/files/publications2/files/health-literacy-universal-precautions-toolkit-3rd-edition.pdf) | Teach-back method and consent-specific questions | Your comprehension-check design |
| [21 CFR 50.25: elements of informed consent](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-50/subpart-B/section-50.25) | The required consent elements | Make sure every element is covered |

## 7. Data you'll have to fake (and how)

- **Personas:** a patient who misunderstands randomization ("So I'll definitely get the new drug?"), one who thinks they can't quit, one who confuses research visits with regular care, a caregiver speaking for a patient, a Spanish-speaker.
- **Answer key:** the key points per section and what counts as a correct teach-back.
- **Version trap:** two ICF versions, so the agent must refuse to use the outdated one.

## 8. Build it: Good / Better / Best

**GOOD: "Section Guide."** A chat or voice companion that summarizes each ICF section in plain language, answers questions only from the form (citing the section), and runs one teach-back question per section. *Demo-able by hour 8.*

**BETTER: "Understanding Report."** Everything in Good, plus scoring teach-back answers against the key points, re-explaining when understanding fails, and producing a report for the research team ("Unclear: randomization, how to withdraw"). Test it on your personas.

**BEST: "Consent Companion."** Everything in Better, plus full voice mode with an option for a second language, version control (checks the ICF version against an "approved versions" list), accessibility features (pace, repeat, large text), and a clean hand-off for the human consent discussion.

## 9. How you'll be judged

| Criterion | What judges look for |
|---|---|
| **Solves the problem** | Would patients understand more, and would research teams know exactly where to focus? |
| **It works** | End-to-end demo. Runs from a clean clone, following the README. |
| **Smart use of data** | Real public data where it exists. Simulated data that is believable and documented. |
| **Explains itself** | Every output shows its evidence and reasoning |
| **Craft and demo** | Clean code, a clear story, and a good UI for the time available |

## 10. Rules of the road

Use public or synthetic data only, and cite every source. Vendor names are examples, not endorsements. The agent never obtains consent or persuades. A human conducts consent. Voice agents must say they are automated at the start of every call, offer a human at any point, never give medical advice, send emergencies to 911 immediately, and call only people who consented (in the U.S., the FCC treats AI voices as "artificial" under the TCPA). In your demo, call only teammates' phones.

---

## 11. Links

**Start here**
- [NIH: Clinical Research Trials and You](https://www.nih.gov/health-information/nih-clinical-research-trials-you)
- [NIAMS: What is a clinical trial?](https://niams.nih.gov/labs/clinical-trials/what-is-clinical-trial)

**The problem**
- [AHRQ: the teach-back method](https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/teachback.html)
- [AHRQ Health Literacy Toolkit, 3rd ed. (PDF; includes teach-back questions for informed consent)](https://www.ahrq.gov/sites/default/files/publications2/files/health-literacy-universal-precautions-toolkit-3rd-edition.pdf)
- [21 CFR 50.25](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-50/subpart-B/section-50.25)

**Voice building blocks**
- [Pipecat (open-source voice agents)](https://github.com/pipecat-ai/pipecat)
- [LiveKit Agents overview](https://livekit.com/blog/best-open-source-voice-and-video-ai-agent-frameworks)
- [FCC: AI voices are "artificial" under the TCPA (Cooley summary)](https://cooley.com/news/insight/2024/2024-02-15-fcc-ai-generated-robocalls-illegal-under-the-tcpa)

**Data**
- [ClinicalTrials.gov API](https://clinicaltrials.gov/data-api/about-api)

---
<sub>sage_enrollment_&_consent_support_(document_agents)</sub>
