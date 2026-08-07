import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import EmptyState from "@/components/empty-state";
import LanguageTwinSubHeader from "../sub-header";
import EvidenceListClient from "./evidence-list-client";
import type { EvidenceRow } from "@/lib/language-twin/types";

export default async function LanguageTwinEvidencePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("language_evidence")
    .select("*")
    .eq("user_id", profile.id)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(200);
  const evidence = (data ?? []) as EvidenceRow[];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <LanguageTwinSubHeader
        title="На чём основан профиль"
        description="Полный список записей, на которых построены выводы — можно удалить любую"
      />
      {evidence.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Записей пока нет"
          body="Записи появляются автоматически из истории повторений, чтения и проверок предложений."
        />
      ) : (
        <EvidenceListClient evidence={evidence} />
      )}
      <p className="text-xs text-[var(--text-secondary)]">
        Удаление здесь удаляет саму запись. Слово, карточка или текст, к которым она относится, никуда не
        пропадают — это касается только «Мой английский».
      </p>
    </div>
  );
}
