import Link from "next/link";
import { Check, Lock, Sparkles, ShieldCheck } from "lucide-react";
import { ReadingCompanion } from "@/components/product/mascot/reading-companion";
import type { ActivePathState } from "./actions";

// docs/moments/mockups/Path.dc.html, docs/moments/ROADMAP.md этап 8 —
// извилистая тропа вместо списка строк. Показывает только навыки ТЕКУЩЕГО
// этапа (stage, содержащий focusSkill) + узел "Проверка этапа" в конце —
// полный путь по всем этапам сразу не поместился бы на одном экране и не
// нёс бы доп. смысла (полный список этапов остаётся ниже на странице).
// Позиции узлов — зигзаг по фиксированной формуле (не точные пиксели
// макета, которые заточены под один конкретный пример), но тот же язык:
// пройден/текущий/закрыт, реальные статусы из progress-engine.ts, не
// выдуманные.

type NodeStatus = "done" | "current" | "locked";

function statusMeta(status: NodeStatus) {
  if (status === "done") {
    return { circle: "bg-[var(--color-forest)] text-white shadow-[inset_0_-6px_0_0_var(--leaf-edge)]", Icon: Check };
  }
  if (status === "current") {
    return {
      circle: "border-2 border-[var(--color-forest)] bg-[var(--color-forest-tint)] text-[var(--color-forest-text)]",
      Icon: Sparkles,
    };
  }
  return { circle: "bg-[var(--surface-muted)] text-[var(--text-secondary)]", Icon: Lock };
}

// Зигзаг: смещение по X чередуется влево/в центр/вправо, как в макете
// (left: 159 -> 94 -> 128 -> 196 -> 236 -> 170 на холсте 390px).
const X_PATTERN = [62, 18, 36, 70, 86, 48] as const;

export default function PathMap({
  state,
  pathSlug,
}: {
  state: ActivePathState;
  pathSlug: string;
}) {
  const stage =
    (state.focusSkill
      ? state.path.stages.find((s) => s.modules.some((m) => m.skills.some((sk) => sk.key === state.focusSkill!.key)))
      : null) ?? state.currentStage;
  if (!stage) return null;

  const byKey = new Map(state.progressRows.map((row) => [row.skill_key, row]));
  const skills = stage.modules.flatMap((m) => m.skills);
  const allSkillsDone = skills.length > 0 && skills.every((skill) => Boolean(byKey.get(skill.key)?.content_completed_at));

  const nodes: { key: string; href: string; label: string; status: NodeStatus; isCheck?: boolean }[] = skills.map(
    (skill) => ({
      key: skill.key,
      href: `/learning-paths/${pathSlug}/${stage.key}/${skill.key}`,
      label: skill.title,
      status: byKey.get(skill.key)?.content_completed_at
        ? "done"
        : skill.key === state.focusSkill?.key
          ? "current"
          : "locked",
    }),
  );
  nodes.push({
    key: `${stage.key}-check`,
    href: `/learning-paths/${pathSlug}/${stage.key}/check`,
    label: "Проверка этапа",
    status: allSkillsDone ? (nodes.every((n) => n.status === "done") ? "current" : "locked") : "locked",
    isCheck: true,
  });

  const doneCount = skills.filter((skill) => byKey.get(skill.key)?.content_completed_at).length;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-[18px] p-4 text-white"
        style={{ background: "linear-gradient(150deg, var(--sky), var(--sky-edge))" }}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/85">{stage.title}</p>
        <p className="mt-1 text-[15px] font-semibold">{stage.description}</p>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
          <span
            className="block h-full rounded-full bg-white transition-[width]"
            style={{ width: `${skills.length > 0 ? Math.round((doneCount / skills.length) * 100) : 0}%` }}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-3 py-1" aria-label={`Узлы этапа «${stage.title}»`}>
        {nodes.map((node, i) => {
          const { circle, Icon } = statusMeta(node.status);
          const xOffset = X_PATTERN[i % X_PATTERN.length];
          const content = (
            <span
              aria-hidden="true"
              className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full ${circle}`}
            >
              {node.isCheck ? <ShieldCheck className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
            </span>
          );
          return (
            <li key={node.key} className="flex items-center gap-3" style={{ marginLeft: `${xOffset}%` }}>
              {node.status === "locked" ? (
                <span role="img" aria-label={`${node.label}, закрыто`}>
                  {content}
                </span>
              ) : (
                <Link href={node.href} aria-label={`${node.label}${node.status === "done" ? ", пройдено" : ", текущий"}`}>
                  {content}
                </Link>
              )}
              <span
                className={`text-[13px] font-semibold ${node.status === "locked" ? "text-[var(--text-secondary)]" : ""}`}
              >
                {node.label}
                {node.status === "current" && <span className="ml-1.5 text-[var(--color-forest-text)]">· начать</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex justify-center">
        <ReadingCompanion size={64} withHalo={false} />
      </div>
    </div>
  );
}
