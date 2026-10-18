import { Capacitor } from "@capacitor/core";

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
