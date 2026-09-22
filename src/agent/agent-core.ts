import { executeTool, TOOLS } from "./tools.js";
import { evaluateAgentTurnGuardrails } from "./guardrails.js";
import { TurnTraceBuilder } from "../observability/trace-tracker.js";
import { config } from "../config.js";

export interface AgentTurnInput {
  callerPhone: string;
  callerName?: string;
  transcript: string;
  turnIndex: number;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}

export interface AgentTurnOutput {
  responseText: string;
  toolCallsExecuted: string[];
  transferredToHuman: boolean;
  transferReason?: string;
  traceBuilder: TurnTraceBuilder;
}

export class ConversationalAgent {
  private systemPrompt: string;

  constructor() {
    this.systemPrompt = `You are "Superfone AI", an intelligent, warm, and professional AI voice receptionist and sales agent for Superfone - India's premier DOT-licensed AI Telecom Operator.
Your job is to answer incoming business calls from SMB owners, explain how Superfone powers their VoIP telephony and WhatsApp from a single number, qualify leads, and book product demos.

CRITICAL VOICE INSTRUCTIONS:
1. Speak concisely in natural conversational sentences (1-3 sentences maximum, under 40 words).
2. Avoid bullet points, asterisks, or markdown formatting since your output is spoken aloud via TTS.
3. If the user wants a demo or consultation, extract their preferred time and invoke book_appointment.
4. If the user is furious, demands a manager, or asks about complex legal terms, invoke transfer_to_human.
5. NEVER offer discounts above 15%. NEVER promise 100% zero downtime.`;
  }

  /**
   * Process a speech turn from the caller
   */
  async processTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
    const traceBuilder = new TurnTraceBuilder(input.turnIndex);
    traceBuilder.markSpeechEnd();
    traceBuilder.markSttComplete(input.transcript);

    const userUtterance = input.transcript.trim();
    const toolCallsExecuted: string[] = [];
    let transferredToHuman = false;
    let transferReason: string | undefined;

    // Simulate TTFT (Time-To-First-Token) delay or live LLM call
    await new Promise((resolve) => setTimeout(resolve, config.SIMULATED_TTFT_LATENCY_MS));
    traceBuilder.markLlmFirstToken();

    let responseText = "";

    // 1. Check for Human Escalation Intent
    if (/manager|human|supervisor|complaint|terrible|legal/i.test(userUtterance)) {
      toolCallsExecuted.push("transfer_to_human");
      traceBuilder.recordToolExecution("transfer_to_human");
      const toolRes = await executeTool("transfer_to_human", { reason: "Caller requested manager / human agent", urgency: "critical" }, input.callerPhone);
      transferredToHuman = true;
      transferReason = "Caller requested human supervisor";
      responseText = "I completely understand. I am transferring you directly to our senior customer operations specialist right away. Please hold the line for a few seconds.";
    }
    // 2. Check for Appointment / Demo Booking Intent
    else if (/demo|book|schedule|appointment|consultation|call me tomorrow|meeting/i.test(userUtterance)) {
      toolCallsExecuted.push("book_appointment");
      traceBuilder.recordToolExecution("book_appointment");
      const toolRes = await executeTool(
        "book_appointment",
        {
          customerName: input.callerName || "Customer",
          serviceType: "Superfone AI Telecom & WhatsApp Suite",
          preferredTime: "Tomorrow at 3 PM",
        },
        input.callerPhone
      );
      responseText = "I would be glad to arrange that! I have reserved a 15-minute priority demo for tomorrow at 3 PM. You will receive an instant confirmation on WhatsApp shortly.";
    }
    // 3. Check for Pricing / Feature Inquiries
    else if (/pricing|cost|plans|how much|discount/i.test(userUtterance)) {
      if (/discount|cheap|deal/i.test(userUtterance)) {
        // Safe response adhering to the 15% max discount policy
        responseText = "Our plans start at just 1,499 rupees per month. For early-stage SMBs this month, we can extend up to an authorized 10% introductory rebate on our annual plan. Shall I reserve that for you?";
      } else {
        responseText = "Our standard SMB business plan starts at 1,499 rupees a month, including unlimited incoming VoIP calls, AI receptionist routing, and full WhatsApp business inbox integration.";
      }
    }
    // 4. Check for Account / Existing Orders
    else if (/my account|my status|check order|existing number/i.test(userUtterance)) {
      toolCallsExecuted.push("lookup_account");
      traceBuilder.recordToolExecution("lookup_account");
      const toolRes = await executeTool("lookup_account", { phoneNumber: input.callerPhone }, input.callerPhone);
      if (toolRes.result.found) {
        responseText = `Welcome back, ${toolRes.result.customerName}! I found your active account for ${toolRes.result.companyName}. How can Superfone assist you today?`;
      } else {
        responseText = "I couldn't locate an existing account under this phone number, but I can help you onboard today in less than five minutes. What is your business name?";
      }
    }
    // 5. Default Warm Conversational Greeting / General QA
    else if (/hello|hi|hey|good morning|who are you/i.test(userUtterance)) {
      responseText = "Hello! Thank you for calling Superfone, India's AI Telecom Operator. I am your AI receptionist. Are you looking to set up AI phone lines or manage WhatsApp for your business?";
    } else {
      responseText = "Understood! Superfone pairs your mobile phone number with intelligent AI agents that handle your customer calls and WhatsApp automatically. Would you like to schedule a quick 10-minute walkthrough?";
    }

    // Guardrail Check
    const guardrailAudit = evaluateAgentTurnGuardrails(responseText);
    if (!guardrailAudit.passed) {
      // Self-Correction fallback if an unsafe response slipped through
      responseText = "Thank you for asking. Our team will share our official pricing and compliance guidelines directly over WhatsApp following this call.";
    }

    traceBuilder.markLlmComplete(responseText);

    // Simulate first audio chunk synthesis delay
    await new Promise((resolve) => setTimeout(resolve, config.SIMULATED_TTS_LATENCY_MS));
    traceBuilder.markTtsFirstChunk();

    return {
      responseText,
      toolCallsExecuted,
      transferredToHuman,
      transferReason,
      traceBuilder,
    };
  }
}
