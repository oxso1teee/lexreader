"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getPlan, FREE_TEXT_LIMIT } from "@/lib/subscription";

export interface CreateTextState {
  error?: string;
  paywall?: boolean;
}

export async function createText(
  _prevState: CreateTextState,
  formData: FormData,
): Promise<CreateTextState> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!title || !body) {
    return { error: "Заполни название и текст." };
  }

  const profile = await getProfile();
  if (!profile) {
    return { error: "Не авторизован." };
  }

  const supabase = await createClient();

  const plan = await getPlan(supabase, profile.id);
  if (plan === "free") {
    const { count } = await supabase
      .from("texts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id);
    if ((count ?? 0) >= FREE_TEXT_LIMIT) {
      return { paywall: true };
    }
  }

  const wordCount = body.split(/\s+/).filter(Boolean).length;

  const { data, error } = await supabase
    .from("texts")
    .insert({
      owner_id: profile.id,
      title,
      body,
      source_type: "manual",
      language: profile.target_language,
      word_count: wordCount,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Не удалось сохранить текст." };
  }

  redirect(`/read/${data.id}`);
}
