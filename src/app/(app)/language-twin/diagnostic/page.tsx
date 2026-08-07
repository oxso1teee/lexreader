import LanguageTwinSubHeader from "../sub-header";
import { requireProfile } from "@/lib/auth";
import DiagnosticFlow from "./diagnostic-flow";

export default async function LanguageTwinDiagnosticPage() {
  await requireProfile();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <LanguageTwinSubHeader title="Мини-диагностика" description="6 коротких вопросов" />
      <DiagnosticFlow />
    </div>
  );
}
