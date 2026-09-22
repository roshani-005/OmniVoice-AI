import { describe, it, expect } from "vitest";
import { executeTool, appointmentDatabase, crmDatabase } from "../src/agent/tools.js";
import { ConversationalAgent } from "../src/agent/agent-core.js";

describe("Agent Core & Business Tools", () => {
  it("should book appointments and record into appointment and CRM stores", async () => {
    const initialAppointments = appointmentDatabase.length;
    const phone = "+919876543210";

    const res = await executeTool(
      "book_appointment",
      {
        customerName: "Rahul Sharma",
        serviceType: "Superfone AI Onboarding",
        preferredTime: "Friday at 4 PM",
      },
      phone
    );

    expect(res.success).toBe(true);
    expect(res.result.message).toContain("Rahul Sharma");
    expect(appointmentDatabase.length).toBe(initialAppointments + 1);

    const crmRecord = crmDatabase.get(phone);
    expect(crmRecord?.leadStage).toBe("appointment_booked");
  });

  it("should execute transfer_to_human tool when requested", async () => {
    const res = await executeTool(
      "transfer_to_human",
      { reason: "Customer requested human supervisor", urgency: "critical" },
      "+919876543210"
    );

    expect(res.success).toBe(true);
    expect(res.result.transferred).toBe(true);
    expect(res.result.urgency).toBe("critical");
  });

  it("should handle multi-turn conversational flow in ConversationalAgent", async () => {
    const agent = new ConversationalAgent();
    const history: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];

    const turn1 = await agent.processTurn({
      callerPhone: "+919876543210",
      transcript: "Hi, I want to book a demo for tomorrow.",
      turnIndex: 1,
      history,
    });

    expect(turn1.toolCallsExecuted).toContain("book_appointment");
    expect(turn1.responseText).toContain("priority demo");
    expect(turn1.transferredToHuman).toBe(false);

    // Turn 2: Escalation
    const turn2 = await agent.processTurn({
      callerPhone: "+919876543210",
      transcript: "Wait, I also want to talk to your manager.",
      turnIndex: 2,
      history,
    });

    expect(turn2.toolCallsExecuted).toContain("transfer_to_human");
    expect(turn2.transferredToHuman).toBe(true);
  });
});
