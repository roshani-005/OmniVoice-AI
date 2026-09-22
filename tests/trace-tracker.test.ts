import { describe, it, expect } from "vitest";
import { TurnTraceBuilder, calculatePercentile } from "../src/observability/trace-tracker.js";

describe("TurnTraceBuilder & Percentile Engine", () => {
  it("should accurately compute turn-by-turn latency metrics", async () => {
    const builder = new TurnTraceBuilder(1);
    
    // Simulate discrete lifecycle events
    builder.markSpeechEnd();
    await new Promise((r) => setTimeout(r, 40));
    builder.markSttComplete("Hello, I need pricing information.");

    await new Promise((r) => setTimeout(r, 50));
    builder.markLlmFirstToken();

    await new Promise((r) => setTimeout(r, 60));
    builder.markLlmComplete("Our pricing plans start at 1,499 per month.");

    await new Promise((r) => setTimeout(r, 30));
    builder.markTtsFirstChunk();

    const trace = builder.build();

    expect(trace.turnIndex).toBe(1);
    expect(trace.userTranscript).toBe("Hello, I need pricing information.");
    expect(trace.agentResponseText).toBe("Our pricing plans start at 1,499 per month.");
    expect(trace.sttLatencyMs).toBeGreaterThanOrEqual(30);
    expect(trace.llmTtftMs).toBeGreaterThanOrEqual(40);
    expect(trace.ttsLatencyMs).toBeGreaterThanOrEqual(80);
    expect(trace.totalTurnLatencyMs).toBeGreaterThanOrEqual(150);
    expect(trace.isSlaViolated).toBe(false);
  });

  it("should calculate exact mathematical percentiles", () => {
    const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

    expect(calculatePercentile(latencies, 50)).toBe(500);
    expect(calculatePercentile(latencies, 90)).toBe(900);
    expect(calculatePercentile(latencies, 95)).toBe(1000);
    expect(calculatePercentile(latencies, 99)).toBe(1000);
    expect(calculatePercentile([], 50)).toBe(0);
  });
});
