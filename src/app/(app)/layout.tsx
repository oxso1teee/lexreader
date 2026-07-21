import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import Nav from "./nav";
import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <span className="font-semibold tracking-tight">LexReader</span>
        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="text-sm text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
          >
            Настройки
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
            >
              Выйти
            </button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <Nav />
    </div>
  );
}
