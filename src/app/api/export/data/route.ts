import { createClient } from "@/lib/supabase/server";

// P1-AUTH-06: «скачать мои данные» — минимальное соответствие праву на
// переносимость данных (GDPR и аналоги). Не включает Stripe customer/
// subscription ID (внутренние идентификаторы платёжного провайдера, не
// нужны пользователю) и уж тем более номера карт (их у нас никогда не было —
// оплата целиком на стороне Stripe).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [
    profile,
    texts,
    vocabulary,
    decks,
    flashcards,
    readingSessions,
    subscription,
    languageTwinProfile,
    languageTwinPatterns,
    languageTwinEvidence,
    languageTwinRecommendations,
    languageTwinSettings,
    languageTwinCorrections,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("texts").select("*").eq("owner_id", user.id),
    supabase.from("vocabulary_items").select("*").eq("owner_id", user.id),
    supabase.from("decks").select("*").eq("owner_id", user.id),
    supabase.from("flashcards").select("*").eq("owner_id", user.id),
    supabase.from("reading_sessions").select("*").eq("owner_id", user.id),
    supabase
      .from("subscriptions")
      .select("plan, status, provider, current_period_end")
      .eq("owner_id", user.id)
      .maybeSingle(),
    // M3 Slice 5 — Language Twin data, added to this existing export
    // endpoint rather than a new one (docs/ui/m3-slice5-language-twin-plan.md
    // §26). Soft-deleted evidence is excluded — the user already asked for
    // it to be gone.
    supabase.from("language_twin_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("language_error_patterns").select("*").eq("user_id", user.id),
    supabase.from("language_evidence").select("*").eq("user_id", user.id).is("deleted_at", null),
    supabase.from("language_recommendations").select("*").eq("user_id", user.id),
    supabase.from("language_twin_settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("language_correction_submissions")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    texts: texts.data ?? [],
    vocabulary: vocabulary.data ?? [],
    decks: decks.data ?? [],
    flashcards: flashcards.data ?? [],
    reading_sessions: readingSessions.data ?? [],
    subscription: subscription.data ?? null,
    language_twin: {
      profile: languageTwinProfile.data ?? null,
      patterns: languageTwinPatterns.data ?? [],
      evidence: languageTwinEvidence.data ?? [],
      recommendations: languageTwinRecommendations.data ?? [],
      settings: languageTwinSettings.data ?? null,
      correction_submissions: languageTwinCorrections.data ?? [],
    },
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lexreader-data-export.json"',
    },
  });
}
