// SentinelFlow Browser SDK
// Captures keystroke dynamics and posts batches to the ingestion service.
// Key values are NEVER recorded — only e.code (physical key position).

const INGEST_URL = "http://localhost:8000/api/ingest";
const BATCH_INTERVAL_MS = 500;

let userId = "demo-user-001";
let sessionId = crypto.randomUUID();
let channel = "web";
let screen = "login";

// --- Scenario configuration ---------------------------------------------------
// Controls synthetic event injection used for demo / red-team testing.
// Real captured events are always included regardless of scenario.
let scenario = "normal";

const SCENARIO_PARAMS = {
  normal:  { injectSynthetic: false, syntheticDwellMs: 0,   syntheticFlightMs: 0,   jitterMs: 0   },
  fraud:   { injectSynthetic: true,  syntheticDwellMs: 80,  syntheticFlightMs: 90,  jitterMs: 5   },
  bot:     { injectSynthetic: true,  syntheticDwellMs: 60,  syntheticFlightMs: 60,  jitterMs: 0   },
  coached: { injectSynthetic: true,  syntheticDwellMs: 120, syntheticFlightMs: 140, jitterMs: 30  },
};

function setScenario(name) {
  if (!SCENARIO_PARAMS[name]) {
    console.warn(`[SentinelFlow] Unknown scenario "${name}". Valid: normal, fraud, bot, coached`);
    return;
  }
  scenario = name;
  console.log(`[SentinelFlow] Scenario set to "${name}"`);
}

// --- Event buffer -------------------------------------------------------------
let buffer = [];

function push(type, t, k = "", x = 0, y = 0) {
  buffer.push({ type, t, k, x, y });
}

// --- Listeners ----------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  push("kd", Date.now(), e.code);
});

window.addEventListener("keyup", (e) => {
  push("ku", Date.now(), e.code);
});

// Mousemove is high-frequency — sample at most once per 50 ms.
let lastMove = 0;
window.addEventListener("mousemove", (e) => {
  const now = Date.now();
  if (now - lastMove < 50) return;
  lastMove = now;
  push("mm", now, "", e.clientX, e.clientY);
});

window.addEventListener("click", (e) => {
  push("cl", Date.now(), "", e.clientX, e.clientY);
});

// --- Synthetic event injection (demo scenarios) --------------------------------
function _jitter(base, maxMs) {
  return base + Math.round((Math.random() * 2 - 1) * maxMs);
}

function _injectSyntheticBatch() {
  const p = SCENARIO_PARAMS[scenario];
  if (!p.injectSynthetic) return;

  const now = Date.now();
  const keyCodes = ["KeyA", "KeyE", "KeyR", "KeyS", "KeyT", "KeyN", "Space"];

  for (let i = 0; i < 3; i++) {
    const t0 = now - 450 + i * 150;
    const code = keyCodes[Math.floor(Math.random() * keyCodes.length)];
    const dwell = _jitter(p.syntheticDwellMs, p.jitterMs);
    push("kd", _jitter(t0,             p.jitterMs), code);
    push("ku", _jitter(t0 + dwell,     p.jitterMs), code);
  }
}

// --- Batch flush --------------------------------------------------------------
let eventsSentTotal = 0;

async function flush() {
  _injectSyntheticBatch();

  if (buffer.length === 0) return;

  const batch = buffer.splice(0, buffer.length);
  eventsSentTotal += batch.length;

  // Notify any attached UI listener.
  window.dispatchEvent(new CustomEvent("sentinelflow:sent", {
    detail: { count: batch.length, total: eventsSentTotal },
  }));

  try {
    await fetch(INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id:    userId,
        session_id: sessionId,
        channel,
        screen,
        events: batch,
      }),
    });
  } catch (err) {
    // Re-queue on network failure so events aren't lost.
    buffer.unshift(...batch);
    console.warn("[SentinelFlow] Ingest failed, events re-queued:", err.message);
  }
}

setInterval(flush, BATCH_INTERVAL_MS);

// --- Public API ---------------------------------------------------------------
window.SentinelFlow = { setScenario, get eventsSent() { return eventsSentTotal; } };
