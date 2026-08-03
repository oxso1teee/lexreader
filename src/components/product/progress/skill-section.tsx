import { skillStatus, SKILL_STATUS_LABEL, type SkillStatus } from "@/lib/skill-status";

// --color-success/--color-warning как ЦВЕТ ТЕКСТА дают только 3.29:1/~3:1 на
// светлом --surface (найдено axe-core) — тот же паттерн, что и caramel-text
// в tokens.css: text-safe варианты только для текста, не для фона/иконки.
const STATUS_COLOR: Record<SkillStatus, string> = {
  few_data: "text-[var(--text-secondary)]",
  collecting: "text-[var(--color-warning-text)]",
  trending: "text-[var(--color-success-text)]",
};

function SkillCard({ label, count, suffix }: { label: string; count: number; suffix?: string }) {
  const status = skillStatus(count);
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-[var(--surface)] p-3 shadow-sm">
      <span className="text-caption">{label}</span>
      <span className={`text-body-sm font-semibold ${STATUS_COLOR[status]}`}>{SKILL_STATUS_LABEL[status]}</span>
      <span className="text-caption text-[var(--text-secondary)]">
        {count} {suffix ?? "событий"}
      </span>
    </div>
  );
}

// M3 UI slice 2: до Language Twin честно измеримы только эти 4 направления
// (docs/ui/slice2-data-audit.md) — никаких Speaking/Listening/Grammar/CEFR,
// пока нет системы, которая реально их оценивает.
export default function SkillSection({
  readingSessions,
  vocabularyGrowth,
  reviewConsistency,
  activeDays,
}: {
  readingSessions: number;
  vocabularyGrowth: number;
  reviewConsistency: number;
  activeDays: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <SkillCard label="Активность чтения" count={readingSessions} suffix="сессий" />
      <SkillCard label="Рост словаря (7 дней)" count={vocabularyGrowth} suffix="слов" />
      <SkillCard label="Регулярность повторений" count={reviewConsistency} suffix="ответов" />
      <SkillCard label="Регулярность занятий" count={activeDays} suffix="дней" />
    </div>
  );
}
