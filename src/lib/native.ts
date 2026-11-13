import { Capacitor } from "@capacitor/core";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

// Тактильный отклик: в нативной обёртке — через Capacitor Haptics, в PWA на
// Android — через Vibration API. iOS Safari vibrate() не поддерживает, там
// вызов молча ничего не делает. Никогда не бросает исключений: тактильность —
// украшение, а не причина сломать тап по кнопке.
export type HapticKind = "light" | "medium" | "success" | "warning";

export async function haptic(kind: HapticKind = "light"): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
      if (kind === "success") {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (kind === "warning") {
        await Haptics.notification({ type: NotificationType.Warning });
      } else {
        await Haptics.impact({ style: kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light });
      }
      return;
    }
    // До первого касания браузер всё равно блокирует vibrate() и пишет
    // ошибку в консоль — не вызываем его зря.
    const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
    if (activated && typeof navigator.vibrate === "function") {
      navigator.vibrate(kind === "light" ? 8 : kind === "medium" ? 15 : 25);
    }
  } catch {
    // Плагин не синхронизирован с нативным проектом (нет `cap sync`) — игнорируем.
  }
}

// docs/moments/mockups/Lesson-choice.dc.html — баннер ответа озвучен звуком.
// В проекте нет ни одного аудио-файла и библиотеки для звука (grep по
// Audio(/.mp3/.wav/.ogg — пусто), поэтому звук синтезируется Web Audio API:
// два чистых тона (верно — выше и с отскоком вверх, неверно — один низкий),
// без скачивания/лицензирования стороннего ассета. Один общий AudioContext
// на вкладку — повторные вызовы не пересоздают его.
export type ReviewSoundKind = "correct" | "incorrect";

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new Ctor();
  }
  return sharedAudioContext;
}

export function playReviewSound(kind: ReviewSoundKind): void {
  if (typeof window !== "undefined" && localStorage.getItem("lexreader_sounds_enabled") === "false") return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const notes = kind === "correct" ? [523.25, 659.25] : [220];
    const noteDuration = kind === "correct" ? 0.11 : 0.18;
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * noteDuration;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === "correct" ? "sine" : "sawtooth";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(kind === "correct" ? 0.18 : 0.12, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + noteDuration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + noteDuration);
    });
  } catch {
    // Автовоспроизведение заблокировано браузером до первого взаимодействия
    // пользователя — звук декоративен, тап по варианту ответа всё равно сработал.
  }
}
