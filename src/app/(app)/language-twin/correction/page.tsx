import PageHeader from "@/components/product/page-header";
import LanguageTwinNav from "../language-twin-nav";
import { requireProfile } from "@/lib/auth";
import CorrectionForm from "./correction-form";

export default async function LanguageTwinCorrectionPage() {
  await requireProfile();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader
        title="Проверка предложения"
        description="Напиши предложение на английском — проверим по известным правилам, без ИИ и без внешних сервисов"
      />
      <LanguageTwinNav current="/language-twin/correction" />
      <CorrectionForm />
      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold">Что реально умеет эта проверка (v1)</h2>
        <div className="flex flex-col gap-2 text-sm">
          <p>
            <span className="mr-1 rounded-full bg-[var(--color-success)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--color-success-text)]">✓</span>
            Небольшой список известных пар «неправильный предлог» (depend of → on, married with → to)
          </p>
          <p>
            <span className="mr-1 rounded-full bg-[var(--color-warning)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--color-warning-text)]">~</span>
            Эвристика на пропущенный артикль и притяжательный падеж — часто ошибается, поэтому всегда с
            низкой уверенностью
          </p>
          <p>
            <span className="mr-1 rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)] dark:bg-white/10">
              ✕
            </span>
            Это не полноценный грамматический разбор и не ИИ — набор правил будет расширяться постепенно
          </p>
        </div>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        Мы сохраняем предложение только если ты сам нажмёшь «Сохранить как свидетельство». По умолчанию
        текст никуда не отправляется и не остаётся на сервере.
      </p>
    </div>
  );
}
