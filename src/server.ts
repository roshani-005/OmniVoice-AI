import Fastify from "fastify";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { globalMediaStreamHandler } from "./telephony/media-stream.js";
import { telephonyRoutes } from "./telephony/routes.js";
import { observabilityRoutes } from "./observability/routes.js";
import { globalJobQueue } from "./queue/queue-manager.js";
import { handleCallSummary } from "./queue/workers/summary-worker.js";
import { handleCrmSync } from "./queue/workers/crm-worker.js";
import { handleWhatsAppFollowup } from "./queue/workers/whatsapp-worker.js";
import { handleHallucinationAudit } from "./queue/workers/eval-worker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Fastify Server
export const server = Fastify({
  logger: {
    level: config.LOG_LEVEL,
  },
});

async function registerApp() {
  // CORS configuration
  await server.register(cors, {
    origin: "*",
  });

  // WebSocket support
  await server.register(websocket);

  // Static Assets (Web Dashboard & Simulator)
  const publicPath = path.join(__dirname, "..", "public");
  await server.register(fastifyStatic, {
    root: publicPath,
    prefix: "/",
  });

  // Register Background Queue Workers
  globalJobQueue.registerWorker("call_summary", handleCallSummary);
  globalJobQueue.registerWorker("crm_sync", handleCrmSync);
  globalJobQueue.registerWorker("whatsapp_followup", handleWhatsAppFollowup);
  globalJobQueue.registerWorker("hallucination_audit", handleHallucinationAudit);

  // Healthcheck
  server.get("/health", async () => ({
    status: "healthy",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: "OmniVoice-AI Telecom Gateway",
  }));

  // Telephony Webhooks & Simulators
  await server.register(telephonyRoutes, { prefix: "/api/v1/telephony" });

  // Observability & Metrics Endpoints
  await server.register(observabilityRoutes, { prefix: "/api/v1/observability" });

  // WebSocket Telecom Media Stream Endpoint
  server.get("/media-stream", { websocket: true }, (socket, req) => {
    server.log.info("Inbound telecom WebSocket media stream connected");
    globalMediaStreamHandler.handleConnection(socket);
  });
}

async function start() {
  try {
    await registerApp();
    await server.listen({ port: config.PORT, host: config.HOST });
    console.log(`\n===============================================================`);
    console.log(`🚀 OmniVoice-AI Telecom & Observability Gateway running!`);
    console.log(`📡 URL: http://localhost:${config.PORT}`);
    console.log(`📊 Dashboard: http://localhost:${config.PORT}/index.html`);
    console.log(`📞 Inbound Telephony Webhook: http://localhost:${config.PORT}/api/v1/telephony/inbound`);
    console.log(`📈 Metrics API: http://localhost:${config.PORT}/api/v1/observability/metrics`);
    console.log(`===============================================================\n`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Start when executed directly
if (process.env.NODE_ENV !== "test") {
  start();
}
