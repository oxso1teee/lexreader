import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canonicalYouTubeUrl,
  classifyYouTubePlayerError,
  getTranscriptNavigation,
  getYouTubePlayerFallback,
  youtubeApiUnavailableState,
  youtubeTimestampUrl,
  type YouTubePlayerState,
} from "./youtube-player-state.ts";

const videoId = "PolmvqSxnbc";

test("IFrame errors 101 and 150 are owner-disabled embedding", () => {
  assert.deepEqual(classifyYouTubePlayerError(101), { status: "embed_forbidden", errorCode: 101 });
  assert.deepEqual(classifyYouTubePlayerError(150), { status: "embed_forbidden", errorCode: 150 });
});

test("IFrame error 100 is a distinct unavailable-video state", () => {
  assert.deepEqual(classifyYouTubePlayerError(100), { status: "video_unavailable", errorCode: 100 });
});

test("IFrame error 153 is an integration/client-identity error, not owner-disabled", () => {
  const state = classifyYouTubePlayerError(153);
  assert.deepEqual(state, { status: "player_error", errorCode: 153, reason: "client_identity" });
  assert.doesNotMatch(getYouTubePlayerFallback(state, videoId)?.description ?? "", /автор.*отключил/i);
});

test("IFrame errors 2, 5, and unknown errors remain distinct player errors", () => {
  assert.deepEqual(classifyYouTubePlayerError(2), {
    status: "player_error",
    errorCode: 2,
    reason: "invalid_parameter",
  });
  assert.deepEqual(classifyYouTubePlayerError(5), {
    status: "player_error",
    errorCode: 5,
    reason: "html5",
  });
  assert.deepEqual(classifyYouTubePlayerError(999), {
    status: "player_error",
    errorCode: 999,
    reason: "unknown",
  });
  assert.deepEqual(youtubeApiUnavailableState(), {
    status: "player_error",
    errorCode: null,
    reason: "api_unavailable",
  });
});

test("owner-disabled fallback keeps learning features available and uses the canonical source URL", () => {
  const fallback = getYouTubePlayerFallback(classifyYouTubePlayerError(101), videoId);
  assert.deepEqual(fallback, {
    title: "Видео нельзя воспроизвести внутри LexReader",
    description:
      "Автор видео отключил просмотр на других сайтах. Субтитры и функции обучения по-прежнему доступны.",
    actionLabel: "Открыть на YouTube",
    url: "https://www.youtube.com/watch?v=PolmvqSxnbc",
  });
  assert.equal(canonicalYouTubeUrl(videoId), "https://www.youtube.com/watch?v=PolmvqSxnbc");
});

test("timestamp fallback opens the canonical video at whole t= seconds", () => {
  assert.equal(
    youtubeTimestampUrl(videoId, 206_999),
    "https://www.youtube.com/watch?v=PolmvqSxnbc&t=206s",
  );
  assert.deepEqual(
    getTranscriptNavigation("timestamp", classifyYouTubePlayerError(150), videoId, 206_999),
    { kind: "external", url: "https://www.youtube.com/watch?v=PolmvqSxnbc&t=206s" },
  );
  assert.deepEqual(
    getTranscriptNavigation("line", classifyYouTubePlayerError(100), videoId, 206_999),
    { kind: "external", url: "https://www.youtube.com/watch?v=PolmvqSxnbc&t=206s" },
  );
});

test("embeddable ready path still seeks in the existing player", () => {
  const ready: YouTubePlayerState = { status: "ready" };
  assert.deepEqual(getTranscriptNavigation("line", ready, videoId, 206_500), {
    kind: "seek",
    seconds: 206.5,
  });
});

test("word interaction always stays inside LexReader", () => {
  assert.deepEqual(
    getTranscriptNavigation("word", classifyYouTubePlayerError(101), videoId, 206_000),
    { kind: "internal" },
  );
});

test("loading state neither seeks nor opens an external tab", () => {
  assert.deepEqual(getTranscriptNavigation("timestamp", { status: "loading" }, videoId, 206_000), {
    kind: "none",
  });
});

test("WatchPlayer renders the transcript as a sibling of the player fallback and isolates word clicks", () => {
  const source = readFileSync(
    new URL("../../app/watch/[textId]/watch-player.tsx", import.meta.url),
    "utf8",
  );
  const fallbackIndex = source.indexOf('data-testid="youtube-player-fallback"');
  const transcriptSiblingIndex = source.indexOf("\n          {segments.length === 0 ?", fallbackIndex);
  const wordClickIndex = source.indexOf('onClick={(e) => {\n                              e.stopPropagation();', transcriptSiblingIndex);

  assert.ok(fallbackIndex >= 0, "the explicit player fallback must be rendered");
  assert.ok(
    transcriptSiblingIndex > fallbackIndex,
    "the transcript must remain outside the player fallback conditional",
  );
  assert.ok(wordClickIndex > transcriptSiblingIndex, "word clicks must stop line-navigation bubbling");
});
