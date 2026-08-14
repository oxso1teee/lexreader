// RC extraction bug (M3 Slice 12 RC) — the generic polling primitive behind
// youtube-content-relay.js's waitForCapture(). Kept as a standalone,
// DOM/chrome-free module purely so the race/timeout algorithm itself is
// unit-testable: MV3 content scripts declared via manifest.json's
// content_scripts[].js cannot use a static `import` (only
// background.service_worker supports "type": "module"), so
// youtube-content-relay.js can't literally import this file — its own
// inline copy must be kept in sync by hand. Mirror this exact algorithm
// there if you change it here.
export function waitForValue(getValue, timeoutMs, pollIntervalMs = 200) {
  // Check immediately in case the value already exists -- never wait a full
  // poll tick just to notice something that's already there.
  const immediate = getValue();
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const poll = setInterval(() => {
      const value = getValue();
      if (value || Date.now() >= deadline) {
        clearInterval(poll);
        resolve(value);
      }
    }, pollIntervalMs);
  });
}
