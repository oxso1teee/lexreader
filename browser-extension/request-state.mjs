// One explicit request lifecycle for DOM-primary YouTube extraction.
//
// Success:
//   idle -> opening_video -> opening_transcript -> dom_collecting
//        -> resolved -> cleaned
//
// DOM failure with secondary network fallback:
//   ... -> dom_collecting -> dom_failed -> network_fallback
//       -> resolved|failed -> cleaned
// A cold, unhydrated watch document may take one bounded detour through
// dom_retrying -> opening_transcript -> dom_collecting before either path.
//
// `resolved` and `failed` are terminal outcomes. The only transition out of
// either is cleanup, so a late network error, timeout, stale callback, or
// duplicate response can never overwrite an accepted DOM success.
const ALLOWED_TRANSITIONS = {
  idle: ["opening_video", "failed"],
  opening_video: ["opening_transcript", "failed"],
  opening_transcript: ["dom_collecting", "dom_failed", "failed"],
  dom_collecting: ["resolved", "dom_retrying", "dom_failed", "failed"],
  dom_retrying: ["opening_transcript", "failed"],
  dom_failed: ["network_fallback", "failed"],
  network_fallback: ["resolved", "failed"],
  resolved: ["cleaned"],
  failed: ["cleaned"],
  cleaned: [],
};

const TERMINAL_STATES = new Set(["resolved", "failed", "cleaned"]);

export function createRequestState(
  initial = "idle",
  { setTimer = setTimeout, clearTimer = clearTimeout } = {},
) {
  let state = initial;
  let emergencyTimer = null;

  function cancelEmergency() {
    if (emergencyTimer == null) return false;
    clearTimer(emergencyTimer);
    emergencyTimer = null;
    return true;
  }

  function transition(next) {
    if (!ALLOWED_TRANSITIONS[state]?.includes(next)) return false;
    state = next;
    if (next === "resolved" || next === "failed" || next === "cleaned") {
      cancelEmergency();
    }
    return true;
  }

  return {
    get state() {
      return state;
    },
    get isTerminal() {
      return TERMINAL_STATES.has(state);
    },
    get hasEmergencyTimer() {
      return emergencyTimer != null;
    },
    // Returns true if the transition was applied, false if it was rejected
    // (e.g. attempting resolved -> failed, or any transition out of a
    // request that's already `cleaned`). Callers must treat `false` as "this
    // is a stale/duplicate/late signal -- ignore it", never as an error.
    transition,
    settleSuccess() {
      return transition("resolved");
    },
    settleFailure() {
      return transition("failed");
    },
    startEmergencyTimer(ms, onEmergency) {
      if (TERMINAL_STATES.has(state) || !Number.isFinite(ms) || ms <= 0) return false;
      cancelEmergency();
      emergencyTimer = setTimer(() => {
        emergencyTimer = null;
        if (!TERMINAL_STATES.has(state)) onEmergency();
      }, ms);
      return true;
    },
    cancelEmergency,
  };
}
