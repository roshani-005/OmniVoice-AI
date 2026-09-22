# 📋 CV Bullet Points for Superfone Application

Here are ready-to-use, high-impact resume bullet points tailored specifically for Superfone's **Backend Engineering Intern (AI Systems)** role.

---

### Project Title: **OmniVoice-AI: Distributed VoIP & WhatsApp AI Agent Gateway with Call Observability**
*Technologies: Node.js, TypeScript, Fastify, WebSockets, Redis / BullMQ, Audio Processing (G.711 / PCM), Vitest, Docker*

#### Option A: 4 High-Impact Bullet Points (Recommended for Resume)
- **Engineered a distributed real-time telecom gateway** in **Node.js/TypeScript** with **Fastify & WebSockets**, streaming bi-directional VoIP audio (G.711 $\mu$-law/PCM) for AI voice receptionists handling multi-turn caller interactions.
- **Instrumented end-to-end Call Observability & Latency Waterfall Tracking**, isolating millisecond-level timings for Speech-to-Text ($T_{\text{STT}}$), Time-to-First-Token ($T_{\text{TTFT}}$), and audio packet synthesis ($T_{\text{TTS}}$), computing rolling $p50, p95, p99$ metrics to prevent voice jitter and guarantee sub-900ms round-trip responses.
- **Architected asynchronous post-call distributed workflows** utilizing a concurrent job queue to decouple telephony from external dependencies, automatically generating call summaries, updating CRM contact stages, and dispatching personalized WhatsApp follow-ups within 250ms of call completion.
- **Implemented automated Guardrail & Hallucination Auditing**, enforcing compliance checks (preventing unauthorized discount promises >15% and invalid SLA claims) and orchestrating seamless live WebSocket handoffs to human tier-2 support when caller frustration was detected.

---

#### Option B: Concise 3-Bullet Version (For space-constrained 1-page CVs)
- **Built a high-throughput Node.js/TypeScript VoIP gateway** streaming bidirectional audio over WebSockets with VAD energy detection and automated tool execution (appointment booking, account queries, and human escalation).
- **Designed a real-time Telemetry & Latency Waterfall engine** tracking $p50, p95, p99$ latency spikes across STT, LLM TTFT, and TTS packetization, maintaining strict adherence to a 1200ms round-trip SLA.
- **Developed asynchronous post-call pipeline with Redis/BullMQ-style workers**, automating WhatsApp message dispatch, CRM synchronization, and post-call compliance audits to detect agent hallucinations and policy drift.

---

### Key Interview Talking Points (If Asked by Founders from Flipkart/PhonePe)

1. **Why Node.js over Python for Voice Telecom?**
   > *"Voice telephony requires handling thousands of concurrent duplex WebSocket audio streams (20ms packet intervals). Python's GIL and thread overhead make it sub-optimal for high-concurrency low-latency I/O. Node.js's non-blocking event loop with Fastify handles high network throughput with minimal memory footprint."*

2. **How do you handle Call Dropouts and Latency Spikes?**
   > *"We instrumented granular turn traces capturing $T_{\text{speech\_end}} \to T_{\text{STT}} \to T_{\text{TTFT}} \to T_{\text{TTS\_first\_chunk}}$. By tracking rolling $p95$ and $p99$ percentiles, we pinpoint whether latency spikes stem from carrier audio jitter, LLM inference queues, or network serialization."*

3. **How does this prevent simple 'API Wrapper' pitfalls?**
   > *"Wrappers treat AI as a synchronous request-response black box. OmniVoice-AI treats AI as an asynchronous distributed system: full-duplex VoIP audio streaming, interruption barge-in, isolated background worker queues for WhatsApp/CRM sync, and post-call hallucination evaluators."*
