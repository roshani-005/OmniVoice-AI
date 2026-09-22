import { Job } from "../queue-manager.js";
import { crmDatabase } from "../../agent/tools.js";
import { globalMetricsAggregator } from "../../observability/metrics-aggregator.js";
import { v4 as uuidv4 } from "uuid";

export interface CrmSyncPayload {
  callId: string;
}

export async function handleCrmSync(job: Job<CrmSyncPayload>): Promise<void> {
  const call = globalMetricsAggregator.getCall(job.payload.callId);
  if (!call) return;

  const phone = call.fromNumber;
  let record = crmDatabase.get(phone);

  if (!record) {
    record = {
      id: `crm-${uuidv4().slice(0, 8)}`,
      phoneNumber: phone,
      customerName: "SMB Inbound Caller",
      leadStage: "new",
      callCount: 1,
      notes: [],
      updatedAt: new Date().toISOString(),
    };
    crmDatabase.set(phone, record);
  } else {
    record.callCount += 1;
    record.updatedAt = new Date().toISOString();
  }

  // Update lead stage
  if (call.transferredToHuman) {
    record.leadStage = "escalated";
    record.notes.push(`[${new Date().toLocaleTimeString()}] Escalated to human support: ${call.transferReason || "Customer request"}`);
  } else if (call.turns.some((t) => t.toolCallsExecuted.includes("book_appointment"))) {
    record.leadStage = "appointment_booked";
    record.notes.push(`[${new Date().toLocaleTimeString()}] Successfully booked onboarding demo via AI Voice.`);
  } else {
    record.leadStage = "contacted";
    record.notes.push(`[${new Date().toLocaleTimeString()}] Completed ${call.durationSeconds || 0}s informational voice inquiry.`);
  }

  record.lastCallOutcome = call.summary || "Call completed";
  call.crmRecordUpdated = true;
}
