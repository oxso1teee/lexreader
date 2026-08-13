# M3 Slice 12 — Production Architecture Checkpoint

Follows Gate #1 = **PASS (controlled failure-injection proof for STT fallback)**, documented in
`m3-slice12-import-video-reader-v2-audit-and-research.md`. This doc is the architecture decision
record for turning that proven pipeline into a real ingestion system. **No code has been written
against this doc yet. No migration has been applied. No PR is open.**

## 1. Architecture diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser (user's own IP/session)                                     │
│  LexReader tab (/library/new) ──ping──▶ extension background worker │
│        │                                        │                   │
│        │◀───ready/transcript (if extension──────┘                   │
│        │     present AND its extractor is fixed — see §5)           │
└────────┼──────────────────────────────────────────────────────────────┘
         │ paste URL / (optional) browser-bridge result
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Vercel / Next.js  (server actions + API routes)                     │
│  • validate URL → extract+validate video ID (strict regex)          │
│  • auth check (requireProfile)                                      │
│  • dedup check (unique index, §9)                                   │
│  • rate-limit check (reuse texts-row counting, §13)                 │
│  • INSERT texts row (processing_status='pending')                   │
│  • enqueue job → worker (§2)                                        │
│  • poll/return job status (processing_status/stage/error)           │
│  • on ready: render transcript from caption_segments                │
└────────┬──────────────────────────────────────────────────────────────┘
         │ job dispatch (HTTP POST with job id, service-role auth)
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Worker (small container — see §19 for exact deployment)             │
│  provider chain (§5):                                               │
│    yt_dlp_caption → innertube (youtubei.js) → speech_to_text        │
│  speech_to_text sub-pipeline:                                       │
│    yt-dlp (audio, 16kHz mono) → faster-whisper (tiny, pre-baked)    │
│    → word-timestamp regrouping → TranscriptSegment[]                │
│  writes back via Supabase service-role client:                      │
│    UPDATE texts SET processing_status/stage/... , transcript_source │
│    INSERT INTO caption_segments (...)                               │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Vercel / Next.js responsibilities

