import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeTextFamiliarity } from "@/lib/vocabulary/text-familiarity";
import FirstTextView from "./first-text-view";

// docs/moments/ROADMAP.md, этап 7 — First-text. Если для языка пользователя
// нет стартового текста (0056_onboarding_system.sql сеет только 'en' —
// READY_LANGUAGES сейчас только английский), честно уходим в библиотеку
// вместо выдуманного текста.
export default async function FirstTextPage() {
  const profile = await requireProfile();
  if (profile.completed_first_win) redirect("/home");

  const supabase = await createClient();
  const { data: starterText } = await supabase
    .from("texts")
    .select("id, title, body, level_tag, word_count")
    .eq("is_starter", true)
    .eq("language", profile.target_language)
    .maybeSingle();

  if (!starterText) redirect("/library");

  const { data: knownWords } = await supabase
    .from("vocabulary_items")
    .select("headword")
    .eq("owner_id", profile.id)
    .eq("language", profile.target_language);

  const familiarity = computeTextFamiliarity(
    starterText.body,
    (knownWords ?? []).map((w) => w.headword as string),
  );

  return (
    <FirstTextView
      textId={starterText.id}
      title={starterText.title}
      levelTag={starterText.level_tag}
      wordCount={starterText.word_count}
      familiarity={familiarity}
    />
  );
}
