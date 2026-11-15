import { SplashScreen } from "@/components/product/onboarding/splash-screen";
import OfflinePage from "../../offline/page";

// docs/moments/ROADMAP.md, этап 7 — Splash/Offline не требуют авторизации
// и реальных данных (в отличие от Goal-pick/Streak-commit/First-text,
// которые пишут в profiles и показываются только живьём в онбординге) —
// тот же приём, что Stage3/Stage6GalleryScreen.
export function Stage7GalleryScreen({ s }: { s: "Splash" | "Offline" }) {
  if (s === "Splash") return <SplashScreen onStart={() => {}} />;
  return <OfflinePage />;
}
