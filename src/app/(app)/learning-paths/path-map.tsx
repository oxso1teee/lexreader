import Link from "next/link";
import type { ActivePathState } from "./actions";

// Эталон: docs/moments/mockups/Path.dc.html, reference/Path.png. Синяя
// карточка текущего этапа, под ней извилистая тропа из крупных узлов:
// пройден (галочка), текущий (звезда в кольце + плашка «Начать»), закрыт
// (замок), в конце этапа — проверка (кубок). Показываются навыки ТЕКУЩЕГО
// этапа (с focusSkill); все этапы списком — ниже на странице. Статусы —
// реальные из progress-engine, не выдуманные.

type NodeStatus = "done" | "current" | "locked";

// Зигзаг из макета: left на холсте 390px, шаг по вертикали 94px.
const X_PATTERN = [159, 94, 128, 196, 236, 170] as const;
const ROW = 94;
const NODE_W = 72;

function NodeIcon({ status, isCheck }: { status: NodeStatus; isCheck?: boolean }) {
  const common = { viewBox: "0 0 24 24", width: 30, height: 30, fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (isCheck)
    return (
      <svg {...common}>
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
        <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
      </svg>
    );
  if (status === "done")
    return (
      <svg {...common}>
        <path d="M5 12l5 5L20 7" />
      </svg>
    );
  if (status === "current")
    return (
      <svg {...common} fill="currentColor" stroke="none">
        <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// Шапка активного пути (Path.dc.html): "Путь" / название / уровни справа.
export function PathHeader({ title, levelFrom, levelTo }: { title: string; levelFrom: string; levelTo: string }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <div className="min-w-0">
        <div className="mo-muted text-[13px] font-semibold">Путь</div>
        <h1 className="mo-disp mt-0.5 text-[20px] font-bold leading-tight">{title}</h1>
      </div>
      <span className="shrink-0 rounded-[10px] border-2 border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] font-bold">
        {levelFrom}→{levelTo}
      </span>
    </div>
  );
}

export default function PathMap({ state, pathSlug }: { state: ActivePathState; pathSlug: string }) {
  const stage =
    (state.focusSkill
      ? state.path.stages.find((s) => s.modules.some((m) => m.skills.some((sk) => sk.key === state.focusSkill!.key)))
      : null) ?? state.currentStage;
  if (!stage) return null;

  const stageNumber = state.path.stages.findIndex((s) => s.key === stage.key) + 1;
  const byKey = new Map(state.progressRows.map((row) => [row.skill_key, row]));
  const skills = stage.modules.flatMap((m) => m.skills);
  const allSkillsDone = skills.length > 0 && skills.every((skill) => Boolean(byKey.get(skill.key)?.content_completed_at));

  const nodes: { key: string; href: string; label: string; status: NodeStatus; isCheck?: boolean }[] = skills.map((skill) => ({
    key: skill.key,
    href: `/learning-paths/${pathSlug}/${stage.key}/${skill.key}`,
    label: skill.title,
    status: byKey.get(skill.key)?.content_completed_at ? "done" : skill.key === state.focusSkill?.key ? "current" : "locked",
  }));
  nodes.push({
    key: `${stage.key}-check`,
    href: `/learning-paths/${pathSlug}/${stage.key}/check`,
    label: "Проверка этапа",
    status: allSkillsDone ? "current" : "locked",
    isCheck: true,
  });

  const doneCount = skills.filter((skill) => byKey.get(skill.key)?.content_completed_at).length;
  const pct = skills.length > 0 ? Math.round((doneCount / skills.length) * 100) : 0;
  const currentIndex = nodes.findIndex((n) => n.status === "current");
  // Маскот — на строку ниже текущего узла, с противоположной от тропы стороны.
  const mascotRow = Math.min(nodes.length - 1, Math.max(0, currentIndex) + 1.4);
  const mascotLeftSide = X_PATTERN[Math.round(mascotRow) % X_PATTERN.length] > 150;
  const mapHeight = 30 + nodes.length * ROW;

  return (
    <div>
      <div
        style={{ borderRadius: 18, background: "#0b79b0", boxShadow: "inset 0 -5px 0 0 #075a85", color: "#fff", padding: "14px 16px 18px", display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 4 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", opacity: 0.9 }}>
            Этап {stageNumber} · {stage.title}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4, lineHeight: 1.25 }}>{stage.description}</div>
          <div
            style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,.3)", marginTop: 10, overflow: "hidden" }}
            role="progressbar"
            aria-label={`Пройдено ${doneCount} из ${skills.length} навыков этапа`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div style={{ width: `${pct}%`, height: "100%", background: "#fff", borderRadius: 99 }} />
          </div>
        </div>
        <Link
          href={`/learning-paths/${pathSlug}/${stage.key}`}
          aria-label="Все навыки этапа"
          style={{ width: 44, height: 44, borderRadius: 12, border: "2px solid rgba(255,255,255,.45)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z" />
            <path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" />
          </svg>
        </Link>
      </div>

      <ol style={{ position: "relative", height: mapHeight, margin: "0 -16px", listStyle: "none", padding: 0 }} aria-label={`Навыки этапа «${stage.title}»`}>
        {nodes.map((node, i) => {
          const x = X_PATTERN[i % X_PATTERN.length];
          const top = 30 + i * ROW;
          const leftPct = `calc(${((x / 390) * 100).toFixed(2)}%)`;
          const isCurrent = node.status === "current";
          const bubbleOnRight = x < 200;
          const circle = (
            <span className={`pt-node ${node.status === "locked" ? "pt-lock" : "pt-done"}`}>
              <NodeIcon status={node.status} isCheck={node.isCheck} />
            </span>
          );
          return (
            <li key={node.key} style={{ position: "absolute", left: leftPct, top, width: NODE_W }}>
              {isCurrent && <span aria-hidden="true" style={{ position: "absolute", left: -12, top: -12, width: 96, height: 96, borderRadius: 999, border: "6px solid var(--leaf-tint-strong)" }} />}
              {node.status === "locked" ? (
                <span role="img" aria-label={`${node.label}, закрыто`}>
                  {circle}
                </span>
              ) : (
                <Link href={node.href} aria-label={`${node.label}${node.status === "done" ? ", пройдено" : ", начать"}`}>
                  {circle}
                </Link>
              )}
              {isCurrent && (
                <Link
                  href={node.href}
                  tabIndex={-1}
                  className="pt-bounce"
                  style={{
                    position: "absolute",
                    top: 8,
                    ...(bubbleOnRight ? { left: NODE_W + 26 } : { right: NODE_W + 26 }),
                    width: "max-content",
                    maxWidth: 170,
                    background: "var(--surface)",
                    border: "2px solid var(--border-strong)",
                    borderRadius: 14,
                    padding: "8px 12px 10px",
                    boxShadow: "inset 0 -3px 0 0 var(--border)",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--leaf-text)" }}>Начать</div>
                  <div className="mo-muted" style={{ fontSize: 12, lineHeight: 1.3 }}>{node.label}</div>
                </Link>
              )}
            </li>
          );
        })}
        <li aria-hidden="true" className="pt-bob" style={{ position: "absolute", top: 30 + mascotRow * ROW, ...(mascotLeftSide ? { left: 34 } : { right: 34 }) }}>
          <svg viewBox="0 0 128 150" width="84" height="98">
            <ellipse cx="64" cy="128" rx="34" ry="9" fill="rgba(0,0,0,0.06)" />
            <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
            <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
            <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
            <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" opacity="0.85" />
          </svg>
        </li>
      </ol>
    </div>
  );
}
