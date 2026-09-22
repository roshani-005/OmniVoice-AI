import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { globalCallManager } from "./call-manager.js";
import { ConversationalAgent } from "../agent/agent-core.js";
import { z } from "zod";

const simulateCallSchema = z.object({
  callerPhone: z.string().default("+919876543210"),
  callerName: z.string().default("Rohan Mehta"),
  utterances: z.array(z.string()).min(1),
  forceDrop: z.boolean().default(false),
});

export const telephonyRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Inbound Telecom Webhook (TwiML / SIP response)
  server.post("/inbound", async (request, reply) => {
    const body = request.body as Record<string, string>;
    const fromNumber = body.From || "+919876543210";
    const host = request.headers.host || "localhost:3000";
    const wsProtocol = request.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";

    // Returns standard telecom streaming instruction
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Connecting you to Superfone AI receptionist.</Say>
    <Connect>
        <Stream url="${wsProtocol}://${host}/media-stream">
            <Parameter name="from" value="${fromNumber}" />
        </Stream>
    </Connect>
</Response>`;

    return reply.type("text/xml").send(twimlResponse);
  });

  // Call Status Webhook
  server.post("/status", async (request, reply) => {
    const body = request.body as Record<string, string>;
    const callSid = body.CallSid;
    const callStatus = body.CallStatus;

    if (callStatus === "completed" || callStatus === "canceled" || callStatus === "failed") {
      // End call if tracked
    }

    return reply.status(200).send({ received: true });
  });

  // Programmatic Call Simulator (For End-to-End Testing & Demos)
  server.post("/simulate-call", async (request, reply) => {
    const parse = simulateCallSchema.safeParse(request.body || {});
    if (!parse.success) {
      return reply.status(400).send({ success: false, errors: parse.error.errors });
    }

    const { callerPhone, callerName, utterances, forceDrop } = parse.data;
    const call = globalCallManager.createCall(callerPhone, "+918045689000", "inbound");
    const agent = new ConversationalAgent();
    const history: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];

    // Process each turn
    for (let i = 0; i < utterances.length; i++) {
      const userTranscript = utterances[i];
      history.push({ role: "user", content: userTranscript });

      const turnResult = await agent.processTurn({
        callerPhone,
        callerName,
        transcript: userTranscript,
        turnIndex: i + 1,
        history,
      });

      history.push({ role: "assistant", content: turnResult.responseText });
      const trace = turnResult.traceBuilder.build();
      globalCallManager.recordTurn(call.callId, trace);

      if (turnResult.transferredToHuman) {
        call.transferredToHuman = true;
        call.transferReason = turnResult.transferReason;
        call.status = "transferring";
        break;
      }
    }

    // End call and trigger background queue
    const endStatus = forceDrop ? "failed" : "completed";
    const terminationReason = forceDrop ? "Carrier Network Drop / Timeout" : "Normal Hangup";
    await globalCallManager.endCall(call.callId, endStatus, terminationReason);

    return reply.status(200).send({
      success: true,
      message: `Call ${call.callId} simulated and processed through AI voice and post-call pipeline.`,
      callId: call.callId,
      status: endStatus,
      turnsProcessed: call.turns.length,
      averageTurnLatencyMs: call.averageTurnLatencyMs,
      p95TurnLatencyMs: call.p95TurnLatencyMs,
      p99TurnLatencyMs: call.p99TurnLatencyMs,
      transferredToHuman: call.transferredToHuman,
    });
  });
};
