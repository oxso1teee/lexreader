import type { ReactNode } from "react";
import { messages } from "@/lib/i18n";
import DesktopSidebar from "./desktop-sidebar";
import MobileBottomNav from "./mobile-bottom-nav";

// docs/ui/unified-ui-slice-1-plan.md: заменяет ручную разметку
// header+<Nav/> в (app)/layout.tsx. На мобильном — тот же top bar с
// брендом, что был раньше (ничего не убрали), плюс MobileBottomNav снизу.
// На desktop (md+) top bar скрыт (бренд уже есть в DesktopSidebar) и
// появляется постоянный левый сайдбар — контент страницы получает
// разумный max-width вместо растягивания на всю ширину 1440px.
export default function AppShell({
  children,
  planLabel,
}: {
  children: ReactNode;
  planLabel: string | null;
}) {
  return (
    <div className="flex min-h-screen flex-1">
      <DesktopSidebar planLabel={planLabel} />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-background">
        <header
          className="sticky top-0 z-20 flex items-center justify-center bg-background/95 px-4 py-3 backdrop-blur md:hidden"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <span className="text-lg font-bold tracking-tight">{messages.appShell.brand}</span>
        </header>

        <main className="flex flex-1 flex-col md:mx-auto md:w-full md:max-w-[var(--container-dashboard)]">
          {children}
        </main>

        <MobileBottomNav />
      </div>
    </div>
  );
}
