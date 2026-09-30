import { AlertTriangle, Check, X } from "lucide-react";
import LanguageTwinSubHeader from "../sub-header";
import { requireProfile } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import CorrectionForm from "./correction-form";

export default async function LanguageTwinCorrectionPage() {
  await requireProfile();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <LanguageTwinSubHeader
        title="Проверка предложения"
        description="Напиши предложение на английском — проверим по известным правилам, без ИИ и без внешних сервисов"
      />
      <CorrectionForm />
      <Card>
        <h2 className="mb-2 text-sm font-semibold">Что реально умеет эта проверка (v1)</h2>
        <div className="flex flex-col gap-2 text-sm">
          <p>
            <span className="mr-1 inline-flex rounded-full bg-[var(--color-success)]/15 px-2 py-0.5 align-middle text-[var(--color-success-text)]">
              <Check aria-label="Надёжно" className="h-3 w-3" />
            </span>
            Небольшой список известных пар «неправильный предлог» (depend of → on, married with → to)
          </p>
          <p>
            <span className="mr-1 inline-flex rounded-full bg-[var(--color-warning)]/15 px-2 py-0.5 align-middle text-[var(--color-warning-text)]">
              <AlertTriangle aria-label="Эвристика" className="h-3 w-3" />
            </span>
            Эвристика на пропущенный артикль и притяжательный падеж — часто ошибается, поэтому всегда с
            низкой уверенностью
          </p>
          <p>
            <span className="mr-1 inline-flex rounded-full bg-black/5 px-2 py-0.5 align-middle text-[var(--text-secondary)] dark:bg-white/10">
              <X aria-label="Не поддерживается" className="h-3 w-3" />
            </span>
            Это не полноценный грамматический разбор и не ИИ — набор правил будет расширяться постепенно
          </p>
        </div>
      </Card>
      <p className="text-xs text-[var(--text-secondary)]">
        Мы сохраняем предложение только если ты сам нажмёшь «Сохранить в профиль». По умолчанию текст
        никуда не отправляется и не остаётся на сервере.
      </p>
    </div>
  );
}
