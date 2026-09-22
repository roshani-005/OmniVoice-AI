import { CrmRecord } from "../types/telephony.js";
import { v4 as uuidv4 } from "uuid";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// In-Memory CRM Store
export const crmDatabase: Map<string, CrmRecord> = new Map([
  [
    "+919876543210",
    {
      id: "crm-101",
      phoneNumber: "+919876543210",
      customerName: "Rahul Sharma",
      companyName: "Sharma Logistics Ltd.",
      leadStage: "contacted",
      callCount: 2,
      lastCallOutcome: "Requested VoIP pricing details",
      notes: ["Interested in connecting 15 phone lines to single WhatsApp inbox."],
      updatedAt: new Date().toISOString(),
    },
  ],
  [
    "+919123456780",
    {
      id: "crm-102",
      phoneNumber: "+919123456780",
      customerName: "Priya Patel",
      companyName: "Patel Dental Clinic",
      leadStage: "qualified",
      callCount: 1,
      lastCallOutcome: "Wants automated receptionist for patient appointment booking",
      notes: ["High priority: 50+ missed patient calls per day."],
      updatedAt: new Date().toISOString(),
    },
  ],
]);

export interface Appointment {
  id: string;
  phoneNumber: string;
  customerName: string;
  serviceType: string;
  preferredTime: string;
  createdAt: string;
}

export const appointmentDatabase: Appointment[] = [];

export const TOOLS: ToolDefinition[] = [
  {
    name: "book_appointment",
    description: "Schedules a demo or onboarding consultation for the caller.",
    parameters: {
      type: "object",
      properties: {
        customerName: { type: "string", description: "Name of the customer" },
        serviceType: { type: "string", description: "Product demo, AI receptionist setup, or VoIP pricing" },
        preferredTime: { type: "string", description: "Requested date and time (e.g. tomorrow at 3 PM)" },
      },
      required: ["customerName", "serviceType", "preferredTime"],
    },
  },
  {
    name: "lookup_account",
    description: "Looks up customer CRM details and current plan using their phone number.",
    parameters: {
      type: "object",
      properties: {
        phoneNumber: { type: "string", description: "E.164 phone number of customer" },
      },
      required: ["phoneNumber"],
    },
  },
  {
    name: "transfer_to_human",
    description: "Transfers the call to a human telecom agent when caller asks for manager or is angry.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why transfer is needed" },
        urgency: { type: "string", enum: ["low", "medium", "critical"] },
      },
      required: ["reason"],
    },
  },
];

export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  callerPhone: string
): Promise<{ success: boolean; result: any }> {
  switch (toolName) {
    case "book_appointment": {
      const appointment: Appointment = {
        id: `apt-${uuidv4().slice(0, 8)}`,
        phoneNumber: callerPhone,
        customerName: args.customerName || "Valued Caller",
        serviceType: args.serviceType || "Superfone AI Receptionist Demo",
        preferredTime: args.preferredTime || "Tomorrow at 3:00 PM",
        createdAt: new Date().toISOString(),
      };
      appointmentDatabase.push(appointment);

      // Update CRM
      const existing = crmDatabase.get(callerPhone);
      if (existing) {
        existing.leadStage = "appointment_booked";
        existing.notes.push(`Demo booked for ${appointment.preferredTime} (${appointment.serviceType})`);
        existing.updatedAt = new Date().toISOString();
      }

      return {
        success: true,
        result: {
          appointmentId: appointment.id,
          message: `Consultation confirmed for ${appointment.customerName} on ${appointment.preferredTime}. A confirmation SMS & WhatsApp have been queued.`,
        },
      };
    }

    case "lookup_account": {
      const record = crmDatabase.get(args.phoneNumber || callerPhone);
      if (!record) {
        return {
          success: true,
          result: {
            found: false,
            message: "No existing account record found. Treating as a new potential SMB lead.",
          },
        };
      }
      return {
        success: true,
        result: {
          found: true,
          customerName: record.customerName,
          companyName: record.companyName,
          leadStage: record.leadStage,
          callCount: record.callCount,
          lastNotes: record.notes.slice(-2),
        },
      };
    }

    case "transfer_to_human": {
      return {
        success: true,
        result: {
          transferred: true,
          reason: args.reason,
          urgency: args.urgency || "medium",
          message: "Initiating seamless live transfer to tier-2 human specialist. Placing on hold with priority queue tag.",
        },
      };
    }

    default:
      return { success: false, result: `Unknown tool: ${toolName}` };
  }
}
