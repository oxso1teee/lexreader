// Dedicated YouTube transcript DOM extractor. This is loaded before
// youtube-content-relay.js in the same isolated world and exposes one small
// global API because MV3 manifest content scripts cannot use static imports.
//
// Responsibility boundary:
//   YouTube transcript DOM -> normalized, deduplicated caption segments
//
// It deliberately knows nothing about LexReader persistence or the browser
// bridge. Network/timedtext capture lives elsewhere and is never consulted by
// this module, which makes the DOM-only proof literal rather than a race that a
// network response can accidentally win.
((global) => {
  "use strict";

  const ROW_SELECTOR = "transcript-segment-view-model, ytd-transcript-segment-renderer";
  const LAST_SEGMENT_EXTENSION_MS = 4_000;
  const MAX_SCROLL_ITERATIONS_PER_PASS = 400;
  const REQUIRED_STABLE_ITERATIONS = 3;
  const MAX_COLLECTION_PASSES = 2;

  function cleanText(value) {
    return String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/[\u200b-\u200d\ufeff]/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#(?:39|x27);/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseTimestampToMs(value) {
    if (typeof value !== "string") return null;
    const text = value.trim();
    if (!/^\d{1,4}:\d{2}(?::\d{2})?$/.test(text)) return null;
    const parts = text.split(":").map(Number);
    if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;

    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      if (seconds >= 60) return null;
      return (minutes * 60 + seconds) * 1_000;
    }

    const [hours, minutes, seconds] = parts;
    if (minutes >= 60 || seconds >= 60) return null;
    return (hours * 3_600 + minutes * 60 + seconds) * 1_000;
  }

  function parseRow(row) {
    const startMs = parseTimestampToMs(row?.timestampText);
    const text = cleanText(row?.text);
    if (startMs == null || !text) return null;
    return { startMs, text };
  }

  function completenessToleranceMs(durationMs) {
    if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
    if (durationMs <= 60_000) return Math.max(5_000, Math.round(durationMs * 0.35));
    if (durationMs <= 600_000) return Math.max(15_000, Math.min(60_000, Math.round(durationMs * 0.12)));
    return Math.max(60_000, Math.min(300_000, Math.round(durationMs * 0.05)));
  }

  function assessTranscriptCompleteness(segments, durationMs, exhausted = true) {
    const uniqueSegments = Array.isArray(segments) ? segments.length : 0;
    const firstMs = uniqueSegments > 0 ? segments[0].startMs : null;
    const lastMs = uniqueSegments > 0 ? segments[uniqueSegments - 1].startMs : null;
    const numericDuration = Number(durationMs);

    if (uniqueSegments === 0) {
      return { complete: false, reason: "no_valid_rows", toleranceMs: null, minimumSegments: 1, firstMs, lastMs };
    }
    if (!exhausted) {
      return { complete: false, reason: "scroll_not_exhausted", toleranceMs: null, minimumSegments: 1, firstMs, lastMs };
    }
    if (!Number.isFinite(numericDuration) || numericDuration <= 0) {
      return { complete: true, reason: "duration_unknown_scroll_exhausted", toleranceMs: null, minimumSegments: 1, firstMs, lastMs };
    }

    const toleranceMs = completenessToleranceMs(numericDuration);
    // A weak density floor prevents one late-mounted row from making a long
    // video look complete. It is intentionally conservative: only one valid
    // timestamped row per two minutes is required.
    const minimumSegments = numericDuration > 600_000 ? Math.ceil(numericDuration / 120_000) : 1;
    if (uniqueSegments < minimumSegments) {
      return { complete: false, reason: "too_few_segments_for_duration", toleranceMs, minimumSegments, firstMs, lastMs };
    }
    if (lastMs + toleranceMs < numericDuration) {
      return { complete: false, reason: "ends_too_early", toleranceMs, minimumSegments, firstMs, lastMs };
    }
    return { complete: true, reason: "near_video_end", toleranceMs, minimumSegments, firstMs, lastMs };
  }

  function createAccumulator() {
    const byKey = new Map();
    let duplicatesDiscarded = 0;
    let malformedRowsDiscarded = 0;
    let sequence = 0;

    return {
      addRows(rows) {
        let added = 0;
        for (const row of Array.isArray(rows) ? rows : []) {
          const parsed = parseRow(row);
          if (!parsed) {
            malformedRowsDiscarded += 1;
            continue;
          }
          const key = `${parsed.startMs}|${parsed.text}`;
          if (byKey.has(key)) {
            duplicatesDiscarded += 1;
            continue;
          }
          byKey.set(key, { ...parsed, sequence: sequence++ });
          added += 1;
        }
        return added;
      },
      toSegments(durationMs) {
        const parsed = [...byKey.values()].sort((a, b) => a.startMs - b.startMs || a.sequence - b.sequence);
        return parsed.map((segment, index) => {
          let nextStart = null;
          for (let nextIndex = index + 1; nextIndex < parsed.length; nextIndex += 1) {
            if (parsed[nextIndex].startMs > segment.startMs) {
              nextStart = parsed[nextIndex].startMs;
              break;
            }
          }

          let endMs = nextStart ?? segment.startMs + LAST_SEGMENT_EXTENSION_MS;
          if (index === parsed.length - 1 && Number.isFinite(Number(durationMs))) {
            const duration = Math.round(Number(durationMs));
            const tolerance = completenessToleranceMs(duration);
            if (duration > segment.startMs && tolerance != null && segment.startMs + tolerance >= duration) {
              endMs = duration;
            }
          }
          if (endMs <= segment.startMs) endMs = segment.startMs + LAST_SEGMENT_EXTENSION_MS;
          return { startMs: segment.startMs, endMs, text: segment.text };
        });
      },
      get uniqueSegments() {
        return byKey.size;
      },
      get duplicatesDiscarded() {
        return duplicatesDiscarded;
      },
      get malformedRowsDiscarded() {
        return malformedRowsDiscarded;
      },
    };
  }

  function elementText(element) {
    return cleanText(element?.textContent ?? element?.innerText ?? "");
  }

  function timestampFromRow(row) {
    const candidates = [
      ...row.querySelectorAll(
        ".ytwTranscriptSegmentViewModelTimestamp, .segment-timestamp, #timestamp, [class*='TranscriptSegmentViewModelTimestamp'], [class*='segment-timestamp'], button",
      ),
    ];
    for (const element of candidates) {
      for (const value of [elementText(element), element.getAttribute?.("aria-label")]) {
        const normalized = cleanText(value);
        const direct = normalized.match(/\b\d{1,4}:\d{2}(?::\d{2})?\b/)?.[0];
        if (direct && parseTimestampToMs(direct) != null) return direct;
      }
    }
    const inline = elementText(row).match(/^\s*(\d{1,4}:\d{2}(?::\d{2})?)\b/)?.[1];
    return inline && parseTimestampToMs(inline) != null ? inline : null;
  }

  function captionTextFromRow(row, timestampText) {
    const selectors = [
      "span[role='text']",
      ".segment-text",
      "yt-formatted-string.segment-text",
      "[class*='TranscriptSegmentViewModelText']",
      "[class*='segment-text']",
    ];
    for (const selector of selectors) {
      const element = row.querySelector(selector);
      const text = elementText(element);
      if (text && parseTimestampToMs(text) == null) return text;
    }

    const aria = cleanText(row.getAttribute?.("aria-label"));
    if (aria) {
      const withoutTimestamp = cleanText(aria.replace(timestampText ?? "", ""));
      if (withoutTimestamp) return withoutTimestamp;
    }
    return cleanText(elementText(row).replace(timestampText ?? "", ""));
  }

  function findPanelRoot(documentRef) {
    const selectors = [
      "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-searchable-transcript']",
      "ytd-engagement-panel-section-list-renderer[target-id*='transcript']",
      "ytd-transcript-search-panel-renderer",
      "ytd-transcript-renderer",
      "transcript-segment-list-view-model",
    ];
    for (const selector of selectors) {
      const candidates = [...documentRef.querySelectorAll(selector)];
      const visible = candidates.find((candidate) => {
        const style = global.getComputedStyle?.(candidate);
        return !style || (style.display !== "none" && style.visibility !== "hidden");
      });
      if (visible) return visible;
    }
    return documentRef.querySelector(ROW_SELECTOR)?.closest("#panels, ytd-engagement-panel-section-list-renderer") ?? null;
  }

  function readMountedRows(documentRef, panelRoot = findPanelRoot(documentRef)) {
    if (!panelRoot) return [];
    const rows = [];
    for (const row of panelRoot.querySelectorAll(ROW_SELECTOR)) {
      const timestampText = timestampFromRow(row);
      const text = captionTextFromRow(row, timestampText);
      rows.push({ timestampText, text });
    }
    return rows;
  }

  function findScrollContainer(documentRef, panelRoot = findPanelRoot(documentRef)) {
    if (!panelRoot) return null;
    const candidates = new Set([
      panelRoot,
      ...panelRoot.querySelectorAll(
        "#segments-container, #content, ytd-transcript-segment-list-renderer, transcript-segment-list-view-model, [role='list']",
      ),
    ]);

    const firstRow = panelRoot.querySelector(ROW_SELECTOR);
    for (let node = firstRow?.parentElement; node && node !== panelRoot.parentElement; node = node.parentElement) {
      candidates.add(node);
      if (node === panelRoot) break;
    }

    let best = null;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      if (typeof candidate.scrollTop !== "number") continue;
      const scrollRange = Math.max(0, Number(candidate.scrollHeight) - Number(candidate.clientHeight));
      const overflowY = global.getComputedStyle?.(candidate)?.overflowY ?? "";
      const score =
        (scrollRange > 2 ? 1_000_000 + scrollRange : 0) +
        (Number(candidate.clientHeight) > 100 ? 500_000 : 0) +
        (/auto|scroll|overlay/.test(overflowY) ? 100_000 : 0) +
        candidate.querySelectorAll?.(ROW_SELECTOR).length;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }

  function abortError() {
    const error = new Error("dom_collection_aborted");
    error.name = "AbortError";
    return error;
  }

  function throwIfAborted(signal) {
    if (signal?.aborted) throw abortError();
  }

  function waitForDomProgress(root, signal, timeoutMs = 180) {
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (value, error) => {
        if (settled) return;
        settled = true;
        observer?.disconnect();
        global.clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        if (error) reject(error);
        else resolve(value);
      };
      const onAbort = () => finish(false, abortError());
      const observer = typeof global.MutationObserver === "function"
        ? new global.MutationObserver(() => finish(true))
        : null;
      observer?.observe(root, { subtree: true, childList: true, characterData: true });
      const timer = global.setTimeout(() => finish(false), timeoutMs);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  function createDocumentAdapter(documentRef) {
    let panelRoot = findPanelRoot(documentRef);
    let scrollContainer = findScrollContainer(documentRef, panelRoot);

    function refresh() {
      panelRoot = findPanelRoot(documentRef) ?? panelRoot;
      scrollContainer = findScrollContainer(documentRef, panelRoot) ?? scrollContainer;
    }

    return {
      readRows() {
        refresh();
        return readMountedRows(documentRef, panelRoot);
      },
      getScrollState() {
        refresh();
        if (!scrollContainer) return { scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
        return {
          scrollTop: Number(scrollContainer.scrollTop) || 0,
          scrollHeight: Number(scrollContainer.scrollHeight) || 0,
          clientHeight: Number(scrollContainer.clientHeight) || 0,
        };
      },
      async scrollAndWait(scrollTop, signal) {
        refresh();
        if (!scrollContainer || !panelRoot) return false;
        const waiting = waitForDomProgress(panelRoot, signal);
        scrollContainer.scrollTop = Math.max(0, scrollTop);
        scrollContainer.dispatchEvent?.(new Event("scroll", { bubbles: true }));
        return await waiting;
      },
      async waitForProgress(signal) {
        refresh();
        if (!panelRoot) return false;
        return await waitForDomProgress(panelRoot, signal);
      },
    };
  }

  async function collectVirtualizedTranscript({
    adapter,
    durationMs,
    signal,
    onProgress = () => {},
    maxPasses = MAX_COLLECTION_PASSES,
    maxIterationsPerPass = MAX_SCROLL_ITERATIONS_PER_PASS,
    stableIterationsRequired = REQUIRED_STABLE_ITERATIONS,
  }) {
    const startedAt = Date.now();
    const accumulator = createAccumulator();
    const originalScrollTop = adapter.getScrollState().scrollTop;
    let scrollIterations = 0;
    let collectionPasses = 0;
    let exhausted = false;
    let completeness = assessTranscriptCompleteness([], durationMs, false);

    try {
      for (let pass = 0; pass < maxPasses; pass += 1) {
        throwIfAborted(signal);
        collectionPasses = pass + 1;
        exhausted = false;
        let stableIterations = 0;
        const stepRatio = pass === 0 ? 0.78 : 0.55;

        await adapter.scrollAndWait(0, signal);

        for (let iteration = 0; iteration < maxIterationsPerPass; iteration += 1) {
          throwIfAborted(signal);
          const added = accumulator.addRows(adapter.readRows());
          const before = adapter.getScrollState();
          const maxTop = Math.max(0, before.scrollHeight - before.clientHeight);
          const atEndBefore = before.scrollTop >= maxTop - 2;
          // Some current transcript builds report clientHeight=0 on the
          // scrollable list model even though setting scrollTop advances its
          // virtual window. A 240px fallback made a two-hour transcript take
          // >60 seconds and outlive Chrome's one-shot message channel. Keep
          // increments bounded, but use a real viewport-sized fallback.
          const step = before.clientHeight > 0
            ? Math.max(240, Math.round(before.clientHeight * stepRatio))
            : 800;
          const targetTop = atEndBefore ? before.scrollTop : Math.min(maxTop, before.scrollTop + step);

          if (targetTop > before.scrollTop + 1) {
            await adapter.scrollAndWait(targetTop, signal);
          } else {
            await adapter.waitForProgress(signal);
          }

          const after = adapter.getScrollState();
          const advanced = after.scrollTop > before.scrollTop + 1;
          scrollIterations += 1;
          stableIterations = !advanced && added === 0 ? stableIterations + 1 : 0;
          onProgress({
            pass: pass + 1,
            iteration: iteration + 1,
            uniqueSegments: accumulator.uniqueSegments,
            duplicatesDiscarded: accumulator.duplicatesDiscarded,
            scrollTop: after.scrollTop,
            scrollHeight: after.scrollHeight,
            clientHeight: after.clientHeight,
          });

          if (stableIterations >= stableIterationsRequired) {
            exhausted = true;
            break;
          }
        }

        // One final read covers rows mounted by the last observed mutation.
        accumulator.addRows(adapter.readRows());
        const segments = accumulator.toSegments(durationMs);
        completeness = assessTranscriptCompleteness(segments, durationMs, exhausted);
        if (completeness.complete) break;
        onProgress({
          pass: pass + 1,
          retrying: pass + 1 < maxPasses,
          uniqueSegments: accumulator.uniqueSegments,
          completeness,
        });
      }
    } finally {
      try {
        await adapter.scrollAndWait(originalScrollTop, signal?.aborted ? undefined : signal);
      } catch {
        // Restoring the user's original panel position is best-effort only.
      }
    }

    const segments = accumulator.toSegments(durationMs);
    completeness = assessTranscriptCompleteness(segments, durationMs, exhausted);
    return {
      segments,
      metrics: {
        scrollIterations,
        duplicatesDiscarded: accumulator.duplicatesDiscarded,
        malformedRowsDiscarded: accumulator.malformedRowsDiscarded,
        uniqueSegments: accumulator.uniqueSegments,
        firstMs: segments[0]?.startMs ?? null,
        lastMs: segments[segments.length - 1]?.startMs ?? null,
        collectionPasses,
        exhausted,
        completeness,
        elapsedMs: Date.now() - startedAt,
      },
    };
  }

  async function collectFromDocument(documentRef, options = {}) {
    return await collectVirtualizedTranscript({
      ...options,
      adapter: createDocumentAdapter(documentRef),
    });
  }

  global.LexReaderYoutubeDomExtractor = Object.freeze({
    ROW_SELECTOR,
    cleanText,
    parseTimestampToMs,
    parseRow,
    completenessToleranceMs,
    assessTranscriptCompleteness,
    createAccumulator,
    findPanelRoot,
    readMountedRows,
    findScrollContainer,
    createDocumentAdapter,
    collectVirtualizedTranscript,
    collectFromDocument,
  });
})(globalThis);
