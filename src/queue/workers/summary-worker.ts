import { Job } from "../queue-manager.js";
import { CallSession } from "../../types/telephony.js";
import { globalMetricsAggregator } from "../../observability/metrics-aggregator.js";

export interface SummaryPayload {
  callId: string;
}

export async function handleCallSummary(job: Job<SummaryPayload>): Promise<void> {
  const call = globalMetricsAggregator.getCall(job.payload.callId);
  if (!call) return;

  const turnsText = call.turns
    .map((t) => `User: "${t.userTranscript}" | Agent: "${t.agentResponseText}"`)
    .join("\n");

  // Determine sentiment based on transcripts
  let sentiment: CallSession["sentiment"] = "neutral";
  if (/furious|angry|terrible|broken|worst|sue|complaint/i.test(turnsText)) {
    sentiment = "frustrated";
  } else if (/great|thank you|awesome|perfect|helpful|love it/i.test(turnsText)) {
    sentiment = "positive";
  } else if (/problem|issue|delay|expensive/i.test(turnsText)) {
    sentiment = "negative";
  }

  // Extract action items
  const actionItems: string[] = [];
  if (call.turns.some((t) => t.toolCallsExecuted.includes("book_appointment"))) {
    actionItems.push("Calendar invite dispatched to customer email/phone");
    actionItems.push("Assign account executive for Superfone product demo");
  }
  if (call.transferredToHuman) {
    actionItems.push("Urgent: Senior support specialist follow-up within 15 minutes");
  }
  if (actionItems.length === 0) {
    actionItems.push("Send general Superfone SMB product brochure via WhatsApp");
  }

  // Generate structured summary
  const summary = `Call with ${call.fromNumber} lasted ${call.durationSeconds || 0} seconds across ${call.turns.length} voice turns. Overall customer sentiment was assessed as ${sentiment.toUpperCase()}. ${
    call.transferredToHuman
      ? `Call was escalated to human agent due to: ${call.transferReason || "Customer request"}.`
      : "Call resolved autonomously by Superfone AI Receptionist."
  }`;

  call.summary = summary;
  call.sentiment = sentiment;
  call.actionItems = actionItems;
}
