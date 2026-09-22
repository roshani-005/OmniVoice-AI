export type CallStatus =
  | "initiated"
  | "ringing"
  | "in-progress"
  | "transferring"
  | "completed"
  | "failed"
  | "no-answer";

export type CallDirection = "inbound" | "outbound";

export interface AudioPacket {
  event: "media" | "start" | "stop" | "mark";
  streamSid: string;
  media?: {
    payload: string; // Base64 encoded audio
    timestamp: string;
    chunk: number;
  };
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters: Record<string, string>;
  };
}

export interface TurnLatencyTrace {
  turnId: string;
  turnIndex: number;
  timestamp: string;
  userTranscript: string;
  agentResponseText: string;
  
  // Timing Waterfall in Milliseconds
  audioPacketReceivedAt: number;
  speechEndDetectedAt: number;
  sttCompletedAt: number;
  llmFirstTokenAt: number;
  llmCompletedAt: number;
  ttsFirstAudioChunkAt: number;

  // Derived Latency Metrics
  sttLatencyMs: number;       // speechEnd -> sttCompleted
  llmTtftMs: number;          // sttCompleted -> llmFirstToken (Time To First Token)
  llmTotalMs: number;         // sttCompleted -> llmCompleted
  ttsLatencyMs: number;       // llmFirstToken -> ttsFirstAudioChunk
  totalTurnLatencyMs: number; // speechEnd -> ttsFirstAudioChunk
  
  isSlaViolated: boolean;     // Exceeded SLA threshold (e.g. > 1000ms)
  toolCallsExecuted: string[];
}

export interface CallSession {
  callId: string;
  streamSid?: string;
  fromNumber: string;
  toNumber: string;
  direction: CallDirection;
  status: CallStatus;
  startedAt: number;
  endedAt?: number;
  durationSeconds?: number;
  
  turns: TurnLatencyTrace[];
  averageTurnLatencyMs: number;
  p95TurnLatencyMs: number;
  p99TurnLatencyMs: number;

  // Metadata and flags
  transferredToHuman: boolean;
  transferReason?: string;
  terminationReason?: string;
  
  // Post-call enrichment
  summary?: string;
  sentiment?: "positive" | "neutral" | "negative" | "frustrated";
  actionItems?: string[];
  whatsAppDispatched?: boolean;
  crmRecordUpdated?: boolean;
  
  // Quality & Observability flags
  hallucinationDetected?: boolean;
  guardrailViolations?: string[];
  hallucinationAuditDetails?: string;
}

export interface CrmRecord {
  id: string;
  phoneNumber: string;
  customerName: string;
  companyName?: string;
  leadStage: "new" | "contacted" | "qualified" | "appointment_booked" | "escalated";
  callCount: number;
  lastCallOutcome?: string;
  notes: string[];
  updatedAt: string;
}

export interface WhatsAppMessage {
  id: string;
  recipientPhone: string;
  template: string;
  body: string;
  status: "queued" | "sent" | "delivered" | "failed";
  timestamp: string;
}

export interface SystemObservabilityMetrics {
  totalCalls: number;
  activeCalls: number;
  completedCalls: number;
  failedCalls: number;
  callDropRatePercent: number;
  slaViolationRatePercent: number;
  
  // Latency Aggregates
  overallP50LatencyMs: number;
  overallP90LatencyMs: number;
  overallP95LatencyMs: number;
  overallP99LatencyMs: number;
  averageTtftMs: number;
  averageSttMs: number;

  // AI Quality
  totalTurnsProcessed: number;
  hallucinationCount: number;
  hallucinationRatePercent: number;
  humanEscalationsCount: number;

  // Async Queue
  pendingQueueJobs: number;
  processedQueueJobs: number;
}
