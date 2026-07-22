"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isStripeConfigured, getStripeClient } from "@/lib/stripe";

export interface DeleteAccountState {
  error?: string;
}

const CONFIRMATION_PHRASE = "УДАЛИТЬ";

// P0-AUTH-05: пользователь должен уметь удалить аккаунт сам, из UI. Сначала
// отменяем активную Stripe-подписку (если есть), потом удаляем сам аккаунт —
// каскадные FK (on delete cascade) вычищают все остальные таблицы за нас.
export async function deleteAccount(
  _prevState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== CONFIRMATION_PHRASE) {
    return { error: `Введи «${CONFIRMATION_PHRASE}» для подтверждения.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован." };

  if (isStripeConfigured()) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (sub?.stripe_subscription_id) {
      try {
        await getStripeClient().subscriptions.cancel(sub.stripe_subscription_id);
      } catch {
        // Уже отменена/не найдена в Stripe — не блокировать удаление аккаунта из-за этого.
      }
    }
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.auth.admin.deleteUser(user.id);
  if (error) {
    return { error: "Не удалось удалить аккаунт. Попробуй ещё раз или напиши в поддержку." };
  }

  await supabase.auth.signOut();
  redirect("/login");
}
