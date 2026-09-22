import { describe, it, expect } from "vitest";
import { evaluateAgentTurnGuardrails, auditCallTranscript } from "../src/agent/guardrails.js";

describe("Business Guardrails & Hallucination Auditor", () => {
  it("should pass compliant agent responses", () => {
    const response = "Our standard SMB business plan starts at 1,499 rupees a month, with full WhatsApp integration.";
    const result = evaluateAgentTurnGuardrails(response);

    expect(result.passed).toBe(true);
    expect(result.hallucinationDetected).toBe(false);
    expect(result.violations.length).toBe(0);
  });

  it("should flag unauthorized discount promises (>15%)", () => {
    const response = "I can offer you a special discount of 40% if you sign up today!";
    const result = evaluateAgentTurnGuardrails(response);

    expect(result.passed).toBe(false);
    expect(result.hallucinationDetected).toBe(true);
    expect(result.violations.some((v) => v.includes("POL-001"))).toBe(true);
  });

  it("should flag false 100% zero downtime claims", () => {
    const response = "We guarantee 100% uptime with absolute zero downtime guaranteed across all carrier networks.";
    const result = evaluateAgentTurnGuardrails(response);

    expect(result.passed).toBe(false);
    expect(result.hallucinationDetected).toBe(true);
    expect(result.violations.some((v) => v.includes("POL-002"))).toBe(true);
  });

  it("should audit complete multi-turn call transcripts", () => {
    const turns = [
      { userTranscript: "Hello", agentResponseText: "Hello, welcome to Superfone!" },
      { userTranscript: "Can I get 50% off?", agentResponseText: "Sure, I will give you 50% discount right now." },
    ];

    const audit = auditCallTranscript(turns);
    expect(audit.passed).toBe(false);
    expect(audit.hallucinationDetected).toBe(true);
    expect(audit.violations.length).toBe(1);
    expect(audit.violations[0]).toContain("Turn #2");
  });
});
