import Link from "next/link";
import NewDeckModal from "./new-deck-modal";
import ImportModal from "./import-modal";

// Раздел 5 промта 2026-07-30 (композиция): due-count/кнопка повторения,
// карточка "Слова из чтения" и три действия (колода/импорт/настройки) были
// четырьмя отдельными блоками подряд — теперь одна панель управления.
export default function BrainControlPanel({
  dueCount,
  readingWordCount,
  deckOptions,
  targetLanguage,
}: {
  dueCount: number;
  readingWordCount: number;
  deckOptions: { id: string; name: string }[];
  targetLanguage: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-caramel to-caramel-light p-4 text-white shadow-sm">
        {dueCount > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">{dueCount} карточек к повторению</p>
            <Link
              href="/brain/all/review"
              className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              Учить
            </Link>
          </div>
        ) : (
          <p className="font-medium">🎉 Всё повторено!</p>
        )}

        {readingWordCount > 0 && (
          <Link
            href="/notebook"
            className="flex items-center justify-between rounded-xl bg-white/15 px-3 py-2.5 text-sm"
          >
            <span>📖 Слова из чтения · {readingWordCount}</span>
            <span>›</span>
          </Link>
        )}
      </div>

      <div className="flex gap-2">
        <NewDeckModal />
        <ImportModal decks={deckOptions} targetLanguage={targetLanguage} />
        <Link
          href="/brain/settings"
          className="rounded-full border border-black/20 px-4 py-2 text-sm font-medium dark:border-white/25"
        >
          ⚙️ Настройки
        </Link>
      </div>
    </div>
  );
}
