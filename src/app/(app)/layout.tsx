import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import Nav from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background/95 px-4 py-3 backdrop-blur">
        <Link
          href="/settings"
          aria-label="Настройки"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-black/20 text-blue-600 dark:border-white/25"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z" />
          </svg>
        </Link>
        <span className="text-lg font-bold tracking-tight">LexReader</span>
        {/* P0-АУДИТ (раздел 5): раньше здесь был декоративный кружок,
            выглядевший как аватар/кнопка, но ни на что не реагировавший —
            невидимый спейсер той же ширины держит заголовок по центру. */}
        <div className="h-11 w-11" />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <Nav />
    </div>
  );
}
