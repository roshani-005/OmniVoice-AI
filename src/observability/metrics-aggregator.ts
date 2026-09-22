import { CallSession, SystemObservabilityMetrics } from "../types/telephony.js";
import { calculatePercentile } from "./trace-tracker.js";

export class MetricsAggregator {
  private calls: Map<string, CallSession> = new Map();
  private pendingQueueJobs = 0;
  private processedQueueJobs = 0;

  recordCall(call: CallSession): void {
    this.calls.set(call.callId, call);
  }

  getCall(callId: string): CallSession | undefined {
    return this.calls.get(callId);
  }

  getAllCalls(): CallSession[] {
    return Array.from(this.calls.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  updateQueueStats(pendingDelta: number, processedDelta: number): void {
    this.pendingQueueJobs = Math.max(0, this.pendingQueueJobs + pendingDelta);
    this.processedQueueJobs = Math.max(0, this.processedQueueJobs + processedDelta);
  }

  getSystemMetrics(): SystemObservabilityMetrics {
    const allCalls = Array.from(this.calls.values());
    const totalCalls = allCalls.length;
    const activeCalls = allCalls.filter((c) => c.status === "in-progress" || c.status === "ringing").length;
    const completedCalls = allCalls.filter((c) => c.status === "completed").length;
    const failedCalls = allCalls.filter((c) => c.status === "failed" || c.status === "no-answer").length;

    const callDropRatePercent = totalCalls > 0 ? Number(((failedCalls / totalCalls) * 100).toFixed(2)) : 0;

    // Collect all turn latencies across all calls
    const allTurns = allCalls.flatMap((c) => c.turns);
    const totalTurns = allTurns.length;
    const turnLatencies = allTurns.map((t) => t.totalTurnLatencyMs);
    const ttftLatencies = allTurns.map((t) => t.llmTtftMs);
    const sttLatencies = allTurns.map((t) => t.sttLatencyMs);

    const slaViolations = allTurns.filter((t) => t.isSlaViolated).length;
    const slaViolationRatePercent = totalTurns > 0 ? Number(((slaViolations / totalTurns) * 100).toFixed(2)) : 0;

    // Quality stats
    const hallucinationCount = allCalls.filter((c) => c.hallucinationDetected).length;
    const hallucinationRatePercent = totalCalls > 0 ? Number(((hallucinationCount / totalCalls) * 100).toFixed(2)) : 0;
    const humanEscalationsCount = allCalls.filter((c) => c.transferredToHuman).length;

    const avg = (arr: number[]) => (arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

    return {
      totalCalls,
      activeCalls,
      completedCalls,
      failedCalls,
      callDropRatePercent,
      slaViolationRatePercent,
      overallP50LatencyMs: calculatePercentile(turnLatencies, 50),
      overallP90LatencyMs: calculatePercentile(turnLatencies, 90),
      overallP95LatencyMs: calculatePercentile(turnLatencies, 95),
      overallP99LatencyMs: calculatePercentile(turnLatencies, 99),
      averageTtftMs: avg(ttftLatencies),
      averageSttMs: avg(sttLatencies),
      totalTurnsProcessed: totalTurns,
      hallucinationCount,
      hallucinationRatePercent,
      humanEscalationsCount,
      pendingQueueJobs: this.pendingQueueJobs,
      processedQueueJobs: this.processedQueueJobs,
    };
  }
}

export const globalMetricsAggregator = new MetricsAggregator();
