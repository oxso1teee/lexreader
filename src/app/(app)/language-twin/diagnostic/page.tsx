import PageHeader from "@/components/product/page-header";
import LanguageTwinNav from "../language-twin-nav";
import { requireProfile } from "@/lib/auth";
import DiagnosticFlow from "./diagnostic-flow";

export default async function LanguageTwinDiagnosticPage() {
  await requireProfile();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader title="Мини-диагностика" description="Несколько коротких вопросов — грамматика, порядок слов, лексика" />
      <LanguageTwinNav current="/language-twin/diagnostic" />
      <DiagnosticFlow />
    </div>
  );
}
