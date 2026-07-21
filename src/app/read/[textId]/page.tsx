import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { TextRow } from "@/lib/types";
import Reader from "./reader";

export default async function ReadPage({
  params,
}: {
  params: Promise<{ textId: string }>;
}) {
  const { textId } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: text } = await supabase
    .from("texts")
    .select("*")
    .eq("id", textId)
    .maybeSingle<TextRow>();

  if (!text) {
    notFound();
  }

  const { data: savedWords } = await supabase
    .from("vocabulary_items")
    .select("headword")
    .eq("owner_id", profile.id);

  const initialSavedHeadwords = (savedWords ?? []).map((w) => w.headword.toLowerCase());

  return (
    <Reader
      textId={text.id}
      title={text.title}
      body={text.body}
      sourceLang={text.language}
      targetLang={profile.native_language}
      initialSavedHeadwords={initialSavedHeadwords}
    />
  );
}
