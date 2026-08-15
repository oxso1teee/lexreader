import { createElement, type ReactNode } from "react";

export function YouTubePlayerViewport({
  fallback,
  playerState,
  children,
}: {
  fallback: boolean;
  playerState: string;
  children?: ReactNode;
}) {
  if (fallback) {
    return createElement(
      "section",
      {
        className: "flex h-full flex-col items-center justify-center px-6 text-center sm:px-10",
        "data-player-state": playerState,
        "data-testid": "youtube-player-fallback",
        role: "status",
      },
      children,
    );
  }

  // YT.Player replaces #yt-player with its iframe. Keep that imperative DOM
  // mutation one level below a React-owned host so a terminal error can remove
  // the entire host (and iframe) before rendering the LexReader fallback.
  return createElement(
    "div",
    {
      className: "absolute inset-0 h-full w-full",
      "data-testid": "youtube-player-host",
    },
    createElement("div", { id: "yt-player", className: "absolute inset-0 h-full w-full" }),
  );
}
