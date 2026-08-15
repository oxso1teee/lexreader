export type YouTubePlayerState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "embed_forbidden"; errorCode: 101 | 150 }
  | { status: "video_unavailable"; errorCode: 100 }
  | {
      status: "player_error";
      errorCode: number | null;
      reason: "invalid_parameter" | "html5" | "client_identity" | "api_unavailable" | "unknown";
    };

export type TranscriptInteraction = "timestamp" | "line" | "word";

export type TranscriptNavigation =
  | { kind: "none" }
  | { kind: "internal" }
  | { kind: "seek"; seconds: number }
  | { kind: "external"; url: string };

export interface YouTubePlayerFallback {
  title: string;
  description: string;
  actionLabel: string;
  url: string;
}

export const YOUTUBE_PLAYER_LOADING: YouTubePlayerState = { status: "loading" };

export function isTerminalYouTubePlayerState(playerState: YouTubePlayerState): boolean {
  return (
    playerState.status === "embed_forbidden" ||
    playerState.status === "video_unavailable" ||
    playerState.status === "player_error"
  );
}

export function transitionYouTubePlayerState(
  current: YouTubePlayerState,
  next: YouTubePlayerState,
): YouTubePlayerState {
  return isTerminalYouTubePlayerState(current) ? current : next;
}

export function classifyYouTubePlayerError(errorCode: number): YouTubePlayerState {
  if (errorCode === 101 || errorCode === 150) {
    return { status: "embed_forbidden", errorCode };
  }
  if (errorCode === 100) {
    return { status: "video_unavailable", errorCode };
  }
  if (errorCode === 2) {
    return { status: "player_error", errorCode, reason: "invalid_parameter" };
  }
  if (errorCode === 5) {
    return { status: "player_error", errorCode, reason: "html5" };
  }
  if (errorCode === 153) {
    return { status: "player_error", errorCode, reason: "client_identity" };
  }
  return { status: "player_error", errorCode, reason: "unknown" };
}

export function youtubeApiUnavailableState(): YouTubePlayerState {
  return { status: "player_error", errorCode: null, reason: "api_unavailable" };
}

export function canonicalYouTubeUrl(videoId: string): string {
  const url = new URL("https://www.youtube.com/watch");
  url.searchParams.set("v", videoId);
  return url.toString();
}

export function youtubeTimestampUrl(videoId: string, startMs: number): string {
  const seconds = Number.isFinite(startMs) ? Math.max(0, Math.floor(startMs / 1000)) : 0;
  const url = new URL(canonicalYouTubeUrl(videoId));
  url.searchParams.set("t", `${seconds}s`);
  return url.toString();
}

export function getTranscriptNavigation(
  interaction: TranscriptInteraction,
  playerState: YouTubePlayerState,
  videoId: string,
  startMs: number,
): TranscriptNavigation {
  if (interaction === "word") return { kind: "internal" };
  if (playerState.status === "loading") return { kind: "none" };
  if (playerState.status === "ready") {
    const seconds = Number.isFinite(startMs) ? Math.max(0, startMs / 1000) : 0;
    return { kind: "seek", seconds };
  }
  return { kind: "external", url: youtubeTimestampUrl(videoId, startMs) };
}

export function getYouTubePlayerFallback(
  playerState: YouTubePlayerState,
  videoId: string,
): YouTubePlayerFallback | null {
  if (playerState.status === "loading" || playerState.status === "ready") return null;

  const common = {
    actionLabel: "Открыть на YouTube",
    url: canonicalYouTubeUrl(videoId),
  };

  if (playerState.status === "embed_forbidden") {
    return {
      ...common,
      title: "Видео нельзя воспроизвести внутри LexReader",
      description:
        "Автор видео отключил просмотр на других сайтах. Субтитры и функции обучения по-прежнему доступны.",
    };
  }

  if (playerState.status === "video_unavailable") {
    return {
      ...common,
      title: "Видео недоступно",
      description:
        "Видео удалено, скрыто или недоступно для просмотра. Если оно доступно на YouTube, субтитры ниже можно продолжать использовать.",
    };
  }

  if (playerState.reason === "client_identity") {
    return {
      ...common,
      title: "Не удалось подключить YouTube-плеер",
      description:
        "YouTube не получил данные, необходимые для встроенного плеера. Открой видео на YouTube — субтитры и функции обучения останутся доступны здесь.",
    };
  }

  if (playerState.reason === "html5") {
    return {
      ...common,
      title: "Не удалось воспроизвести видео",
      description:
        "Плеер YouTube не смог воспроизвести видео в этом браузере. Субтитры и функции обучения по-прежнему доступны.",
    };
  }

  return {
    ...common,
    title: "Не удалось загрузить YouTube-плеер",
    description:
      "Проверь соединение или настройки браузера. Субтитры и функции обучения по-прежнему доступны.",
  };
}
