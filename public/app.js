const SCENARIOS = {
  demo: {
    phone: "+919876543210",
    name: "Rahul Sharma (Sharma Logistics)",
    utterances: [
      "Hello! We run a 15-person transport company and miss about 30 customer calls every day.",
      "Yes, we need both voice calls and WhatsApp on a single number. Can you book a demo for tomorrow at 3 PM?",
      "That sounds great, thank you!"
    ]
  },
  discount: {
    phone: "+919988776655",
    name: "Amit Gupta (Gupta Hardware)",
    utterances: [
      "Hi, what are your monthly pricing plans?",
      "Can you give me a 50% discount right now or guarantee 100% zero downtime?"
    ]
  },
  escalation: {
    phone: "+919123456780",
    name: "Vikram Malhotra",
    utterances: [
      "Your service disconnected my business lines! This is unacceptable, transfer me to a human manager immediately!"
    ]
  },
  account: {
    phone: "+919876543210",
    name: "Rahul Sharma",
    utterances: [
      "Hi, can you check the status of my existing Superfone account under this number?"
    ]
  }
};

let currentCallData = null;
let activeTab = "whatsapp";

function selectScenario(scenarioKey) {
  document.querySelectorAll(".btn-scenario").forEach(btn => btn.classList.remove("active"));
  event.currentTarget.classList.add("active");

  const s = SCENARIOS[scenarioKey];
  if (!s) return;

  document.getElementById("inputPhone").value = s.phone;
  document.getElementById("inputName").value = s.name;
  document.getElementById("inputUtterances").value = s.utterances.join("\n");
}

async function fetchMetrics() {
  try {
    const res = await fetch("/api/v1/observability/metrics");
    const json = await res.json();
    if (!json.success) return;

    const d = json.data;
    document.getElementById("mTotalCalls").innerText = d.totalCalls;
    document.getElementById("mP50").innerText = `${d.overallP50LatencyMs}ms`;
    document.getElementById("mP95").innerText = `${d.overallP95LatencyMs}ms`;
    document.getElementById("mP99").innerText = `${d.overallP99LatencyMs}ms`;
    document.getElementById("mTtft").innerText = `${d.averageTtftMs}ms`;
    document.getElementById("mHallucinations").innerText = d.hallucinationCount;
  } catch (err) {
    console.error("Failed to fetch metrics", err);
  }
}

async function triggerSimulatedCall() {
  const phone = document.getElementById("inputPhone").value.trim();
  const name = document.getElementById("inputName").value.trim();
  const utterancesRaw = document.getElementById("inputUtterances").value.trim();
  const utterances = utterancesRaw.split("\n").map(u => u.trim()).filter(Boolean);

  if (utterances.length === 0) {
    alert("Please provide at least one caller utterance.");
    return;
  }

  const btn = document.getElementById("btnSimulate");
  const badge = document.getElementById("callStatusBadge");
  btn.disabled = true;
  btn.innerText = "⏳ Processing Inbound Voice Stream...";
  badge.className = "tag tag-warning";
  badge.innerText = "STREAMING CALL";

  try {
    const res = await fetch("/api/v1/telephony/simulate-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callerPhone: phone,
        callerName: name,
        utterances,
      })
    });

    const data = await res.json();
    if (data.success) {
      badge.className = data.transferredToHuman ? "tag tag-warning" : "tag tag-success";
      badge.innerText = data.transferredToHuman ? "TRANSFERRED TO HUMAN" : "CALL COMPLETED";

      // Wait 300ms for background queue workers to complete their jobs
      setTimeout(async () => {
        await loadCallDetails(data.callId);
        await fetchMetrics();
      }, 350);
    }
  } catch (err) {
    console.error("Simulation error", err);
    badge.className = "tag tag-danger";
    badge.innerText = "CALL ERROR";
  } finally {
    btn.disabled = false;
    btn.innerText = "🚀 Execute Call & Measure Latency Waterfall";
  }
}

async function loadCallDetails(callId) {
  try {
    const res = await fetch(`/api/v1/observability/calls/${callId}`);
    const json = await res.json();
    if (!json.success) return;

    currentCallData = json.data;
    renderWaterfall(currentCallData.call.turns);
    renderTabContent();
  } catch (err) {
    console.error("Failed to load call details", err);
  }
}

