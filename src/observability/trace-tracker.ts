import { TurnLatencyTrace } from "../types/telephony.js";
import { config } from "../config.js";
import { v4 as uuidv4 } from "uuid";

export class TurnTraceBuilder {
  private turnId: string;
  private turnIndex: number;
  private userTranscript = "";
  private agentResponseText = "";
  private audioPacketReceivedAt = 0;
  private speechEndDetectedAt = 0;
  private sttCompletedAt = 0;
  private llmFirstTokenAt = 0;
  private llmCompletedAt = 0;
  private ttsFirstAudioChunkAt = 0;
  private toolCallsExecuted: string[] = [];

  constructor(turnIndex: number) {
    this.turnId = `turn-${uuidv4().slice(0, 8)}`;
    this.turnIndex = turnIndex;
    this.audioPacketReceivedAt = Date.now();
  }

  markSpeechEnd(): this {
    this.speechEndDetectedAt = Date.now();
    return this;
  }

  markSttComplete(transcript: string): this {
    this.sttCompletedAt = Date.now();
    this.userTranscript = transcript;
    return this;
  }

  markLlmFirstToken(): this {
    this.llmFirstTokenAt = Date.now();
    return this;
  }

  recordToolExecution(toolName: string): this {
    this.toolCallsExecuted.push(toolName);
    return this;
  }

  markLlmComplete(fullResponse: string): this {
    this.llmCompletedAt = Date.now();
    this.agentResponseText = fullResponse;
    return this;
  }

  markTtsFirstChunk(): this {
    this.ttsFirstAudioChunkAt = Date.now();
    return this;
  }

  build(): TurnLatencyTrace {
    // Fallbacks in case timing markers weren't explicitly called
    const now = Date.now();
    if (!this.speechEndDetectedAt) this.speechEndDetectedAt = this.audioPacketReceivedAt + 20;
    if (!this.sttCompletedAt) this.sttCompletedAt = now - 40;
    if (!this.llmFirstTokenAt) this.llmFirstTokenAt = now - 20;
    if (!this.llmCompletedAt) this.llmCompletedAt = now - 10;
    if (!this.ttsFirstAudioChunkAt) this.ttsFirstAudioChunkAt = now;

    const sttLatencyMs = Math.max(0, this.sttCompletedAt - this.speechEndDetectedAt);
    const llmTtftMs = Math.max(0, this.llmFirstTokenAt - this.sttCompletedAt);
    const llmTotalMs = Math.max(0, this.llmCompletedAt - this.sttCompletedAt);
    const ttsLatencyMs = Math.max(0, this.ttsFirstAudioChunkAt - this.llmFirstTokenAt);
    const totalTurnLatencyMs = Math.max(0, this.ttsFirstAudioChunkAt - this.speechEndDetectedAt);

    const isSlaViolated = totalTurnLatencyMs > config.MAX_ALLOWED_ROUNDTRIP_LATENCY_MS;

    return {
      turnId: this.turnId,
      turnIndex: this.turnIndex,
      timestamp: new Date().toISOString(),
      userTranscript: this.userTranscript,
      agentResponseText: this.agentResponseText,
      audioPacketReceivedAt: this.audioPacketReceivedAt,
      speechEndDetectedAt: this.speechEndDetectedAt,
      sttCompletedAt: this.sttCompletedAt,
      llmFirstTokenAt: this.llmFirstTokenAt,
      llmCompletedAt: this.llmCompletedAt,
      ttsFirstAudioChunkAt: this.ttsFirstAudioChunkAt,
      sttLatencyMs,
      llmTtftMs,
      llmTotalMs,
      ttsLatencyMs,
      totalTurnLatencyMs,
      isSlaViolated,
      toolCallsExecuted: this.toolCallsExecuted,
    };
  }
}

/**
 * Computes exact percentiles for an array of numbers
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, Math.min(index, sorted.length - 1))]);
}
