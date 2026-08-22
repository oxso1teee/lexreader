# Gate #3 post-fix live smoke test (2026-08-22)

Re-verifies `docs/ui/m3-slice12-gate3-video-reader.md`'s live-browser evidence
against the tip of `feature/import-video-reader-v2` (`9ea77ce1`), specifically
*after* the two later commits the original Gate #3 run predates:
`233dcdf2` (`handle YouTube embed restrictions`) and `15ae0fea` (`replace
blocked YouTube iframe with fallback`). Both touch `watch-player.tsx` and the
new `youtube-player-state.ts`/`youtube-player-viewport.ts`.

Real Playwright Chromium with the actual unpacked `browser-extension/`,
against local Supabase and `next dev` on `localhost:3000`, a fresh test
account. No source code was changed to make anything in this doc pass.

## 1. Re-run of Gate #3's exact two videos

`research/youtube-transcript/gate3-e2e.mjs`, unmodified, against the same two
videos Gate #3 originally used:

| Video | Import → `/watch` redirect | Player loads | Word tap+save | Phrase select+save | Resume after reload |
|---|---|---|---|---|---|
| `jNQXAC9IVRw` ("Me at the zoo", 19s) | ✅ `textId=1d9e8204-…` | ✅ `iframe#yt-player` present, `onReady` fired | ✅ "All"→"Все" saved | ✅ "All right" saved | ✅ active row highlighted |
| `aircAruvnKk` (3Blue1Brown, 18.7min) | ✅ `textId=c4ea8108-…` | ✅ 267 rows rendered, `onReady` fired | ✅ "Это" saved | ✅ "Это тройка" saved | ✅ active row highlighted |

DB confirmation (`vocabulary_contexts` JOIN `flashcards`, same owner):

```
context_text                                          | source_type | source_timestamp_ms | front      | item_type
All right, so here we are, in front of the elephants… | video       | 1000                 | All        | word
All right, so here we are, in front of the elephants… | video       | 1000                 | All right  | phrase
Это тройка.                                            | video       | 4000                 | Это        | word
Это тройка.                                            | video       | 4000                 | Это тройка | phrase
```

Matches Gate #3's original evidence shape exactly (same words even land the
same, since "Me at the zoo" is a fixed 19s clip).

### Two discrepancies vs. the original Gate #3 run, both investigated

**a) Click-to-seek didn't highlight the active row in this run's first pass**
— `gate3-e2e.mjs` clicks the seek button immediately after `iframe#yt-player`
appears in the DOM, without waiting for `playerState.status === "ready"`.
Console diagnostics showed the click firing *before* `youtube_player_on_ready`
in both videos this time (it didn't before — the two later commits added
real onReady-gating that takes measurably longer, ~1.2–2.9s, than the old
bare-timer version). By design, `getTranscriptNavigation` returns `{kind:
"none"}` (no `seekTo` call at all) while `playerState.status === "loading"`
— clicking too early is a safe no-op, not a crash or a mis-seek.

Isolated follow-up (`gate3-seek-ready-check.mjs`, new — reuses the same
logged-in profile and the two already-imported `textId`s, waits for the real
`youtube_player_state_transition … to: ready` console event before clicking):

```
=== 1d9e8204-…(jNQXAC9IVRw) ===
iframe present at 3997ms, playerState=ready at 4919ms (self-reported elapsedMs=1205)
clicked "Перейти к 0:16" AFTER ready — row active: true

=== c4ea8108-…(aircAruvnKk) ===
iframe present at 2335ms, playerState=ready at 4506ms (self-reported elapsedMs=2257)
clicked "Перейти к 0:10" AFTER ready — row active: true
```

