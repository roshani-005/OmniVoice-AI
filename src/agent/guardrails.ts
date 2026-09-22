import { config } from "../config.js";

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  severity: "low" | "medium" | "critical";
  checkRegex: RegExp;
  reason: string;
}

export const BUSINESS_POLICIES: PolicyRule[] = [
  {
    id: "POL-001",
    name: "Unauthorized Discount Promise",
    description: "Agent must never offer or promise discounts exceeding the authorized threshold (15%).",
    severity: "critical",
    checkRegex: /(?:(?:discount|off|rebate)\s*(?:of\s*)?([2-9][0-9]|100)%|([2-9][0-9]|100)%\s*(?:off|discount|rebate))/i,
    reason: "Agent promised a discount exceeding the authorized 15% threshold.",
  },
  {
    id: "POL-002",
    name: "100% Uptime / SLA False Guarantee",
    description: "Agent must not claim absolute 100% uptime or guaranteed zero downtime.",
    severity: "critical",
    checkRegex: /(100%\s*(uptime|guarantee|reliable)|zero\s*downtime\s*guaranteed)/i,
    reason: "Agent claimed 100% uptime or absolute zero downtime, violating telecom compliance disclosures.",
  },
  {
    id: "POL-003",
    name: "Unverified Custom Trunk Pricing",
    description: "Agent must not quote custom SIP trunk rates without sales engineer review.",
    severity: "medium",
    checkRegex: /(i\s*can\s*give\s*you\s*custom\s*rate\s*of|flat\s*rate\s*of\s*\$\d+)/i,
    reason: "Agent quoted unverified custom trunk rates without routing to sales engineer.",
  },
  {
    id: "POL-004",
    name: "Profanity / Unprofessional Tone",
    description: "Agent must maintain professional conduct even when provoked.",
    severity: "critical",
    checkRegex: /\b(shut\s*up|idiot|stupid|get\s*lost)\b/i,
    reason: "Agent generated unprofessional or hostile language.",
  },
];

export interface AuditResult {
  passed: boolean;
  violations: string[];
  hallucinationDetected: boolean;
  explanation: string;
}

/**
 * Real-time guardrail evaluation running against agent output
 */
export function evaluateAgentTurnGuardrails(agentResponse: string): AuditResult {
  const violations: string[] = [];

  for (const policy of BUSINESS_POLICIES) {
    if (policy.checkRegex.test(agentResponse)) {
      violations.push(`[${policy.severity.toUpperCase()}] ${policy.id}: ${policy.reason}`);
    }
  }

  const hallucinationDetected = violations.length > 0;
  return {
    passed: violations.length === 0,
    violations,
    hallucinationDetected,
    explanation: hallucinationDetected
      ? `Violated ${violations.length} business policy guardrail(s): ${violations.join("; ")}`
      : "Passed all business policies and guardrail constraints.",
  };
}

/**
 * Post-call deep evaluation (combines caller transcript and agent responses)
 */
export function auditCallTranscript(
  turns: Array<{ userTranscript: string; agentResponseText: string }>
): AuditResult {
  const allViolations: string[] = [];

  for (const [idx, turn] of turns.entries()) {
    const turnAudit = evaluateAgentTurnGuardrails(turn.agentResponseText);
    if (!turnAudit.passed) {
      allViolations.push(...turnAudit.violations.map((v) => `Turn #${idx + 1}: ${v}`));
    }
  }

  return {
    passed: allViolations.length === 0,
    violations: allViolations,
    hallucinationDetected: allViolations.length > 0,
    explanation: allViolations.length > 0
      ? `Audit flagged ${allViolations.length} compliance violation(s) during call.`
      : "Full call passed audit. No policy drifts or hallucinations detected.",
  };
}