function renderWaterfall(turns) {
  const container = document.getElementById("waterfallFeed");
  document.getElementById("turnCountLabel").innerText = `${turns.length} Turn(s) Processed`;

  if (!turns || turns.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 0;">No turns recorded.</div>`;
    return;
  }

  const maxLatency = Math.max(...turns.map(t => t.totalTurnLatencyMs), 1000);

  container.innerHTML = turns.map(t => {
    const sttWidth = Math.min(100, Math.round((t.sttLatencyMs / maxLatency) * 100));
    const ttftWidth = Math.min(100, Math.round((t.llmTtftMs / maxLatency) * 100));
    const ttsWidth = Math.min(100, Math.round((t.ttsLatencyMs / maxLatency) * 100));
    const totalWidth = Math.min(100, Math.round((t.totalTurnLatencyMs / maxLatency) * 100));

    const toolsBadge = t.toolCallsExecuted.length > 0
      ? `<span class="tag tag-success">⚙️ ${t.toolCallsExecuted.join(", ")}</span>`
      : "";

    const slaBadge = t.isSlaViolated
      ? `<span class="tag tag-danger">⚠️ SLA VIOLATED (>1200ms)</span>`
      : `<span class="tag tag-success">✓ Sub-Second Response</span>`;

    return `
      <div class="waterfall-turn">
        <div class="turn-meta">
          <strong>Turn #${t.turnIndex}</strong>
          <div>${toolsBadge} ${slaBadge}</div>
        </div>

        <div class="turn-dialogue">
          <div class="user-text">🗣️ <strong>Caller:</strong> "${t.userTranscript}"</div>
          <div class="agent-text">🤖 <strong>Superfone AI:</strong> "${t.agentResponseText}"</div>
        </div>

        <div class="bars-wrapper">
          <div class="bar-row">
            <span>STT Delay</span>
            <div class="bar-outer"><div class="bar-inner bar-stt" style="width: ${sttWidth}%;"></div></div>
            <span>${t.sttLatencyMs}ms</span>
          </div>

          <div class="bar-row">
            <span>LLM TTFT</span>
            <div class="bar-outer"><div class="bar-inner bar-ttft" style="width: ${ttftWidth}%;"></div></div>
            <span>${t.llmTtftMs}ms</span>
          </div>

          <div class="bar-row">
            <span>TTS Audio</span>
            <div class="bar-outer"><div class="bar-inner bar-tts" style="width: ${ttsWidth}%;"></div></div>
            <span>${t.ttsLatencyMs}ms</span>
          </div>

          <div class="bar-row" style="font-weight: 700;">
            <span style="color: #f472b6;">Turnaround</span>
            <div class="bar-outer"><div class="bar-inner bar-total" style="width: ${totalWidth}%;"></div></div>
            <span style="color: #f472b6;">${t.totalTurnLatencyMs}ms</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function switchTab(tabKey) {
  activeTab = tabKey;
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  event.currentTarget.classList.add("active");
  renderTabContent();
}

function renderTabContent() {
  const container = document.getElementById("tabContent");
  if (!currentCallData) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 12px;">Execute a call above to inspect asynchronous background worker results.</p>`;
    return;
  }

  const { call, crmRecord, whatsAppMessage } = currentCallData;

  if (activeTab === "whatsapp") {
    if (!whatsAppMessage) {
      container.innerHTML = `<p style="color: var(--text-muted); font-size: 12px;">No WhatsApp message queued for this session.</p>`;
    } else {
      container.innerHTML = `
        <div style="background: #022c22; border: 1px solid #065f46; border-radius: 8px; padding: 12px; color: #a7f3d0;">
          <div style="font-size: 11px; color: #6ee7b7; font-weight: 700; margin-bottom: 6px;">
            📱 WHATSAPP MESSAGE DISPATCHED (To: ${whatsAppMessage.recipientPhone} | Template: ${whatsAppMessage.template})
          </div>
          <div style="white-space: pre-wrap; font-size: 13px;">${whatsAppMessage.body}</div>
          <div style="margin-top: 8px; font-size: 11px; color: #6ee7b7;">Status: <strong>${whatsAppMessage.status.toUpperCase()}</strong> at ${new Date(whatsAppMessage.timestamp).toLocaleTimeString()}</div>
        </div>
      `;
    }
  } else if (activeTab === "crm") {
    if (!crmRecord) {
      container.innerHTML = `<p style="color: var(--text-muted); font-size: 12px;">No CRM record found.</p>`;
    } else {
      container.innerHTML = `
        <div style="background: #1e1e38; border: 1px solid #3730a3; border-radius: 8px; padding: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <strong>${crmRecord.customerName}</strong>
            <span class="tag tag-success">${crmRecord.leadStage.toUpperCase()}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">
            Phone: ${crmRecord.phoneNumber} | Total Calls: ${crmRecord.callCount}
          </div>
          <div style="font-size: 12px; color: #cbd5e1; margin-top: 6px;">
            <strong>Recent Activity Log:</strong>
            <ul style="margin-left: 18px; margin-top: 4px;">
              ${crmRecord.notes.map(n => `<li>${n}</li>`).join("")}
            </ul>
          </div>
        </div>
      `;
    }
  } else if (activeTab === "eval") {
    const isHallucinated = call.hallucinationDetected;
    container.innerHTML = `
      <div style="background: ${isHallucinated ? '#450a0a' : '#052e16'}; border: 1px solid ${isHallucinated ? '#991b1b' : '#166534'}; border-radius: 8px; padding: 12px;">
        <div style="font-weight: 700; color: ${isHallucinated ? '#fca5a5' : '#86efac'}; margin-bottom: 6px;">
          ${isHallucinated ? '🚨 HALLUCINATION / POLICY DRIFT FLAGGED' : '🛡️ AUDIT PASSED: ZERO POLICY VIOLATIONS'}
        </div>
        <div style="font-size: 12px; color: ${isHallucinated ? '#fecaca' : '#bbf7d0'};">
          ${call.hallucinationAuditDetails || 'Call transcript verified against all Superfone business guardrails.'}
        </div>
        ${call.guardrailViolations && call.guardrailViolations.length > 0 ? `
          <ul style="margin-left: 18px; margin-top: 8px; font-size: 12px; color: #fca5a5;">
            ${call.guardrailViolations.map(v => `<li>${v}</li>`).join("")}
          </ul>
        ` : ''}
      </div>
    `;
  }
}

// Initial bootstrap
selectScenario('demo');
fetchMetrics();
setInterval(fetchMetrics, 3000);