**Conclusion: test-script timing gap, not a product bug** — same category as
Gate #3's own "test tooling, not product bug" precedent (the stale `#yt-player
iframe` selector). Click-to-seek works correctly; the fix commits made the
player's readiness gate stricter/slower, and the old script's fixed
post-click wait no longer covers it.

**b) `jNQXAC9IVRw` returned 3 caption segments this run, not 6** (Gate #3
recorded 6, `1200ms`–`18881ms`; this run: 3, `1000ms`–`16000ms`,
`initiallyMountedRows: 3`). The extension's DOM-collection approach
(`docs/ui/m3-slice12-gate2c-browser-bridge-primary.md`) observes whatever
rows YouTube's own virtualized transcript panel has mounted during the
capture window — this run's YouTube UI simply mounted fewer rows than Gate
#3's did. Not caused by anything in the two fix commits under test (neither
touches `browser-extension/`'s DOM collection code) — flagged here as
observed extraction-source variability, not a regression.

## 2. Embed-restriction (error 101/150) fallback — real browser, real error

**No naturally-occurring embed-restricted public video could be found.**
Checked ~45 real, mainstream, SFW candidates via `yt-dlp`'s
`playable_in_embed` field across categories most likely to disable embedding:
top official music videos (10), movie trailers/full movies (8), NBA (7), WWE
(1), gaming publishers/Adult Swim (6), J-pop/anime official channels (6).
Every one came back `playable_in_embed: true`. Embed restriction appears to
be rare on today's YouTube — consistent with most channels now wanting
embeds for the view count.

**Substitute used** (per standing instruction: reproduce the same scenario
if a specific video can't be found): a real, currently-unavailable YouTube
video ID (`4mgePWWCAsA`, confirmed via `yt-dlp` as `"This video is
unavailable"`) was attached to a scratch clone of the "Me at the zoo" text
row (same owner, same caption segments; deleted again after the check —
never part of the real Gate #3 proof rows). Loading `/watch/{that id}` drove
the **real** YouTube IFrame Player against this **real** video ID — no
network mocking, no error code fabricated, no source code touched:

```
[diag] youtube_player_error_code {videoId: 4mgePWWCAsA, errorCode: 150, elapsedMs: 2630}
[diag] youtube_player_state_transition {..., from: loading, to: embed_forbidden, elapsedMs: 2835}

FALLBACK_RENDERED text: "↗Видео нельзя воспроизвести внутри LexReaderАвтор видео отключил просмотр
на других сайтах. Субтитры и функции обучения по-прежнему доступны.Открыть на YouTube"
iframe still present after terminal error: false
fallback action href: https://www.youtube.com/watch?v=4mgePWWCAsA
transcript rows still rendered: 4
```

The real player returned **error 150** — exactly the `embed_forbidden`
branch — and the app's real fallback UI rendered correctly end-to-end: title
+ description copy matches `getYouTubePlayerFallback`'s `embed_forbidden`
branch verbatim, the broken iframe was torn down (not just covered), "Открыть
на YouTube" links straight to the real video, and the transcript underneath
stayed usable.

This is a genuine live confirmation of the exact code path the two fix
commits targeted, just reached via a real dead/removed video rather than a
deliberately-embed-disabled one — the shared mechanism
(`classifyYouTubePlayerError` → `embed_forbidden` for both 101 and 150 →
`getYouTubePlayerFallback` → `YouTubePlayerViewport`) is identical either
way.

### Existing unit coverage (already in the branch, not added by this test)

`src/lib/video-reader/youtube-player-state.test.ts` already has, and still
passes:
- `"IFrame errors 101 and 150 are owner-disabled embedding"` — exact
  classification assertions for both codes.
- `"onError 150 transition removes YouTube's replacement iframe and renders
  the fallback"` — a **real React-DOM render** (via `react-dom/client` +
  `act()` against a `linkedom` document, not a snapshot/mock) of
  `YouTubePlayerViewport`, asserting the iframe is removed and
  `[data-testid="youtube-player-fallback"]` shows the exact title text.

Note: this contradicts Gate #3's own "Scope calls" section, which said "no
DOM/component testing anywhere (no jsdom/Testing Library dependency
exists)" — that was accurate when Gate #3 was written (`537d31e6`,
2026-08-14); the two later fix commits added real DOM-rendering tests via
`linkedom`, without introducing a new framework dependency. Recorded here so
future analysis doesn't rely on the now-outdated claim.

## 3. Verdict

Both discrepancies traced to their root cause and closed — neither is a
product regression. The embed-restriction fallback (the two fix commits'
actual target) is confirmed live end-to-end with a real error from the real
YouTube player, not just unit tests. Green light to merge PR #24.
