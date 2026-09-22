import { WebSocket } from "ws";
import { globalCallManager } from "./call-manager.js";
import { ConversationalAgent } from "../agent/agent-core.js";
import { AudioProcessor } from "./audio-processor.js";
import { AudioPacket } from "../types/telephony.js";

export class MediaStreamHandler {
  private agent = new ConversationalAgent();

  handleConnection(ws: WebSocket): void {
    let streamSid = "";
    let callId = "";
    let callerPhone = "+919876543210";
    let turnIndex = 0;
    const conversationHistory: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];

    ws.on("message", async (data: string) => {
      try {
        const msg: AudioPacket = JSON.parse(data.toString());

        switch (msg.event) {
          case "start": {
            streamSid = msg.start?.streamSid || `stream-${Date.now()}`;
            callerPhone = msg.start?.customParameters?.from || "+919876543210";
            const call = globalCallManager.createCall(callerPhone, "+918045689000", "inbound", streamSid);
            callId = call.callId;

            // Send greeting audio back over WebSocket
            const greetingText = "Hello! Thank you for calling Superfone. How can I assist your business today?";
            conversationHistory.push({ role: "assistant", content: greetingText });
            this.sendAudioResponse(ws, streamSid, greetingText);
            break;
          }

          case "media": {
            if (!msg.media?.payload) return;

            // Decode mu-law audio frame
            const pcmSamples = AudioProcessor.decodeUlawBase64(msg.media.payload);
            const isSpeaking = AudioProcessor.isSpeechActive(pcmSamples);

            // In our live stream, we can process conversational turns
            break;
          }

          case "stop": {
            if (callId) {
              await globalCallManager.endCall(callId, "completed", "Caller ended stream");
            }
            break;
          }
        }
      } catch (err) {
        // Handle malformed packet
      }
    });

    // Custom helper for client simulators sending simulated spoken text turns
    ws.on("text_turn", async (textTurn: { transcript: string; callerPhone?: string }) => {
      turnIndex += 1;
      const effectivePhone = textTurn.callerPhone || callerPhone;
      conversationHistory.push({ role: "user", content: textTurn.transcript });

      const result = await this.agent.processTurn({
        callerPhone: effectivePhone,
        transcript: textTurn.transcript,
        turnIndex,
        history: conversationHistory,
      });

      conversationHistory.push({ role: "assistant", content: result.responseText });

      if (callId) {
        const turnTrace = result.traceBuilder.build();
        globalCallManager.recordTurn(callId, turnTrace);

        if (result.transferredToHuman) {
          const call = globalCallManager.getCall(callId);
          if (call) {
            call.transferredToHuman = true;
            call.transferReason = result.transferReason;
            call.status = "transferring";
          }
        }

        // Send turn trace and audio frames back to the client
        ws.send(
          JSON.stringify({
            event: "turn_complete",
            callId,
            turn: turnTrace,
            responseText: result.responseText,
            transferredToHuman: result.transferredToHuman,
          })
        );
      }

      this.sendAudioResponse(ws, streamSid, result.responseText);
    });

    ws.on("close", async () => {
      if (callId) {
        await globalCallManager.endCall(callId, "completed", "WebSocket closed");
      }
    });
  }

  private sendAudioResponse(ws: WebSocket, streamSid: string, text: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;

    // Generate audio frames (simulated 20ms G.711 / PCM frames)
    const audioFrames = AudioProcessor.generateTtsAudioFrames(600);
    for (const [index, payload] of audioFrames.entries()) {
      ws.send(
        JSON.stringify({
          event: "media",
          streamSid,
          media: {
            payload,
            timestamp: String(Date.now()),
            chunk: index,
          },
        })
      );
    }
  }
}

export const globalMediaStreamHandler = new MediaStreamHandler();