- Accept the import request (existing `youtube-import-form.tsx` UI, extended).
- Validate the YouTube URL and extract+validate the video ID (reuse the exact regex/host-allowlist logic already proven in `browser-extension/youtube-transcript.mjs`'s `extractVideoId`).
- Authenticate the user (existing `requireProfile()`).
- Deduplicate (§9 — DB-level unique index, app-level conflict handling).
- Rate-limit the request (§13).
- Create the `texts` row in `processing_status='pending'` and hand off to the worker.
- Expose job status (poll a lightweight status endpoint, or — simpler for MVP — just re-fetch the `texts` row's `processing_status`/`processing_stage`/`processing_error` columns from an already-open page; no new polling infrastructure needed for v1).
- Read the completed transcript (`caption_segments`, already RLS-scoped correctly) once `processing_status='ready'`.
- Render the future Video Reader.

**What does NOT belong here**: yt-dlp, ffmpeg, faster-whisper, or any multi-second/multi-minute media processing. The existing `maxDuration=45` precedent on `/library/new` and `/brain` is the practical ceiling for anything Vercel-side; a 10–30 minute video's transcription alone can exceed that (§16), so the actual extraction/transcription work cannot run inline in the request that creates the import.

## 3. Worker responsibilities

- Run `yt_dlp_caption`, `innertube`, and `speech_to_text` in sequence (§5).
- Own all heavy/long-running work: audio extraction, ffmpeg normalization, Whisper transcription, cleanup, retries.
- Write results back to Supabase using the **service-role client** (same pattern `auth-rate-limit.ts` already uses via `createServiceClient()` — not a new pattern).
- Never trust anything except the internal job/`texts.id` it was dispatched with; always re-derive `owner_id` from that trusted row, never from external input (§14).

## 4. Browser extension responsibilities

Kept exactly as today, architecturally: an **optional, client-side, best-effort Tier 0** attempted synchronously during the interactive import request, before a worker job is even created — not a step inside the worker's sequential fallback loop. This matters architecturally, not just cosmetically: a backend worker has no access to the user's browser or cookies, so `browser_bridge` **cannot** be retried by the worker the way `yt_dlp_caption`/`innertube`/`speech_to_text` can. It only ever gets one shot, client-side, at request time.

The existing secure origin-checked message relay (`manifest.json` host/content-script allowlist, `background.mjs`'s `isAllowedSender`, `lexreader-bridge.js`'s origin checks) is **preserved unchanged** — Round 3 proved it end-to-end and it has no identified weakness. Only `youtube-transcript.mjs`'s extraction method needs replacing (a scoped follow-up: swap the HTML-`captionTracks`-scrape for an InnerTube-style fetch, the same category of fix that made `yt_dlp_caption` reliable). Until that fix lands, Tier 0 will keep reporting "no captions" (matching Round 3's measured result) and every import will fall through to the worker chain — which is fine; it degrades to today's effective behavior, not a regression.

## 5. Exact provider chain — challenged and revised

The brief proposed `yt_dlp_caption → browser_bridge → innertube/youtubei.js → speech_to_text` as a single sequential chain. **I'm revising this**, for a concrete architectural reason, not aesthetics: `browser_bridge` isn't a peer of the other three — it's a different *execution tier* (client-side, synchronous, one-shot, only reachable if the extension is installed and a LexReader tab is open) that happens *before* a worker job exists, not a step a worker can retry mid-chain. Slotting it "second" in one linear list, as if a backend process could reach for it, misrepresents how it actually runs.

**Revised structure — two tiers:**

**Tier 0 (client-side, browser only, best-effort, ~1s):**
| Provider | Environment | Timeout | Retry | Notes |
|---|---|---|---|---|
| `browser_bridge` | Browser (extension) | 45s (existing `REQUEST_TIMEOUT_MS`) | 0 (single attempt; worker chain is the real retry surface) | Currently always fails (Round 3) until its extractor is upgraded (§4). Session/auth: uses the real browser's YouTube cookies via `host_permissions`-backed `fetch`. |

**Tier 1 (worker, sequential, server-side):**
| Provider | Environment | Timeout | Retry count | Retryable errors | Terminal errors | Rate-limit behavior | Manual captions | Auto captions | Timestamps | Auth/session matters? | PO-token/challenge risk | Fallback condition |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `yt_dlp_caption` | Worker (Python subprocess) | 30s | 1 retry on network error only | connection reset, DNS failure | 403, empty caption list, "no subtitles" | On 429: **stop immediately, do not retry**, log `rate_limited`, fall through | ✅ Proven | ✅ Proven | ✅ Proven | No (public video access) | Yes — yt-dlp itself warned about needing a JS runtime + `curl_cffi` impersonation for full reliability (Round 2); mitigate by bundling Deno in the worker image | Any terminal error or timeout → next provider |
| `innertube` (youtubei.js) | Worker (in-process Node, no subprocess) | 15s | 1 retry, different client profile (`WEB` → `IOS`) | transient HTTP 5xx | HTTP 400 from `get_transcript`, parser crash (both observed, Round 1) | No dedicated 429 observed this session; treat as terminal on non-2xx | Unproven for extraction (metadata only proven) | Unproven for extraction | N/A (never got this far) | No | Client-profile/schema-lag risk (Round 1: library version behind current YouTube response shape) | Any terminal error or timeout → next provider |
| `speech_to_text` | Worker (Python subprocess: yt-dlp audio + faster-whisper) | 10 min (covers §16's worst case with margin) | 0 (terminal — no further fallback exists) | none — a failure here is a final failure | audio extraction failure, zero-segment result on a video that should have speech, any exception | N/A (no caption endpoint involved) | N/A | N/A | ✅ Proven (word-level, regroupable) | No | No (STT doesn't depend on YouTube's caption-serving quirks at all — its only YouTube dependency is audio delivery, which is a different, less-gated code path) | None — mark job `failed` with the specific reason (§15) |

**Why `yt_dlp_caption` stays first, ahead of `innertube`**, even though `innertube` is architecturally cheaper (in-process, no subprocess): `innertube`'s caption/transcript fetch is *proven broken* this session (real HTTP 400, real parser crash on two client profiles) while `yt_dlp_caption` is *proven working* end-to-end for both caption types. Trying the cheaper-but-broken provider first would add a guaranteed-failing round trip to every single import, before ever reaching the one that works. This directly follows the standing instruction not to promote an unproven provider over a proven one for architectural elegance alone. `innertube` stays in the chain — it's a different code path than `yt_dlp_caption` and could succeed in scenarios where yt-dlp's specific extractor logic fails — just not first.

**No infinite loops**: each provider is attempted exactly once per job (with the one narrow exception of `yt_dlp_caption`'s single network-retry and `innertube`'s single client-profile retry, both bounded). A job that exhausts the chain is marked `failed`, never silently retried by a cron sweep without an explicit user-initiated re-import.

## 6. Provider failure policy

- A provider's failure is caught, logged (§13), and the chain advances — never surfaced to the user mid-chain as an error.
- **429 from any provider**: stop retrying *that provider* immediately, log as `rate_limited` (distinct category from `no_captions`), fall through to the next provider. A 429 must never be interpreted as "this video has no captions."
- **403 on a signed media URL** (observed once, Round 8 setup, on a `--download-sections` + direct-ffmpeg-fetch path): the production audio-extraction call must use yt-dlp's own downloader (not `--download-sections` piped through ffmpeg for network fetch) — the exact invocation that succeeded reliably across every other test this session.
- Only after the *entire* Tier 1 chain is exhausted does the job reach a terminal `failed` state; `speech_to_text`'s own failure (rather than its success) is what actually produces `failed`, since it's the last link.

## 7. Job state machine

Reuses `texts.processing_status` (the existing 4-value enum: `pending`/`processing`/`ready`/`failed`) as the coarse bucket, and `texts.processing_stage` (existing free-text column, currently unused anywhere) as the fine-grained current step — this two-level design was already built into migration `0033_reader_processing_status.sql` and fits the requested state machine without any new columns:

```
processing_status='pending'    stage=null            "В очереди…"
processing_status='processing' stage='validating'    "Проверяем ссылку…"
processing_status='processing' stage='metadata'      "Загружаем информацию о видео…"
processing_status='processing' stage='finding_captions'      "Ищем субтитры…"
processing_status='processing' stage='downloading_captions'  "Загружаем субтитры…"
processing_status='processing' stage='extracting_audio'      "Готовим аудио…"     ← Tier 1 fell through to STT here
processing_status='processing' stage='transcribing'          "Распознаём речь…"
processing_status='processing' stage='normalizing'           "Готовим текст…"
processing_status='processing' stage='saving'                "Сохраняем…"
processing_status='ready'      stage=null            done — redirect to /watch/{id}
processing_status='failed'     stage=null, processing_error=<reason>  show §15's message for that reason
```

- **Terminal states**: `ready`, `failed`. Nothing transitions out of either automatically.
- **Retry transitions**: a failed job is not auto-retried; the user gets a "Попробовать снова" action that creates a **new** attempt (updates the existing row back to `pending` if it's the same video — see §9 — rather than inserting a duplicate).
- **User-visible messages**: exactly the stage strings above while in progress; §15's failure messages on `failed`.
- **After browser fallback is required** (Tier 0 didn't run or failed): the flow is identical to a from-scratch worker job — no special state, since Tier 0 never touches `processing_status` at all (it either succeeds fast, client-side, before any row exists, or the normal server action path creates the row).
- **After STT fallback starts**: `processing_stage` transitions to `extracting_audio` then `transcribing` — this is the exact trigger for switching the UI copy from any caption-related wording to "Распознаём речь…", per the standing instruction to never show "no subtitles" prematurely.
- **Cancellation**: not in MVP scope — a video short enough to matter (see §16's duration caps) completes quickly enough that cancellation isn't a pressing need; flagged as a known gap, not silently ignored.

## 8. Storage / data model audit

**Confirmed via direct schema inspection** (not assumed):

| Requirement | Existing column/table | Verdict |
|---|---|---|
| YouTube video ID | `texts.youtube_video_id` | Reuse |
| Canonical URL | `texts.source_url` | Reuse |
| Title | `texts.title` | Reuse |
| Duration | — | **New column needed** (§9) |
| Transcript language | `texts.language` | Reuse |
| Transcript source/provider | — | **New column needed** (§9) |
| Timed transcript segments | `caption_segments` (start_ms, end_ms, body, segment_index) | Reuse, unchanged |
| Playback resume position | `text_progress.last_page_index` | **Reuse, deliberately** — see below |
| Content type = youtube/video | `texts.youtube_video_id IS NOT NULL` (already the exact discriminator `watch/page.tsx` uses today) | Reuse — no new column |
| Import status | `texts.processing_status` + `processing_stage` (migration 0033, currently dead code — now finally wired up) | Reuse |
| Failure reason | `texts.processing_error` | Reuse |
| User ownership | `texts.owner_id` + existing RLS | Reuse |

**On playback resume**: `text_progress.last_page_index` already gets written by Watch Mode today (`updateTextProgress({ textId, pageIndex: activeIndex, pageCount: segments.length })` in `watch-player.tsx`), treating each caption segment as a "page" exactly the way text reading treats a paginated chunk. Resuming means looking up `caption_segments[last_page_index].start_ms` and seeking there — this is *already the existing, working mechanism*, not a gap. I'm deliberately **not** adding a separate millisecond-precision resume column: it would duplicate an already-functioning field with overlapping semantics, contrary to "prefer reusing existing schema."

**No parallel `youtube_videos` universe is being created** — `texts` + `caption_segments` are structurally sufficient with two additive columns.

## 9. Required schema changes

Two new nullable columns on `texts`, one new partial unique index. See §16 for the exact migration SQL — **not applied, STOP before applying**, per standing instruction.

- `texts.youtube_duration_seconds integer` — needed for: upfront duration-cap enforcement (§13) before spending any extraction/transcription compute, and for a duration display in the UI before the transcript exists.
- `texts.transcript_source text` — needed for: observability/debugging ("why does this transcript look rough — was it STT or manual captions?"), and potentially a future "auto-generated, imperfect" UI badge. Constrained to the six real provider names.
- `texts_owner_youtube_video_uidx` (unique partial index on `(owner_id, youtube_video_id)` where both are non-null) — the DB-level enforcement for §10's dedup policy; without it, dedup would only be a best-effort application-level check with a real race-condition window (two concurrent import requests for the same video).

## 10. Duplicate import behavior

- **Same user, same video, second import request**: DB-enforced via the new unique index. Application code attempts the insert; on a unique-constraint violation, it looks up the existing row by `(owner_id, youtube_video_id)` instead of erroring:
  - existing row `status='ready'` → redirect straight to `/watch/{existing.id}`, no new job.
  - existing row `status='pending'|'processing'` → tell the user an import is already running, link to it.
  - existing row `status='failed'` → offer "Попробовать снова", which **updates that same row** back to `pending` and re-dispatches a job, rather than inserting a duplicate.
- **Different users importing the same video**: **not deduplicated in this MVP.** Each user gets their own independent `texts` row and their own independent provider-chain run (including, potentially, their own separate STT run for the same video). This is a deliberate, RLS-grounded decision, not an oversight: `texts`' RLS policy (`owner_id = auth.uid() OR owner_id IS NULL`) currently means "owner_id IS NULL" *specifically* denotes curated system content — quietly repurposing that to also mean "some other user's cached YouTube import" would blur a real privacy/content-provenance boundary without a deliberate RLS redesign. A shared transcript cache (keyed by `video_id + language`, independent of the `texts` per-user ownership model) is a reasonable **future** optimization to cut redundant STT compute, but it's a distinct v2 design question with its own RLS implications, not something to fold into this migration.
- **Updated captions** (creator edits captions after import): out of scope for MVP, consistent with how article/text imports also don't re-sync source changes after the fact.
- **Deleted user content**: `texts: delete own` RLS + `caption_segments`' `on delete cascade` means a deleted row's unique-index slot is freed automatically; a fresh import of the same video proceeds normally.

## 11. Transcript normalization contract

Canonical shape (unchanged from the research prototypes, now the production contract):

```ts
type TranscriptSegment = { startMs: number; endMs: number; text: string };
```

Normalization rules, all enforced in the worker before any DB write (extending the exact validation already present in `youtube-actions.ts`'s `validateBrowserTranscript()` — not a new pattern):

- Sort ascending by `startMs`.
- Reject/drop any segment with `startMs < 0`.
- Reject/drop any segment where `endMs <= startMs`.
- Drop segments whose `text.trim()` is empty after whitespace normalization (collapse runs of whitespace, per the existing `cleanSegmentBody`/`decodeEntities` pattern).
- Merge pathologically tiny fragments: any segment under ~300ms gets merged into its neighbor rather than kept as a flash-and-gone line (relevant mainly to raw STT word-level output before the ≤6000ms display-bucket regrouping already proven in Round 8).
- Timing precision: keep millisecond integers throughout (matches `caption_segments.start_ms`/`end_ms integer` columns exactly) — sufficient for seek/highlight, no need for sub-millisecond precision.
- Cap segment count at `MAX_SEGMENTS = 10_000` and total transcript length at `MAX_TRANSCRIPT_LENGTH = 200_000` chars — reusing the exact constants already defined (and proven, via real unit tests) in `browser-extension/youtube-transcript.mjs` and mirrored in `youtube-actions.ts`.

## 12. Speech-to-text worker configuration

All numbers below are measured, not estimated (Round 4 + Round 8):

- **Model**: `faster-whisper`, size `tiny`, `compute_type="int8"`. Deliberately the smallest available model for MVP, matching this environment's own memory constraints, which stand in for a genuinely small worker instance.
- **Pre-baked model**: the `tiny` model must be baked into the worker's container image at build time. Measured cold-start model download was 61s (HuggingFace Hub fetch); warm-cache load was 1.58–3.55s. Runtime dependence on Hub availability is an avoidable operational risk — bake it in.
- **CPU assumption**: 1 vCPU is sufficient for MVP — the `tiny`/int8 combination transcribed 19s of audio in 2.3–2.7s (roughly 7–8× realtime) on a single thread in this session's shared, contended 4-core box.
- **RAM expectation**: measured peak RSS 252MB for a 19s clip. Recommend provisioning the worker container with **≥1GB RAM minimum, 2GB recommended** for headroom (ffmpeg's own memory use, OS overhead, and margin for longer clips than were measured).
- **Max supported video duration for MVP**: recommend capping the `speech_to_text` path specifically at **~30 minutes** (extrapolating linearly from the 7–8× realtime measurement: a 30-minute video would need roughly 4 minutes of CPU time — keeps the 10-minute job timeout comfortably safe). The overall import (caption-path providers, which are cheap regardless of video length) can support the full Phase-2-corpus range (up to ~60 minutes); only the STT fallback specifically needs a tighter cap.
- **Temporary disk**: extract audio directly to 16kHz mono WAV (`ffmpeg -ar 16000 -ac 1`), not the maximal-quality extraction used ad hoc in research (`--audio-quality 0` was fine for a 19s research clip but wasteful in production — Whisper resamples to 16kHz internally regardless, so anything higher just wastes disk and I/O time). At 16kHz mono 16-bit, a 30-minute clip is roughly 55MB, not the ~340MB a naive linear extrapolation from the research clip's high-quality extraction would suggest.
- **Max concurrent jobs**: conservative for MVP — **2 concurrent transcriptions per worker instance**, gated by an in-process semaphore/queue. This environment's own repeated OOM-adjacent memory pressure during this session's research work is a direct, empirical argument against over-provisioning concurrency on a small box.
- **Timeout**: 10-minute hard per-job timeout (covers the 30-minute-video worst case with real margin). On breach: mark `failed`, reason `import_timeout`.
- **Cleanup guarantee**: every job writes to its own uniquely-named temp directory (`/tmp/ingest-{jobId}/`, never derived from user-controlled text like the video title), removed in a `finally` block regardless of success/failure — the manual `rm` cleanup used throughout this session's research scripts becomes a guaranteed code path in production, not a manual step.
- **Language detection**: Whisper's own auto-detection, no target-language hint needed for MVP — both real runs this session detected English at 0.95 confidence. An optional hint parameter can be added later if misdetection is observed on ambiguous/accented audio.
- **Failure behavior**: a genuinely empty result (proven safe on real non-speech audio, Round 4/5) must **fail the job** with reason `no_speech_detected` rather than silently saving an empty transcript that would render a broken Video Reader.

## 13. Security controls

- **Strict YouTube host allowlist**: `youtube.com`/`www.youtube.com`/`m.youtube.com`/`youtu.be` only — reuse the exact host-matching logic already in `browser-extension/youtube-transcript.mjs`'s `extractVideoId`.
- **Video ID validation**: `/^[\w-]{6,20}$/`, enforced before any URL is constructed or any shell argument is built — same regex already used across the existing codebase.
- **SSRF**: structurally different exposure than the article-URL-import case (which does need `ssrf-guard.ts`'s DNS-rebinding-safe `assertPublicUrl`/`fetchPublicUrl`, and should keep using it unchanged) — here, the user's raw string is **parsed for a video ID and discarded**; every URL actually fetched is one *we* construct onto a fixed, trusted host. No arbitrary-URL SSRF surface exists in this path as designed.
- **Shell/argument injection**: never build a shell string. Always invoke `yt-dlp`/`ffmpeg` via `execFile`/`spawn` with an **argument array** (exactly as this session's `provider-chain.mjs` already does) — validate the video ID against the strict regex first, as defense in depth, even though the array form already prevents metacharacter injection.
- **Max duration**: fetch metadata first (`yt-dlp --skip-download --print duration`, cheap) and reject upfront if over the cap — never start a real download/transcription on an unbounded-length video.
- **Max audio size**: a second, defense-in-depth check on the actual extracted file size, independent of the metadata-reported duration.
- **Max transcript size**: reuse `MAX_SEGMENTS`/`MAX_TRANSCRIPT_LENGTH` (§11) for both caption-sourced and STT-sourced transcripts.
- **Job spam / rate limiting**: no new table needed — count recent `texts` rows (`owner_id = X AND youtube_video_id IS NOT NULL AND created_at > now() - interval '1 hour'`) and cap per-user imports per hour. (The `auth_attempts` table exists for a different reason — failed auth attempts aren't otherwise captured as rows anywhere — but `texts` rows already are the record here, so a parallel table would be redundant.)
- **Concurrency**: cap in-flight jobs per user (recommend 1) and globally per worker instance (§12).
- **Temporary file isolation**: per-job unique temp directory, never predictable/shared paths.
- **Filename safety**: filenames built only from the validated video-ID regex and an internally-generated job UUID — **never** from the video title, which can contain arbitrary characters.
- **Cleanup**: guaranteed via `finally` (§12).
- **RLS**: unchanged, already correct (§8's direct inspection confirmed owner-scoped policies on both `texts` and `caption_segments`). The worker uses the Supabase **service-role** client (matching `auth-rate-limit.ts`'s existing `createServiceClient()` pattern) to write on behalf of the correct `owner_id`, which it always re-derives from the trusted job row, never from external input.
- **Provider logs**: enum-only fields (`kind`, `outcome`, `reason`) — extend the existing `log.import()`/`captureServerException()` pattern, which the codebase's own a11y test suite already asserts never carries user content (`docs/ui/analytics-events.md` convention).
- **Transcript privacy**: per-user-owned by default (§10); no cross-user sharing in MVP, so no new privacy surface beyond what RLS already enforces.
- **Secrets/cookies/tokens**: the worker's service-role key is a worker-environment secret only, never logged, never sent to the client. No YouTube cookies or PO-tokens are stored anywhere — every provider proven this session (including `yt_dlp_caption`) worked against public videos without an authenticated YouTube session.

## 14. Observability

Extends the existing `log.import()`/PostHog server-event pattern — **no new database table**, matching how the codebase already tracks import outcomes:

- `provider_attempted` (per provider in the chain, one event or one array entry per attempt)
- `provider_succeeded` (which one, if any)
- `failure_category` (enum — see §15's reasons)
- `import_duration_ms` (total, request-to-ready or request-to-failed)
- `stt_duration_ms` (isolated, when the STT path runs)
- `transcript_segment_count`
- `http_403_count`, `http_429_count`, `timeout_count` (aggregate counters, incremented wherever these are observed across any provider)

**Never logged**: full transcript text, cookies, auth headers, tokens, or any other private content — consistent with the existing, already-tested discipline (`e2e/reader-library-a11y.spec.ts`'s dedicated `track()`-payload test).

## 15. Failure UX contract

**Hard rule, restated exactly as instructed**: never show "У видео нет субтитров" (or any variant) until the *entire* provider chain — including the STT fallback — has actually been exhausted. While STT is running, the UI shows "Распознаём речь…", not a caption-related message of any kind.

| `processing_error` reason | User-facing message | Retryable? |
|---|---|---|
| `invalid_url` | "Не распознал ссылку на YouTube-видео." | User must fix the input |
| `unavailable_private` | "Это видео недоступно (приватное или удалено)." | No |
| `geo_age_restricted` | "Это видео недоступно в этом регионе или ограничено по возрасту." | No |
| `rate_limited` | "YouTube временно ограничивает импорт. Попробуй через несколько минут." | Yes — genuinely transient |
| `audio_extraction_failed` | "Не удалось загрузить аудио этого видео. Попробуй другое видео." | Limited — usually not video-specific-fixable |
| `no_speech_detected` | "Не удалось распознать речь в этом видео." (only reachable *after* STT ran and found nothing — never conflated with "no captions") | No |
| `video_too_long` | "Это видео слишком длинное для импорта (максимум N минут)." | No, unless a shorter clip |
| `import_timeout` | "Импорт занял слишком много времени. Попробуй ещё раз или другое видео." | Yes |

## 16. Migration decision

**A migration IS required.** Two additive nullable columns and one partial unique index, all backward-compatible, zero data-loss risk (every existing row already satisfies the new constraints trivially: `youtube_duration_seconds`/`transcript_source` default to `NULL`, and the unique index only applies where `youtube_video_id IS NOT NULL AND owner_id IS NOT NULL`, so no existing row can violate it retroactively unless a genuine duplicate already exists — checked below).

**Pre-flight check for existing duplicates** (read-only; run against the **local** dev database this session — the shared/production Supabase project has not been checked and must be checked again before applying there):
```sql
select owner_id, youtube_video_id, count(*)
from texts
where youtube_video_id is not null and owner_id is not null
group by owner_id, youtube_video_id
having count(*) > 1;
```
**Local result: zero rows** — no existing duplicates in the local dev database, so the unique index would apply cleanly there. This does **not** confirm the same for the shared production database, which has different data and has not been queried this session; the same read-only check must be re-run against production immediately before applying this migration there, and any duplicates resolved first if found.

### 16.1 Exact migration filename

`supabase/migrations/0042_youtube_transcript_provenance.sql`

### 16.2 Full SQL (PROPOSED — NOT APPLIED)

```sql
-- M3 Slice 12: adds transcript provenance + duration to texts (both nullable,
-- additive — every existing row is unaffected, no backfill needed, matching
-- the same "additive, backward-compatible" pattern as migration 0033), plus
-- a DB-level dedup guarantee for per-user YouTube re-imports. See
-- docs/ui/m3-slice12-production-architecture.md §9/§16 for full rationale.

alter table texts
  add column youtube_duration_seconds integer,
  add column transcript_source text
    check (
      transcript_source is null
      or transcript_source in (
        'manual_caption', 'auto_caption', 'innertube',
        'browser_bridge', 'yt_dlp_caption', 'speech_to_text'
      )
    );

-- Run the pre-flight duplicate check in this doc's §16 before applying this
-- index — it will fail to create if any existing (owner_id, youtube_video_id)
-- pair is already duplicated.
create unique index texts_owner_youtube_video_uidx
  on texts (owner_id, youtube_video_id)
  where youtube_video_id is not null and owner_id is not null;
```

### 16.3 Every column/table/index added

- `texts.youtube_duration_seconds` (integer, nullable) — new column.
- `texts.transcript_source` (text, nullable, CHECK-constrained to 6 known provider values) — new column.
- `texts_owner_youtube_video_uidx` (unique partial index) — new index.
- No new tables.

### 16.4 Why existing schema is insufficient

Covered in full in §8/§9: `caption_segments`, `processing_status`/`stage`/`error`, `source_url`, `youtube_video_id`, and `text_progress.last_page_index` are all sufficient and reused unchanged. Only duration (needed *before* transcription starts, for upfront cap enforcement) and provider provenance (no existing field captures which of 6 providers produced a given transcript) are genuinely missing, plus dedup has no DB-level enforcement today.

### 16.5 RLS impact

None. Neither new column is referenced by any existing RLS policy; the new index has no RLS implications (indexes don't carry row-security semantics). Existing `texts`/`caption_segments` policies (confirmed via direct inspection, §8) remain unchanged and correctly scoped.

### 16.6 Existing-data impact

None for the two new columns (both nullable, no default computation needed, no backfill). The unique index requires the pre-flight duplicate check above to pass first — this has **not yet been run** against the shared database, so the true impact is unconfirmed until that read-only query is executed.

### 16.7 Backfill

Not needed. `youtube_duration_seconds` and `transcript_source` are `NULL` for all pre-existing rows, which is the semantically correct "unknown/not applicable" state for text imported before this migration (including non-YouTube texts, for which these columns will always legitimately stay `NULL`).

### 16.8 Rollback SQL

```sql
drop index if exists texts_owner_youtube_video_uidx;
alter table texts
  drop column if exists youtube_duration_seconds,
  drop column if exists transcript_source;
```

### 16.9 Supabase SQL Editor URL

Not stated here — I don't have the production Supabase project's dashboard URL available to state accurately, and fabricating a project-ref-specific URL would be worse than omitting it. It will be under your Supabase project's own **SQL Editor** section once you're ready to review/apply this manually.

**This migration has not been applied anywhere, including locally.** Per the standing instruction, it stops here for your review.

## 17. Worker deployment recommendation

No existing worker/container infrastructure exists in this repo today (confirmed: no `Dockerfile`, no `fly.toml`/`railway.json`/`render.yaml`, no queue/job-runner dependency in `package.json`) — this is genuinely new infrastructure, not an extension of something already running.

| Option | Fit |
|---|---|
| Vercel Edge/Serverless Function | **No** — Python (`faster-whisper`) and `yt-dlp`/`ffmpeg` binaries don't run in Vercel's standard Node runtime; even with a custom runtime, the 45–300s duration ceiling conflicts with §12's measured worst-case timing |
| Supabase Edge Function (Deno) | **No** — same binary-dependency problem (no `ffmpeg`/`yt-dlp`/Python), plus Deno Edge Functions have their own tight CPU-time limits, ill-suited to multi-minute transcription |
| Docker on a small VPS | **Yes, recommended for MVP** — full control over the runtime (Python + faster-whisper + yt-dlp + ffmpeg + a JS runtime for yt-dlp's own reliability, per §5), predictable cost, straightforward to reason about with the request/duration numbers now in hand (§12) |
| Railway/Fly/Render-style container platform | **Reasonable alternative** — same underlying Docker image as the VPS option, but with less manual ops (managed deploys, easier scaling later). Slightly more operational complexity than a bare VPS to set up initially, less to maintain long-term |

**Recommended MVP**: a single small container (1–2 vCPU, 2GB RAM per §12) running a minimal HTTP job-dispatch endpoint, deployed via whichever of "small VPS" or "Fly/Railway-style platform" is operationally simpler for you day-to-day — both satisfy the requirements identically; the choice is an ops-preference call, not a technical one, so I'm not picking one over the other without your input.

**Runtime requirements**:
- Python 3.11+ with `faster-whisper` + dependencies (as already proven in `whisper-venv/`).
- `ffmpeg` (already proven available; standard package on any base image).
- `yt-dlp` (kept current — its extractor logic changes frequently; the worker image build should pin a version and have an easy, low-risk update path, not auto-update at runtime).
- A JS runtime for yt-dlp's own signature-challenge solving — bundle Deno (yt-dlp's own documented default) in the image to close the "no supported JavaScript runtime" warning observed throughout this session.
- The `tiny` Whisper model **pre-baked into the image** (§12) — no runtime HuggingFace Hub dependency.
- A minimal job-intake mechanism: for MVP, a simple authenticated HTTP endpoint the Vercel side calls after creating the `texts` row is sufficient — no message queue needed at this scale.

**Operational complexity**: low for MVP as scoped — one container, one job type, no distributed queue, no autoscaling group. This matches the standing instruction to "prefer a simple deployable worker over unnecessary distributed complexity."

## 18. Duplicate/global-cache question — explicit answer

Per §10: transcript data is **per-user-owned in this MVP, not globally cached**. This was a deliberate check against the existing RLS model (§8), not an unexamined default.

## 19. Exact implementation order after approval

1. Apply the migration (§16) — **only after you've run the pre-flight duplicate check and reviewed the SQL**.
2. Build the worker's provider-chain module in TypeScript/Node (port `research/youtube-transcript/provider-chain.mjs`'s proven dispatcher logic into production code, replacing the 5 injected-failure stubs with real provider implementations — `yt_dlp_caption` and `speech_to_text` already have fully-proven reference implementations from this session's research to port directly; `innertube` needs its client-profile issue actually resolved or explicitly deprioritized).
3. Containerize the worker (§17), including the pre-baked Whisper model and bundled Deno runtime.
4. Wire the Vercel-side job creation + dispatch + status-read flow (§2), reusing `requireProfile`, the SSRF-guard pattern's *discipline* (even though this specific path doesn't need `assertPublicUrl` itself, §13), and the existing `log.import()` telemetry pattern (§14).
5. Extend `youtube-import-form.tsx`'s existing Tier 0 bridge-detection flow to hand off to the new job-based flow when the bridge is unavailable or fails (replacing the current direct call to `createTextFromYoutube`).
6. Build/update automated tests: provider-chain unit tests (mocked, deterministic — the dispatcher logic itself, not real network calls), plus a real-network smoke test analogous to this session's research scripts, run manually/rarely rather than in CI.
7. Only after all of the above is verified working: begin Video Reader UI implementation (Phase 6 of the original brief) — explicitly **not** part of this checkpoint.

## 20. Blockers / risks still remaining

- **`innertube` extraction is unresolved.** It remains in the chain as documented, proven-broken-for-captions middle link. Either fix it (upgrade `youtubei.js`, try more client profiles) or explicitly demote/remove it before relying on it in production monitoring dashboards.
- **`browser_bridge`'s extractor rewrite is not yet built.** Tier 0 will keep contributing nothing until this lands — not a regression, but a known gap, explicitly not closed by this checkpoint.
- **yt-dlp's own reliability is externally dependent.** It requires periodic updates to keep pace with YouTube's extractor-breaking changes (observed first-hand: the installed build was dated 2026.07.04, and yt-dlp's own runtime warnings flagged missing JS-runtime/impersonation dependencies for full reliability). The worker's image-build process needs an update cadence, not a "set and forget" pin.
- **No naturally captionless public spoken video was found within Round 7's search budget** — restated here deliberately, per the standing instruction, since it remains true and relevant to how confident the STT path's *real-world trigger rate* can be estimated (it may be rare in practice for typical English-language content, more common for non-English/rare-language/poor-audio content — untested).
- **Worker infrastructure is entirely new** — no existing deployment pattern to build on, more ops surface than anything else in this codebase to date.
- **Global transcript caching was deliberately deferred**, not solved — redundant STT runs across different users importing the same popular video are a real, known, accepted MVP cost.
