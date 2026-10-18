import Link from "next/link";
import { notFound } from "next/navigation";
import TodayView from "@/components/product/today/v7/today-view";
import TodayEveningView from "@/components/product/today/v7/today-evening";
import MobileBottomNav from "@/components/product/app-shell/mobile-bottom-nav";
import { TODAY_FIXTURE, TODAY_EVENING_FIXTURE } from "@/lib/screen-fixtures";

// Основные экраны v7 с тестовыми данными — для скриншот-сверки с макетами
// (docs/moments/reference). Открыта локально и на preview-деплоях.
export const metadata = { robots: { index: false, follow: false } };

const SCREENS = ["Main", "Today-evening"] as const;

export default async function DevScreensPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const isLiveSite = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";
  if (isLiveSite && process.env.MOMENTS_GALLERY !== "1") notFound();
  const { s } = await searchParams;

  if (s === "Main") {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <main className="flex flex-1 flex-col">
          <TodayView {...TODAY_FIXTURE} />
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  if (s === "Today-evening") {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <main className="flex flex-1 flex-col">
          <TodayEveningView {...TODAY_EVENING_FIXTURE} />
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 p-6">
      <h1 className="font-display text-2xl font-bold">Основные экраны</h1>
      <Link href="/dev/moments" className="text-sm underline">Всплывающие экраны →</Link>
      {SCREENS.map((n) => (
        <Link key={n} href={`/dev/screens?s=${n}`} className="btn btn-ghost btn-md justify-start">
          {n}
        </Link>
      ))}
    </main>
  );
}
