import { Search, Notebook } from "lucide-react";
import SharedEmptyState from "@/components/empty-state";

export default function EmptyState({ filtered = false }: { filtered?: boolean }) {
  return (
    <SharedEmptyState
      icon={filtered ? Search : Notebook}
      title={filtered ? "Ничего не найдено" : "Пока нет слов"}
      body={
        filtered
          ? "Попробуй изменить запрос поиска или выбрать другой фильтр."
          : "Открой любой текст в Библиотеке и нажми на незнакомое слово, чтобы сохранить его"
      }
    />
  );
}
