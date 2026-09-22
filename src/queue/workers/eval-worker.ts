import { Job } from "../queue-manager.js";
import { auditCallTranscript } from "../../agent/guardrails.js";
import { globalMetricsAggregator } from "../../observability/metrics-aggregator.js";

export interface EvalPayload {
  callId: string;
}

export async function handleHallucinationAudit(job: Job<EvalPayload>): Promise<void> {
  const call = globalMetricsAggregator.getCall(job.payload.callId);
  if (!call) return;

  const auditResult = auditCallTranscript(
    call.turns.map((t) => ({
      userTranscript: t.userTranscript,
      agentResponseText: t.agentResponseText,
    }))
  );

  call.hallucinationDetected = auditResult.hallucinationDetected;
  call.guardrailViolations = auditResult.violations;
  call.hallucinationAuditDetails = auditResult.explanation;
}
