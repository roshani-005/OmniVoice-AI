import { Job } from "../queue-manager.js";
import { WhatsAppMessage } from "../../types/telephony.js";
import { globalMetricsAggregator } from "../../observability/metrics-aggregator.js";
import { v4 as uuidv4 } from "uuid";

export interface WhatsAppPayload {
  callId: string;
}

export const sentWhatsAppMessages: WhatsAppMessage[] = [];

export async function handleWhatsAppFollowup(job: Job<WhatsAppPayload>): Promise<void> {
  const call = globalMetricsAggregator.getCall(job.payload.callId);
  if (!call) return;

  const phone = call.fromNumber;
  let bodyText = "";
  let template = "general_followup";

  if (call.transferredToHuman) {
    template = "escalation_ticket_created";
    bodyText = `Hi there! 👋 This is Superfone Support. Your call was transferred to our senior support desk (Ticket #${uuidv4().slice(0, 6)}). A dedicated specialist will reach out to you within 15 minutes.`;
  } else if (call.turns.some((t) => t.toolCallsExecuted.includes("book_appointment"))) {
    template = "appointment_confirmation";
    bodyText = `Hi there! 🎉 Thanks for speaking with Superfone AI. Your 1-on-1 priority demo is confirmed for Tomorrow at 3:00 PM. Here is your demo link: https://superfone.in/meet/${uuidv4().slice(0, 8)}. See you then!`;
  } else {
    template = "post_call_brochure";
    bodyText = `Hi there! 🚀 Thanks for calling Superfone, India's AI Telecom Operator. Missed calls mean lost revenue—pair your business number with our AI receptionists today. View our SMB plans here: https://superfone.in/plans`;
  }

  const message: WhatsAppMessage = {
    id: `wa-${uuidv4().slice(0, 8)}`,
    recipientPhone: phone,
    template,
    body: bodyText,
    status: "delivered",
    timestamp: new Date().toISOString(),
  };

  sentWhatsAppMessages.push(message);
  call.whatsAppDispatched = true;
}
