// Lifecycle bug (M3 Slice 12 RC #3) -- explicit per-request state machine.
// idle -> waiting -> captured -> resolved -> cleaned   (success path)
// idle -> waiting -> failed -> cleaned                 (failure path)
// `resolved` and `failed` are both terminal for the *result* -- once in
// either, the only allowed next step is `cleaned`. There is no transition
// from `resolved` to `failed` or vice versa: whichever terminal result is
// reached first wins, and nothing after it can flip the outcome. This is
// the pure, testable core of "first valid result wins" -- background.mjs
// uses it directly (import works there, it's the service worker's real
// entry module); youtube-content-relay.js mirrors this exact table by hand
// (MV3 content scripts declared via manifest.json can't use `import`).
const ALLOWED_TRANSITIONS = {
  idle: ["waiting"],
  waiting: ["captured", "resolved", "failed"],
  captured: ["resolved", "failed"],
  resolved: ["cleaned"],
  failed: ["cleaned"],
  cleaned: [],
};

export function createRequestState(initial = "idle") {
  let state = initial;
  return {
    get state() {
      return state;
    },
    // Returns true if the transition was applied, false if it was rejected
    // (e.g. attempting resolved -> failed, or any transition out of a
    // request that's already `cleaned`). Callers must treat `false` as "this
    // is a stale/duplicate/late signal -- ignore it", never as an error.
    transition(next) {
      if (!ALLOWED_TRANSITIONS[state]?.includes(next)) return false;
      state = next;
      return true;
    },
  };
}
