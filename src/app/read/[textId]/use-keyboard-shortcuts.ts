"use client";

import { useEffect } from "react";

// M3 Slice 3: none of these existed before (confirmed by audit — zero
// keydown handlers in reader.tsx). Guarded against input/textarea focus so
// typing a manual translation or a search query never triggers a shortcut.
export function useReaderKeyboardShortcuts({
  onPrevChapterOrPage,
  onNextChapterOrPage,
  onToggleFocus,
  onTogglePlayPause,
  onEscape,
}: {
  onPrevChapterOrPage: () => void;
  onNextChapterOrPage: () => void;
  onToggleFocus: () => void;
  onTogglePlayPause: () => void;
  onEscape: () => void;
}) {
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;

      switch (e.key) {
        case "Escape":
          onEscape();
          break;
        case "ArrowLeft":
          onPrevChapterOrPage();
          break;
        case "ArrowRight":
          onNextChapterOrPage();
          break;
        case "f":
        case "F":
          onToggleFocus();
          break;
        case " ":
          e.preventDefault();
          onTogglePlayPause();
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onPrevChapterOrPage, onNextChapterOrPage, onToggleFocus, onTogglePlayPause, onEscape]);
}
