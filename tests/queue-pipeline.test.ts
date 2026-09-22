import { describe, it, expect, beforeAll } from "vitest";
import { globalCallManager } from "../src/telephony/call-manager.js";
import { globalJobQueue } from "../src/queue/queue-manager.js";
import { handleCallSummary } from "../src/queue/workers/summary-worker.js";
import { handleCrmSync } from "../src/queue/workers/crm-worker.js";
import { handleWhatsAppFollowup, sentWhatsAppMessages } from "../src/queue/workers/whatsapp-worker.js";
import { handleHallucinationAudit } from "../src/queue/workers/eval-worker.js";
import { TurnTraceBuilder } from "../src/observability/trace-tracker.js";

describe("Asynchronous Post-Call Distributed Pipeline", () => {
  beforeAll(() => {
    // Register workers
    globalJobQueue.registerWorker("call_summary", handleCallSummary);
    globalJobQueue.registerWorker("crm_sync", handleCrmSync);
    globalJobQueue.registerWorker("whatsapp_followup", handleWhatsAppFollowup);
    globalJobQueue.registerWorker("hallucination_audit", handleHallucinationAudit);
  });

  it("should process post-call jobs asynchronously upon call completion", async () => {
    const phone = "+919876543210";
    const call = globalCallManager.createCall(phone, "+918045689000", "inbound");

    // Add a completed turn with an appointment booked
    const traceBuilder = new TurnTraceBuilder(1);
    traceBuilder.markSpeechEnd();
    traceBuilder.markSttComplete("I want to book an onboarding demo.");
    traceBuilder.recordToolExecution("book_appointment");
    traceBuilder.markLlmFirstToken();
    traceBuilder.markLlmComplete("I have reserved a demo for you tomorrow.");
    traceBuilder.markTtsFirstChunk();
    const trace = traceBuilder.build();

    globalCallManager.recordTurn(call.callId, trace);

    // End call
    await globalCallManager.endCall(call.callId, "completed", "Caller ended call");

    // Allow queue to drain
    await new Promise((r) => setTimeout(r, 200));

    // Verify session enrichments
    expect(call.status).toBe("completed");
    expect(call.summary).toBeDefined();
    expect(call.summary).toContain("Call with +919876543210");
    expect(call.actionItems?.length).toBeGreaterThan(0);
    expect(call.crmRecordUpdated).toBe(true);
    expect(call.whatsAppDispatched).toBe(true);
    expect(call.hallucinationDetected).toBe(false);

    // Verify WhatsApp message was recorded
    const message = sentWhatsAppMessages.find((m) => m.recipientPhone === phone);
    expect(message).toBeDefined();
    expect(message?.status).toBe("delivered");
    expect(message?.body).toContain("demo");
  });
});
