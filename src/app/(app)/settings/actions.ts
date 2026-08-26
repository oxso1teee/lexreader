"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { sendPush } from "@/lib/push";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// explicit opt-in, никогда не включается автоматически. RLS на profiles
// ("owner full access", 0001_init.sql) уже гарантирует, что этот UPDATE
// затрагивает только собственную строку — .eq("id", profile.id) ниже
// делает то же самое явным в коде, тот же паттерн, что и revokeExtensionToken.
export async function updateLeaderboardOptIn(optIn: boolean): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ leaderboard_opt_in: optIn }).eq("id", profile.id);
  if (error) return { ok: false, error: "Не удалось сохранить настройку." };

  revalidatePath("/settings");
  revalidatePath("/leaderboard");
  return { ok: true };
}

export interface UpdateProfileState {
  error?: string;
  saved?: boolean;
}

export async function updateProfile(
  _prevState: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const profile = await requireProfile();
  const targetLanguage = String(formData.get("target_language") || "");
  const nativeLanguage = String(formData.get("native_language") || "");
  if (!targetLanguage || !nativeLanguage) {
    return { error: "Выбери оба языка" };
  }
  if (targetLanguage === nativeLanguage) {
    return { error: "Изучаемый и родной языки должны отличаться" };
  }
  const level = String(formData.get("level") || "") || null;
  const dailyWordGoal = Number(formData.get("daily_word_goal"));
  if (!dailyWordGoal || Number.isNaN(dailyWordGoal)) {
    return { error: "Укажи цель в день" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      target_language: targetLanguage,
      native_language: nativeLanguage,
      level,
      daily_word_goal: dailyWordGoal,
    })
    .eq("id", profile.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/home");
  revalidatePath("/library");
  return { saved: true };
}

interface SubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function savePushSubscription(sub: SubscriptionInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      owner_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

// Найдено при повторном аудите: кнопка "Отключить уведомления" удаляла
// только подписку ТЕКУЩЕГО устройства (registration.pushManager.getSubscription()
// на этом браузере). Если пользователь включил пуш на телефоне, а открыл
// настройки на ноутбуке (который сам никогда не подписывался), нажатие
// "Отключить" на ноутбуке ничего не удаляло в БД, но UI всё равно показывал
// "отключено" — телефон продолжал получать напоминания. Единственный тумблер
// в UI подразумевает "отключить везде" — удаляем все подписки владельца.
export async function deleteAllPushSubscriptions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { error } = await supabase.from("push_subscriptions").delete().eq("owner_id", user.id);
  if (error) throw new Error(error.message);
}

export async function sendTestPush(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Не авторизован" };

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("owner_id", user.id);

  if (!subs || subs.length === 0) {
    return { ok: false, error: "Нет активной подписки на уведомления." };
  }

  let sent = 0;
  for (const sub of subs) {
    try {
      await sendPush(sub, {
        title: "LexReader",
        body: "Тестовое уведомление — напоминания о повторении работают!",
        url: "/brain/all/review",
      });
      sent++;
    } catch (e) {
      const statusCode = (e as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }

  return sent > 0 ? { ok: true } : { ok: false, error: "Не удалось отправить уведомление." };
}

export interface FeedbackState {
  ok?: boolean;
  error?: string;
}

// Раздел 5 промта 2026-07-30 (рост): явный канал обратной связи — раньше
// его не было в интерфейсе вообще.
export async function sendFeedback(
  _prevState: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const profile = await requireProfile();
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { error: "Напиши сообщение." };
  if (message.length > 2000) return { error: "Слишком длинное сообщение." };

  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({ owner_id: profile.id, message });
  if (error) return { error: "Не удалось отправить — попробуй ещё раз." };
  return { ok: true };
}
