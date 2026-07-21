import Link from "next/link";
import NewTextForm from "./new-text-form";

export default function NewTextPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <div className="flex items-center gap-3 px-5 pt-6">
        <Link href="/library" className="text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white">
          ← Библиотека
        </Link>
      </div>
      <h1 className="px-5 pt-2 text-xl font-semibold">Добавить текст</h1>
      <NewTextForm />
    </div>
  );
}
