import { requireProfile } from "@/lib/auth";
import PostHogProvider from "../posthog-provider";
import Nav from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <PostHogProvider userId={profile.id} />
      {/* Идея из разбора конкурента (скрины Lexpring, 2026-07-28): Настройки
          переехали в нижнюю панель как полноценная 6-я вкладка (см. nav.tsx)
          — отдельная иконка-шестерёнка в шапке стала избыточным дублем. */}
      <header className="sticky top-0 z-20 flex items-center justify-center bg-background/95 px-4 py-3 backdrop-blur">
        <span className="text-lg font-bold tracking-tight">LexReader</span>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <Nav />
    </div>
  );
}
