import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { parseHTML } from "linkedom";
import {
  canonicalYouTubeUrl,
  classifyYouTubePlayerError,
  getTranscriptNavigation,
  getYouTubePlayerFallback,
  transitionYouTubePlayerState,
  youtubeApiUnavailableState,
  youtubeTimestampUrl,
  type YouTubePlayerState,
} from "./youtube-player-state.ts";
import { YouTubePlayerViewport } from "./youtube-player-viewport.ts";

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

test("terminal player error cannot be overwritten by a late onReady callback", () => {
  const failed = classifyYouTubePlayerError(150);
  assert.deepEqual(transitionYouTubePlayerState(failed, { status: "ready" }), failed);
});

test("onError 150 transition removes YouTube's replacement iframe and renders the fallback", async () => {
  const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
  Object.defineProperty(window, "location", { configurable: true, value: new URL("http://localhost/") });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousNavigator = globalThis.navigator;
  const previousActEnvironment = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: window },
    document: { configurable: true, value: window.document },
    navigator: { configurable: true, value: window.navigator },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });

  try {
    const [{ createRoot }, { act }] = await Promise.all([import("react-dom/client"), import("react")]);
    const rootElement = window.document.querySelector("#root");
    assert.ok(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(createElement(YouTubePlayerViewport, { fallback: false, playerState: "loading" }, null));
    });

    const playerMount = window.document.querySelector("#yt-player");
    assert.ok(playerMount);
    const iframe = window.document.createElement("iframe");
    iframe.id = "yt-player";
    playerMount.replaceWith(iframe);
    assert.equal(window.document.querySelectorAll("iframe#yt-player").length, 1);

    const errorState = classifyYouTubePlayerError(150);
    const fallback = getYouTubePlayerFallback(errorState, videoId);
    await act(async () => {
      root.render(
        createElement(
          YouTubePlayerViewport,
          { fallback: Boolean(fallback), playerState: errorState.status },
          createElement("span", null, fallback?.title),
        ),
      );
    });

    assert.equal(window.document.querySelector("iframe#yt-player, #yt-player iframe"), null);
    assert.equal(
      window.document.querySelector('[data-testid="youtube-player-fallback"]')?.textContent,
      "Видео нельзя воспроизвести внутри LexReader",
    );
    await act(async () => root.unmount());
  } finally {
    Object.defineProperties(globalThis, {
      window: { configurable: true, value: previousWindow },
      document: { configurable: true, value: previousDocument },
      navigator: { configurable: true, value: previousNavigator },
      IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: previousActEnvironment },
    });
  }
});

test("WatchPlayer renders the transcript as a sibling of the player fallback and isolates word clicks", () => {
  const source = readFileSync(
    new URL("../../app/watch/[textId]/watch-player.tsx", import.meta.url),
    "utf8",
  );
  const viewportIndex = source.indexOf("<YouTubePlayerViewport");
  const transcriptSiblingIndex = source.indexOf("\n          {segments.length === 0 ?", viewportIndex);
  const wordClickIndex = source.indexOf('onClick={(e) => {\n                              e.stopPropagation();', transcriptSiblingIndex);

  assert.ok(viewportIndex >= 0, "the explicit player viewport must be rendered");
  assert.ok(
    transcriptSiblingIndex > viewportIndex,
    "the transcript must remain outside the player fallback conditional",
  );
  assert.ok(wordClickIndex > transcriptSiblingIndex, "word clicks must stop line-navigation bubbling");
});
