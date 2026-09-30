import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { READY_LANGUAGES } from "@/lib/languages";
import PageHeader from "@/components/product/page-header";
import { createDuelAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "Живые дуэли по словарю 1 на 1". Живая проверка показала: случайный
// оппонент требует живого пула одновременно ищущих игроков, которого у
// проекта нет — честный MVP здесь только "создай дуэль → пришли ссылку
// другу", без matchmaking-очереди, которая будет пустовать.
export default async function DuelLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await requireProfile();
  const supported = READY_LANGUAGES.includes(profile.target_language);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader title="Дуэль по словарю" description="Тест на скорость и точность против друга — 1 на 1." />

      {error && (
        <p role="alert" className="rounded-2xl border border-[var(--color-danger-text)]/25 bg-[var(--color-danger-text)]/10 p-3 text-body-sm text-[var(--color-danger-text)]">
          {decodeURIComponent(error)}
        </p>
      )}

      <Card as="section">
        <p className="text-body-sm text-[var(--text-secondary)]">
          Оба игрока получают одинаковые слова из общего частотного списка (не из твоей личной
          колоды) — {"7 раундов"}, по одному слову за раз. Ответ засчитывается, только если он
          верный и успел прийти вовремя.
        </p>

        {!supported ? (
          <p className="mt-3 text-body-sm text-[var(--color-warning-text)]">
            Дуэли пока доступны только для изучающих английский.
          </p>
        ) : (
          <form action={createDuelAction} className="mt-3">
            <Button type="submit" variant="leaf">
              Создать дуэль и пригласить друга
            </Button>
          </form>
        )}
      </Card>

      <Link href="/progress" className="focus-ring self-start text-body-sm text-[var(--color-forest-text)]">
        ← К прогрессу
      </Link>
    </div>
  );
}
