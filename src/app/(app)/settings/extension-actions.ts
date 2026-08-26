"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { generateExtensionToken, hashToken, last4 } from "@/lib/extension-tokens";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "тап-перевод на любой странице". Персональный API-токен для расширения:
// генерируется здесь под обычной cookie-сессией (владелец уже
// аутентифицирован), но проверяется на входе в api/extension/** через
// service_role (см. src/lib/extension-tokens.ts) — у контент-скрипта на
// стороннем сайте cookie-сессии LexReader нет.
export interface ExtensionTokenSummary {
  id: string;
  label: string;
  last4: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function listExtensionTokens(): Promise<ExtensionTokenSummary[]> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("extension_api_tokens")
    .select("id, label, token_last4, created_at, last_used_at")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    last4: row.token_last4,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

export interface CreateExtensionTokenResult {
  ok: boolean;
  error?: string;
  token?: string;
  summary?: ExtensionTokenSummary;
}

// Токен возвращается plaintext ровно один раз, в ответе этого экшена — БД
// хранит только его хэш (extension-tokens.ts), поэтому показать его снова
// после перезагрузки страницы уже невозможно, ровно как у GitHub PAT.
export async function createExtensionToken(label: string): Promise<CreateExtensionTokenResult> {
  const profile = await requireProfile();
  const trimmedLabel = label.trim() || "Расширение";
  if (trimmedLabel.length > 60) return { ok: false, error: "Слишком длинное название." };

  const supabase = await createClient();
  const token = generateExtensionToken();
  const { data, error } = await supabase
    .from("extension_api_tokens")
    .insert({
      owner_id: profile.id,
      token_hash: hashToken(token),
      token_last4: last4(token),
      label: trimmedLabel,
    })
    .select("id, label, token_last4, created_at, last_used_at")
    .single();
  if (error || !data) return { ok: false, error: "Не удалось создать токен. Попробуй ещё раз." };

  revalidatePath("/settings");
  return {
    ok: true,
    token,
    summary: {
      id: data.id,
      label: data.label,
      last4: data.token_last4,
      createdAt: data.created_at,
      lastUsedAt: data.last_used_at,
    },
  };
}

export async function revokeExtensionToken(id: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();
  // RLS (0048_extension_api_tokens.sql) already scopes this to owner_id = auth.uid() — the
  // explicit .eq below just makes that intent visible in the code, matching every other
  // owner-scoped delete in this file's sibling actions.ts.
  const { error } = await supabase.from("extension_api_tokens").delete().eq("id", id).eq("owner_id", profile.id);
  if (error) return { ok: false, error: "Не удалось отозвать токен." };

  revalidatePath("/settings");
  return { ok: true };
}
