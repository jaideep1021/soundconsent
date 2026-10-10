# High-Level System Architecture: Teach-It-Back

This document outlines the proposed system architecture developed in collaboration between Product Management and the Tech Lead. It prioritizes low-latency voice interactions and strict compliance boundaries.

## System Architecture Diagram

```mermaid
flowchart TD
    %% Define User Entities
    Patient((Patient))
    Coordinator((Clinical\nCoordinator))

    %% Frontend Interfaces
    subgraph Frontend [Client Applications]
        WebUI[React Web App / iPad UI]
        VoiceUI[Voice Interface\nWebRTC/LiveKit]
    end

    %% Backend Services
    subgraph Backend [Backend Orchestration Layer]
        API[API Gateway / Auth]
        SessionMgr[Session & State Manager\nTracks conversation state]
        Compliance[Compliance Logger\nMasks PII, Logs all interactions]
    end

    %% AI Engine (The Brain)
    subgraph AIEngine [AI & RAG Pipeline]
        Orchestrator[LLM Orchestrator\nLangChain / LlamaIndex]
        Guardrails[Guardrail Evaluator\nChecks for Hallucinations]
        LLM[Large Language Model\ne.g., GPT-4 / Claude 3]
        VectorDB[(Vector Database\nStores ICF chunks)]
    end

    %% External APIs
    subgraph External [External Services]
        STT[Speech-to-Text\ne.g., Deepgram]
        TTS[Text-to-Speech\nElevenLabs]
    end

    %% Connections - Coordinator Flow
    Coordinator -- "Uploads PDF ICF" --> WebUI
    WebUI -- "Stores Document" --> VectorDB
    WebUI -- "Views Report" --> API

    %% Connections - Patient Chat/Voice Flow
    Patient -- "Speaks" --> VoiceUI
    VoiceUI -- "Audio Stream" --> STT
    STT -- "Text" --> API
    
    Patient -- "Types Chat" --> WebUI
    WebUI -- "Text" --> API

    %% Connections - Backend to AI
    API --> SessionMgr
    SessionMgr --> Compliance
    Compliance --> Orchestrator

    %% Connections - AI internal logic
    Orchestrator -- "1. Fetches Context" --> VectorDB
    Orchestrator -- "2. Generates Answer" --> LLM
    LLM -- "3. Validates Output" --> Guardrails
    Guardrails -- "Pass/Fail" --> Orchestrator

    %% Connections - AI to Output
    Orchestrator -- "Safe Text Response" --> TTS
    TTS -- "Audio Stream" --> VoiceUI
    Orchestrator -- "Safe Text Response" --> WebUI
```

## Key Architectural Decisions (TL & PM Alignment)
1. **Low-Latency Voice (WebRTC):** We cannot use standard HTTP requests for voice. The architecture uses WebRTC (via frameworks like LiveKit or Pipecat) connecting directly to streaming STT (Speech-to-Text) and ElevenLabs TTS to keep latency under ~800ms.
2. **The "Guardrail Evaluator":** Before any LLM response is sent back to the patient, it passes through a secondary evaluation layer. If this layer detects external medical advice or facts not found in the Vector DB, it overwrites the response with the safe fallback ("Please ask your doctor").
3. **Compliance Logging:** A middleware layer strips potentially identifying information (PII) before sending text to external LLMs and logs an immutable transcript for the final Understanding Report.
