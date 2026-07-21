import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { translateText } from "@/lib/translate";
import type { SupabaseServerClient } from "@/lib/supabase/server";

async function cachedTranslate(
  supabase: SupabaseServerClient,
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  const { data: cached } = await supabase
    .from("translations_cache")
    .select("translation")
    .eq("source_text", text)
    .eq("source_lang", sourceLang)
    .eq("target_lang", targetLang)
    .maybeSingle();

  if (cached) return cached.translation;

  const translation = await translateText(text, sourceLang, targetLang);

  await supabase
    .from("translations_cache")
    .upsert(
      { source_text: text, source_lang: sourceLang, target_lang: targetLang, translation },
      { onConflict: "source_text,source_lang,target_lang", ignoreDuplicates: true },
    );

  return translation;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { word, sentence, sourceLang, targetLang } = await request.json();
  if (!word || !sourceLang || !targetLang) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  try {
    const [wordTranslation, sentenceTranslation] = await Promise.all([
      cachedTranslate(supabase, word, sourceLang, targetLang),
      sentence ? cachedTranslate(supabase, sentence, sourceLang, targetLang) : Promise.resolve(null),
    ]);

    return NextResponse.json({ wordTranslation, sentenceTranslation });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка перевода" },
      { status: 502 },
    );
  }
}
