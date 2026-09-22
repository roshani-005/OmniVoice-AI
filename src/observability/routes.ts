import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { globalMetricsAggregator } from "./metrics-aggregator.js";
import { sentWhatsAppMessages } from "../queue/workers/whatsapp-worker.js";
import { crmDatabase, appointmentDatabase } from "../agent/tools.js";

export const observabilityRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // System Metrics & Percentiles
  server.get("/metrics", async (_request, reply) => {
    const metrics = globalMetricsAggregator.getSystemMetrics();
    return reply.status(200).send({
      success: true,
      timestamp: new Date().toISOString(),
      data: metrics,
    });
  });

  // Historical Calls List
  server.get("/calls", async (_request, reply) => {
    const calls = globalMetricsAggregator.getAllCalls().map((c) => ({
      callId: c.callId,
      fromNumber: c.fromNumber,
      status: c.status,
      startedAt: c.startedAt,
      durationSeconds: c.durationSeconds || 0,
      turnCount: c.turns.length,
      averageTurnLatencyMs: c.averageTurnLatencyMs,
      p95TurnLatencyMs: c.p95TurnLatencyMs,
      p99TurnLatencyMs: c.p99TurnLatencyMs,
      transferredToHuman: c.transferredToHuman,
      hallucinationDetected: c.hallucinationDetected || false,
      sentiment: c.sentiment || "neutral",
    }));

    return reply.status(200).send({
      success: true,
      count: calls.length,
      data: calls,
    });
  });

  // Call Deep-Dive with Latency Waterfall & Guardrail Logs
  server.get("/calls/:callId", async (request, reply) => {
    const { callId } = request.params as { callId: string };
    const call = globalMetricsAggregator.getCall(callId);

    if (!call) {
      return reply.status(404).send({ success: false, error: `Call with ID ${callId} not found` });
    }

    const crmRecord = crmDatabase.get(call.fromNumber);
    const whatsAppMessage = sentWhatsAppMessages.find((m) => m.recipientPhone === call.fromNumber);

    return reply.status(200).send({
      success: true,
      data: {
        call,
        crmRecord,
        whatsAppMessage,
      },
    });
  });

  // Live CRM & Booked Appointments
  server.get("/crm", async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      contacts: Array.from(crmDatabase.values()),
      appointments: appointmentDatabase,
      whatsAppMessages: sentWhatsAppMessages,
    });
  });
};
