import { CallSession, CallStatus, TurnLatencyTrace } from "../types/telephony.js";
import { globalMetricsAggregator } from "../observability/metrics-aggregator.js";
import { globalJobQueue } from "../queue/queue-manager.js";
import { calculatePercentile } from "../observability/trace-tracker.js";
import { v4 as uuidv4 } from "uuid";

export class CallManager {
  private activeCalls: Map<string, CallSession> = new Map();

  createCall(
    fromNumber: string,
    toNumber = "+918045689000",
    direction: "inbound" | "outbound" = "inbound",
    streamSid?: string
  ): CallSession {
    const callId = `call-${uuidv4().slice(0, 10)}`;
    const session: CallSession = {
      callId,
      streamSid,
      fromNumber,
      toNumber,
      direction,
      status: "in-progress",
      startedAt: Date.now(),
      turns: [],
      averageTurnLatencyMs: 0,
      p95TurnLatencyMs: 0,
      p99TurnLatencyMs: 0,
      transferredToHuman: false,
    };

    this.activeCalls.set(callId, session);
    globalMetricsAggregator.recordCall(session);
    return session;
  }

  getCall(callId: string): CallSession | undefined {
    return this.activeCalls.get(callId) || globalMetricsAggregator.getCall(callId);
  }

  getCallByStreamSid(streamSid: string): CallSession | undefined {
    for (const call of this.activeCalls.values()) {
      if (call.streamSid === streamSid) return call;
    }
    return undefined;
  }

  recordTurn(callId: string, turn: TurnLatencyTrace): void {
    const call = this.getCall(callId);
    if (!call) return;

    call.turns.push(turn);

    // Update ongoing call-level latency stats
    const turnLatencies = call.turns.map((t) => t.totalTurnLatencyMs);
    const sum = turnLatencies.reduce((a, b) => a + b, 0);
    call.averageTurnLatencyMs = Math.round(sum / turnLatencies.length);
    call.p95TurnLatencyMs = calculatePercentile(turnLatencies, 95);
    call.p99TurnLatencyMs = calculatePercentile(turnLatencies, 99);
  }

  async endCall(callId: string, status: CallStatus = "completed", terminationReason = "Normal call hangup"): Promise<CallSession | undefined> {
    const call = this.getCall(callId);
    if (!call) return undefined;

    call.status = status;
    call.endedAt = Date.now();
    call.durationSeconds = Math.max(1, Math.round((call.endedAt - call.startedAt) / 1000));
    call.terminationReason = terminationReason;

    this.activeCalls.delete(callId);
    globalMetricsAggregator.recordCall(call);

    // Dispatch Asynchronous Post-Call Workflows
    await globalJobQueue.enqueue("call_summary", { callId });
    await globalJobQueue.enqueue("crm_sync", { callId });
    await globalJobQueue.enqueue("whatsapp_followup", { callId });
    await globalJobQueue.enqueue("hallucination_audit", { callId });

    return call;
  }
}

export const globalCallManager = new CallManager();
