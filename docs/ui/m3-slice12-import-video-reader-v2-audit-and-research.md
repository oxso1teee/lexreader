# M3 Slice 12 — Import & Video Reader v2

## Phase 0 — Audit of everything that already exists

### 0.1 Component inventory

**Browser extension** (`browser-extension/`):
- `manifest.json` — MV3, no `permissions`, only `host_permissions` for `youtube.com`. Content script (`lexreader-bridge.js`) injected at `document_start` only on the 5 allowed LexReader origins (prod, `.app` domains, localhost/127.0.0.1 dev).
- `youtube-transcript.mjs` — the actual extraction logic. `extractVideoId()` (watch/`youtu.be`/shorts/embed), `extractCaptionTracks()` (manual brace-depth JSON extractor pulling `captionTracks` out of the watch-page HTML — deliberately not a naive regex, so it survives nested braces inside the JSON blob), `selectCaptionTrack()` (prefers a manual (`kind !== "asr"`) track matching the target language, falls back to ASR, falls back to any track), `parseJson3Segments()` / `parseTimedTextSegments()` (two independent parsers — `fmt=json3` primary, XML `timedtext` fallback), `fetchYoutubeTranscript()` (orchestrates: fetch watch page with `credentials:"include"` → extract tracks → fetch chosen track's `baseUrl` with `fmt=json3` → parse → enforce `MAX_SEGMENTS`/`MAX_TRANSCRIPT_LENGTH`).
- `background.mjs` — MV3 service worker. Listens for `LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST` / `_PING` messages, validates `sender.url` origin against an allowlist, calls `fetchYoutubeTranscript`, replies with `{ok, transcript}` or `{ok:false, error}`.
- `lexreader-bridge.js` — content script. Relays `window.postMessage` traffic between the LexReader page (`source:"lexreader-web"`) and the extension's background worker (`chrome.runtime.sendMessage`), origin-checked on both the page→content-script and content-script→page directions.
- `youtube-transcript.test.mjs` — 4 unit tests, **all with a mocked `fetch`**. No real-network test exists anywhere in this extension.
- `README.md` — already documents the exact production failure mode in plain language: *"YouTube часто скрывает captionTracks от IP облачных серверов, включая Vercel"* and explicitly states *"Видео без caption track пока требуют отдельного speech-to-text провайдера"* (STT fallback was never built).

**Server-side YouTube import** (`src/app/(app)/library/youtube-actions.ts`):
- `createTextFromYoutube()` — the no-bridge fallback path. Fetches the watch page server-side (`fetchWatchPage()`), optionally proxied through **ScraperAPI** if `SCRAPERAPI_KEY` is set (paid third-party residential/rotating-IP proxy — a real external dependency, not free), extracts `captionTracks` via a regex (`/"captionTracks":(\[.*?\])(?=,")/` — non-greedy, more fragile than the extension's brace-matcher), fetches the raw XML `timedtext` URL, parses it, persists via `persistYoutubeTranscript()`.
- `saveBrowserYoutubeTranscript()` — the bridge path. Takes the already-fetched transcript payload from the extension, validates it defensively (`validateBrowserTranscript()` — type/format/length checks on every field, not just trusting the extension), persists the same way.
- Both paths converge on `persistYoutubeTranscript()`: inserts a `texts` row (`source_type:"youtube"`, `youtube_video_id`, `source_url`) via the shared `insertText()`, then bulk-inserts `caption_segments` rows; rolls back (`deletes` the `texts` row) if the segments insert fails.
- The code comments already contain a **precise root-cause note from a prior audit**: *"YouTube отдаёт страницу просмотра БЕЗ captionTracks... запросам с IP серверов облачных провайдеров (Vercel и т.п.) — это IP-репутационная антибот-проверка, не лечится никакими заголовками/куки"*.

**Import UI**:
- `src/app/(app)/library/new/youtube-import-form.tsx` — client component. On mount, pings the bridge via `postMessage` with a 1.2s timeout; if the extension answers, `bridgeStatus="ready"` and the whole flow runs client-side (bridge fetch → `saveBrowserYoutubeTranscript`); otherwise falls back to the server action `createTextFromYoutube`. Offers a `.zip` download of the extension folder with manual chrome://extensions install instructions if the bridge is missing.
- `src/app/(app)/library/new/transcript-import-form.tsx` — unrelated to YouTube: a plain "paste your own transcript text" flow, saved as an ordinary `text` via `createText`, no timestamps, no video, no sync. Explicitly documented as "the same path as a normal text, just a friendlier entry point."
- `src/app/(app)/library/new/add-text-tabs.tsx` — tab container wiring both.

**Video Reader ("Watch Mode")** (`src/app/watch/[textId]/`):
- `page.tsx` — server component. 404s if `texts.youtube_video_id` is null. Loads `caption_segments` ordered by `segment_index`, and **queries `vocabulary_items` directly by headword** (`wordLevels[w.headword.toLowerCase()]`) — this is the pre-Slice-11 pattern; it does **not** join `flashcards`/`learning_state`/`vocabulary_contexts` the way `src/app/read/[textId]/page.tsx` now does.
- `watch-player.tsx` — client component, ~470 lines, **entirely self-contained**: its own `Popup` interface, its own word-tap handler (`handleWordTap`), its own level-grid UI, its own YouTube IFrame API bootstrapping (with a 10s timeout + `onerror` guard — a real prior fix, documented inline), its own 300ms-interval `getCurrentTime()` polling loop driving `findActiveIndex()` to highlight/auto-scroll the active segment, its own `handleSeek()`.

### 0.2 What currently works

- URL parsing (`extractVideoId`) for watch/`youtu.be`/shorts/embed — solid, has unit tests, reused correctly in three separate places (extension, server action, tests).
- The browser-extension bridge protocol itself (origin-checked postMessage relay, ping/ready handshake) — well-designed, no obvious security holes.
- `caption_segments` schema + RLS (owner-or-system read, owner-only insert) — correct and already in production.
- The underlying word-save call from Watch Mode (`upsertWord` → `saveVocabularyItem`) **already goes through the same central dedup/flashcard-linking service Reader v2 uses** — so word saves from Watch Mode are not creating orphaned/duplicate data; the *data layer* is already unified even though the *UI* isn't.
- Video playback + transcript auto-scroll + click-to-seek — implemented and reasonably careful (debounced/interval-based, not per-frame).
- Reading-progress + streak/stats integration for Watch Mode — already wired (found and fixed in a prior audit per the inline comment), calls the same `updateTextProgress`/`finishReading` actions as the text Reader.

### 0.3 What currently does not work / is incomplete

- **Caption fetching from Vercel is unreliable** — this is the stated reason the bridge extension exists at all, and matches this Slice's kickoff framing ("has repeatedly failed in real usage").
- **No speech-to-text fallback exists anywhere.** Confirmed by full-repo grep: zero references to `whisper`, `faster-whisper`, or any STT provider. The extension's own README says so explicitly.
- **No InnerTube API client exists.** Zero references to `innertube`, `youtubei`, or a POST to `/youtubei/v1/player` anywhere in the repo. Both the extension and the server action use the same technique: scrape `captionTracks` out of the watch-page HTML `<script>` blob. This is *not* InnerTube-the-API — it's the older, more fragile "read the embedded player response out of the HTML" technique.
- **Watch Mode's word/phrase UI is stale relative to Reader v2.** No learning-state chip, no context count, no Practice bridge, no Detail bridge, and — critically — **no phrase selection at all** (single-word tap only; no long-press-drag gesture, no `item_type="phrase"` path). Phase 7/8 of this Slice cannot simply "reuse" `WatchPlayer`'s interaction code; it needs to be replaced with (or refactored to share) `ReaderWordPanel` + `reader.tsx`'s pointer/keyboard/phrase-selection logic.
- **Zero real end-to-end test coverage.** `e2e/add-material.spec.ts` and `e2e/library.spec.ts` only touch YouTube tangentially (a comment about a return-type refactor, and a filter-by-source-field assertion) — neither actually exercises transcript fetching, saving, or Watch Mode. The extension's own tests are 100% mocked-fetch.
- **`processing_status`/`processing_stage`/`processing_error`/`processing_started_at`/`processing_completed_at` columns on `texts` are dead.** Added in migration `0033_reader_processing_status.sql` (M3 Slice 3, for exactly this kind of async-import-status use case per its own comment) but **zero code anywhere reads or writes them** (confirmed by grep across `src/`). This is directly relevant to Phase 11's staged-status UX — the schema groundwork already exists and is unused, not missing.
- **`SCRAPERAPI_KEY` is a paid third-party dependency**, present in local `.env.local` (a live key value — not reproduced here). This contradicts the "prefer free tools" default and should be treated as an existing exception to flag, not a pattern to extend.

### 0.4 Reuse vs. replace vs. dead

| Code | Verdict |
|---|---|
| `extractVideoId` (both copies) | **Reuse** — correct, tested, used in 3 places already |
| `youtube-transcript.mjs`'s `parseJson3Segments`/`parseTimedTextSegments` | **Reuse** — the segment-parsing logic is provider-agnostic and correct; only the *fetching* layer needs to change |
| Browser-extension bridge protocol (manifest, background.mjs, lexreader-bridge.js) | **Reuse as one provider in the fallback chain**, not the sole mechanism — see Phase 1D below |
| Server-side `fetchWatchPage`/`findCaptionTracks` in `youtube-actions.ts` | **Replace.** This is the weakest link: fragile regex extraction, no InnerTube, paid-proxy-or-nothing, and (per Phase 1 findings below) doesn't actually work at the *caption-content* fetch step even when the *page* isn't blocked |
| `caption_segments` table + RLS | **Reuse**, likely extend (see Phase 5, not yet reached) |
| `texts.youtube_video_id`, `source_type`, `processing_*` columns | **Reuse** |
| `WatchPlayer`'s word-tap/popup/level UI | **Replace** with Reader v2's `ReaderWordPanel` + the pointer/keyboard/phrase logic from `reader.tsx` (Phase 6/7/8, not yet reached) |
| `WatchPlayer`'s IFrame API bootstrap, active-segment tracking, click-to-seek | **Reuse** — these are video-specific concerns Reader v2 has no equivalent for, and they're already carefully written (timeout/onerror guards, debounced polling) |
| `upsertWord`/`saveVocabularyItem` call from Watch Mode | **Reuse unchanged** — already the correct central dedup path |
| `SCRAPERAPI_KEY` proxy fallback | **Keep as an optional last-resort knob, don't build new features around it** — paid, and per Phase 1 findings the actual failure isn't only page-fetch blocking |

---

## Phase 1 — Research / prototyping (in progress)

All of this was done in `research/youtube-transcript/` (isolated: its own `package.json`/`node_modules`/venv, zero changes to the production app or its dependency tree) and against **real YouTube, live**, from this dev environment's actual network — not simulated.

### 1.1 Empirical finding: this environment's IP is *not* page-blocked, but caption *content* fetches are

Reused the extension's own `fetchYoutubeTranscript()` unmodified against 3 real public videos (a TED talk, "Me at the zoo", PSY - Gangnam Style). All three failed with "no captions available" — but debugging showed:

- The watch-page HTML fetch is **not** blocked here: HTTP 200, ~1.2MB of real HTML, contains `ytInitialPlayerResponse`, `playerCaptionsTracklistRenderer`, and `captionTracks`.
- `extractCaptionTracks()` correctly parses out a track (Korean, `kind:"asr"`, for Gangnam Style — makes sense, it auto-detects the spoken language, English wasn't a directly-listed track).
- Fetching that track's `baseUrl` (with `fmt=json3`, `srv3`, `vtt`, with/without `Referer`/`Origin`/`User-Agent` headers) **consistently returns HTTP 200 with a zero-length body.**

This is a materially different and more specific finding than the code comments' existing "IP reputation blocks the HTML page" theory. On an IP that is *not* blocked at the page level, the **`timedtext` caption-content endpoint itself still silently returns nothing** — no error, no redirect, just an empty 200. The caption track URL embeds session-specific parameters (`ei=`, a literal `ip=0.0.0.0` placeholder, a signature) generated for that specific watch-page load; a request that doesn't carry the matching browser session/cookie context appears to be served empty rather than rejected. This matches widely-documented 2024–2025 tightening of YouTube's caption endpoint (increasingly gated behind the same session/PO-token machinery as playback, not just a simple signed URL) — **our own two implementations (extension and server action) both predate this and don't handle it.**

**Practical implication**: even the browser-extension bridge — which explicitly exists to dodge the *IP-reputation* block — is not guaranteed to dodge this *second*, session-token gate, because it makes its `fetch()` calls from a content-script context (extension origin), not from the actual `youtube.com` tab's own JS context. This needs to be verified directly (Phase 1D, not yet done) rather than assumed either way.

### 1.2 yt-dlp: works, with real caveats

`yt-dlp` (already installed, v2026.07.04, standalone venv at `~/.local/share/yt-dlp-venv`) successfully **listed** captions for the same Gangnam Style video — and not just the one raw track our HTML-scrape found, but dozens of languages (auto-translated variants of the base ASR track, resolved via `playerCaptionsTracklistRenderer.translationLanguages`, which never appear as separate entries in the raw `captionTracks` JSON — this is a real capability gap in our hand-rolled extractors, not just a reliability gap).

Two real warnings surfaced, both operationally significant for Phase 4 (infra):
1. *"No supported JavaScript runtime could be found... YouTube extraction without a JS runtime has been deprecated."* yt-dlp fell back to the "android vr" player client, which still worked for listing captions, but a production deployment should bundle a JS runtime (Deno is yt-dlp's documented default) for full reliability across all client profiles.
2. *"The extractor specified to use impersonation for this download, but no impersonate target is available"* — followed by an actual `HTTP Error 429: Too Many Requests` when attempting to **download** (not just list) an English auto-caption file. yt-dlp wants an HTTP-impersonation backend (`curl_cffi`, mimicking real browser TLS/HTTP2 fingerprints) for some code paths; without it, and after several requests in a short window, YouTube rate-limited this environment's IP.

**This rate limit is itself a load-bearing finding**: real, automated, back-to-back requests from one IP get throttled fast, even on an otherwise-clean IP. Any worker architecture (Phase 4) needs real pacing/backoff, and the "no captions" error message must never be shown to a user after a 429 — that's a transient rate-limit, not an actual absence of captions (directly relevant to Phase 11's "do not claim 'no subtitles' until all providers are exhausted" rule).

### 1.3 youtubei.js: installed, evaluated structurally, not yet load-tested against YouTube

`youtubei.js` (`LuanRT/YouTube.js`) v18.0.0 installed cleanly via plain `npm install` in the isolated research folder. It's substantially more than a raw InnerTube caller: it ships its own `ClientType`/`Clients` abstraction (multiple client profiles, matching yt-dlp's own multi-client-fallback strategy), and — importantly — its own `JsAnalyzer`/`JsExtractor`/`JsHelpers`, meaning it has machinery for handling YouTube's signature-descrambling JS challenge itself, in pure JS, without shelling out to a separate runtime the way yt-dlp needs Deno for. This is a strong maintainability signal for a Node/Vercel-side provider versus hand-rolling raw InnerTube POST requests ourselves (Phase 1A) — hand-rolling would mean re-implementing exactly this fragile, frequently-changing signature/client-profile logic ourselves and re-fighting the same battles youtubei.js's maintainers already fight upstream.

**Not yet done** (deferred past the rate-limit cooldown): an actual live `Innertube.create()` + transcript fetch against a real video, to see whether it succeeds where our hand-rolled fetch and yt-dlp's download step did not.

### 1.4 STT fallback tooling: available, not yet run end-to-end

`faster-whisper` installed cleanly into an isolated Python venv (`research/youtube-transcript/whisper-venv/`, via PyPI — no YouTube contact, no system Python pollution, `pip install --user` was blocked by PEP 668 externally-managed-environment, worked fine inside a venv). No paid API involved — this is exactly the no-paid-API STT path the brief requires.

**Real constraint found**: this dev environment currently has only ~1.7GB of available RAM (4 CPU cores, 7.8GB total, but ~6.1GB already in use by other processes) — this is the same memory pressure that caused OOM kills earlier in this project's history (documented in this session's own prior context). A `tiny` or `base` Whisper model (75–145MB) should fit, but this hasn't been proven with a real audio clip yet, and a production worker (Phase 4) needs to size its container independently of this shared dev box's constraints.

**Not yet done**: downloading real audio from a captionless public video (needs another `yt-dlp` call against YouTube's video CDN, currently paused for rate-limit cooldown) and running it through `faster-whisper` to produce an actual timed transcript. This is the single most important unproven step in the whole Slice — **Hard Acceptance Gate #1 is not yet cleared**, and I am not claiming it works.

### 1.5 Not yet done from Phase 1

- **1D (browser-extension-as-fallback test)**: haven't yet loaded the actual extension in a real browser tab against `youtube.com` to see whether a genuine `youtube.com`-tab-context fetch (not a content-script-context fetch) clears the session-token gate found in 1.1. This is the crux question for whether the existing bridge architecture is salvageable as-is or needs to move its fetch call into a `youtube.com` tab itself (e.g. via a background-injected script rather than calling `fetch` from the service worker).
- **1E (yt-dlp anti-bot/PO-token depth)**: confirmed yt-dlp lists captions and confirmed it hit a 429 on actual download; haven't yet confirmed a full successful download after a cooldown, or measured how much a JS runtime + `curl_cffi` change the reliability.
- **youtubei.js live test** (1B): package evaluated structurally, not yet run against a real video.
- **Full Phase 2 test corpus**: not started — deliberately, since hammering YouTube further right now would extend the rate-limit, and picking "real, stable, public" video IDs for every required category (Shorts, 30–60min, non-English, multi-language, captionless) needs either your input on specific videos or careful, well-paced empirical probing rather than guessing IDs from memory and asserting their caption status without checking.

## Next steps (proposed, not yet executed)

1. Cool down, then: live-test `youtubei.js` against 2–3 videos; retry a real yt-dlp caption *download* (not just list); attempt one real captionless-video → audio → `faster-whisper` → timed-transcript run.
2. Build/verify the actual browser extension against a real `youtube.com` tab (1D) to settle whether the bridge survives the session-token gate found in 1.1.
3. Only after those land: assemble the real Phase 2 test corpus (I'll propose specific stable public video IDs per category and record results per the required table), then evaluate Hard Acceptance Gate #1.

**Nothing has been merged, no schema has changed, no production code has been touched.** All work so far lives in `research/youtube-transcript/` (git-ignorable scratch dependencies) and this doc.
