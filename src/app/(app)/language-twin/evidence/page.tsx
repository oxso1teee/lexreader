import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/product/page-header";
import EmptyState from "@/components/empty-state";
import LanguageTwinNav from "../language-twin-nav";
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
      <PageHeader title="Свидетельства" description="Полный список того, на чём построены выводы — можно удалить любую запись" />
      <LanguageTwinNav current="/language-twin/evidence" />
      {evidence.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Свидетельств пока нет"
          body="Свидетельства появляются автоматически из истории повторений, чтения и проверок предложений."
        />
      ) : (
        <EvidenceListClient evidence={evidence} />
      )}
      <p className="text-xs text-[var(--text-secondary)]">
        Удаление здесь удаляет саму запись-свидетельство. Слово, карточка или текст, к которым она
        относится, никуда не пропадают — это касается только Language Twin.
      </p>
    </div>
  );
}
