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

## Phase 1 continued — Rounds 1–6 (real network results)

All videos below are real, public, non-age-restricted. All requests were made one at a time, no parallelization, with deliberate pacing after the earlier 429.

### Round 1 — youtubei.js real network test

**Video**: `iG9CE55wbtY` ("Do schools kill creativity? | Sir Ken Robinson | TED", 1203s, TED channel).

- `Innertube.create()` + `getInfo()` (default WEB-ish client): **succeeded** — real title, real duration (1203s), real channel name.
- `info.captions.caption_tracks`: **empty array**. `info.getTranscript()`: **failed, HTTP 400** from `youtubei/v1/get_transcript`.
- Retried with `ClientType.IOS`: **crashed** — youtubei.js v18.0.0's parser doesn't recognize the current response shape for this client (`InnertubeError: SingleColumnWatchNextResults not found`, then `ParsingError: Type mismatch, got Transcript expected ...`). The crash dump's raw response data included `entityKeys.segmentsKey: 'iG9CE55wbtY.transcript.full.state.key'` — **proof a transcript exists server-side**; the library simply can't parse this client's current response format.
- **Verdict**: metadata fetch via youtubei.js is reliable; caption/transcript fetch is not, on 2 of the client profiles available, with this library version (18.0.0). Not a "no captions" result — a library/schema-lag result. Discovery-only ≠ success, and neither attempt reached "real timed caption content → parsed segments."

### Round 2 — yt-dlp real caption download

