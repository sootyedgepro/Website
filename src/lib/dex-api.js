// Thin fetch wrappers for the Dex backend.
// Returns parsed JSON on success, throws { status, error, retryAfterSec? } on failure.
//
// Two endpoints:
//   /api/dex/chat       — conversational, multi-turn, tool-use enabled (primary surface)
//   /api/analyze*       — one-shot structured grading (programmatic / non-chat clients)

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty / non-JSON response
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.retryAfterSec = data?.retryAfterSec;
    throw err;
  }
  return data;
}

export function chatWithDex({ sessionId, message, email }) {
  return post("/api/dex/chat", { sessionId, message, email });
}

export function gradeSetup({ ticker, timeframe, email, userContext, range }) {
  return post("/api/analyze", { ticker, timeframe, email, userContext, range });
}

export function submitFeedback({ gradeId, email, helpful, notes }) {
  return post("/api/analyze/feedback", { gradeId, email, helpful, notes });
}

export function markOutcome({ gradeId, email, outcome, outcomePrice, entry, stop, notes }) {
  return post("/api/analyze/track-outcome", {
    gradeId,
    email,
    outcome,
    outcomePrice,
    entry,
    stop,
    notes,
  });
}
