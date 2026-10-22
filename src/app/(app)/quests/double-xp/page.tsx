import { requireProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DoubleXpScreen } from "@/components/product/quests/double-xp-screen";

// docs/moments/mockups/Double-XP.dc.html. "until" приходит из Chest-экрана
// (реальный profiles.xp_boost_until), не пересчитывается здесь заново —
// если буста уже нет (протух/боостнуть не удалось) — назад на /home,
// ничего не выдумываем взамен.
export default async function DoubleXpPage({ searchParams }: { searchParams: Promise<{ until?: string }> }) {
  await requireProfile();
  const { until } = await searchParams;
  // DoubleXpScreen сам честно покажет 00:00, если until уже в прошлом —
  // не вычисляем "просрочен или нет" здесь (react-hooks/purity не пропускает
  // Date.now() в рендере серверного компонента ни в каком виде).
  if (!until) {
    redirect("/home");
  }
  return <DoubleXpScreen boostUntil={until} reviewHref="/brain/all/review" />;
}