**Videos**: `jNQXAC9IVRw` ("Me at the zoo", 19s — deliberately different from Round 1's video) and `iG9CE55wbtY` (reused, different provider path).

Commands run (secrets/cookies: none used or needed):
```
yt-dlp --write-auto-sub --write-sub --sub-lang en --sub-format json3 --skip-download -o "out/%(id)s.%(ext)s" "https://www.youtube.com/watch?v=jNQXAC9IVRw"
yt-dlp --write-sub --sub-lang en --sub-format json3 --skip-download -o "out/%(id)s.manual.%(ext)s" "https://www.youtube.com/watch?v=iG9CE55wbtY"
```

- Player client used: **"android vr"** (yt-dlp's automatic fallback — it warned no JS runtime was available for the primary web-client signature challenge, and no `curl_cffi` impersonation backend was installed, then transparently fell back to a client profile that doesn't need either).
- **Auto captions** (Me at the zoo): downloaded, real content, real timestamps. 6 segments, `1200ms → 18881ms`. First 3: *"All right, so here we are, in front of the elephants"* (1200–3360ms), *"the cool thing about these guys is that they have really..."* (5318–7974ms), *"really really long trunks"* (7974–12616ms). Content matches the video's actual, well-known narration.
- **Manual captions**, language explicitly selected (`--sub-lang en`) (TED talk): downloaded, 427 real segments, `27103ms → 1165213ms` (≈19.4 min, consistent with the 1203s video). First: *"Good morning. How are you?"* (27103–29678ms).
- No 429 this time — both downloads succeeded cleanly.
- **Verdict**: yt-dlp is the only provider tested so far that reached real, correct, fully-timed caption content — for both manual and auto captions, with explicit language selection.

### Round 3 — real browser-extension test (Playwright, `--load-extension`, real `youtube.com` session)

I could not literally click through `chrome://extensions` → "Load unpacked" (that's a native OS file-picker dialog, outside what browser automation can drive). Instead I used Playwright's `chromium.launchPersistentContext()` with `--disable-extensions-except=<path> --load-extension=<path>` pointing at the real `browser-extension/` folder — the standard, non-mocked way to test a real MV3 extension headfully. Script: `research/youtube-transcript/test-extension-real.mjs`.

Steps actually executed:
1. Launched a real Chromium profile with the real extension loaded. **Service worker registered**: `chrome-extension://obemeaahahlbnfldbjnfhmlnlokdgemj/background.mjs`.
2. Opened a real tab on `https://www.youtube.com/watch?v=jNQXAC9IVRw` — loaded correctly, real title "Me at the zoo - YouTube" (this establishes a real browser cookie jar for youtube.com in this profile).
3. Opened a real tab on `http://localhost:3000/library/new` (redirected to `/onboarding` — fresh unauthenticated profile, expected and irrelevant to the bridge test since the content script matches on origin, not path).
4. Ran the **exact** production handshake from `youtube-import-form.tsx`: `postMessage({source:"lexreader-web", type:"LEXREADER_YOUTUBE_BRIDGE_PING"})` → **received `LEXREADER_YOUTUBE_BRIDGE_READY`** (bridge fully operational: content script ↔ background service worker ↔ page, all real, no mocks).
5. Sent the real `LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST` for the same video → **`ok: false`, error: "У этого видео нет доступных субтитров."** — the **identical failure message and failure point** as the plain server-side Node test in section 1.1.

**This is the single most important result in the whole Slice.** The extension's *architecture* (bridge, service worker, message-passing, security allowlisting) is fully proven working end-to-end in a real browser with a real YouTube session. The *reason* it still fails is that `background.mjs`'s `fetchYoutubeTranscript()` uses the exact same fragile HTML-`captionTracks`-scrape technique as the server-side code — and that technique is unreliable **regardless of whether it runs from a browser or a server**, because (per Round 1's evidence) the underlying data now often requires the same kind of InnerTube-proper request yt-dlp makes, not a raw HTML scrape. The extension's "runs from a real user IP" property was solving the wrong problem — the datacenter-IP block is real (per the original README), but it is not the only or even the primary failure mode anymore.

**Implication for Phase 3 (not yet started)**: the extension bridge architecture should be **kept as-is** (it's well-designed and now proven end-to-end), but `youtube-transcript.mjs`'s extraction method inside it needs to be replaced with a proper InnerTube-style client call — the same category of fix the server-side path needs. This is exactly what the brief anticipated ("prototype an upgraded extension-side provider... keep the secure origin-checked message bridge").

### Round 4 — captionless video → STT (mandatory)

**Honest framing first**: I ran two things, not one.

1. **A genuinely captionless-search attempt.** `yt-dlp ytsearch1:"10 hours rain sounds ambient no talking"` found `Qo4JIT8jMtI` (confirmed: *"has no automatic captions"*, *"has no subtitles"*) — but at 38,890s (10.8 hours) of pure ambient rain/thunder with no speech, it's not a meaningful STT proof (nothing is said, so there's nothing to verify Whisper produced correctly). A follow-up search for short real-speech clips (`ytsearch3:"homemade voice memo talking to myself short clip"`) found 3 candidates; the one I checked in full (`22zais_nYfU`, "How to record VOICE OVER video on IPHONE", 238s) turned out to **have** auto-captions after all (just no manual ones) — YouTube auto-captions almost all clear English speech now, which made a blind search for a genuine zero-caption-with-real-speech video unexpectedly hard within a reasonable, rate-limit-respecting number of requests. I stopped searching further rather than keep hammering YouTube on low-odds guesses.

2. **The actual mandatory pipeline proof, run on "Me at the zoo" (`jNQXAC9IVRw`, 19s), using its already-downloaded real captions purely as ground truth to verify correctness — not as an input to the STT step.** This is architecturally airtight: `faster-whisper`'s `transcribe()` call takes only a local `.wav` file path; it has zero network access and zero knowledge of YouTube or its captions during inference. Whatever it produces is 100% independently derived from the raw audio.

   - **Audio extraction**: `yt-dlp -x --audio-format wav --audio-quality 0` → real 19.0s WAV, 3.65MB (`ffprobe`-confirmed duration `19.005542s`, matching the video).
   - **STT model**: `faster-whisper`, `tiny`, `compute_type="int8"` (smallest available — deliberate, given this box's ~1.4–1.7GB free RAM).
   - **Language**: auto-detected as English, **p=0.95**.
   - **CPU/RAM**: peak RSS **252MB** (`/usr/bin/time -v`), 11% average CPU (single-threaded int8 tiny model) — comfortably inside this environment's tight memory budget.
   - **Timing**: model load 61s (one-time HuggingFace download of the ~75MB tiny model on first run; 3.55s on the warm-cache rerun), transcription itself **2.26s** for 19s of audio.
   - **Output** (first run, sentence-level): one 0.00–19.00s segment: *"All right so here we are one of the elephant's cool thing, what these guys expect is that they have really, really, really, long, and that's cool and that's pretty much all it is to say."* — compare to the **real, independently-downloaded** auto-caption text from Round 2: *"All right, so here we are, in front of the elephants... the cool thing about these guys is that they have really... really really long trunks... and that's cool... and that's pretty much all there is to say."* The `tiny` model's output is recognizably the same content with real (expected, well-documented) small-model accuracy loss (drops "trunks," mishears "in front of the elephants" as "one of the elephant's cool thing") — not garbage, not hallucinated, genuinely derived from the audio.
   - **Segment granularity gap found**: the default `transcribe()` call returned **one single segment for the whole clip**, not per-sentence timed lines. Re-ran with `word_timestamps=True, vad_filter=True`: still one native Whisper "segment," but **real word-level start/end timestamps are present on every word** (confirmed via the `seg.words` array). This means fine-grained `TranscriptSegment[]` is achievable, but needs an explicit regrouping step (bucket words into ~5–8s display lines) — a normal, well-understood part of building Whisper-based captions, not a research risk. I built and proved this regrouping in Round 5 (`fromWhisperWords()`).
   - **Cleanup**: all research audio/output files live under `research/youtube-transcript/out/`, which is gitignored — nothing was committed, and the files can be deleted freely (they are, effectively, transient artifacts of this run).

3. **Ran the same pipeline a third time, on a video independently confirmed genuinely captionless** (`Qo4JIT8jMtI`, the ambient rain/thunder video — `--list-subs` explicitly reported *"has no automatic captions"* and *"has no subtitles"*). Extracted a real 30s audio clip (`yt-dlp --download-sections`, one retry needed — the first invocation hit a real **HTTP 403** on the signed googlevideo.com media URL when combined with `-x`'s ffmpeg-direct-fetch path; a second invocation using an explicit format itag succeeded, a distinct fix, not a blind retry), converted to WAV (`ffprobe`-confirmed 30.000000s), ran through the same `faster-whisper tiny` pipeline: **language-detection confidence dropped to p=0.30 and 0 segments were returned** — Whisper correctly determined there is no speech in this audio (it's rain and thunder) rather than hallucinating content. This is the *correct* result for this input, and proves the pipeline runs cleanly end-to-end on a genuinely-confirmed captionless video without crashing — but it does **not** produce the "output must contain real timestamps" evidence the brief requires, precisely because there's no speech in this particular captionless video to time.

   **Honest bottom line on item 7**: the *mechanism* is proven in two separate, real runs — (a) it behaves correctly on a video independently confirmed to have zero captions (produces a clean, correct empty result, no crash, no hallucination), and (b) it produces real, accurate, correctly-timed transcript segments when given real speech (verified against ground truth on a *different*, caption-having video). **I did not find and could not locate, within a reasonable rate-limit-respecting search budget, a single real public video that is simultaneously (a) genuinely caption-free and (b) contains actual spoken content** — YouTube's auto-captioning of clear English speech turned out to be far more aggressive than expected (every real-speech candidate I checked already had auto-captions). I am treating this narrow, specific gap honestly rather than rounding it up: **the single combined demonstration the brief asks for (real timestamps produced by STT on a video that has zero pre-existing captions) was not completed.**

### Round 5 — normalization prototype

Built `research/youtube-transcript/normalize.mjs`: `fromYtDlpJson3()` maps both the Round 2 manual-caption file (427 segments) and auto-caption file (6 segments) into the exact `{videoId, title, languageCode, source, segments: {startMs, endMs, text}[]}` shape from the brief; `fromWhisperWords()` regroups Round 4's word-level Whisper output into the same shape via a max-6000ms bucketing rule. Ran it — both real caption sources produced identical-shaped output, differing only in `source` (`"manual_caption"` vs `"auto_caption"`) and segment count/granularity. **A Video Reader built against this shape would not need to know or care which provider produced a given transcript.**

### Round 6 — provider reliability decision (from measured results only)

| Provider | Measured this round | Runs where? | Cost | Latency (measured) | Fragility |
|---|---|---|---|---|---|
| **yt-dlp (InnerTube via android-vr client)** | ✅ Manual captions, ✅ auto captions, ✅ language selection, ✅ real timestamps. 1 rate-limit hit (429) on the very first attempt of this session, 0 on 3 subsequent attempts after backing off. | Worker/container (Python venv + ffmpeg; confirmed **not** Vercel-serverless-appropriate — needs its own process, and yt-dlp itself warns it wants a JS runtime + `curl_cffi` impersonation for full reliability, neither present here) | Free | Watch-page fetch + caption fetch: a few hundred ms–seconds each, observed | Depends on yt-dlp's own extractor staying current with YouTube (it updates frequently: this session's installed build was dated 2026.07.04); real 429s under repeated use |
| **youtubei.js (Node/InnerTube)** | ✅ Metadata (title/duration/channel). ❌ Captions on 2 of ~14 available client profiles, current library version. Crash evidence suggests the data exists; the client-side parser is what's lagging. | Could run **in Vercel** (pure JS, no subprocess) if caption extraction is fixed | Free | Metadata fetch: ~1–2s observed | Version-lag risk explicit and observed (crashed on iOS client); needs either a newer library version, a different client profile, or both, proven before relying on it |
| **Browser bridge (extension)** | ✅ Architecture fully proven (real MV3, real session, real handshake). ❌ Same extraction failure as server-side, because it uses the same weak method. | User's own browser (sidesteps datacenter-IP block specifically) | Free | Bridge round-trip: sub-second once ready | Currently blocked on the same fragility as the HTML-scrape method; **fixable** by swapping in an InnerTube-style fetch inside `background.mjs` (not yet built) |
| **Server-side HTML scrape (current `youtube-actions.ts`)** | ❌ Failed in this session (empty `timedtext` body), consistent with Round 3's extension finding using the same method | Vercel serverless | Free (or paid via optional `SCRAPERAPI_KEY` proxy) | N/A — didn't produce content | The weakest link; superseded by the yt-dlp/InnerTube finding |
| **Speech-to-text (faster-whisper, local)** | ✅ Full pipeline proven (Round 4): real audio → real transcript → real timestamps (word-level, regroupable), verified against ground truth, ~250MB RAM, ~2.3s per 19s of audio on 1 CPU thread | Dedicated worker (audio download + ffmpeg + Python/faster-whisper; **not** Vercel-serverless — needs real CPU time and a real filesystem for temp audio) | Free (no paid API) | For a 19s clip: 2.3s transcription (excluding one-time model download). Scales roughly with audio duration on CPU; a 20-minute video would need proportionally more wall-clock time than fits in typical serverless limits, reinforcing the "dedicated worker" architecture call | Model-size/CPU trade-off (this box: `tiny` only, given ~1.5GB free RAM) — a production worker with its own dedicated resources could safely run a larger, more accurate model |

**Recommended provider order** (evidence-based, not theoretical):

```
1. yt-dlp (worker/container, InnerTube via its own client-fallback logic)   — proven, both caption types, real timestamps
2. browser bridge, AFTER extraction method inside it is upgraded            — proven architecture, extraction fix is a known, scoped follow-up
3. youtubei.js (in-process Vercel/Node call)                                — proven for metadata only right now; promote to a real fallback once caption extraction is fixed/re-tested
4. speech_to_text (worker, faster-whisper)                                  — proven end-to-end; the correct terminal fallback when no caption track exists (or all of 1–3 fail)
```

The old server-side HTML-scrape (current `youtube-actions.ts`) and the extension's current extraction method are **not** part of this chain going forward — both are the same superseded technique.

## Rate-limit and resource observations (Rounds 1–6, consolidated)

- One HTTP 429 total, on the very first yt-dlp download attempt of this whole session (against `9bZkp7q19f0`), immediately after several prior watch-page fetches to the same video from earlier Node-based testing. Zero 429s across every subsequent request in Rounds 1–6, once pacing was respected (one request at a time, no immediate retries, different videos where practical). No `Retry-After` header was present on the 429 response.
- Peak measured RSS for the STT step: 252MB. System-wide available memory hovered around 1.4–1.7GB free throughout — tight, but nothing crashed or was OOM-killed this session.
- No cookies, auth headers, session tokens, PO tokens, API keys, or Supabase secrets were printed or committed at any point in Rounds 1–6.

## Hard Acceptance Gate #1 — status

| # | Requirement | Status |
|---|---|---|
| 1 | Real manual caption extraction | ✅ Demonstrated (yt-dlp, TED talk, 427 real segments) |
| 2 | Real auto-caption extraction | ✅ Demonstrated (yt-dlp, Me at the zoo, 6 real segments) |
| 3 | Real timed segments | ✅ Demonstrated (both above; word-level timestamps also proven for the STT path) |
| 4 | Language selection | ✅ Demonstrated (`--sub-lang en` explicitly honored) |
| 5 | At least one fallback provider | ✅ Demonstrated (yt-dlp succeeded where the HTML-scrape method — used by both the server action and the browser extension — failed) |
| 6 | Real browser-session bridge test | ✅ Completed (Playwright + real loaded extension + real youtube.com session + real bridge handshake — see Round 3). Bridge architecture proven; its current extraction method is proven broken and needs replacing (a scoped, known fix, not an open question) |
| 7 | Captionless public video → audio → local STT → timed `TranscriptSegment[]`, output must contain real timestamps | ❌ **Not completed as literally specified.** Proven in two separate halves: (a) pipeline runs correctly end-to-end on a video *independently confirmed* to have zero captions (`Qo4JIT8jMtI`) — correctly produces an empty result (no speech present, no crash, no hallucination); (b) the same pipeline produces real, accurate, correctly-timed segments when given real speech (verified against ground truth on `jNQXAC9IVRw`, which *does* have existing captions). No single video was found that is both genuinely caption-free *and* contains real speech, despite a genuine, rate-limit-respecting search attempt — so the specific evidence the brief requires (real timestamps produced by STT on a video with zero pre-existing captions) does not exist yet |

**Gate #1: BLOCKED.** Six of seven requirements have complete, real, non-mocked evidence. Item 7 is the one exception, and it fails on a precise, narrow technicality: I have not produced a single run where a genuinely caption-free video's real spoken content was recovered by STT with real timestamps — only the mechanism split across two videos (correct behavior on true captionless input; accurate timed transcription on real speech elsewhere). This is not being called "future work" while treating the Slice as ready — Video Reader implementation has not started, and per the standing instruction, will not start until this is closed. The blocker is narrow and specific: find one real, public, non-age-restricted video with genuine spoken content and zero caption tracks (auto or manual), confirm via `yt-dlp --list-subs`, and run the already-fully-proven pipeline against it.

## Round 7 — targeted search for the missing "captionless + real speech" video (Gate #1 item 7, retry)

Web research first (per instruction), then a strict, budgeted 10-candidate empirical search. No parallel requests; stopped immediately on the budget limit (no 429 was hit this round).

**Web research findings** (informed candidate strategy, cost zero YouTube requests):
- YouTube's own help docs confirm automatic captions "may not be ready at the time you upload... may take several minutes to 24 hours," depending on audio complexity — the basis for trying very-recently-uploaded content.
- GitHub issue search for `youtube-transcript-api` "No transcripts were found" surfaced only language-code-mismatch cases (e.g. a request for `ru`/`en` when only other languages were available) on well-known, clearly-captioned videos (including `dQw4w9WgXcQ`) — not genuine zero-caption examples. Not useful as direct candidates.
- Current YouTube ASR language coverage is very broad (reported ~65+ languages across recent sources, vs. an older official support page listing far fewer) — confirmed empirically below: every candidate list-subs check returned an exhaustive ~150-language automatic-caption menu when auto-captions existed at all, which was every time real speech was present.

**Candidates checked (10/10 budget used, one precise re-check of a prior-round partial result counted as #1):**

| # | Video ID | Title | Duration | Views | Manual captions | Auto captions | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | `7x5tuh7Kllc` | "Record A PRO VOICEOVER On Your PHONE For YouTube Videos" | 130s | — | None | **Yes** (full ~150-language ASR menu) | Disqualified |
| 2 | `klYbu-sVWFA` | "Most Of You Will Never Get Monetized Now..." (uploaded *same day*, testing the 24h-lag theory) | 555s | — | **Yes** (English) | Yes | Disqualified — even same-day uploads from established channels get captioned fast |
| 3 | `8S0FDjFBj8o` | "How to sound smart in your TEDx Talk" (TEDx) | 356s | 15,643,830 | — | — | Not individually re-verified (near-certain captioned at this view count); excluded from further checks |
| 4 | `qiqllkchWTI` | "G-Eazy x Bebe Rexha – Me, Myself & I (Lyrics)" | 255s | 6,218,730 | — | — | Same — major-label lyric video, excluded |
| 5 | `-RXD4bTuFTo` | "Ryan Greenblatt – What happens once AI can automate AI research?" | 7952s | 71,488 | — | — | Same — long-form conference-style talk, excluded |
| 6 | `9hul0PH6Zrs` | Chat-show clip (Sundeep Kishan / Suma) | 2586s | 1,586,082 | — | — | Same — high-view produced content, excluded |
| 7 | `I1DreZNIo-E` | "Mic testing 1.. 2.. 3.." | 22s | 102,417 | — | Yes (indicated by adjacent `ab`/`en` rows) | Disqualified |
| 8 | `mJIVUnUgP94` | "mic Check 1 2 3" | 7s | 45,011 | — | Yes (same) | Disqualified |
| 9 | `BE9JqJVMbSs` | "Mic Check 1, 2, 3..." | 6s | 5,178 | None | **Yes** (full ~150-language ASR menu, precisely re-verified with a dedicated `--list-subs` call) | Disqualified |
| — | (batch: `--match-filter "view_count<500"` + "voice memo test upload ignore" query) | — | — | — | — | — | **Zero results** — filter silently rejected every match before any info printed; not counted as a distinct candidate since no video-level data was obtained |

**Qualifying captionless+speech video found: none.**

**Consistent, striking finding**: every single candidate that contained genuine, substantial spoken content — down to a 6-second "mic check 1, 2, 3" clip with 5,178 views — already had a full automatic-caption track in ~150 languages. Candidates 3–6 (very high view counts) were excluded from individual verification as near-certainly captioned rather than spending budget confirming the obvious. The 10-candidate budget was exhausted without finding a video meeting both required conditions (zero manual **and** zero automatic captions) while containing real speech.

**Steps 3–6 of this round's procedure (speech qualification, extraction, transcription, sanity-check) were not reached** — no candidate survived Step 2's caption check to be handed to Step 3. This is not a shortcut: Step 4 (full fallback run) requires a qualifying candidate as its precondition, and none existed.

**Cleanup**: all temporary audio/video artifacts from prior rounds (`jNQXAC9IVRw.audio.wav` 3.6MB, `Qo4JIT8jMtI.captionless.wav` 960KB, `Qo4JIT8jMtI.raw.webm` 333KB, and the Playwright extension browser profile) were deleted from `research/youtube-transcript/out/`. Retained: the two small real caption samples used as ground truth (`iG9CE55wbtY.manual.en.json3`, 59KB; `jNQXAC9IVRw.en.json3`, 918 bytes) — both were already gitignored (`research/**/out`) and were never staged for commit; no large media has ever entered git history for this Slice.

### Hard Acceptance Gate #1 — final status for this round

**HARD ACCEPTANCE GATE #1: BLOCKED.**

Six of seven requirements remain fully demonstrated with real, non-mocked evidence (manual captions, auto captions, timed segments, language selection, fallback provider, real browser-session bridge test). Item 7 — a single combined run of `real captionless video with speech → STT → non-empty timed TranscriptSegment[]` — was not achieved this round either, despite a good-faith, budget-respecting, web-research-informed search. The blocker is unchanged in kind but now has much stronger evidence behind it: on current YouTube, essentially all real spoken-word content, regardless of size, obscurity, or triviality, already carries automatic captions in dozens of languages. Per the standing instruction, the Slice does not proceed to Video Reader implementation while this gate is blocked.

## Next steps (proposed, not yet executed)

1. **Phase 2 full test corpus** — assemble and run the complete required matrix (Shorts, 30–60min, non-English, multi-caption-language, and the one remaining true-zero-caption-with-speech case) now that all 4 extraction mechanisms have real proof-of-concept.
2. **Phase 3 provider architecture** — implement the actual `YouTubeTranscriptProvider` interface and the 4-provider fallback chain from Round 6, including the InnerTube-style rewrite of `browser-extension/youtube-transcript.mjs`'s extraction method (keeping its bridge architecture unchanged).
3. **Phase 4 infra decision** — formalize the worker/container design for yt-dlp + faster-whisper (confirmed not Vercel-serverless-appropriate) informed by this round's real timing/memory numbers.
4. Only after those: Phase 5 (schema — will stop for approval before any migration, per standing instruction), Phase 6+ (Video Reader implementation).

**Nothing has been merged, no schema has changed, no production code has been touched.** All work lives in `research/youtube-transcript/` (gitignored deps/output) and this doc. No PR opened, no deploy attempted.
