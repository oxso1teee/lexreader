import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import WordRow from "./word-row";

const TABS = [
  { value: "", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "learning", label: "Изучаются" },
  { value: "known", label: "Выучены" },
];

export default async function NotebookPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  let query = supabase
    .from("vocabulary_items")
    .select("id, headword, translation, status, texts(title)")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: items } = await query;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Мой словарь</h1>
        <a
          href="/api/export/vocabulary"
          download
          className="text-sm text-black/50 underline hover:text-black dark:text-white/50 dark:hover:text-white"
        >
          Экспорт CSV
        </a>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value ? `/notebook?status=${tab.value}` : "/notebook"}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              (status ?? "") === tab.value
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-black/10 hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {!items || items.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          Пока нет слов. Открой текст в библиотеке и тапни по незнакомому слову.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <WordRow
              key={item.id}
              id={item.id}
              headword={item.headword}
              translation={item.translation}
              sourceTitle={(item.texts as unknown as { title: string } | null)?.title ?? null}
              status={item.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}
