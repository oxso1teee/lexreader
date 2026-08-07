import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import EmptyState from "@/components/empty-state";
import LanguageTwinSubHeader from "../sub-header";
import PatternListClient from "./pattern-list-client";
import type { EvidenceRow, PatternRow } from "@/lib/language-twin/types";

export default async function LanguageTwinPatternsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: patternsData } = await supabase
    .from("language_error_patterns")
    .select("*")
    .eq("user_id", profile.id)
    .order("status", { ascending: true })
    .order("severity", { ascending: false });
  const patterns = (patternsData ?? []) as PatternRow[];

  const patternIds = patterns.map((p) => p.id);
  let evidenceByPattern: Record<string, EvidenceRow[]> = {};
  if (patternIds.length > 0) {
    const { data: evidenceData } = await supabase
      .from("language_evidence")
      .select("*")
      .eq("user_id", profile.id)
      .in("pattern_id", patternIds)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false });
    evidenceByPattern = (evidenceData ?? []).reduce<Record<string, EvidenceRow[]>>((acc, e) => {
      const key = e.pattern_id as string;
      (acc[key] ??= []).push(e);
      return acc;
    }, {});
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <LanguageTwinSubHeader title="Паттерны" description="Каждый паттерн подкреплён конкретными примерами из твоей активности" />
      {patterns.length === 0 ? (
        <EmptyState
          icon="🧩"
          title="Паттернов пока нет"
          body="Как только накопится достаточно данных, здесь появятся конкретные паттерны с примерами из твоей активности."
        />
      ) : (
        <PatternListClient patterns={patterns} evidenceByPattern={evidenceByPattern} />
      )}
    </div>
  );
}
