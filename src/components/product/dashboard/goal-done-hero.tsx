import { CheckCircle2 } from "lucide-react";
import { Lex } from "@/components/product/mascot/lex";

// Состояние «цель дня выполнена» (макет Today-done): спокойный зелёный блок с
// итогом дня. Строки серии и итогов приходят готовыми и только из реальных
// данных; если их нет — просто не показываются.
export default function GoalDoneHero({
  xpToday,
  xpGoal,
  streakLine,
  summary,
}: {
  xpToday: number;
  xpGoal: number;
  streakLine: string | null;
  summary: string[];
}) {
  return (
    <section className="dash-hero" aria-labelledby="dash-done-title">
      <div className="dash-hero-body">
        <h2 id="dash-done-title" className="dash-hero-eyebrow">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          Цель дня выполнена
        </h2>
        <p className="dash-hero-num">
          {xpToday}
          <small>/{xpGoal} XP</small>
        </p>
        {streakLine && <p className="dash-hero-sub">{streakLine}</p>}
        <div
          className="dash-done-bar"
          role="progressbar"
          aria-valuenow={100}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Цель дня: ${xpToday} из ${xpGoal} XP`}
        >
          <span />
        </div>
        {summary.length > 0 && <p className="dash-hero-foot">{summary.join(" · ")}</p>}
      </div>
      <div className="dash-hero-lex" aria-hidden="true">
        <Lex mood="cool" tone="pale" size={96} bob />
      </div>
    </section>
  );
}
